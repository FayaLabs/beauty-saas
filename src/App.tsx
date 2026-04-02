import { createSaasApp, createCrudPage, createArchetypeLookup } from '@fayz/saas-core'
import { createFinancialPlugin, createSafeFinancialProvider } from '@fayz/saas-core/plugins/financial'
import { createInventoryPlugin } from '@fayz/saas-core/plugins/inventory'
import { createCrmPlugin } from '@fayz/saas-core/plugins/crm'
import { createAgendaPlugin, createFinancialBridge } from '@fayz/saas-core/plugins/agenda'
import { createReportsPlugin } from '@fayz/saas-core/plugins/reports'
import { createCustomFormsPlugin } from '@fayz/saas-core/plugins/custom_forms'

import { Dashboard } from './pages/Dashboard'
import { serviceEntity } from './types/service'
import { clientEntity } from './types/client'
import { contactEntity, staffEntity, supplierEntity, originEntity, partnershipEntity, equipmentEntity, bankAccountEntity, serviceCategoryEntity } from './types/registry'
import { createPlaceholder } from './pages/Placeholder'
import { Sales } from './pages/Sales'
import { beautyTheme } from './theme'
import { appTranslations } from './i18n'
import { tl } from './i18n/tl'

export const App = createSaasApp({
  name: 'Glow Studio',
  logo: 'G',
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
        confirmationChannels: [
          { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
          { id: 'phone', label: tl('Phone', 'Telefone'), icon: 'Phone' },
        ],
      }),
      createFinancialPlugin({
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
        labels: {
          pageTitle: tl('Custom Forms', 'Formulários'),
          settingsLabel: tl('Forms & Documents', 'Formulários e Documentos'),
          templates: tl('Templates', 'Modelos'),
          documents: tl('Documents', 'Documentos'),
          newTemplate: tl('New Template', 'Novo Modelo'),
          addDocument: tl('Add Document', 'Novo Documento'),
        },
      }),
    ]
  })(),
  pages: [
    { path: '/', label: tl('Dashboard', 'Painel'), icon: 'Home', component: Dashboard, permission: { feature: 'dashboard', action: 'read' } },
    {
      path: '/clients', label: tl('Clients', 'Clientes'), icon: 'Users',
      component: createCrudPage(clientEntity, { feature: 'clients' }),
      permission: { feature: 'clients', action: 'read' },
      children: [
        { path: '/clients/new', label: tl('Add', 'Adicionar'), icon: 'Plus' },
        { path: '/clients', label: tl('List', 'Lista'), icon: 'List' },
      ],
    },
    {
      path: '/registry', label: tl('Registry', 'Cadastros'), icon: 'ClipboardList',
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
    systemPrompt: 'You are a helpful salon assistant for Glow Studio.',
  },
})
