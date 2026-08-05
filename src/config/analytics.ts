import { tl } from '@fayz-ai/saas'
import type { AnalyticsCardDef, AnalyticsFilterDef } from '@fayz-ai/core'

// ---------------------------------------------------------------------------
// Métricas padrão do /analytics do BeautySoft.
//
// Cada card aqui é, ao mesmo tempo, um bloco do painel, uma linha da lista de
// relatórios e um relatório inteiro — a mesma definição em três tamanhos. Quem
// tem `dashboard` aparece no painel; quem não tem vive só na lista.
//
// Os ids levam o prefixo `beauty.` de propósito: eles convivem no MESMO catálogo
// dos relatórios legados de src/config/reports.ts ('revenue-by-service' e
// companhia), e um id repetido faz um sobrescrever o outro silenciosamente.
//
// QUAL VIEW SIGNIFICA O QUÊ — a distinção mais importante deste arquivo:
//
//   rep_revenue_by_service / _by_professional
//       já EXCLUEM cancelados e no-show na própria definição da view. É daqui
//       que sai toda receita.
//   rep_appointments_metrics
//       TODO agendamento, com flags 0/1 por status (migração 0019). Serve para
//       contar e para calcular taxas — nunca para faturamento bruto, porque
//       somar `revenue` ali cobra pelo horário que o cliente furou.
//
// Verificado contra o pool: as duas fontes batem (effective_revenue do metrics
// == total_revenue do revenue_by_service), então painel e relatório não podem
// divergir.
// ---------------------------------------------------------------------------

const APPOINTMENTS = 'rep_appointments_metrics'
const REVENUE_SERVICE = 'rep_revenue_by_service'
const REVENUE_PROFESSIONAL = 'rep_revenue_by_professional'
const NEW_CLIENTS = 'rep_new_clients'
const CLIENT_FREQUENCY = 'rep_client_frequency'

const CAT_REVENUE = tl('Revenue', 'Receita')
const CAT_AGENDA = tl('Scheduling', 'Agenda')
const CAT_CLIENTS = tl('Clients', 'Clientes')
const CAT_TEAM = tl('Team', 'Equipe')

/** Status reais presentes na base — não a lista teórica do enum. */
const statusFilter: AnalyticsFilterDef = {
  key: 'status',
  label: tl('Status', 'Status'),
  type: 'multiselect',
  group: CAT_AGENDA,
  options: [
    { label: tl('Scheduled', 'Agendado'), value: 'scheduled' },
    { label: tl('Confirmed', 'Confirmado'), value: 'confirmed' },
    { label: tl('In progress', 'Em atendimento'), value: 'in_progress' },
    { label: tl('Completed', 'Concluído'), value: 'completed' },
    { label: tl('Cancelled', 'Cancelado'), value: 'cancelled' },
    { label: tl('No-show', 'Faltou'), value: 'no_show' },
  ],
}

const base = { domain: 'beauty', compare: true }

export const beautyAnalyticsCards: AnalyticsCardDef[] = [
  // -------------------------------------------------------------------------
  // Linha de KPIs — os quatro números com que se abre o dia
  // -------------------------------------------------------------------------
  {
    ...base,
    id: 'beauty.revenue',
    name: tl('Revenue', 'Receita'),
    description: tl(
      'Service revenue in the period. Cancellations and no-shows are excluded.',
      'Receita de serviços no período. Cancelamentos e faltas ficam de fora.',
    ),
    icon: 'CircleDollarSign',
    category: CAT_REVENUE,
    grain: 'booking',
    canonicalOwner: 'public.v_appointments',
    query: {
      source: { kind: 'view', name: REVENUE_SERVICE },
      dateColumn: 'date',
      dimensions: [{ key: 'date', label: tl('Date', 'Data'), grain: 'auto' }],
      measures: [{ key: 'total_revenue', label: tl('Revenue', 'Receita'), agg: 'sum', format: 'currency' }],
    },
    viz: { type: 'kpi', spark: true },
    dashboard: { span: 1, order: 0 },
  },
  {
    ...base,
    id: 'beauty.appointments',
    name: tl('Appointments', 'Agendamentos'),
    description: tl(
      'Every booking in the period, including cancellations and no-shows.',
      'Todos os agendamentos do período, incluindo cancelados e faltas.',
    ),
    icon: 'CalendarDays',
    category: CAT_AGENDA,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: APPOINTMENTS },
      dateColumn: 'date',
      dimensions: [{ key: 'date', label: tl('Date', 'Data'), grain: 'auto' }],
      measures: [{ key: 'appointments', label: tl('Appointments', 'Agendamentos'), agg: 'count', format: 'number' }],
      filters: [statusFilter],
    },
    viz: { type: 'kpi', spark: true },
    dashboard: { span: 1, order: 1 },
  },
  {
    ...base,
    id: 'beauty.avg-ticket',
    name: tl('Average ticket', 'Ticket médio'),
    description: tl(
      'Revenue divided by services performed — the ratio of the totals, not the average of each day’s average.',
      'Receita dividida pelos serviços realizados — a razão dos totais, não a média das médias diárias.',
    ),
    icon: 'Receipt',
    category: CAT_REVENUE,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: REVENUE_SERVICE },
      dateColumn: 'date',
      measures: [
        { key: 'total_revenue', label: tl('Revenue', 'Receita'), agg: 'sum', format: 'currency' },
        { key: 'quantity', label: tl('Services', 'Serviços'), agg: 'sum', format: 'number' },
        {
          key: 'avg_ticket', label: tl('Average ticket', 'Ticket médio'), agg: 'ratio',
          ratioOf: ['total_revenue', 'quantity'], format: 'currency',
        },
      ],
    },
    viz: { type: 'kpi', measures: ['avg_ticket'] },
    dashboard: { span: 1, order: 2 },
  },
  {
    ...base,
    id: 'beauty.new-clients-kpi',
    name: tl('New clients', 'Novos clientes'),
    description: tl('Clients whose first booking falls in the period.', 'Clientes cujo primeiro agendamento caiu no período.'),
    icon: 'UserPlus',
    category: CAT_CLIENTS,
    grain: 'client',
    query: {
      source: { kind: 'view', name: NEW_CLIENTS },
      dateColumn: 'date',
      dimensions: [{ key: 'date', label: tl('Date', 'Data'), grain: 'auto' }],
      measures: [{ key: 'clients', label: tl('New clients', 'Novos clientes'), agg: 'count', format: 'number' }],
    },
    viz: { type: 'kpi', spark: true },
    dashboard: { span: 1, order: 3 },
  },

  // -------------------------------------------------------------------------
  // Taxas — o que separa um salão cheio de um salão lucrativo
  // -------------------------------------------------------------------------
  {
    ...base,
    id: 'beauty.cancellation-rate',
    name: tl('Cancellation rate', 'Taxa de cancelamento'),
    description: tl(
      'Share of bookings cancelled in the period.',
      'Percentual de agendamentos cancelados no período.',
    ),
    icon: 'CalendarX',
    category: CAT_AGENDA,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: APPOINTMENTS },
      dateColumn: 'date',
      measures: [
        { key: 'is_cancelled', label: tl('Cancelled', 'Cancelados'), agg: 'sum', format: 'number' },
        { key: 'appointments', label: tl('Appointments', 'Agendamentos'), agg: 'count', format: 'number' },
        {
          key: 'cancellation_rate', label: tl('Cancellation rate', 'Taxa de cancelamento'), agg: 'ratio',
          ratioOf: ['is_cancelled', 'appointments'], scale: 100, format: 'percent',
        },
      ],
    },
    viz: { type: 'kpi', measures: ['cancellation_rate'] },
    dashboard: { span: 1, order: 10 },
  },
  {
    ...base,
    id: 'beauty.no-show-rate',
    name: tl('No-show rate', 'Taxa de faltas'),
    description: tl(
      'Share of bookings where the client did not turn up.',
      'Percentual de agendamentos em que o cliente não compareceu.',
    ),
    icon: 'UserX',
    category: CAT_AGENDA,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: APPOINTMENTS },
      dateColumn: 'date',
      measures: [
        { key: 'is_no_show', label: tl('No-shows', 'Faltas'), agg: 'sum', format: 'number' },
        { key: 'appointments', label: tl('Appointments', 'Agendamentos'), agg: 'count', format: 'number' },
        {
          key: 'no_show_rate', label: tl('No-show rate', 'Taxa de faltas'), agg: 'ratio',
          ratioOf: ['is_no_show', 'appointments'], scale: 100, format: 'percent',
        },
      ],
    },
    viz: { type: 'kpi', measures: ['no_show_rate'] },
    dashboard: { span: 1, order: 11 },
  },
  {
    ...base,
    id: 'beauty.lost-revenue',
    name: tl('Lost revenue', 'Receita perdida'),
    description: tl(
      'Value booked into slots that were cancelled or no-showed — the cost of an empty chair.',
      'Valor dos horários cancelados ou com falta — o custo da cadeira vazia.',
    ),
    icon: 'TrendingDown',
    category: CAT_REVENUE,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: APPOINTMENTS },
      dateColumn: 'date',
      measures: [{ key: 'lost_revenue', label: tl('Lost revenue', 'Receita perdida'), agg: 'sum', format: 'currency' }],
    },
    viz: { type: 'kpi' },
    dashboard: { span: 1, order: 12 },
  },

  // -------------------------------------------------------------------------
  // Séries e quebras
  // -------------------------------------------------------------------------
  {
    ...base,
    id: 'beauty.revenue-over-time',
    name: tl('Revenue over time', 'Receita ao longo do tempo'),
    description: tl(
      'Revenue bucketed by day, week or month depending on the range picked.',
      'Receita agrupada por dia, semana ou mês conforme o período escolhido.',
    ),
    icon: 'TrendingUp',
    category: CAT_REVENUE,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: REVENUE_SERVICE },
      dateColumn: 'date',
      dimensions: [{ key: 'date', label: tl('Date', 'Data'), grain: 'auto' }],
      measures: [{ key: 'total_revenue', label: tl('Revenue', 'Receita'), agg: 'sum', format: 'currency' }],
      defaultSort: 'date',
      defaultSortDir: 'asc',
    },
    viz: { type: 'area' },
    dashboard: { span: 2, order: 20 },
  },
  {
    ...base,
    id: 'beauty.appointments-by-status',
    name: tl('Appointments by status', 'Agendamentos por status'),
    description: tl(
      'Where the agenda stands: booked, confirmed, completed, cancelled, no-show.',
      'Como está a agenda: agendados, confirmados, concluídos, cancelados e faltas.',
    ),
    icon: 'ListChecks',
    category: CAT_AGENDA,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: APPOINTMENTS },
      dateColumn: 'date',
      dimensions: [{ key: 'status', label: tl('Status', 'Status') }],
      measures: [{ key: 'appointments', label: tl('Appointments', 'Agendamentos'), agg: 'count', format: 'number' }],
      defaultSort: 'appointments',
      defaultSortDir: 'desc',
    },
    viz: { type: 'breakdown' },
    dashboard: { span: 2, order: 21 },
  },
  {
    ...base,
    id: 'beauty.revenue-by-professional-chart',
    name: tl('Revenue by professional', 'Receita por profissional'),
    description: tl(
      'Who is bringing the money in. Cancellations and no-shows excluded.',
      'Quem está trazendo receita. Cancelamentos e faltas fora da conta.',
    ),
    icon: 'Users',
    category: CAT_TEAM,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: REVENUE_PROFESSIONAL },
      dateColumn: 'date',
      dimensions: [{ key: 'professional_name', label: tl('Professional', 'Profissional') }],
      measures: [
        { key: 'total_revenue', label: tl('Revenue', 'Receita'), agg: 'sum', format: 'currency' },
        { key: 'appointment_count', label: tl('Appointments', 'Atendimentos'), agg: 'sum', format: 'number' },
      ],
      defaultSort: 'total_revenue',
      defaultSortDir: 'desc',
    },
    viz: { type: 'breakdown', measures: ['total_revenue'], limit: 6 },
    dashboard: { span: 2, order: 22 },
  },
  {
    ...base,
    id: 'beauty.revenue-by-service-chart',
    name: tl('Revenue by service', 'Receita por serviço'),
    description: tl('Which services carry the salon.', 'Quais serviços sustentam o salão.'),
    icon: 'Scissors',
    category: CAT_REVENUE,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: REVENUE_SERVICE },
      dateColumn: 'date',
      dimensions: [{ key: 'service_name', label: tl('Service', 'Serviço') }],
      measures: [{ key: 'total_revenue', label: tl('Revenue', 'Receita'), agg: 'sum', format: 'currency' }],
      defaultSort: 'total_revenue',
      defaultSortDir: 'desc',
    },
    viz: { type: 'donut' },
    dashboard: { span: 2, order: 23 },
  },
  {
    ...base,
    id: 'beauty.appointments-over-time',
    name: tl('Appointments over time', 'Agendamentos ao longo do tempo'),
    description: tl('Booking volume across the period.', 'Volume de agendamentos no período.'),
    icon: 'Activity',
    category: CAT_AGENDA,
    grain: 'booking',
    query: {
      source: { kind: 'view', name: APPOINTMENTS },
      dateColumn: 'date',
      dimensions: [{ key: 'date', label: tl('Date', 'Data'), grain: 'auto' }],
      measures: [{ key: 'appointments', label: tl('Appointments', 'Agendamentos'), agg: 'count', format: 'number' }],
      filters: [statusFilter],
      defaultSort: 'date',
      defaultSortDir: 'asc',
    },
    viz: { type: 'line' },
    dashboard: { span: 2, order: 24 },
  },
  {
    ...base,
    id: 'beauty.new-clients-over-time',
    name: tl('New clients over time', 'Novos clientes ao longo do tempo'),
    description: tl('Client acquisition by first booking date.', 'Aquisição de clientes pela data do primeiro agendamento.'),
    icon: 'UserPlus',
    category: CAT_CLIENTS,
    grain: 'client',
    query: {
      source: { kind: 'view', name: NEW_CLIENTS },
      dateColumn: 'date',
      dimensions: [{ key: 'date', label: tl('Date', 'Data'), grain: 'auto' }],
      measures: [{ key: 'clients', label: tl('New clients', 'Novos clientes'), agg: 'count', format: 'number' }],
      defaultSort: 'date',
      defaultSortDir: 'asc',
    },
    viz: { type: 'bar' },
    dashboard: { span: 2, order: 25 },
  },

  // -------------------------------------------------------------------------
  // Snapshot — o período NÃO se aplica (é o estado da base de clientes hoje)
  // -------------------------------------------------------------------------
  {
    ...base,
    compare: false,
    id: 'beauty.top-clients',
    name: tl('Clients by spend', 'Clientes por valor gasto'),
    description: tl(
      'Lifetime visits and spend per client. A snapshot — the date range does not apply.',
      'Visitas e gasto acumulados por cliente. É uma foto do momento — o período não se aplica.',
    ),
    icon: 'Crown',
    category: CAT_CLIENTS,
    grain: 'client',
    query: {
      source: { kind: 'view', name: CLIENT_FREQUENCY },
      dateColumn: null,
      dimensions: [{ key: 'client_name', label: tl('Client', 'Cliente') }],
      measures: [
        { key: 'total_spent', label: tl('Total spent', 'Total gasto'), agg: 'sum', format: 'currency' },
        { key: 'visit_count', label: tl('Visits', 'Visitas'), agg: 'sum', format: 'number' },
        {
          key: 'avg_ticket', label: tl('Average ticket', 'Ticket médio'), agg: 'ratio',
          ratioOf: ['total_spent', 'visit_count'], format: 'currency',
        },
      ],
      defaultSort: 'total_spent',
      defaultSortDir: 'desc',
      limit: 20,
    },
    viz: { type: 'table', limit: 5 },
    dashboard: { span: 2, order: 30 },
  },
]
