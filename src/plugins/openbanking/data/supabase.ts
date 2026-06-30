// Open Banking plugin — authenticated client for the Windows bridge.
// TecnoSpeed credentials, worker tokens and service_role never enter the browser.
// The bridge validates Supabase JWT + tenant, talks to the legacy Windows worker,
// and writes normalized movements into the financial ledger.
import { getSupabaseClientOptional, getActiveTenantId } from '@fayz-ai/saas'
import type {
  BankIntegration, SaveIntegrationInput, SyncLogEntry,
  TestConnectionResult, FetchStatementResult, ImportResult, BankLine,
  OpenFinanceAccount, CreateOpenFinanceAccountInput,
  SyncJobState,
} from '../types'

const BRIDGE_URL = String(import.meta.env.VITE_TECNOSPEED_BRIDGE_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')

function normalizeAccount(row: any): OpenFinanceAccount {
  return {
    ...row,
    id: row.id,
    accountHash: String(row.accountHash ?? row.account_hash ?? ''),
    bankCode: row.bankCode ?? row.bank_code ?? undefined,
    agency: row.agency ?? undefined,
    accountNumberMasked: row.accountNumberMasked ?? row.account_number_masked ?? undefined,
    statusOpenfinance: row.statusOpenfinance ?? row.status_openfinance ?? undefined,
    openfinanceLink: row.openfinanceLink ?? row.openfinance_link ?? undefined,
    active: row.active ?? undefined,
  }
}

async function bridge<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabaseClientOptional() as any
  const { data } = supabase ? await supabase.auth.getSession() : { data: null }
  const tenantId = getActiveTenantId()
  const response = await fetch(`${BRIDGE_URL}/api/v1/tecnospeed${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(data?.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.message ?? `Bridge TecnoSpeed respondeu HTTP ${response.status}`) as Error & {
      status?: number
      code?: string
      details?: unknown
      payload?: unknown
    }
    error.status = response.status
    error.code = payload?.error ?? payload?.code
    error.details = payload?.details
    error.payload = payload
    throw error
  }
  return payload as T
}

export interface OpenBankingProvider {
  getIntegration(): Promise<BankIntegration | null>
  saveIntegration(input: SaveIntegrationInput): Promise<BankIntegration>
  testConnection(input: { payerCpfCnpj: string; environment?: string }): Promise<TestConnectionResult>
  fetchStatement(input: { integrationId: string; accountHash?: string; from: string; to: string }): Promise<FetchStatementResult>
  importTransactions(input: { integrationId: string; accountHash?: string; bankAccountId?: string; from: string; to: string; lines: BankLine[] }): Promise<ImportResult>
  getSyncLog(integrationId: string): Promise<SyncLogEntry[]>
  listAccounts(): Promise<OpenFinanceAccount[]>
  createAccount(input: CreateOpenFinanceAccountInput): Promise<OpenFinanceAccount>
  refreshAccount(accountHash: string): Promise<OpenFinanceAccount>
  revokeAccount(accountHash: string): Promise<void>
  deleteAccount(accountHash: string): Promise<void>
  getSyncJob(jobId: string): Promise<SyncJobState>
}

export function createOpenBankingProvider(): OpenBankingProvider {
  return {
    async getIntegration() {
      const result = await bridge<{ integration: BankIntegration | null }>('/integration')
      return result.integration
    },

    async saveIntegration(input) {
      const result = await bridge<{ integration: BankIntegration }>('/integration', {
        method: 'PUT', body: JSON.stringify(input),
      })
      window.dispatchEvent(new CustomEvent('tecnospeed:integration-changed'))
      return result.integration
    },

    async testConnection(input) {
      try {
        return await bridge<TestConnectionResult>('/test', { method: 'POST', body: JSON.stringify(input) })
      } catch (error: any) {
        return { ok: false, message: error?.message ?? 'Falha ao validar a bridge TecnoSpeed' }
      }
    },

    async fetchStatement(input) {
      return bridge<FetchStatementResult>('/statements/preview', { method: 'POST', body: JSON.stringify(input) })
    },

    async importTransactions(input) {
      return bridge<ImportResult>('/statements/import', { method: 'POST', body: JSON.stringify(input) })
    },

    async getSyncLog(integrationId) {
      const result = await bridge<{ logs: any[] }>(`/sync-logs?integrationId=${encodeURIComponent(integrationId)}`)
      return (result.logs ?? []).map((row: any) => ({
        id: row.id,
        periodFrom: row.periodFrom ?? undefined,
        periodTo: row.periodTo ?? undefined,
        transactionsFetched: row.fetched ?? 0,
        transactionsImported: row.imported ?? 0,
        duplicates: row.duplicates ?? 0,
        status: row.status,
        errorMessage: row.errorMessage ?? undefined,
        createdAt: row.createdAt,
      }))
    },

    async listAccounts() {
      const result = await bridge<{ accounts: any[] }>('/accounts')
      return (result.accounts ?? []).map(normalizeAccount).filter((account) => account.accountHash)
    },

    async createAccount(input) {
      const integration = await this.getIntegration()
      if (!integration) throw new Error('Configure a integração antes de adicionar uma conta')
      if (integration.statementSource !== 'legacy_worker') {
        await bridge('/payers', {
          method: 'POST',
          body: JSON.stringify({
            payerCpfCnpj: integration.payerCpfCnpj,
            payload: { ...input.payer, statementActived: true },
          }),
        })
      }
      const created = await bridge<any>('/accounts', { method: 'POST', body: JSON.stringify({ payer: input.payer, account: input.account }) })
      return normalizeAccount(created)
    },

    refreshAccount(accountHash) {
      return bridge<any>(`/accounts/${encodeURIComponent(accountHash)}`).then(normalizeAccount)
    },

    async revokeAccount(accountHash) {
      await bridge(`/accounts/${encodeURIComponent(accountHash)}/revoke`, { method: 'POST' })
    },

    async deleteAccount(accountHash) {
      await bridge('/accounts', { method: 'DELETE', body: JSON.stringify({ accountHashes: [accountHash] }) })
    },

    async getSyncJob(jobId) {
      const result = await bridge<{ job: SyncJobState }>(`/sync-jobs/${encodeURIComponent(jobId)}`)
      return result.job
    },
  }
}
