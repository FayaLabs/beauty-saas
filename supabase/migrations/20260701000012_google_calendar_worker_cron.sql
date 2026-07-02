-- One-minute recovery loop. Immediate delivery still comes from the outbox
-- trigger; cron retries delayed jobs, stale claims, inbox jobs and watch renewals.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE existing_job bigint;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job
   WHERE jobname = 'google-calendar-worker-reconciliation';
  IF existing_job IS NOT NULL THEN PERFORM cron.unschedule(existing_job); END IF;
END;
$$;

SELECT cron.schedule(
  'google-calendar-worker-reconciliation',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := (SELECT endpoint_url FROM public.calendar_worker_config WHERE id = true),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Worker-Secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets
           WHERE name = 'gcal_worker_secret'
           ORDER BY created_at DESC LIMIT 1
        )
      ),
      body := '{"action":"process_outbox","limit":100}'::jsonb,
      timeout_milliseconds := 10000
    );
  $cron$
);
