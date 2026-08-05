// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.
// Fonte: plugin-agenda/functions/google-calendar-sync
// Edite no repo do plugin e rode: npm run functions:sync
// google-calendar-sync — bidirectional Google Calendar "smart sync" (data plane).
//
// Holds the Google OAuth client secret server-side. Actions:
//   oauth_start           → return the Google consent URL
//   oauth_callback        → exchange the code, store the refresh token (GET redirect)
//   list_calendars        → GET the user's calendarList (for the de-para picker)
//   list_external_events  → future, unlinked events across active channels (import wizard preview)
//   import_events         → import selected events as appointments (via gcal_import_event RPC)
//   push_event            → outbound: a booking change → create/update/delete a Google event
//   pull_events           → inbound: incremental channel changes → patch/cancel linked appointments
//
// Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GCAL_REDIRECT_URI,
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Mapping is NOT mirrored here — the pure helpers come from the SDK's single
// source of truth (../../src/integrations/google-calendar/mapping.ts). They use
// only `import type`, so the Deno bundler elides those type imports and pulls no
// node/react runtime deps into the function bundle.
//
// Loop prevention: the outbound DB trigger skips writes made while the
// TRANSACTION-LOCAL GUC app.booking_origin='google' is set. The guard is
// deliberately transient (not persisted metadata): a persistent marker would
// permanently mute pushes for imported events, so a later admin edit would
// never reach Google. Therefore ALL appointment writes from this function go
// through the SECURITY DEFINER RPCs (gcal_import_event / gcal_apply_event_patch
// for inbound, gcal_stamp_outbound for the outbound event-id bookkeeping) —
// each RPC sets the GUC before writing. metadata.syncOrigin stays as
// provenance only; the trigger does not read it.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import {
  appointmentRowToEvent,
  eventTimes,
  resolveTargetChannel,
  channelRowToChannel,
} from '../../src/integrations/google-calendar/mapping.ts'
import { GCAL_TABLES } from '../../src/integrations/google-calendar/data/tables.ts'
import type { ChannelDirection } from '../../src/integrations/google-calendar/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const CAL_API = 'https://www.googleapis.com/calendar/v3'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly'

const env = (k: string) => Deno.env.get(k) ?? ''
const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

// --- OAuth helpers ----------------------------------------------------------

function consentUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: env('GCAL_REDIRECT_URI'),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH}?${p.toString()}`
}

async function exchangeCode(code: string): Promise<any> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: env('GCAL_REDIRECT_URI'),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)
  return res.json()
}

/** Return a valid access token for the integration, refreshing if expired. */
async function accessToken(db: any, integ: any): Promise<string> {
  const exp = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0
  if (integ.oauth_access_token && exp > Date.now() + 60_000) return integ.oauth_access_token
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: integ.oauth_refresh_token,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  const tok = await res.json()
  const expiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString()
  await db.from(GCAL_TABLES.integrations).update({ oauth_access_token: tok.access_token, token_expires_at: expiresAt }).eq('id', integ.id)
  return tok.access_token
}

async function calApi(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${CAL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (res.status === 204) return {}
  const text = await res.text()
  if (!res.ok) throw new Error(`Calendar API ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

// --- Channel helpers --------------------------------------------------------

/** Active channels for the integration whose direction is in `directions`. */
async function activeChannels(db: any, integ: any, directions: ChannelDirection[]): Promise<any[]> {
  const { data } = await db.from(GCAL_TABLES.channels).select('*')
    .eq('integration_id', integ.id).eq('is_active', true).in('direction', directions)
  return data ?? []
}

/** Service ids attached to a booking (for service-targeted channel matching). */
async function bookingServiceIds(db: any, bookingId: string): Promise<string[]> {
  const { data } = await db.from('appointment_items').select('service_id').eq('booking_id', bookingId)
  return (data ?? []).map((r: any) => r.service_id).filter(Boolean)
}

/** Resolve the outbound destination calendar id for a booking (channel priority → integration default). */
async function resolveOutboundCalendarId(db: any, integ: any, booking: any): Promise<string> {
  if (!booking) return integ.calendar_id
  const rows = await activeChannels(db, integ, ['outbound', 'bidirectional'])
  if (rows.length) {
    const serviceIds = await bookingServiceIds(db, booking.id)
    const match = resolveTargetChannel(rows.map(channelRowToChannel), {
      assigneeId: booking.assignee_id,
      serviceIds,
      locationId: booking.location_id,
    })
    if (match) return match.googleCalendarId
  }
  return integ.calendar_id
}

/** List events for a calendar; incremental when syncToken given, else 30-day window. */
async function listEvents(token: string, calId: string, syncToken: string | null, timeMin?: string): Promise<any> {
  const params = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', maxResults: '250' })
  if (syncToken) params.set('syncToken', syncToken)
  else params.set('timeMin', timeMin ?? new Date(Date.now() - 30 * 86400_000).toISOString())
  return calApi(token, `/calendars/${encodeURIComponent(calId)}/events?${params.toString()}`)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const db = admin()

  try {
    // OAuth callback arrives as a GET redirect from Google.
    const url = new URL(req.url)
    if (req.method === 'GET' && url.searchParams.has('code')) {
      const code = url.searchParams.get('code')!
      const state = url.searchParams.get('state') ?? ''
      const [tenantId, redirectTo] = state.split('::')
      const tok = await exchangeCode(code)
      const expiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString()
      await db.from(GCAL_TABLES.integrations).upsert({
        tenant_id: tenantId,
        provider: 'google',
        oauth_refresh_token: tok.refresh_token,
        oauth_access_token: tok.access_token,
        token_expires_at: expiresAt,
        active: true,
      }, { onConflict: 'tenant_id,provider' })
      return new Response(null, { status: 302, headers: { ...corsHeaders, Location: redirectTo || '/' } })
    }

    const body = await req.json()
    const action = body.action as string

    if (action === 'oauth_start') {
      // state carries tenant + return URL so the GET callback can finish the link.
      const state = `${body.tenantId ?? ''}::${body.redirectTo ?? ''}`
      return json({ url: consentUrl(state) })
    }

    // Resolve the tenant's integration for the data actions. Scope by tenant
    // when provided; fall back to the single active google integration otherwise.
    const tenantId = body.tenantId as string | undefined
    let integQuery = db.from(GCAL_TABLES.integrations).select('*').eq('provider', 'google').eq('active', true)
    if (tenantId) integQuery = integQuery.eq('tenant_id', tenantId)
    const { data: integ } = await integQuery.maybeSingle()
    if (!integ) return json({ error: 'Not connected' }, 400)
    const token = await accessToken(db, integ)

    // ---- list_calendars: the user's Google calendarList (de-para picker) ----
    if (action === 'list_calendars') {
      const res = await calApi(token, '/users/me/calendarList?maxResults=250')
      const calendars = (res.items ?? []).map((c: any) => ({
        id: c.id,
        summary: c.summaryOverride ?? c.summary ?? c.id,
        backgroundColor: c.backgroundColor,
        primary: !!c.primary,
      }))
      return json({ calendars })
    }

    // ---- list_external_events: future unlinked events across active channels ----
    if (action === 'list_external_events') {
      const channels = await activeChannels(db, integ, ['inbound', 'bidirectional'])
      const filtered = body.channelId ? channels.filter((c) => c.id === body.channelId) : channels
      const timeMin = body.timeMin ?? new Date().toISOString()
      const previews: any[] = []
      for (const ch of filtered) {
        const params = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '100', timeMin })
        const res = await calApi(token, `/calendars/${encodeURIComponent(ch.google_calendar_id)}/events?${params.toString()}`)
        for (const ev of res.items ?? []) {
          if (ev.status === 'cancelled') continue
          const t = eventTimes(ev)
          previews.push({
            eventId: ev.id,
            etag: ev.etag,
            summary: ev.summary ?? '(no title)',
            startsAt: t.startsAt,
            endsAt: t.endsAt,
            allDay: t.allDay,
            calendarId: ch.google_calendar_id,
            channelId: ch.id,
            recurring: !!ev.recurringEventId,
          })
        }
      }
      // Drop events already linked to an appointment (single .in() query on the JSON path).
      const ids = previews.map((p) => p.eventId)
      const linked = new Set<string>()
      if (ids.length) {
        const { data: rows } = await db.from('appointments').select('metadata')
          .eq('tenant_id', integ.tenant_id)
          .in('metadata->>googleCalendarEventId', ids)
        for (const r of rows ?? []) {
          const id = (r.metadata ?? {}).googleCalendarEventId
          if (id) linked.add(id)
        }
      }
      return json({ events: previews.filter((p) => !linked.has(p.eventId)) })
    }

    // ---- import_events: refetch each selected event and import via RPC ----
    if (action === 'import_events') {
      const items = (body.items ?? []) as { channelId: string; eventId: string }[]
      const channels = await activeChannels(db, integ, ['inbound', 'bidirectional'])
      const chMap = new Map(channels.map((c) => [c.id, c]))
      let imported = 0
      let skipped = 0
      const errors: { eventId: string; error: string }[] = []
      for (const it of items) {
        const ch = chMap.get(it.channelId)
        if (!ch) { errors.push({ eventId: it.eventId, error: 'channel not found or inactive' }); continue }
        try {
          // Refetch from Google — it is the source of truth at import time.
          const ev = await calApi(token, `/calendars/${encodeURIComponent(ch.google_calendar_id)}/events/${encodeURIComponent(it.eventId)}`)
          if (ev.status === 'cancelled') { skipped++; continue }
          const t = eventTimes(ev)
          const { data: apptId, error } = await db.rpc('gcal_import_event', {
            p_tenant_id: integ.tenant_id,
            p_channel_id: ch.id,
            p_event_id: ev.id,
            p_etag: ev.etag ?? null,
            p_summary: ev.summary ?? '(no title)',
            p_starts_at: t.startsAt,
            p_ends_at: t.endsAt,
            p_all_day: t.allDay,
            p_description: ev.description ?? null,
          })
          if (error) { errors.push({ eventId: it.eventId, error: error.message }); continue }
          if (apptId) imported++
          else skipped++ // idempotent no-op (already imported)
        } catch (e) {
          errors.push({ eventId: it.eventId, error: String((e as any)?.message ?? e) })
        }
      }
      await logRun(db, integ.tenant_id, 'inbound', 'manual', {
        status: errors.length ? 'partial' : 'success',
        fetched: items.length,
        written: imported,
        error: errors.length ? errors.map((e) => `${e.eventId}: ${e.error}`).join('; ').slice(0, 500) : null,
      })
      return json({ imported, skipped, errors })
    }

    // ---- Outbound: booking change → Google event ----
    if (action === 'push_event') {
      // Skip echoes of inbound sync so we never bounce a Google-originated change back.
      if (body.origin === 'google') {
        await logRun(db, integ.tenant_id, 'outbound', body.op ?? 'on-write', { status: 'skipped' })
        return json({ ok: true, skipped: true })
      }
      const op = body.op as string // insert | update | delete
      const { data: booking } = await db.from('appointments').select('*').eq('id', body.bookingId).maybeSingle()
      const existingEventId = booking?.metadata?.googleCalendarEventId
      const calId = await resolveOutboundCalendarId(db, integ, booking)

      if (op === 'delete' || !booking) {
        if (existingEventId) {
          await calApi(token, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(existingEventId)}`, { method: 'DELETE' })
            .catch(() => {}) // already gone on Google → treat as deleted
        }
        await logRun(db, integ.tenant_id, 'outbound', op ?? 'delete', { fetched: 1, written: 1 })
        return json({ ok: true })
      }

      const event = appointmentRowToEvent(booking)
      let saved: any
      if (existingEventId) {
        saved = await calApi(token, `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(existingEventId)}`, { method: 'PATCH', body: JSON.stringify(event) })
      } else {
        saved = await calApi(token, `/calendars/${encodeURIComponent(calId)}/events`, { method: 'POST', body: JSON.stringify(event) })
        // Stamp the new event id back onto the appointment via the RPC — it sets
        // the transaction-local app.booking_origin='google' GUC so the outbound
        // trigger skips this bookkeeping write and we don't loop.
        await db.rpc('gcal_stamp_outbound', {
          p_tenant_id: booking.tenant_id,
          p_booking_id: booking.id,
          p_event_id: saved.id,
          p_etag: saved.etag ?? null,
          p_calendar_id: calId,
        })
      }
      await logRun(db, integ.tenant_id, 'outbound', 'on-write', { fetched: 1, written: 1 })
      return json({ ok: true, eventId: saved.id })
    }

    // ---- Inbound: Google changes → appointments (via RPC only) ----
    if (action === 'pull_events') {
      const channelRows = await activeChannels(db, integ, ['inbound', 'bidirectional'])
      // Per-channel syncToken when channels exist; legacy integration cursor otherwise.
      const targets = channelRows.length
        ? channelRows.map((c) => ({
            calId: c.google_calendar_id,
            token: c.sync_token as string | null,
            save: (t: string) => db.from(GCAL_TABLES.channels).update({ sync_token: t, updated_at: new Date().toISOString() }).eq('id', c.id),
          }))
        : [{
            calId: integ.calendar_id,
            token: integ.sync_token as string | null,
            save: (t: string) => db.from(GCAL_TABLES.integrations).update({ sync_token: t, last_sync_at: new Date().toISOString() }).eq('id', integ.id),
          }]

      let fetched = 0
      let written = 0
      let discovered = 0
      for (const tgt of targets) {
        let res: any
        try {
          res = await listEvents(token, tgt.calId, tgt.token)
        } catch (e) {
          // 410 GONE → the syncToken is stale; reset and do a full re-list.
          if (String((e as any)?.message ?? e).includes('410')) res = await listEvents(token, tgt.calId, null)
          else throw e
        }
        for (const ev of res.items ?? []) {
          fetched++
          const { data: rows } = await db.from('appointments').select('id, metadata')
            .eq('tenant_id', integ.tenant_id)
            .contains('metadata', { googleCalendarEventId: ev.id })
          const linked = (rows ?? [])[0]
          if (!linked) { discovered++; continue } // unlinked: wizard/import_events owns this, don't import silently
          const t = eventTimes(ev)
          const { data: patchedId } = await db.rpc('gcal_apply_event_patch', {
            p_tenant_id: integ.tenant_id,
            p_event_id: ev.id,
            p_etag: ev.etag ?? null,
            p_starts_at: t.startsAt,
            p_ends_at: t.endsAt,
            p_summary: ev.summary ?? null,
            p_cancelled: ev.status === 'cancelled',
          })
          if (patchedId) written++ // null return = etag echo suppression, no change
        }
        if (res.nextSyncToken) await tgt.save(res.nextSyncToken)
      }
      await logRun(db, integ.tenant_id, 'inbound', body.trigger ?? 'scheduled', { fetched, written, discovered })
      return json({ fetched, written, discovered })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err) {
    return json({ error: String((err as any)?.message ?? err) }, 500)
  }
})

// Best-effort audit write. `discovered` is optional (a newer column); if the
// column doesn't exist yet, retry without it so logging never breaks a run.
async function logRun(
  db: any,
  tenantId: string,
  direction: string,
  trigger: string,
  opts: { status?: string; fetched?: number; written?: number; discovered?: number; error?: string | null } = {},
) {
  const base = {
    tenant_id: tenantId,
    direction,
    trigger,
    status: opts.status ?? 'success',
    fetched: opts.fetched ?? 0,
    written: opts.written ?? 0,
    error: opts.error ?? null,
  }
  const row = opts.discovered != null ? { ...base, discovered: opts.discovered } : base
  const { error } = await db.from(GCAL_TABLES.syncLog).insert(row)
  if (error && opts.discovered != null) await db.from(GCAL_TABLES.syncLog).insert(base)
}
