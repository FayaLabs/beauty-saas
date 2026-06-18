import { createArchetypeLookup, type FayzAppConfig } from '@fayz-ai/saas'
import { createFinancialPlugin, createSafeFinancialProvider } from '@fayz-ai/plugin-financial'
import { createInventoryPlugin } from '@fayz-ai/plugin-inventory'
import { createCrmPlugin } from '@fayz-ai/plugin-crm'
import { createAgendaPlugin, createFinancialBridge, createGoogleCalendarPlugin } from '@fayz-ai/plugin-agenda'
import { createCustomFormsPlugin } from '@fayz-ai/plugin-forms'
import { createTasksPlugin } from '@fayz-ai/plugin-tasks'
import { createMarketingPlugin } from '@fayz-ai/plugin-marketing'

import { createOpenBankingPlugin } from '../plugins/openbanking'
import { Logo } from '../components/Logo'
import { clientEntity } from '../types/client'
import { beautyBilling } from './billing'
import { beautyDashboardPlugin } from './dashboard'
import { beautyPages } from './pages'
import { beautyPermissions } from './permissions'
import { beautyReportsPlugin } from './reports'
import { beautyTheme } from './theme'
import { appTranslations } from '../i18n'
import { tl } from '../i18n/tl'
import React from 'react'

export const beautyAppConfig: FayzAppConfig = {
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
  org: { adapter: import.meta.env.VITE_SUPABASE_URL ? 'supabase' : 'mock', multiOrg: true },
  permissions: beautyPermissions,
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
      beautyDashboardPlugin,
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
        // Open Banking (Tecnospeed PlugBank) imports bank lines → Conciliação tab.
        modules: { reconciliation: true },
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
        onBookingClick: (orderId: string) => {
          // Navigate to agenda and open the booking modal
          window.location.hash = '/agenda'
          // Small delay to let the agenda page mount, then open the modal
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('agenda:open-booking', { detail: { bookingId: orderId } }))
          }, 100)
        },
      }),
      // Open Banking connector (Tecnospeed PlugBank) — settings-only; feeds the
      // financial Conciliação view. App-local incubator plugin.
      createOpenBankingPlugin(),
      // Google Calendar — official SDK integration; two-way booking sync,
      // settings-only UI. Deploy supabase/functions/google-calendar-sync.
      createGoogleCalendarPlugin(),
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
      beautyReportsPlugin,
      createMarketingPlugin({
        domain: 'beauty',
        navPosition: 5,
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        labels: {
          pageTitle: 'Marketing',
          pageSubtitle: tl('Acquisition & conversion performance', 'Aquisição e desempenho de conversão'),
          overview: tl('Overview', 'Visão geral'),
          channels: tl('Channels', 'Canais'),
          campaigns: tl('Campaigns', 'Campanhas'),
          funnel: tl('Funnel', 'Funil'),
          landingPages: tl('Landing pages', 'Páginas'),
          settings: tl('Settings', 'Configurações'),
        },
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
  pages: beautyPages,
  billing: beautyBilling,
  chat: {
    title: tl('Glow Assistant', 'Assistente Glow'),
    systemPrompt:
      'You are the BeautySoft salon operations assistant. Help managers reason about agenda, clients, services, inventory, marketing, and financial workflows using concise business guidance.',
  },
}
