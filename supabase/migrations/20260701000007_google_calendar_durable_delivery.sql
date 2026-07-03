-- Production transport for the Google Calendar extension.
-- Prerequisite: fayz-sdk/packages/db/migrations/009_booking_domain_events.sql.

ALTER TABLE public.calendar_integrations
  ADD COLUMN IF NOT EXISTS watch_channel_id uuid,
  ADD COLUMN IF NOT EXISTS watch_resource_id text,
  ADD COLUMN IF NOT EXISTS watch_token text,
  ADD COLUMN IF NOT EXISTS watch_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_cursor_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS mapped_assignee_id uuid REFERENCES saas_core.persons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mapped_location_id uuid REFERENCES saas_core.locations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.calendar_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  domain_event_id uuid NOT NULL REFERENCES saas_core.domain_events(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, domain_event_id)
);

CREATE INDEX IF NOT EXISTS calendar_event_outbox_ready
  ON public.calendar_event_outbox (status, available_at, created_at)
  WHERE status IN ('pending', 'processing');
ALTER TABLE public.calendar_event_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_event_outbox FROM anon, authenticated;
GRANT ALL ON public.calendar_event_outbox TO service_role;

CREATE TABLE IF NOT EXISTS public.calendar_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.calendar_integrations(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL,
  message_number bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, message_number)
);
ALTER TABLE public.calendar_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_webhook_inbox FROM anon, authenticated;
GRANT ALL ON public.calendar_webhook_inbox TO service_role;

CREATE OR REPLACE FUNCTION public.route_booking_event_to_google_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, saas_core
AS $$
BEGIN
  IF NEW.aggregate_type <> 'booking' OR NEW.origin = 'google-calendar' THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.calendar_integrations i
     WHERE i.tenant_id = NEW.tenant_id AND i.provider = 'google'
       AND i.active AND i.oauth_refresh_token IS NOT NULL
  ) THEN RETURN NEW; END IF;

  INSERT INTO public.calendar_event_outbox (
    tenant_id, domain_event_id, event_type, aggregate_id, correlation_id, payload
  ) VALUES (
    NEW.tenant_id, NEW.id, NEW.event_type, NEW.aggregate_id, NEW.correlation_id, NEW.payload
  ) ON CONFLICT (provider, domain_event_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_booking_event_to_google_calendar ON saas_core.domain_events;
CREATE TRIGGER trg_route_booking_event_to_google_calendar
  AFTER INSERT ON saas_core.domain_events
  FOR EACH ROW EXECUTE FUNCTION public.route_booking_event_to_google_calendar();

CREATE OR REPLACE FUNCTION public.claim_google_calendar_outbox(p_limit integer DEFAULT 25)
RETURNS SETOF public.calendar_event_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.calendar_event_outbox
     WHERE (status = 'pending' AND available_at <= now())
        OR (status = 'processing' AND locked_at < now() - interval '5 minutes')
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
     LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE public.calendar_event_outbox o
     SET status = 'processing', locked_at = now(), attempts = attempts + 1
    FROM candidates c WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_google_calendar_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_calendar_outbox(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_google_calendar_webhooks(p_limit integer DEFAULT 10)
RETURNS SETOF public.calendar_webhook_inbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.calendar_webhook_inbox
     WHERE (status = 'pending' AND available_at <= now())
        OR (status = 'processing' AND locked_at < now() - interval '5 minutes')
     ORDER BY created_at FOR UPDATE SKIP LOCKED
     LIMIT LEAST(GREATEST(p_limit, 1), 50)
  )
  UPDATE public.calendar_webhook_inbox i
     SET status = 'processing', locked_at = now(), attempts = attempts + 1
    FROM candidates c WHERE i.id = c.id
  RETURNING i.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_google_calendar_webhooks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_calendar_webhooks(integer) TO service_role;

DROP TRIGGER IF EXISTS trg_capture_google_calendar_booking_delete ON saas_core.bookings;
DROP FUNCTION IF EXISTS public.capture_google_calendar_booking_delete();
INSERT INTO saas_core.domain_events (
  tenant_id, aggregate_type, aggregate_id, event_type, origin, correlation_id, payload
)
SELECT tenant_id, 'booking', gen_random_uuid(), 'booking.deleted', 'agenda', gen_random_uuid(),
       jsonb_build_object('booking', jsonb_build_object(
         'id', null, 'kind', 'appointment',
         'metadata', jsonb_build_object('googleCalendarEventId', external_event_id)
       ))
FROM public.calendar_delete_outbox
ON CONFLICT DO NOTHING;
DROP TABLE IF EXISTS public.calendar_delete_outbox;

CREATE OR REPLACE VIEW public.calendar_integrations_safe
WITH (security_barrier = true) AS
SELECT id, tenant_id, provider, calendar_id, active, last_sync_at, created_at, updated_at,
       (oauth_refresh_token IS NOT NULL) AS connected,
       watch_expires_at, mapped_assignee_id, mapped_location_id
FROM public.calendar_integrations
WHERE tenant_id IN (SELECT saas_core.user_tenant_ids());
GRANT SELECT ON public.calendar_integrations_safe TO authenticated;
