// GERADO por scripts/functions-sync.mjs — NÃO EDITE AQUI.
// Fonte: plugin-agenda → src/integrations/google-calendar/mapping.ts
// Edite no repo do plugin e rode: npm run functions:sync
// Booking ↔ Google Calendar event mapping — the SINGLE SOURCE OF TRUTH.
//
// These helpers are pure and Deno-friendly (only `import type`, no runtime
// node/react/https imports), so the Supabase edge function imports this exact
// file via a relative path (`../../src/integrations/google-calendar/mapping.ts`)
// instead of keeping a divergent mirror. `import type` is elided by the Deno /
// esbuild bundler, so the plugin `types.ts`/`CalendarBooking` type imports never
// become runtime dependencies of the function bundle.
//
// Two callers, two input shapes:
//   • the SDK/UI works with the rich `CalendarBooking` (camelCase, joined) — see
//     bookingToEvent / eventToBookingPatch;
//   • the edge function + RPCs work with the raw `AppointmentRow` (snake_case DB
//     columns) — see appointmentRowToEvent / eventToAppointmentPatch.
// Field decisions (title, all-day, cancel) are made once, here.
import type { CalendarBooking } from '../../types'
import type { GCalEvent, AppointmentRow, CalendarChannel, CalendarChannelRow } from './types'

export interface GCalEventInput {
  summary: string
  description?: string
  // Timed events use dateTime; all-day events use date (YYYY-MM-DD).
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
}

/** Normalized time window read off a Google event, all-day aware. */
export interface EventTimes {
  startsAt: string
  endsAt: string
  allDay: boolean
}

// --- Booking (rich SDK shape) → event -------------------------------------

/** Build the event title from the booking's services + client. */
export function bookingSummary(b: Pick<CalendarBooking, 'services' | 'clientName'>): string {
  const services = (b.services ?? []).map((s) => s.name).filter(Boolean).join(', ')
  const who = b.clientName ?? ''
  if (services && who) return `${services} — ${who}`
  return services || who || 'Appointment'
}

/** Map a Fayz booking to a Google Calendar event input. Returns null when the booking has no end. */
export function bookingToEvent(b: CalendarBooking, timeZone?: string): GCalEventInput | null {
  if (!b.startsAt || !b.endsAt) return null
  const notes = [b.notes, b.professionalName ? `Pro: ${b.professionalName}` : '', b.locationName ?? '']
    .filter(Boolean).join('\n')
  return {
    summary: bookingSummary(b),
    description: notes || undefined,
    start: { dateTime: b.startsAt, timeZone },
    end: { dateTime: b.endsAt, timeZone },
  }
}

/** Map an inbound Google event change to a partial booking update (reschedule/cancel), all-day aware. */
export function eventToBookingPatch(ev: GCalEvent): { startsAt?: string; endsAt?: string; status?: 'cancelled' } {
  if (ev.status === 'cancelled') return { status: 'cancelled' }
  const t = eventTimes(ev)
  return { startsAt: t.startsAt, endsAt: t.endsAt }
}

// --- Appointment row (raw DB shape) → event -------------------------------

/**
 * Build the event title from an appointments row's denormalized metadata.
 * The raw row has no joined services/client, so we read the names the app
 * stamps onto metadata (serviceNames, contactName/clientName).
 */
export function appointmentRowSummary(row: AppointmentRow): string {
  const m = row.metadata ?? {}
  const services = (m.serviceNames as string) ?? ''
  const who = (m.contactName as string) ?? (m.clientName as string) ?? ''
  if (services && who) return `${services} — ${who}`
  return services || who || 'Appointment'
}

/** Map a raw appointments row to a Google event input (outbound push from the edge function). */
export function appointmentRowToEvent(row: AppointmentRow): GCalEventInput {
  return {
    summary: appointmentRowSummary(row),
    description: row.notes ?? undefined,
    start: { dateTime: row.starts_at },
    end: { dateTime: row.ends_at ?? row.starts_at },
  }
}

/**
 * Map an inbound Google event to a DB-friendly appointment patch (snake_case
 * times), all-day aware, cancellation included. Consumed by the edge function
 * when calling gcal_apply_event_patch.
 */
export function eventToAppointmentPatch(ev: GCalEvent): {
  starts_at?: string
  ends_at?: string
  summary?: string
  allDay?: boolean
  cancelled: boolean
} {
  if (ev.status === 'cancelled') return { cancelled: true }
  const t = eventTimes(ev)
  return { starts_at: t.startsAt, ends_at: t.endsAt, summary: ev.summary, allDay: t.allDay, cancelled: false }
}

// --- Shared time normalization (all-day aware) ----------------------------

/**
 * Read a normalized {startsAt, endsAt, allDay} window off a Google event.
 * All-day events carry `start.date`/`end.date` (YYYY-MM-DD, end exclusive) and
 * no dateTime; timed events carry dateTime. Falls back start→end when one side
 * is missing so callers always get a usable pair.
 */
export function eventTimes(ev: GCalEvent): EventTimes {
  const allDay = !ev.start?.dateTime && !!ev.start?.date
  const startsAt = ev.start?.dateTime ?? ev.start?.date ?? ''
  const endsAt = ev.end?.dateTime ?? ev.end?.date ?? startsAt
  return { startsAt, endsAt, allDay }
}

// --- Channel resolution (outbound destination priority) -------------------

/** Convert a raw plg_calendar_channels row (snake_case) to the camelCase CalendarChannel. */
export function channelRowToChannel(r: CalendarChannelRow): CalendarChannel {
  return {
    id: r.id,
    integrationId: r.integration_id,
    tenantId: r.tenant_id,
    googleCalendarId: r.google_calendar_id,
    summary: r.summary ?? null,
    color: r.color ?? null,
    direction: r.direction,
    targetKind: r.target_kind ?? null,
    targetId: r.target_id ?? null,
    importMode: r.import_mode ?? 'appointment',
    syncToken: r.sync_token ?? null,
    channelId: r.channel_id ?? null,
    resourceId: r.resource_id ?? null,
    channelExpiresAt: r.channel_expires_at ?? null,
    isActive: r.is_active ?? true,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  }
}

export interface ChannelMatchInput {
  assigneeId?: string | null
  serviceIds?: string[]
  locationId?: string | null
}

/**
 * Pick the outbound destination channel for a booking, by priority:
 *   1. a channel targeting the booking's assignee,
 *   2. else a channel targeting one of the booking's services,
 *   3. else a channel targeting the booking's location,
 *   4. else the whole-agenda channel (targetKind === null).
 * Only active outbound/bidirectional channels are eligible. Returns null when
 * nothing matches (caller falls back to the integration's default calendar).
 */
export function resolveTargetChannel(
  channels: CalendarChannel[],
  booking: ChannelMatchInput,
): CalendarChannel | null {
  const eligible = channels.filter(
    (c) => c.isActive && (c.direction === 'outbound' || c.direction === 'bidirectional'),
  )
  const serviceIds = booking.serviceIds ?? []

  if (booking.assigneeId) {
    const byAssignee = eligible.find((c) => c.targetKind === 'assignee' && c.targetId === booking.assigneeId)
    if (byAssignee) return byAssignee
  }
  if (serviceIds.length) {
    const byService = eligible.find((c) => c.targetKind === 'service' && !!c.targetId && serviceIds.includes(c.targetId))
    if (byService) return byService
  }
  if (booking.locationId) {
    const byLocation = eligible.find((c) => c.targetKind === 'location' && c.targetId === booking.locationId)
    if (byLocation) return byLocation
  }
  return eligible.find((c) => c.targetKind === null) ?? null
}
