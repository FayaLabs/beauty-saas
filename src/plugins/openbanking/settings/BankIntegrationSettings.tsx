// Open Banking plugin (app-local) — settings tab.
//
// Control-plane UI rendered in the global /settings as the "Open Banking" tab.
// Three sections: Credentials (connect/test/save), Import (fetch a statement and
// import selected lines), and History (recent sync runs). Imported lines land in
// the SDK financial ledger and are matched in Financial → Reconciliation.
import React, { useEffect, useMemo, useState } from 'react'
import { Landmark, Plug, Download, CheckCircle2, AlertCircle, Loader2, History } from 'lucide-react'
import { Button, DatePicker, toast } from '@fayz-ai/ui'
import { createOpenBankingProvider } from '../data/supabase'
import type { BankIntegration, BankLine, SyncLogEntry } from '../types'

const provider = createOpenBankingProvider()

function brl(n: number): string {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n) }
  catch { return `R$ ${n.toFixed(2)}` }
}

export function BankIntegrationSettings() {
  const [integration, setIntegration] = useState<BankIntegration | null>(null)
  const [apiToken, setApiToken] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10) })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<BankLine[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)

  const [log, setLog] = useState<SyncLogEntry[]>([])

  async function loadIntegration() {
    const found = await provider.getIntegration()
    setIntegration(found)
    if (found) {
      setApiToken(found.apiToken ?? '')
      setCnpj(found.cnpj ?? '')
      void provider.getSyncLog(found.id).then(setLog)
    }
  }

  useEffect(() => { void loadIntegration() }, [])

  const connected = !!integration?.apiToken

  async function handleTest() {
    setTesting(true)
    try {
      const res = await provider.testConnection({ apiToken, cnpj })
      if (res.ok) toast.success(res.message ?? 'Conexão válida')
      else toast.error(res.message ?? 'Falha na conexão')
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha na conexão')
    } finally { setTesting(false) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await provider.saveIntegration({ id: integration?.id, apiToken, cnpj })
      setIntegration(saved)
      toast.success('Integração salva')
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function handleFetch() {
    if (!integration) { toast.error('Salve a conexão primeiro'); return }
    setFetching(true)
    try {
      const res = await provider.fetchStatement({ integrationId: integration.id, from, to })
      setLines(res.lines)
      setSelected(new Set(res.lines.map((l) => l.externalId)))
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao buscar extrato')
    } finally { setFetching(false) }
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
      void loadIntegration()
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao importar')
    } finally { setImporting(false) }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectedCount = selected.size

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Landmark className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Open Banking · Tecnospeed PlugBank</h2>
          <p className="text-sm text-muted-foreground">Importe o extrato bancário e concilie na tela Financeiro → Conciliação.</p>
        </div>
        {connected && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
          </span>
        )}
      </div>

      {/* Credentials */}
      <section className="rounded-lg border bg-card shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2"><Plug className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Credenciais</h3></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">CNPJ</span>
            <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00"
              className="w-full mt-1 rounded-input border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Token API PlugBank</span>
            <input value={apiToken} onChange={(e) => setApiToken(e.target.value)} type="password" placeholder="••••••••"
              className="w-full mt-1 rounded-input border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !apiToken || !cnpj}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />} Testar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !apiToken || !cnpj}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Salvar conexão
          </Button>
        </div>
      </section>

      {/* Import */}
      <section className="rounded-lg border bg-card shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2"><Download className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Importar extrato</h3></div>
        <div className="flex flex-wrap items-end gap-3">
          <div><span className="text-xs font-medium text-muted-foreground">De</span><DatePicker value={from} onChange={setFrom} className="mt-1" /></div>
          <div><span className="text-xs font-medium text-muted-foreground">Até</span><DatePicker value={to} onChange={setTo} className="mt-1" /></div>
          <Button variant="outline" size="sm" onClick={handleFetch} disabled={fetching || !connected}>
            {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Buscar extrato
          </Button>
        </div>

        {lines.length > 0 && (
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
        )}
        {lines.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{selectedCount} de {lines.length} selecionadas</span>
            <Button size="sm" onClick={handleImport} disabled={importing || selectedCount === 0}>
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Importar selecionadas
            </Button>
          </div>
        )}
      </section>

      {/* History */}
      {log.length > 0 && (
        <section className="rounded-lg border bg-card shadow-sm p-5 space-y-2">
          <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Histórico</h3></div>
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
        </section>
      )}
    </div>
  )
}
