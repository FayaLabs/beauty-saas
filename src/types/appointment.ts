import type { EntityDef } from '@fayz/saas-core'

export interface BeautyAppointment {
  id: string
  tenantId: string
  createdAt: string
  updatedAt: string
  client: string
  service: string
  date: string
  time: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  notes: string
}

export const appointmentEntity: EntityDef<BeautyAppointment> = {
  name: 'Appointment',
  icon: 'Calendar',
  displayField: 'client',
  defaultSort: 'date',
  defaultSortDir: 'desc',
  fields: [
    { key: 'client', label: 'Client', type: 'text', required: true, searchable: true },
    { key: 'service', label: 'Service', type: 'text', required: true, searchable: true },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'time', label: 'Time', type: 'time', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'confirmed', 'completed', 'cancelled'], defaultValue: 'scheduled' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
}
