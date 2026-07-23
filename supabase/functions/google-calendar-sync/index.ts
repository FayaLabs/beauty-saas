import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import {
  appointmentRowToEvent,
  channelRowToChannel,
  eventTimes,
  GCAL_TABLES,
  resolveTargetChannel,
} from '../_shared/google-calendar-mapping.js'
import {
  appendOAuthResult,
  constantTimeEqual,
  corsHeaders,
  createOAuthState,
  isAllowedOrigin,
  parseBearerToken,
  sanitizeRedirectTo,
  verifyOAuthState,
} from '../_shared/google-calendar-security.js'

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const SCOPE =
  'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly'

const USER_ACTIONS = new Set([
  'import_events',
  'list_calendars',
  'list_external_events',
  'pull_events',
  'watch_renew',
  'watch_start',
  'watch_stop',
])
const SERVICE_ACTIONS = new Set(['pull_events', 'push_event'])

const env = (name: string) => Deno.env.get(name) ?? ''
const requiredEnv = (name: string) => {
  const value = env(name)
  if (!value) throw new HttpError(500, `${name} is not configured`)
  return value
}
const configuredOrigins = () => [env('VITE_APP_URL'), env('GCAL_ALLOWED_ORIGINS')].filter(Boolean).join(',')

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function admin() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function responseHeaders(request: Request) {
  return corsHeaders(request.headers.get('origin'), configuredOrigins())
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders(request), 'Content-Type': 'application/json' },
  })
}

async function parseBody(request: Request): Promise<Record<string, any>> {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
    return body
  } catch {
    throw new HttpError(400, 'Invalid JSON body')
  }
}

async function isServiceRequest(request: Request) {
  const bearer = parseBearerToken(request.headers.get('authorization'))
  if (!bearer) return false
  return constantTimeEqual(bearer, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
}

async function requireTenantMember(db: any, userId: string, tenantId: string) {
  const { data, error } = await db
    .schema('saas_core')
    .from('tenant_members')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new HttpError(500, 'Unable to verify tenant membership')
  if (!data) throw new HttpError(403, 'User does not belong to this tenant')
}

async function requireUser(request: Request, db: any, tenantId: string) {
  const bearer = parseBearerToken(request.headers.get('authorization'))
  if (!bearer) throw new HttpError(401, 'Missing bearer token')
  const { data, error } = await db.auth.getUser(bearer)
  if (error || !data?.user) throw new HttpError(401, 'Invalid bearer token')
  await requireTenantMember(db, data.user.id, tenantId)
  return data.user
}

async function authorizeAction(request: Request, db: any, action: string, tenantId: string) {
  if (!tenantId) throw new HttpError(400, 'tenantId is required')
  if (SERVICE_ACTIONS.has(action) && (await isServiceRequest(request))) {
    return { kind: 'service' as const }
  }
  if (!USER_ACTIONS.has(action)) throw new HttpError(400, `Unknown action: ${action}`)
  const user = await requireUser(request, db, tenantId)
  return { kind: 'user' as const, user }
}

function consentUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: requiredEnv('GCAL_REDIRECT_URI'),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH}?${params.toString()}`
}

async function exchangeCode(code: string) {
  const response = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: requiredEnv('GCAL_REDIRECT_URI'),
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) throw new HttpError(502, 'Google rejected the authorization code')
  return response.json()
}

async function accessToken(db: any, integration: any) {
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0
  if (integration.oauth_access_token && expiresAt > Date.now() + 60_000) {
    return integration.oauth_access_token
  }
  if (!integration.oauth_refresh_token) throw new HttpError(409, 'Google Calendar is not connected')

  const response = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: integration.oauth_refresh_token,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) throw new HttpError(502, 'Unable to refresh the Google access token')

  const token = await response.json()
  const tokenExpiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1_000).toISOString()
  const { error } = await db
    .from(GCAL_TABLES.integrations)
    .update({ oauth_access_token: token.access_token, token_expires_at: tokenExpiresAt })
    .eq('id', integration.id)
    .eq('tenant_id', integration.tenant_id)
  if (error) throw new HttpError(500, 'Unable to persist the refreshed Google token')
  return token.access_token
}

async function calendarApi(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (response.status === 204) return {}
  const text = await response.text()
  if (!response.ok) throw new HttpError(502, `Google Calendar returned HTTP ${response.status}`)
  return text ? JSON.parse(text) : {}
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function stopWatch(token: string, channel: any) {
  if (!channel.channel_id || !channel.resource_id) return
  await calendarApi(token, '/channels/stop', {
    method: 'POST',
    body: JSON.stringify({ id: channel.channel_id, resourceId: channel.resource_id }),
  })
}

async function startWatch(db: any, token: string, channel: any) {
  const address = requiredEnv('GCAL_WEBHOOK_URI')
  if (!address.startsWith('https://')) throw new HttpError(500, 'GCAL_WEBHOOK_URI must use HTTPS')

  const googleChannelId = crypto.randomUUID()
  const webhookToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '')
  const watch = await calendarApi(
    token,
    `/calendars/${encodeURIComponent(channel.google_calendar_id)}/events/watch`,
    {
      method: 'POST',
      body: JSON.stringify({
        id: googleChannelId,
        type: 'web_hook',
        address,
        token: webhookToken,
      }),
    },
  )
  const expiresAt = watch.expiration ? new Date(Number(watch.expiration)).toISOString() : null
  const { error } = await db
    .from(GCAL_TABLES.channels)
    .update({
      channel_id: watch.id ?? googleChannelId,
      resource_id: watch.resourceId ?? null,
      channel_expires_at: expiresAt,
      webhook_token_hash: await sha256(webhookToken),
      last_webhook_message_number: null,
      last_webhook_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', channel.id)
    .eq('tenant_id', channel.tenant_id)
  if (error) throw new HttpError(500, 'Unable to persist the Google watch channel')
  return {
    channelRef: channel.id,
    googleChannelId: watch.id ?? googleChannelId,
    resourceId: watch.resourceId ?? null,
    expiresAt,
  }
}

async function activeChannels(db: any, integration: any, directions: string[]) {
  const { data, error } = await db
    .from(GCAL_TABLES.channels)
    .select('*')
    .eq('integration_id', integration.id)
    .eq('tenant_id', integration.tenant_id)
    .eq('is_active', true)
    .in('direction', directions)
  if (error) throw new HttpError(500, 'Unable to load calendar channels')
  return data ?? []
}

async function bookingServiceIds(db: any, bookingId: string) {
  const { data } = await db.from('appointment_items').select('service_id').eq('booking_id', bookingId)
  return (data ?? []).map((row: any) => row.service_id).filter(Boolean)
}

async function resolveOutboundCalendarId(db: any, integration: any, booking: any) {
  if (!booking) return integration.calendar_id
  const rows = await activeChannels(db, integration, ['outbound', 'bidirectional'])
  if (rows.length) {
    const serviceIds = await bookingServiceIds(db, booking.id)
    const match = resolveTargetChannel(rows.map(channelRowToChannel), {
      assigneeId: booking.assignee_id,
      serviceIds,
      locationId: booking.location_id,
    })
    if (match) return match.googleCalendarId
  }
  return integration.calendar_id
}

async function listEvents(token: string, calendarId: string, syncToken: string | null, timeMin?: string) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    showDeleted: 'true',
    maxResults: '250',
  })
  if (syncToken) params.set('syncToken', syncToken)
  else params.set('timeMin', timeMin ?? new Date(Date.now() - 30 * 86_400_000).toISOString())
  return calendarApi(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  )
}

async function loadIntegration(db: any, tenantId: string) {
  const { data, error } = await db
    .from(GCAL_TABLES.integrations)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google')
    .eq('active', true)
    .maybeSingle()
  if (error) throw new HttpError(500, 'Unable to load the Google Calendar integration')
  if (!data) throw new HttpError(409, 'Google Calendar is not connected')
  return data
}

async function handleOAuthCallback(request: Request, db: any, url: URL) {
  const state = await verifyOAuthState(
    url.searchParams.get('state'),
    requiredEnv('GOOGLE_CLIENT_SECRET'),
  )
  const redirectTo = sanitizeRedirectTo(state.redirectTo, configuredOrigins())
  await requireTenantMember(db, state.userId, state.tenantId)

  const googleError = url.searchParams.get('error')
  if (googleError) {
    return Response.redirect(appendOAuthResult(redirectTo, 'error', googleError), 302)
  }

  const code = url.searchParams.get('code')
  if (!code) throw new HttpError(400, 'Missing Google authorization code')
  const token = await exchangeCode(code)
  const tokenExpiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1_000).toISOString()

  const { data: existing } = await db
    .from(GCAL_TABLES.integrations)
    .select('oauth_refresh_token')
    .eq('tenant_id', state.tenantId)
    .eq('provider', 'google')
    .maybeSingle()
  const refreshToken = token.refresh_token ?? existing?.oauth_refresh_token
  if (!refreshToken) throw new HttpError(502, 'Google did not return a refresh token')

  const { error } = await db.from(GCAL_TABLES.integrations).upsert(
    {
      tenant_id: state.tenantId,
      provider: 'google',
      oauth_refresh_token: refreshToken,
      oauth_access_token: token.access_token,
      token_expires_at: tokenExpiresAt,
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,provider' },
  )
  if (error) throw new HttpError(500, 'Unable to save the Google Calendar connection')
  return Response.redirect(appendOAuthResult(redirectTo, 'connected'), 302)
}

async function handleWatchAction(
  request: Request,
  db: any,
  body: Record<string, any>,
  integration: any,
  token: string,
) {
  const channelRef = String(body.channelRef ?? '')
  if (!channelRef) return json(request, { error: 'channelRef is required' }, 400)
  const { data: channel, error } = await db
    .from(GCAL_TABLES.channels)
    .select('*')
    .eq('id', channelRef)
    .eq('tenant_id', integration.tenant_id)
    .maybeSingle()
  if (error) throw new HttpError(500, 'Unable to load the calendar channel')
  if (!channel) return json(request, { error: 'Calendar channel not found' }, 404)

  if (
    body.action === 'watch_start' &&
    channel.channel_id &&
    channel.channel_expires_at &&
    new Date(channel.channel_expires_at).getTime() > Date.now() + 5 * 60_000
  ) {
    return json(request, {
      channelRef: channel.id,
      googleChannelId: channel.channel_id,
      resourceId: channel.resource_id,
      expiresAt: channel.channel_expires_at,
      reused: true,
    })
  }

  if (body.action === 'watch_stop' || body.action === 'watch_renew') {
    try {
      await stopWatch(token, channel)
    } catch (error) {
      if (body.action === 'watch_stop') throw error
    }
    const { error: clearError } = await db
      .from(GCAL_TABLES.channels)
      .update({
        channel_id: null,
        resource_id: null,
        channel_expires_at: null,
        webhook_token_hash: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel.id)
      .eq('tenant_id', integration.tenant_id)
    if (clearError) throw new HttpError(500, 'Unable to clear the Google watch channel')
  }

  if (body.action === 'watch_stop') return json(request, { stopped: true, channelRef })
  return json(request, await startWatch(db, token, channel))
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin')
  if (origin && !isAllowedOrigin(origin, configuredOrigins())) {
    return json(request, { error: 'Origin is not allowed' }, 403)
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(request) })
  }

  const db = admin()
  try {
    const url = new URL(request.url)
    if (request.method === 'GET') {
      return await handleOAuthCallback(request, db, url)
    }
    if (request.method !== 'POST') {
      return json(request, { error: 'Method not allowed' }, 405)
    }

    const body = await parseBody(request)
    const action = String(body.action ?? '')
    const tenantId = String(body.tenantId ?? '')

    if (action === 'oauth_start') {
      if (!tenantId) throw new HttpError(400, 'tenantId is required')
      const user = await requireUser(request, db, tenantId)
      const redirectTo = sanitizeRedirectTo(body.redirectTo, configuredOrigins())
      const state = await createOAuthState(
        { tenantId, userId: user.id, redirectTo },
        requiredEnv('GOOGLE_CLIENT_SECRET'),
      )
      return json(request, { url: consentUrl(state) })
    }

    await authorizeAction(request, db, action, tenantId)
    const integration = await loadIntegration(db, tenantId)
    const token = await accessToken(db, integration)

    if (action.startsWith('watch_')) {
      return handleWatchAction(request, db, body, integration, token)
    }

    if (action === 'list_calendars') {
      const result = await calendarApi(token, '/users/me/calendarList?maxResults=250')
      const calendars = (result.items ?? []).map((calendar: any) => ({
        id: calendar.id,
        summary: calendar.summaryOverride ?? calendar.summary ?? calendar.id,
        backgroundColor: calendar.backgroundColor,
        primary: Boolean(calendar.primary),
      }))
      return json(request, { calendars })
    }

    if (action === 'list_external_events') {
      const channels = await activeChannels(db, integration, ['inbound', 'bidirectional'])
      const filtered = body.channelId
        ? channels.filter((channel: any) => channel.id === body.channelId)
        : channels
      const timeMin = body.timeMin ?? new Date().toISOString()
      const previews: any[] = []
      for (const channel of filtered) {
        const params = new URLSearchParams({
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '100',
          timeMin,
        })
        const result = await calendarApi(
          token,
          `/calendars/${encodeURIComponent(channel.google_calendar_id)}/events?${params.toString()}`,
        )
        for (const event of result.items ?? []) {
          if (event.status === 'cancelled') continue
          const times = eventTimes(event)
          previews.push({
            eventId: event.id,
            etag: event.etag,
            summary: event.summary ?? '(no title)',
            startsAt: times.startsAt,
            endsAt: times.endsAt,
            allDay: times.allDay,
            calendarId: channel.google_calendar_id,
            channelId: channel.id,
            recurring: Boolean(event.recurringEventId),
          })
        }
      }
      const ids = previews.map((preview) => preview.eventId)
      const linked = new Set<string>()
      if (ids.length) {
        const { data: rows } = await db
          .from('appointments')
          .select('metadata')
          .eq('tenant_id', tenantId)
          .in('metadata->>googleCalendarEventId', ids)
        for (const row of rows ?? []) {
          const id = row.metadata?.googleCalendarEventId
          if (id) linked.add(id)
        }
      }
      return json(request, { events: previews.filter((preview) => !linked.has(preview.eventId)) })
    }

    if (action === 'import_events') {
      const items = Array.isArray(body.items) ? body.items.slice(0, 100) : []
      const channels = await activeChannels(db, integration, ['inbound', 'bidirectional'])
      const channelsById = new Map(channels.map((channel: any) => [channel.id, channel]))
      let imported = 0
      let skipped = 0
      const errors: { eventId: string; error: string }[] = []
      for (const item of items) {
        const channel: any = channelsById.get(item.channelId)
        if (!channel) {
          errors.push({ eventId: item.eventId, error: 'channel not found or inactive' })
          continue
        }
        try {
          const event = await calendarApi(
            token,
            `/calendars/${encodeURIComponent(channel.google_calendar_id)}/events/${encodeURIComponent(item.eventId)}`,
          )
          if (event.status === 'cancelled') {
            skipped += 1
            continue
          }
          const times = eventTimes(event)
          const { data: appointmentId, error } = await db.rpc('gcal_import_event', {
            p_tenant_id: tenantId,
            p_channel_id: channel.id,
            p_event_id: event.id,
            p_etag: event.etag ?? null,
            p_summary: event.summary ?? '(no title)',
            p_starts_at: times.startsAt,
            p_ends_at: times.endsAt,
            p_all_day: times.allDay,
            p_description: event.description ?? null,
          })
          if (error) {
            errors.push({ eventId: item.eventId, error: error.message })
          } else if (appointmentId) {
            imported += 1
          } else {
            skipped += 1
          }
        } catch (error) {
          errors.push({ eventId: item.eventId, error: String((error as Error)?.message ?? error) })
        }
      }
      await logRun(db, tenantId, 'inbound', 'manual', {
        status: errors.length ? 'partial' : 'success',
        fetched: items.length,
        written: imported,
        error: errors.length
          ? errors.map((item) => `${item.eventId}: ${item.error}`).join('; ').slice(0, 500)
          : null,
      })
      return json(request, { imported, skipped, errors })
    }

    if (action === 'push_event') {
      if (body.origin === 'google') {
        await logRun(db, tenantId, 'outbound', body.op ?? 'on-write', { status: 'skipped' })
        return json(request, { ok: true, skipped: true })
      }
      const operation = String(body.op ?? '')
      const { data: booking } = await db
        .from('appointments')
        .select('*')
        .eq('id', body.bookingId)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      const existingEventId = booking?.metadata?.googleCalendarEventId ?? body.googleEventId
      const calendarId =
        body.calendarId ?? (await resolveOutboundCalendarId(db, integration, booking))

      if (operation === 'delete' || !booking) {
        if (existingEventId) {
          await calendarApi(
            token,
            `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEventId)}`,
            { method: 'DELETE' },
          ).catch(() => undefined)
        }
        await logRun(db, tenantId, 'outbound', operation || 'delete', {
          fetched: 1,
          written: 1,
        })
        return json(request, { ok: true })
      }

      const event = appointmentRowToEvent(booking)
      const saved = existingEventId
        ? await calendarApi(
            token,
            `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEventId)}`,
            { method: 'PATCH', body: JSON.stringify(event) },
          )
        : await calendarApi(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: 'POST',
            body: JSON.stringify(event),
          })

      if (!existingEventId) {
        const { error } = await db.rpc('gcal_stamp_outbound', {
          p_tenant_id: tenantId,
          p_booking_id: booking.id,
          p_event_id: saved.id,
          p_etag: saved.etag ?? null,
          p_calendar_id: calendarId,
        })
        if (error) throw new HttpError(500, 'Unable to link the Google event to the appointment')
      }
      await logRun(db, tenantId, 'outbound', 'on-write', { fetched: 1, written: 1 })
      return json(request, { ok: true, eventId: saved.id })
    }

    if (action === 'pull_events') {
      const requestedChannelRef = body.channelRef ? String(body.channelRef) : null
      const allChannels = await activeChannels(db, integration, ['inbound', 'bidirectional'])
      const channels = requestedChannelRef
        ? allChannels.filter((channel: any) => channel.id === requestedChannelRef)
        : allChannels
      if (requestedChannelRef && channels.length === 0) {
        return json(request, { error: 'Active inbound calendar channel not found' }, 404)
      }
      const targets = channels.length
        ? channels.map((channel: any) => ({
            calendarId: channel.google_calendar_id,
            syncToken: channel.sync_token,
            save: (nextToken: string) =>
              db
                .from(GCAL_TABLES.channels)
                .update({ sync_token: nextToken, updated_at: new Date().toISOString() })
                .eq('id', channel.id)
                .eq('tenant_id', tenantId),
          }))
        : [
            {
              calendarId: integration.calendar_id,
              syncToken: integration.sync_token,
              save: (nextToken: string) =>
                db
                  .from(GCAL_TABLES.integrations)
                  .update({ sync_token: nextToken, last_sync_at: new Date().toISOString() })
                  .eq('id', integration.id)
                  .eq('tenant_id', tenantId),
            },
          ]

      let fetched = 0
      let written = 0
      let discovered = 0
      for (const target of targets) {
        let result
        try {
          result = await listEvents(token, target.calendarId, target.syncToken)
        } catch (error) {
          if (String((error as Error)?.message ?? error).includes('410')) {
            result = await listEvents(token, target.calendarId, null)
          } else {
            throw error
          }
        }
        for (const event of result.items ?? []) {
          fetched += 1
          const { data: linkedRows } = await db
            .from('appointments')
            .select('id,metadata')
            .eq('tenant_id', tenantId)
            .contains('metadata', { googleCalendarEventId: event.id })
          const linked = linkedRows?.[0]
          if (!linked) {
            discovered += 1
            continue
          }
          const times = eventTimes(event)
          const { data: appointmentId, error } = await db.rpc('gcal_apply_event_patch', {
            p_tenant_id: tenantId,
            p_event_id: event.id,
            p_etag: event.etag ?? null,
            p_starts_at: times.startsAt,
            p_ends_at: times.endsAt,
            p_summary: event.summary ?? null,
            p_cancelled: event.status === 'cancelled',
          })
          if (error) throw new HttpError(500, 'Unable to apply the Google Calendar update')
          if (!appointmentId) continue
          written += 1
          const eventType =
            event.status === 'cancelled'
              ? 'calendar.appointment.cancelled'
              : 'calendar.appointment.updated'
          await db.from(GCAL_TABLES.automationOutbox).upsert(
            {
              tenant_id: tenantId,
              event_type: eventType,
              aggregate_type: 'appointment',
              aggregate_id: appointmentId,
              idempotency_key: `google:${target.calendarId}:${event.id}:${event.etag ?? event.status ?? 'changed'}`,
              payload: {
                appointmentId,
                googleCalendarId: target.calendarId,
                googleEventId: event.id,
                googleEtag: event.etag ?? null,
                status: event.status ?? 'confirmed',
              },
            },
            { onConflict: 'tenant_id,idempotency_key', ignoreDuplicates: true },
          )
        }
        if (result.nextSyncToken) await target.save(result.nextSyncToken)
      }
      await logRun(db, tenantId, 'inbound', body.trigger ?? 'scheduled', {
        fetched,
        written,
        discovered,
      })
      return json(request, { fetched, written, discovered })
    }

    throw new HttpError(400, `Unknown action: ${action}`)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json(request, { error: message }, status)
  }
})

async function logRun(
  db: any,
  tenantId: string,
  direction: string,
  trigger: string,
  options: {
    status?: string
    fetched?: number
    written?: number
    discovered?: number
    error?: string | null
  } = {},
) {
  const base = {
    tenant_id: tenantId,
    direction,
    trigger,
    status: options.status ?? 'success',
    fetched: options.fetched ?? 0,
    written: options.written ?? 0,
    error: options.error ?? null,
  }
  const row =
    options.discovered == null ? base : { ...base, discovered: options.discovered }
  const { error } = await db.from(GCAL_TABLES.syncLog).insert(row)
  if (error && options.discovered != null) {
    await db.from(GCAL_TABLES.syncLog).insert(base)
  }
}
