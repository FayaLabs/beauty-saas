// plugbank-sync request handling, extracted from index.ts so it can run under
// `node --test` (same shape as plugin-agenda's functions/_shared runtime).
// Every effect is injected — the Supabase client factory, env lookup and fetch —
// so a test can drive the whole request without Deno and without a network.
//
// index.ts is the Deno wiring: it imports the real createClient, reads Deno.env
// and hands both to handleRequest.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_PLUGBANK_BASE = 'https://api.plugbank.com.br'

export class PlugBankError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'PlugBankError'
    this.status = status
  }
}

async function plugbankFetch(fetchImpl, base, token, path, init) {
  const res = await fetchImpl(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new PlugBankError(res.status, text.slice(0, 400))
  return text ? JSON.parse(text) : {}
}

export function mapPlugBankError(err) {
  if (err instanceof PlugBankError) {
    if (err.status === 401 || err.status === 403) return 'Token PlugBank inválido ou sem permissão para o extrato. Verifique no portal Tecnospeed.'
    if (err.status === 404) return 'Conta/CNPJ não encontrado no PlugBank para as credenciais informadas.'
    return `PlugBank retornou erro ${err.status}.`
  }
  return `Falha ao consultar o PlugBank: ${String(err?.message ?? err).slice(0, 200)}`
}

// Normalize a PlugBank statement entry → our canonical line. Field names follow
// the PlugBank extrato payload; adjust to the confirmed schema.
export function normalize(item, cnpj) {
  const raw = Number(item.valor ?? item.amount ?? 0)
  const type = (item.tipo ?? item.type ?? (raw >= 0 ? 'C' : 'D')).toString().toUpperCase().startsWith('C') ? 'C' : 'D'
  const date = String(item.data ?? item.date ?? '').slice(0, 10)
  return {
    externalId: String(item.id ?? item.idTransacao ?? item.documentNumber ?? `${cnpj}_${date}_${Math.abs(raw)}`),
    date,
    type,
    amount: Math.abs(raw),
    description: String(item.descricao ?? item.description ?? item.historico ?? 'Lançamento bancário'),
  }
}

async function fetchStatement(fetchImpl, base, token, cnpj, from, to) {
  // PlugBank extrato endpoint (confirm path/params against the portal).
  const data = await plugbankFetch(fetchImpl, base, token, `/v1/extrato?cnpj=${encodeURIComponent(cnpj)}&dataInicial=${from}&dataFinal=${to}`)
  const items = data?.lancamentos ?? data?.transactions ?? data?.data ?? data?.items ?? []
  return items.map((it) => normalize(it, cnpj)).filter((l) => l.date && l.amount > 0)
}

export async function handleRequest(req, deps) {
  const { createClient, env } = deps
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const base = env('PLUGBANK_BASE_URL') ?? DEFAULT_PLUGBANK_BASE

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    // The pool serves N tenants, so a valid JWT only proves the caller is
    // someone — never which tenant. Every statement below therefore runs as the
    // caller, not as service_role: tenancy is decided by RLS
    // (tenant_id IN (SELECT public.user_tenant_ids())) on bank_integrations,
    // plg_financial_movements and bank_integration_sync_log, all of which grant
    // `authenticated` exactly the SELECT/INSERT/UPDATE this function needs.
    // Nothing here requires bypassing RLS, so nothing here holds the service key.
    const jwt = String(req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Não autenticado' }, 401)

    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: caller } = await db.auth.getUser(jwt)
    if (!caller?.user) return json({ error: 'Não autenticado' }, 401)

    const body = await req.json()
    const action = body.action

    // ---- test_connection: validate creds without importing ----
    if (action === 'test_connection') {
      try {
        await fetchStatement(fetchImpl, base, body.apiToken, body.cnpj, body.from ?? new Date().toISOString().slice(0, 10), body.to ?? new Date().toISOString().slice(0, 10))
        return json({ ok: true, message: 'Conexão válida' })
      } catch (err) {
        return json({ ok: false, message: mapPlugBankError(err) })
      }
    }

    // For the data actions we need the stored integration (token + tenant).
    // Read as the caller: a connection owned by another tenant is invisible, so
    // it comes back null and takes the same 404 as an id that never existed —
    // the response must not confirm that another tenant's connection exists.
    const { data: integration } = await db
      .from('bank_integrations')
      .select('*')
      .eq('id', body.integrationId)
      .maybeSingle()
    if (!integration) return json({ error: 'Integração não encontrada' }, 404)

    // ---- fetch_statement: return normalized lines (no DB writes) ----
    if (action === 'fetch_statement') {
      const lines = await fetchStatement(fetchImpl, base, integration.api_token, integration.cnpj, body.from, body.to)
      return json({ lines })
    }

    // ---- import_transactions: upsert selected lines into the ledger ----
    if (action === 'import_transactions') {
      const lines = body.lines ?? []
      let imported = 0, duplicates = 0
      for (const l of lines) {
        const { error } = await db.from('plg_financial_movements').insert({
          tenant_id: integration.tenant_id,
          direction: l.type === 'C' ? 'credit' : 'debit',
          movement_kind: 'payment',
          amount: l.amount,
          paid_amount: l.amount,
          status: 'paid',
          due_date: l.date,
          payment_date: l.date,
          bank_account_id: body.bankAccountId ?? integration.bank_account_id ?? null,
          notes: l.description,
          external_id: l.externalId,
          external_source: 'plugbank',
        })
        if (error) {
          if (error.code === '23505') duplicates++
          else throw error
        } else imported++
      }

      await db.from('bank_integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration.id)
      await db.from('bank_integration_sync_log').insert({
        tenant_id: integration.tenant_id,
        bank_integration_id: integration.id,
        bank_account_id: body.bankAccountId ?? integration.bank_account_id ?? null,
        period_from: body.from ?? null,
        period_to: body.to ?? null,
        transactions_fetched: lines.length,
        transactions_imported: imported,
        duplicates,
        status: 'success',
      })

      return json({ imported, duplicates })
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400)
  } catch (err) {
    return json({ error: mapPlugBankError(err) }, 500)
  }
}
