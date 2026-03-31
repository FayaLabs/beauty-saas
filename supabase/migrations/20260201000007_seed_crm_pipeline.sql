-- Seed default CRM pipeline for all existing tenants that don't have one
-- This runs once; new tenants get their pipeline via onboarding

DO $$
DECLARE
  t_id uuid;
  p_id uuid;
BEGIN
  FOR t_id IN (
    SELECT id FROM saas_core.tenants
    WHERE id NOT IN (SELECT tenant_id FROM public.pipelines)
  )
  LOOP
    -- Create default pipeline
    INSERT INTO public.pipelines (tenant_id, name, is_default, is_active)
    VALUES (t_id, 'Sales Pipeline', true, true)
    RETURNING id INTO p_id;

    -- Create default stages
    INSERT INTO public.pipeline_stages (tenant_id, pipeline_id, name, "order", color, probability, is_won, is_lost) VALUES
      (t_id, p_id, 'New',          0, '#6366f1', 10,  false, false),
      (t_id, p_id, 'Contacted',    1, '#3b82f6', 25,  false, false),
      (t_id, p_id, 'Qualified',    2, '#f59e0b', 50,  false, false),
      (t_id, p_id, 'Proposal',     3, '#f97316', 75,  false, false),
      (t_id, p_id, 'Negotiation',  4, '#8b5cf6', 90,  false, false),
      (t_id, p_id, 'Won',          5, '#22c55e', 100, true,  false),
      (t_id, p_id, 'Lost',         6, '#ef4444', 0,   false, true);
  END LOOP;
END $$;
