import React, { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Loader2,
  Scissors,
  User,
} from 'lucide-react'
import {
  createBooking,
  getAvailableSlots,
  listBookableServices,
  listProfessionals,
  type BookableProfessional,
  type BookableService,
  type TimeSlot,
} from '../lib/booking'
import { tl } from '../i18n/tl'

type Step = 'service' | 'professional' | 'date' | 'time' | 'client' | 'success'

interface ClientForm {
  name: string
  phone: string
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// Next `count` selectable dates as local "YYYY-MM-DD" keys (today included).
function upcomingDates(count: number): { iso: string; label: string }[] {
  const today = new Date()
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const label = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
    return { iso, label }
  })
}

// Tenant the booking writes to. For a public link this is carried on the URL
// (?tenant=…), mirroring beautyplace's per-config booking pages; falls back to a
// build-time default for single-tenant deployments.
function resolveTenantId(): string | undefined {
  const fromUrl =
    typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('tenant') : null
  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DEFAULT_TENANT_ID
  return fromUrl?.trim() || fromEnv?.trim() || undefined
}

export function PublicBooking() {
  const tenantId = useMemo(resolveTenantId, [])
  const dates = useMemo(() => upcomingDates(14), [])

  const [step, setStep] = useState<Step>('service')
  const [services, setServices] = useState<BookableService[]>([])
  const [professionals, setProfessionals] = useState<BookableProfessional[]>([])
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [service, setService] = useState<BookableService | null>(null)
  const [professional, setProfessional] = useState<BookableProfessional | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [slot, setSlot] = useState<TimeSlot | null>(null)
  const [clientForm, setClientForm] = useState<ClientForm>({ name: '', phone: '' })

  // Load catalog (services + professionals) up front.
  useEffect(() => {
    Promise.all([listBookableServices(), listProfessionals()])
      .then(([svc, pros]) => {
        setServices(svc)
        setProfessionals(pros)
      })
      .catch(() => setError(tl('Could not load booking options.', 'Não foi possível carregar as opções.')))
  }, [])

  // Recompute available slots whenever (professional, date, service) are set.
  useEffect(() => {
    if (step !== 'time' || !professional || !date || !service) return
    setLoadingSlots(true)
    setError(null)
    getAvailableSlots({
      professionalId: professional.id,
      dateISO: date,
      durationMinutes: service.durationMinutes,
    })
      .then(setSlots)
      .catch(() => setError(tl('Could not load available times.', 'Não foi possível carregar os horários.')))
      .finally(() => setLoadingSlots(false))
  }, [step, professional, date, service])

  async function handleConfirm() {
    if (!service || !professional || !slot) return
    if (!tenantId) {
      setError(tl('Missing salon reference in the booking link.', 'Link de agendamento sem referência do salão.'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createBooking({
        tenantId,
        professionalId: professional.id,
        service,
        startsAt: slot.startsAt,
        clientName: clientForm.name.trim() || undefined,
        notes: clientForm.phone.trim() ? `Tel: ${clientForm.phone.trim()}` : undefined,
      })
      setStep('success')
    } catch {
      setError(tl('Could not confirm the booking. Please try again.', 'Não foi possível confirmar. Tente novamente.'))
    } finally {
      setSubmitting(false)
    }
  }

  const stepBack: Partial<Record<Step, Step>> = {
    professional: 'service',
    date: 'professional',
    time: 'date',
    client: 'time',
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        {stepBack[step] && (
          <button
            type="button"
            onClick={() => setStep(stepBack[step] as Step)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {tl('Back', 'Voltar')}
          </button>
        )}
        <h1 className="text-2xl font-bold text-foreground">{tl('Book an appointment', 'Agendar horário')}</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-card border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {step === 'service' && (
        <section className="space-y-2">
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Scissors className="h-4 w-4" /> {tl('Choose a service', 'Escolha um serviço')}
          </p>
          {services.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => {
                setService(svc)
                setStep('professional')
              }}
              className="flex w-full items-center justify-between rounded-card border border-border bg-card p-4 text-left hover:border-primary"
            >
              <span className="font-medium text-foreground">{svc.name}</span>
              <span className="text-sm text-muted-foreground">
                {formatDuration(svc.durationMinutes)} · {formatPrice(svc.price)}
              </span>
            </button>
          ))}
        </section>
      )}

      {step === 'professional' && (
        <section className="space-y-2">
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" /> {tl('Choose a professional', 'Escolha um profissional')}
          </p>
          {professionals.map((pro) => (
            <button
              key={pro.id}
              type="button"
              onClick={() => {
                setProfessional(pro)
                setStep('date')
              }}
              className="flex w-full items-center rounded-card border border-border bg-card p-4 text-left font-medium text-foreground hover:border-primary"
            >
              {pro.name}
            </button>
          ))}
        </section>
      )}

      {step === 'date' && (
        <section>
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" /> {tl('Choose a date', 'Escolha uma data')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {dates.map((d) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => {
                  setDate(d.iso)
                  setStep('time')
                }}
                className="rounded-card border border-border bg-card p-3 text-center text-sm capitalize text-foreground hover:border-primary"
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'time' && (
        <section>
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> {tl('Choose a time', 'Escolha um horário')}
          </p>
          {loadingSlots ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.length === 0 ? (
            <p className="rounded-card border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {tl('No times available on this day.', 'Sem horários disponíveis neste dia.')}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  onClick={() => {
                    setSlot(s)
                    setStep('client')
                  }}
                  className="rounded-card border border-border bg-card p-2 text-center text-sm text-foreground hover:border-primary"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 'client' && (
        <section className="space-y-4">
          <p className="text-sm text-muted-foreground">{tl('Your details', 'Seus dados')}</p>
          <div className="rounded-card border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{service?.name}</p>
            <p>
              {professional?.name} · {slot?.label} ·{' '}
              {date && new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">{tl('Name', 'Nome')}</label>
            <input
              value={clientForm.name}
              onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-card border border-border bg-background p-2 text-foreground"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">{tl('Phone', 'Telefone')}</label>
            <input
              value={clientForm.phone}
              onChange={(e) => setClientForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full rounded-card border border-border bg-background p-2 text-foreground"
            />
          </div>
          <button
            type="button"
            disabled={submitting || !clientForm.name.trim()}
            onClick={handleConfirm}
            className="flex w-full items-center justify-center gap-2 rounded-card bg-primary p-3 font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {tl('Confirm booking', 'Confirmar agendamento')}
          </button>
        </section>
      )}

      {step === 'success' && (
        <section className="rounded-card border border-border bg-card p-8 text-center">
          <Check className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="text-lg font-semibold text-foreground">
            {tl('Appointment confirmed!', 'Agendamento confirmado!')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {service?.name} · {professional?.name} · {slot?.label}
          </p>
        </section>
      )}
    </div>
  )
}
