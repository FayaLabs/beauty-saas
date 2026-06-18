-- Seed a default sales pipeline + standard stages for every tenant that has none.
--
-- The CRM pipeline board (#/sales/pipeline) reads public.pipelines and
-- public.pipeline_stages directly. Nothing ever seeded these tables, so a fresh
-- tenant has zero rows and the board renders completely blank. This backfills a
-- default "Sales Pipeline" with the canonical stage set (matching the plugin's
-- mock/offline provider). Idempotent: tenants that already have a pipeline are
-- skipped, so it's safe to re-run.

DO $$
DECLARE
  ten record;
  pid uuid;
BEGIN
  FOR ten IN SELECT id FROM saas_core.tenants LOOP
    IF EXISTS (SELECT 1 FROM public.pipelines WHERE tenant_id = ten.id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.pipelines (tenant_id, name, is_default, is_active)
    VALUES (ten.id, 'Sales Pipeline', true, true)
    RETURNING id INTO pid;

    INSERT INTO public.pipeline_stages
      (tenant_id, pipeline_id, name, "order", color, probability, is_won, is_lost)
    VALUES
      (ten.id, pid, 'New',         0, '#6366f1',  10, false, false),
      (ten.id, pid, 'Contacted',   1, '#3b82f6',  25, false, false),
      (ten.id, pid, 'Qualified',   2, '#f59e0b',  50, false, false),
      (ten.id, pid, 'Proposal',    3, '#f97316',  75, false, false),
      (ten.id, pid, 'Negotiation', 4, '#8b5cf6',  90, false, false),
      (ten.id, pid, 'Won',         5, '#22c55e', 100, true,  false),
      (ten.id, pid, 'Lost',        6, '#ef4444',   0, false, true);
  END LOOP;
END $$;
