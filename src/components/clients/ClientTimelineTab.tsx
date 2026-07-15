import React, { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, CircleDashed, MessageSquare, UserX } from 'lucide-react'
import { Badge, Card, CardContent } from '@fayz-ai/ui'
import { getActiveTenantId, getSupabaseClientOptional, type EntityDef } from '@fayz-ai/saas'
import { tl } from '../../i18n/tl'

type TimelineKind = 'appointment' | 'activity'

interface TimelineItem {
  id: string
  kind: TimelineKind
  title: string
  description?: string
  date?: string
  status?: string
}

const statusLabels: Record<string, string> = {
  scheduled: tl('Scheduled', 'Agendado'),
  confirmed: tl('Confirmed', 'Confirmado'),
  in_progress: tl('In progress', 'Em atendimento'),
  completed: tl('Completed', 'Concluido'),
  cancelled: tl('Cancelled', 'Cancelado'),
  no_show: tl('No show', 'Nao compareceu'),
}

function formatDate(value?: string): string {
  if (!value) return tl('No date', 'Sem data')
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function firstServiceName(services: unknown): string | undefined {
  if (!Array.isArray(services) || services.length === 0) return undefined
  const first = services[0] as Record<string, unknown>
  return (first.name as string | undefined) ?? (first.serviceName as string | undefined)
}

function statusIcon(status?: string) {
  switch (status) {
    case 'completed':
      return CheckCircle2
    case 'cancelled':
    case 'no_show':
      return UserX
    case 'scheduled':
    case 'confirmed':
    case 'in_progress':
      return CalendarDays
    default:
      return CircleDashed
  }
}

async function loadAppointments(clientId: string): Promise<TimelineItem[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let query = supabase
    .from('v_appointments')
    .select('id, starts_at, status, services, professional_name, location_name, notes, updated_at')
    .eq('client_id', clientId)
    .order('starts_at', { ascending: false })
    .limit(12)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => {
    const serviceName = firstServiceName(row.services)
    const parts = [row.professional_name, row.location_name].filter(Boolean)
    return {
      id: `appointment:${row.id}`,
      kind: 'appointment',
      title: serviceName ?? tl('Appointment', 'Agendamento'),
      description: parts.length > 0 ? parts.join(' • ') : row.notes ?? undefined,
      date: row.starts_at ?? row.updated_at,
      status: row.status,
    }
  })
}

async function loadActivities(clientId: string): Promise<TimelineItem[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let query = supabase
    .from('plg_crm_activities')
    .select('id, activity_type, title, description, due_date, completed_at, created_at')
    .eq('contact_id', clientId)
    .order('created_at', { ascending: false })
    .limit(12)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => ({
    id: `activity:${row.id}`,
    kind: 'activity',
    title: row.title ?? row.activity_type ?? tl('Interaction', 'Interacao'),
    description: row.description ?? undefined,
    date: row.completed_at ?? row.due_date ?? row.created_at,
    status: row.completed_at ? 'completed' : row.activity_type,
  }))
}

export function ClientTimelineTab({
  item,
}: {
  item: unknown
  entityDef: EntityDef
}) {
  const client = item as Record<string, unknown>
  const clientId = String(client.id ?? client.personId ?? '')
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const [appointments, activities] = await Promise.all([
          loadAppointments(clientId),
          loadActivities(clientId),
        ])
        const next = [...appointments, ...activities]
          .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
          .slice(0, 20)
        if (mounted) setItems(next)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (clientId) void load()
    else setLoading(false)

    return () => {
      mounted = false
    }
  }, [clientId])

  const emptyMessage = useMemo(() => {
    if (loading) return tl('Loading client timeline...', 'Carregando linha do tempo do cliente...')
    return tl('No appointments or interactions found for this client yet.', 'Nenhum agendamento ou interacao encontrado para este cliente ainda.')
  }, [loading])

  if (loading || items.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-0">
        {items.map((entry, index) => {
          const Icon = entry.kind === 'activity' ? MessageSquare : statusIcon(entry.status)
          const status = entry.status ? (statusLabels[entry.status] ?? entry.status) : undefined
          const kindLabel = entry.kind === 'activity' ? tl('Activity', 'Atividade') : tl('Booking', 'Agendamento')
          const isFirst = index === 0
          const isLast = index === items.length - 1

          return (
            <li key={entry.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4">
              <div className="relative flex justify-center">
                {!isFirst && <span className="absolute top-0 h-5 w-px bg-border" aria-hidden="true" />}
                {!isLast && <span className="absolute bottom-0 top-10 w-px bg-border" aria-hidden="true" />}
                <div className="relative z-10 mt-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-sm">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <Card className={isLast ? 'mb-0' : 'mb-4'}>
                <CardContent className="p-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{kindLabel}</Badge>
                        {status && <Badge variant="secondary">{status}</Badge>}
                      </div>
                      <h3 className="mt-2 truncate text-sm font-semibold text-foreground">{entry.title}</h3>
                    </div>
                    <time className="shrink-0 text-xs font-medium text-muted-foreground">
                      {formatDate(entry.date)}
                    </time>
                  </div>
                  {entry.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{entry.description}</p>
                  )}
                </CardContent>
              </Card>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
