-- Remove environment-specific URLs from the database trigger. The Edge
-- Function upserts this runtime value from GCAL_WEBHOOK_URL.
CREATE TABLE IF NOT EXISTS public.calendar_worker_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  endpoint_url text NOT NULL CHECK (endpoint_url LIKE 'https://%'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_worker_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.calendar_worker_config FROM anon, authenticated;
GRANT ALL ON public.calendar_worker_config TO service_role;

CREATE OR REPLACE FUNCTION public.notify_google_calendar_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  worker_secret text;
  worker_endpoint text;
BEGIN
  SELECT decrypted_secret INTO worker_secret
    FROM vault.decrypted_secrets
   WHERE name = 'gcal_worker_secret'
   ORDER BY created_at DESC
   LIMIT 1;

  SELECT endpoint_url INTO worker_endpoint
    FROM public.calendar_worker_config
   WHERE id = true;

  IF worker_secret IS NULL OR worker_endpoint IS NULL THEN
    BEGIN
      INSERT INTO public.calendar_sync_log (tenant_id, direction, trigger, status, error)
      VALUES (NEW.tenant_id, 'outbound', 'database_webhook', 'error',
        'Worker sem secret no Vault ou endpoint configurado');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := worker_endpoint,
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
    INSERT INTO public.calendar_sync_log (tenant_id, direction, trigger, status, error)
    VALUES (NEW.tenant_id, 'outbound', 'database_webhook', 'error', left(SQLERRM, 1000));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_google_calendar_outbox()
  FROM PUBLIC, anon, authenticated;
