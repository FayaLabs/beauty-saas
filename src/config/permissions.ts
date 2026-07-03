import { tl } from '../i18n/tl'
import type { BeautyPermissions, BeautyPermissionFeature, PermissionAction } from '../types/sdk-contract'

// ---------------------------------------------------------------------------
// Granular, per-submodule permission taxonomy for a beauty salon.
//
// The old model shipped ONE coarse permission per plugin (financial, inventory…)
// grouped under a near-duplicate group name — which read as nonsense in the
// matrix. This replaces it with submodule-level features grouped by module:
// e.g. "Financeiro" now fans out into Contas a Receber / a Pagar / Caixa /
// Extrato / Comissões / Cartões / Conciliação / Configurações.
//
// Convention: each feature `id` is the DB permission CATEGORY (permissions.id is
// `category.action`). A module also keeps a coarse access leaf (e.g. `financial`)
// because plugins gate their NAV/route on `{feature:'financial', action:'read'}`;
// the submodule leaves refine access WITHIN the module. A role that can open a
// module must hold its module-access `.read` leaf.
//
// Only submodules for modules ACTIVE in this app appear here (recipes/batch
// tracking are off in beauty, so they are intentionally absent).
// ---------------------------------------------------------------------------

const G = {
  core: tl('Overview', 'Painel'),
  agenda: tl('Agenda', 'Agenda'),
  clients: tl('Clients', 'Clientes'),
  registry: tl('Registry', 'Cadastros'),
  inventory: tl('Inventory', 'Estoque'),
  sales: tl('Sales', 'Vendas'),
  financial: tl('Financial', 'Financeiro'),
  marketing: 'Marketing',
  reports: tl('Reports', 'Relatórios'),
}

const f = (id: string, label: string, group: string): BeautyPermissionFeature => ({ id, label, group })

const features: BeautyPermissionFeature[] = [
  // Overview
  f('dashboard', tl('Dashboard', 'Painel'), G.core),

  // Agenda
  f('appointments', tl('Calendar', 'Agenda'), G.agenda),
  f('agenda_waitlist', tl('Waitlist', 'Lista de Espera'), G.agenda),
  f('agenda_schedules', tl('Working Hours', 'Horários de Trabalho'), G.agenda),
  f('agenda_settings', tl('Agenda Settings', 'Configurações da Agenda'), G.agenda),

  // Clients
  f('clients', tl('Clients', 'Clientes'), G.clients),

  // Registry (service catalog)
  f('services', tl('Services', 'Serviços'), G.registry),

  // Inventory
  f('inventory', tl('Inventory (access)', 'Estoque (acesso)'), G.inventory),
  f('inv_products', tl('Products', 'Produtos'), G.inventory),
  f('inv_stock', tl('Stock Movements', 'Movimentações'), G.inventory),
  f('inv_settings', tl('Inventory Registry', 'Cadastros de Estoque'), G.inventory),

  // Sales / CRM
  f('sales', tl('Sales (access)', 'Vendas (acesso)'), G.sales),
  f('crm_pipeline', tl('Pipeline', 'Funil de Vendas'), G.sales),
  f('crm_leads', 'Leads', G.sales),
  f('crm_quotes', tl('Quotes', 'Orçamentos'), G.sales),
  f('crm_activities', tl('Activities', 'Atividades'), G.sales),

  // Financial
  f('financial', tl('Financial (access)', 'Financeiro (acesso)'), G.financial),
  f('fin_receivables', tl('Accounts Receivable', 'Contas a Receber'), G.financial),
  f('fin_payables', tl('Accounts Payable', 'Contas a Pagar'), G.financial),
  f('fin_cashbox', tl('Cash Register', 'Caixa'), G.financial),
  f('fin_statements', tl('Statements', 'Extrato'), G.financial),
  f('fin_commissions', tl('Commissions', 'Comissões'), G.financial),
  f('fin_cards', tl('Cards', 'Cartões'), G.financial),
  f('fin_reconciliation', tl('Reconciliation', 'Conciliação'), G.financial),
  f('fin_settings', tl('Financial Registry', 'Cadastros Financeiros'), G.financial),

  // Marketing
  f('marketing', tl('Marketing (access)', 'Marketing (acesso)'), G.marketing),
  f('mkt_campaigns', tl('Campaigns', 'Campanhas'), G.marketing),
  f('mkt_channels', tl('Channels', 'Canais'), G.marketing),
  f('mkt_funnel', tl('Funnel', 'Funil'), G.marketing),

  // Reports
  f('reports', tl('Reports (access)', 'Relatórios (acesso)'), G.reports),
  f('reports_operations', tl('Operational Reports', 'Relatórios Operacionais'), G.reports),
  f('reports_financial', tl('Financial Reports', 'Relatórios Financeiros'), G.reports),
  f('reports_clients', tl('Client Reports', 'Relatórios de Clientes'), G.reports),
]

// ---------------------------------------------------------------------------
// Grant helpers — keep the role matrix readable.
// ---------------------------------------------------------------------------
const R: PermissionAction[] = ['read']
const RC: PermissionAction[] = ['read', 'create']
const RCE: PermissionAction[] = ['read', 'create', 'edit']
const RCED: PermissionAction[] = ['read', 'create', 'edit', 'delete']
const RE: PermissionAction[] = ['read', 'edit']

// Full business grant set (used by Proprietário/Administrador).
const ALL_BUSINESS: Record<string, PermissionAction[]> = {
  dashboard: R,
  appointments: RCED, agenda_waitlist: RCE, agenda_schedules: RE, agenda_settings: RCED,
  clients: RCED,
  services: RCED,
  inventory: R, inv_products: RCED, inv_stock: RCE, inv_settings: RCED,
  sales: R, crm_pipeline: RE, crm_leads: RCED, crm_quotes: RCED, crm_activities: RCE,
  financial: R, fin_receivables: RCED, fin_payables: RCED, fin_cashbox: RCE, fin_statements: R,
  fin_commissions: RCE, fin_cards: RCE, fin_reconciliation: RE, fin_settings: RCED,
  marketing: R, mkt_campaigns: RCED, mkt_channels: RE, mkt_funnel: R,
  reports: R, reports_operations: R, reports_financial: R, reports_clients: R,
}

export const beautyPermissions: BeautyPermissions = {
  features,
  defaultProfiles: [
    {
      id: 'owner',
      name: tl('Owner', 'Proprietário'),
      description: tl('Full access to everything, including billing.', 'Acesso total, incluindo cobrança.'),
      isSystem: true,
      systemPermissions: ['manage_team', 'manage_billing', 'manage_settings', 'manage_permissions'],
      grants: ALL_BUSINESS,
    },
    {
      id: 'administrador',
      name: tl('Administrator', 'Administrador'),
      description: tl('Runs the salon day-to-day — all modules, team and settings.', 'Gerencia o salão no dia a dia — todos os módulos, equipe e configurações.'),
      isSystem: true,
      systemPermissions: ['manage_team', 'manage_settings', 'manage_permissions'],
      grants: ALL_BUSINESS,
    },
    {
      id: 'secretaria',
      name: tl('Receptionist', 'Secretária'),
      description: tl('Front desk — scheduling, clients, checkout and cash register.', 'Recepção — agenda, clientes, recebimentos e caixa.'),
      isSystem: true,
      systemPermissions: [],
      grants: {
        dashboard: R,
        appointments: RCED, agenda_waitlist: RCE, agenda_schedules: R, agenda_settings: R,
        clients: RCED,
        services: R,
        inventory: R, inv_products: R,
        sales: R, crm_leads: RC, crm_quotes: RC,
        financial: R, fin_receivables: RC, fin_cashbox: RCE, fin_statements: R,
        reports: R, reports_operations: R,
      },
    },
    {
      id: 'profissional',
      name: tl('Professional', 'Profissional'),
      description: tl('Stylist — own agenda, client and service lookups.', 'Profissional — agenda própria e consulta de clientes e serviços.'),
      isSystem: true,
      systemPermissions: [],
      grants: {
        dashboard: R,
        appointments: RCE,
        clients: R,
        services: R,
      },
    },
    {
      id: 'marketing',
      name: 'Marketing',
      description: tl('Campaigns, channels and audience reports.', 'Campanhas, canais e relatórios de público.'),
      isSystem: true,
      systemPermissions: [],
      grants: {
        dashboard: R,
        appointments: R,
        clients: R,
        marketing: R, mkt_campaigns: RCED, mkt_channels: RE, mkt_funnel: R,
        reports: R, reports_operations: R, reports_clients: R,
      },
    },
    {
      id: 'financeiro',
      name: tl('Finance', 'Financeiro'),
      description: tl('Owns the financial module and financial reporting.', 'Responsável pelo módulo financeiro e relatórios financeiros.'),
      isSystem: true,
      systemPermissions: [],
      grants: {
        dashboard: R,
        clients: R,
        financial: R, fin_receivables: RCED, fin_payables: RCED, fin_cashbox: RCE, fin_statements: R,
        fin_commissions: RCE, fin_cards: RCE, fin_reconciliation: RE, fin_settings: RE,
        reports: R, reports_financial: R, reports_operations: R,
      },
    },
  ],
}
