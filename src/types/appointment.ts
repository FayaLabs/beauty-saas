import type { EntityDef } from '@fayz/saas-core'

export interface BeautyAppointment {
  id: string
  startsAt: string
  status: string
  notes: string
}

// ---------------------------------------------------------------------------
// Appointments — booking archetype + extension table (public.appointments)
// party_id = client, assignee_id = staff, service via booking_items
// ---------------------------------------------------------------------------
export const appointmentEntity: EntityDef<BeautyAppointment> = {
  name: 'Appointment',
  icon: 'Calendar',
  displayField: 'startsAt',
  defaultSort: 'startsAt',
  defaultSortDir: 'desc',
  fields: [
    // Booking archetype fields (→ saas_core.bookings)
    { key: 'startsAt', label: 'Date & Time', type: 'datetime', required: true, showInTable: true },
    { key: 'status', label: 'Status', type: 'select', options: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'], defaultValue: 'pending', showInTable: true },
    { key: 'notes', label: 'Notes', type: 'textarea', showInTable: false },
  ],
  data: {
    table: 'appointments',
    tenantScoped: true,
    archetype: 'booking',
    archetypeKind: 'appointment',
  },
}
