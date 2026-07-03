import { createArchetypeLookup, getActiveTenantId, getSupabaseClientOptional, type EntityLookup, type FayzAppConfig } from '@fayz-ai/saas'
import { createFinancialPlugin, createSafeFinancialProvider, type FinancialDataProvider } from '@fayz-ai/plugin-financial'
import { createInventoryPlugin } from '@fayz-ai/plugin-inventory'
import { createCrmPlugin } from '@fayz-ai/plugin-crm'
import { createAgendaPlugin, createFinancialBridge, createGoogleCalendarPlugin, type AgendaPluginOptions } from '@fayz-ai/plugin-agenda'
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
import { serviceDefaultTemplateEntity } from '../types/service'
import { beautyTheme } from './theme'
import { appTranslations } from '../i18n'
import { tl } from '../i18n/tl'
import {
  appointmentCancellationReasonEntity,
  appointmentConfirmationChannelEntity,
  appointmentScheduleRuleEntity,
  originEntity,
} from '../types/registry'
import React from 'react'

const beautyAgendaStatuses: NonNullable<AgendaPluginOptions['statuses']> = [
  { value: 'scheduled', label: tl('Scheduled', 'Agendado'), color: '#6366f1' },
  { value: 'confirmed', label: tl('Confirmed', 'Confirmado'), color: '#3b82f6' },
  { value: 'in_progress', label: tl('In Progress', 'Em atendimento'), color: '#f59e0b', availableWhen: 'today_only' as const },
  { value: 'completed', label: tl('Completed', 'Concluído'), color: '#10b981', availableWhen: 'today_or_past' as const },
  { value: 'cancelled', label: tl('Cancelled', 'Cancelado'), color: '#ef4444' },
  { value: 'no_show', label: tl('No Show', 'Não compareceu'), color: '#6b7280', availableWhen: 'today_or_past' as const },
]

type ServicePricingRow = Record<string, unknown> & {
  id: string
  price?: number | string | null
  duration_minutes?: number | null
  category_id?: string | null
}

interface PriceAdjustment {
  adjustedPrice: number
  priceSource?: string
  priceTableId?: string
  variationIds: string[]
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key]
  return typeof value === 'string' && value ? value : undefined
}

function withAccountingDimensionReconciliation(provider: FinancialDataProvider): FinancialDataProvider {
  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop !== 'suggestReconciliation') return Reflect.get(target, prop, receiver)

      return async (bankMovementId: string) => {
        const baseSuggest = Reflect.get(target, 'suggestReconciliation', receiver) as FinancialDataProvider['suggestReconciliation']
        const getUnreconciled = Reflect.get(target, 'getUnreconciled', receiver) as FinancialDataProvider['getUnreconciled']
        if (typeof baseSuggest !== 'function' || typeof getUnreconciled !== 'function') return []

        const [candidates, bankLines] = await Promise.all([
          baseSuggest(bankMovementId),
          getUnreconciled(),
        ])
        const bankLine = bankLines.find((line) => line.id === bankMovementId)
        const bankAccountId = metadataString(bankLine?.metadata, 'accountId')
        const bankCostCenterId = metadataString(bankLine?.metadata, 'costCenterId')
        if (!bankAccountId && !bankCostCenterId) return candidates

        return candidates
          .map((candidate) => {
            const accountMatches = !!bankAccountId && metadataString(candidate.movement.metadata, 'accountId') === bankAccountId
            const costCenterMatches = !!bankCostCenterId && metadataString(candidate.movement.metadata, 'costCenterId') === bankCostCenterId
            const dimensionBoost = (accountMatches ? 0.08 : 0) + (costCenterMatches ? 0.08 : 0)
            return { ...candidate, score: Math.min(1, Math.round((candidate.score + dimensionBoost) * 100) / 100) }
          })
          .sort((a, b) => b.score - a.score)
      }
    },
  }) as FinancialDataProvider
}

function toMoneyNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return 0
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function filterMatches(type: unknown, expectedId: unknown, actualId: unknown): boolean {
  const filterType = typeof type === 'string' ? type : 'all'
  const expected = typeof expectedId === 'string' ? expectedId : null
  const actual = typeof actualId === 'string' ? actualId : null

  if (filterType === 'all') return true
  if (filterType === 'only') return !!expected && expected === actual
  if (filterType === 'except') return !expected || expected !== actual
  return true
}

function variationApplies(row: Record<string, unknown>, service: ServicePricingRow): boolean {
  return filterMatches(row.service_filter_type, row.service_id, service.id)
    && filterMatches(row.category_filter_type, row.category_id, service.category_id)
    && filterMatches(row.professional_filter_type, row.professional_id, null)
    && filterMatches(row.partnership_filter_type, row.partnership_id, null)
    && filterMatches(row.unit_filter_type, row.unit_id, null)
}

function applyPriceVariation(price: number, row: Record<string, unknown>): number {
  const value = toMoneyNumber(row.value)
  const isPercent = row.value_type === 'percentage'
  const delta = isPercent ? price * (value / 100) : value
  const nextPrice = row.variation_type === 'addition' ? price + delta : price - delta
  return Math.max(0, Math.round(nextPrice * 100) / 100)
}

async function resolveServicePricing(rows: ServicePricingRow[]): Promise<Map<string, PriceAdjustment>> {
  const supabase = getSupabaseClientOptional() as any
  const tenantId = getActiveTenantId()
  const adjustments = new Map<string, PriceAdjustment>()
  if (!supabase || !tenantId || rows.length === 0) return adjustments

  const today = todayIsoDate()
  const serviceIds = rows.map((row) => row.id)

  const { data: tableRows, error: tableError } = await supabase
    .from('service_price_tables')
    .select('id, starts_on, ends_on')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_default', true)
    .or(`starts_on.is.null,starts_on.lte.${today}`)
    .or(`ends_on.is.null,ends_on.gte.${today}`)
    .order('sort_order', { ascending: true })
    .limit(1)

  const priceTableId = !tableError && tableRows?.[0]?.id ? String(tableRows[0].id) : undefined

  let priceItemsByService = new Map<string, Record<string, unknown>>()
  if (priceTableId) {
    const { data: priceItems, error: priceItemsError } = await supabase
      .from('service_price_table_items')
      .select('service_id, price, duration_minutes')
      .eq('tenant_id', tenantId)
      .eq('price_table_id', priceTableId)
      .in('service_id', serviceIds)

    if (!priceItemsError) {
      priceItemsByService = new Map((priceItems ?? []).map((item: Record<string, unknown>) => [String(item.service_id), item]))
    }
  }

  const { data: variationRows, error: variationError } = await supabase
    .from('service_price_variations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  for (const service of rows) {
    const tableItem = priceItemsByService.get(service.id)
    let price = tableItem ? toMoneyNumber(tableItem.price) : toMoneyNumber(service.price)
    const variationIds: string[] = []

    if (!variationError) {
      for (const variation of variationRows ?? []) {
        if (!variationApplies(variation, service)) continue
        price = applyPriceVariation(price, variation)
        if (variation.id) variationIds.push(String(variation.id))
      }
    }

    adjustments.set(service.id, {
      adjustedPrice: price,
      priceSource: tableItem ? 'price-table' : variationIds.length > 0 ? 'variation' : undefined,
      priceTableId,
      variationIds,
    })
  }

  return adjustments
}

function createBeautyAgendaClientLookup(): EntityLookup {
  const toClientResult = (row: Record<string, unknown>) => ({
    id: String(row.id),
    label: String(row.name ?? ''),
    subtitle: [row.phone, row.email].filter(Boolean).map(String).join(' · ') || undefined,
    group: tl('Client', 'Cliente'),
    data: row,
  })

  async function queryClients(search?: string) {
    const supabase = getSupabaseClientOptional() as any
    const tenantId = getActiveTenantId()
    if (!supabase || !tenantId) return []

    let qb = supabase
      .schema('saas_core')
      .from('persons')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('kind', 'customer')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(20)

    const term = search?.trim()
    if (term) {
      const pattern = `%${term}%`
      qb = qb.or(`name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
    }

    const { data } = await qb
    return (data ?? []).map(toClientResult)
  }

  return {
    search: queryClients,
    list: () => queryClients(),
    async getById(id: string) {
      const supabase = getSupabaseClientOptional() as any
      const tenantId = getActiveTenantId()
      if (!supabase || !tenantId) return null

      const { data } = await supabase
        .schema('saas_core')
        .from('persons')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('kind', 'customer')
        .single()

      return data ? toClientResult(data) : null
    },
  }
}

function createBeautyAgendaServiceLookup(): EntityLookup {
  const toServiceResult = (row: ServicePricingRow, pricing?: PriceAdjustment) => {
    const duration = row.duration_minutes
    const price = pricing?.adjustedPrice ?? toMoneyNumber(row.price)
    return {
      id: String(row.id),
      label: String(row.name ?? ''),
      subtitle: [typeof duration === 'number' ? `${duration}min` : undefined, row.description].filter(Boolean).map(String).join(' · ') || undefined,
      price: price || undefined,
      data: {
        ...row,
        price,
        basePrice: toMoneyNumber(row.price),
        appliedPriceTableId: pricing?.priceTableId,
        appliedPriceVariationIds: pricing?.variationIds ?? [],
        priceSource: pricing?.priceSource,
      },
    }
  }

  async function queryServices(search?: string) {
    const supabase = getSupabaseClientOptional() as any
    const tenantId = getActiveTenantId()
    if (!supabase || !tenantId) return []

    let qb = supabase
      .schema('saas_core')
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(20)

    const term = search?.trim()
    if (term) qb = qb.ilike('name', `%${term}%`)

    const { data } = await qb
    const rows = (data ?? []) as ServicePricingRow[]
    const pricingByService = await resolveServicePricing(rows)
    return rows.map((row) => toServiceResult(row, pricingByService.get(row.id)))
  }

  return {
    search: queryServices,
    list: () => queryServices(),
    async getById(id: string) {
      const supabase = getSupabaseClientOptional() as any
      const tenantId = getActiveTenantId()
      if (!supabase || !tenantId) return null

      const { data } = await supabase
        .schema('saas_core')
        .from('services')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single()

      if (!data) return null
      const row = data as ServicePricingRow
      const pricingByService = await resolveServicePricing([row])
      return toServiceResult(row, pricingByService.get(row.id))
    },
  }
}

function createBeautyCancellationDetailsProvider(): NonNullable<AgendaPluginOptions['cancellationDetails']> {
  return {
    async listReasons() {
      const supabase = getSupabaseClientOptional() as any
      const tenantId = getActiveTenantId()
      if (!supabase || !tenantId) return []

      const { data } = await supabase
        .from('appointment_cancellation_reasons')
        .select('id, name, requires_notes')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        label: String(row.name ?? ''),
        requiresNotes: Boolean(row.requires_notes),
      }))
    },
    async saveCancellationDetails(input) {
      const supabase = getSupabaseClientOptional() as any
      const tenantId = getActiveTenantId()
      if (!supabase || !tenantId) return

      const { error } = await supabase
        .from('appointments')
        .upsert({
          booking_id: input.bookingId,
          tenant_id: tenantId,
          cancellation_reason_id: input.reasonId,
          cancellation_notes: input.notes ?? null,
          cancelled_at: input.cancelledAt ?? new Date().toISOString(),
        }, { onConflict: 'booking_id' })

      if (error) throw error
    },
  }
}

async function markWaitlistEntryScheduled(input: { bookingId: string; waitlistId: string }) {
  const supabase = getSupabaseClientOptional() as any
  const tenantId = getActiveTenantId()
  if (!supabase || !tenantId) return

  const { error } = await supabase
    .from('appointment_waitlist_entries')
    .update({
      status: 'scheduled',
      converted_booking_id: input.bookingId,
    })
    .eq('id', input.waitlistId)
    .eq('tenant_id', tenantId)

  if (error) throw error
}

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
    const serviceLookup = createBeautyAgendaServiceLookup()
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
    const agendaClientLookup = createBeautyAgendaClientLookup()
    const cancellationDetails = createBeautyCancellationDetailsProvider()

    const financialProvider = withAccountingDimensionReconciliation(createSafeFinancialProvider())
    const financialBridge = createFinancialBridge(financialProvider)

    // Options extracted to consts so the clinic preset (below) can reuse them
    // verbatim while overriding just a couple of module flags.
    const agendaOptions: NonNullable<Parameters<typeof createAgendaPlugin>[0]> = {
        bookingKind: 'appointment',
        orderKind: 'service_order',
        scheduleKind: 'working_hours',
        professionalKind: 'staff',
        clientKind: 'customer',
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        labels: {
          pageTitle: tl('Agenda', 'Agenda'),
          pageSubtitle: tl('Calendar and appointment management', 'Calendário e gestão de agendamentos'),
          calendar: tl('Calendar', 'Calendário'),
          dayView: tl('Day', 'Dia'),
          weekView: tl('Week', 'Semana'),
          monthView: tl('Month', 'Mês'),
          listView: tl('Agenda', 'Agenda'),
          workingHours: tl('Working Hours', 'Horários de trabalho'),
          confirmations: tl('Confirmations', 'Confirmações'),
          newAppointment: tl('New Appointment', 'Novo Agendamento'),
          filters: tl('Filters', 'Filtros'),
        },
        statuses: beautyAgendaStatuses,
        contactLookup: agendaClientLookup,
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
        cancellationDetails,
        async onBookingCreated(input) {
          if (input.source?.type !== 'waitlist' || typeof input.source.waitlistId !== 'string') return
          await markWaitlistEntryScheduled({
            bookingId: input.bookingId,
            waitlistId: input.source.waitlistId,
          })
        },
        settingsRegistries: [
          {
            id: 'cancellation-reasons',
            entity: appointmentCancellationReasonEntity,
            icon: 'Ban',
            description: tl('Cancellation reason options used by agenda follow-up and cancel actions.', 'Motivos usados no acompanhamento e cancelamento de agendamentos.'),
          },
          {
            id: 'confirmation-channels',
            entity: appointmentConfirmationChannelEntity,
            icon: 'MessageCircle',
            description: tl('Reminder and confirmation channels for appointment operations.', 'Canais de lembrete e confirmação usados na operação da agenda.'),
          },
          {
            id: 'schedule-rules',
            entity: appointmentScheduleRuleEntity,
            icon: 'Clock3',
            description: tl('Booking windows, buffers, advance limits, and concurrency rules.', 'Janelas de agendamento, intervalos, antecedência e simultaneidade.'),
          },
        ],
    }

    const financialOptions: NonNullable<Parameters<typeof createFinancialPlugin>[0]> = {
        navPosition: 7,
        currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
        dataProvider: financialProvider,
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
    }

    // Clinic persona preset (FAY-1258 item 2). VITE_BEAUTY_PRESET=clinic trims the
    // plugin set to the clinical core: dashboard, agenda (single-location), and
    // financial (no bank reconciliation). All other plugins (inventory, crm,
    // marketing, forms, tasks, openbanking, google-calendar, reports) are excluded.
    // No env var → the full default array below (unchanged).
    if (import.meta.env.VITE_BEAUTY_PRESET === 'clinic') {
      return [
        beautyDashboardPlugin,
        createAgendaPlugin({ ...agendaOptions, modules: { locationSelection: false } }),
        createFinancialPlugin({ ...financialOptions, modules: { ...financialOptions.modules, reconciliation: false } }),
      ]
    }

    return [
      beautyDashboardPlugin,
      createAgendaPlugin(agendaOptions),
      createFinancialPlugin(financialOptions),
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
        settingsRegistries: [
          {
            id: 'origins',
            entity: originEntity,
            icon: 'Globe',
            description: tl('Client acquisition origins used for attribution and salon marketing analysis.', 'Origens de captação de clientes usadas para atribuição e análise de marketing do salão.'),
          },
        ],
      }),
      createCustomFormsPlugin({
        scope: 'universal',
        navSection: 'settings',
        labels: {
          pageTitle: tl('Custom Forms', 'Formulários'),
          settingsLabel: tl('Forms & Documents', 'Formulários e Documentos'),
          settingsSubtitle: tl('Create and manage custom forms for your business', 'Crie e gerencie formulários personalizados para o seu negócio'),
          templates: tl('Templates', 'Modelos'),
          documents: tl('Documents', 'Documentos'),
          newTemplate: tl('New Template', 'Novo Modelo'),
          addDocument: tl('Add Document', 'Novo Documento'),
        },
        settingsRegistries: [
          {
            id: 'service-default-forms',
            entity: serviceDefaultTemplateEntity,
            icon: 'FileCheck2',
            description: tl('Default forms and contracts required by service execution.', 'Formulários e contratos padrão exigidos na execução dos serviços.'),
          },
        ],
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
