CREATE OR REPLACE VIEW public.rep_confirmation_queue AS
SELECT
  b.tenant_id,
  b.id AS booking_id,
  b.starts_at::date AS date,
  b.starts_at,
  b.client_id,
  b.client_name,
  b.professional_id,
  b.professional_name,
  COALESCE(b.services->0->>'name', b.services->0->>'serviceName') AS service_name,
  COALESCE(a.confirmation_status, 'pending') AS confirmation_status,
  a.confirmation_channel,
  a.confirmation_sent_at,
  a.confirmed_at,
  b.created_at,
  b.updated_at
FROM public.v_bookings b
LEFT JOIN public.appointments a ON a.booking_id = b.id
WHERE b.status NOT IN ('cancelled', 'no_show')
  AND b.starts_at >= now() - interval '1 day';
--> statement-breakpoint
ALTER VIEW public.rep_confirmation_queue SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_confirmation_queue TO authenticated;
--> statement-breakpoint
NOTIFY pgrst, 'reload schema';
