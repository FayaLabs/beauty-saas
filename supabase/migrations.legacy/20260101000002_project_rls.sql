-- saas-core: RLS for project tables (public schema)
-- Ensures every table with tenant_id is scoped to the user's tenants.

-- Helper: get tenant IDs the current user belongs to
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid();
$$;

-- Apply RLS to all public tables that have a tenant_id column.
-- This runs as a DO block so it auto-discovers tables.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tbl ON tbl.table_name = c.table_name AND tbl.table_schema = c.table_schema
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND tbl.table_type = 'BASE TABLE'
      AND c.table_name NOT LIKE '\_%'
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop existing policies (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I', t);

    -- Create tenant isolation policies
    EXECUTE format('CREATE POLICY tenant_isolation_select ON public.%I FOR SELECT USING (tenant_id::uuid IN (SELECT public.user_tenant_ids()))', t);
    EXECUTE format('CREATE POLICY tenant_isolation_insert ON public.%I FOR INSERT WITH CHECK (tenant_id::uuid IN (SELECT public.user_tenant_ids()))', t);
    EXECUTE format('CREATE POLICY tenant_isolation_update ON public.%I FOR UPDATE USING (tenant_id::uuid IN (SELECT public.user_tenant_ids()))', t);
    EXECUTE format('CREATE POLICY tenant_isolation_delete ON public.%I FOR DELETE USING (tenant_id::uuid IN (SELECT public.user_tenant_ids()))', t);
  END LOOP;
END $$;
