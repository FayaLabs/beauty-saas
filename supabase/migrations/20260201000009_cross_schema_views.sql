-- Cross-schema views for efficient single-query joins
-- PostgREST can't join across schemas in the query builder,
-- so we create views in the public schema that do the join server-side.

-- =============================================================
-- Stock movements with product name (for inventory plugin)
-- =============================================================
CREATE OR REPLACE VIEW public.stock_movements_view AS
SELECT
  sm.*,
  p.name AS product_name,
  p.sku AS product_sku
FROM public.stock_movements sm
LEFT JOIN saas_core.products p ON p.id = sm.product_id;

GRANT SELECT ON public.stock_movements_view TO authenticated;

-- =============================================================
-- Financial movements with invoice info (for financial plugin)
-- =============================================================
CREATE OR REPLACE VIEW public.financial_movements_view AS
SELECT
  fm.*,
  o.notes AS invoice_description,
  o.total AS invoice_total,
  o.status AS invoice_status,
  o.metadata->>'contactName' AS contact_name,
  o.metadata->>'itemsSummary' AS items_summary
FROM public.financial_movements fm
LEFT JOIN saas_core.orders o ON o.id = fm.invoice_id;

GRANT SELECT ON public.financial_movements_view TO authenticated;

-- =============================================================
-- CRM deals view (orders + deal_extensions + pipeline stages)
-- =============================================================
CREATE OR REPLACE VIEW public.deals_view AS
SELECT
  o.id,
  o.tenant_id,
  o.status,
  o.total AS value,
  o.notes AS title,
  o.party_id AS contact_id,
  o.assignee_id AS assigned_to_id,
  o.tags,
  o.metadata->>'contactName' AS contact_name,
  o.created_at,
  o.updated_at,
  de.pipeline_id,
  de.stage_id,
  de.probability,
  de.expected_close_date,
  de.lead_id,
  de.lost_reason,
  ps.name AS stage_name,
  ps.color AS stage_color,
  ps."order" AS stage_order
FROM saas_core.orders o
LEFT JOIN public.deal_extensions de ON de.order_id = o.id
LEFT JOIN public.pipeline_stages ps ON ps.id = de.stage_id
WHERE o.kind = 'deal';

GRANT SELECT ON public.deals_view TO authenticated;

-- =============================================================
-- CRM leads view (persons filtered by kind='lead')
-- =============================================================
CREATE OR REPLACE VIEW public.leads_view AS
SELECT
  p.id,
  p.tenant_id,
  p.name,
  p.email,
  p.phone,
  p.notes,
  p.tags,
  p.is_active,
  p.metadata->>'company' AS company,
  p.metadata->>'sourceId' AS source_id,
  p.metadata->>'sourceName' AS source_name,
  COALESCE(p.metadata->>'status', 'new') AS lead_status,
  p.metadata->>'value' AS lead_value,
  p.metadata->>'assignedToId' AS assigned_to_id,
  p.created_at,
  p.updated_at
FROM saas_core.persons p
WHERE p.kind = 'lead';

GRANT SELECT ON public.leads_view TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
