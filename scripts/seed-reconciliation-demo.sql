-- Demo seed for the ⇄ Reconciliation (conciliação) UI — tenant of maia.silvio.rj@gmail.com.
-- Idempotent + clearly tagged (external_id 'demo-rec-*') so it's easy to remove later:
--   DELETE FROM public.financial_movements WHERE external_id LIKE 'demo-rec-%';
--   DELETE FROM public.financial_movements WHERE notes LIKE '[demo-rec] %';
-- Requires the reconciliation columns (plugin-financial 007_reconciliation.sql) to be applied first.
-- Run via the same Management-API path as db-apply.mjs.

WITH t AS (
  SELECT tm.tenant_id
  FROM saas_core.tenant_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE lower(u.email) = 'maia.silvio.rj@gmail.com'
  ORDER BY tm.created_at NULLS LAST
  LIMIT 1
)
-- (1) Two internal receivables the bank lines should reconcile against (external_source NULL).
INSERT INTO public.financial_movements
  (tenant_id, direction, movement_kind, amount, paid_amount, status, due_date, notes)
SELECT t.tenant_id, v.direction, 'bill', v.amount, 0, 'pending', v.d, v.descr
FROM t, (VALUES
  ('credit', 150.00, DATE '2026-06-09', '[demo-rec] Fatura Cliente A'),
  ('credit', 320.00, DATE '2026-06-10', '[demo-rec] Fatura Cliente B')
) AS v(direction, amount, d, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_movements m
  WHERE m.tenant_id = t.tenant_id AND m.notes = v.descr
);

-- (2) Imported bank-statement lines pending reconciliation (external_source = 'plugbank').
WITH t AS (
  SELECT tm.tenant_id
  FROM saas_core.tenant_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE lower(u.email) = 'maia.silvio.rj@gmail.com'
  ORDER BY tm.created_at NULLS LAST
  LIMIT 1
)
INSERT INTO public.financial_movements
  (tenant_id, direction, movement_kind, amount, paid_amount, status, due_date, payment_date, notes, external_id, external_source)
SELECT t.tenant_id, v.direction, 'payment', v.amount, v.amount, 'paid', v.d, v.d, v.descr, v.eid, 'plugbank'
FROM t, (VALUES
  ('credit', 150.00, DATE '2026-06-10', '[demo-rec] PIX recebido — Cliente A', 'demo-rec-1'),
  ('credit', 320.00, DATE '2026-06-11', '[demo-rec] TED recebida — Cliente B', 'demo-rec-2'),
  ('debit',   80.00, DATE '2026-06-12', '[demo-rec] Tarifa bancária',          'demo-rec-3'),
  ('debit',  210.00, DATE '2026-06-12', '[demo-rec] Pagamento fornecedor',     'demo-rec-4')
) AS v(direction, amount, d, descr, eid)
ON CONFLICT (tenant_id, external_source, external_id)
  WHERE external_id IS NOT NULL AND external_source IS NOT NULL
  DO NOTHING;

NOTIFY pgrst, 'reload schema';
