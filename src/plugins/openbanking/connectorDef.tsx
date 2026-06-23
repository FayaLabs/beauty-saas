// Open Banking (Tecnospeed PlugBank) as a unified ConnectorDefinition.
//
// Surfaces inside plugin-financial's settings → Integrations tab (the host),
// rendered by the shared ConnectorsHub. The hub handles the credentials form
// (CNPJ / Token) + Test / Save; the ExtraPanel below adds the statement import
// + sync history (only meaningful once the connection is saved).
import React, { useEffect, useState } from 'react'
import { Download, History, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button, DatePicker, toast } from '@fayz-ai/saas/ui'
import type { ConnectorDefinition } from '@fayz-ai/saas'
import { createOpenBankingProvider } from './data/supabase'
import type { BankIntegration, BankLine, SyncLogEntry } from './types'

const provider = createOpenBankingProvider()

function brl(n: number): string {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n) }
  catch { return `R$ ${n.toFixed(2)}` }
}

function OpenBankingExtraPanel() {
  const [integration, setIntegration] = useState<BankIntegration | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<BankLine[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [log, setLog] = useState<SyncLogEntry[]>([])

  async function load() {
    const found = await provider.getIntegration()
    setIntegration(found)
    if (found) void provider.getSyncLog(found.id).then(setLog)
    setLoaded(true)
  }
  useEffect(() => { void load() }, [])

  if (!loaded || !integration) return null // nothing to import until the connection is saved

  async function handleFetch() {
    if (!integration) return
    setFetching(true)
    try {
      const res = await provider.fetchStatement({ integrationId: integration.id, from, to })
      setLines(res.lines)
      setSelected(new Set(res.lines.map((l) => l.externalId)))
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao buscar extrato') }
    finally { setFetching(false) }
  }

  async function handleImport() {
    if (!integration) return
    const toImport = lines.filter((l) => selected.has(l.externalId))
    if (toImport.length === 0) { toast.error('Selecione ao menos uma linha'); return }
    setImporting(true)
    try {
      const res = await provider.importTransactions({ integrationId: integration.id, from, to, lines: toImport })
      toast.success(`${res.imported} importadas${res.duplicates ? ` · ${res.duplicates} duplicadas` : ''}`)
      setLines([]); setSelected(new Set())
      void provider.getSyncLog(integration.id).then(setLog)
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao importar') }
    finally { setImporting(false) }
  }

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-2"><Download className="h-4 w-4 text-muted-foreground" /><h4 className="text-sm font-semibold">Importar extrato</h4></div>
      <div className="flex flex-wrap items-end gap-3">
        <div><span className="text-xs font-medium text-muted-foreground">De</span><DatePicker value={from} onChange={setFrom} className="mt-1" /></div>
        <div><span className="text-xs font-medium text-muted-foreground">Até</span><DatePicker value={to} onChange={setTo} className="mt-1" /></div>
        <Button variant="outline" size="sm" onClick={handleFetch} disabled={fetching}>
          {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Buscar extrato
        </Button>
      </div>

      {lines.length > 0 && (
        <>
          <div className="rounded-md border divide-y max-h-72 overflow-auto">
            {lines.map((l) => (
              <label key={l.externalId} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={selected.has(l.externalId)} onChange={() => toggle(l.externalId)} />
                <span className="text-muted-foreground text-xs w-20 shrink-0">{l.date}</span>
                <span className="flex-1 truncate">{l.description}</span>
                <span className={`font-semibold shrink-0 ${l.type === 'C' ? 'text-success' : 'text-destructive'}`}>
                  {l.type === 'C' ? '+' : '-'}{brl(l.amount)}
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{selected.size} de {lines.length} selecionadas</span>
            <Button size="sm" onClick={handleImport} disabled={importing || selected.size === 0}>
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Importar selecionadas
            </Button>
          </div>
        </>
      )}

      {log.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /><h4 className="text-sm font-semibold">Histórico</h4></div>
          <div className="rounded-md border divide-y text-sm">
            {log.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                <span className="text-muted-foreground text-xs">{new Date(r.createdAt).toLocaleString('pt-BR')}</span>
                <span className="text-xs text-muted-foreground">{r.periodFrom} → {r.periodTo}</span>
                <span className="ml-auto text-xs">{r.transactionsImported}/{r.transactionsFetched} importadas{r.duplicates ? ` · ${r.duplicates} dup` : ''}</span>
                {r.status === 'success'
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  : <AlertCircle className="h-3.5 w-3.5 text-warning" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const openBankingConnector: ConnectorDefinition = {
  id: 'plugbank',
  hostPluginId: 'financial',
  name: 'Open Banking · Tecnospeed PlugBank',
  description: 'Importe o extrato bancário e concilie em Financeiro → Conciliação.',
  icon: 'Landmark',
  authKind: 'api-key',
  fields: [
    { key: 'cnpj', label: 'CNPJ', type: 'text', placeholder: '00.000.000/0001-00' },
    { key: 'apiToken', label: 'Token API PlugBank', type: 'password', placeholder: '••••••••' },
  ],
  async getStatus() {
    const found = await provider.getIntegration()
    return { connected: !!found?.apiToken }
  },
  testConnection: (values) => provider.testConnection({ apiToken: values.apiToken, cnpj: values.cnpj }),
  saveConnection: async (values) => { await provider.saveIntegration({ apiToken: values.apiToken, cnpj: values.cnpj }) },
  ExtraPanel: OpenBankingExtraPanel,
}
