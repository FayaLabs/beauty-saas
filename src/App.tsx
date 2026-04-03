import { createSaasApp, createCrudPage, createArchetypeLookup } from '@fayz/saas-core'
import { createFinancialPlugin, createSafeFinancialProvider } from '@fayz/saas-core/plugins/financial'
import { createInventoryPlugin } from '@fayz/saas-core/plugins/inventory'
import { createCrmPlugin } from '@fayz/saas-core/plugins/crm'
import { createAgendaPlugin, createFinancialBridge } from '@fayz/saas-core/plugins/agenda'
import { createReportsPlugin } from '@fayz/saas-core/plugins/reports'
import { createCustomFormsPlugin } from '@fayz/saas-core/plugins/custom_forms'
import { createDashboardPlugin } from '@fayz/saas-core/plugins/dashboard'
import { createTasksPlugin } from '@fayz/saas-core/plugins/tasks'

import { Logo } from './components/Logo'
import { TodayScheduleSection } from './pages/dashboard/TodayScheduleSection'
import { QuickActionsSection } from './pages/dashboard/QuickActionsSection'
import { serviceEntity } from './types/service'
import { clientEntity } from './types/client'
import { contactEntity, staffEntity, supplierEntity, originEntity, partnershipEntity, equipmentEntity, bankAccountEntity, serviceCategoryEntity } from './types/registry'
import { createPlaceholder } from './pages/Placeholder'
import { Sales } from './pages/Sales'
import { beautyTheme } from './theme'
import { appTranslations } from './i18n'
import { tl } from './i18n/tl'
import React from 'react'

export const App = createSaasApp({
  name: 'BeautySoft',
  logo: React.createElement(Logo),
  layout: 'topbar',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  locale: {
    default: 'pt-BR',
    supported: ['en', 'pt-BR'],
    translations: appTranslations,
  },
  auth: {
    adapter: import.meta.env.VITE_SUPABASE_URL ? 'supabase' : 'mock',
    requireAuth: true,
    loginLayout: 'split',
    loginTagline: tl('Manage your salon with confidence', 'Gerencie seu salão com confiança'),
    loginDescription: tl(
      'Scheduling, client management, financial tracking, and marketing — all in one beautiful platform built for beauty professionals.',
      'Agendamento, gestão de clientes, controle financeiro e marketing — tudo em uma plataforma feita para profissionais de beleza.',
    ),
    showOAuth: true,
    oauthProviders: ['google'],
  },
  organization: { adapter: import.meta.env.VITE_SUPABASE_URL ? 'supabase' : 'mock', multiOrg: true },
  permissions: {
    features: [
      { id: 'dashboard', label: tl('Dashboard', 'Painel'), group: tl('Core', 'Principal') },
      { id: 'appointments', label: tl('Agenda', 'Agenda'), group: tl('Operations', 'Operações') },
      { id: 'clients', label: tl('Clients', 'Clientes'), group: tl('Operations', 'Operações') },
      { id: 'services', label: tl('Services', 'Serviços'), group: tl('Operations', 'Operações') },
      { id: 'inventory', label: tl('Inventory', 'Estoque'), group: tl('Operations', 'Operações') },
      { id: 'marketing', label: 'Marketing', group: 'Marketing' },
      { id: 'sales', label: tl('Sales', 'Vendas'), group: tl('Sales', 'Vendas') },
      { id: 'financial', label: tl('Financial', 'Financeiro'), group: tl('Finance', 'Finanças') },
      { id: 'reports', label: tl('Reports', 'Relatórios'), group: tl('Analytics', 'Análises') },
    ],
    defaultProfiles: [
      {
        id: 'owner',
        name: tl('Owner', 'Proprietário'),
        isSystem: true,
        systemPermissions: ['manage_team', 'manage_billing', 'manage_settings', 'manage_permissions'],
        grants: {
          dashboard: ['read'],
          appointments: ['read', 'create', 'edit', 'delete'],
          clients: ['read', 'create', 'edit', 'delete'],
          services: ['read', 'create', 'edit', 'delete'],
          inventory: ['read', 'create', 'edit', 'delete'],
          marketing: ['read', 'create', 'edit', 'delete'],
          sales: ['read', 'create', 'edit', 'delete'],
          financial: ['read', 'create', 'edit', 'delete'],
          reports: ['read'],
        },
      },
      {
        id: 'stylist',
        name: tl('Stylist', 'Estilista'),
        isSystem: true,
        systemPermissions: [],
        grants: {
          dashboard: ['read'],
          appointments: ['read', 'create', 'edit'],
          clients: ['read'],
          services: ['read'],
        },
      },
      {
        id: 'receptionist',
        name: tl('Receptionist', 'Recepcionista'),
        isSystem: true,
        systemPermissions: [],
        grants: {
          dashboard: ['read'],
          appointments: ['read', 'create', 'edit'],
          clients: ['read', 'create', 'edit'],
          services: ['read'],
          financial: ['read'],
        },
      },
    ],
  },
  theme: beautyTheme,
  plugins: (() => {
    const productLookup = createArchetypeLookup({ archetype: 'product' })
    const serviceLookup = createArchetypeLookup({ archetype: 'service' })
    const contactLookup = createArchetypeLookup({
      archetype: 'person',
      kind: ['customer', 'supplier', 'staff', 'lead'],
      kindLabels: {
        customer: tl('Client', 'Cliente'),
        supplier: tl('Supplier', 'Fornecedor'),
        staff: tl('Professional', 'Profissional'),
        lead: 'Lead',
      },
    })

    const professionalLookup = createArchetypeLookup({
      archetype: 'person',
      kind: ['staff'],
      kindLabels: { staff: tl('Professional', 'Profissional') },
    })

    const financialProvider = createSafeFinancialProvider()
    const financialBridge = createFinancialBridge(financialProvider)

    return [
      createDashboardPlugin({
        navIcon: 'Home',
        labels: {
          pageTitle: tl('Dashboard', 'Painel'),
          pageSubtitle: tl('Business overview', 'Visão geral do seu negócio'),
          kpiTitle: tl('Key Metrics', 'Métricas'),
          onboardingTitle: tl('Getting Started', 'Primeiros Passos'),
          onboardingSubtitle: tl('Set up your salon', 'Configure seu salão'),
          settingsTitle: tl('Dashboard', 'Painel'),
        },
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        metrics: [
          // --- Active by default ---
          {
            id: 'appointments-today',
            label: tl("Today's Appointments", 'Agendamentos Hoje'),
            description: tl(
              'Total scheduled appointments for today. Helps you plan staffing and anticipate workload.',
              'Total de agendamentos para hoje. Ajuda a planejar equipe e antecipar demanda.',
            ),
            icon: 'Calendar',
            category: 'operations',
            format: 'number',
            defaultVisible: true,
            defaultOrder: 0,
            compute: async () => ({ value: 12, previousValue: 10, trend: 'up' }),
          },
          {
            id: 'revenue-week',
            label: tl('Revenue (This Week)', 'Receita (Semana)'),
            description: tl(
              'Gross revenue for the current week compared to last week. Key indicator of business health.',
              'Receita bruta da semana atual comparada com a anterior. Indicador-chave de saúde do negócio.',
            ),
            icon: 'DollarSign',
            category: 'revenue',
            format: 'currency',
            defaultVisible: true,
            defaultOrder: 1,
            compute: async () => ({ value: 3240, previousValue: 2817, trend: 'up' }),
          },
          {
            id: 'active-clients',
            label: tl('Active Clients', 'Clientes Ativos'),
            description: tl(
              'Clients who visited in the last 90 days. Industry benchmark: 60-70% retention rate.',
              'Clientes que visitaram nos últimos 90 dias. Benchmark: taxa de retenção de 60-70%.',
            ),
            icon: 'Users',
            category: 'clients',
            format: 'number',
            defaultVisible: true,
            defaultOrder: 2,
            compute: async () => ({ value: 148, previousValue: 140, trend: 'up' }),
          },
          {
            id: 'avg-rating',
            label: tl('Avg. Rating', 'Avaliação Média'),
            description: tl(
              'Average client satisfaction score. Top salons maintain 4.7+ consistently.',
              'Nota média de satisfação. Salões de destaque mantêm 4.7+ consistentemente.',
            ),
            icon: 'Star',
            category: 'custom',
            format: 'number',
            defaultVisible: true,
            defaultOrder: 3,
            compute: async () => ({ value: 4.9, trend: 'neutral' }),
          },
          // --- Disabled by default (industry KPIs users can enable) ---
          {
            id: 'avg-ticket',
            label: tl('Avg. Ticket', 'Ticket Médio'),
            description: tl(
              'Average revenue per appointment. Increase it by upselling products or bundling services.',
              'Receita média por atendimento. Aumente com venda de produtos ou combos de serviços.',
            ),
            icon: 'Receipt',
            category: 'revenue',
            format: 'currency',
            defaultVisible: false,
            defaultOrder: 10,
            compute: async () => ({ value: 85, previousValue: 78, trend: 'up' }),
          },
          {
            id: 'occupancy-rate',
            label: tl('Occupancy Rate', 'Taxa de Ocupação'),
            description: tl(
              'Percentage of available slots that are booked. Industry benchmark: 75-85% is considered healthy.',
              'Percentual de horários disponíveis que estão reservados. Benchmark: 75-85% é saudável.',
            ),
            icon: 'Activity',
            category: 'operations',
            format: 'percent',
            defaultVisible: false,
            defaultOrder: 11,
            compute: async () => ({ value: 72, previousValue: 68, trend: 'up' }),
          },
          {
            id: 'no-show-rate',
            label: tl('No-Show Rate', 'Taxa de No-Show'),
            description: tl(
              'Percentage of confirmed appointments where clients did not show up. Keep below 10% with reminders.',
              'Percentual de agendamentos confirmados onde o cliente não compareceu. Mantenha abaixo de 10% com lembretes.',
            ),
            icon: 'UserX',
            category: 'operations',
            format: 'percent',
            defaultVisible: false,
            defaultOrder: 12,
            compute: async () => ({ value: 5, previousValue: 7, trend: 'down' }),
          },
          {
            id: 'new-clients-month',
            label: tl('New Clients (Month)', 'Clientes Novos (Mês)'),
            description: tl(
              'First-time clients this month. Healthy salons acquire 10-15% new clients relative to total base monthly.',
              'Clientes de primeira vez neste mês. Salões saudáveis adquirem 10-15% de novos clientes em relação à base total.',
            ),
            icon: 'UserPlus',
            category: 'clients',
            format: 'number',
            defaultVisible: false,
            defaultOrder: 13,
            compute: async () => ({ value: 18, previousValue: 14, trend: 'up' }),
          },
          {
            id: 'retention-rate',
            label: tl('Retention Rate', 'Taxa de Retenção'),
            description: tl(
              'Percentage of clients who return within 90 days. Industry gold standard: 60-70%.',
              'Percentual de clientes que retornam em 90 dias. Padrão ouro do setor: 60-70%.',
            ),
            icon: 'UserCheck',
            category: 'clients',
            format: 'percent',
            defaultVisible: false,
            defaultOrder: 14,
            compute: async () => ({ value: 64, previousValue: 61, trend: 'up' }),
          },
          {
            id: 'revenue-per-professional',
            label: tl('Revenue per Professional', 'Receita por Profissional'),
            description: tl(
              'Average revenue generated per staff member. Use to identify top performers and coaching opportunities.',
              'Receita média gerada por profissional. Use para identificar destaques e oportunidades de treinamento.',
            ),
            icon: 'TrendingUp',
            category: 'revenue',
            format: 'currency',
            defaultVisible: false,
            defaultOrder: 15,
            compute: async () => ({ value: 1080, previousValue: 940, trend: 'up' }),
          },
          {
            id: 'product-sales',
            label: tl('Product Sales', 'Venda de Produtos'),
            description: tl(
              'Revenue from retail product sales. Best practice: product revenue should be 15-20% of total revenue.',
              'Receita de venda de produtos. Boa prática: produtos devem representar 15-20% da receita total.',
            ),
            icon: 'ShoppingBag',
            category: 'revenue',
            format: 'currency',
            defaultVisible: false,
            defaultOrder: 16,
            compute: async () => ({ value: 420, previousValue: 380, trend: 'up' }),
          },
        ],
        sections: [
          {
            id: 'today-schedule',
            title: tl("Today's Schedule", 'Agenda de Hoje'),
            icon: 'Clock',
            zone: 'main',
            order: 0,
            component: TodayScheduleSection,
          },
          {
            id: 'quick-actions',
            title: tl('Quick Actions', 'Ações Rápidas'),
            icon: 'Zap',
            zone: 'bottom-right',
            order: 10,
            component: QuickActionsSection,
          },
        ],
        onboardingSteps: [
          {
            id: 'add-first-client',
            title: tl('Add your first client', 'Adicione seu primeiro cliente'),
            description: tl('Register a client to start managing your customer base', 'Cadastre um cliente para começar a gerenciar sua base'),
            icon: 'UserPlus',
            order: 0,
            check: async () => false,
            action: '/clients/new',
          },
          {
            id: 'register-services',
            title: tl('Register your services', 'Cadastre seus serviços'),
            description: tl('Add the services your salon offers', 'Adicione os serviços que seu salão oferece'),
            icon: 'Briefcase',
            order: 1,
            check: async () => false,
            action: '/registry/services',
          },
          {
            id: 'setup-schedule',
            title: tl('Set up your schedule', 'Configure sua agenda'),
            description: tl('Define business hours and booking rules', 'Defina horários de funcionamento e regras de agendamento'),
            icon: 'Calendar',
            order: 2,
            check: async () => false,
            action: '/settings/agenda',
          },
          {
            id: 'setup-payments',
            title: tl('Configure payments', 'Configure pagamentos'),
            description: tl('Add accepted payment methods', 'Adicione as formas de pagamento aceitas'),
            icon: 'CreditCard',
            order: 3,
            check: async () => false,
            action: '/settings/financial',
          },
        ],
      }),
      createAgendaPlugin({
        bookingKind: 'appointment',
        orderKind: 'service_order',
        scheduleKind: 'working_hours',
        professionalKind: 'staff',
        clientKind: 'customer',
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        labels: {
          pageTitle: tl('Agenda', 'Agenda'),
        },
        contactLookup,
        clientEntityDef: clientEntity,
        serviceLookup,
        professionalLookup,
        financialBridge,
        modules: { locationSelection: true },
        locationLookup: createArchetypeLookup({ archetype: 'location' }),
        businessHours: { startTime: '08:00', endTime: '20:00' },
        slotDuration: 30,
        scheduleBlockDefaults: {
          bufferMinutes: 15,
          maxConcurrent: 1,
          minAdvanceHours: 2,
          maxAdvanceDays: 30,
        },
        navPosition: 2,
        navSection: 'main',
        confirmationChannels: [
          { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
          { id: 'phone', label: tl('Phone', 'Telefone'), icon: 'Phone' },
        ],
      }),
      createFinancialPlugin({
        navPosition: 7,
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        entityLookups: { product: productLookup, service: serviceLookup },
        contactLookup,
        labels: {
          pageTitle: tl('Financial', 'Financeiro'),
          pageSubtitle: tl('Financial overview and cash flow management', 'Visão geral financeira e gestão de fluxo de caixa'),
          summary: tl('Summary', 'Resumo'),
          payables: tl('Accounts Payable', 'Contas a Pagar'),
          payablesNew: tl('New', 'Novo'),
          payablesList: tl('List', 'Lista'),
          payablesRecurring: tl('Recurring Expenses', 'Despesas Recorrentes'),
          receivables: tl('Accounts Receivable', 'Contas a Receber'),
          receivablesNew: tl('New', 'Novo'),
          receivablesList: tl('List', 'Lista'),
          cashRegisters: tl('Cash Registers', 'Caixas'),
          statements: tl('Statements', 'Extratos'),
          commissions: tl('Commissions', 'Comissões'),
          commissionsOverview: tl('Overview', 'Visão Geral'),
          commissionsRules: tl('Rules', 'Regras'),
          cards: tl('Cards', 'Cartões'),
          cardsOverview: tl('Overview', 'Visão Geral'),
          cardsReconciliation: tl('Reconciliation', 'Conciliação'),
        },
        onBookingClick: (orderId) => {
          // Navigate to agenda and open the booking modal
          window.location.hash = '/agenda'
          // Small delay to let the agenda page mount, then open the modal
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('agenda:open-booking', { detail: { bookingId: orderId } }))
          }, 100)
        },
      }),
      createInventoryPlugin({
        navPosition: 4,
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        modules: { recipes: false, batchTracking: false },
        productTypes: [
          { value: 'sale', label: tl('Retail Product', 'Produto de Varejo') },
          { value: 'ingredient', label: tl('Professional Supply', 'Insumo Profissional') },
        ],
        labels: {
          pageTitle: tl('Inventory', 'Estoque'),
          pageSubtitle: tl('Product catalog and stock control', 'Catálogo de produtos e controle de estoque'),
          products: tl('Products', 'Produtos'),
          stock: tl('Stock', 'Estoque'),
        },
      }),
      createCrmPlugin({
        navPosition: 6,
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        itemTypes: [
          { value: 'service', label: tl('Service', 'Serviço') },
          { value: 'product', label: tl('Product', 'Produto') },
        ],
        entityLookups: { product: productLookup, service: serviceLookup },
        contactLookup,
        labels: {
          pageTitle: tl('Sales', 'Vendas'),
          pageSubtitle: tl('CRM, leads, deals, and pipeline management', 'CRM, leads, negócios e gestão de pipeline'),
          dashboard: tl('Dashboard', 'Painel'),
          pipeline: 'Pipeline',
          leads: 'Leads',
          leadsNew: tl('New', 'Novo'),
          leadsList: tl('List', 'Lista'),
          deals: tl('Deals', 'Negócios'),
          quotes: tl('Quotes', 'Orçamentos'),
          quotesNew: tl('New', 'Novo'),
          quotesList: tl('List', 'Lista'),
          activities: tl('Activities', 'Atividades'),
        },
        clientConversion: {
          archetypeKind: 'customer',
          extensionTable: 'clients',
          fkColumn: 'person_id',
        },
      }),
      createReportsPlugin({
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        navPosition: 10,
        labels: {
          pageTitle: tl('Reports', 'Relatórios'),
          pageSubtitle: tl('Access complete reports for analysis and decision making', 'Acesse relatórios completos para análise e tomada de decisão'),
        },
        reports: [
          // --- Scheduling ---
          {
            id: 'appointments-by-period',
            name: tl('Appointments by Period', 'Agendamentos por Período'),
            description: tl('Complete appointment listing', 'Listagem completa de agendamentos'),
            icon: 'Calendar',
            category: tl('Scheduling & Agenda', 'Agendamentos & Agenda'),
            columns: [
              { key: 'date', label: tl('Date', 'Data'), type: 'date', sortable: true },
              { key: 'clientName', label: tl('Client', 'Cliente'), type: 'person', idKey: 'clientId' },
              { key: 'professionalName', label: tl('Professional', 'Profissional'), type: 'person', idKey: 'professionalId' },
              { key: 'serviceName', label: tl('Service', 'Serviço'), type: 'text' },
              { key: 'status', label: 'Status', type: 'select' },
              { key: 'revenue', label: tl('Revenue', 'Receita'), type: 'currency', aggregate: 'sum' },
            ],
            filters: [
              { key: 'professional_id', label: tl('Professional', 'Profissional'), type: 'select', options: [] },
              { key: 'status', label: 'Status', type: 'select', options: [
                { label: tl('Confirmed', 'Confirmado'), value: 'confirmed' },
                { label: tl('Completed', 'Concluído'), value: 'completed' },
                { label: tl('Cancelled', 'Cancelado'), value: 'cancelled' },
                { label: tl('No-show', 'Não compareceu'), value: 'no_show' },
              ]},
            ],
            dataSource: { kind: 'view', name: 'rep_appointments_by_period', dateColumn: 'date', defaultSort: 'date', defaultSortDir: 'desc' },
            showSummary: true,
          },
          {
            id: 'occupancy-rate',
            name: tl('Occupancy Rate', 'Taxa de Ocupação'),
            description: tl('Occupancy analysis by professional and period', 'Análise de ocupação por profissional e período'),
            icon: 'Activity',
            category: tl('Scheduling & Agenda', 'Agendamentos & Agenda'),
            badge: 'essential',
            columns: [
              { key: 'professionalName', label: tl('Professional', 'Profissional'), type: 'text' },
              { key: 'totalSlots', label: tl('Total Slots', 'Horários Totais'), type: 'number' },
              { key: 'bookedSlots', label: tl('Booked', 'Agendados'), type: 'number' },
              { key: 'occupancyRate', label: tl('Occupancy %', 'Ocupação %'), type: 'number' },
            ],
            dataSource: { kind: 'view', name: 'rep_occupancy_rate', defaultSort: 'occupancy_rate', defaultSortDir: 'desc' },
            available: false,
          },
          {
            id: 'cancellations',
            name: tl('Cancellations', 'Cancelamentos'),
            description: tl('Cancellation reasons and patterns', 'Análise de motivos e padrões de cancelamento'),
            icon: 'CalendarX',
            category: tl('Scheduling & Agenda', 'Agendamentos & Agenda'),
            columns: [
              { key: 'date', label: tl('Date', 'Data'), type: 'date' },
              { key: 'clientName', label: tl('Client', 'Cliente'), type: 'text' },
              { key: 'professionalName', label: tl('Professional', 'Profissional'), type: 'text' },
              { key: 'serviceName', label: tl('Service', 'Serviço'), type: 'text' },
              { key: 'reason', label: tl('Reason', 'Motivo'), type: 'text' },
            ],
            dataSource: { kind: 'view', name: 'rep_cancellations', defaultSort: 'date', defaultSortDir: 'desc' },
            available: false,
          },
          {
            id: 'no-shows',
            name: tl('No-Show', 'No-Show (Faltou)'),
            description: tl('Clients who did not show up', 'Clientes que não compareceram'),
            icon: 'Clock',
            category: tl('Scheduling & Agenda', 'Agendamentos & Agenda'),
            columns: [
              { key: 'date', label: tl('Date', 'Data'), type: 'date' },
              { key: 'clientName', label: tl('Client', 'Cliente'), type: 'text' },
              { key: 'professionalName', label: tl('Professional', 'Profissional'), type: 'text' },
              { key: 'serviceName', label: tl('Service', 'Serviço'), type: 'text' },
              { key: 'lostRevenue', label: tl('Lost Revenue', 'Receita Perdida'), type: 'currency', aggregate: 'sum' },
            ],
            dataSource: { kind: 'view', name: 'rep_no_shows', defaultSort: 'date', defaultSortDir: 'desc' },
            showSummary: true,
            available: false,
          },
          {
            id: 'peak-hours',
            name: tl('Peak Hours', 'Horários de Pico'),
            description: tl('Most booked hours analysis', 'Análise dos horários mais agendados'),
            icon: 'CalendarClock',
            category: tl('Scheduling & Agenda', 'Agendamentos & Agenda'),
            badge: 'popular',
            columns: [
              { key: 'dayOfWeek', label: tl('Day', 'Dia'), type: 'text' },
              { key: 'hour', label: tl('Hour', 'Horário'), type: 'text' },
              { key: 'bookingCount', label: tl('Bookings', 'Agendamentos'), type: 'number', aggregate: 'sum' },
              { key: 'avgRevenue', label: tl('Avg Revenue', 'Receita Média'), type: 'currency' },
            ],
            dataSource: { kind: 'view', name: 'rep_peak_hours', defaultSort: 'booking_count', defaultSortDir: 'desc' },
            available: false,
          },
          // --- Financial ---
          {
            id: 'revenue-by-service',
            name: tl('Revenue by Service', 'Receita por Serviço'),
            description: tl('Revenue breakdown by service type', 'Detalhamento de receita por tipo de serviço'),
            icon: 'DollarSign',
            category: tl('Financial', 'Financeiro'),
            columns: [
              { key: 'serviceName', label: tl('Service', 'Serviço'), type: 'text' },
              { key: 'quantity', label: tl('Quantity', 'Quantidade'), type: 'number', aggregate: 'sum' },
              { key: 'totalRevenue', label: tl('Total Revenue', 'Receita Total'), type: 'currency', aggregate: 'sum' },
              { key: 'avgTicket', label: tl('Avg Ticket', 'Ticket Médio'), type: 'currency' },
            ],
            dataSource: { kind: 'view', name: 'rep_revenue_by_service', defaultSort: 'total_revenue', defaultSortDir: 'desc' },
            showSummary: true,
            available: false,
          },
          {
            id: 'revenue-by-professional',
            name: tl('Revenue by Professional', 'Receita por Profissional'),
            description: tl('Revenue breakdown by staff member', 'Detalhamento de receita por profissional'),
            icon: 'Users',
            category: tl('Financial', 'Financeiro'),
            badge: 'popular',
            columns: [
              { key: 'professionalName', label: tl('Professional', 'Profissional'), type: 'text' },
              { key: 'appointmentCount', label: tl('Appointments', 'Atendimentos'), type: 'number', aggregate: 'sum' },
              { key: 'totalRevenue', label: tl('Total Revenue', 'Receita Total'), type: 'currency', aggregate: 'sum' },
              { key: 'avgTicket', label: tl('Avg Ticket', 'Ticket Médio'), type: 'currency' },
              { key: 'commission', label: tl('Commission', 'Comissão'), type: 'currency', aggregate: 'sum' },
            ],
            dataSource: { kind: 'view', name: 'rep_revenue_by_professional', defaultSort: 'total_revenue', defaultSortDir: 'desc' },
            showSummary: true,
            available: false,
          },
          // --- Clients ---
          {
            id: 'client-frequency',
            name: tl('Client Frequency', 'Frequência de Clientes'),
            description: tl('Visit frequency and retention', 'Frequência de visitas e retenção'),
            icon: 'UserCheck',
            category: tl('Clients', 'Clientes'),
            columns: [
              { key: 'clientName', label: tl('Client', 'Cliente'), type: 'text' },
              { key: 'visitCount', label: tl('Visits', 'Visitas'), type: 'number', aggregate: 'sum' },
              { key: 'lastVisit', label: tl('Last Visit', 'Última Visita'), type: 'date' },
              { key: 'totalSpent', label: tl('Total Spent', 'Total Gasto'), type: 'currency', aggregate: 'sum' },
              { key: 'avgTicket', label: tl('Avg Ticket', 'Ticket Médio'), type: 'currency' },
            ],
            dataSource: { kind: 'view', name: 'rep_client_frequency', defaultSort: 'visit_count', defaultSortDir: 'desc' },
            showSummary: true,
            available: false,
          },
          {
            id: 'new-clients',
            name: tl('New Clients', 'Clientes Novos'),
            description: tl('New client acquisition by period', 'Aquisição de novos clientes por período'),
            icon: 'UserPlus',
            category: tl('Clients', 'Clientes'),
            columns: [
              { key: 'date', label: tl('Date', 'Data'), type: 'date' },
              { key: 'clientName', label: tl('Client', 'Cliente'), type: 'text' },
              { key: 'origin', label: tl('Origin', 'Origem'), type: 'text' },
              { key: 'firstService', label: tl('First Service', 'Primeiro Serviço'), type: 'text' },
            ],
            dataSource: { kind: 'view', name: 'rep_new_clients', defaultSort: 'date', defaultSortDir: 'desc' },
            available: false,
          },
        ],
      }),
      createCustomFormsPlugin({
        scope: 'universal',
        navSection: 'settings',
        labels: {
          pageTitle: tl('Custom Forms', 'Formulários'),
          settingsLabel: tl('Forms & Documents', 'Formulários e Documentos'),
          templates: tl('Templates', 'Modelos'),
          documents: tl('Documents', 'Documentos'),
          newTemplate: tl('New Template', 'Novo Modelo'),
          addDocument: tl('Add Document', 'Novo Documento'),
        },
      }),
      createTasksPlugin({
        labels: {
          drawerTitle: tl('Tasks', 'Tarefas'),
          settingsTitle: tl('Tasks', 'Tarefas'),
          quickAddPlaceholder: tl('Add a task...', 'Adicionar tarefa...'),
        },
      }),
    ]
  })(),
  pages: [
    // Dashboard plugin at position 0 (provides '/' route + nav)
    // Agenda plugin at position 2
    {
      path: '/clients', label: tl('Clients', 'Clientes'), icon: 'Users', position: 3,
      component: createCrudPage(clientEntity, { feature: 'clients' }),
      permission: { feature: 'clients', action: 'read' },
      children: [
        { path: '/clients/new', label: tl('Add', 'Adicionar'), icon: 'Plus' },
        { path: '/clients', label: tl('List', 'Lista'), icon: 'List' },
      ],
    },
    // Inventory plugin at position 4
    {
      path: '/marketing', label: 'Marketing', icon: 'Megaphone', position: 5,
      component: createPlaceholder('Marketing', tl('Campaigns, loyalty programs, and client engagement', 'Campanhas, programas de fidelidade e engajamento de clientes')),
      permission: { feature: 'marketing', action: 'read' },
    },
    // CRM (Vendas) plugin at position 6
    // Financial plugin at position 7
    {
      path: '/registry', label: tl('Registry', 'Cadastros'), icon: 'ClipboardList', position: 8,
      component: createPlaceholder(tl('Registry', 'Cadastros'), tl('Manage your business records', 'Gerencie seus registros de negócios')),
      children: [
        { path: '/registry/services', label: tl('Services', 'Serviços'), icon: 'Briefcase', component: createCrudPage(serviceEntity) },
        { path: '/registry/categories', label: tl('Categories', 'Categorias'), icon: 'Tag', component: createCrudPage(serviceCategoryEntity) },
        { path: '/registry/staff', label: tl('Staff', 'Equipe'), icon: 'UserCog', component: createCrudPage(staffEntity) },
        { path: '/registry/contacts', label: tl('Contacts', 'Contatos'), icon: 'Contact', component: createCrudPage(contactEntity) },
        { path: '/registry/suppliers', label: tl('Suppliers', 'Fornecedores'), icon: 'Building2', component: createCrudPage(supplierEntity) },
        { path: '/registry/partnerships', label: tl('Partnerships', 'Parcerias'), icon: 'Handshake', component: createCrudPage(partnershipEntity) },
        { path: '/registry/equipment', label: tl('Equipment', 'Equipamentos'), icon: 'Wrench', component: createCrudPage(equipmentEntity) },
        { path: '/registry/origins', label: tl('Origins', 'Origens'), icon: 'Globe', component: createCrudPage(originEntity) },
        { path: '/registry/accounts', label: tl('Accounts', 'Contas'), icon: 'Building2', component: createCrudPage(bankAccountEntity) },
      ],
    },
    { path: '/settings', label: tl('Settings', 'Configurações'), icon: 'Settings', position: 9, component: createPlaceholder(tl('Settings', 'Configurações')) },
    // Reports plugin at position 10
  ],
  billing: {
    plans: [
      {
        id: 'starter',
        name: tl('Starter', 'Inicial'),
        description: tl('For independent stylists', 'Para estilistas independentes'),
        features: [
          tl('Up to 3 staff members', 'Até 3 profissionais'),
          tl('100 appointments/month', '100 agendamentos/mês'),
          tl('Basic reports', 'Relatórios básicos'),
          tl('Email support', 'Suporte por e-mail'),
        ],
        prices: { monthly: 29, yearly: 279 },
      },
      {
        id: 'professional',
        name: tl('Professional', 'Profissional'),
        description: tl('For growing salons', 'Para salões em crescimento'),
        features: [
          tl('Up to 10 staff', 'Até 10 profissionais'),
          tl('Unlimited appointments', 'Agendamentos ilimitados'),
          tl('Advanced analytics', 'Análises avançadas'),
          tl('SMS reminders', 'Lembretes por SMS'),
          tl('Online booking page', 'Página de agendamento online'),
          tl('Priority support', 'Suporte prioritário'),
        ],
        prices: { monthly: 79, yearly: 759 },
        popular: true,
      },
      {
        id: 'enterprise',
        name: tl('Enterprise', 'Empresarial'),
        description: tl('For multi-location businesses', 'Para negócios multi-unidades'),
        features: [
          tl('Unlimited staff', 'Profissionais ilimitados'),
          tl('Multi-location', 'Multi-unidades'),
          tl('Custom branding', 'Marca personalizada'),
          tl('API access', 'Acesso à API'),
          tl('Dedicated account manager', 'Gerente de conta dedicado'),
          tl('Custom integrations', 'Integrações personalizadas'),
        ],
        prices: { monthly: 199, yearly: 1909 },
      },
    ],
  },
  chat: {
    title: tl('Glow Assistant', 'Assistente Glow'),
    systemPrompt: 'You are a helpful salon assistant for BeautySoft.',
  },
})
