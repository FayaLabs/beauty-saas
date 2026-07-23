export const GCAL_TABLES = {
  integrations: 'plg_calendar_integrations',
  channels: 'plg_calendar_channels',
  syncLog: 'plg_calendar_sync_log',
  webhookDeliveries: 'plg_calendar_webhook_deliveries',
  automationOutbox: 'plg_calendar_automation_outbox',
}

export function appointmentRowSummary(row) {
  const metadata = row.metadata ?? {}
  const services = metadata.serviceNames ?? ''
  const client = metadata.contactName ?? metadata.clientName ?? ''
  if (services && client) return `${services} — ${client}`
  return services || client || 'Appointment'
}

export function appointmentRowToEvent(row) {
  return {
    summary: appointmentRowSummary(row),
    description: row.notes ?? undefined,
    start: { dateTime: row.starts_at },
    end: { dateTime: row.ends_at ?? row.starts_at },
  }
}

export function eventTimes(event) {
  const allDay = !event.start?.dateTime && Boolean(event.start?.date)
  const startsAt = event.start?.dateTime ?? event.start?.date ?? ''
  const endsAt = event.end?.dateTime ?? event.end?.date ?? startsAt
  return { startsAt, endsAt, allDay }
}

export function channelRowToChannel(row) {
  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    googleCalendarId: row.google_calendar_id,
    summary: row.summary ?? null,
    color: row.color ?? null,
    direction: row.direction,
    targetKind: row.target_kind ?? null,
    targetId: row.target_id ?? null,
    importMode: row.import_mode ?? 'appointment',
    syncToken: row.sync_token ?? null,
    channelId: row.channel_id ?? null,
    resourceId: row.resource_id ?? null,
    channelExpiresAt: row.channel_expires_at ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function resolveTargetChannel(channels, booking) {
  const eligible = channels.filter(
    (channel) =>
      channel.isActive && (channel.direction === 'outbound' || channel.direction === 'bidirectional'),
  )
  if (booking.assigneeId) {
    const match = eligible.find(
      (channel) => channel.targetKind === 'assignee' && channel.targetId === booking.assigneeId,
    )
    if (match) return match
  }
  if (booking.serviceIds?.length) {
    const match = eligible.find(
      (channel) =>
        channel.targetKind === 'service' &&
        channel.targetId &&
        booking.serviceIds.includes(channel.targetId),
    )
    if (match) return match
  }
  if (booking.locationId) {
    const match = eligible.find(
      (channel) => channel.targetKind === 'location' && channel.targetId === booking.locationId,
    )
    if (match) return match
  }
  return eligible.find((channel) => channel.targetKind === null) ?? null
}
