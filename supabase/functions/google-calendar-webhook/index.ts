import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import { GCAL_TABLES } from '../_shared/google-calendar-mapping.js'
import {
  constantTimeEqual,
  isNewerGoogleMessage,
} from '../_shared/google-calendar-security.js'

const env = (name: string) => Deno.env.get(name) ?? ''
const requiredEnv = (name: string) => {
  const value = env(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function admin() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function empty(status = 204) {
  return new Response(null, { status })
}

async function pullChangedEvents(db: any, deliveryId: string, tenantId: string, channelRef: string) {
  await db
    .from(GCAL_TABLES.webhookDeliveries)
    .update({ status: 'processing', error: null })
    .eq('id', deliveryId)
    .eq('tenant_id', tenantId)

  try {
    const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    const syncUrl =
      env('GCAL_SYNC_FUNCTION_URL') ||
      `${requiredEnv('SUPABASE_URL')}/functions/v1/google-calendar-sync`
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'pull_events',
        trigger: 'webhook',
        tenantId,
        channelRef,
      }),
    })
    if (!response.ok) {
      throw new Error(`Calendar pull returned HTTP ${response.status}`)
    }
    await db
      .from(GCAL_TABLES.webhookDeliveries)
      .update({ status: 'processed', processed_at: new Date().toISOString(), error: null })
      .eq('id', deliveryId)
      .eq('tenant_id', tenantId)
  } catch (error) {
    await db
      .from(GCAL_TABLES.webhookDeliveries)
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error: String((error as Error)?.message ?? error).slice(0, 500),
      })
      .eq('id', deliveryId)
      .eq('tenant_id', tenantId)
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return empty(405)

  const googleChannelId = request.headers.get('x-goog-channel-id') ?? ''
  const webhookToken = request.headers.get('x-goog-channel-token') ?? ''
  const resourceId = request.headers.get('x-goog-resource-id') ?? ''
  const resourceState = request.headers.get('x-goog-resource-state') ?? ''
  const messageNumber = request.headers.get('x-goog-message-number') ?? ''
  if (!googleChannelId || !webhookToken || !resourceId || !/^\d+$/u.test(messageNumber)) {
    return empty(400)
  }

  const db = admin()
  const { data: channel, error: channelError } = await db
    .from(GCAL_TABLES.channels)
    .select(
      'id,tenant_id,resource_id,webhook_token_hash,is_active,direction,last_webhook_message_number',
    )
    .eq('channel_id', googleChannelId)
    .maybeSingle()
  if (channelError) return empty(500)
  if (
    !channel ||
    !channel.is_active ||
    !['inbound', 'bidirectional'].includes(channel.direction)
  ) {
    return empty(404)
  }
  if (channel.resource_id && channel.resource_id !== resourceId) return empty(403)
  if (
    !channel.webhook_token_hash ||
    !(await constantTimeEqual(await sha256(webhookToken), channel.webhook_token_hash))
  ) {
    return empty(403)
  }
  if (!isNewerGoogleMessage(messageNumber, channel.last_webhook_message_number)) {
    return empty()
  }

  const { data: delivery, error: insertError } = await db
    .from(GCAL_TABLES.webhookDeliveries)
    .insert({
      tenant_id: channel.tenant_id,
      channel_ref: channel.id,
      google_channel_id: googleChannelId,
      resource_id: resourceId,
      message_number: messageNumber,
      resource_state: resourceState || null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (insertError?.code === '23505') return empty()
  if (insertError || !delivery) return empty(500)

  const { error: channelUpdateError } = await db
    .from(GCAL_TABLES.channels)
    .update({
      last_webhook_message_number: messageNumber,
      last_webhook_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', channel.id)
    .eq('tenant_id', channel.tenant_id)
  if (channelUpdateError) return empty(500)

  await db.from(GCAL_TABLES.automationOutbox).upsert(
    {
      tenant_id: channel.tenant_id,
      event_type: 'google.calendar.notification.received',
      aggregate_type: 'calendar_channel',
      aggregate_id: channel.id,
      idempotency_key: `google-webhook:${googleChannelId}:${messageNumber}`,
      payload: {
        channelRef: channel.id,
        googleChannelId,
        resourceId,
        resourceState: resourceState || null,
        messageNumber,
      },
    },
    { onConflict: 'tenant_id,idempotency_key', ignoreDuplicates: true },
  )

  if (env('GCAL_WEBHOOK_AUTO_PULL').toLowerCase() === 'true') {
    const work = pullChangedEvents(db, delivery.id, channel.tenant_id, channel.id)
    const edgeRuntime = (globalThis as any).EdgeRuntime
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(work)
    else await work
  }
  return empty()
})
