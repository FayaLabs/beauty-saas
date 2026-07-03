import React, { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, Clock, ExternalLink, MessageCircle, UserRound } from 'lucide-react'
import { Badge, Card, CardContent } from '@fayz-ai/ui'
import { getActiveTenantId, getSupabaseClientOptional } from '@fayz-ai/saas'
import { tl } from '../../i18n/tl'

interface ConfirmationRow {
  bookingId: string
  startsAt?: string
  clientName?: string
  professionalName?: string
  serviceName?: string
  confirmationStatus?: string
  confirmationChannel?: string
  confirmationSentAt?: string
  confirmedAt?: string
}

function formatDateTime(value?: string): string {
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

function statusLabel(status?: string): string {
  switch (status) {
    case 'confirmed':
      return tl('Confirmed', 'Confirmado')
    case 'sent':
      return tl('Sent', 'Enviado')
    case 'failed':
      return tl('Failed', 'Falhou')
    case 'declined':
      return tl('Declined', 'Recusado')
    case 'pending':
    default:
      return tl('Pending', 'Pendente')
  }
}

function statusVariant(status?: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'confirmed') return 'default'
  if (status === 'failed' || status === 'declined') return 'destructive'
  if (status === 'sent') return 'secondary'
  return 'outline'
}

async function loadConfirmations(): Promise<ConfirmationRow[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let query = supabase
    .from('rep_confirmation_queue')
    .select('booking_id, starts_at, client_name, professional_name, service_name, confirmation_status, confirmation_channel, confirmation_sent_at, confirmed_at')
    .order('starts_at', { ascending: true })
    .limit(75)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => ({
    bookingId: String(row.booking_id),
    startsAt: row.starts_at ?? undefined,
    clientName: row.client_name ?? undefined,
    professionalName: row.professional_name ?? undefined,
    serviceName: row.service_name ?? undefined,
    confirmationStatus: row.confirmation_status ?? 'pending',
    confirmationChannel: row.confirmation_channel ?? undefined,
    confirmationSentAt: row.confirmation_sent_at ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
  }))
}

function openAgendaBooking(bookingId: string) {
  window.location.hash = '/agenda'
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('agenda:open-booking', { detail: { bookingId } }))
  }, 100)
}

export function ConfirmationsPage() {
  const [rows, setRows] = useState<ConfirmationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const next = await loadConfirmations()
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

  const summary = useMemo(() => {
    const pending = rows.filter((row) => !row.confirmationStatus || row.confirmationStatus === 'pending').length
    const sent = rows.filter((row) => row.confirmationStatus === 'sent').length
    const confirmed = rows.filter((row) => row.confirmationStatus === 'confirmed').length
    return { pending, sent, confirmed }
  }, [rows])

  return (
    <main className="space-y-5 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            {tl('Confirmation queue', 'Lista de confirmações')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tl('Track upcoming appointments that still need customer confirmation.', 'Acompanhe agendamentos futuros que ainda precisam de confirmação do cliente.')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => { window.location.hash = '/settings/agenda/_properties/confirmation-channels' }}
        >
          <MessageCircle className="h-4 w-4" />
          {tl('Manage channels', 'Gerenciar canais')}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Pending', 'Pendentes')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Sent', 'Enviados')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Confirmed', 'Confirmados')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.confirmed}</p>
          </CardContent>
        </Card>
      </section>

      {loading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
            {tl('Loading confirmations...', 'Carregando confirmações...')}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
            {tl('No upcoming confirmations found.', 'Nenhuma confirmação futura encontrada.')}
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          {rows.map((row) => (
            <Card key={row.bookingId}>
              <CardContent className="flex gap-4 p-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <CalendarCheck2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {row.clientName ?? tl('Client not identified', 'Cliente nao identificado')}
                    </h2>
                    <Badge variant={statusVariant(row.confirmationStatus)}>
                      {statusLabel(row.confirmationStatus)}
                    </Badge>
                    {row.confirmationChannel && <Badge variant="outline">{row.confirmationChannel}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.serviceName ?? tl('Appointment', 'Agendamento')} · {formatDateTime(row.startsAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {row.professionalName && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        {row.professionalName}
                      </span>
                    )}
                    {row.confirmationSentAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {tl('Sent', 'Enviado')}: {formatDateTime(row.confirmationSentAt)}
                      </span>
                    )}
                    {row.confirmedAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {tl('Confirmed', 'Confirmado')}: {formatDateTime(row.confirmedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => openAgendaBooking(row.bookingId)}
                >
                  <ExternalLink className="h-4 w-4" />
                  {tl('Open', 'Abrir')}
                </button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  )
}
