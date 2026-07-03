-- Operational visibility and bounded retention for Google Calendar delivery.
-- These routines are deliberately outside the booking transaction path.

CREATE TABLE IF NOT EXISTS public.calendar_operational_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_operational_alerts_open_unique
  ON public.calendar_operational_alerts (tenant_id, code)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS calendar_operational_alerts_tenant_status
  ON public.calendar_operational_alerts (tenant_id, status, last_seen_at DESC);

ALTER TABLE public.calendar_operational_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_operational_alerts FROM anon, authenticated;
GRANT ALL ON public.calendar_operational_alerts TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_google_calendar_operational_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.calendar_operational_alerts
    (tenant_id, code, severity, message, details)
  SELECT tenant_id, 'outbox_dead', 'critical',
         'Eventos para o Google Calendar esgotaram as tentativas.',
         jsonb_build_object('count', count(*))
    FROM public.calendar_event_outbox
   WHERE status = 'dead'
   GROUP BY tenant_id
  ON CONFLICT (tenant_id, code) WHERE status = 'open' DO UPDATE
    SET severity = EXCLUDED.severity, message = EXCLUDED.message,
        details = EXCLUDED.details, last_seen_at = now();

  INSERT INTO public.calendar_operational_alerts
    (tenant_id, code, severity, message, details)
  SELECT tenant_id, 'outbox_backlog', 'warning',
         'A entrega para o Google Calendar está atrasada.',
         jsonb_build_object('count', count(*), 'oldestAt', min(created_at))
    FROM public.calendar_event_outbox
   WHERE status IN ('pending', 'processing')
     AND created_at < now() - interval '5 minutes'
   GROUP BY tenant_id
  ON CONFLICT (tenant_id, code) WHERE status = 'open' DO UPDATE
    SET severity = EXCLUDED.severity, message = EXCLUDED.message,
        details = EXCLUDED.details, last_seen_at = now();

  INSERT INTO public.calendar_operational_alerts
    (tenant_id, code, severity, message, details)
  SELECT ci.tenant_id, 'inbox_dead', 'critical',
         'Notificações do Google Calendar esgotaram as tentativas.',
         jsonb_build_object('count', count(*))
    FROM public.calendar_webhook_inbox wi
    JOIN public.calendar_integrations ci ON ci.id = wi.integration_id
   WHERE wi.status = 'dead'
   GROUP BY ci.tenant_id
  ON CONFLICT (tenant_id, code) WHERE status = 'open' DO UPDATE
    SET severity = EXCLUDED.severity, message = EXCLUDED.message,
        details = EXCLUDED.details, last_seen_at = now();

  INSERT INTO public.calendar_operational_alerts
    (tenant_id, code, severity, message, details)
  SELECT tenant_id, 'watch_expiring', 'warning',
         'O canal automático do Google Calendar precisa ser renovado.',
         jsonb_build_object('expiresAt', watch_expires_at)
    FROM public.calendar_integrations
   WHERE provider = 'google' AND active AND oauth_refresh_token IS NOT NULL
     AND (watch_expires_at IS NULL OR watch_expires_at < now() + interval '6 hours')
  ON CONFLICT (tenant_id, code) WHERE status = 'open' DO UPDATE
    SET severity = EXCLUDED.severity, message = EXCLUDED.message,
        details = EXCLUDED.details, last_seen_at = now();

  UPDATE public.calendar_operational_alerts a
     SET status = 'resolved', resolved_at = now(), last_seen_at = now()
   WHERE status = 'open' AND code = 'outbox_dead'
     AND NOT EXISTS (
       SELECT 1 FROM public.calendar_event_outbox o
        WHERE o.tenant_id = a.tenant_id AND o.status = 'dead'
     );
  UPDATE public.calendar_operational_alerts a
     SET status = 'resolved', resolved_at = now(), last_seen_at = now()
   WHERE status = 'open' AND code = 'outbox_backlog'
     AND NOT EXISTS (
       SELECT 1 FROM public.calendar_event_outbox o
        WHERE o.tenant_id = a.tenant_id
          AND o.status IN ('pending', 'processing')
          AND o.created_at < now() - interval '5 minutes'
     );
  UPDATE public.calendar_operational_alerts a
     SET status = 'resolved', resolved_at = now(), last_seen_at = now()
   WHERE status = 'open' AND code = 'inbox_dead'
     AND NOT EXISTS (
       SELECT 1 FROM public.calendar_webhook_inbox wi
       JOIN public.calendar_integrations ci ON ci.id = wi.integration_id
        WHERE ci.tenant_id = a.tenant_id AND wi.status = 'dead'
     );
  UPDATE public.calendar_operational_alerts a
     SET status = 'resolved', resolved_at = now(), last_seen_at = now()
   WHERE status = 'open' AND code = 'watch_expiring'
     AND NOT EXISTS (
       SELECT 1 FROM public.calendar_integrations ci
        WHERE ci.tenant_id = a.tenant_id AND ci.provider = 'google'
          AND ci.active AND ci.oauth_refresh_token IS NOT NULL
          AND (ci.watch_expires_at IS NULL OR ci.watch_expires_at < now() + interval '6 hours')
     );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_google_calendar_operational_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_google_calendar_operational_alerts() TO service_role;

CREATE OR REPLACE FUNCTION public.get_google_calendar_health(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'lastSyncAt', ci.last_sync_at,
    'watchExpiresAt', ci.watch_expires_at,
    'outboxPending', (SELECT count(*) FROM public.calendar_event_outbox o WHERE o.tenant_id = p_tenant_id AND o.status IN ('pending', 'processing')),
    'outboxDead', (SELECT count(*) FROM public.calendar_event_outbox o WHERE o.tenant_id = p_tenant_id AND o.status = 'dead'),
    'oldestOutboxAt', (SELECT min(o.created_at) FROM public.calendar_event_outbox o WHERE o.tenant_id = p_tenant_id AND o.status IN ('pending', 'processing')),
    'inboxPending', (SELECT count(*) FROM public.calendar_webhook_inbox wi WHERE wi.integration_id = ci.id AND wi.status IN ('pending', 'processing')),
    'inboxDead', (SELECT count(*) FROM public.calendar_webhook_inbox wi WHERE wi.integration_id = ci.id AND wi.status = 'dead'),
    'oldestInboxAt', (SELECT min(wi.created_at) FROM public.calendar_webhook_inbox wi WHERE wi.integration_id = ci.id AND wi.status IN ('pending', 'processing')),
    'alerts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'code', a.code, 'severity', a.severity,
        'message', a.message, 'details', a.details, 'lastSeenAt', a.last_seen_at
      ) ORDER BY a.severity, a.last_seen_at DESC)
      FROM public.calendar_operational_alerts a
      WHERE a.tenant_id = p_tenant_id AND a.status = 'open'
    ), '[]'::jsonb)
  )
  FROM public.calendar_integrations ci
  WHERE ci.tenant_id = p_tenant_id AND ci.provider = 'google';
$$;

REVOKE ALL ON FUNCTION public.get_google_calendar_health(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_calendar_health(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_google_calendar_operational_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  outbox_deleted integer;
  inbox_deleted integer;
  logs_deleted integer;
  alerts_deleted integer;
BEGIN
  DELETE FROM public.calendar_event_outbox WHERE status = 'completed' AND completed_at < now() - interval '30 days';
  GET DIAGNOSTICS outbox_deleted = ROW_COUNT;
  DELETE FROM public.calendar_webhook_inbox WHERE status = 'completed' AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS inbox_deleted = ROW_COUNT;
  DELETE FROM public.calendar_sync_log WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS logs_deleted = ROW_COUNT;
  DELETE FROM public.calendar_operational_alerts WHERE status = 'resolved' AND resolved_at < now() - interval '90 days';
  GET DIAGNOSTICS alerts_deleted = ROW_COUNT;
  RETURN jsonb_build_object('outbox', outbox_deleted, 'inbox', inbox_deleted, 'logs', logs_deleted, 'alerts', alerts_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_google_calendar_operational_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_google_calendar_operational_data() TO service_role;

DO $$
DECLARE job record;
BEGIN
  FOR job IN SELECT jobid FROM cron.job WHERE jobname IN (
    'google-calendar-operational-alerts', 'google-calendar-operational-cleanup'
  ) LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'google-calendar-operational-alerts',
  '*/5 * * * *',
  'SELECT public.refresh_google_calendar_operational_alerts()'
);

SELECT cron.schedule(
  'google-calendar-operational-cleanup',
  '17 3 * * *',
  'SELECT public.cleanup_google_calendar_operational_data()'
);

COMMENT ON TABLE public.calendar_operational_alerts IS
  'Persistent, tenant-scoped operational alerts for Google Calendar delivery.';
COMMENT ON FUNCTION public.cleanup_google_calendar_operational_data() IS
  'Deletes completed transport data after 30 days and audit/alert history after 90 days.';
