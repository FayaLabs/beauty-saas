import type { EntityDef } from '@fayz-ai/saas'
import { ClientDocumentsTab } from '../components/clients/ClientDocumentsTab'
import { tl } from '../i18n/tl'

// ---------------------------------------------------------------------------
// Staff — person archetype + extension table
// ---------------------------------------------------------------------------
export const staffEntity: EntityDef = {
  name: tl('Staff', 'Profissional'),
  namePlural: tl('Staff', 'Profissionais'),
  icon: 'UserCog',
  // staff_members is an extension table (no name column) — useless to the
  // agent's generic reader. The agent sees professionals through the
  // beauty:professionals read-model (people kind='staff') instead.
  agentHidden: true,
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
    { key: 'commissionRate', label: tl('Commission (%)', 'Comissão (%)'), type: 'number', showInTable: true, group: 'professional', defaultValue: 0 },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  detailTabs: [
    {
      id: 'documents',
      label: tl('Documents', 'Documentos'),
      icon: 'FolderOpen',
      component: ClientDocumentsTab as never,
      props: {
        loadingLabel: tl('Loading professional documents...', 'Carregando documentos do profissional...'),
        emptyLabel: tl('No attachments or documents found for this professional yet.', 'Nenhum anexo ou documento encontrado para este profissional ainda.'),
      },
    },
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
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'people',
    schema: 'public',
    tenantScoped: true,
    archetype: 'person',
    archetypeKind: 'supplier',
    filters: { kind: 'supplier' },
    defaults: { kind: 'supplier' },
  },
}

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
    { key: 'phone', label: tl('Phone', 'Telefone'), type: 'phone', showInTable: true, searchable: true },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea', showInTable: false },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'people',
    schema: 'public',
    tenantScoped: true,
    archetype: 'person',
    archetypeKind: 'contact',
    filters: { kind: 'contact' },
    defaults: { kind: 'contact' },
    searchColumns: ['name', 'email', 'phone'],
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
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'people',
    schema: 'public',
    tenantScoped: true,
    archetype: 'person',
    archetypeKind: 'partner',
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
    schema: 'public',
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
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'categories',
    schema: 'public',
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
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'categories',
    schema: 'public',
    tenantScoped: true,
    filters: { kind: 'service_category' },
    defaults: { kind: 'service_category' },
  },
}

// ---------------------------------------------------------------------------
// Service Locations — location archetype, direct query
// ---------------------------------------------------------------------------
export const serviceLocationEntity: EntityDef = {
  name: tl('Service Location', 'Local de Atendimento'),
  namePlural: tl('Service Locations', 'Locais de Atendimento'),
  icon: 'MapPin',
  layout: 'location',
  displayField: 'name',
  subtitleField: 'city',
  defaultSort: 'name',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'phone', label: tl('Phone', 'Telefone'), type: 'phone', showInTable: true },
    { key: 'city', label: tl('City', 'Cidade'), type: 'text', showInTable: true, searchable: true },
    { key: 'state', label: tl('State', 'Estado'), type: 'text', showInTable: true },
    { key: 'address', label: tl('Address', 'Endereço'), type: 'text' },
    { key: 'country', label: tl('Country', 'País'), type: 'text', defaultValue: 'BR' },
    { key: 'postalCode', label: tl('Postal Code', 'CEP'), type: 'text' },
    { key: 'email', label: 'E-mail', type: 'email' },
    { key: 'isHeadquarters', label: tl('Headquarters', 'Matriz'), type: 'boolean', showInTable: true, defaultValue: false },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea' },
  ],
  data: {
    table: 'locations',
    schema: 'public',
    tenantScoped: true,
    filters: { kind: 'branch' },
    defaults: { kind: 'branch' },
    searchColumns: ['name', 'city', 'state'],
  },
}

// ---------------------------------------------------------------------------
// Location Groups — category archetype, direct query
// ---------------------------------------------------------------------------
export const locationGroupEntity: EntityDef = {
  name: tl('Location Group', 'Grupo de Locais'),
  namePlural: tl('Location Groups', 'Grupos de Locais'),
  icon: 'Map',
  displayField: 'name',
  defaultSort: 'sortOrder',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'description', label: tl('Description', 'Descrição'), type: 'textarea' },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0 },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'categories',
    schema: 'public',
    tenantScoped: true,
    filters: { kind: 'location_group' },
    defaults: { kind: 'location_group' },
    searchColumns: ['name', 'description'],
  },
}

// ---------------------------------------------------------------------------
// Appointment cancellation reasons — agenda settings registry
// ---------------------------------------------------------------------------
export const appointmentCancellationReasonEntity: EntityDef = {
  name: tl('Cancellation Reason', 'Motivo de Cancelamento'),
  namePlural: tl('Cancellation Reasons', 'Motivos de Cancelamento'),
  icon: 'Ban',
  displayField: 'name',
  defaultSort: 'sortOrder',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'description', label: tl('Description', 'Descrição'), type: 'textarea' },
    { key: 'requiresNotes', label: tl('Require Notes', 'Exigir observação'), type: 'boolean', showInTable: true, defaultValue: false },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0 },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'appointment_cancellation_reasons',
    tenantScoped: true,
  },
}

// ---------------------------------------------------------------------------
// Appointment confirmation channels — agenda settings registry
// ---------------------------------------------------------------------------
export const appointmentConfirmationChannelEntity: EntityDef = {
  name: tl('Confirmation Channel', 'Canal de Confirmação'),
  namePlural: tl('Confirmation Channels', 'Canais de Confirmação'),
  icon: 'MessageCircle',
  displayField: 'name',
  defaultSort: 'sortOrder',
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'channel', label: tl('Channel', 'Canal'), type: 'select', options: ['whatsapp', 'sms', 'email', 'phone'], required: true, showInTable: true, defaultValue: 'whatsapp' },
    { key: 'template', label: tl('Message Template', 'Modelo da Mensagem'), type: 'textarea' },
    { key: 'sendOffsetHours', label: tl('Send Before (hours)', 'Enviar antes (horas)'), type: 'number', showInTable: true, defaultValue: 24 },
    { key: 'retryOffsetHours', label: tl('Retry Before (hours)', 'Repetir antes (horas)'), type: 'number' },
    { key: 'isDefault', label: tl('Default', 'Padrão'), type: 'boolean', showInTable: true, defaultValue: false, inlineToggle: true },
    { key: 'sortOrder', label: tl('Order', 'Ordem'), type: 'number', showInTable: true, defaultValue: 0 },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'appointment_confirmation_channels',
    tenantScoped: true,
  },
}

// ---------------------------------------------------------------------------
// Appointment schedule rules — agenda settings registry
// ---------------------------------------------------------------------------
export const appointmentScheduleRuleEntity: EntityDef = {
  name: tl('Schedule Rule', 'Regra de Agenda'),
  namePlural: tl('Schedule Rules', 'Regras de Agenda'),
  icon: 'Clock3',
  displayField: 'name',
  defaultSort: 'name',
  fieldGroups: [
    { id: 'window', label: tl('Booking Window', 'Janela de Agendamento'), columns: 2 },
    { id: 'rules', label: tl('Rules', 'Regras'), columns: 3 },
  ],
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, showInTable: true, searchable: true },
    { key: 'scope', label: tl('Scope', 'Escopo'), type: 'select', options: ['tenant', 'location', 'professional'], required: true, showInTable: true, defaultValue: 'tenant' },
    { key: 'startTime', label: tl('Start Time', 'Hora Inicial'), type: 'text', required: true, showInTable: true, defaultValue: '08:00', group: 'window' },
    { key: 'endTime', label: tl('End Time', 'Hora Final'), type: 'text', required: true, showInTable: true, defaultValue: '20:00', group: 'window' },
    { key: 'slotDurationMinutes', label: tl('Slot (min)', 'Intervalo (min)'), type: 'number', required: true, showInTable: true, defaultValue: 30, group: 'rules' },
    { key: 'bufferMinutes', label: tl('Buffer (min)', 'Intervalo entre atendimentos'), type: 'number', defaultValue: 15, group: 'rules' },
    { key: 'minAdvanceHours', label: tl('Minimum Advance (hours)', 'Antecedência mínima (horas)'), type: 'number', defaultValue: 2, group: 'rules' },
    { key: 'maxAdvanceDays', label: tl('Maximum Advance (days)', 'Antecedência máxima (dias)'), type: 'number', defaultValue: 30, group: 'rules' },
    { key: 'maxConcurrent', label: tl('Concurrent Bookings', 'Agendamentos simultâneos'), type: 'number', defaultValue: 1, group: 'rules' },
    { key: 'allowOnlineBooking', label: tl('Online Booking', 'Agendamento Online'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
  ],
  data: {
    table: 'appointment_schedule_rules',
    tenantScoped: true,
  },
}

// ---------------------------------------------------------------------------
// Appointment waitlist — app-owned agenda triage list
// ---------------------------------------------------------------------------
export const appointmentWaitlistEntryEntity: EntityDef = {
  name: tl('Waitlist Entry', 'Entrada da Lista de Espera'),
  namePlural: tl('Waitlist', 'Lista de Espera'),
  icon: 'ListPlus',
  displayField: 'requestedDate',
  defaultSort: 'requestedDate',
  defaultSortDir: 'asc',
  fieldGroups: [
    { id: 'request', label: tl('Request', 'Solicitação'), columns: 2 },
    { id: 'followup', label: tl('Follow-up', 'Acompanhamento'), columns: 2 },
  ],
  fields: [
    {
      key: 'clientId',
      label: tl('Client', 'Cliente'),
      type: 'relation',
      relation: { table: 'people', schema: 'public', labelField: 'name', filter: { kind: 'customer' } },
      showInTable: true,
      group: 'request',
    },
    {
      key: 'professionalId',
      label: tl('Professional', 'Profissional'),
      type: 'relation',
      relation: { table: 'people', schema: 'public', labelField: 'name', filter: { kind: 'staff' } },
      showInTable: true,
      group: 'request',
    },
    {
      key: 'serviceId',
      label: tl('Service', 'Serviço'),
      type: 'relation',
      relation: { table: 'services', schema: 'public', labelField: 'name' },
      showInTable: true,
      group: 'request',
    },
    { key: 'requestedDate', label: tl('Requested Date', 'Data desejada'), type: 'datetime', showInTable: true, group: 'request' },
    { key: 'preferredStartTime', label: tl('Preferred Start', 'Início preferido'), type: 'time', group: 'request' },
    { key: 'preferredEndTime', label: tl('Preferred End', 'Fim preferido'), type: 'time', group: 'request' },
    { key: 'priority', label: tl('Priority', 'Prioridade'), type: 'number', showInTable: true, defaultValue: 0, group: 'followup' },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'waiting', label: tl('Waiting', 'Aguardando') },
        { value: 'contacted', label: tl('Contacted', 'Contatado') },
        { value: 'scheduled', label: tl('Scheduled', 'Agendado') },
        { value: 'cancelled', label: tl('Cancelled', 'Cancelado') },
      ],
      showInTable: true,
      defaultValue: 'waiting',
      group: 'followup',
    },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea', showInTable: true, searchable: true, group: 'followup', span: 2 },
  ],
  facets: [{ field: 'status', allLabel: tl('All statuses', 'Todos os status') }],
  data: {
    table: 'appointment_waitlist_entries',
    tenantScoped: true,
    searchColumns: ['notes', 'status'],
  },
}
