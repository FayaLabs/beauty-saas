import type { EntityDef } from '@fayz/saas-core'

// ---------------------------------------------------------------------------
// Contacts / Suppliers — person archetype, direct query
// ---------------------------------------------------------------------------
export const contactEntity: EntityDef = {
  name: 'Contact',
  namePlural: 'Contacts',
  icon: 'Contact',
  layout: 'person',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'email', label: 'Email', type: 'email', showInTable: true, searchable: true },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true },
    { key: 'notes', label: 'Notes', type: 'textarea', showInTable: false },
    { key: 'isActive', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: {
    table: 'persons',
    schema: 'saas_core',
    tenantScoped: true,
    filters: { kind: 'contact' },
    defaults: { kind: 'contact' },
  },
}

// ---------------------------------------------------------------------------
// Staff — person archetype + extension table (public.staff_members)
// ---------------------------------------------------------------------------
export const staffEntity: EntityDef = {
  name: 'Staff',
  namePlural: 'Staff',
  icon: 'UserCog',
  layout: 'person',
  displayField: 'name',
  defaultSort: 'name',
  fieldGroups: [
    { id: 'professional', label: 'Professional Info', columns: 2 },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'email', label: 'Email', type: 'email', showInTable: true, searchable: true },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true },
    { key: 'profession', label: 'Profession', type: 'text', showInTable: true, group: 'professional' },
    { key: 'isActive', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: {
    table: 'staff_members',
    tenantScoped: true,
    archetype: 'person',
    archetypeKind: 'staff',
    searchColumns: ['name', 'email', 'phone'],
  },
}

// ---------------------------------------------------------------------------
// Suppliers — person archetype, direct query
// ---------------------------------------------------------------------------
export const supplierEntity: EntityDef = {
  name: 'Supplier',
  namePlural: 'Suppliers',
  icon: 'Building2',
  layout: 'person',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'email', label: 'Email', type: 'email', showInTable: true },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true },
    { key: 'notes', label: 'Notes', type: 'textarea', showInTable: false },
    { key: 'isActive', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: {
    table: 'persons',
    schema: 'saas_core',
    tenantScoped: true,
    filters: { kind: 'supplier' },
    defaults: { kind: 'supplier' },
  },
}

// ---------------------------------------------------------------------------
// Partnerships — person archetype, direct query
// ---------------------------------------------------------------------------
export const partnershipEntity: EntityDef = {
  name: 'Partnership',
  namePlural: 'Partnerships',
  icon: 'Handshake',
  layout: 'person',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'phone', label: 'Phone', type: 'phone', showInTable: true },
    { key: 'isActive', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: {
    table: 'persons',
    schema: 'saas_core',
    tenantScoped: true,
    filters: { kind: 'partner' },
    defaults: { kind: 'partner' },
  },
}

// ---------------------------------------------------------------------------
// Equipment — product archetype, direct query
// ---------------------------------------------------------------------------
export const equipmentEntity: EntityDef = {
  name: 'Equipment',
  namePlural: 'Equipment',
  icon: 'Wrench',
  layout: 'product',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'description', label: 'Model', type: 'text', showInTable: true },
    { key: 'sku', label: 'Serial Number', type: 'text', showInTable: true },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'maintenance', 'retired'], showInTable: true, defaultValue: 'active' },
  ],
  data: {
    table: 'products',
    schema: 'saas_core',
    tenantScoped: true,
    filters: { kind: 'asset' },
    defaults: { kind: 'asset' },
  },
}

// ---------------------------------------------------------------------------
// Origins — category archetype, direct query
// ---------------------------------------------------------------------------
export const originEntity: EntityDef = {
  name: 'Origin',
  namePlural: 'Origins',
  icon: 'Globe',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'isActive', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: {
    table: 'categories',
    schema: 'saas_core',
    tenantScoped: true,
    filters: { kind: 'origin' },
    defaults: { kind: 'origin' },
  },
}

// ---------------------------------------------------------------------------
// Service Categories — category archetype, direct query
// ---------------------------------------------------------------------------
export const serviceCategoryEntity: EntityDef = {
  name: 'Service Category',
  namePlural: 'Service Categories',
  icon: 'Tag',
  displayField: 'name',
  defaultSort: 'sortOrder',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'sortOrder', label: 'Order', type: 'number', showInTable: true, defaultValue: 0 },
    { key: 'isActive', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: {
    table: 'categories',
    schema: 'saas_core',
    tenantScoped: true,
    filters: { kind: 'service_category' },
    defaults: { kind: 'service_category' },
  },
}

// ---------------------------------------------------------------------------
// Bank Accounts — standalone, no archetype
// ---------------------------------------------------------------------------
export const bankAccountEntity: EntityDef = {
  name: 'Account',
  namePlural: 'Accounts',
  icon: 'Building2',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'type', label: 'Type', type: 'select', options: ['checking', 'savings', 'cash', 'credit_card'], showInTable: true },
    { key: 'bankName', label: 'Bank', type: 'text', showInTable: true },
    { key: 'isActive', label: 'Active', type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: {
    table: 'bank_accounts',
    tenantScoped: true,
  },
}
