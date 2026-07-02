-- The integration transport must never abort the booking transaction.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_google_calendar_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  worker_secret text;
BEGIN
  SELECT decrypted_secret
    INTO worker_secret
    FROM vault.decrypted_secrets
   WHERE name = 'gcal_worker_secret'
   ORDER BY created_at DESC
   LIMIT 1;

  IF worker_secret IS NULL THEN
    BEGIN
      INSERT INTO public.calendar_sync_log (
        tenant_id, direction, trigger, status, error
      ) VALUES (
        NEW.tenant_id, 'outbound', 'database_webhook', 'error',
        'gcal_worker_secret não configurado no Vault'
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://ytkjtyyxnxrbudnhazei.supabase.co/functions/v1/google-calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Worker-Secret', worker_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'record', to_jsonb(NEW),
      'old_record', NULL
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.calendar_sync_log (
      tenant_id, direction, trigger, status, error
    ) VALUES (
      NEW.tenant_id, 'outbound', 'database_webhook', 'error', left(SQLERRM, 1000)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_google_calendar_outbox()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS google_calendar_outbox_webhook
  ON public.calendar_event_outbox;
CREATE TRIGGER google_calendar_outbox_webhook
  AFTER INSERT ON public.calendar_event_outbox
  FOR EACH ROW EXECUTE FUNCTION public.notify_google_calendar_outbox();
