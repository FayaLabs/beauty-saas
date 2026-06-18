-- ---------------------------------------------------------------------------
-- Financial extract (extrato): net card settlement + transfers
-- ---------------------------------------------------------------------------
-- Adds the processing/MDR fee column used by the bank/cash account statement so
-- the running balance reflects the NET cash that actually lands in the account.
--   gross    = paid_amount (settles the receivable/payable)
--   net cash = paid_amount - fee_amount  (credits only; v1 has no fee on debits)
-- A typed numeric column (not metadata jsonb) is used so the fee participates in
-- SUM() aggregation for period totals and ledger-derived balances.
ALTER TABLE public.financial_movements
  ADD COLUMN IF NOT EXISTS fee_amount numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.financial_movements.fee_amount IS
  'Processing/MDR fee deducted at settlement. Net cash impact = paid_amount - fee_amount (credit). v1: same-day net, no D+N settlement-date modeling.';

-- Speed up the extract: realized cash movements per account ordered by payment date.
CREATE INDEX IF NOT EXISTS idx_financial_movements_statement
  ON public.financial_movements (bank_account_id, payment_date)
  WHERE status IN ('paid', 'partial');

-- ---------------------------------------------------------------------------
-- Transfers between accounts are recorded as a debit row (source) + a credit row
-- (destination), both status='paid', movement_kind='transfer', correlated via
-- metadata jsonb (no pairing column added in v1):
--   metadata->>'transferId'       shared uuid
--   metadata->>'transferRole'     'out' | 'in'
--   metadata->>'counterAccountId' the other account's id
-- Each leg is scoped to its own bank_account_id, so the existing statement query
-- picks up exactly one side per account. Promote to a transfer_id column later if
-- DB-level reporting/integrity is required.
-- Existing RLS policies (tenant_id IN (SELECT public.user_tenant_ids())) already
-- cover the new column and the transfer rows.
-- ---------------------------------------------------------------------------
