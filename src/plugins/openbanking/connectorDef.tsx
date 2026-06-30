import React, { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import {
  AlertCircle, Ban, CheckCircle2, Download, ExternalLink, History,
  Landmark, Loader2, Plus, RefreshCw, Trash2,
} from 'lucide-react'
import { Button, DatePicker, toast } from '@fayz-ai/saas/ui'
import { getActiveTenantId } from '@fayz-ai/saas'
import type { ConnectorDefinition } from '@fayz-ai/saas'
import { createOpenBankingProvider } from './data/supabase'
import type { BankIntegration, BankLine, OpenFinanceAccount, SyncJobState, SyncLogEntry } from './types'

const provider = createOpenBankingProvider()
const inputClass = 'w-full mt-1 rounded-input border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const syncStorageKey = 'tecnospeed-openfinance-sync-job'
const syncNoticeStorageKey = 'tecnospeed-openfinance-sync-notice'
const accountsStorageKey = 'tecnospeed-openfinance-accounts'
const activeSyncMaxAgeMs = 7 * 24 * 60 * 60 * 1000
const submittingNoticeMaxAgeMs = 30 * 60 * 1000

type SyncNotice = {
  accountHash: string
  from: string
  to: string
  status: 'submitting' | SyncJobState['status']
  jobId?: string
  retryAfter?: string
  lastError?: string
  updatedAt: string
}

type StoredSyncJob = SyncJobState & { storedAt?: string }

function tenantStorageKey(base: string): string {
  return `${base}:${getActiveTenantId() || 'no-tenant'}`
}

function isRecent(isoDate: string | undefined, maxAgeMs: number): boolean {
  if (!isoDate) return false
  const timestamp = new Date(isoDate).getTime()
  return Number.isFinite(timestamp) && Date.now() - timestamp <= maxAgeMs
}

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function formatDateBr(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR')
}

function accountValue(account: OpenFinanceAccount, camel: keyof OpenFinanceAccount, snake: keyof OpenFinanceAccount) {
  return String(account[camel] ?? account[snake] ?? '')
}

function normalizeOpenFinanceStatus(status?: string): { label: string; tone: 'success' | 'warning' | 'muted' } {
  const value = String(status ?? '').toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  if (['ATIVO', 'ACTIVE', 'AUTHORIZED', 'AUTORIZADO'].includes(value)) return { label: 'Ativo', tone: 'success' }
  if (value.includes('PENDENTE') || value.includes('PENDING') || value.includes('ACTIVATION') || value.includes('ATIVACAO')) return { label: 'Autorize', tone: 'warning' }
  if (value.includes('REVOG') || value.includes('CANCEL')) return { label: 'Revogado', tone: 'muted' }
  if (value.includes('ERRO') || value.includes('FAIL')) return { label: 'Atenção', tone: 'warning' }
  return { label: status ? status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'Aguardando', tone: 'muted' }
}

function saveSyncJob(job: SyncJobState | null) {
  const key = tenantStorageKey(syncStorageKey)
  try {
    if (!job || ['completed', 'failed'].includes(job.status)) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify({ ...job, storedAt: new Date().toISOString() }))
  } catch {
    // best effort only
  }
}

function loadStoredSyncJob(): SyncJobState | null {
  const key = tenantStorageKey(syncStorageKey)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredSyncJob
    if (!stored?.status || !isRecent(stored.storedAt, activeSyncMaxAgeMs)) {
      localStorage.removeItem(key)
      return null
    }
    return stored
  } catch {
    return null
  }
}

function saveCachedAccounts(accounts: OpenFinanceAccount[]) {
  try {
    localStorage.setItem(tenantStorageKey(accountsStorageKey), JSON.stringify(accounts))
  } catch {
    // best effort only
  }
}

function loadCachedAccounts(): OpenFinanceAccount[] {
  try {
    const raw = localStorage.getItem(tenantStorageKey(accountsStorageKey))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSyncNotice(notice: SyncNotice | null) {
  const key = tenantStorageKey(syncNoticeStorageKey)
  try {
    if (!notice || notice.status === 'completed') localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(notice))
  } catch {
    // best effort only
  }
}

function loadStoredSyncNotice(): SyncNotice | null {
  const key = tenantStorageKey(syncNoticeStorageKey)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const notice = JSON.parse(raw) as SyncNotice
    const maxAge = notice?.status === 'submitting' ? submittingNoticeMaxAgeMs : activeSyncMaxAgeMs
    if (!notice?.accountHash || !notice?.from || !notice?.to || !notice?.status || !isRecent(notice.updatedAt, maxAge)) {
      localStorage.removeItem(key)
      return null
    }
    return notice
  } catch {
    return null
  }
}

class OpenBankingPanelBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Open Finance] Falha ao renderizar integração', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível exibir os detalhes do Open Finance.</p>
          <p className="mt-1 text-xs text-muted-foreground">{this.state.error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => this.setState({ error: null })}>
            Tentar novamente
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

function OpenBankingExtraPanel() {
  const [integration, setIntegration] = useState<BankIntegration | null>(null)
  const [accounts, setAccounts] = useState<OpenFinanceAccount[]>([])
  const [selectedAccountHash, setSelectedAccountHash] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountForm, setAccountForm] = useState({
    name: '', email: '', neighborhood: '', addressNumber: '', zipcode: '', state: '', city: '',
    street: '', addressComplement: '', bankCode: '', agency: '', accountNumber: '', accountNumberDigit: '', accountDac: '',
  })
  const [from, setFrom] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 30); return date.toISOString().slice(0, 10) })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<BankLine[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [accountAction, setAccountAction] = useState('')
  const [log, setLog] = useState<SyncLogEntry[]>([])
  const [syncJob, setSyncJob] = useState<SyncJobState | null>(null)
  const [syncNotice, setSyncNotice] = useState<SyncNotice | null>(null)
  const [pollRetryNonce, setPollRetryNonce] = useState(0)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingLog, setLoadingLog] = useState(false)

  async function load() {
    const found = await provider.getIntegration()
    setIntegration(found)
    setLoaded(true)
    if (!found) {
      setAccounts([])
      setSelectedAccountHash('')
      setLog([])
      saveCachedAccounts([])
      return
    }

    const cachedAccounts = loadCachedAccounts()
    if (cachedAccounts.length > 0) {
      setAccounts(cachedAccounts)
      setSelectedAccountHash((current) => cachedAccounts.some((account) => account.accountHash === current) ? current : cachedAccounts[0]?.accountHash || '')
    }

    setLoadingAccounts(true)
    try {
      const nextAccounts = await provider.listAccounts()
      setAccounts(nextAccounts)
      saveCachedAccounts(nextAccounts)
      setSelectedAccountHash((current) => nextAccounts.some((account) => account.accountHash === current) ? current : nextAccounts[0]?.accountHash || '')
      setShowAccountForm(nextAccounts.length === 0)
    } finally {
      setLoadingAccounts(false)
    }

    setLoadingLog(true)
    void provider.getSyncLog(found.id)
      .then(setLog)
      .catch((error: any) => toast.error(error?.message ?? 'Falha ao carregar histórico TecnoSpeed'))
      .finally(() => setLoadingLog(false))
  }

  useEffect(() => {
    void load()
    const storedJob = loadStoredSyncJob()
    const storedNotice = loadStoredSyncNotice()
    setSyncJob(storedJob)
    setSyncNotice(storedNotice)
    const reload = () => { void load() }
    window.addEventListener('tecnospeed:integration-changed', reload)
    return () => window.removeEventListener('tecnospeed:integration-changed', reload)
  }, [])

  useEffect(() => { saveSyncJob(syncJob) }, [syncJob])
  useEffect(() => { saveSyncNotice(syncNotice) }, [syncNotice])

  useEffect(() => {
    const jobId = syncJob?.id ?? syncJob?.jobId
    if (!syncJob || !jobId || !integration || ['completed', 'failed'].includes(syncJob.status)) return
    let cancelled = false
    const retryAt = syncJob.retryAfter ?? syncJob.retry_after
    const retryDelay = retryAt ? Math.max(3000, new Date(retryAt).getTime() - Date.now()) : 60000
    const delay = syncJob.status === 'retry_wait' ? retryDelay : 3000
    let retryTimer: number | undefined
    const timer = window.setTimeout(async () => {
      try {
        const next = await provider.getSyncJob(jobId)
        if (cancelled) return
        const jobContext = syncJob as SyncJobState & { accountHash?: string; from?: string; to?: string }
        const nextJob = { ...next, id: next.id ?? jobId, accountHash: jobContext.accountHash, from: jobContext.from, to: jobContext.to } as SyncJobState
        setSyncJob(nextJob)
        setSyncNotice({
          accountHash: jobContext.accountHash ?? selectedAccountHash,
          from: jobContext.from ?? from,
          to: jobContext.to ?? to,
          status: next.status,
          jobId,
          retryAfter: next.retryAfter ?? next.retry_after,
          lastError: next.lastError ?? next.last_error,
          updatedAt: new Date().toISOString(),
        })
        if (next.status === 'completed') {
          const result = await provider.fetchStatement({
            integrationId: integration.id,
            accountHash: jobContext.accountHash ?? selectedAccountHash,
            from: jobContext.from ?? from,
            to: jobContext.to ?? to,
          })
          if (cancelled) return
          setLines(result.lines)
          setSelected(new Set(result.lines.map((line) => line.externalId)))
          saveSyncJob(null)
          setSyncNotice(null)
          toast.success('Extrato pronto para conferência')
        }
        if (next.status === 'failed') toast.error(next.lastError ?? next.last_error ?? 'Não foi possível buscar o extrato')
      } catch (error: any) {
        if (!cancelled) {
          const jobContext = syncJob as SyncJobState & { accountHash?: string; from?: string; to?: string }
          setSyncNotice((current) => ({
            accountHash: current?.accountHash ?? jobContext.accountHash ?? selectedAccountHash,
            from: current?.from ?? jobContext.from ?? from,
            to: current?.to ?? jobContext.to ?? to,
            status: current?.status ?? syncJob.status,
            jobId,
            retryAfter: current?.retryAfter,
            lastError: error?.message ?? 'Falha temporária ao acompanhar sincronização',
            updatedAt: new Date().toISOString(),
          }))
          retryTimer = window.setTimeout(() => setPollRetryNonce((value) => value + 1), 15000)
        }
      }
    }, delay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [syncJob, integration?.id, selectedAccountHash, from, to, pollRetryNonce])

  if (!loaded || !integration) return null
  const legacyMode = integration.statementSource === 'legacy_worker'

  function field(key: keyof typeof accountForm, label: string, placeholder = '') {
    return (
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <input
          className={inputClass}
          value={accountForm[key]}
          placeholder={placeholder}
          onChange={(event) => setAccountForm((current) => ({ ...current, [key]: event.target.value }))}
        />
      </label>
    )
  }

  async function createAccount(confirmPayerUpdate = false) {
    return provider.createAccount({
      payer: {
        name: accountForm.name,
        email: accountForm.email || undefined,
        neighborhood: accountForm.neighborhood || undefined,
        addressNumber: accountForm.addressNumber || undefined,
        zipcode: accountForm.zipcode || undefined,
        state: accountForm.state || undefined,
        city: accountForm.city || undefined,
        street: accountForm.street || undefined,
        addressComplement: accountForm.addressComplement || undefined,
        confirmPayerUpdate,
      },
      account: {
        bankCode: accountForm.bankCode, agency: accountForm.agency,
        accountNumber: accountForm.accountNumber,
        accountNumberDigit: accountForm.accountNumberDigit || undefined,
        accountDac: accountForm.accountDac || undefined,
      },
    })
  }

  async function handleCreateAccount() {
    const missingLegacyPayer = legacyMode && (!accountForm.name || !accountForm.neighborhood || !accountForm.addressNumber || !accountForm.zipcode || !accountForm.state || !accountForm.city)
    if ((!legacyMode && !accountForm.name) || missingLegacyPayer || !accountForm.bankCode || !accountForm.agency || !accountForm.accountNumber || (legacyMode && !accountForm.accountNumberDigit)) {
      toast.error(legacyMode ? 'Preencha dados do pagador, endereço, banco, agência, conta e dígito' : 'Preencha nome, banco, agência e conta')
      return
    }
    setSavingAccount(true)
    try {
      const created = await createAccount(false)
      toast.success(legacyMode ? 'Conta cadastrada. Clique em Autorizar para concluir o consentimento Open Finance.' : 'Conta criada. Conclua o consentimento Open Finance no link exibido.')
      setShowAccountForm(false)
      await load()
      setSelectedAccountHash(created.accountHash)
    } catch (error: any) {
      if (error?.code === 'payer_name_mismatch') {
        const details = error?.details?.details ?? error?.details ?? {}
        const currentName = details.currentName ?? details.current_name ?? 'nome atual'
        const receivedName = details.receivedName ?? details.received_name ?? accountForm.name
        const confirmed = window.confirm(`Já existe um pagador com nome diferente.\n\nAtual: ${currentName}\nNovo: ${receivedName}\n\nDeseja atualizar o nome do pagador e continuar?`)
        if (confirmed) {
          try {
            const created = await createAccount(true)
            toast.success('Pagador atualizado e conta cadastrada.')
            setShowAccountForm(false)
            await load()
            setSelectedAccountHash(created.accountHash)
            return
          } catch (retryError: any) {
            toast.error(retryError?.message ?? 'Erro ao confirmar atualização do pagador')
            return
          }
        }
        toast.error('Cadastro cancelado para não sobrescrever o pagador sem confirmação')
      } else {
        toast.error(error?.message ?? 'Erro ao criar conta')
      }
    } finally {
      setSavingAccount(false)
    }
  }

  async function handleAccountAction(accountHash: string, action: 'refresh' | 'revoke' | 'delete') {
    if (action === 'delete' && !window.confirm(legacyMode
      ? 'Tem certeza que deseja remover esta conta do BeautySaaS? Isso não revoga o consentimento nem altera a conta na TecnoSpeed.'
      : 'Excluir esta conta da TecnoSpeed? Esta ação pode ser bloqueada se houver pagamentos conciliados.')) return
    if (action === 'revoke' && !window.confirm('Revogar o consentimento Open Finance desta conta?')) return
    setAccountAction(`${action}:${accountHash}`)
    try {
      if (action === 'refresh') await provider.refreshAccount(accountHash)
      if (action === 'revoke') await provider.revokeAccount(accountHash)
      if (action === 'delete') await provider.deleteAccount(accountHash)
      if (action === 'delete' && selectedAccountHash === accountHash) setSelectedAccountHash('')
      toast.success(action === 'refresh' ? 'Status atualizado' : action === 'revoke' ? 'Consentimento revogado' : legacyMode ? 'Conta removida do BeautySaaS' : 'Conta excluída')
      await load()
    } catch (error: any) {
      toast.error(error?.message ?? 'Falha na operação da conta')
    } finally {
      setAccountAction('')
    }
  }

  async function handleFetch() {
    if (!integration) return
    if (!selectedAccountHash) { toast.error('Cadastre e selecione uma conta'); return }
    if (from > to) { toast.error('A data inicial não pode ser posterior à data final'); return }
    const periodDays = daysBetween(from, to)
    const confirmation = periodDays > 90
      ? `Você está solicitando um extrato de ${periodDays} dias.\n\nConfirme se esse é o período completo que deseja sincronizar agora. Depois de uma sincronização, o banco pode exigir uma janela de espera antes de permitir uma nova busca ampliada para a mesma conta.`
      : `Confirme o período do extrato: ${from} até ${to}.\n\nSe depois você quiser ampliar esse período, pode ser necessário aguardar a próxima janela permitida pelo banco.`
    if (!window.confirm(confirmation)) return
    setFetching(true)
    const pendingNotice: SyncNotice = {
      accountHash: selectedAccountHash,
      from,
      to,
      status: 'submitting',
      updatedAt: new Date().toISOString(),
    }
    setSyncNotice(pendingNotice)
    try {
      const result = await provider.fetchStatement({ integrationId: integration.id, accountHash: selectedAccountHash, from, to })
      setLines(result.lines)
      setSelected(new Set(result.lines.map((line) => line.externalId)))
      if (result.sync?.jobId || result.sync?.id) {
        const nextJob = { ...result.sync, id: result.sync.id ?? result.sync.jobId, accountHash: selectedAccountHash, from, to } as SyncJobState
        setSyncJob(nextJob)
        setSyncNotice({
          accountHash: selectedAccountHash,
          from,
          to,
          status: result.sync.status,
          jobId: result.sync.id ?? result.sync.jobId,
          retryAfter: result.sync.retryAfter ?? result.sync.retry_after,
          lastError: result.sync.lastError ?? result.sync.last_error,
          updatedAt: new Date().toISOString(),
        })
        const retryAt = result.sync.retryAfter ?? result.sync.retry_after
        toast.success(result.sync.status === 'retry_wait'
          ? `Busca aguardando a janela permitida${retryAt ? ` até ${formatDateBr(retryAt)}` : ''}`
          : 'Busca do extrato iniciada. Pode demorar um pouco.')
      } else {
        setSyncJob(result.sync ?? null)
        if (result.sync?.status === 'failed') {
          setSyncNotice({ ...pendingNotice, status: 'failed', lastError: result.sync.lastError ?? result.sync.last_error, updatedAt: new Date().toISOString() })
        } else {
          setSyncNotice(null)
        }
      }
    } catch (error: any) {
      setSyncNotice({ ...pendingNotice, status: 'failed', lastError: error?.message ?? 'Erro ao buscar extrato', updatedAt: new Date().toISOString() })
      toast.error(error?.message ?? 'Erro ao buscar extrato')
    } finally {
      setFetching(false)
    }
  }

  async function handleImport() {
    if (!integration) return
    const toImport = lines.filter((line) => selected.has(line.externalId))
    if (toImport.length === 0) { toast.error('Selecione ao menos uma linha'); return }
    setImporting(true)
    try {
      const result = await provider.importTransactions({ integrationId: integration.id, accountHash: selectedAccountHash, from, to, lines: toImport })
      toast.success(`${result.imported} importadas${result.duplicates ? ` · ${result.duplicates} duplicadas` : ''}`)
      setLines([])
      setSelected(new Set())
      setLog(await provider.getSyncLog(integration.id))
    } catch (error: any) {
      toast.error(error?.message ?? 'Erro ao importar')
    } finally {
      setImporting(false)
    }
  }

  function toggle(id: string) {
    setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const syncRetryAt = syncJob?.retryAfter ?? syncJob?.retry_after
  const visibleSyncStatus = syncNotice?.status ?? syncJob?.status
  const visibleRetryAt = syncNotice?.retryAfter ?? syncRetryAt
  const visibleLastError = syncNotice?.lastError ?? syncJob?.lastError ?? syncJob?.last_error
  const syncStatusMessage = visibleSyncStatus === 'retry_wait'
    ? `Aguardando a próxima janela permitida pelo banco${visibleRetryAt ? `: ${formatDateBr(visibleRetryAt)}` : '.'}`
    : visibleSyncStatus === 'failed'
      ? (visibleLastError ?? 'Não foi possível buscar o extrato.')
      : visibleSyncStatus === 'submitting'
        ? 'Solicitação de busca enviada. Se você atualizar a página, o processamento continua em segundo plano.'
        : visibleLastError
          ? 'A conexão para acompanhar a busca oscilou. Uma nova tentativa será feita automaticamente; o processamento continua em segundo plano.'
          : 'Buscando extrato. Pode demorar um pouco; se você atualizar a página, a busca continua em segundo plano.'

  return (
    <div className="space-y-5 border-t pt-4">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-muted-foreground" /><h4 className="text-sm font-semibold">Contas conectadas</h4></div>
          <Button variant="outline" size="sm" onClick={() => setShowAccountForm((value) => !value)}><Plus className="h-3.5 w-3.5" /> {legacyMode ? 'Vincular conta existente' : 'Adicionar conta'}</Button>
        </div>

        {showAccountForm && (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">{field('name', 'Nome do pagador')}{field('email', 'E-mail')}</div>
            {legacyMode && (
              <div className="grid gap-3 sm:grid-cols-3">
                {field('zipcode', 'CEP', '00000000')}{field('state', 'UF', 'RJ')}{field('city', 'Cidade', 'Rio de Janeiro')}
                {field('neighborhood', 'Bairro', 'Centro')}{field('addressNumber', 'Número', '123')}{field('street', 'Logradouro')}
                {field('addressComplement', 'Complemento')}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              {field('bankCode', 'Código do banco', '341')}{field('agency', 'Agência')}{field('accountNumber', 'Conta')}
              {field('accountNumberDigit', 'Dígito da conta')}{field('accountDac', 'DAC')}
            </div>
            <Button size="sm" onClick={handleCreateAccount} disabled={savingAccount}>
              {savingAccount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {legacyMode ? 'Cadastrar/vincular conta' : 'Criar conta e gerar consentimento'}
            </Button>
          </div>
        )}

        {loadingAccounts && accounts.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando contas vinculadas...
          </div>
        )}

        {accounts.map((account) => {
          const status = accountValue(account, 'statusOpenfinance', 'status_openfinance') || 'PENDENTE'
          const statusView = normalizeOpenFinanceStatus(status)
          const consent = accountValue(account, 'openfinanceLink', 'openfinance_link')
          const masked = accountValue(account, 'accountNumberMasked', 'account_number_masked')
          const summary = [
            account.bankCode ? `Banco ${account.bankCode}` : 'Banco não informado',
            account.agency ? `Ag. ${account.agency}` : null,
            masked || account.accountHash.slice(0, 10),
          ].filter(Boolean).join(' · ')
          const busy = accountAction.endsWith(account.accountHash)
          return (
            <label key={account.accountHash} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-3 cursor-pointer">
              <input type="radio" name="openfinance-account" checked={selectedAccountHash === account.accountHash} onChange={() => setSelectedAccountHash(account.accountHash)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{summary}</p>
                <p className={`text-xs ${statusView.tone === 'success' ? 'text-success' : statusView.tone === 'warning' ? 'text-warning' : 'text-muted-foreground'}`}>Open Finance: {statusView.label}</p>
              </div>
              {consent && <a href={consent} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground shadow-sm hover:opacity-90">Autorizar conta <ExternalLink className="h-3 w-3" /></a>}
              <Button variant="ghost" size="sm" disabled={busy} onClick={(event) => { event.preventDefault(); void handleAccountAction(account.accountHash, 'refresh') }}><RefreshCw className="h-3.5 w-3.5" /></Button>
              {!legacyMode && <Button variant="ghost" size="sm" disabled={busy} onClick={(event) => { event.preventDefault(); void handleAccountAction(account.accountHash, 'revoke') }}><Ban className="h-3.5 w-3.5" /></Button>}
              <Button variant="ghost" size="sm" disabled={busy} onClick={(event) => { event.preventDefault(); void handleAccountAction(account.accountHash, 'delete') }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </label>
          )
        })}
      </section>

      <section className="space-y-3 border-t pt-4">
        <div className="flex items-center gap-2"><Download className="h-4 w-4 text-muted-foreground" /><h4 className="text-sm font-semibold">Importar extrato</h4></div>
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Escolha o período completo que deseja consultar antes de sincronizar. A consulta Open Finance pode respeitar uma janela de espera; se buscar um período curto agora e depois ampliar para um ano, talvez seja necessário aguardar a próxima liberação do banco.
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><span className="text-xs font-medium text-muted-foreground">De</span><DatePicker value={from} onChange={setFrom} className="mt-1" /></div>
          <div><span className="text-xs font-medium text-muted-foreground">Até</span><DatePicker value={to} onChange={setTo} className="mt-1" /></div>
          <Button variant="outline" size="sm" onClick={handleFetch} disabled={fetching || !selectedAccountHash}>
            {fetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Sincronizar período selecionado
          </Button>
        </div>

        {visibleSyncStatus && visibleSyncStatus !== 'completed' && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {visibleSyncStatus === 'failed' ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{syncStatusMessage}</span>
          </div>
        )}

        {lines.length > 0 && <>
          <div className="rounded-md border divide-y max-h-72 overflow-auto">
            {lines.map((line) => <label key={line.externalId} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
              <input type="checkbox" checked={selected.has(line.externalId)} onChange={() => toggle(line.externalId)} />
              <span className="text-muted-foreground text-xs w-20 shrink-0">{line.date}</span>
              <span className="flex-1 truncate">{line.description}</span>
              <span className={`font-semibold shrink-0 ${line.type === 'C' ? 'text-success' : 'text-destructive'}`}>{line.type === 'C' ? '+' : '-'}{brl(line.amount)}</span>
            </label>)}
          </div>
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{selected.size} de {lines.length} selecionadas</span><Button size="sm" onClick={handleImport} disabled={importing || selected.size === 0}>{importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Importar selecionadas</Button></div>
        </>}
      </section>

      {(loadingLog || log.length > 0) && <section className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /><h4 className="text-sm font-semibold">Histórico</h4></div>
        <div className="rounded-md border divide-y text-sm">{log.map((row) => <div key={row.id} className="flex items-center gap-3 px-3 py-2"><span className="text-muted-foreground text-xs">{new Date(row.createdAt).toLocaleString('pt-BR')}</span><span className="text-xs text-muted-foreground">{row.periodFrom} → {row.periodTo}</span><span className="ml-auto text-xs">{row.transactionsImported}/{row.transactionsFetched} importadas{row.duplicates ? ` · ${row.duplicates} dup` : ''}</span>{row.status === 'success' ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertCircle className="h-3.5 w-3.5 text-warning" />}</div>)}</div>
      </section>}
    </div>
  )
}

export const openBankingConnector: ConnectorDefinition = {
  id: 'tecnospeed-openfinance',
  hostPluginId: 'financial',
  name: 'Open Finance · TecnoSpeed',
  description: 'Conecte contas, importe extratos e concilie no Financeiro.',
  icon: 'Landmark',
  authKind: 'api-key',
  fields: [{ key: 'payerCpfCnpj', label: 'CPF/CNPJ do pagador', type: 'text', placeholder: '00.000.000/0001-00' }],
  async getStatus() { const found = await provider.getIntegration(); return { connected: !!found?.active, detail: found?.status } },
  testConnection: (values) => provider.testConnection({ payerCpfCnpj: values.payerCpfCnpj }),
  saveConnection: async (values) => { await provider.saveIntegration({ payerCpfCnpj: values.payerCpfCnpj }) },
  ExtraPanel: () => <OpenBankingPanelBoundary><OpenBankingExtraPanel /></OpenBankingPanelBoundary>,
}
