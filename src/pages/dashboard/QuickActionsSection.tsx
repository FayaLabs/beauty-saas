import React from 'react'
import type { DashboardSectionProps } from '../../types/sdk-contract'

const actions = [
  { label: 'Novo Agendamento', route: '/agenda' },
  { label: 'Cliente Avulso', route: '/clients/new' },
  { label: 'Enviar Lembrete', route: '/agenda' },
  { label: 'Relatório do Dia', route: '/reports' },
]

export function QuickActionsSection({ onNavigate }: DashboardSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => (
        <button
          type="button"
          key={action.label}
          className="flex h-auto flex-col items-center gap-2 rounded-lg border border-input bg-background p-4 text-left text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => onNavigate?.(action.route)}
        >
          <span className="text-sm font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  )
}
