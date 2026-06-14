import { createDashboardPlugin } from '@fayz-ai/plugin-dashboard'
import { QuickActionsSection } from '../pages/dashboard/QuickActionsSection'
import { TodayScheduleSection } from '../pages/dashboard/TodayScheduleSection'
import { supabase } from '../integrations/supabase/client'
import { tl } from '../i18n/tl'

function getLocalDayRange(offsetDays = 0) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

async function countActiveBookingsForDay(offsetDays = 0): Promise<number> {
  const { start, end } = getLocalDayRange(offsetDays)
  const { count, error } = await (supabase as any)
    .from('v_bookings')
    .select('id', { count: 'exact', head: true })
    .gte('starts_at', start)
    .lt('starts_at', end)
    .not('status', 'in', '("cancelled","no_show")')

  if (error) throw error
  return count ?? 0
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
})
