CREATE OR REPLACE VIEW public.rep_waitlist_queue AS
SELECT
  w.tenant_id,
  w.id AS waitlist_id,
  w.client_id,
  client.name AS client_name,
  w.professional_id,
  professional.name AS professional_name,
  w.service_id,
  service.name AS service_name,
  w.location_id,
  w.requested_date::date AS date,
  w.requested_date,
  w.preferred_start_time,
  w.preferred_end_time,
  w.priority,
  w.status,
  w.notes,
  w.converted_booking_id,
  w.metadata,
  w.created_at,
  w.updated_at
FROM public.appointment_waitlist_entries w
LEFT JOIN saas_core.persons client ON client.id = w.client_id
LEFT JOIN saas_core.persons professional ON professional.id = w.professional_id
LEFT JOIN saas_core.services service ON service.id = w.service_id;
--> statement-breakpoint
ALTER VIEW public.rep_waitlist_queue SET (security_invoker = true);
--> statement-breakpoint
GRANT SELECT ON public.rep_waitlist_queue TO authenticated;
--> statement-breakpoint
NOTIFY pgrst, 'reload schema';
