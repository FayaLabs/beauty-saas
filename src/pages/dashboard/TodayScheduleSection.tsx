import React from 'react'
import { Card, Badge } from '@fayz/saas-core/components'
import type { DashboardSectionProps } from '@fayz/saas-core/plugins/dashboard'

const upcomingAppointments = [
  { time: '9:00', client: 'Sarah Johnson', service: 'Balayage + Cut', stylist: 'Maria', duration: '2h 30m', status: 'confirmed' as const },
  { time: '10:00', client: 'Emily Chen', service: 'Manicure + Pedicure', stylist: 'Lisa', duration: '1h 15m', status: 'confirmed' as const },
  { time: '11:30', client: 'Rachel Kim', service: 'Facial Treatment', stylist: 'Anna', duration: '1h', status: 'pending' as const },
  { time: '13:00', client: 'Jessica Lee', service: 'Haircut & Blowout', stylist: 'Maria', duration: '45m', status: 'confirmed' as const },
  { time: '14:30', client: 'Amanda White', service: 'Full Set Acrylics', stylist: 'Lisa', duration: '1h 30m', status: 'confirmed' as const },
]

export function TodayScheduleSection(_props: DashboardSectionProps) {
  return (
    <Card>
      <div className="p-5 border-b">
        <h2 className="text-lg font-semibold">Agenda de Hoje</h2>
      </div>
      <div className="divide-y">
        {upcomingAppointments.map((apt, i) => (
          <div key={i} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
            <div className="w-14 text-sm font-medium text-primary">{apt.time}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{apt.client}</p>
              <p className="text-sm text-muted-foreground">{apt.service} &bull; {apt.duration}</p>
            </div>
            <div className="text-sm text-muted-foreground hidden sm:block">{apt.stylist}</div>
            <Badge variant={apt.status === 'confirmed' ? 'default' : 'secondary'}>
              {apt.status === 'confirmed' ? 'confirmado' : 'pendente'}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  )
}
