-- Google Calendar addon: tenant connection state and synchronization audit.
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  oauth_refresh_token text,
  oauth_access_token text,
  token_expires_at timestamptz,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_token text,
  active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS public.calendar_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  trigger text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error')),
  fetched integer NOT NULL DEFAULT 0,
  written integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_tenant ON public.calendar_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_log_tenant_created ON public.calendar_sync_log(tenant_id, created_at DESC);

REVOKE ALL ON public.calendar_integrations, public.calendar_sync_log FROM authenticated;
GRANT SELECT ON public.calendar_sync_log TO authenticated;

CREATE OR REPLACE VIEW public.calendar_integrations_safe
WITH (security_barrier = true) AS
SELECT id, tenant_id, provider, calendar_id, active, last_sync_at, created_at, updated_at,
       (oauth_refresh_token IS NOT NULL) AS connected
FROM public.calendar_integrations
WHERE tenant_id IN (SELECT saas_core.user_tenant_ids());
GRANT SELECT ON public.calendar_integrations_safe TO authenticated;

DROP POLICY IF EXISTS calendar_integrations_select ON public.calendar_integrations;
CREATE POLICY calendar_integrations_select ON public.calendar_integrations FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT saas_core.user_tenant_ids()));
DROP POLICY IF EXISTS calendar_sync_log_select ON public.calendar_sync_log;
CREATE POLICY calendar_sync_log_select ON public.calendar_sync_log FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT saas_core.user_tenant_ids()));

COMMENT ON COLUMN public.calendar_integrations.oauth_refresh_token IS
  'Server-only Google OAuth credential. Never expose this column through client writes or logs.';
