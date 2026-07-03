DROP VIEW IF EXISTS public.rep_appointments_by_period;
--> statement-breakpoint
DROP VIEW IF EXISTS public.rep_revenue_by_service;
--> statement-breakpoint
DROP VIEW IF EXISTS public.rep_revenue_by_professional;
--> statement-breakpoint
DROP VIEW IF EXISTS public.rep_client_frequency;
--> statement-breakpoint
DROP VIEW IF EXISTS public.rep_new_clients;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.rep_appointments_by_period AS
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
  b.status,
  b.order_total AS revenue,
  b.created_at,
  b.updated_at
FROM public.v_bookings b;
--> statement-breakpoint
ALTER VIEW public.rep_appointments_by_period SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_appointments_by_period TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.rep_revenue_by_service AS
SELECT
  b.tenant_id,
  b.starts_at::date AS date,
  NULLIF(service_item->>'serviceId', '') AS service_id,
  COALESCE(service_item->>'name', service_item->>'serviceName', 'Sem servico') AS service_name,
  COUNT(DISTINCT b.id)::integer AS quantity,
  COALESCE(SUM(NULLIF(service_item->>'price', '')::numeric), 0)::numeric(14,2) AS total_revenue,
  COALESCE(AVG(NULLIF(service_item->>'price', '')::numeric), 0)::numeric(14,2) AS avg_ticket,
  MAX(b.updated_at) AS updated_at
FROM public.v_bookings b
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(b.services::jsonb, '[]'::jsonb)) AS service_item
WHERE b.status NOT IN ('cancelled', 'no_show')
GROUP BY b.tenant_id, b.starts_at::date, NULLIF(service_item->>'serviceId', ''), COALESCE(service_item->>'name', service_item->>'serviceName', 'Sem servico');
--> statement-breakpoint
ALTER VIEW public.rep_revenue_by_service SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_revenue_by_service TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.rep_revenue_by_professional AS
SELECT
  b.tenant_id,
  b.starts_at::date AS date,
  b.professional_id,
  COALESCE(b.professional_name, 'Sem profissional') AS professional_name,
  COUNT(*)::integer AS appointment_count,
  COALESCE(SUM(NULLIF(b.order_total, 0)), 0)::numeric(14,2) AS total_revenue,
  COALESCE(AVG(NULLIF(b.order_total, 0)), 0)::numeric(14,2) AS avg_ticket,
  0::numeric(14,2) AS commission,
  MAX(b.updated_at) AS updated_at
FROM public.v_bookings b
WHERE b.status NOT IN ('cancelled', 'no_show')
GROUP BY b.tenant_id, b.starts_at::date, b.professional_id, COALESCE(b.professional_name, 'Sem profissional');
--> statement-breakpoint
ALTER VIEW public.rep_revenue_by_professional SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_revenue_by_professional TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.rep_client_frequency AS
SELECT
  c.tenant_id,
  c.id AS client_id,
  c.name AS client_name,
  COALESCE(c.visits, 0)::integer AS visit_count,
  c.last_visit::date AS last_visit,
  COALESCE(c.total_spent, 0)::numeric(14,2) AS total_spent,
  CASE
    WHEN COALESCE(c.visits, 0) > 0 THEN (COALESCE(c.total_spent, 0)::numeric / c.visits)::numeric(14,2)
    ELSE 0::numeric(14,2)
  END AS avg_ticket,
  c.updated_at
FROM public.v_clients c;
--> statement-breakpoint
ALTER VIEW public.rep_client_frequency SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_client_frequency TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.rep_new_clients AS
SELECT
  c.tenant_id,
  c.id AS client_id,
  c.created_at::date AS date,
  c.name AS client_name,
  c.origin,
  first_booking.service_name AS first_service,
  c.created_at,
  c.updated_at
FROM public.v_clients c
LEFT JOIN LATERAL (
  SELECT COALESCE(b.services->0->>'name', b.services->0->>'serviceName') AS service_name
  FROM public.v_bookings b
  WHERE b.client_id = c.id
  ORDER BY b.starts_at ASC
  LIMIT 1
) first_booking ON true;
--> statement-breakpoint
ALTER VIEW public.rep_new_clients SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_new_clients TO authenticated;
--> statement-breakpoint
NOTIFY pgrst, 'reload schema';
