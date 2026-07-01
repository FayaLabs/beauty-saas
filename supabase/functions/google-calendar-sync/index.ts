import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'
const env = (key: string) => Deno.env.get(key) ?? ''
const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function decode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)))
}
async function signature(payload: string): Promise<string> {
  const secret = env('GCAL_STATE_SECRET')
  if (!secret) throw new Error('GCAL_STATE_SECRET não configurado')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))))
}
async function makeState(value: unknown): Promise<string> {
  const payload = b64url(JSON.stringify(value)); return `${payload}.${await signature(payload)}`
}
async function readState(state: string): Promise<any> {
  const [payload, supplied] = state.split('.')
  if (!payload || !supplied || supplied !== await signature(payload)) throw new Error('Estado OAuth inválido')
  const value = JSON.parse(decode(payload))
  if (!value.exp || value.exp < Date.now()) throw new Error('Estado OAuth expirado')
  return value
}
function allowedRedirect(raw: string): string {
  const target = new URL(raw || 'http://localhost:5180')
  const allowed = (env('GCAL_ALLOWED_REDIRECT_ORIGINS') || 'http://localhost:5180').split(',').map((v) => v.trim())
  if (!allowed.includes(target.origin)) throw new Error('URL de retorno não permitida')
  return target.toString()
}
async function authenticatedTenant(req: Request, tenantId: string) {
  if (!tenantId) throw new Error('Tenant não informado')
  const authorization = req.headers.get('Authorization') ?? ''
  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) throw new Error('Sessão inválida')
  const db = admin()
  const { data } = await db.schema('saas_core').from('tenant_members').select('tenant_id').eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle()
  if (!data) throw new Error('Usuário não pertence ao tenant selecionado')
  return { db, user }
}
function consentUrl(state: string): string {
  return `${AUTH}?${new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: env('GCAL_REDIRECT_URI'), response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar.events', access_type: 'offline', prompt: 'consent', state }).toString()}`
}
async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) })
  const value = await response.json(); if (!response.ok) throw new Error(value.error_description ?? 'Falha no OAuth do Google'); return value
}
async function accessToken(db: any, integration: any): Promise<string> {
  if (integration.oauth_access_token && new Date(integration.token_expires_at ?? 0).getTime() > Date.now() + 60_000) return integration.oauth_access_token
  const token = await tokenRequest({ refresh_token: integration.oauth_refresh_token, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), grant_type: 'refresh_token' })
  await db.from('calendar_integrations').update({ oauth_access_token: token.access_token, token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('id', integration.id).eq('tenant_id', integration.tenant_id)
  return token.access_token
}
async function google(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (response.status === 204) return {}; const text = await response.text()
  if (!response.ok) throw new Error(`Google Calendar ${response.status}: ${text.slice(0, 250)}`)
  return text ? JSON.parse(text) : {}
}
async function integrationFor(db: any, tenantId: string) {
  const { data } = await db.from('calendar_integrations').select('*').eq('tenant_id', tenantId).eq('provider', 'google').eq('active', true).maybeSingle()
  if (!data?.oauth_refresh_token) throw new Error('Google Calendar não conectado'); return data
}
async function sync(db: any, integration: any) {
  const token = await accessToken(db, integration); const calendar = encodeURIComponent(integration.calendar_id); const core = db.schema('saas_core')
  const now = new Date().toISOString(); const until = new Date(Date.now() + 180 * 86400_000).toISOString()
  const { data: pendingDeletes } = await db.from('calendar_delete_outbox').select('*')
    .eq('tenant_id', integration.tenant_id).eq('provider', 'google').order('created_at').limit(100)
  for (const pending of pendingDeletes ?? []) {
    try {
      await google(token, `/calendars/${calendar}/events/${encodeURIComponent(pending.external_event_id)}`, { method: 'DELETE' })
      await db.from('calendar_delete_outbox').delete().eq('id', pending.id).eq('tenant_id', integration.tenant_id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Google returns 404/410 when the event is already absent; either state
      // satisfies the requested deletion.
      if (message.includes('404') || message.includes('410')) {
        await db.from('calendar_delete_outbox').delete().eq('id', pending.id).eq('tenant_id', integration.tenant_id)
      } else {
        await db.from('calendar_delete_outbox').update({ attempts: (pending.attempts ?? 0) + 1, last_error: message }).eq('id', pending.id).eq('tenant_id', integration.tenant_id)
        throw error
      }
    }
  }
  // Pull first so an edit made in Google (including on mobile) is not
  // overwritten by the stale local value during the same manual sync.
  const params = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', timeMin: now, timeMax: until, maxResults: '250' })
  const events = await google(token, `/calendars/${calendar}/events?${params}`)
  for (const event of events.items ?? []) {
    let bookingId = event.extendedProperties?.private?.beautyBookingId
    if (!bookingId) {
      const { data: linked } = await core.from('bookings').select('id')
        .eq('tenant_id', integration.tenant_id)
        .contains('metadata', { googleCalendarEventId: event.id }).maybeSingle()
      bookingId = linked?.id
    }
    if (!bookingId && event.status !== 'cancelled' && event.start?.dateTime) {
      const { data: staff } = await core.from('persons').select('id').eq('tenant_id', integration.tenant_id)
        .eq('kind', 'staff').eq('is_active', true).order('created_at').limit(2)
      if ((staff ?? []).length === 1) {
        const { data: imported, error: importError } = await core.from('bookings').insert({
          tenant_id: integration.tenant_id, kind: 'block', assignee_id: staff[0].id,
          starts_at: event.start.dateTime, ends_at: event.end?.dateTime ?? event.start.dateTime,
          status: 'confirmed', notes: event.summary || 'Compromisso do Google Calendar',
          metadata: { source: 'google_calendar', googleCalendarEventId: event.id, googleCalendarImported: true },
        }).select('id').single()
        if (importError) throw importError
        bookingId = imported.id
      }
    }
    if (!bookingId) continue
    const patch = event.status === 'cancelled' ? { status: 'cancelled' } : event.start?.dateTime ? { starts_at: event.start.dateTime, ends_at: event.end?.dateTime ?? null } : null
    if (patch) await core.from('bookings').update(patch).eq('tenant_id', integration.tenant_id).eq('id', bookingId)
  }
  const { data: bookings, error } = await core.from('bookings').select('*')
    .eq('tenant_id', integration.tenant_id)
    .eq('kind', 'appointment')
    .gte('starts_at', now)
    .lte('starts_at', until)
  if (error) throw error
  let written = 0
  for (const booking of bookings ?? []) {
    const eventId = booking.metadata?.googleCalendarEventId
    if (booking.status === 'cancelled' && eventId) {
      await google(token, `/calendars/${calendar}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' }).catch((e) => { if (!String(e.message).includes('410')) throw e }); written++; continue
    }
    if (booking.status === 'cancelled') continue
    const event = { summary: booking.metadata?.serviceNames || booking.metadata?.contactName || 'Agendamento BeautySoft', description: booking.notes ?? undefined, start: { dateTime: booking.starts_at }, end: { dateTime: booking.ends_at ?? booking.starts_at }, extendedProperties: { private: { beautyBookingId: booking.id, beautyTenantId: integration.tenant_id } } }
    const saved = eventId
      ? await google(token, `/calendars/${calendar}/events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(event) })
      : await google(token, `/calendars/${calendar}/events`, { method: 'POST', body: JSON.stringify(event) })
    await core.from('bookings').update({ metadata: { ...(booking.metadata ?? {}), googleCalendarEventId: saved.id, googleCalendarSyncedAt: new Date().toISOString() } }).eq('tenant_id', integration.tenant_id).eq('id', booking.id); written++
  }
  await db.from('calendar_integrations').update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', integration.id).eq('tenant_id', integration.tenant_id)
  await db.from('calendar_sync_log').insert({ tenant_id: integration.tenant_id, direction: 'outbound', trigger: 'manual', fetched: events.items?.length ?? 0, written })
  return { fetched: events.items?.length ?? 0, written }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const url = new URL(req.url)
    if (req.method === 'GET' && url.searchParams.has('code')) {
      const state = await readState(url.searchParams.get('state') ?? ''); const db = admin()
      const token = await tokenRequest({ code: url.searchParams.get('code')!, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: env('GCAL_REDIRECT_URI'), grant_type: 'authorization_code' })
      if (!token.refresh_token) throw new Error('Google não retornou refresh token; revogue o acesso anterior e tente novamente')
      await db.from('calendar_integrations').upsert({ tenant_id: state.tenantId, provider: 'google', oauth_refresh_token: token.refresh_token, oauth_access_token: token.access_token, token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(), active: true, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,provider' })
      return Response.redirect(allowedRedirect(state.redirectTo), 302)
    }
    if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
    const body = await req.json(); const { db } = await authenticatedTenant(req, body.tenantId)
    if (body.action === 'oauth_start') return json({ url: consentUrl(await makeState({ tenantId: body.tenantId, redirectTo: allowedRedirect(body.redirectTo), exp: Date.now() + 10 * 60_000 })) })
    if (body.action === 'status') {
      const { data } = await db.from('calendar_integrations').select('*').eq('tenant_id', body.tenantId).eq('provider', 'google').maybeSingle()
      return json({ integration: data ? {
        id: data.id, calendarId: data.calendar_id ?? 'primary', active: data.active ?? true,
        connected: Boolean(data.active && data.oauth_refresh_token), lastSyncAt: data.last_sync_at ?? undefined,
      } : null })
    }
    if (body.action === 'disconnect') {
      const { data } = await db.from('calendar_integrations').select('id, oauth_refresh_token, oauth_access_token').eq('tenant_id', body.tenantId).eq('provider', 'google').maybeSingle()
      const credential = data?.oauth_refresh_token ?? data?.oauth_access_token
      if (credential) {
        const revoke = await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: credential }),
        })
        // 400 means the credential was already invalid/revoked, which is also a
        // successful disconnected state. Other failures remain retryable.
        if (!revoke.ok && revoke.status !== 400) throw new Error(`Google não confirmou a revogação (${revoke.status})`)
      }
      await db.from('calendar_integrations').update({ active: false, oauth_refresh_token: null, oauth_access_token: null, token_expires_at: null, sync_token: null, updated_at: new Date().toISOString() }).eq('tenant_id', body.tenantId).eq('provider', 'google')
      return json({ ok: true, revokedAtGoogle: Boolean(credential) })
    }
    if (body.action === 'set_calendar') { await db.from('calendar_integrations').update({ calendar_id: body.calendarId || 'primary', sync_token: null, updated_at: new Date().toISOString() }).eq('tenant_id', body.tenantId).eq('provider', 'google'); return json({ ok: true }) }
    if (body.action === 'pull_events') return json(await sync(db, await integrationFor(db, body.tenantId)))
    return json({ error: 'Ação desconhecida' }, 400)
  } catch (error) { console.error('[google-calendar-sync]', error); return json({ error: error instanceof Error ? error.message : 'Erro interno' }, 400) }
})
