CREATE OR REPLACE VIEW public.rep_financial_accounting_dimensions AS
WITH invoice_payments AS (
  SELECT
    fm.tenant_id,
    fm.invoice_id,
    COALESCE(SUM(fm.paid_amount) FILTER (WHERE fm.movement_kind = 'payment'), 0)::numeric(14,2) AS paid_amount,
    COALESCE(SUM(fm.amount) FILTER (WHERE fm.movement_kind = 'bill' AND fm.status IN ('pending', 'partial', 'overdue')), 0)::numeric(14,2) AS open_amount
  FROM public.financial_movements fm
  WHERE fm.invoice_id IS NOT NULL
    AND fm.status <> 'cancelled'
  GROUP BY fm.tenant_id, fm.invoice_id
),
line_dimensions AS (
  SELECT
    o.tenant_id,
    o.id AS invoice_id,
    o.created_at::date AS date,
    o.direction,
    COALESCE(NULLIF(oi.metadata->>'accountId', ''), NULLIF(oi.metadata->>'account_id', '')) AS account_id,
    COALESCE(NULLIF(oi.metadata->>'costCenterId', ''), NULLIF(oi.metadata->>'cost_center_id', '')) AS cost_center_id,
    oi.id AS line_id,
    COALESCE(oi.total, 0)::numeric(14,2) AS line_total,
    o.created_at,
    o.updated_at
  FROM saas_core.orders o
  JOIN saas_core.order_items oi ON oi.order_id = o.id
  WHERE o.kind IN ('invoice_payable', 'invoice_receivable', 'service_order')
    AND COALESCE(o.status, '') <> 'cancelled'
),
invoice_totals AS (
  SELECT
    tenant_id,
    invoice_id,
    COALESCE(SUM(line_total), 0)::numeric(14,2) AS invoice_line_total
  FROM line_dimensions
  GROUP BY tenant_id, invoice_id
)
SELECT
  ld.tenant_id,
  ld.date,
  ld.direction,
  COALESCE(ld.account_id, 'unassigned') AS account_id,
  ca.code AS account_code,
  COALESCE(ca.name, 'Sem plano de contas') AS account_name,
  COALESCE(ld.cost_center_id, 'unassigned') AS cost_center_id,
  cc.code AS cost_center_code,
  COALESCE(cc.name, 'Sem centro de custo') AS cost_center_name,
  COUNT(DISTINCT ld.invoice_id)::integer AS invoice_count,
  COUNT(ld.line_id)::integer AS line_count,
  COALESCE(SUM(ld.line_total), 0)::numeric(14,2) AS total_amount,
  COALESCE(SUM(
    CASE
      WHEN it.invoice_line_total > 0 THEN ip.paid_amount * ld.line_total / it.invoice_line_total
      ELSE 0
    END
  ), 0)::numeric(14,2) AS paid_amount,
  COALESCE(SUM(
    CASE
      WHEN it.invoice_line_total > 0 THEN ip.open_amount * ld.line_total / it.invoice_line_total
      ELSE 0
    END
  ), 0)::numeric(14,2) AS open_amount,
  MAX(ld.updated_at) AS updated_at
FROM line_dimensions ld
LEFT JOIN public.chart_of_accounts ca ON ca.id::text = ld.account_id AND ca.tenant_id = ld.tenant_id
LEFT JOIN public.cost_centers cc ON cc.id::text = ld.cost_center_id AND cc.tenant_id = ld.tenant_id
LEFT JOIN invoice_payments ip ON ip.invoice_id = ld.invoice_id AND ip.tenant_id = ld.tenant_id
LEFT JOIN invoice_totals it ON it.invoice_id = ld.invoice_id AND it.tenant_id = ld.tenant_id
GROUP BY
  ld.tenant_id,
  ld.date,
  ld.direction,
  COALESCE(ld.account_id, 'unassigned'),
  ca.code,
  COALESCE(ca.name, 'Sem plano de contas'),
  COALESCE(ld.cost_center_id, 'unassigned'),
  cc.code,
  COALESCE(cc.name, 'Sem centro de custo');
--> statement-breakpoint
ALTER VIEW public.rep_financial_accounting_dimensions SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_financial_accounting_dimensions TO authenticated;
--> statement-breakpoint
NOTIFY pgrst, 'reload schema';
