-- Financial Plugin: Commission Rules, Price Tables, Price Variations

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  value_type text NOT NULL DEFAULT 'percentage',
  value numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commission_rules_tenant ON public.commission_rules(tenant_id);

CREATE TABLE IF NOT EXISTS public.price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  description text NOT NULL,
  type text NOT NULL DEFAULT 'sale',
  valid_from date,
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_price_tables_tenant ON public.price_tables(tenant_id);

CREATE TABLE IF NOT EXISTS public.price_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  variation_type text NOT NULL DEFAULT 'discount',
  value_type text NOT NULL DEFAULT 'percentage',
  value numeric(12,2) NOT NULL DEFAULT 0,
  first_appointment_only boolean DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.price_variations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_price_variations_tenant ON public.price_variations(tenant_id);

-- Re-apply RLS for new tables
SELECT public.user_tenant_ids(); -- ensure function exists

DO $$
DECLARE t text;
BEGIN
  FOR t IN (SELECT unnest(ARRAY['commission_rules', 'price_tables', 'price_variations']))
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_select') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t || '_select', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))', t || '_insert', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t || '_update', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t || '_delete', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
