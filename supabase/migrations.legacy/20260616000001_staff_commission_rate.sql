-- ============================================================================
-- B4 (dogfood-sprint): add the per-professional default commission rate that
-- B5 commission compute needs. Ring-2 extension column on public.staff_members
-- (1:1 with person(kind=staff)), surfaced through the canonical v_staff view.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE VIEW. Re-asserts
-- security_invoker so saas_core RLS on persons stays enforced (see
-- 20260404000001_views_security_invoker.sql). Inherits staff_members' existing
-- tenant_id RLS — no new policy needed.
-- ============================================================================

-- Percentage (0–100) of a booking's realized total paid to the assigned
-- professional. Default 0 = no commission until configured.
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2) NOT NULL DEFAULT 0;

-- Surface commission_rate through v_staff so B5 / dashboards read it via the
-- same bridge view as the rest of the staff fields. Guarded on table existence
-- to match the repo's conditional-view pattern.
DO $$ BEGIN
IF EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'staff_members'
) THEN
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
      sm.updated_at,
      sm.commission_rate
    FROM public.staff_members sm
    INNER JOIN saas_core.persons p ON p.id = sm.person_id;
    ALTER VIEW public.v_staff SET (security_invoker = true);
    GRANT SELECT ON public.v_staff TO authenticated;
  ';
END IF;
END $$;

NOTIFY pgrst, 'reload schema';
