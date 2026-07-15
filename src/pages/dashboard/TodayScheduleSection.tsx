import React, { useEffect, useState } from 'react'
import { fayz } from '@fayz-ai/saas'
import type { DashboardSectionProps } from '../../types/sdk-contract'

interface TodayAppointment {
  id: string
  time: string
  client: string
  service: string
  stylist: string | null
  duration: string
  status: 'confirmed' | 'pending' | 'cancelled'
  orderTotal: number
}

interface BookingRow {
  id: string
  starts_at: string
  client_name: string | null
  services: Array<{ name?: string; service_name?: string } | string> | null
  professional_name: string | null
  total_duration_minutes: number | null
  order_total: number | null
  status: string | null
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

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function TodayScheduleSection({ onNavigate }: DashboardSectionProps) {
  const [appointments, setAppointments] = useState<TodayAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setError(null)
        const today = new Date()
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

        const { rows } = await fayz.data.listRows<BookingRow>({
          table: 'v_appointments',
          filters: [
            { column: 'starts_at', operator: 'gte', value: start },
            { column: 'starts_at', operator: 'lt', value: end },
            { column: 'status', operator: 'neq', value: 'cancelled' },
            { column: 'status', operator: 'neq', value: 'no_show' },
          ],
          sortColumn: 'starts_at',
          sortDirection: 'asc',
          limit: 10,
        })

        if (!cancelled && rows) {
          setAppointments(rows.map((row) => ({
            id: row.id,
            time: formatTime(row.starts_at),
            client: row.client_name ?? '—',
            service: Array.isArray(row.services) && row.services.length > 0
              ? row.services.map((service) => typeof service === 'string' ? service : service.name ?? service.service_name ?? '—').join(', ')
              : '—',
            stylist: row.professional_name,
            duration: formatDuration(row.total_duration_minutes),
            status: row.status === 'confirmed' ? 'confirmed' : row.status === 'cancelled' ? 'cancelled' : 'pending',
            orderTotal: typeof row.order_total === 'number' ? row.order_total : 0,
          })))
        }
      } catch {
        if (!cancelled) setError('Não foi possível carregar a agenda de hoje.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const upcoming = appointments.find((apt) => apt.status !== 'cancelled') ?? appointments[0]
  const pendingCount = appointments.filter((apt) => apt.status === 'pending').length
  const expectedRevenue = appointments.reduce((sum, apt) => sum + apt.orderTotal, 0)

  return (
    <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Agenda de Hoje</h2>
          <p className="text-sm text-muted-foreground">Resumo operacional para o turno atual</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => onNavigate?.('/agenda')}
        >
          Abrir agenda
        </button>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-destructive">{error}</div>
      ) : (
        <>
          <div className="grid gap-3 border-b p-4 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Próximo horário</p>
              <p className="mt-1 truncate text-sm font-semibold">
                {upcoming ? `${upcoming.time} · ${upcoming.client}` : 'Sem próximos horários'}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Pendências</p>
              <p className="mt-1 text-sm font-semibold">{pendingCount} aguardando confirmação</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Receita prevista</p>
              <p className="mt-1 text-sm font-semibold">{formatMoney(expectedRevenue)}</p>
            </div>
          </div>
          {appointments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum agendamento hoje.</p>
              <button
                type="button"
                className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                onClick={() => onNavigate?.('/agenda')}
              >
                Criar agendamento
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {appointments.map((apt) => (
                <div key={apt.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50">
                  <div className="w-14 text-sm font-medium text-primary">{apt.time}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{apt.client}</p>
                    <p className="text-sm text-muted-foreground">
                      {apt.service}{apt.duration ? ` • ${apt.duration}` : ''}
                    </p>
                  </div>
                  {apt.orderTotal > 0 && (
                    <div className="hidden text-sm font-medium sm:block">{formatMoney(apt.orderTotal)}</div>
                  )}
                  {apt.stylist && (
                    <div className="hidden text-sm text-muted-foreground sm:block">{apt.stylist}</div>
                  )}
                  <span
                    className={apt.status === 'confirmed'
                      ? 'inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground'
                      : 'inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground'}
                  >
                    {apt.status === 'confirmed' ? 'confirmado' : apt.status === 'cancelled' ? 'cancelado' : 'pendente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
