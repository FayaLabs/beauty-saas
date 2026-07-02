-- Beauty Ring-2 RLS enablement + per-tenant policies.
--
-- Why this exists: the SDK spine migration (@fayz-ai/db 002_rls_user_tenant_ids)
-- auto-discovers public tables with a `tenant_id` column and RLS-enables them —
-- but it runs BEFORE the app's Drizzle tables are created, so beauty's Ring-2
-- tables added by later Drizzle migrations (agenda extension tables, service
-- packages / price tables / execution defaults) were left RLS-disabled with no
-- policy. Without RLS these tenant-scoped tables are readable/writable across
-- tenants once exposed via PostgREST. This migration closes that gap.
--
-- Canonical form mirrors plugin-financial/006_rls_policies.sql:
--   tenant_id IN (SELECT public.user_tenant_ids())
-- Fully idempotent: ENABLE RLS is a no-op if already on; GRANT is idempotent;
-- every CREATE POLICY is guarded by IF NOT EXISTS on pg_policies. Each table is
-- guarded so the migration is safe even if a table is absent (partial provision).
-- Re-running is a no-op.

-- Ensure the tenant-scoping helper exists (create-if-missing; matches @fayz-ai/db 002).
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid();
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    -- Core agenda / clients / staff (already policied by the spine; listed for
    -- completeness — IF NOT EXISTS guards make these a no-op).
    'appointments','clients','staff_members',
    -- Agenda extension tables (added by 0001/0004/0007 — missed by spine RLS).
    'appointment_cancellation_reasons','appointment_confirmation_channels',
    'appointment_schedule_rules','appointment_waitlist_entries',
    -- Service execution defaults (added by 0008).
    'service_default_products','service_default_templates',
    -- Service packages + price tables (added by 0006).
    'service_packages','service_package_items',
    'service_price_tables','service_price_table_items',
    -- Service price variations (added by 0012).
    'service_price_variations'
  ])
  LOOP
    -- Skip tables that do not exist or lack a tenant_id column (defensive).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='tenant_id'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_select') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t||'_select', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_insert') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))', t||'_insert', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_update') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids())) WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))', t||'_update', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_delete') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t||'_delete', t);
    END IF;
  END LOOP;
END $$;
