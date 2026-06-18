-- S1 (data-model refactor): event-sourced money. The financial state of an
-- invoice (any order with 'bill' movements, regardless of kind=quote/appointment/
-- invoice_*) is DERIVED from the append-only financial_movements ledger — never
-- a stored mutable field. Single source of truth for receivables/payables.
-- See docs/dogfood-sprint/DATA-MODEL-REFACTOR.md.
CREATE OR REPLACE VIEW public.v_invoice_balances AS
WITH bill AS (
  SELECT
    invoice_id,
    SUM(amount)      FILTER (WHERE status <> 'cancelled') AS billed,
    SUM(paid_amount) FILTER (WHERE status <> 'cancelled') AS paid,
    bool_or(status NOT IN ('paid','cancelled') AND due_date < now()) AS has_overdue
  FROM public.financial_movements
  WHERE movement_kind = 'bill'
  GROUP BY invoice_id
)
SELECT
  o.id                AS invoice_id,
  o.tenant_id,
  o.kind,
  o.reference_number,
  o.party_id,
  o.direction,
  CASE WHEN o.direction = 'debit' OR o.kind = 'invoice_payable'
       THEN 'payable' ELSE 'receivable' END                       AS flow,
  COALESCE(b.billed, o.total, 0)                                  AS amount,
  COALESCE(b.paid, 0)                                             AS paid,
  CASE WHEN o.status = 'cancelled' OR o.stage = 'cancelled' THEN 0
       ELSE COALESCE(b.billed, o.total, 0) - COALESCE(b.paid, 0)
  END                                                             AS balance,
  CASE
    WHEN o.status = 'cancelled' OR o.stage = 'cancelled'          THEN 'cancelled'
    WHEN COALESCE(b.billed, o.total, 0) = 0                       THEN 'open'
    WHEN COALESCE(b.paid, 0) >= COALESCE(b.billed, o.total, 0)    THEN 'paid'
    WHEN COALESCE(b.paid, 0) > 0                                  THEN 'partial'
    WHEN COALESCE(b.has_overdue, false)                          THEN 'overdue'
    ELSE 'open'
  END                                                             AS status,
  o.created_at, o.updated_at
FROM saas_core.orders o
LEFT JOIN bill b ON b.invoice_id = o.id
WHERE o.kind IN ('invoice_receivable','invoice_payable')
   OR b.invoice_id IS NOT NULL;
ALTER VIEW public.v_invoice_balances SET (security_invoker = true);
GRANT SELECT ON public.v_invoice_balances TO authenticated;
NOTIFY pgrst, 'reload schema';
