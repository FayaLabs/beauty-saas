// ---------------------------------------------------------------------------
// Public booking engine (B6) — slot pick + create booking on real data.
//
// Ported (scoped) from beautyplace's PublicBooking flow onto the three-ring
// archetype model: services live in saas_core.services, professionals in
// public.v_staff, availability is derived from public.v_bookings, and a new
// appointment is written across saas_core.orders → bookings → *_items, mirroring
// the SDK agenda provider's insert shape so both surfaces produce identical rows.
//
// Slot generation/conflict logic is pure (no I/O) so it is deterministic and
// unit-testable; only getAvailableSlots / listBookable* / createBooking touch
// the network via fayz.data.
// ---------------------------------------------------------------------------
import { fayz, type FayzTableFilter } from '@fayz-ai/sdk'

export interface BookableService {
  id: string
  name: string
  durationMinutes: number
  price: number
}

export interface BookableProfessional {
  id: string
  name: string
}

export interface TimeSlot {
  /** ISO timestamp for the slot start. */
  startsAt: string
  /** ISO timestamp for the slot end (start + service duration). */
  endsAt: string
  /** Local HH:mm label for display. */
  label: string
}

/** A busy interval that a candidate slot must not overlap. */
export interface BusyInterval {
  startsAt: string
  endsAt: string
}

/** Business-hours window + booking rules used to derive candidate slots. */
export interface SlotWindow {
  /** Local opening time, "HH:mm". */
  startTime: string
  /** Local closing time, "HH:mm". */
  endTime: string
  /** Minutes between candidate slot starts. */
  slotInterval: number
  /** Earliest a slot may be booked, in hours from "now". */
  minAdvanceHours: number
}

// Mirrors the agenda plugin config in app.tsx (businessHours 08:00–20:00,
// slotDuration 30, minAdvanceHours 2) so the public flow and the internal
// agenda offer the same grid.
export const DEFAULT_SLOT_WINDOW: SlotWindow = {
  startTime: '08:00',
  endTime: '20:00',
  slotInterval: 30,
  minAdvanceHours: 2,
}

const ACTIVE_STATUSES_EXCLUDED = ['cancelled', 'no_show']

function parseHourMinute(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map((part) => Number(part))
  return { hour: Number.isFinite(hour) ? hour : 0, minute: Number.isFinite(minute) ? minute : 0 }
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart)
}

/** Local midnight..next-midnight ISO bounds for a "YYYY-MM-DD" date. */
function localDayBounds(dateISO: string): { start: string; end: string } {
  const [year, month, day] = dateISO.split('-').map((part) => Number(part))
  const start = new Date(year, (month ?? 1) - 1, day ?? 1)
  const end = new Date(year, (month ?? 1) - 1, (day ?? 1) + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * PURE — every candidate slot of `durationMinutes` that fits inside the window
 * for the given local date. A slot is kept when its end does not pass the
 * closing time. No availability filtering happens here.
 */
export function generateDaySlots(
  dateISO: string,
  durationMinutes: number,
  window: SlotWindow = DEFAULT_SLOT_WINDOW,
): TimeSlot[] {
  const [year, month, day] = dateISO.split('-').map((part) => Number(part))
  const open = parseHourMinute(window.startTime)
  const close = parseHourMinute(window.endTime)
  const closeAt = new Date(year, (month ?? 1) - 1, day ?? 1, close.hour, close.minute)
  const duration = durationMinutes > 0 ? durationMinutes : window.slotInterval

  const slots: TimeSlot[] = []
  let cursor = new Date(year, (month ?? 1) - 1, day ?? 1, open.hour, open.minute)
  while (cursor.getTime() + duration * 60_000 <= closeAt.getTime()) {
    const startsAt = cursor.toISOString()
    slots.push({
      startsAt,
      endsAt: addMinutes(startsAt, duration),
      label: `${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`,
    })
    cursor = new Date(cursor.getTime() + window.slotInterval * 60_000)
  }
  return slots
}

/**
 * PURE — drop slots that overlap a busy interval or fall before the
 * minimum-advance cutoff measured from `now`.
 */
export function filterAvailableSlots(
  slots: TimeSlot[],
  busy: BusyInterval[],
  opts: { now: Date; minAdvanceHours: number },
): TimeSlot[] {
  const cutoff = new Date(opts.now.getTime() + opts.minAdvanceHours * 60 * 60_000)
  return slots.filter((slot) => {
    if (new Date(slot.startsAt) < cutoff) return false
    return !busy.some((interval) => overlaps(slot.startsAt, slot.endsAt, interval.startsAt, interval.endsAt))
  })
}

/** Active, bookable services from the service archetype (saas_core.services). */
export async function listBookableServices(tenantId: string): Promise<BookableService[]> {
  const { rows } = await fayz.data.listRows<{
    id: string
    name: string
    duration_minutes: number | null
    price: number | null
  }>({
    table: 'services',
    schema: 'saas_core',
    filters: [
      { column: 'tenant_id', operator: 'eq', value: tenantId },
      { column: 'is_active', operator: 'eq', value: true },
    ],
    sortColumn: 'name',
    sortDirection: 'asc',
    limit: 200,
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    durationMinutes: row.duration_minutes ?? 30,
    price: Number(row.price ?? 0),
  }))
}

/** Active professionals (person kind=staff) via the v_staff bridge view. */
export async function listProfessionals(tenantId: string): Promise<BookableProfessional[]> {
  const { rows } = await fayz.data.listRows<{ id: string; name: string; is_active: boolean | null }>({
    table: 'v_staff',
    filters: [
      { column: 'tenant_id', operator: 'eq', value: tenantId },
      { column: 'is_active', operator: 'eq', value: true },
    ],
    sortColumn: 'name',
    sortDirection: 'asc',
    limit: 200,
  })
  return rows.map((row) => ({ id: row.id, name: row.name }))
}

/**
 * Available slots for a professional on a local date: candidate grid minus the
 * professional's existing (non-cancelled/no-show) bookings and the advance cutoff.
 */
export async function getAvailableSlots(input: {
  tenantId: string
  professionalId: string
  dateISO: string
  durationMinutes: number
  window?: SlotWindow
  now?: Date
}): Promise<TimeSlot[]> {
  const window = input.window ?? DEFAULT_SLOT_WINDOW
  const { start, end } = localDayBounds(input.dateISO)

  const dayFilters: FayzTableFilter[] = [
    { column: 'tenant_id', operator: 'eq', value: input.tenantId },
    { column: 'professional_id', operator: 'eq', value: input.professionalId },
    { column: 'starts_at', operator: 'gte', value: start },
    { column: 'starts_at', operator: 'lt', value: end },
  ]
  const { rows } = await fayz.data.listRows<{ starts_at: string; ends_at: string; status: string | null }>({
    table: 'v_bookings',
    filters: dayFilters,
    limit: 500,
  })

  const busy: BusyInterval[] = rows
    .filter((row) => !ACTIVE_STATUSES_EXCLUDED.includes(row.status ?? ''))
    .map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at }))

  const candidates = generateDaySlots(input.dateISO, input.durationMinutes, window)
  return filterAvailableSlots(candidates, busy, {
    now: input.now ?? new Date(),
    minAdvanceHours: window.minAdvanceHours,
  })
}

export interface BookingDraft {
  /** Tenant the booking belongs to (resolved from the public booking link / org). */
  tenantId: string
  professionalId: string
  service: BookableService
  /** ISO start; end is derived from the service duration. */
  startsAt: string
  /** Existing person(kind=customer) id, when the client is already known. */
  clientId?: string | null
  /** Client display name for order/booking metadata. */
  clientName?: string
  locationId?: string | null
  notes?: string
}

export interface CreatedBooking {
  bookingId: string
  orderId: string
  startsAt: string
  endsAt: string
}

/**
 * Persist a public booking on real data: order → booking → booking_items +
 * order_items, all in saas_core, matching the agenda provider's insert shape so
 * the appointment reads back identically through v_bookings / the agenda.
 */
export async function createBooking(draft: BookingDraft): Promise<CreatedBooking> {
  const { service } = draft
  const endsAt = addMinutes(draft.startsAt, service.durationMinutes || 30)
  const metadata = {
    source: 'public-booking',
    serviceNames: service.name,
    itemsSummary: service.name,
    ...(draft.clientName ? { contactName: draft.clientName } : {}),
  }

  const order = await fayz.data.createRow<Record<string, unknown>>({
    table: 'orders',
    schema: 'saas_core',
    row: {
      tenant_id: draft.tenantId,
      kind: 'appointment',
      status: 'scheduled',
      party_id: draft.clientId ?? null,
      assignee_id: draft.professionalId,
      location_id: draft.locationId ?? null,
      subtotal: service.price,
      total: service.price,
      notes: draft.notes ?? null,
      metadata,
    },
  })
  const orderId = String(order.id)

  const booking = await fayz.data.createRow<Record<string, unknown>>({
    table: 'bookings',
    schema: 'saas_core',
    row: {
      tenant_id: draft.tenantId,
      kind: 'appointment',
      party_id: draft.clientId ?? null,
      assignee_id: draft.professionalId,
      location_id: draft.locationId ?? null,
      order_id: orderId,
      starts_at: draft.startsAt,
      ends_at: endsAt,
      status: 'scheduled',
      notes: draft.notes ?? null,
      metadata,
    },
  })
  const bookingId = String(booking.id)

  await fayz.data.createRow({
    table: 'booking_items',
    schema: 'saas_core',
    row: {
      booking_id: bookingId,
      service_id: service.id,
      name: service.name,
      duration_minutes: service.durationMinutes,
      price: service.price,
      sort_order: 0,
      assignee_id: draft.professionalId,
    },
  })

  await fayz.data.createRow({
    table: 'order_items',
    schema: 'saas_core',
    row: {
      order_id: orderId,
      service_id: service.id,
      name: service.name,
      quantity: 1,
      unit_price: service.price,
      total: service.price,
      sort_order: 0,
      duration_minutes: service.durationMinutes,
      assignee_id: draft.professionalId,
    },
  })

  return { bookingId, orderId, startsAt: draft.startsAt, endsAt }
}
