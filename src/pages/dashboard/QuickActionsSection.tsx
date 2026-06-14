import React from 'react'
import { Button } from '@fayz-ai/ui'
import type { DashboardSectionProps } from '@fayz-ai/plugin-dashboard'

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
        <Button
          key={action.label}
          variant="outline"
          className="flex flex-col items-center gap-2 p-4 h-auto"
          onClick={() => onNavigate?.(action.route)}
        >
          <span className="text-sm font-medium">{action.label}</span>
        </Button>
      ))}
    </div>
  )
}
