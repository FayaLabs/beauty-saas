// Open Banking plugin (app-local incubator) — Ring-1 Drizzle schema.
//
// CLIENT-OWNED connector that follows the SDK plugin contract. It owns the bank
// connection + sync-audit tables and a Supabase Edge Function (plugbank-sync)
// that imports bank-statement lines into the SDK financial ledger
// (public.financial_movements, tagged external_source='plugbank'). The matching
// happens in the SDK financial plugin's Reconciliation view.
//
// Graduation path (see PLUGIN.md): move this folder to
// `fayz-sdk/plugins/plugin-banking-br/src/` largely unchanged.
//
// Builders come from @fayz-ai/db (single drizzle-orm instance). NEVER import
// pgTable/uuid from drizzle-orm/pg-core directly.
import { pgTable, uuid, text, integer, boolean, timestamp, date, tenantId, timestamps, createdAt } from '@fayz-ai/db'

// bank_integrations — one connection per (tenant, bank account, provider).
// Holds the provider credentials (Tecnospeed PlugBank: api_token + cnpj). Server
// secrets that must never reach the browser live in Supabase function env; this
// row stores the per-tenant config + token that the edge function reads with the
// service role.
export const bankIntegrations = pgTable('bank_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  provider: text('provider').notNull().default('plugbank'),
  bankAccountId: uuid('bank_account_id'),
  // Tecnospeed PlugBank credentials
  apiToken: text('api_token'),
  cnpj: text('cnpj'),
  environment: text('environment').notNull().default('production'), // production | sandbox
  active: boolean('active').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  ...timestamps,
})

// bank_integration_sync_log — one row per sync run (audit trail).
export const bankIntegrationSyncLog = pgTable('bank_integration_sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantId(),
  bankIntegrationId: uuid('bank_integration_id').notNull().references(() => bankIntegrations.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bank_account_id'),
  periodFrom: date('period_from'),
  periodTo: date('period_to'),
  transactionsFetched: integer('transactions_fetched').notNull().default(0),
  transactionsImported: integer('transactions_imported').notNull().default(0),
  duplicates: integer('duplicates').notNull().default(0),
  status: text('status').notNull().default('success'), // success | partial | error
  errorMessage: text('error_message'),
  triggeredByUserId: uuid('triggered_by_user_id'),
  ...createdAt,
})
