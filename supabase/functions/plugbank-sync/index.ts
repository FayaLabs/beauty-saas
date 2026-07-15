// plugbank-sync — Tecnospeed PlugBank open-banking statement sync (data plane).
//
// Holds the bank-API credentials server-side and does the real work: validate
// the connection, fetch the statement for a date range, and import selected
// lines into public.plg_financial_movements (tagged external_source='plugbank',
// idempotent via the uq_plg_financial_movements_external index). The browser only
// invokes these actions; it never sees the bank API directly.
//
// Actions: test_connection | fetch_statement | import_transactions.
// Modeled on the predecessor app's inter-integration / pagbank-integration.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Tecnospeed PlugBank — statement (extrato) API.
// NOTE: confirm base URL + endpoints + auth against the PlugBank dev portal /
// sandbox before production. Token + CNPJ identify the account.
const PLUGBANK_BASE = Deno.env.get('PLUGBANK_BASE_URL') ?? 'https://api.plugbank.com.br'

interface NormalizedLine {
  externalId: string
  date: string        // YYYY-MM-DD
  type: 'C' | 'D'
  amount: number
  description: string
}

class PlugBankError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function plugbankFetch(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${PLUGBANK_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init?.headers ?? {}) },
  })
  const text = await res.text()
  if (!res.ok) throw new PlugBankError(res.status, text.slice(0, 400))
  return text ? JSON.parse(text) : {}
}

function mapPlugBankError(err: unknown): string {
  if (err instanceof PlugBankError) {
    if (err.status === 401 || err.status === 403) return 'Token PlugBank inválido ou sem permissão para o extrato. Verifique no portal Tecnospeed.'
    if (err.status === 404) return 'Conta/CNPJ não encontrado no PlugBank para as credenciais informadas.'
    return `PlugBank retornou erro ${err.status}.`
  }
  return `Falha ao consultar o PlugBank: ${String((err as any)?.message ?? err).slice(0, 200)}`
}

// Normalize a PlugBank statement entry → our canonical line. Field names follow
// the PlugBank extrato payload; adjust to the confirmed schema.
function normalize(item: any, cnpj: string): NormalizedLine {
  const raw = Number(item.valor ?? item.amount ?? 0)
  const type: 'C' | 'D' = (item.tipo ?? item.type ?? (raw >= 0 ? 'C' : 'D')).toString().toUpperCase().startsWith('C') ? 'C' : 'D'
  const date = String(item.data ?? item.date ?? '').slice(0, 10)
  return {
    externalId: String(item.id ?? item.idTransacao ?? item.documentNumber ?? `${cnpj}_${date}_${Math.abs(raw)}`),
    date,
    type,
    amount: Math.abs(raw),
    description: String(item.descricao ?? item.description ?? item.historico ?? 'Lançamento bancário'),
  }
}

async function fetchStatement(token: string, cnpj: string, from: string, to: string): Promise<NormalizedLine[]> {
  // PlugBank extrato endpoint (confirm path/params against the portal).
  const data = await plugbankFetch(token, `/v1/extrato?cnpj=${encodeURIComponent(cnpj)}&dataInicial=${from}&dataFinal=${to}`)
  const items: any[] = data?.lancamentos ?? data?.transactions ?? data?.data ?? data?.items ?? []
  return items.map((it) => normalize(it, cnpj)).filter((l) => l.date && l.amount > 0)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json()
    const action = body.action as string

    // ---- test_connection: validate creds without importing ----
    if (action === 'test_connection') {
      try {
        await fetchStatement(body.apiToken, body.cnpj, body.from ?? new Date().toISOString().slice(0, 10), body.to ?? new Date().toISOString().slice(0, 10))
        return json({ ok: true, message: 'Conexão válida' })
      } catch (err) {
        return json({ ok: false, message: mapPlugBankError(err) })
      }
    }

    // For the data actions we need the stored integration (token + tenant).
    const { data: integration } = await admin
      .from('bank_integrations')
      .select('*')
      .eq('id', body.integrationId)
      .single()
    if (!integration) return json({ error: 'Integração não encontrada' }, 404)

    // ---- fetch_statement: return normalized lines (no DB writes) ----
    if (action === 'fetch_statement') {
      const lines = await fetchStatement(integration.api_token, integration.cnpj, body.from, body.to)
      return json({ lines })
    }

    // ---- import_transactions: upsert selected lines into the ledger ----
    if (action === 'import_transactions') {
      const lines: NormalizedLine[] = body.lines ?? []
      let imported = 0, duplicates = 0
      for (const l of lines) {
        const { error } = await admin.from('plg_financial_movements').insert({
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
          if ((error as any).code === '23505') duplicates++
          else throw error
        } else imported++
      }

      await admin.from('bank_integrations').update({ last_sync_at: new Date().toISOString() }).eq('id', integration.id)
      await admin.from('bank_integration_sync_log').insert({
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
})
