import type { EntityDef } from '@fayz/saas-core'

export const contactEntity: EntityDef = {
  name: 'Contact',
  namePlural: 'Contacts',
  icon: 'Contact',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'email', label: 'Email', type: 'email', showInTable: true, searchable: true },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true },
    { key: 'type', label: 'Type', type: 'select', options: ['supplier', 'partner', 'other'], showInTable: true, defaultValue: 'supplier' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  data: { table: 'contacts', tenantScoped: true, tenantIdColumn: 'tenant_id' },
  defaultSort: 'name',
  displayField: 'name',
}

export const staffEntity: EntityDef = {
  name: 'Staff',
  namePlural: 'Staff',
  icon: 'UserCog',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'email', label: 'Email', type: 'email', showInTable: true, searchable: true },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true },
    { key: 'role', label: 'Role', type: 'select', options: ['professional', 'employee'], showInTable: true, defaultValue: 'professional' },
    { key: 'profession', label: 'Profession', type: 'text', showInTable: true },
    { key: 'is_active', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: { table: 'staff_members', tenantScoped: true, tenantIdColumn: 'tenant_id' },
  defaultSort: 'name',
  displayField: 'name',
}

export const locationEntity: EntityDef = {
  name: 'Location',
  namePlural: 'Locations',
  icon: 'MapPin',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'capacity', label: 'Capacity', type: 'number', showInTable: true },
    { key: 'is_active', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: { table: 'service_locations', tenantScoped: true, tenantIdColumn: 'tenant_id' },
  defaultSort: 'name',
  displayField: 'name',
}

export const originEntity: EntityDef = {
  name: 'Origin',
  namePlural: 'Origins',
  icon: 'Globe',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
  ],
  data: { table: 'origins', tenantScoped: true, tenantIdColumn: 'tenant_id' },
  defaultSort: 'name',
  displayField: 'name',
}

export const partnershipEntity: EntityDef = {
  name: 'Partnership',
  namePlural: 'Partnerships',
  icon: 'Handshake',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'contact', label: 'Contact', type: 'text', showInTable: true },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true },
    { key: 'is_active', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: { table: 'partnerships', tenantScoped: true, tenantIdColumn: 'tenant_id' },
  defaultSort: 'name',
  displayField: 'name',
}

export const equipmentEntity: EntityDef = {
  name: 'Equipment',
  namePlural: 'Equipment',
  icon: 'Wrench',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'model', label: 'Model', type: 'text', showInTable: true },
    { key: 'serial_number', label: 'Serial Number', type: 'text', showInTable: true },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'maintenance', 'retired'], showInTable: true, defaultValue: 'active' },
  ],
  data: { table: 'equipment', tenantScoped: true, tenantIdColumn: 'tenant_id' },
  defaultSort: 'name',
  displayField: 'name',
}

export const bankAccountEntity: EntityDef = {
  name: 'Account',
  namePlural: 'Accounts',
  icon: 'Building2',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'type', label: 'Type', type: 'select', options: ['checking', 'savings', 'cash', 'credit_card'], showInTable: true },
    { key: 'bank_name', label: 'Bank', type: 'text', showInTable: true },
    { key: 'is_active', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: { table: 'bank_accounts', tenantScoped: true, tenantIdColumn: 'tenant_id' },
  defaultSort: 'name',
  displayField: 'name',
}
