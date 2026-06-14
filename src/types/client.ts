import type { EntityDef } from '@fayz-ai/core'
import { ClientOrdersTab, createClientOrdersProvider } from '@fayz-ai/saas'
import { tl } from '../i18n/tl'

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
  name: tl('Client', 'Cliente'),
  icon: 'Users',
  layout: 'person',
  displayField: 'name',
  subtitleField: 'email',
  defaultSort: 'name',
  fieldGroups: [
    { id: 'personal', label: tl('Personal Details', 'Dados Pessoais'), columns: 2 },
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
    { key: 'visits', label: tl('Visits', 'Visitas'), type: 'number', showInForm: false, showInTable: true, group: 'stats' },
    { key: 'totalSpent', label: tl('Total Spent', 'Total Gasto'), type: 'currency', showInForm: false, showInTable: true, group: 'stats' },
    { key: 'lastVisit', label: tl('Last Visit', 'Última Visita'), type: 'date', showInForm: false, showInTable: false, group: 'stats' },
  ],
  detailTabs: [
    {
      id: 'orders',
      label: tl('Orders', 'Pedidos'),
      icon: 'ShoppingBag',
      component: ClientOrdersTab as never,
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
  ],
  data: {
    table: 'clients',
    tenantScoped: true,
    archetype: 'person',
    archetypeKind: 'customer',
    searchColumns: ['name', 'email', 'phone'],
  },
}
