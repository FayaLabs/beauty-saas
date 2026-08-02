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
import {
  fetchWithRetry,
  GoogleCalendarHttpError,
  listAllEventChanges,
  processInboundEvents,
  runPushEvent,
  shouldRenewWatch,
} from '../_shared/google-calendar-runtime.js'

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const SCOPE =
  'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly'

const USER_ACTIONS = new Set([
  'disconnect',
  'import_events',
  'list_calendars',
  'list_external_events',
  'pull_events',
  'watch_renew',
  'watch_start',
  'watch_stop',
])
const SERVICE_ACTIONS = new Set(['pull_events', 'push_event', 'renew_watches'])

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

function logEvent(level: 'info' | 'warn' | 'error', event: string, context: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ event, ...context, at: new Date().toISOString() }))
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
  const outboundSecret = env('GCAL_OUTBOUND_SECRET')
  if (outboundSecret && constantTimeEqual(bearer, outboundSecret)) return true
  return constantTimeEqual(bearer, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'))
}

async function requireTenantMember(db: any, userId: string, tenantId: string) {
  const current = await db
    .from('tenant_members')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!current.error) {
    if (!current.data) throw new HttpError(403, 'User does not belong to this tenant')
    return
  }

  // Legacy pools kept the membership overlay under saas_core. Core-v1 pools
  // moved it to public, so only fall back when the current table is unavailable.
  const legacy = await db
    .schema('saas_core')
    .from('tenant_members')
    .select('tenant_id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  if (legacy.error) throw new HttpError(500, 'Unable to verify tenant membership')
  if (!legacy.data) throw new HttpError(403, 'User does not belong to this tenant')
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
  const response = await fetchWithRetry(fetch, GOOGLE_TOKEN, {
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

  const response = await fetchWithRetry(fetch, GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: integration.oauth_refresh_token,
      client_id: requiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    let failure: any = null
    try { failure = await response.json() } catch { /* gateway may not return JSON */ }
    if (failure?.error === 'invalid_grant') {
      await db
        .from(GCAL_TABLES.integrations)
        .update({
          active: false,
          oauth_access_token: null,
          oauth_refresh_token: null,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id)
        .eq('tenant_id', integration.tenant_id)
      throw new HttpError(409, 'Google authorization expired or was revoked. Reconnect Google Calendar.')
    }
    throw new HttpError(502, 'Unable to refresh the Google access token')
  }

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
  const response = await fetchWithRetry(
    fetch,
    `${CALENDAR_API}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    },
    {
      maxAttempts: 4,
      onRetry: ({ attempt, delayMs, status }: any) =>
        logEvent('warn', 'gcal.google.retry', { attempt, delayMs, status, path }),
    },
  )
  if (response.status === 204) return {}
  const text = await response.text()
  let details: any = null
  if (text) {
    try { details = JSON.parse(text) } catch { details = text.slice(0, 500) }
  }
  if (!response.ok) {
    const googleMessage = details?.error?.message
    throw new GoogleCalendarHttpError(
      response.status,
      googleMessage
        ? `Google Calendar returned HTTP ${response.status}: ${googleMessage}`
        : `Google Calendar returned HTTP ${response.status}`,
      { details },
    )
  }
  return details ?? {}
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

async function clearWatch(db: any, channel: any) {
  const { error } = await db
    .from(GCAL_TABLES.channels)
    .update({
      channel_id: null,
      resource_id: null,
      channel_expires_at: null,
      webhook_token_hash: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', channel.id)
    .eq('tenant_id', channel.tenant_id)
  if (error) throw new HttpError(500, 'Unable to clear the Google watch channel')
}

async function renewWatch(db: any, token: string, channel: any) {
  // Start the replacement first so a transient failure never leaves a gap in
  // Google notifications. Once persisted, stop the captured previous channel.
  const next = await startWatch(db, token, channel)
  if (channel.channel_id && channel.resource_id) {
    try {
      await stopWatch(token, channel)
    } catch (error) {
      logEvent('warn', 'gcal.watch.previous_stop_failed', {
        channelRef: channel.id,
        googleChannelId: channel.channel_id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return next
}

async function renewExpiringWatches(db: any, token: string, integration: any) {
  const channels = await activeChannels(db, integration, ['inbound', 'bidirectional'])
  const result = { checked: channels.length, renewed: 0, reused: 0, errors: [] as any[] }
  for (const channel of channels) {
    if (!shouldRenewWatch(channel.channel_expires_at)) {
      result.reused += 1
      continue
    }
    try {
      if (channel.channel_id && channel.resource_id) await renewWatch(db, token, channel)
      else await startWatch(db, token, channel)
      result.renewed += 1
    } catch (error) {
      result.errors.push({
        channelRef: channel.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return result
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

async function listEvents(
  token: string,
  calendarId: string,
  syncToken: string | null,
  timeMin?: string,
  pageToken?: string | null,
) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    showDeleted: 'true',
    maxResults: '250',
  })
  if (syncToken) params.set('syncToken', syncToken)
  else params.set('timeMin', timeMin ?? new Date(Date.now() - 30 * 86_400_000).toISOString())
  if (pageToken) params.set('pageToken', pageToken)
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
    !shouldRenewWatch(channel.channel_expires_at, { leadMs: 5 * 60_000 })
  ) {
    return json(request, {
      channelRef: channel.id,
      googleChannelId: channel.channel_id,
      resourceId: channel.resource_id,
      expiresAt: channel.channel_expires_at,
      reused: true,
    })
  }

  if (body.action === 'watch_stop') {
    try {
      await stopWatch(token, channel)
    } catch (error) {
      if (!(error instanceof GoogleCalendarHttpError) || error.status !== 404) throw error
    }
    await clearWatch(db, channel)
    return json(request, { stopped: true, channelRef })
  }

  const watch = channel.channel_id && channel.resource_id
    ? await renewWatch(db, token, channel)
    : await startWatch(db, token, channel)
  return json(request, watch)
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
  let action = ''
  let tenantId = ''
  let correlationId = crypto.randomUUID()
  try {
    const url = new URL(request.url)
    if (request.method === 'GET') {
      return await handleOAuthCallback(request, db, url)
    }
    if (request.method !== 'POST') {
      return json(request, { error: 'Method not allowed' }, 405)
    }

    const body = await parseBody(request)
    action = String(body.action ?? '')
    tenantId = String(body.tenantId ?? '')
    const requestedCorrelationId = String(body.correlationId ?? '')
    correlationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(requestedCorrelationId)
      ? requestedCorrelationId
      : crypto.randomUUID()
    body.correlationId = correlationId

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

    if (action === 'disconnect') {
      let disconnectToken: string | null = null
      try {
        disconnectToken = await accessToken(db, integration)
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 409) throw error
      }
      const { data: channels, error: channelsError } = await db
        .from(GCAL_TABLES.channels)
        .select('*')
        .eq('integration_id', integration.id)
        .eq('tenant_id', tenantId)
      if (channelsError) throw new HttpError(500, 'Unable to load calendar channels for disconnect')
      if (disconnectToken) {
        for (const channel of channels ?? []) {
          try { await stopWatch(disconnectToken, channel) } catch { /* Watches also expire at Google. */ }
        }
      }
      const { error: clearChannelsError } = await db
        .from(GCAL_TABLES.channels)
        .update({
          channel_id: null,
          resource_id: null,
          channel_expires_at: null,
          webhook_token_hash: null,
          sync_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq('integration_id', integration.id)
        .eq('tenant_id', tenantId)
      if (clearChannelsError) throw new HttpError(500, 'Unable to clear Google Calendar channels')
      const { error: disconnectError } = await db
        .from(GCAL_TABLES.integrations)
        .update({
          active: false,
          oauth_access_token: null,
          oauth_refresh_token: null,
          token_expires_at: null,
          sync_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id)
        .eq('tenant_id', tenantId)
      if (disconnectError) throw new HttpError(500, 'Unable to disconnect Google Calendar')
      await logRun(db, tenantId, 'inbound', 'disconnect', { correlationId })
      logEvent('info', 'gcal.disconnect.completed', { tenantId, correlationId })
      return json(request, { disconnected: true })
    }

    const token = await accessToken(db, integration)

    if (action === 'renew_watches') {
      const watchResult = await renewExpiringWatches(db, token, integration)
      await logRun(db, tenantId, 'inbound', 'watch-renewal', {
        status: watchResult.errors.length ? 'partial' : 'success',
        fetched: watchResult.checked,
        written: watchResult.renewed,
        error: watchResult.errors.length ? JSON.stringify(watchResult.errors).slice(0, 500) : null,
        correlationId: body.correlationId,
      })
      logEvent(watchResult.errors.length ? 'warn' : 'info', 'gcal.watch.maintenance', {
        tenantId,
        ...watchResult,
      })
      return json(request, watchResult, watchResult.errors.length ? 207 : 200)
    }

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
        timeZone: calendar.timeZone ?? null,
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
        await logRun(db, tenantId, 'outbound', body.op ?? 'on-write', {
          status: 'skipped',
          correlationId: body.correlationId,
        })
        return json(request, { ok: true, skipped: true })
      }
      const operation = String(body.op ?? '')
      const { data: booking, error: bookingError } = await db
        .from('appointments')
        .select('*')
        .eq('id', body.bookingId)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (bookingError) throw new HttpError(500, 'Unable to load the appointment for Google sync')
      const existingEventId = booking?.metadata?.googleCalendarEventId ?? body.googleEventId
      const calendarId =
        body.calendarId ?? (await resolveOutboundCalendarId(db, integration, booking))

      const pushed = await runPushEvent({
        operation,
        booking,
        existingEventId,
        toEvent: appointmentRowToEvent,
        createEvent: (event: any) =>
          calendarApi(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
            method: 'POST',
            body: JSON.stringify(event),
          }),
        updateEvent: (eventId: string, event: any) =>
          calendarApi(
            token,
            `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
            { method: 'PATCH', body: JSON.stringify(event) },
          ),
        deleteEvent: (eventId: string) =>
          calendarApi(
            token,
            `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
            { method: 'DELETE' },
          ),
        stampEvent: async (saved: any) => {
          const { error } = await db.rpc('gcal_stamp_outbound', {
            p_tenant_id: tenantId,
            p_booking_id: booking.id,
            p_event_id: saved.id,
            p_etag: saved.etag ?? null,
            p_calendar_id: calendarId,
          })
          if (error) throw new HttpError(500, 'Unable to link the Google event to the appointment')
        },
      })

      await logRun(db, tenantId, 'outbound', pushed.mode === 'delete' ? 'delete' : 'on-write', {
        fetched: 1,
        written: pushed.written,
        correlationId: body.correlationId,
      })
      logEvent('info', 'gcal.push.completed', {
        tenantId,
        bookingId: body.bookingId,
        correlationId: body.correlationId ?? null,
        mode: pushed.mode,
        written: pushed.written,
      })
      return json(request, { ok: true, mode: pushed.mode, eventId: pushed.eventId })
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
            channelRef: channel.id,
            calendarId: channel.google_calendar_id,
            syncToken: channel.sync_token,
            autoImportNewEvents: Boolean(channel.sync_token),
            save: (nextToken: string) =>
              db
                .from(GCAL_TABLES.channels)
                .update({ sync_token: nextToken, updated_at: new Date().toISOString() })
                .eq('id', channel.id)
                .eq('tenant_id', tenantId),
          }))
        : [
            {
              channelRef: null,
              calendarId: integration.calendar_id,
              syncToken: integration.sync_token,
              autoImportNewEvents: false,
              save: (nextToken: string) =>
                db
                  .from(GCAL_TABLES.integrations)
                  .update({ sync_token: nextToken, updated_at: new Date().toISOString() })
                  .eq('id', integration.id)
                  .eq('tenant_id', tenantId),
            },
          ]

      let fetched = 0
      let written = 0
      let discovered = 0
      for (const target of targets) {
        const result = await listAllEventChanges({
          syncToken: target.syncToken,
          timeMin: body.timeMin,
          fetchPage: ({ syncToken, timeMin, pageToken }: any) =>
            listEvents(token, target.calendarId, syncToken, timeMin, pageToken),
          onCursorReset: () =>
            logEvent('warn', 'gcal.sync.cursor_reset', {
              tenantId,
              channelRef: target.channelRef,
              calendarId: target.calendarId,
            }),
        })

        const outcome = await processInboundEvents({
          events: result.items,
          autoImportNewEvents: target.autoImportNewEvents && !result.cursorReset,
          channelRef: target.channelRef,
          findLinked: async (event: any) => {
            const { data, error } = await db
              .from('appointments')
              .select('id,metadata')
              .eq('tenant_id', tenantId)
              .contains('metadata', { googleCalendarEventId: event.id })
              .limit(1)
            if (error) throw new HttpError(500, 'Unable to find the linked appointment')
            return data?.[0] ?? null
          },
          importUnlinked: async (event: any) => {
            const times = eventTimes(event)
            const { data: appointmentId, error } = await db.rpc('gcal_import_event', {
              p_tenant_id: tenantId,
              p_channel_id: target.channelRef,
              p_event_id: event.id,
              p_etag: event.etag ?? null,
              p_summary: event.summary ?? '(no title)',
              p_starts_at: times.startsAt || null,
              p_ends_at: times.endsAt || null,
              p_all_day: times.allDay,
              p_description: event.description ?? null,
            })
            if (error) throw new HttpError(500, 'Unable to import the new Google Calendar event')
            if (!appointmentId) return null
            const { error: outboxError } = await db.from(GCAL_TABLES.automationOutbox).upsert(
              {
                tenant_id: tenantId,
                event_type: 'calendar.appointment.created',
                aggregate_type: 'appointment',
                aggregate_id: appointmentId,
                idempotency_key: `google:${target.calendarId}:${event.id}:created`,
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
            if (outboxError) throw new HttpError(500, 'Unable to enqueue the imported appointment event')
            return appointmentId
          },
          applyLinked: async (event: any) => {
            const times = eventTimes(event)
            const { data: appointmentId, error } = await db.rpc('gcal_apply_event_patch', {
              p_tenant_id: tenantId,
              p_event_id: event.id,
              p_etag: event.etag ?? null,
              p_starts_at: times.startsAt || null,
              p_ends_at: times.endsAt || null,
              p_summary: event.summary ?? null,
              p_cancelled: event.status === 'cancelled',
            })
            if (error) throw new HttpError(500, 'Unable to apply the Google Calendar update')
            if (!appointmentId) return null
            const eventType =
              event.status === 'cancelled'
                ? 'calendar.appointment.cancelled'
                : 'calendar.appointment.updated'
            const { error: outboxError } = await db.from(GCAL_TABLES.automationOutbox).upsert(
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
            if (outboxError) throw new HttpError(500, 'Unable to enqueue the appointment update')
            return appointmentId
          },
        })

        fetched += outcome.fetched
        written += outcome.written
        discovered += outcome.discovered
        if (result.nextSyncToken) {
          const saved = await target.save(result.nextSyncToken)
          if (saved?.error) throw new HttpError(500, 'Unable to persist the Google sync cursor')
        }
      }

      const completedAt = new Date().toISOString()
      const { error: healthError } = await db
        .from(GCAL_TABLES.integrations)
        .update({ last_sync_at: completedAt, updated_at: completedAt })
        .eq('id', integration.id)
        .eq('tenant_id', tenantId)
      if (healthError) throw new HttpError(500, 'Unable to persist Google Calendar sync health')

      await logRun(db, tenantId, 'inbound', body.trigger ?? 'scheduled', {
        fetched,
        written,
        discovered,
        correlationId: body.correlationId,
        channelIdRef: requestedChannelRef,
      })
      logEvent('info', 'gcal.pull.completed', {
        tenantId,
        correlationId: body.correlationId ?? null,
        channelRef: requestedChannelRef,
        fetched,
        written,
        discovered,
      })
      return json(request, { fetched, written, discovered })
    }

    throw new HttpError(400, `Unknown action: ${action}`)
  } catch (error) {
    const status = error instanceof HttpError
      ? error.status
      : error instanceof GoogleCalendarHttpError
        ? error.status === 401 || error.status === 403 ? 409 : 502
        : 500
    const message = error instanceof Error ? error.message : 'Unexpected error'
    logEvent('error', 'gcal.request.failed', {
      action: action || null,
      tenantId: tenantId || null,
      correlationId,
      status,
      error: message,
    })
    if (tenantId && ['pull_events', 'push_event', 'renew_watches'].includes(action)) {
      const direction = action === 'push_event' ? 'outbound' : 'inbound'
      await logRun(db, tenantId, direction, action, {
        status: 'error',
        error: message.slice(0, 500),
        correlationId,
      }).catch(() => undefined)
    }
    return json(request, { error: message, correlationId }, status)
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
    correlationId?: string | null
    channelIdRef?: string | null
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
  const row = {
    ...base,
    ...(options.discovered == null ? {} : { discovered: options.discovered }),
    ...(options.correlationId ? { correlation_id: options.correlationId } : {}),
    ...(options.channelIdRef ? { channel_id_ref: options.channelIdRef } : {}),
  }
  const { error } = await db.from(GCAL_TABLES.syncLog).insert(row)
  if (error && Object.keys(row).length !== Object.keys(base).length) {
    await db.from(GCAL_TABLES.syncLog).insert(base)
  }
}
