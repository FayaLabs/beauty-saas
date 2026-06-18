-- Consolidated cross-schema views (v_ prefix)
-- These are the canonical query endpoints for entities that span public + saas_core.
-- Each view does a proper SQL JOIN — single query, flat results.

-- =============================================================
-- Drop old views and RPCs
-- =============================================================
DROP VIEW IF EXISTS public.clients_view CASCADE;
DROP VIEW IF EXISTS public.staff_view CASCADE;
DROP VIEW IF EXISTS public.stock_movements_view CASCADE;
DROP VIEW IF EXISTS public.equipment_view CASCADE;

-- Rename existing views to v_ prefix
DROP VIEW IF EXISTS public.deals_view CASCADE;
DROP VIEW IF EXISTS public.leads_view CASCADE;
DROP VIEW IF EXISTS public.financial_movements_view CASCADE;

-- Drop RPC functions (replaced by views)
DROP FUNCTION IF EXISTS public.get_clients;
DROP FUNCTION IF EXISTS public.get_staff;
DROP FUNCTION IF EXISTS public.get_staff_members;
DROP FUNCTION IF EXISTS public.get_stock_movements;
DROP FUNCTION IF EXISTS public.count_stock_movements;
DROP FUNCTION IF EXISTS public.archetype_join;
DROP FUNCTION IF EXISTS public.table_join;
DROP FUNCTION IF EXISTS public.list_persons_extended;
DROP FUNCTION IF EXISTS public.list_stock_movements;
DROP FUNCTION IF EXISTS public.count_stock_movements;

-- =============================================================
-- v_clients: public.clients JOIN saas_core.persons
-- =============================================================
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients') THEN
  EXECUTE '
    CREATE OR REPLACE VIEW public.v_clients AS
    SELECT
      p.id,
      c.tenant_id,
      p.name,
      p.email,
      p.phone,
      p.document_number,
      p.avatar_url,
      p.date_of_birth,
      p.notes,
      p.is_active,
      p.tags,
      c.gender,
      c.origin,
      c.visits,
      c.total_spent,
      c.last_visit,
      c.created_at,
      c.updated_at
    FROM public.clients c
    INNER JOIN saas_core.persons p ON p.id = c.person_id;
    GRANT SELECT ON public.v_clients TO authenticated;
  ';
END IF;
END $$;

-- =============================================================
-- v_staff: public.staff_members JOIN saas_core.persons
-- =============================================================
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_members') THEN
  EXECUTE '
    CREATE OR REPLACE VIEW public.v_staff AS
    SELECT
      p.id,
      sm.tenant_id,
      p.name,
      p.email,
      p.phone,
      p.document_number,
      p.notes,
      p.is_active,
      p.tags,
      sm.created_at,
      sm.updated_at
    FROM public.staff_members sm
    INNER JOIN saas_core.persons p ON p.id = sm.person_id;
    GRANT SELECT ON public.v_staff TO authenticated;
  ';
END IF;
END $$;

-- =============================================================
-- v_stock_movements: public.stock_movements JOIN saas_core.products + stock_locations
-- =============================================================
CREATE OR REPLACE VIEW public.v_stock_movements AS
SELECT
  sm.*,
  p.name AS product_name,
  p.sku AS product_sku,
  sl.name AS stock_location_name,
  dl.name AS destination_location_name
FROM public.stock_movements sm
LEFT JOIN saas_core.products p ON p.id = sm.product_id
LEFT JOIN public.stock_locations sl ON sl.id = sm.stock_location_id
LEFT JOIN public.stock_locations dl ON dl.id = sm.destination_location_id;

GRANT SELECT ON public.v_stock_movements TO authenticated;

-- =============================================================
-- v_leads: saas_core.persons (kind='lead') with JSONB extraction
-- =============================================================
CREATE OR REPLACE VIEW public.v_leads AS
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

GRANT SELECT ON public.v_leads TO authenticated;

-- =============================================================
-- v_deals: saas_core.orders JOIN deal_extensions JOIN pipeline_stages
-- =============================================================
CREATE OR REPLACE VIEW public.v_deals AS
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

GRANT SELECT ON public.v_deals TO authenticated;

-- =============================================================
-- v_financial_movements: public.financial_movements JOIN saas_core.orders
-- =============================================================
CREATE OR REPLACE VIEW public.v_financial_movements AS
SELECT
  fm.*,
  o.notes AS invoice_description,
  o.total AS invoice_total,
  o.status AS invoice_status,
  o.metadata->>'contactName' AS contact_name,
  o.metadata->>'itemsSummary' AS items_summary
FROM public.financial_movements fm
LEFT JOIN saas_core.orders o ON o.id = fm.invoice_id;

GRANT SELECT ON public.v_financial_movements TO authenticated;

NOTIFY pgrst, 'reload schema';
