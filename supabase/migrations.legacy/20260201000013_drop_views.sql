-- Drop cross-schema views — no longer used
-- Entity queries now use the archetype provider pattern:
-- 1. Query public extension table (clients, staff_members, stock_movements)
-- 2. Batch-fetch related archetype data (persons, products) from saas_core
-- This is 2 HTTP calls but proper SQL per call, and handles the PostgREST
-- cross-schema FK limitation cleanly.

DROP VIEW IF EXISTS public.clients_view CASCADE;
DROP VIEW IF EXISTS public.staff_view CASCADE;
DROP VIEW IF EXISTS public.stock_movements_view CASCADE;
DROP VIEW IF EXISTS public.equipment_view CASCADE;

-- Keep these views — they're genuine domain views, not FK workarounds:
-- public.deals_view (3-table join with column aliasing)
-- public.leads_view (JSONB field extraction)
-- public.financial_movements_view (invoice info join)

NOTIFY pgrst, 'reload schema';
