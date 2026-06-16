import { createDashboardPlugin } from '@fayz-ai/plugin-dashboard'
import { fayz, type FayzTableFilter } from '@fayz-ai/sdk'
import { QuickActionsSection } from '../pages/dashboard/QuickActionsSection'
import { TodayScheduleSection } from '../pages/dashboard/TodayScheduleSection'
import { tl } from '../i18n/tl'

function getLocalDayRange(offsetDays = 0) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

// Monday-anchored week window. offsetWeeks=-1 → previous week.
function getLocalWeekRange(offsetWeeks = 0) {
  const today = new Date()
  const dow = (today.getDay() + 6) % 7 // 0 = Monday
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow + offsetWeeks * 7)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  return { start: start.toISOString(), end: end.toISOString() }
}

// Calendar-month window. offsetMonths=-1 → previous month.
function getLocalMonthRange(offsetMonths = 0) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1)
  const end = new Date(today.getFullYear(), today.getMonth() + offsetMonths + 1, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function trendOf(value: number, previousValue: number): 'up' | 'down' | 'neutral' {
  if (value > previousValue) return 'up'
  if (value < previousValue) return 'down'
  return 'neutral'
}

async function countActiveBookingsForDay(offsetDays = 0): Promise<number> {
  const { start, end } = getLocalDayRange(offsetDays)
  const count = await fayz.data.countRows({
    table: 'v_bookings',
    filters: [
      { column: 'starts_at', operator: 'gte', value: start },
      { column: 'starts_at', operator: 'lt', value: end },
      { column: 'status', operator: 'neq', value: 'cancelled' },
      { column: 'status', operator: 'neq', value: 'no_show' },
    ],
  })
  return safeNumber(count)
}

// Sum a numeric column across rows matching the filters. fayz.data has no
// server-side aggregate yet, so we page a bounded window and fold in JS — fine
// for dashboard-scale windows (a week/month of bookings). B4 may replace the
// revenue rollups with a pre-aggregated view if volume grows.
async function sumColumn(
  table: string,
  column: string,
  filters: FayzTableFilter[],
): Promise<number> {
  const { rows } = await fayz.data.listRows<Record<string, unknown>>({
    table,
    filters,
    limit: 1000,
  })
  return rows.reduce((total, row) => total + safeNumber(Number(row[column] ?? 0)), 0)
}

// Revenue = realized order_total of non-cancelled/no-show bookings in the window.
async function revenueForWeek(offsetWeeks = 0): Promise<number> {
  const { start, end } = getLocalWeekRange(offsetWeeks)
  return sumColumn('v_bookings', 'order_total', [
    { column: 'starts_at', operator: 'gte', value: start },
    { column: 'starts_at', operator: 'lt', value: end },
    { column: 'status', operator: 'neq', value: 'cancelled' },
    { column: 'status', operator: 'neq', value: 'no_show' },
  ])
}

// Active (non-cancelled/no-show) bookings across an arbitrary window.
async function countActiveBookingsBetween(start: string, end: string): Promise<number> {
  const count = await fayz.data.countRows({
    table: 'v_bookings',
    filters: [
      { column: 'starts_at', operator: 'gte', value: start },
      { column: 'starts_at', operator: 'lt', value: end },
      { column: 'status', operator: 'neq', value: 'cancelled' },
      { column: 'status', operator: 'neq', value: 'no_show' },
    ],
  })
  return safeNumber(count)
}

// Clients whose last_visit falls on/after the given ISO date.
async function countClientsActiveSince(sinceIso: string, beforeIso?: string): Promise<number> {
  const filters: FayzTableFilter[] = [
    { column: 'last_visit', operator: 'gte', value: sinceIso },
  ]
  if (beforeIso) filters.push({ column: 'last_visit', operator: 'lt', value: beforeIso })
  const count = await fayz.data.countRows({ table: 'v_clients', filters })
  return safeNumber(count)
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export const beautyDashboardPlugin = createDashboardPlugin({
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
      compute: async () => {
        const [today, yesterday] = await Promise.all([
          countActiveBookingsForDay(0),
          countActiveBookingsForDay(-1),
        ])
        return { value: today, previousValue: yesterday }
      },
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
      compute: async () => {
        const [value, previousValue] = await Promise.all([revenueForWeek(0), revenueForWeek(-1)])
        return { value, previousValue, trend: trendOf(value, previousValue) }
      },
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
      // Clients with a visit in the last 90 days vs. the prior 90-day window.
      compute: async () => {
        const [value, previousValue] = await Promise.all([
          countClientsActiveSince(isoDaysAgo(90)),
          countClientsActiveSince(isoDaysAgo(180), isoDaysAgo(90)),
        ])
        return { value, previousValue, trend: trendOf(value, previousValue) }
      },
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
      // TODO(B4): no ratings/reviews source exists yet — needs a reviews table
      // or v_client_ratings view before this can be real. Left hardcoded.
      compute: async () => ({ value: 4.9, trend: 'neutral' }),
    },
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
      // Avg ticket = realized revenue / active bookings, per week.
      compute: async () => {
        const cur = getLocalWeekRange(0)
        const prev = getLocalWeekRange(-1)
        const [revNow, cntNow, revPrev, cntPrev] = await Promise.all([
          revenueForWeek(0),
          countActiveBookingsBetween(cur.start, cur.end),
          revenueForWeek(-1),
          countActiveBookingsBetween(prev.start, prev.end),
        ])
        const value = cntNow > 0 ? revNow / cntNow : 0
        const previousValue = cntPrev > 0 ? revPrev / cntPrev : 0
        return { value, previousValue, trend: trendOf(value, previousValue) }
      },
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
      // TODO(B4): occupancy needs slot capacity (work_schedules × duration) to
      // compute booked/available. No capacity view yet — left hardcoded.
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
      // No-show rate = no_show bookings / all bookings in the week (percent).
      compute: async () => {
        async function rate(offsetWeeks: number): Promise<number> {
          const { start, end } = getLocalWeekRange(offsetWeeks)
          const window: FayzTableFilter[] = [
            { column: 'starts_at', operator: 'gte', value: start },
            { column: 'starts_at', operator: 'lt', value: end },
          ]
          const [noShow, total] = await Promise.all([
            fayz.data.countRows({
              table: 'v_bookings',
              filters: [...window, { column: 'status', operator: 'eq', value: 'no_show' }],
            }),
            fayz.data.countRows({ table: 'v_bookings', filters: window }),
          ])
          return safeNumber(total) > 0 ? (safeNumber(noShow) / safeNumber(total)) * 100 : 0
        }
        const [value, previousValue] = await Promise.all([rate(0), rate(-1)])
        return { value, previousValue, trend: trendOf(previousValue, value) }
      },
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
      // First-time clients registered this calendar month vs. last month.
      compute: async () => {
        async function newClients(offsetMonths: number): Promise<number> {
          const { start, end } = getLocalMonthRange(offsetMonths)
          const count = await fayz.data.countRows({
            table: 'v_clients',
            filters: [
              { column: 'created_at', operator: 'gte', value: start },
              { column: 'created_at', operator: 'lt', value: end },
            ],
          })
          return safeNumber(count)
        }
        const [value, previousValue] = await Promise.all([newClients(0), newClients(-1)])
        return { value, previousValue, trend: trendOf(value, previousValue) }
      },
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
      // Retention = clients with more than one visit / total clients (percent).
      compute: async () => {
        const [returning, total] = await Promise.all([
          fayz.data.countRows({
            table: 'v_clients',
            filters: [{ column: 'visits', operator: 'gt', value: 1 }],
          }),
          fayz.data.countRows({ table: 'v_clients' }),
        ])
        const value = safeNumber(total) > 0 ? (safeNumber(returning) / safeNumber(total)) * 100 : 0
        return { value, trend: 'neutral' as const }
      },
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
      // Weekly realized revenue spread across the active professional headcount.
      compute: async () => {
        const [revNow, revPrev, staff] = await Promise.all([
          revenueForWeek(0),
          revenueForWeek(-1),
          fayz.data.countRows({ table: 'v_staff' }),
        ])
        const heads = safeNumber(staff)
        const value = heads > 0 ? revNow / heads : 0
        const previousValue = heads > 0 ? revPrev / heads : 0
        return { value, previousValue, trend: trendOf(value, previousValue) }
      },
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
      // TODO(B4): retail product sales need a goods-vs-service split on order
      // lines (or an inv_ sales rollup view). No clean source yet — hardcoded.
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
})
