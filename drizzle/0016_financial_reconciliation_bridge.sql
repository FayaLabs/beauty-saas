-- Financial reconciliation bridge for Open Banking imports.
--
-- Ring ownership:
-- - plugin-financial owns financial_movements and reconciliation semantics.
-- - beauty-saas/openbanking owns only PlugBank connection and sync audit rows.
-- - imported bank statement lines are stored as tagged financial_movements rows,
--   not in an app-local duplicate transaction table.

ALTER TABLE public.financial_movements
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS matched_movement_id uuid
    REFERENCES public.financial_movements(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.financial_movements.external_source IS
  'Provider of an imported bank-statement line, for example plugbank. NULL for app-native movements.';
COMMENT ON COLUMN public.financial_movements.external_id IS
  'Provider-unique id of the imported bank line. Forms the import idempotency key with external_source.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_movements_external
  ON public.financial_movements (tenant_id, external_source, external_id)
  WHERE external_id IS NOT NULL AND external_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_movements_unreconciled
  ON public.financial_movements (tenant_id, payment_date)
  WHERE external_source IS NOT NULL AND reconciled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.bank_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
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
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_bank_sync_log_integration
  ON public.bank_integration_sync_log(bank_integration_id);

DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN SELECT unnest(ARRAY['bank_integrations', 'bank_integration_sync_log'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name AND policyname = table_name || '_select'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))',
        table_name || '_select',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name AND policyname = table_name || '_insert'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()))',
        table_name || '_insert',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name AND policyname = table_name || '_update'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))',
        table_name || '_update',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name AND policyname = table_name || '_delete'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (tenant_id IN (SELECT public.user_tenant_ids()))',
        table_name || '_delete',
        table_name
      );
    END IF;
  END LOOP;
END $$;
