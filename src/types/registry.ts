import type { EntityDef } from '@fayz/saas-core'
import { tl } from '../i18n/tl'

// ---------------------------------------------------------------------------
// Contacts — person archetype, direct query
// ---------------------------------------------------------------------------
export const contactEntity: EntityDef = {
  name: tl('Contact', 'Contato'),
  namePlural: tl('Contacts', 'Contatos'),
  icon: 'Contact',
  layout: 'person',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'email', label: 'E-mail', type: 'email', showInTable: true, searchable: true },
    { key: 'phone', label: tl('Phone', 'Telefone'), type: 'phone', showInTable: true },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea', showInTable: false },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true },
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
// Staff — person archetype + extension table
// ---------------------------------------------------------------------------
export const staffEntity: EntityDef = {
  name: tl('Staff', 'Profissional'),
  namePlural: tl('Staff', 'Profissionais'),
  icon: 'UserCog',
  layout: 'person',
  displayField: 'name',
  defaultSort: 'name',
  fieldGroups: [
    { id: 'professional', label: tl('Professional Info', 'Informações Profissionais'), columns: 2 },
  ],
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'email', label: 'E-mail', type: 'email', showInTable: true, searchable: true },
    { key: 'phone', label: tl('Phone', 'Telefone'), type: 'phone', showInTable: true },
    { key: 'profession', label: tl('Profession', 'Profissão'), type: 'text', showInTable: true, group: 'professional' },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true },
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
  name: tl('Supplier', 'Fornecedor'),
  namePlural: tl('Suppliers', 'Fornecedores'),
  icon: 'Building2',
  layout: 'person',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'email', label: 'E-mail', type: 'email', showInTable: true },
    { key: 'phone', label: tl('Phone', 'Telefone'), type: 'phone', showInTable: true },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea', showInTable: false },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true },
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
  name: tl('Partnership', 'Parceria'),
  namePlural: tl('Partnerships', 'Parcerias'),
  icon: 'Handshake',
  layout: 'person',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'phone', label: tl('Phone', 'Telefone'), type: 'phone', showInTable: true },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true },
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
  name: tl('Equipment', 'Equipamento'),
  namePlural: tl('Equipment', 'Equipamentos'),
  icon: 'Wrench',
  layout: 'product',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'description', label: tl('Model', 'Modelo'), type: 'text', showInTable: true },
    { key: 'sku', label: tl('Serial Number', 'Número de Série'), type: 'text', showInTable: true },
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
  name: tl('Origin', 'Origem'),
  namePlural: tl('Origins', 'Origens'),
  icon: 'Globe',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true },
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
  name: tl('Service Category', 'Categoria de Serviço'),
  namePlural: tl('Service Categories', 'Categorias de Serviço'),
  icon: 'Tag',
  displayField: 'name',
  defaultSort: 'sortOrder',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0 },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true },
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
  name: tl('Account', 'Conta'),
  namePlural: tl('Accounts', 'Contas'),
  icon: 'Building2',
  displayField: 'name',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'type', label: tl('Type', 'Tipo'), type: 'select', options: ['checking', 'savings', 'cash', 'credit_card'], showInTable: true },
    { key: 'bankName', label: tl('Bank', 'Banco'), type: 'text', showInTable: true },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true },
  ],
  data: {
    table: 'bank_accounts',
    tenantScoped: true,
  },
}
