-- ============================================================================
-- 0018_schema_drift_repair.sql — close the gap between what src/db/schema
-- declares and what the live pool actually has.
--
-- Two confirmed drifts, both traced to migrations that were edited AFTER the
-- ledger had already recorded them as applied, so the new statements never ran:
--
--   1. public.clients is missing lifecycle_status, stage and preferences.
--      0003_client_care_profile.sql adds six columns; the pool has three
--      (anamnesis_notes, status_alert, has_anamnesis_alert). The other three
--      were appended to the file later. Symptom in the app:
--        "Could not find the 'lifecycle_status' column of 'clients' in the
--         schema cache" — every client save fails.
--
--   2. public.appointment_execution does not exist at all. The schema declares
--      it (renamed out of the bespoke `appointments` extension when core-v1
--      took that name) but NO migration ever created or renamed it, so
--      CancellationsFollowUpPage, ExecutionChecklistPage and the app-config
--      execution reads all query a missing table.
--
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT
-- EXISTS / guarded policies. Nothing here drops or rewrites existing data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. clients — the three columns 0003 grew after it was first applied
-- ----------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS stage           text NOT NULL DEFAULT 'new';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferences     jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. appointment_execution — the ring-2 extension nobody ever created
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointment_execution (
  booking_id             uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  tenant_id              uuid NOT NULL,
  cancellation_reason_id uuid REFERENCES public.appointment_cancellation_reasons(id),
  cancellation_notes     text,
  cancelled_at           timestamptz,
  confirmation_status    text NOT NULL DEFAULT 'pending',
  confirmation_channel   text,
  confirmation_sent_at   timestamptz,
  confirmed_at           timestamptz,
  execution_status       text NOT NULL DEFAULT 'pending',
  execution_checklist    jsonb NOT NULL DEFAULT '{}'::jsonb,
  stock_deduction_status text NOT NULL DEFAULT 'not_required',
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_execution_tenant_status_idx
  ON public.appointment_execution (tenant_id, execution_status);
CREATE INDEX IF NOT EXISTS appointment_execution_tenant_confirmation_idx
  ON public.appointment_execution (tenant_id, confirmation_status);

DROP TRIGGER IF EXISTS appointment_execution_updated_at ON public.appointment_execution;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'handle_updated_at') THEN
    CREATE TRIGGER appointment_execution_updated_at
      BEFORE UPDATE ON public.appointment_execution
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Same tenant-scoping canon as every other ring-2 table (0017_ring2_rls_policies).
ALTER TABLE public.appointment_execution ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_execution TO authenticated;
REVOKE ALL ON public.appointment_execution FROM anon;

DO $$
DECLARE
  t text := 'appointment_execution';
  a text;
BEGIN
  FOREACH a IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_' || a) THEN
      IF a = 'insert' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))',
          t || '_' || a, t);
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))',
          t || '_' || a, t, upper(a));
      END IF;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Make PostgREST see it
-- ----------------------------------------------------------------------------
-- The error the founder hit is a SCHEMA CACHE error, not a SQL error: PostgREST
-- keeps its own column map and only refreshes on this notification (or a
-- restart). Adding the column without this leaves the app failing identically.
NOTIFY pgrst, 'reload schema';
