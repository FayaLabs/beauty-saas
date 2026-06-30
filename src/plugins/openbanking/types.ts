// Open Banking plugin — shared types.

export interface BankIntegration {
  id: string
  provider: string
  payerCpfCnpj: string
  environment: string
  status: string
  active: boolean
  statementSource?: 'direct' | 'legacy_worker'
  lastSyncAt?: string
  lastError?: string
}

export interface SaveIntegrationInput {
  payerCpfCnpj: string
  environment?: string
}

export interface SyncLogEntry {
  id: string
  periodFrom?: string
  periodTo?: string
  transactionsFetched: number
  transactionsImported: number
  duplicates: number
  status: string
  errorMessage?: string
  createdAt: string
}

export interface OpenFinanceAccount {
  id?: string
  accountHash: string
  bankCode?: string
  agency?: string
  accountNumberMasked?: string
  account_number_masked?: string
  statusOpenfinance?: string
  status_openfinance?: string
  openfinanceLink?: string
  openfinance_link?: string
  active?: boolean
}

export interface CreateOpenFinanceAccountInput {
  payer: {
    name: string
    email?: string
    neighborhood?: string
    addressNumber?: string
    zipcode?: string
    state?: string
    city?: string
    street?: string
    addressComplement?: string
    confirmPayerUpdate?: boolean
  }
  account: {
    bankCode: string
    agency: string
    accountNumber: string
    accountNumberDigit?: string
    accountDac?: string
  }
}

/** A normalized bank-statement line returned by the edge function. */
export interface BankLine {
  externalId: string
  date: string            // YYYY-MM-DD
  type: 'C' | 'D'         // credit (in) / debit (out)
  amount: number
  description: string
}

export interface TestConnectionResult {
  ok: boolean
  message?: string
}

export interface FetchStatementResult {
  lines: BankLine[]
  coverage?: { complete: boolean; lastSyncedAt?: string; protocolId?: string }
  sync?: SyncJobState
}

export interface SyncJobState {
  id?: string
  jobId?: string
  status: 'pending' | 'running' | 'retry_wait' | 'completed' | 'failed'
  retryAfter?: string
  retry_after?: string
  lastError?: string
  last_error?: string
}

export interface ImportResult {
  imported: number
  duplicates: number
}
