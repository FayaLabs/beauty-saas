import type { EntityDef } from '@fayz/saas-core'

export interface BeautyClient {
  id: string
  tenantId: string
  createdAt: string
  updatedAt: string
  name: string
  email: string
  phone: string
  birthDate: string
  gender: string
  origin: string
  notes: string
  visits: number
  totalSpent: number
  lastVisit: string
}

export const clientEntity: EntityDef<BeautyClient> = {
  name: 'Client',
  icon: 'Users',
  displayField: 'name',
  subtitleField: 'email',
  defaultSort: 'name',
  fieldGroups: [
    { id: 'contact', label: 'Contact Information', columns: 2 },
    { id: 'personal', label: 'Personal Details', columns: 2 },
    { id: 'stats', label: 'Statistics', description: 'Auto-calculated from activity', columns: 3 },
  ],
  fields: [
    // Contact
    { key: 'name', label: 'Name', type: 'text', required: true, searchable: true, showInTable: true, group: 'contact' },
    { key: 'email', label: 'Email', type: 'email', required: true, searchable: true, showInTable: true, group: 'contact' },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true, group: 'contact' },
    // Personal
    { key: 'birthDate', label: 'Birth Date', type: 'date', group: 'personal', showInTable: false },
    { key: 'gender', label: 'Gender', type: 'select', options: ['male', 'female', 'other', 'prefer_not_to_say'], group: 'personal', showInTable: false },
    { key: 'origin', label: 'Origin', type: 'text', group: 'personal', placeholder: 'How did they find us?', showInTable: false },
    { key: 'notes', label: 'Notes', type: 'textarea', group: 'personal', span: 2, showInTable: false },
    // Stats (read-only)
    { key: 'visits', label: 'Visits', type: 'number', showInForm: false, showInTable: true, group: 'stats' },
    { key: 'totalSpent', label: 'Total Spent', type: 'currency', showInForm: false, showInTable: true, group: 'stats' },
    { key: 'lastVisit', label: 'Last Visit', type: 'date', showInForm: false, showInTable: false, group: 'stats' },
  ],
}
