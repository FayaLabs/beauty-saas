import React, { useEffect, useState } from 'react'
import { Card, Badge } from '@fayz-ai/ui'
import type { DashboardSectionProps } from '@fayz-ai/plugin-dashboard'
import { supabase } from '../../integrations/supabase/client'

interface TodayAppointment {
  id: string
  time: string
  client: string
  service: string
  stylist: string | null
  duration: string
  status: 'confirmed' | 'pending' | 'cancelled'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDuration(minutes: number | null) {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function TodayScheduleSection(_props: DashboardSectionProps) {
  const [appointments, setAppointments] = useState<TodayAppointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

      // v_bookings is a DB view, absent from the generated table types
      const { data } = await (supabase as any)
        .from('v_bookings')
        .select('id, starts_at, client_name, services, professional_name, total_duration_minutes, status')
        .gte('starts_at', start)
        .lt('starts_at', end)
        .not('status', 'in', '("cancelled","no_show")')
        .order('starts_at', { ascending: true })
        .limit(10)

      if (data) {
        setAppointments(data.map((row: any) => ({
          id: row.id,
          time: formatTime(row.starts_at),
          client: row.client_name ?? '—',
          service: Array.isArray(row.services) && row.services.length > 0
            ? row.services.map((s: any) => s.name ?? s.service_name ?? s).join(', ')
            : '—',
          stylist: row.professional_name,
          duration: formatDuration(row.total_duration_minutes),
          status: row.status === 'confirmed' ? 'confirmed' : row.status === 'cancelled' ? 'cancelled' : 'pending',
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <Card>
      <div className="p-5 border-b">
        <h2 className="text-lg font-semibold">Agenda de Hoje</h2>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : appointments.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhum agendamento hoje.</div>
      ) : (
        <div className="divide-y">
          {appointments.map((apt) => (
            <div key={apt.id} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
              <div className="w-14 text-sm font-medium text-primary">{apt.time}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{apt.client}</p>
                <p className="text-sm text-muted-foreground">
                  {apt.service}{apt.duration ? ` • ${apt.duration}` : ''}
                </p>
              </div>
              {apt.stylist && (
                <div className="text-sm text-muted-foreground hidden sm:block">{apt.stylist}</div>
              )}
              <Badge variant={apt.status === 'confirmed' ? 'default' : 'secondary'}>
                {apt.status === 'confirmed' ? 'confirmado' : apt.status === 'cancelled' ? 'cancelado' : 'pendente'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
