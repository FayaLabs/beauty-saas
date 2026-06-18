# Open Banking (app-local incubator plugin)

Client-owned connector that syncs a bank statement into the SDK financial ledger
and drives **reconciliation (conciliação)**. Provider: **Tecnospeed PlugBank**.

## What it owns
- **DB**: `public.bank_integrations` (connection + credentials) and
  `public.bank_integration_sync_log` (run audit). See `schema/` + `migrations/`.
- **Edge function**: `supabase/functions/plugbank-sync` (data plane) — calls the
  PlugBank API, normalizes lines, imports into `public.financial_movements`
  tagged `external_source='plugbank'` (idempotent via the SDK financial
  `uq_financial_movements_external` index).
- **UI**: an "Open Banking" tab in `/settings` (`settings/BankIntegrationSettings.tsx`)
  — connect/test/save, fetch a statement, import selected lines, view history.

## How it composes with the SDK
- Depends on `@fayz-ai/plugin-financial`. Imported lines are reconciled in
  **Financial → Conciliação**, which is the SDK `ReconciliationView` enabled via
  `createFinancialPlugin({ modules: { reconciliation: true } })`.
- The matching model + columns (`external_id`, `external_source`, `reconciled_at`,
  `matched_movement_id`) live in the SDK financial migration `007_reconciliation.sql`.

## Deploy
1. Apply the SDK financial migration `007_reconciliation.sql` and this plugin's
   `migrations/001_openbanking.sql`.
2. `supabase functions deploy plugbank-sync` with secrets
   `PLUGBANK_BASE_URL`, plus the standard `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
3. Register `createOpenBankingPlugin()` in `src/config/app.tsx` and enable the
   financial `reconciliation` module.
4. (Optional, "runs in backend") schedule a daily `import_transactions` via
   `pg_cron` + `pg_net` to the function for hands-off sync.

## Graduation path
Move this folder to `fayz-sdk/plugins/plugin-banking-br/` and add more provider
drivers (Inter, Belvo, Pluggy) behind the same connector shape.
