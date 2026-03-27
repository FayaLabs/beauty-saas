import type { EntityDef } from '@fayz/saas-core'

export interface BeautyClient {
  id: string
  name: string
  email: string
  phone: string
  dateOfBirth: string
  gender: string
  origin: string
  visits: number
  totalSpent: number
  lastVisit: string
}

// ---------------------------------------------------------------------------
// Clients — person archetype + extension table (public.clients)
// ---------------------------------------------------------------------------
export const clientEntity: EntityDef<BeautyClient> = {
  name: 'Client',
  icon: 'Users',
  layout: 'person',
  displayField: 'name',
  subtitleField: 'email',
  data: { table: 'clients', tenantScoped: true, tenantIdColumn: 'tenant_id' },
  defaultSort: 'name',
  fieldGroups: [
    { id: 'personal', label: 'Personal Details', columns: 2 },
    { id: 'stats', label: 'Statistics', description: 'Auto-calculated from activity', columns: 3 },
  ],
  fields: [
    // Person archetype fields (→ saas_core.persons)
    { key: 'name', label: 'Name', type: 'text', required: true, searchable: true, showInTable: true },
    { key: 'email', label: 'Email', type: 'email', required: true, searchable: true, showInTable: true },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true },
    { key: 'dateOfBirth', label: 'Birth Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea', showInTable: false },
    { key: 'isActive', label: 'Active', type: 'boolean', defaultValue: true },
    // Extension fields (→ public.clients)
    { key: 'gender', label: 'Gender', type: 'select', options: ['male', 'female', 'other', 'prefer_not_to_say'], group: 'personal', showInTable: false },
    { key: 'origin', label: 'Origin', type: 'text', group: 'personal', placeholder: 'How did they find us?', showInTable: false },
    // Stats (read-only)
    { key: 'visits', label: 'Visits', type: 'number', showInForm: false, showInTable: true, group: 'stats' },
    { key: 'totalSpent', label: 'Total Spent', type: 'currency', showInForm: false, showInTable: true, group: 'stats' },
    { key: 'lastVisit', label: 'Last Visit', type: 'date', showInForm: false, showInTable: false, group: 'stats' },
  ],
  data: {
    table: 'clients',
    tenantScoped: true,
    archetype: 'person',
    archetypeKind: 'customer',
  },
}
