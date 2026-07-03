import { createReportsPlugin, type ReportGrain } from '@fayz-ai/plugin-reports'
import { tl } from '../i18n/tl'

function reportContract(sourceView: string, grain: ReportGrain, canonicalOwner: string) {
  return {
    sourceView,
    grain,
    ownerPlugin: '@fayz-ai/plugin-reports',
    canonicalOwner,
    allowedActions: ['read' as const],
  }
}

function reportDescription(en: string, pt: string) {
  return tl(en, pt)
}

export const beautyReportsPlugin = createReportsPlugin({
  currency: { code: 'BRL', locale: 'pt-BR', symbol: 'R$' },
  navPosition: 10,
  labels: {
    pageTitle: tl('Reports', 'Relatórios'),
    pageSubtitle: tl('Access complete reports for analysis and decision making', 'Acesse relatórios completos para análise e tomada de decisão'),
  },
  reports: [
    {
      id: 'appointments-by-period',
      name: tl('Appointments by Period', 'Agendamentos por Período'),
      description: reportDescription(
        'Complete appointment listing by booking date and status',
        'Listagem de agendamentos por data, cliente, profissional, servico e status',
      ),
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
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: tl('Confirmed', 'Confirmado'), value: 'confirmed' },
            { label: tl('Completed', 'Concluído'), value: 'completed' },
            { label: tl('Cancelled', 'Cancelado'), value: 'cancelled' },
            { label: tl('No-show', 'Não compareceu'), value: 'no_show' },
          ],
        },
      ],
      dataSource: { kind: 'view', name: 'rep_appointments_by_period', dateColumn: 'date', defaultSort: 'date', defaultSortDir: 'desc' },
      ...reportContract('rep_appointments_by_period', 'booking', 'saas_core.bookings linked to saas_core.orders'),
      showSummary: true,
    },
    {
      id: 'occupancy-rate',
      name: tl('Occupancy Rate', 'Taxa de Ocupação'),
      description: reportDescription(
        'Occupancy analysis by professional and period',
        'Analise de ocupacao por profissional e periodo',
      ),
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
      ...reportContract('rep_occupancy_rate', 'booking', 'saas_core.bookings and saas_core.schedules'),
      available: false,
    },
    {
      id: 'cancellations',
      name: tl('Cancellations', 'Cancelamentos'),
      description: reportDescription(
        'Cancellation reasons and patterns by booking date',
        'Motivos e padroes de cancelamento por data de agendamento',
      ),
      icon: 'CalendarX',
      category: tl('Scheduling & Agenda', 'Agendamentos & Agenda'),
      columns: [
        { key: 'date', label: tl('Date', 'Data'), type: 'date' },
        { key: 'clientName', label: tl('Client', 'Cliente'), type: 'text' },
        { key: 'professionalName', label: tl('Professional', 'Profissional'), type: 'text' },
        { key: 'serviceName', label: tl('Service', 'Serviço'), type: 'text' },
        { key: 'reason', label: tl('Reason', 'Motivo'), type: 'text' },
      ],
      dataSource: { kind: 'view', name: 'rep_cancellations', dateColumn: 'date', defaultSort: 'date', defaultSortDir: 'desc' },
      ...reportContract('rep_cancellations', 'booking', 'saas_core.bookings linked to cancellation reason properties'),
      showSummary: true,
    },
    {
      id: 'no-shows',
      name: tl('No-Show', 'No-Show (Faltou)'),
      description: reportDescription(
        'Clients who did not show up and estimated lost revenue',
        'Clientes que faltaram e estimativa de receita perdida',
      ),
      icon: 'Clock',
      category: tl('Scheduling & Agenda', 'Agendamentos & Agenda'),
      columns: [
        { key: 'date', label: tl('Date', 'Data'), type: 'date' },
        { key: 'clientName', label: tl('Client', 'Cliente'), type: 'text' },
        { key: 'professionalName', label: tl('Professional', 'Profissional'), type: 'text' },
        { key: 'serviceName', label: tl('Service', 'Serviço'), type: 'text' },
        { key: 'lostRevenue', label: tl('Lost Revenue', 'Receita Perdida'), type: 'currency', aggregate: 'sum' },
      ],
      dataSource: { kind: 'view', name: 'rep_no_shows', dateColumn: 'date', defaultSort: 'date', defaultSortDir: 'desc' },
      ...reportContract('rep_no_shows', 'booking', 'saas_core.bookings linked to saas_core.orders'),
      showSummary: true,
    },
    {
      id: 'peak-hours',
      name: tl('Peak Hours', 'Horários de Pico'),
      description: reportDescription(
        'Most booked hours analysis with booking counts and average revenue',
        'Horarios mais procurados com volume de agendamentos e receita media',
      ),
      icon: 'CalendarClock',
      category: tl('Scheduling & Agenda', 'Agendamentos & Agenda'),
      badge: 'popular',
      columns: [
        { key: 'dayOfWeek', label: tl('Day', 'Dia'), type: 'text' },
        { key: 'hour', label: tl('Hour', 'Horário'), type: 'text' },
        { key: 'bookingCount', label: tl('Bookings', 'Agendamentos'), type: 'number', aggregate: 'sum' },
        { key: 'avgRevenue', label: tl('Avg Revenue', 'Receita Média'), type: 'currency' },
      ],
      dataSource: { kind: 'view', name: 'rep_peak_hours', dateColumn: 'date', defaultSort: 'booking_count', defaultSortDir: 'desc' },
      ...reportContract('rep_peak_hours', 'booking', 'saas_core.bookings with monetary values bridged through saas_core.orders'),
      showSummary: true,
    },
    {
      id: 'revenue-by-service',
      name: tl('Revenue by Service', 'Receita por Serviço'),
      description: reportDescription(
        'Revenue breakdown by service type',
        'Receita agrupada por tipo de servico',
      ),
      icon: 'DollarSign',
      category: tl('Financial', 'Financeiro'),
      columns: [
        { key: 'serviceName', label: tl('Service', 'Serviço'), type: 'text' },
        { key: 'quantity', label: tl('Quantity', 'Quantidade'), type: 'number', aggregate: 'sum' },
        { key: 'totalRevenue', label: tl('Total Revenue', 'Receita Total'), type: 'currency', aggregate: 'sum' },
        { key: 'avgTicket', label: tl('Avg Ticket', 'Ticket Médio'), type: 'currency' },
      ],
      dataSource: { kind: 'view', name: 'rep_revenue_by_service', dateColumn: 'date', defaultSort: 'total_revenue', defaultSortDir: 'desc' },
      ...reportContract('rep_revenue_by_service', 'order_item', 'saas_core.order_items linked to saas_core.orders'),
      showSummary: true,
    },
    {
      id: 'revenue-by-professional',
      name: tl('Revenue by Professional', 'Receita por Profissional'),
      description: reportDescription(
        'Revenue breakdown by staff member',
        'Receita agrupada por profissional',
      ),
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
      dataSource: { kind: 'view', name: 'rep_revenue_by_professional', dateColumn: 'date', defaultSort: 'total_revenue', defaultSortDir: 'desc' },
      ...reportContract('rep_revenue_by_professional', 'order_item', 'saas_core.order_items linked to bookings/professionals'),
      showSummary: true,
    },
    {
      id: 'client-frequency',
      name: tl('Client Frequency', 'Frequência de Clientes'),
      description: reportDescription(
        'Visit frequency and retention by client',
        'Frequencia, recencia e valor gasto por cliente',
      ),
      icon: 'UserCheck',
      category: tl('Clients', 'Clientes'),
      columns: [
        { key: 'clientName', label: tl('Client', 'Cliente'), type: 'text' },
        { key: 'visitCount', label: tl('Visits', 'Visitas'), type: 'number', aggregate: 'sum' },
        { key: 'lastVisit', label: tl('Last Visit', 'Última Visita'), type: 'date' },
        { key: 'totalSpent', label: tl('Total Spent', 'Total Gasto'), type: 'currency', aggregate: 'sum' },
        { key: 'avgTicket', label: tl('Avg Ticket', 'Ticket Médio'), type: 'currency' },
      ],
      dataSource: { kind: 'view', name: 'rep_client_frequency', dateColumn: 'last_visit', defaultSort: 'visit_count', defaultSortDir: 'desc' },
      ...reportContract('rep_client_frequency', 'order', 'saas_core.orders linked to client persons/bookings'),
      showSummary: true,
    },
    {
      id: 'new-clients',
      name: tl('New Clients', 'Clientes Novos'),
      description: reportDescription(
        'New client acquisition by period and origin',
        'Novos clientes por periodo e origem de aquisicao',
      ),
      icon: 'UserPlus',
      category: tl('Clients', 'Clientes'),
      columns: [
        { key: 'date', label: tl('Date', 'Data'), type: 'date' },
        { key: 'clientName', label: tl('Client', 'Cliente'), type: 'text' },
        { key: 'origin', label: tl('Origin', 'Origem'), type: 'text' },
        { key: 'firstService', label: tl('First Service', 'Primeiro Serviço'), type: 'text' },
      ],
      filters: [
        {
          key: 'origin',
          label: tl('Origin', 'Origem'),
          type: 'text',
          placeholder: tl('Filter by acquisition origin', 'Filtrar por origem de aquisicao'),
        },
      ],
      dataSource: { kind: 'view', name: 'rep_new_clients', dateColumn: 'date', defaultSort: 'date', defaultSortDir: 'desc' },
      ...reportContract('rep_new_clients', 'event', 'saas_core.persons customer lifecycle with /settings/marketing/_properties/origins'),
    },
    {
      id: 'financial-accounting-dimensions',
      name: tl('Financial Dimensions', 'Dimensões Financeiras'),
      description: reportDescription(
        'Invoice totals by chart of accounts and cost center',
        'Totais financeiros por plano de contas e centro de custo',
      ),
      icon: 'BookOpenCheck',
      category: tl('Financial', 'Financeiro'),
      badge: 'new',
      columns: [
        { key: 'date', label: tl('Date', 'Data'), type: 'date' },
        { key: 'direction', label: tl('Direction', 'Direção'), type: 'select' },
        { key: 'accountCode', label: tl('Account Code', 'Código da Conta'), type: 'text' },
        { key: 'accountName', label: tl('Chart of Accounts', 'Plano de Contas'), type: 'text' },
        { key: 'costCenterCode', label: tl('Cost Center Code', 'Código do Centro'), type: 'text' },
        { key: 'costCenterName', label: tl('Cost Center', 'Centro de Custo'), type: 'text' },
        { key: 'invoiceCount', label: tl('Invoices', 'Títulos'), type: 'number', aggregate: 'sum' },
        { key: 'lineCount', label: tl('Lines', 'Itens'), type: 'number', aggregate: 'sum' },
        { key: 'totalAmount', label: tl('Total Amount', 'Valor Total'), type: 'currency', aggregate: 'sum' },
        { key: 'paidAmount', label: tl('Paid Amount', 'Valor Pago'), type: 'currency', aggregate: 'sum' },
        { key: 'openAmount', label: tl('Open Amount', 'Valor em Aberto'), type: 'currency', aggregate: 'sum' },
      ],
      filters: [
        {
          key: 'direction',
          label: tl('Direction', 'Direção'),
          type: 'select',
          options: [
            { label: tl('Receivable', 'A receber'), value: 'credit' },
            { label: tl('Payable', 'A pagar'), value: 'debit' },
          ],
        },
      ],
      dataSource: { kind: 'view', name: 'rep_financial_accounting_dimensions', dateColumn: 'date', defaultSort: 'date', defaultSortDir: 'desc' },
      ...reportContract('rep_financial_accounting_dimensions', 'ledger_movement', 'public.financial_movements and plugin-financial accounting dimensions'),
      showSummary: true,
    },
  ],
})
