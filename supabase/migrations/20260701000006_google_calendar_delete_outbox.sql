-- Preserve Google event identifiers after a BeautySaaS booking is deleted so
-- the asynchronous sync can propagate the deletion to Google Calendar.
CREATE TABLE IF NOT EXISTS public.calendar_delete_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  external_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  UNIQUE (tenant_id, provider, external_event_id)
);

ALTER TABLE public.calendar_delete_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_delete_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_google_calendar_booking_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, saas_core
AS $$
DECLARE
  event_id text := OLD.metadata->>'googleCalendarEventId';
BEGIN
  IF event_id IS NOT NULL AND event_id <> '' THEN
    INSERT INTO public.calendar_delete_outbox (tenant_id, external_event_id)
    VALUES (OLD.tenant_id, event_id)
    ON CONFLICT (tenant_id, provider, external_event_id) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_google_calendar_booking_delete ON saas_core.bookings;
CREATE TRIGGER trg_capture_google_calendar_booking_delete
  BEFORE DELETE ON saas_core.bookings
  FOR EACH ROW EXECUTE FUNCTION public.capture_google_calendar_booking_delete();
