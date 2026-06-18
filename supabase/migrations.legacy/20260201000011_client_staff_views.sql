-- Views that join extension tables with saas_core.persons for single-query access
-- Conditional: only created if the base table exists

-- =============================================================
-- Clients view: public.clients JOIN saas_core.persons
-- =============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    EXECUTE '
      CREATE OR REPLACE VIEW public.clients_view AS
      SELECT
        p.id,
        c.tenant_id,
        p.name,
        p.email,
        p.phone,
        p.document_number,
        p.avatar_url,
        p.date_of_birth,
        p.notes,
        p.is_active,
        p.tags,
        c.gender,
        c.origin,
        c.visits,
        c.total_spent,
        c.last_visit,
        c.created_at,
        c.updated_at
      FROM public.clients c
      INNER JOIN saas_core.persons p ON p.id = c.person_id;
      GRANT SELECT ON public.clients_view TO authenticated;
    ';
  END IF;
END $$;

-- =============================================================
-- Staff view: public.staff_members JOIN saas_core.persons
-- =============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_members') THEN
    EXECUTE '
      CREATE OR REPLACE VIEW public.staff_view AS
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
        sm.updated_at
      FROM public.staff_members sm
      INNER JOIN saas_core.persons p ON p.id = sm.person_id;
      GRANT SELECT ON public.staff_view TO authenticated;
    ';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
