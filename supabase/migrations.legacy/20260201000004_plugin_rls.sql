-- RLS policies for all plugin tables
-- Uses the same tenant isolation pattern as project_rls.sql

-- Helper: ensure public.user_tenant_ids() exists (mirrors saas_core version)
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid();
$$;

-- Apply tenant isolation to ALL public tables that have tenant_id
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN (
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenant_id'
    AND table_name NOT IN (
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public')
    )
  )
  LOOP
    -- Skip if policies already exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_select') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t || '_select', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_insert') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))', t || '_insert', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_update') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t || '_update', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_delete') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t || '_delete', t);
    END IF;
  END LOOP;
END $$;

-- Grant access to authenticated users
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN (
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenant_id'
  )
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;
