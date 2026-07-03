import { type EntityDef } from '@fayz-ai/saas'
import { ListView } from '@fayz-ai/ui'
import { CalendarDays, CheckCircle2, CircleDashed, CircleEllipsis, DollarSign, ExternalLink, FileText, ShoppingBag } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { tl } from '../../i18n/tl'

type ClientOrderStage = 'draft' | 'quoted' | 'booked' | 'invoiced' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'no_show' | 'completed'

type ClientOrderDocument = {
  id: string
  kind: string
  stage: ClientOrderStage
  referenceNumber?: string
  date: string
  startsAt?: string
  total: number
  paidAmount?: number
  description?: string
  createdAt: string
}

type ClientOrdersProvider = {
  getDocuments(query: {
    clientId: string
    stages?: string[]
    page?: number
    pageSize?: number
  }): Promise<{ data: ClientOrderDocument[]; total: number }>
}

type ClientOrdersCanonicalTabProps = {
  item: { id?: string }
  entityDef: EntityDef
  provider: ClientOrdersProvider
  currency: { code: string; locale: string }
  onBookingClick?: (orderId: string) => void
  onInvoiceClick?: (orderId: string) => void
}

const stageFilters = [
  { value: 'booked', label: tl('Attendances', 'Atendimentos') },
  { value: 'quoted', label: tl('Quotes', 'Orçamentos') },
  { value: 'invoiced', label: tl('Invoiced', 'Faturados') },
  { value: 'paid', label: tl('Paid', 'Pagos') },
]

const stageLabels: Record<string, string> = {
  draft: tl('Draft', 'Rascunho'),
  quoted: tl('Quote', 'Orçamento'),
  booked: tl('Attendance', 'Atendimento'),
  invoiced: tl('Invoiced', 'Faturado'),
  paid: tl('Paid', 'Pago'),
  partial: tl('Partial', 'Parcial'),
  overdue: tl('Overdue', 'Vencido'),
  cancelled: tl('Cancelled', 'Cancelado'),
  no_show: tl('No-show', 'Não compareceu'),
  completed: tl('Completed', 'Concluído'),
}

const emptyMessages: Record<string, string> = {
  booked: tl(
    'No booked or completed attendances found for this client. New appointments will appear here after they are scheduled.',
    'Nenhum atendimento agendado ou realizado para este cliente. Novos agendamentos aparecem aqui quando forem marcados.',
  ),
  quoted: tl(
    'No quotes found for this client. Create a quote from the commercial workflow to track it here.',
    'Nenhum orçamento para este cliente. Crie um orçamento pelo fluxo comercial para acompanhar aqui.',
  ),
  invoiced: tl(
    'No invoiced orders found for this client. Orders appear here after billing starts.',
    'Nenhum pedido faturado para este cliente. Os pedidos aparecem aqui quando o faturamento começar.',
  ),
  paid: tl(
    'No paid orders found for this client. Completed payments will appear in this view.',
    'Nenhum pedido pago para este cliente. Pagamentos concluídos aparecem nesta visão.',
  ),
}

function splitHashRoute(hash: string) {
  const [path, queryString] = hash.split('?')
  const segments = path.split('/').filter(Boolean)

  return { path, queryString, segments }
}

function getClientDetailTabSegment(segments: string[]) {
  if (segments[0] === 'clients') return segments[2]
  if (segments[0] === 'registry' && segments[1] === 'clients') return segments[3]
  return undefined
}

function getStageFromHash(hash: string): string | undefined {
  const { queryString, segments } = splitHashRoute(hash)
  const tabSegment = getClientDetailTabSegment(segments)
  const stage = queryString ? new URLSearchParams(queryString).get('stage') : null

  if (stage) return stage
  if (tabSegment === 'appointments') return 'booked'
  if (tabSegment === 'quotes') return 'quoted'
  return undefined
}

function getInitialStage(): string | undefined {
  if (typeof window === 'undefined') return undefined

  return getStageFromHash(window.location.hash.replace(/^#/, ''))
}

function normalizeClientOrderPath(path: string) {
  return path
    .replace(/\/appointments$/, '/orders')
    .replace(/\/quotes$/, '/orders')
}

function getLegacyClientStage(path: string) {
  if (path.endsWith('/appointments')) return 'booked'
  if (path.endsWith('/quotes')) return 'quoted'
  return undefined
}

function normalizeClientOrdersHash(hash: string, nextStage?: string) {
  const [path, queryString] = hash.split('?')
  const normalizedPath = normalizeClientOrderPath(path)
  const params = new URLSearchParams(queryString)
  const legacyStage = getLegacyClientStage(path)
  const hasExplicitStage = arguments.length > 1
  const normalizedStage = hasExplicitStage ? nextStage : params.get('stage') ?? legacyStage

  if (normalizedStage) {
    params.set('stage', normalizedStage)
  } else {
    params.delete('stage')
  }
  return `${normalizedPath}${params.toString() ? `?${params.toString()}` : ''}`
}

function writeStageToHash(stage: string | undefined) {
  if (typeof window === 'undefined') return

  const hash = window.location.hash.replace(/^#/, '')
  window.location.hash = normalizeClientOrdersHash(hash, stage)
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: '2-digit' })
}

function formatMoney(value: number, currency: { code: string; locale: string }) {
  return new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(value)
}

export function ClientOrdersCanonicalTab(props: ClientOrdersCanonicalTabProps) {
  const { item, provider, currency, onBookingClick, onInvoiceClick } = props
  const [rows, setRows] = useState<ClientOrderDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<string | undefined>(() => getInitialStage())

  const clientId = item.id

  const loadRows = useCallback(async () => {
    if (!clientId) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const result = await provider.getDocuments({
        clientId,
        stages: stage ? [stage] : undefined,
      })
      setRows(result.data)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [clientId, provider, stage])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    const syncFromHash = () => setStage(getInitialStage())
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const normalizedHash = normalizeClientOrdersHash(hash)
    if (normalizedHash !== hash) {
      window.location.replace(`#${normalizedHash}`)
    }
  }, [])

  const columns = useMemo<any[]>(() => [
    {
      accessorKey: 'date',
      header: tl('Date', 'Data'),
      size: 140,
      cell: ({ row }: any) => {
        const doc = row.original
        const date = formatDate(doc.startsAt ?? doc.date, currency.locale)
        if (doc.startsAt && onBookingClick) {
          const time = new Date(doc.startsAt).toLocaleTimeString(currency.locale, { hour: '2-digit', minute: '2-digit' })
          return (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onBookingClick(doc.id)
              }}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
            >
              <CalendarDays className="h-3 w-3" />
              {date} {time}
            </button>
          )
        }
        return <span className="text-xs text-muted-foreground whitespace-nowrap">{date}</span>
      },
    },
    {
      id: 'stage',
      header: tl('Stage', 'Etapa'),
      size: 130,
      cell: ({ row }: any) => {
        const StageIcon = row.original.stage === 'paid' || row.original.stage === 'completed'
          ? CheckCircle2
          : row.original.stage === 'booked'
            ? CalendarDays
            : row.original.stage === 'quoted' || row.original.stage === 'invoiced'
              ? FileText
              : row.original.stage === 'partial'
                ? CircleEllipsis
                : CircleDashed
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <StageIcon className="h-2.5 w-2.5" />
            {stageLabels[row.original.stage] ?? row.original.stage}
          </span>
        )
      },
    },
    {
      accessorKey: 'referenceNumber',
      header: '#',
      size: 90,
      cell: ({ getValue }: any) => {
        const value = getValue() as string | undefined
        return value ? <span className="text-xs font-mono text-muted-foreground">#{value}</span> : <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: 'description',
      header: tl('Description', 'Descricao'),
      cell: ({ getValue }: any) => <span className="block max-w-[220px] truncate text-sm">{(getValue() as string | undefined) || '-'}</span>,
    },
    {
      accessorKey: 'total',
      header: tl('Amount', 'Valor'),
      size: 120,
      cell: ({ row }: any) => {
        const total = row.original.total
        if (!total) return <span className="text-muted-foreground">-</span>
        const financial = ['invoiced', 'paid', 'partial', 'overdue'].includes(row.original.stage)
        if (financial && onInvoiceClick) {
          return (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onInvoiceClick(row.original.id)
              }}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <DollarSign className="h-3 w-3" />
              {formatMoney(total, currency)}
              <ExternalLink className="h-2.5 w-2.5" />
            </button>
          )
        }
        return <span className="text-sm font-medium">{formatMoney(total, currency)}</span>
      },
    },
  ], [currency, onBookingClick, onInvoiceClick])

  const emptyMessage = stage
    ? emptyMessages[stage] ?? tl('No orders found for this filter.', 'Nenhum pedido encontrado para este filtro.')
    : tl(
      'No commercial history found for this client yet. Appointments, quotes and billing records will appear here together.',
      'Nenhum histórico comercial para este cliente ainda. Atendimentos, orçamentos e cobranças aparecem juntos aqui.',
    )
  const activeFilterLabel = stageFilters.find((filter) => filter.value === stage)?.label
  const filterSummary = activeFilterLabel
    ? tl('Showing only ', 'Mostrando apenas ') + activeFilterLabel.toLocaleLowerCase('pt-BR')
    : tl('Showing the full commercial history.', 'Mostrando todo o histórico comercial.')

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{tl('Commercial history', 'Histórico comercial')}</p>
            <p className="text-xs text-muted-foreground">
              {tl(
                'Track appointments, quotes and billing records for this client in one place.',
                'Acompanhe atendimentos, orçamentos e cobranças deste cliente em um só lugar.',
              )}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center self-start rounded-full bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border sm:self-center">
          {filterSummary}
        </span>
      </div>
      <ListView
        columns={columns}
        data={rows}
        loading={loading}
        searchPlaceholder={tl('Search orders...', 'Buscar pedidos...')}
        tags={stageFilters}
        allTagLabel={tl('All orders', 'Todos os pedidos')}
        activeTag={stage}
        onTagChange={(value) => {
          setStage(value)
          writeStageToHash(value)
        }}
        emptyIcon={ShoppingBag}
        emptyMessage={emptyMessage}
      />
    </div>
  )
}
