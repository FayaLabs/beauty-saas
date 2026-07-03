import React, { useEffect, useMemo, useState } from 'react'
import { CalendarX, Check, CircleDollarSign, Clock, ExternalLink, UserRound } from 'lucide-react'
import { Badge, Card, CardContent } from '@fayz-ai/ui'
import { getActiveTenantId, getSupabaseClientOptional } from '@fayz-ai/saas'
import { tl } from '../../i18n/tl'

interface CancellationRow {
  bookingId: string
  startsAt?: string
  clientName?: string
  professionalName?: string
  serviceName?: string
  reasonId?: string
  reason?: string
  cancellationNotes?: string
  cancelledAt?: string
  lostRevenue?: number
}

interface CancellationReason {
  id: string
  name: string
  requiresNotes: boolean
}

interface CancellationFormState {
  reasonId: string
  notes: string
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

function formatCurrency(value?: number): string | undefined {
  if (value == null || Number.isNaN(value) || value <= 0) return undefined
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

async function loadCancellations(): Promise<CancellationRow[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let query = supabase
    .from('rep_cancellations')
    .select('booking_id, starts_at, client_name, professional_name, service_name, cancellation_reason_id, reason, cancellation_notes, cancelled_at, lost_revenue')
    .order('starts_at', { ascending: false })
    .limit(50)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => ({
    bookingId: String(row.booking_id),
    startsAt: row.starts_at ?? undefined,
    clientName: row.client_name ?? undefined,
    professionalName: row.professional_name ?? undefined,
    serviceName: row.service_name ?? undefined,
    reasonId: row.cancellation_reason_id ?? undefined,
    reason: row.reason ?? undefined,
    cancellationNotes: row.cancellation_notes ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    lostRevenue: typeof row.lost_revenue === 'number' ? row.lost_revenue : Number(row.lost_revenue ?? 0),
  }))
}

async function loadCancellationReasons(): Promise<CancellationReason[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let query = supabase
    .from('appointment_cancellation_reasons')
    .select('id, name, requires_notes')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    requiresNotes: Boolean(row.requires_notes),
  }))
}

async function saveCancellationContext(bookingId: string, state: CancellationFormState, cancelledAt?: string) {
  const supabase = getSupabaseClientOptional() as any
  const tenantId = getActiveTenantId()
  if (!supabase || !tenantId || !state.reasonId) return

  const { error } = await supabase
    .from('appointments')
    .upsert({
      booking_id: bookingId,
      tenant_id: tenantId,
      cancellation_reason_id: state.reasonId,
      cancellation_notes: state.notes.trim() || null,
      cancelled_at: cancelledAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'booking_id' })

  if (error) throw error
}

function openAgendaBooking(bookingId: string) {
  window.location.hash = '/agenda'
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('agenda:open-booking', { detail: { bookingId } }))
  }, 100)
}

export function CancellationsFollowUpPage() {
  const [rows, setRows] = useState<CancellationRow[]>([])
  const [reasons, setReasons] = useState<CancellationReason[]>([])
  const [forms, setForms] = useState<Record<string, CancellationFormState>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const [nextRows, nextReasons] = await Promise.all([
          loadCancellations(),
          loadCancellationReasons(),
        ])
        if (mounted) {
          setRows(nextRows)
          setReasons(nextReasons)
          setForms(Object.fromEntries(nextRows.map((row) => [
            row.bookingId,
            {
              reasonId: row.reasonId ?? '',
              notes: row.cancellationNotes ?? '',
            },
          ])))
        }
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
    const lostRevenue = rows.reduce((sum, row) => sum + (row.lostRevenue ?? 0), 0)
    const missingReasonCount = rows.filter((row) => !row.reason).length
    return { lostRevenue, missingReasonCount }
  }, [rows])

  async function handleSave(row: CancellationRow) {
    const form = forms[row.bookingId]
    if (!form?.reasonId) return

    setSavingId(row.bookingId)
    setSaveError(null)
    try {
      await saveCancellationContext(row.bookingId, form, row.cancelledAt)
      const nextRows = await loadCancellations()
      setRows(nextRows)
      setForms((current) => ({
        ...current,
        ...Object.fromEntries(nextRows.map((nextRow) => [
          nextRow.bookingId,
          {
            reasonId: nextRow.reasonId ?? current[nextRow.bookingId]?.reasonId ?? '',
            notes: nextRow.cancellationNotes ?? current[nextRow.bookingId]?.notes ?? '',
          },
        ])),
      }))
    } catch {
      setSaveError(tl('Could not save cancellation context.', 'Nao foi possivel salvar o contexto do cancelamento.'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main className="space-y-5 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            {tl('Cancellation follow-up', 'Acompanhamento de cancelamentos')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tl('Review cancelled appointments, add the missing reason, and keep follow-up notes ready for the team.', 'Revise agendamentos cancelados, adicione o motivo pendente e mantenha as observacoes prontas para a equipe.')}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => { window.location.hash = '/settings/agenda/_properties/cancellation-reasons' }}
        >
          <CalendarX className="h-4 w-4" />
          {tl('Manage reasons', 'Gerenciar motivos')}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Cancelled appointments', 'Agendamentos cancelados')}</p>
            <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Missing reason', 'Sem motivo')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.missingReasonCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Lost revenue', 'Receita perdida')}</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.lostRevenue) ?? 'R$ 0,00'}</p>
          </CardContent>
        </Card>
      </section>

      {saveError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
            {tl('Loading cancellations...', 'Carregando cancelamentos...')}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
            {tl('No cancelled appointments found yet.', 'Nenhum agendamento cancelado encontrado.')}
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          {rows.map((row) => {
            const lostRevenue = formatCurrency(row.lostRevenue)
            return (
              <Card key={row.bookingId}>
                <CardContent className="flex gap-4 p-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <CalendarX className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-foreground">
                        {row.clientName ?? tl('Client not identified', 'Cliente nao identificado')}
                      </h2>
                      <Badge variant={row.reason ? 'secondary' : 'outline'}>
                        {row.reason ?? tl('Reason pending', 'Motivo pendente')}
                      </Badge>
                      {lostRevenue && <Badge variant="outline">{lostRevenue}</Badge>}
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
                      {row.cancelledAt && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDateTime(row.cancelledAt)}
                        </span>
                      )}
                      {lostRevenue && (
                        <span className="inline-flex items-center gap-1.5">
                          <CircleDollarSign className="h-3.5 w-3.5" />
                          {lostRevenue}
                        </span>
                      )}
                    </div>
                    {row.cancellationNotes && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{row.cancellationNotes}</p>
                    )}
                    <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(180px,260px)_1fr_auto]">
                      <select
                        value={forms[row.bookingId]?.reasonId ?? ''}
                        onChange={(event) => {
                          const reasonId = event.target.value
                          setForms((current) => ({
                            ...current,
                            [row.bookingId]: {
                              reasonId,
                              notes: current[row.bookingId]?.notes ?? '',
                            },
                          }))
                        }}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">{tl('Select reason', 'Selecionar motivo')}</option>
                        {reasons.map((reason) => (
                          <option key={reason.id} value={reason.id}>
                            {reason.name}{reason.requiresNotes ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                      <input
                        value={forms[row.bookingId]?.notes ?? ''}
                        onChange={(event) => {
                          const notes = event.target.value
                          setForms((current) => ({
                            ...current,
                            [row.bookingId]: {
                              reasonId: current[row.bookingId]?.reasonId ?? '',
                              notes,
                            },
                          }))
                        }}
                        placeholder={tl('Cancellation notes', 'Observacoes do cancelamento')}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!forms[row.bookingId]?.reasonId || savingId === row.bookingId}
                        onClick={() => { void handleSave(row) }}
                      >
                        <Check className="h-4 w-4" />
                        {savingId === row.bookingId ? tl('Saving', 'Salvando') : tl('Save', 'Salvar')}
                      </button>
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
            )
          })}
        </section>
      )}
    </main>
  )
}
