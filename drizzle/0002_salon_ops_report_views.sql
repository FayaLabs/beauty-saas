CREATE OR REPLACE VIEW public.rep_cancellations AS
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
  a.cancellation_reason_id,
  acr.name AS reason,
  a.cancellation_notes,
  a.cancelled_at,
  b.order_total AS lost_revenue,
  b.created_at,
  b.updated_at
FROM public.v_bookings b
LEFT JOIN public.appointments a ON a.booking_id = b.id
LEFT JOIN public.appointment_cancellation_reasons acr ON acr.id = a.cancellation_reason_id
WHERE b.status = 'cancelled';
--> statement-breakpoint
ALTER VIEW public.rep_cancellations SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_cancellations TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.rep_no_shows AS
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
  b.order_total AS lost_revenue,
  b.created_at,
  b.updated_at
FROM public.v_bookings b
WHERE b.status = 'no_show';
--> statement-breakpoint
ALTER VIEW public.rep_no_shows SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_no_shows TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.rep_peak_hours AS
SELECT
  b.tenant_id,
  EXTRACT(ISODOW FROM b.starts_at)::integer AS day_of_week_number,
  to_char(b.starts_at, 'Dy') AS day_of_week,
  to_char(date_trunc('hour', b.starts_at), 'HH24:00') AS hour,
  COUNT(*)::integer AS booking_count,
  COALESCE(AVG(NULLIF(b.order_total, 0)), 0)::numeric(14,2) AS avg_revenue,
  MIN(b.starts_at)::date AS date,
  MAX(b.updated_at) AS updated_at
FROM public.v_bookings b
WHERE b.status NOT IN ('cancelled', 'no_show')
GROUP BY b.tenant_id, EXTRACT(ISODOW FROM b.starts_at), to_char(b.starts_at, 'Dy'), to_char(date_trunc('hour', b.starts_at), 'HH24:00');
--> statement-breakpoint
ALTER VIEW public.rep_peak_hours SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_peak_hours TO authenticated;
--> statement-breakpoint
NOTIFY pgrst, 'reload schema';
