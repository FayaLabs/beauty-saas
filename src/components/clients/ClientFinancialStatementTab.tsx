import React, { useEffect, useMemo, useState } from 'react'
import { Receipt, Wallet } from 'lucide-react'
import { Badge, Card, CardContent } from '@fayz-ai/ui'
import { getActiveTenantId, getSupabaseClientOptional, type EntityDef } from '@fayz-ai/saas'
import { tl } from '../../i18n/tl'

interface StatementEntry {
  id: string
  date?: string
  description: string
  direction?: string
  amount: number
  paidAmount: number
  status?: string
  referenceNumber?: string
}

const statusLabels: Record<string, string> = {
  open: tl('Open', 'Aberto'),
  paid: tl('Paid', 'Pago'),
  partial: tl('Partial', 'Parcial'),
  overdue: tl('Overdue', 'Vencido'),
  cancelled: tl('Cancelled', 'Cancelado'),
}

function numericValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatDate(value?: string): string {
  if (!value) return tl('No date', 'Sem data')
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

async function loadStatement(clientId: string): Promise<StatementEntry[]> {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) return []

  const tenantId = getActiveTenantId()
  let query = supabase
    .from('financial_movements')
    .select('id, date, due_date, payment_date, description, movement_kind, direction, amount, paid_amount, status, reference_number, invoice_id')
    .eq('party_id', clientId)
    .order('date', { ascending: false })
    .limit(100)

  if (tenantId) query = query.eq('tenant_id', tenantId)

  const { data, error } = await query
  if (error) return []

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    date: row.payment_date ?? row.date ?? row.due_date ?? undefined,
    description: row.description ?? row.movement_kind ?? row.reference_number ?? tl('Financial movement', 'Movimento financeiro'),
    direction: row.direction ?? undefined,
    amount: numericValue(row.amount),
    paidAmount: numericValue(row.paid_amount),
    status: row.status ?? undefined,
    referenceNumber: row.reference_number ?? row.invoice_id ?? undefined,
  }))
}

export function ClientFinancialStatementTab({
  item,
}: {
  item: unknown
  entityDef: EntityDef
}) {
  const client = item as Record<string, unknown>
  const clientId = String(client.id ?? client.personId ?? '')
  const [entries, setEntries] = useState<StatementEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      try {
        const next = clientId ? await loadStatement(clientId) : []
        if (mounted) setEntries(next)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [clientId])

  const totals = useMemo(() => {
    const active = entries.filter((entry) => entry.status !== 'cancelled')
    const billed = active.reduce((sum, entry) => sum + entry.amount, 0)
    const paid = active.reduce((sum, entry) => sum + entry.paidAmount, 0)
    return { billed, paid, balance: billed - paid }
  }, [entries])

  if (loading || entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <Wallet className="h-7 w-7" />
          {loading
            ? tl('Loading financial statement...', 'Carregando extrato financeiro...')
            : tl('No financial movements found for this client yet.', 'Nenhum movimento financeiro encontrado para este cliente ainda.')}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryStat label={tl('Billed', 'Faturado')} value={formatCurrency(totals.billed)} />
        <SummaryStat label={tl('Paid', 'Pago')} value={formatCurrency(totals.paid)} positive />
        <SummaryStat label={tl('Balance', 'Saldo')} value={formatCurrency(totals.balance)} accent />
      </div>

      <div className="space-y-3">
        {entries.map((entry) => {
          const status = entry.status ? (statusLabels[entry.status] ?? entry.status) : undefined
          const isCredit = entry.direction !== 'debit'
          return (
            <Card key={entry.id}>
              <CardContent className="flex gap-4 p-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-foreground">{entry.description}</h3>
                        {status && <Badge variant="secondary">{status}</Badge>}
                        {entry.referenceNumber && <Badge variant="outline">{entry.referenceNumber}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className={`text-sm font-semibold ${isCredit ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(entry.amount)}
                      </p>
                      {entry.paidAmount > 0 && entry.paidAmount !== entry.amount && (
                        <p className="text-xs text-muted-foreground">
                          {tl('Paid', 'Pago')}: {formatCurrency(entry.paidAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  accent,
  positive,
}: {
  label: string
  value: string
  accent?: boolean
  positive?: boolean
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${accent ? 'bg-muted/40' : 'bg-card'}`}>
      <p className="truncate text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${positive ? 'text-success' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}
