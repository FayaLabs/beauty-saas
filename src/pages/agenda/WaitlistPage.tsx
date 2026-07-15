import React, { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarPlus, Check, ExternalLink, Filter, Inbox, ListPlus, PhoneCall, UserRound, X } from 'lucide-react'
import { Badge, Card, CardContent } from '@fayz-ai/ui'
import { getActiveTenantId, getSupabaseClientOptional } from '@fayz-ai/saas'
import { tl } from '../../i18n/tl'

interface WaitlistRow {
  waitlistId: string
  clientId?: string
  professionalId?: string
  serviceId?: string
  locationId?: string
  clientName?: string
  professionalName?: string
  serviceName?: string
  requestedDate?: string
  preferredStartTime?: string
  preferredEndTime?: string
  priority: number
  status: string
  notes?: string
  convertedBookingId?: string
  lastContactedAt?: string
  reminderQueuedAt?: string
}

type WaitlistStatusFilter = 'all' | 'waiting' | 'contacted' | 'scheduled' | 'cancelled'

function formatDate(value?: string): string {
  if (!value) return tl('Flexible date', 'Data flexivel')
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatWindow(row: WaitlistRow): string {
  if (row.preferredStartTime && row.preferredEndTime) {
    return `${row.preferredStartTime} - ${row.preferredEndTime}`
  }
  if (row.preferredStartTime) return tl('From ', 'A partir de ') + row.preferredStartTime
  if (row.preferredEndTime) return tl('Until ', 'Ate ') + row.preferredEndTime
  return tl('Any time', 'Qualquer horario')
}

function formatDateTime(value?: string): string | undefined {
  if (!value) return undefined
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'contacted':
      return tl('Contacted', 'Contatado')
    case 'scheduled':
      return tl('Scheduled', 'Agendado')
    case 'cancelled':
      return tl('Cancelled', 'Cancelado')
    case 'waiting':
    default:
      return tl('Waiting', 'Aguardando')
  }
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'scheduled') return 'default'
  if (status === 'contacted') return 'secondary'
  if (status === 'cancelled') return 'destructive'
  return 'outline'
}

async function loadWaitlist(): Promise<WaitlistRow[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let query = supabase
    .from('rep_waitlist_queue')
    .select('waitlist_id, client_id, professional_id, service_id, location_id, client_name, professional_name, service_name, requested_date, preferred_start_time, preferred_end_time, priority, status, notes, converted_booking_id, metadata')
    .order('status', { ascending: true })
    .order('priority', { ascending: false })
    .order('requested_date', { ascending: true, nullsFirst: false })
    .limit(100)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    return {
      waitlistId: String(row.waitlist_id),
      clientId: row.client_id ?? undefined,
      professionalId: row.professional_id ?? undefined,
      serviceId: row.service_id ?? undefined,
      locationId: row.location_id ?? undefined,
      clientName: row.client_name ?? undefined,
      professionalName: row.professional_name ?? undefined,
      serviceName: row.service_name ?? undefined,
      requestedDate: row.requested_date ?? undefined,
      preferredStartTime: row.preferred_start_time ?? undefined,
      preferredEndTime: row.preferred_end_time ?? undefined,
      priority: Number(row.priority ?? 0),
      status: row.status ?? 'waiting',
      notes: row.notes ?? undefined,
      convertedBookingId: row.converted_booking_id ?? undefined,
      lastContactedAt: typeof metadata.lastContactedAt === 'string' ? metadata.lastContactedAt : undefined,
      reminderQueuedAt: typeof metadata.reminderQueuedAt === 'string' ? metadata.reminderQueuedAt : undefined,
    }
  })
}

async function updateWaitlistStatus(waitlistId: string, status: 'contacted' | 'cancelled') {
  const supabase = getSupabaseClientOptional() as any
  const tenantId = getActiveTenantId()
  if (!supabase || !tenantId) throw new Error('Supabase client or tenant is unavailable')

  const payload: Record<string, unknown> = { status }
  if (status === 'contacted') {
    const { data } = await supabase
      .from('appointment_waitlist_entries')
      .select('metadata')
      .eq('id', waitlistId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    const metadata = data?.metadata && typeof data.metadata === 'object' ? data.metadata : {}
    payload.metadata = {
      ...metadata,
      lastContactedAt: new Date().toISOString(),
    }
  }

  const { error } = await supabase
    .from('appointment_waitlist_entries')
    .update(payload)
    .eq('id', waitlistId)
    .eq('tenant_id', tenantId)

  if (error) throw error
}

async function queueWaitlistReminder(row: WaitlistRow) {
  const supabase = getSupabaseClientOptional() as any
  const tenantId = getActiveTenantId()
  if (!supabase || !tenantId) throw new Error('Supabase client or tenant is unavailable')

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user?.id) throw authError ?? new Error('Authenticated user is unavailable')

  const queuedAt = new Date().toISOString()
  const clientName = row.clientName ?? tl('waitlist client', 'cliente da lista de espera')
  const serviceName = row.serviceName ?? tl('requested service', 'servico solicitado')
  const bodyParts = [
    `${serviceName} · ${formatDate(row.requestedDate)} · ${formatWindow(row)}`,
    row.notes,
  ].filter(Boolean)

  const { data } = await supabase
    .from('appointment_waitlist_entries')
    .select('metadata')
    .eq('id', row.waitlistId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const metadata = data?.metadata && typeof data.metadata === 'object' ? data.metadata : {}

  const { error: updateError } = await supabase
    .from('appointment_waitlist_entries')
    .update({
      metadata: {
        ...metadata,
        reminderQueuedAt: queuedAt,
      },
    })
    .eq('id', row.waitlistId)
    .eq('tenant_id', tenantId)
  if (updateError) throw updateError

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert({
      tenant_id: tenantId,
      user_id: authData.user.id,
      title: tl('Follow up waitlist client', 'Retomar cliente da lista de espera'),
      body: `${clientName}: ${bodyParts.join('\n')}`,
      type: 'agenda_waitlist',
    })

  if (notificationError) throw notificationError
}

function openAgenda(row: WaitlistRow) {
  const startsAt = row.requestedDate
    ? new Date(`${row.requestedDate.slice(0, 10)}T${row.preferredStartTime ?? '09:00'}:00`).toISOString()
    : undefined
  window.location.hash = '/agenda'
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('agenda:open-booking', {
      detail: {
        bookingId: row.convertedBookingId,
        clientId: row.clientId,
        professionalId: row.professionalId,
        locationId: row.locationId,
        startsAt,
        source: 'waitlist',
        waitlistId: row.waitlistId,
      },
    }))
  }, 100)
}

export function WaitlistPage() {
  const [rows, setRows] = useState<WaitlistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<WaitlistStatusFilter>('all')

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const next = await loadWaitlist()
        if (mounted) setRows(next)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  const summary = useMemo(() => ({
    all: rows.length,
    waiting: rows.filter((row) => row.status === 'waiting').length,
    contacted: rows.filter((row) => row.status === 'contacted').length,
    scheduled: rows.filter((row) => row.status === 'scheduled').length,
    cancelled: rows.filter((row) => row.status === 'cancelled').length,
  }), [rows])

  const statusFilters = useMemo(() => [
    { id: 'all' as const, label: tl('All', 'Todos'), count: summary.all },
    { id: 'waiting' as const, label: tl('Waiting', 'Aguardando'), count: summary.waiting },
    { id: 'contacted' as const, label: tl('Contacted', 'Contatados'), count: summary.contacted },
    { id: 'scheduled' as const, label: tl('Scheduled', 'Agendados'), count: summary.scheduled },
    { id: 'cancelled' as const, label: tl('Cancelled', 'Cancelados'), count: summary.cancelled },
  ], [summary])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((row) => row.status === statusFilter)
  }, [rows, statusFilter])

  async function handleStatus(row: WaitlistRow, status: 'contacted' | 'cancelled') {
    setSavingId(row.waitlistId)
    setSaveError(null)
    try {
      await updateWaitlistStatus(row.waitlistId, status)
      const next = await loadWaitlist()
      setRows(next)
    } catch {
      setSaveError(tl('Could not update waitlist status.', 'Nao foi possivel atualizar o status da lista de espera.'))
    } finally {
      setSavingId(null)
    }
  }

  async function handleReminder(row: WaitlistRow) {
    setSavingId(row.waitlistId)
    setSaveError(null)
    try {
      await queueWaitlistReminder(row)
      const next = await loadWaitlist()
      setRows(next)
    } catch {
      setSaveError(tl('Could not queue waitlist reminder.', 'Nao foi possivel criar o lembrete da lista de espera.'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main className="space-y-5 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            {tl('Waitlist queue', 'Fila da lista de espera')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tl('Prioritize operational follow-up for customers waiting for a cancellation or better appointment slot.', 'Priorize o acompanhamento operacional de clientes aguardando encaixe, cancelamento ou melhor horario.')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => { window.location.hash = '/agenda/waitlist/entries' }}
        >
          <ListPlus className="h-4 w-4" />
          {tl('New waitlist entry', 'Nova entrada')}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Waiting', 'Aguardando')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.waiting}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Contacted', 'Contatados')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.contacted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Scheduled', 'Agendados')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.scheduled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Cancelled', 'Cancelados')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.cancelled}</p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          {tl('Queue filter', 'Filtro da fila')}
        </div>
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => {
            const active = filter.id === statusFilter
            return (
              <button
                key={filter.id}
                type="button"
                className={`inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors ${
                  active
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
                onClick={() => setStatusFilter(filter.id)}
                aria-pressed={active}
              >
                {filter.label}
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {filter.count}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {saveError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
            {tl('Loading waitlist...', 'Carregando lista de espera...')}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {tl('No waitlist entries found.', 'Nenhuma entrada na lista de espera.')}
              </p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {tl(
                  'Create entries as clients ask for earlier or preferred times. Use this queue to follow up and convert the request into an appointment.',
                  'Crie entradas quando clientes pedirem horarios melhores ou antecipados. Use esta fila para acompanhar e converter a solicitação em agendamento.',
                )}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                onClick={() => { window.location.hash = '/agenda/waitlist/entries' }}
              >
                <ListPlus className="h-4 w-4" />
                {tl('New waitlist entry', 'Nova entrada')}
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => { window.location.hash = '/agenda' }}
              >
                <CalendarPlus className="h-4 w-4" />
                {tl('Open agenda', 'Abrir agenda')}
              </button>
            </div>
          </CardContent>
        </Card>
      ) : filteredRows.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Inbox className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {tl('No entries in this status.', 'Nenhuma entrada neste status.')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tl('Change the queue filter to review another operational lane without leaving the waitlist queue.', 'Troque o filtro da fila para revisar outra faixa operacional sem sair da lista de espera.')}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => setStatusFilter('all')}
            >
              <Inbox className="h-4 w-4" />
              {tl('Show all entries', 'Mostrar todas')}
            </button>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          {filteredRows.map((row) => (
            <Card key={row.waitlistId}>
              <CardContent className="flex gap-4 p-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Inbox className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {row.clientName ?? tl('Client not identified', 'Cliente nao identificado')}
                    </h2>
                    <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
                    {row.priority > 0 && <Badge variant="secondary">{tl('Priority', 'Prioridade')} {row.priority}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.serviceName ?? tl('Service not selected', 'Servico nao selecionado')} · {formatDate(row.requestedDate)} · {formatWindow(row)}
                  </p>
                  {(() => {
                    const contactedAt = formatDateTime(row.lastContactedAt)
                    const reminderAt = formatDateTime(row.reminderQueuedAt)
                    if (!contactedAt && !reminderAt) return null

                    return (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {contactedAt && (
                          <span className="inline-flex items-center gap-1.5">
                            <PhoneCall className="h-3.5 w-3.5" />
                            {tl('Last contact ', 'Ultimo contato ')}{contactedAt}
                          </span>
                        )}
                        {reminderAt && (
                          <span className="inline-flex items-center gap-1.5">
                            <Bell className="h-3.5 w-3.5" />
                            {tl('Reminder queued ', 'Lembrete criado ')}{reminderAt}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {row.professionalName && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        {row.professionalName}
                      </span>
                    )}
                    {row.notes && <span className="line-clamp-2">{row.notes}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {row.status === 'waiting' && (
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-60"
                      disabled={savingId === row.waitlistId}
                      onClick={() => { void handleStatus(row, 'contacted') }}
                    >
                      <Check className="h-4 w-4" />
                      {tl('Contacted', 'Contatado')}
                    </button>
                  )}
                  {row.status !== 'scheduled' && row.status !== 'cancelled' && (
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-60"
                      disabled={savingId === row.waitlistId}
                      onClick={() => { void handleReminder(row) }}
                    >
                      <Bell className="h-4 w-4" />
                      {tl('Reminder', 'Lembrete')}
                    </button>
                  )}
                  {row.status !== 'scheduled' && row.status !== 'cancelled' && (
                    <button
                      type="button"
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-destructive/40 bg-background px-3 text-sm font-medium text-destructive shadow-sm transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-60"
                      disabled={savingId === row.waitlistId}
                      onClick={() => { void handleStatus(row, 'cancelled') }}
                    >
                      <X className="h-4 w-4" />
                      {tl('Cancel', 'Cancelar')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    onClick={() => { window.location.hash = `/agenda/waitlist/entries/${row.waitlistId}` }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {tl('Edit', 'Editar')}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    onClick={() => openAgenda(row)}
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {tl('Schedule', 'Agendar')}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  )
}
