-- Add cross-schema FK constraints so PostgREST can resolve joins
-- These enable: select=*,person:person_id(*) syntax

-- clients → saas_core.persons
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_clients_person') THEN
    ALTER TABLE public.clients ADD CONSTRAINT fk_clients_person
      FOREIGN KEY (person_id) REFERENCES saas_core.persons(id) ON DELETE CASCADE;
  END IF;
END $$;

-- staff_members → saas_core.persons
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_members')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_staff_members_person') THEN
    ALTER TABLE public.staff_members ADD CONSTRAINT fk_staff_members_person
      FOREIGN KEY (person_id) REFERENCES saas_core.persons(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Reload PostgREST schema cache to pick up the new FKs
NOTIFY pgrst, 'reload schema';
