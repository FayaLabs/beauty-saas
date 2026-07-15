import React, { useEffect, useMemo, useState } from 'react'
import { Boxes, CalendarPlus, ClipboardCheck, ExternalLink, FileCheck2, UserRound } from 'lucide-react'
import { Badge, Card, CardContent } from '@fayz-ai/ui'
import { getActiveTenantId, getSupabaseClientOptional } from '@fayz-ai/saas'
import { tl } from '../../i18n/tl'

interface BookingService {
  serviceId?: string
  name?: string
}

interface ExecutionDefaultProduct {
  serviceId: string
  productId: string
  productName?: string
  quantity?: number
  unit?: string
  deductionTiming?: string
  isRequired: boolean
}

interface ExecutionDefaultTemplate {
  serviceId: string
  templateId: string
  templateName?: string
  templateKind?: string
  trigger?: string
  isRequired: boolean
}

interface ExecutionBooking {
  bookingId: string
  tenantId?: string
  clientId?: string
  startsAt?: string
  status?: string
  clientName?: string
  professionalName?: string
  services: BookingService[]
  products: ExecutionDefaultProduct[]
  templates: ExecutionDefaultTemplate[]
  checklist: ExecutionChecklistState
  stockDeductionStatus?: string
  executionStatus?: string
}

interface ExecutionChecklistState {
  forms?: boolean
  contracts?: boolean
  stock?: boolean
  invoice?: boolean
  notes?: string
  generatedDocuments?: Record<string, string>
  generatedStockMovements?: Record<string, string>
}

type ChecklistKey = Exclude<keyof ExecutionChecklistState, 'notes' | 'generatedDocuments'>

interface AppointmentExecutionExtension {
  booking_id: string
  execution_status?: string
  execution_checklist?: unknown
  stock_deduction_status?: string
}

function startOfToday(): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function endOfNextWeek(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  date.setHours(23, 59, 59, 999)
  return date.toISOString()
}

function formatDateTime(value?: string): string {
  if (!value) return tl('No date', 'Sem data')
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

function statusLabel(status?: string): string {
  switch (status) {
    case 'completed':
      return tl('Completed', 'Concluido')
    case 'in_progress':
      return tl('In progress', 'Em atendimento')
    case 'confirmed':
      return tl('Confirmed', 'Confirmado')
    case 'scheduled':
      return tl('Scheduled', 'Agendado')
    default:
      return status ?? tl('Scheduled', 'Agendado')
  }
}

function normalizeServices(value: unknown): BookingService[] {
  if (!Array.isArray(value)) return []
  const services: BookingService[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const serviceId = typeof row.serviceId === 'string'
      ? row.serviceId
      : typeof row.service_id === 'string'
        ? row.service_id
        : undefined
    const name = typeof row.name === 'string'
      ? row.name
      : typeof row.service_name === 'string'
        ? row.service_name
        : undefined
    if (serviceId || name) services.push({ serviceId, name })
  }
  return services
}

function serviceIdsFor(bookings: Array<Pick<ExecutionBooking, 'services'>>): string[] {
  return Array.from(new Set(bookings
    .flatMap((booking) => booking.services.map((service) => service.serviceId))
    .filter((id): id is string => !!id)))
}

function bookingServiceIds(booking: Pick<ExecutionBooking, 'services'>): string[] {
  return booking.services.map((service) => service.serviceId).filter((id): id is string => !!id)
}

function checklistIsComplete(booking: Pick<ExecutionBooking, 'products' | 'templates' | 'checklist'>): boolean {
  const requirements = getChecklistRequirements(booking)

  return (!requirements.stock || booking.checklist.stock === true)
    && (!requirements.forms || booking.checklist.forms === true)
    && (!requirements.contracts || booking.checklist.contracts === true)
}

function getChecklistRequirements(booking: Pick<ExecutionBooking, 'products' | 'templates'>) {
  const requiredTemplates = booking.templates.filter((template) => template.isRequired)

  return {
    stock: booking.products.some((product) => product.isRequired),
    forms: requiredTemplates.some((template) => template.templateKind !== 'contract'),
    contracts: requiredTemplates.some((template) => template.templateKind === 'contract'),
  }
}

function normalizeChecklist(value: unknown): ExecutionChecklistState {
  if (!value || typeof value !== 'object') return {}
  const row = value as Record<string, unknown>
  return {
    forms: typeof row.forms === 'boolean' ? row.forms : undefined,
    contracts: typeof row.contracts === 'boolean' ? row.contracts : undefined,
    stock: typeof row.stock === 'boolean' ? row.stock : undefined,
    invoice: typeof row.invoice === 'boolean' ? row.invoice : undefined,
    notes: typeof row.notes === 'string' ? row.notes : undefined,
    generatedDocuments: row.generatedDocuments && typeof row.generatedDocuments === 'object'
      ? Object.fromEntries(Object.entries(row.generatedDocuments as Record<string, unknown>).filter(([, value]) => typeof value === 'string')) as Record<string, string>
      : undefined,
    generatedStockMovements: row.generatedStockMovements && typeof row.generatedStockMovements === 'object'
      ? Object.fromEntries(Object.entries(row.generatedStockMovements as Record<string, unknown>).filter(([, value]) => typeof value === 'string')) as Record<string, string>
      : undefined,
  }
}

function groupByService<T extends { serviceId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    grouped.set(row.serviceId, [...(grouped.get(row.serviceId) ?? []), row])
  }
  return grouped
}

async function loadExecutionQueue(): Promise<ExecutionBooking[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let bookingsQuery = supabase
    .from('v_appointments')
    .select('id, tenant_id, client_id, starts_at, status, client_name, professional_name, services')
    .gte('starts_at', startOfToday())
    .lte('starts_at', endOfNextWeek())
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true })
    .limit(75)

  if (tenantId) bookingsQuery = bookingsQuery.eq('tenant_id', tenantId)

  const { data: bookingRows, error: bookingsError } = await bookingsQuery
  if (bookingsError) throw bookingsError

  const bookings: Array<Omit<ExecutionBooking, 'products' | 'templates'>> = (bookingRows ?? []).map((row: any) => ({
    bookingId: String(row.id),
    tenantId: row.tenant_id ?? undefined,
    clientId: row.client_id ?? undefined,
    startsAt: row.starts_at ?? undefined,
    status: row.status ?? undefined,
    clientName: row.client_name ?? undefined,
    professionalName: row.professional_name ?? undefined,
    services: normalizeServices(row.services),
    checklist: {},
    stockDeductionStatus: 'not_required',
    executionStatus: 'pending',
  }))
  if (bookings.length === 0) return []

  const serviceIds = serviceIdsFor(bookings)
  const bookingIds = bookings.map((booking) => booking.bookingId)

  let appointmentsQuery = supabase
    .from('appointment_execution')
    .select('booking_id, execution_status, execution_checklist, stock_deduction_status')
    .in('booking_id', bookingIds)

  if (tenantId) appointmentsQuery = appointmentsQuery.eq('tenant_id', tenantId)

  const { data: appointmentRows, error: appointmentsError } = await appointmentsQuery
  if (appointmentsError) throw appointmentsError

  const extensionByBookingId = new Map<string, AppointmentExecutionExtension>((appointmentRows ?? []).map((row: any) => [String(row.booking_id), row]))
  if (serviceIds.length === 0) {
    return bookings.map((booking) => {
      const extension = extensionByBookingId.get(booking.bookingId)
      return {
        ...booking,
        products: [],
        templates: [],
        checklist: normalizeChecklist(extension?.execution_checklist),
        stockDeductionStatus: extension?.stock_deduction_status ?? 'not_required',
        executionStatus: extension?.execution_status ?? 'pending',
      }
    })
  }

  let productsQuery = supabase
    .from('rep_service_execution_default_products')
    .select('service_id, product_id, product_name, quantity, unit, deduction_timing, is_required')
    .in('service_id', serviceIds)
    .order('sort_order', { ascending: true })

  let templatesQuery = supabase
    .from('rep_service_execution_default_templates')
    .select('service_id, template_id, template_name, template_kind, trigger, is_required')
    .in('service_id', serviceIds)
    .order('sort_order', { ascending: true })

  if (tenantId) {
    productsQuery = productsQuery.eq('tenant_id', tenantId)
    templatesQuery = templatesQuery.eq('tenant_id', tenantId)
  }

  const [
    { data: productRows, error: productsError },
    { data: templateRows, error: templatesError },
  ] = await Promise.all([productsQuery, templatesQuery])

  if (productsError) throw productsError
  if (templatesError) throw templatesError

  const products: ExecutionDefaultProduct[] = (productRows ?? []).map((row: any) => ({
    serviceId: String(row.service_id),
    productId: String(row.product_id),
    productName: row.product_name ?? undefined,
    quantity: Number(row.quantity ?? 0),
    unit: row.unit ?? undefined,
    deductionTiming: row.deduction_timing ?? undefined,
    isRequired: Boolean(row.is_required),
  }))

  const templates: ExecutionDefaultTemplate[] = (templateRows ?? []).map((row: any) => ({
    serviceId: String(row.service_id),
    templateId: String(row.template_id),
    templateName: row.template_name ?? undefined,
    templateKind: row.template_kind ?? undefined,
    trigger: row.trigger ?? undefined,
    isRequired: Boolean(row.is_required),
  }))

  const productsByService = groupByService(products)
  const templatesByService = groupByService(templates)

  return bookings.map((booking) => {
    const ids = bookingServiceIds(booking)
    const extension = extensionByBookingId.get(booking.bookingId)
    return {
      ...booking,
      products: ids.flatMap((id) => productsByService.get(id) ?? []),
      templates: ids.flatMap((id) => templatesByService.get(id) ?? []),
      checklist: normalizeChecklist(extension?.execution_checklist),
      stockDeductionStatus: extension?.stock_deduction_status ?? 'not_required',
      executionStatus: extension?.execution_status ?? 'pending',
    }
  })
}

async function saveExecutionChecklist(booking: ExecutionBooking, checklist: ExecutionChecklistState): Promise<ExecutionBooking> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return booking

  const tenantId = getActiveTenantId() ?? booking.tenantId
  if (!tenantId) throw new Error(tl('Tenant not found.', 'Empresa nao encontrada.'))

  const nextBooking: ExecutionBooking = {
    ...booking,
    checklist,
    stockDeductionStatus: checklist.stock ? 'completed' : getChecklistRequirements(booking).stock ? 'pending' : 'not_required',
  }
  nextBooking.executionStatus = checklistIsComplete(nextBooking) ? 'ready' : 'pending'

  const { error } = await supabase
    .from('appointment_execution')
    .upsert({
      booking_id: booking.bookingId,
      tenant_id: tenantId,
      execution_status: nextBooking.executionStatus,
      execution_checklist: checklist,
      stock_deduction_status: nextBooking.stockDeductionStatus,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'booking_id' })

  if (error) throw error
  return nextBooking
}

async function ensureExecutionDocuments(booking: ExecutionBooking, kind: 'forms' | 'contracts'): Promise<ExecutionBooking> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return booking

  const tenantId = getActiveTenantId() ?? booking.tenantId
  if (!tenantId) throw new Error(tl('Tenant not found.', 'Empresa nao encontrada.'))

  const templates = booking.templates.filter((template) => (
    kind === 'contracts'
      ? template.templateKind === 'contract'
      : template.templateKind !== 'contract'
  ))
  if (templates.length === 0) return booking

  const generatedDocuments = { ...(booking.checklist.generatedDocuments ?? {}) }

  for (const template of templates) {
    const metadata = {
      source: 'agenda_execution',
      bookingId: booking.bookingId,
      templateId: template.templateId,
      serviceId: template.serviceId,
      templateKind: template.templateKind ?? 'form',
    }

    let documentId: string | undefined = generatedDocuments[template.templateId]

    if (!documentId) {
      const { data: existing } = await supabase
        .from('v_documents')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('template_id', template.templateId)
        .eq('is_active', true)
        .contains('metadata', { source: 'agenda_execution', bookingId: booking.bookingId })
        .maybeSingle()

      documentId = existing?.id ? String(existing.id) : undefined
    }

    if (!documentId) {
      const { data: coreDoc, error: coreError } = await supabase
        .from('documents')
        .insert({
          tenant_id: tenantId,
          kind: template.templateKind === 'contract' ? 'contract' : 'form',
          person_id: booking.clientId ?? null,
          title: template.templateName ?? tl('Service execution document', 'Documento de atendimento'),
          status: 'draft',
          metadata,
        })
        .select('id')
        .single()

      if (coreError) throw coreError

      documentId = String(coreDoc.id)

      const { error: extensionError } = await supabase
        .from('plg_forms_documents')
        .insert({
          document_id: documentId,
          tenant_id: tenantId,
          template_id: template.templateId,
          data: {
            bookingId: booking.bookingId,
            serviceId: template.serviceId,
            generatedFrom: 'agenda_execution',
          },
        })

      if (extensionError) {
        await supabase.from('documents').delete().eq('id', documentId)
        throw extensionError
      }
    }

    generatedDocuments[template.templateId] = documentId
  }

  const nextChecklist: ExecutionChecklistState = {
    ...booking.checklist,
    [kind]: true,
    generatedDocuments,
  }

  return saveExecutionChecklist(booking, nextChecklist)
}

async function ensureStockDeduction(booking: ExecutionBooking): Promise<ExecutionBooking> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return booking

  const tenantId = getActiveTenantId() ?? booking.tenantId
  if (!tenantId) throw new Error(tl('Tenant not found.', 'Empresa nao encontrada.'))

  const products = booking.products.filter((product) => (
    product.isRequired
      && product.productId
      && product.deductionTiming !== 'manual'
      && Number(product.quantity ?? 0) > 0
  ))
  if (products.length === 0) return saveExecutionChecklist(booking, { ...booking.checklist, stock: true })

  const generatedStockMovements = { ...(booking.checklist.generatedStockMovements ?? {}) }

  for (const product of products) {
    const movementKey = `${booking.bookingId}:${product.serviceId}:${product.productId}`
    if (generatedStockMovements[movementKey]) continue

    const metadata = {
      source: 'agenda_execution',
      bookingId: booking.bookingId,
      serviceId: product.serviceId,
      productId: product.productId,
    }

    const { data: existing } = await supabase
      .from('plg_inventory_stock_movements')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('product_id', product.productId)
      .contains('metadata', metadata)
      .maybeSingle()

    let movementId = existing?.id ? String(existing.id) : undefined

    if (!movementId) {
      const quantity = Number(product.quantity ?? 0)
      const { data: movement, error: movementError } = await supabase
        .from('plg_inventory_stock_movements')
        .insert({
          tenant_id: tenantId,
          product_id: product.productId,
          quantity,
          movement_type: 'exit',
          unit_cost: 0,
          total_cost: 0,
          reason: tl('Service execution', 'Atendimento executado'),
          notes: booking.clientName
            ? tl('Generated from agenda execution checklist for ', 'Gerado pelo checklist de atendimento para ') + booking.clientName
            : tl('Generated from agenda execution checklist.', 'Gerado pelo checklist de atendimento.'),
          movement_date: new Date().toISOString().slice(0, 10),
          metadata,
        })
        .select('id')
        .single()

      if (movementError) throw movementError
      movementId = String(movement.id)

      const { data: productRow } = await supabase
        .from('products')
        .select('stock')
        .eq('id', product.productId)
        .maybeSingle()

      if (productRow) {
        await supabase
          .from('products')
          .update({ stock: Number(productRow.stock ?? 0) - quantity })
          .eq('id', product.productId)
      }
    }

    generatedStockMovements[movementKey] = movementId
  }

  return saveExecutionChecklist(booking, {
    ...booking.checklist,
    stock: true,
    generatedStockMovements,
  })
}

function openAgendaBooking(bookingId: string) {
  window.location.hash = '/agenda'
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent('agenda:open-booking', { detail: { bookingId } }))
  }, 100)
}

export function ExecutionChecklistPage() {
  const [rows, setRows] = useState<ExecutionBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const next = await loadExecutionQueue()
        if (mounted) setRows(next)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : tl('Could not load execution checklist.', 'Nao foi possivel carregar o checklist de execucao.'))
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
    bookings: rows.length,
    withProducts: rows.filter((row) => row.products.length > 0).length,
    withTemplates: rows.filter((row) => row.templates.length > 0).length,
    ready: rows.filter((row) => checklistIsComplete(row)).length,
  }), [rows])

  async function toggleChecklist(row: ExecutionBooking, key: ChecklistKey, checked: boolean) {
    setSavingId(row.bookingId)
    setError(null)
    try {
      const nextRow = await saveExecutionChecklist(row, { ...row.checklist, [key]: checked })
      setRows((current) => current.map((item) => item.bookingId === row.bookingId ? nextRow : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : tl('Could not save execution checklist.', 'Nao foi possivel salvar o checklist de atendimento.'))
    } finally {
      setSavingId(null)
    }
  }

  async function generateDocuments(row: ExecutionBooking, kind: 'forms' | 'contracts') {
    setSavingId(row.bookingId)
    setError(null)
    try {
      const nextRow = await ensureExecutionDocuments(row, kind)
      setRows((current) => current.map((item) => item.bookingId === row.bookingId ? nextRow : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : tl('Could not generate execution documents.', 'Nao foi possivel gerar os documentos de atendimento.'))
    } finally {
      setSavingId(null)
    }
  }

  async function deductStock(row: ExecutionBooking) {
    setSavingId(row.bookingId)
    setError(null)
    try {
      const nextRow = await ensureStockDeduction(row)
      setRows((current) => current.map((item) => item.bookingId === row.bookingId ? nextRow : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : tl('Could not deduct execution stock.', 'Nao foi possivel baixar o estoque do atendimento.'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <main className="space-y-5 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">
            {tl('Execution checklist', 'Checklist de atendimento')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tl('Review stock, forms, and contract defaults required by upcoming services.', 'Revise estoque, formularios e contratos exigidos pelos proximos servicos.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => { window.location.hash = '/settings/services/_properties/default-products' }}
          >
            <Boxes className="h-4 w-4" />
            {tl('Stock defaults', 'Padroes de estoque')}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => { window.location.hash = '/settings/custom_forms/_properties/service-default-forms' }}
          >
            <FileCheck2 className="h-4 w-4" />
            {tl('Form defaults', 'Padroes de formularios')}
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Bookings', 'Agendamentos')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.bookings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('With stock defaults', 'Com estoque padrao')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.withProducts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('With form defaults', 'Com formularios padrao')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.withTemplates}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">{tl('Ready', 'Prontos')}</p>
            <p className="mt-1 text-2xl font-semibold">{summary.ready}</p>
          </CardContent>
        </Card>
      </section>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground">
            {tl('Loading execution checklist...', 'Carregando checklist de atendimento...')}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {tl('No upcoming appointments to prepare.', 'Nenhum atendimento futuro para preparar.')}
              </p>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {tl(
                  'Schedule the next services or review service defaults so stock, forms and contracts are ready before the client arrives.',
                  'Agende os proximos servicos ou revise os padroes de atendimento para deixar estoque, formularios e contratos prontos antes da chegada do cliente.',
                )}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                onClick={() => { window.location.hash = '/agenda' }}
              >
                <CalendarPlus className="h-4 w-4" />
                {tl('Open agenda', 'Abrir agenda')}
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={() => { window.location.hash = '/settings/services/_properties/default-products' }}
              >
                <Boxes className="h-4 w-4" />
                {tl('Review defaults', 'Revisar padroes')}
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          {rows.map((row) => {
            const requirements = getChecklistRequirements(row)

            return (
            <Card key={row.bookingId}>
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      {row.clientName ?? tl('Client not identified', 'Cliente nao identificado')}
                    </h2>
                    <Badge variant="outline">{statusLabel(row.status)}</Badge>
                    <Badge variant={row.products.length || row.templates.length ? 'secondary' : 'destructive'}>
                      {row.products.length + row.templates.length} {tl('defaults', 'padroes')}
                    </Badge>
                    <Badge variant={checklistIsComplete(row) ? 'secondary' : 'outline'}>
                      {checklistIsComplete(row) ? tl('Ready', 'Pronto') : tl('Pending', 'Pendente')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.services.map((service) => service.name ?? tl('Service', 'Servico')).join(', ') || tl('Service not selected', 'Servico nao selecionado')} · {formatDateTime(row.startsAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {row.professionalName && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        {row.professionalName}
                      </span>
                    )}
                    {row.products.map((product, index) => (
                      <span key={`${product.serviceId}:product:${index}`} className="inline-flex items-center gap-1.5">
                        <Boxes className="h-3.5 w-3.5" />
                        {product.productName ?? tl('Product', 'Produto')} {product.quantity ? `x${product.quantity}` : ''}
                        {product.unit ? ` ${product.unit}` : ''}
                      </span>
                    ))}
                    {row.templates.map((template, index) => (
                      <span key={`${template.serviceId}:template:${index}`} className="inline-flex items-center gap-1.5">
                        <FileCheck2 className="h-3.5 w-3.5" />
                        {template.templateName ?? tl('Template', 'Modelo')}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={row.checklist.stock === true}
                        disabled={savingId === row.bookingId || !requirements.stock}
                        onChange={(event) => { void toggleChecklist(row, 'stock', event.target.checked) }}
                      />
                      <span>{tl('Stock checked', 'Estoque conferido')}</span>
                    </label>
                    <label className="flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={row.checklist.forms === true}
                        disabled={savingId === row.bookingId || !requirements.forms}
                        onChange={(event) => { void toggleChecklist(row, 'forms', event.target.checked) }}
                      />
                      <span>{tl('Forms ready', 'Formularios prontos')}</span>
                    </label>
                    <label className="flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={row.checklist.contracts === true}
                        disabled={savingId === row.bookingId || !requirements.contracts}
                        onChange={(event) => { void toggleChecklist(row, 'contracts', event.target.checked) }}
                      />
                      <span>{tl('Contracts ready', 'Contratos prontos')}</span>
                    </label>
                    <label className="flex min-h-9 items-center gap-2 rounded-md border border-border px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={row.checklist.invoice === true}
                        disabled={savingId === row.bookingId}
                        onChange={(event) => { void toggleChecklist(row, 'invoice', event.target.checked) }}
                      />
                      <span>{tl('Invoice pending item', 'Item financeiro pendente')}</span>
                    </label>
                  </div>
                  {(requirements.stock || requirements.forms || requirements.contracts) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {requirements.stock && (
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingId === row.bookingId || row.checklist.stock === true}
                          onClick={() => { void deductStock(row) }}
                        >
                          <Boxes className="h-3.5 w-3.5" />
                          {row.checklist.stock === true ? tl('Stock deducted', 'Estoque baixado') : tl('Deduct stock', 'Baixar estoque')}
                        </button>
                      )}
                      {requirements.forms && (
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingId === row.bookingId}
                          onClick={() => { void generateDocuments(row, 'forms') }}
                        >
                          <FileCheck2 className="h-3.5 w-3.5" />
                          {tl('Generate forms', 'Gerar formularios')}
                        </button>
                      )}
                      {requirements.contracts && (
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingId === row.bookingId}
                          onClick={() => { void generateDocuments(row, 'contracts') }}
                        >
                          <FileCheck2 className="h-3.5 w-3.5" />
                          {tl('Generate contracts', 'Gerar contratos')}
                        </button>
                      )}
                    </div>
                  )}
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
