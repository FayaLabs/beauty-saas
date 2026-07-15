-- Open Banking plugin (app-local) — companion SQL: tables + RLS + grants.
-- Idempotent (safe to re-run). Mirrors the Drizzle schema in ../schema/index.ts.
-- The bank-statement reconciliation columns on public.plg_financial_movements come
-- from the SDK financial plugin migration 007_reconciliation.sql — apply that too.

CREATE TABLE IF NOT EXISTS public.bank_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'plugbank',
  bank_account_id uuid,
  api_token text,
  cnpj text,
  environment text NOT NULL DEFAULT 'production',
  active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bank_account_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_bank_integrations_tenant ON public.bank_integrations(tenant_id);

CREATE TABLE IF NOT EXISTS public.bank_integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_integration_id uuid NOT NULL REFERENCES public.bank_integrations(id) ON DELETE CASCADE,
  bank_account_id uuid,
  period_from date,
  period_to date,
  transactions_fetched integer NOT NULL DEFAULT 0,
  transactions_imported integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  triggered_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_sync_log_integration ON public.bank_integration_sync_log(bank_integration_id);

-- RLS: tenant isolation (canonical form: tenant_id IN (SELECT public.user_tenant_ids())).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['bank_integrations','bank_integration_sync_log'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_select') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t||'_select', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_insert') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))', t||'_insert', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_update') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t||'_update', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname=t||'_delete') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))', t||'_delete', t);
    END IF;
  END LOOP;
END $$;
