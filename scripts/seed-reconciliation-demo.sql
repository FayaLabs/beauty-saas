-- Demo seed for the ⇄ Reconciliation (conciliação) UI — tenant of maia.silvio.rj@gmail.com.
-- Idempotent + clearly tagged (external_id 'demo-rec-*') so it's easy to remove later:
--   DELETE FROM public.plg_financial_movements WHERE external_id LIKE 'demo-rec-%';
--   DELETE FROM public.plg_financial_movements WHERE notes LIKE '[demo-rec] %';
-- Requires the reconciliation columns (plugin-financial 007_reconciliation.sql) to be applied first.
-- Run via the same Management-API path as db-apply.mjs.

WITH t AS (
  SELECT tm.tenant_id
  FROM public.tenant_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE lower(u.email) = 'maia.silvio.rj@gmail.com'
  ORDER BY tm.created_at NULLS LAST
  LIMIT 1
),
account AS (
  INSERT INTO public.chart_of_accounts (tenant_id, code, name, node_type)
  SELECT t.tenant_id, '3.1.01', 'Receita de servicos beauty', 'leaf'
  FROM t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.tenant_id = t.tenant_id AND c.code = '3.1.01'
  )
  RETURNING tenant_id, id
),
existing_account AS (
  SELECT c.tenant_id, c.id
  FROM public.chart_of_accounts c
  JOIN t ON t.tenant_id = c.tenant_id
  WHERE c.code = '3.1.01'
  UNION ALL
  SELECT tenant_id, id FROM account
  LIMIT 1
),
cost_center AS (
  INSERT INTO public.cost_centers (tenant_id, code, name)
  SELECT t.tenant_id, 'RJ-SALON', 'Salao Rio de Janeiro'
  FROM t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cost_centers c
    WHERE c.tenant_id = t.tenant_id AND c.code = 'RJ-SALON'
  )
  RETURNING tenant_id, id
),
existing_cost_center AS (
  SELECT c.tenant_id, c.id
  FROM public.cost_centers c
  JOIN t ON t.tenant_id = c.tenant_id
  WHERE c.code = 'RJ-SALON'
  UNION ALL
  SELECT tenant_id, id FROM cost_center
  LIMIT 1
)
-- (1) Two internal receivables the bank lines should reconcile against (external_source NULL).
INSERT INTO public.plg_financial_movements
  (tenant_id, direction, movement_kind, amount, paid_amount, status, due_date, notes, metadata)
SELECT
  t.tenant_id,
  v.direction,
  'bill',
  v.amount,
  0,
  'pending',
  v.d,
  v.descr,
  jsonb_build_object(
    'accountId', existing_account.id,
    'costCenterId', existing_cost_center.id,
    'migrationDemo', 'financial-reconciliation-dimensions'
  )
FROM t
CROSS JOIN existing_account
CROSS JOIN existing_cost_center
CROSS JOIN (VALUES
  ('credit', 150.00, DATE '2026-06-09', '[demo-rec] Fatura Cliente A'),
  ('credit', 320.00, DATE '2026-06-10', '[demo-rec] Fatura Cliente B')
) AS v(direction, amount, d, descr)
WHERE NOT EXISTS (
  SELECT 1 FROM public.plg_financial_movements m
  WHERE m.tenant_id = t.tenant_id AND m.notes = v.descr
);

-- (2) Imported bank-statement lines pending reconciliation (external_source = 'plugbank').
WITH t AS (
  SELECT tm.tenant_id
  FROM public.tenant_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE lower(u.email) = 'maia.silvio.rj@gmail.com'
  ORDER BY tm.created_at NULLS LAST
  LIMIT 1
),
existing_account AS (
  SELECT c.tenant_id, c.id
  FROM public.chart_of_accounts c
  JOIN t ON t.tenant_id = c.tenant_id
  WHERE c.code = '3.1.01'
  LIMIT 1
),
existing_cost_center AS (
  SELECT c.tenant_id, c.id
  FROM public.cost_centers c
  JOIN t ON t.tenant_id = c.tenant_id
  WHERE c.code = 'RJ-SALON'
  LIMIT 1
)
INSERT INTO public.plg_financial_movements
  (tenant_id, direction, movement_kind, amount, paid_amount, status, due_date, payment_date, notes, external_id, external_source, metadata)
SELECT
  t.tenant_id,
  v.direction,
  'payment',
  v.amount,
  v.amount,
  'paid',
  v.d,
  v.d,
  v.descr,
  v.eid,
  'plugbank',
  CASE
    WHEN v.direction = 'credit' THEN jsonb_build_object(
      'accountId', existing_account.id,
      'costCenterId', existing_cost_center.id,
      'migrationDemo', 'financial-reconciliation-dimensions'
    )
    ELSE jsonb_build_object('migrationDemo', 'financial-reconciliation-dimensions')
  END
FROM t
LEFT JOIN existing_account ON existing_account.tenant_id = t.tenant_id
LEFT JOIN existing_cost_center ON existing_cost_center.tenant_id = t.tenant_id
CROSS JOIN (VALUES
  ('credit', 150.00, DATE '2026-06-10', '[demo-rec] PIX recebido — Cliente A', 'demo-rec-1'),
  ('credit', 320.00, DATE '2026-06-11', '[demo-rec] TED recebida — Cliente B', 'demo-rec-2'),
  ('debit',   80.00, DATE '2026-06-12', '[demo-rec] Tarifa bancária',          'demo-rec-3'),
  ('debit',  210.00, DATE '2026-06-12', '[demo-rec] Pagamento fornecedor',     'demo-rec-4')
) AS v(direction, amount, d, descr, eid)
ON CONFLICT (tenant_id, external_source, external_id)
  WHERE external_id IS NOT NULL AND external_source IS NOT NULL
  DO NOTHING;

NOTIFY pgrst, 'reload schema';
