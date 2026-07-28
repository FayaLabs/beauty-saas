import type { EntityDef } from '@fayz-ai/saas'
import { createClientOrdersProvider } from '@fayz-ai/saas'
import { createElement } from 'react'
import { ClientCareProfileTab } from '../components/clients/ClientCareProfileTab'
import { ClientFinancialStatementTab } from '../components/clients/ClientFinancialStatementTab'
import { ClientOrdersCanonicalTab } from '../components/clients/ClientOrdersCanonicalTab'
import { ClientTimelineTab } from '../components/clients/ClientTimelineTab'
import { tl } from '../i18n/tl'

export interface BeautyClient {
  id: string
  name: string
  email: string
  phone: string
  dateOfBirth: string
  gender: string
  origin: string
  lifecycleStatus: string
  stage: string
  anamnesisNotes: string
  statusAlert: string
  hasAnamnesisAlert: boolean
  visits: number
  totalSpent: number
  lastVisit: string
}

const lifecycleStatusOptions = [
  { value: 'active', label: tl('Active', 'Ativo'), className: 'bg-success/10 text-success border-success/20' },
  { value: 'vip', label: 'VIP', className: 'bg-magic/10 text-magic border-magic/20' },
  { value: 'inactive', label: tl('Inactive', 'Inativo'), className: 'bg-muted text-muted-foreground border-border' },
  { value: 'restricted', label: tl('Restricted', 'Restrito'), className: 'bg-destructive/10 text-destructive border-destructive/20' },
]

const relationshipStageOptions = [
  { value: 'new', label: tl('New', 'Novo'), className: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'returning', label: tl('Returning', 'Recorrente'), className: 'bg-info/10 text-info border-info/20' },
  { value: 'loyal', label: tl('Loyal', 'Fidelizado'), className: 'bg-success/10 text-success border-success/20' },
  { value: 'at_risk', label: tl('At Risk', 'Em risco'), className: 'bg-warning/10 text-warning border-warning/20' },
]

function renderPill(options: typeof lifecycleStatusOptions, value: unknown) {
  const text = String(value ?? '')
  const option = options.find((item) => item.value === text)
  return createElement(
    'span',
    {
      className: `inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${option?.className ?? 'bg-muted text-muted-foreground border-border'}`,
    },
    option?.label ?? (text || '—'),
  )
}

function renderCareAlert(value: unknown, row: unknown) {
  const client = (row ?? {}) as Partial<BeautyClient>
  const hasAlert = Boolean(value || client.statusAlert)
  if (!hasAlert) return createElement('span', { className: 'text-muted-foreground' }, '—')

  return createElement(
    'span',
    {
      className: 'inline-flex items-center rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning',
      title: client.statusAlert || client.anamnesisNotes || undefined,
    },
    tl('Care alert', 'Alerta'),
  )
}

// ---------------------------------------------------------------------------
// Clients — person archetype + extension table (public.clients)
// ---------------------------------------------------------------------------
export const clientEntity: EntityDef<BeautyClient> = {
  name: tl('Client', 'Cliente'),
  icon: 'Users',
  layout: 'person',
  // Plan cap key — central CRUD chokepoint enforces the `clients` limit here.
  limitKey: 'clients',
  displayField: 'name',
  subtitleField: 'email',
  defaultSort: 'name',
  fieldGroups: [
    { id: 'personal', label: tl('Personal Details', 'Dados Pessoais'), columns: 2 },
    { id: 'care', label: tl('Care Profile', 'Perfil de Atendimento'), columns: 2 },
    { id: 'stats', label: tl('Statistics', 'Estatísticas'), description: tl('Auto-calculated from activity', 'Calculado automaticamente pela atividade'), columns: 3 },
  ],
  fields: [
    { key: 'name', label: tl('Name', 'Nome'), type: 'text', required: true, searchable: true, showInTable: true },
    { key: 'email', label: 'E-mail', type: 'email', required: true, searchable: true, showInTable: true },
    { key: 'phone', label: tl('Phone', 'Telefone'), type: 'phone', showInTable: true },
    { key: 'dateOfBirth', label: tl('Birth Date', 'Data de Nascimento'), type: 'date' },
    { key: 'notes', label: tl('Notes', 'Observações'), type: 'textarea', showInTable: false },
    { key: 'isActive', label: tl('Active', 'Ativo'), type: 'boolean', showInTable: true, defaultValue: true, inlineToggle: true },
    { key: 'gender', label: tl('Gender', 'Gênero'), type: 'select', options: ['male', 'female', 'other', 'prefer_not_to_say'], group: 'personal', showInTable: false },
    { key: 'origin', label: tl('Origin', 'Origem'), type: 'text', group: 'personal', placeholder: tl('How did they find us?', 'Como nos encontrou?'), showInTable: false },
    {
      key: 'lifecycleStatus',
      label: tl('Client Status', 'Status do Cliente'),
      type: 'select',
      options: lifecycleStatusOptions.map(({ value, label }) => ({ value, label })),
      group: 'care',
      showInTable: true,
      defaultValue: 'active',
      renderCell: (value) => renderPill(lifecycleStatusOptions, value),
    },
    {
      key: 'stage',
      label: tl('Relationship Stage', 'Etapa de Relacionamento'),
      type: 'select',
      options: relationshipStageOptions.map(({ value, label }) => ({ value, label })),
      group: 'care',
      showInTable: true,
      defaultValue: 'new',
      renderCell: (value) => renderPill(relationshipStageOptions, value),
    },
    { key: 'statusAlert', label: tl('Status Alert', 'Alerta do Cliente'), type: 'textarea', group: 'care', showInTable: false, placeholder: tl('Operational alert shown before service', 'Alerta operacional para consultar antes do atendimento') },
    { key: 'anamnesisNotes', label: tl('Anamnesis Notes', 'Anamnese'), type: 'textarea', group: 'care', showInTable: false, placeholder: tl('Allergies, contraindications, preferences, and service notes', 'Alergias, contraindicações, preferências e observações de atendimento') },
    { key: 'hasAnamnesisAlert', label: tl('Care Alert', 'Alerta'), type: 'boolean', group: 'care', showInTable: true, defaultValue: false, inlineToggle: true, renderCell: renderCareAlert },
    { key: 'visits', label: tl('Visits', 'Visitas'), type: 'number', showInForm: false, showInTable: true, group: 'stats' },
    { key: 'totalSpent', label: tl('Total Spent', 'Total Gasto'), type: 'currency', showInForm: false, showInTable: true, group: 'stats' },
    { key: 'lastVisit', label: tl('Last Visit', 'Última Visita'), type: 'date', showInForm: false, showInTable: false, group: 'stats' },
  ],
  facets: [
    { field: 'lifecycleStatus', allLabel: tl('All client statuses', 'Todos os status') },
    { field: 'stage', allLabel: tl('All stages', 'Todas as etapas') },
  ],
  detailTabs: [
    {
      id: 'care',
      label: tl('Care Profile', 'Perfil de Atendimento'),
      icon: 'Shield',
      component: ClientCareProfileTab as never,
    },
    {
      id: 'orders',
      label: tl('Orders', 'Pedidos'),
      icon: 'ShoppingBag',
      aliases: ['appointments', 'quotes'],
      component: ClientOrdersCanonicalTab as never,
      props: {
        provider: createClientOrdersProvider(),
        currency: { code: 'BRL', locale: 'pt-BR' },
        onBookingClick: (orderId: string) => {
          window.location.hash = '/agenda'
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('agenda:open-booking', { detail: { bookingId: orderId } }))
          }, 100)
        },
        onInvoiceClick: (orderId: string) => {
          window.location.hash = `/financial/receivables/detail/${orderId}`
        },
      },
    },
    {
      id: 'timeline',
      label: tl('Timeline', 'Linha do Tempo'),
      icon: 'Clock',
      aliases: ['activity'],
      component: ClientTimelineTab as never,
    },
    {
      id: 'activity',
      label: tl('Activity', 'Atividade'),
      hidden: true,
    },
    // Documents tab intentionally omitted: the `person` archetype already
    // provides it, rendering the custom_forms plugin's PersonDocumentsWidget
    // (list + create-from-template + fill + archive) — the single shared
    // documents concept across every app. Overriding it here is what hid the
    // "new from template" flow that school-saas has by default.
    {
      id: 'financial',
      label: tl('Statement', 'Extrato'),
      icon: 'DollarSign',
      aliases: ['statement', 'ledger', 'extract'],
      component: ClientFinancialStatementTab as never,
    },
  ],
  data: {
    table: 'clients',
    tenantScoped: true,
    archetype: 'person',
    archetypeKind: 'customer',
    searchColumns: ['name', 'email', 'phone'],
  },
}
