-- ============================================================================
-- Beauty-SaaS: project tables using saas_core archetypes
-- ============================================================================

-- Drop old flat tables (replaced by archetype relationships)
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.beauty_services CASCADE;
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.staff_members CASCADE;
DROP TABLE IF EXISTS public.service_locations CASCADE;
DROP TABLE IF EXISTS public.origins CASCADE;
DROP TABLE IF EXISTS public.partnerships CASCADE;
DROP TABLE IF EXISTS public.equipment CASCADE;
DROP TABLE IF EXISTS public.bank_accounts CASCADE;

-- ---------------------------------------------------------------------------
-- Clients (person archetype + extension)
-- ---------------------------------------------------------------------------
CREATE TABLE public.clients (
  person_id uuid PRIMARY KEY REFERENCES saas_core.persons(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  gender text,
  origin text,
  visits integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  last_visit date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Staff (person archetype + extension)
-- ---------------------------------------------------------------------------
CREATE TABLE public.staff_members (
  person_id uuid PRIMARY KEY REFERENCES saas_core.persons(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  profession text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Appointments (booking archetype + extension)
-- ---------------------------------------------------------------------------
CREATE TABLE public.appointments (
  booking_id uuid PRIMARY KEY REFERENCES saas_core.bookings(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Service Categories (categories archetype — no extension needed)
-- Queried directly: saas_core.categories with kind='service_category'
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Bank Accounts (standalone — no archetype match)
-- ---------------------------------------------------------------------------
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text DEFAULT 'checking',
  bank_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['clients', 'staff_members', 'appointments', 'bank_accounts']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT saas_core.user_tenant_ids()))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT saas_core.user_tenant_ids()))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT saas_core.user_tenant_ids()))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated USING (tenant_id IN (SELECT saas_core.user_tenant_ids()))',
      tbl
    );
  END LOOP;
END $$;

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['clients', 'staff_members', 'appointments', 'bank_accounts']
  LOOP
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', tbl, tbl);
  END LOOP;
END $$;
