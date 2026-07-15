// Open Banking plugin (app-local) — Supabase data provider.
//
// Thin control-plane client. The heavy lifting (calling the Tecnospeed PlugBank
// API, normalizing lines, importing into plg_financial_movements with idempotency)
// runs in the `plugbank-sync` Edge Function. This provider reads/writes the
// connection row, invokes the function, and reads the sync log.
//
// On graduation this file moves to the SDK banking plugin largely unchanged.
import { getSupabaseClientOptional, getActiveTenantId } from '@fayz-ai/saas'
import type {
  BankIntegration, SaveIntegrationInput, SyncLogEntry,
  TestConnectionResult, FetchStatementResult, ImportResult, BankLine,
} from '../types'

const FUNCTION = 'plugbank-sync'

function sb() {
  const supabase = getSupabaseClientOptional() as any
  if (!supabase) throw new Error('Supabase not initialized')
  return supabase
}

function rowToIntegration(r: any): BankIntegration {
  return {
    id: r.id,
    provider: r.provider,
    bankAccountId: r.bank_account_id ?? undefined,
    apiToken: r.api_token ?? undefined,
    cnpj: r.cnpj ?? undefined,
    environment: r.environment ?? 'production',
    active: r.active ?? true,
    lastSyncAt: r.last_sync_at ?? undefined,
  }
}

export interface OpenBankingProvider {
  getIntegration(bankAccountId?: string): Promise<BankIntegration | null>
  saveIntegration(input: SaveIntegrationInput): Promise<BankIntegration>
  testConnection(input: { apiToken: string; cnpj: string; environment?: string }): Promise<TestConnectionResult>
  fetchStatement(input: { integrationId: string; from: string; to: string }): Promise<FetchStatementResult>
  importTransactions(input: { integrationId: string; bankAccountId?: string; from: string; to: string; lines: BankLine[] }): Promise<ImportResult>
  getSyncLog(integrationId: string): Promise<SyncLogEntry[]>
}

export function createOpenBankingProvider(): OpenBankingProvider {
  return {
    async getIntegration(bankAccountId) {
      const supabase = sb()
      let qb = supabase.from('bank_integrations').select('*').eq('provider', 'plugbank')
      qb = bankAccountId ? qb.eq('bank_account_id', bankAccountId) : qb.is('bank_account_id', null)
      const { data } = await qb.limit(1).maybeSingle()
      return data ? rowToIntegration(data) : null
    },

    async saveIntegration(input) {
      const supabase = sb()
      const tenantId = getActiveTenantId()
      const row = {
        tenant_id: tenantId,
        provider: 'plugbank',
        bank_account_id: input.bankAccountId ?? null,
        api_token: input.apiToken,
        cnpj: input.cnpj,
        environment: input.environment ?? 'production',
        active: true,
        updated_at: new Date().toISOString(),
      }
      // Upsert on the unique (tenant_id, bank_account_id, provider) key.
      const { data, error } = await supabase
        .from('bank_integrations')
        .upsert(input.id ? { id: input.id, ...row } : row, { onConflict: 'tenant_id,bank_account_id,provider' })
        .select()
        .single()
      if (error) throw error
      return rowToIntegration(data)
    },

    async testConnection(input) {
      const supabase = sb()
      const { data, error } = await supabase.functions.invoke(FUNCTION, {
        body: { action: 'test_connection', apiToken: input.apiToken, cnpj: input.cnpj, environment: input.environment ?? 'production' },
      })
      if (error) return { ok: false, message: error.message }
      return data as TestConnectionResult
    },

    async fetchStatement(input) {
      const supabase = sb()
      const { data, error } = await supabase.functions.invoke(FUNCTION, {
        body: { action: 'fetch_statement', integrationId: input.integrationId, from: input.from, to: input.to },
      })
      if (error) throw new Error(error.message)
      return data as FetchStatementResult
    },

    async importTransactions(input) {
      const supabase = sb()
      const { data, error } = await supabase.functions.invoke(FUNCTION, {
        body: {
          action: 'import_transactions',
          integrationId: input.integrationId,
          bankAccountId: input.bankAccountId,
          from: input.from,
          to: input.to,
          lines: input.lines,
        },
      })
      if (error) throw new Error(error.message)
      return data as ImportResult
    },

    async getSyncLog(integrationId) {
      const supabase = sb()
      const { data } = await supabase
        .from('bank_integration_sync_log')
        .select('*')
        .eq('bank_integration_id', integrationId)
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []).map((r: any) => ({
        id: r.id,
        periodFrom: r.period_from ?? undefined,
        periodTo: r.period_to ?? undefined,
        transactionsFetched: r.transactions_fetched ?? 0,
        transactionsImported: r.transactions_imported ?? 0,
        duplicates: r.duplicates ?? 0,
        status: r.status,
        errorMessage: r.error_message ?? undefined,
        createdAt: r.created_at,
      }))
    },
  }
}
