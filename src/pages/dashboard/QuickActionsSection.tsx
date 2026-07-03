import React from 'react'
import { Bell, CalendarPlus, ClipboardCheck, Inbox, UserPlus } from 'lucide-react'
import type { DashboardSectionProps } from '../../types/sdk-contract'

const actions = [
  {
    label: 'Novo Agendamento',
    description: 'Agendar novo horario',
    route: '/agenda',
    icon: CalendarPlus,
  },
  {
    label: 'Cliente Avulso',
    description: 'Cadastrar novo cliente',
    route: '/clients/new',
    icon: UserPlus,
  },
  {
    label: 'Confirmacoes',
    description: 'Confirmar proximos horarios',
    route: '/agenda/confirmations',
    icon: Bell,
  },
  {
    label: 'Lista de Espera',
    description: 'Chamar clientes em espera',
    route: '/agenda/waitlist',
    icon: Inbox,
  },
  {
    label: 'Preparar Atendimento',
    description: 'Revisar itens antes do servico',
    route: '/agenda/execution-checklist',
    icon: ClipboardCheck,
  },
]

export function QuickActionsSection({ onNavigate }: DashboardSectionProps) {
  // Auto-fill: as many ~220px columns as the (now full-width) row fits, so the
  // actions spread across one/two rows instead of a rigid 2-column stack.
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {actions.map((action) => (
        <button
          type="button"
          key={action.label}
          className="grid min-h-[104px] grid-cols-[2rem_1fr] items-start gap-3 rounded-lg border border-input bg-background p-4 text-left text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => onNavigate?.(action.route)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
            <action.icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-5">{action.label}</span>
            <span className="mt-1 block text-xs leading-4 text-muted-foreground">{action.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
