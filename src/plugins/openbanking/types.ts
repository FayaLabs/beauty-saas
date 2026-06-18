// Open Banking plugin — shared types.

export interface BankIntegration {
  id: string
  provider: string
  bankAccountId?: string
  apiToken?: string
  cnpj?: string
  environment: string
  active: boolean
  lastSyncAt?: string
}

export interface SaveIntegrationInput {
  id?: string
  bankAccountId?: string
  apiToken: string
  cnpj: string
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
}

export interface ImportResult {
  imported: number
  duplicates: number
}
