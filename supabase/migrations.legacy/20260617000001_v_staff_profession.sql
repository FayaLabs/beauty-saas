-- Add profession to v_staff (staffEntity displays it). CREATE OR REPLACE VIEW
-- only allows APPENDING columns, so profession goes last after the existing
-- shape (… commission_rate). security_invoker keeps saas_core.persons RLS.
CREATE OR REPLACE VIEW public.v_staff AS
SELECT
  p.id,
  sm.tenant_id,
  p.name,
  p.email,
  p.phone,
  p.document_number,
  p.notes,
  p.is_active,
  p.tags,
  sm.created_at,
  sm.updated_at,
  sm.commission_rate,
  sm.profession
FROM public.staff_members sm
INNER JOIN saas_core.persons p ON p.id = sm.person_id;
ALTER VIEW public.v_staff SET (security_invoker = true);
GRANT SELECT ON public.v_staff TO authenticated;
NOTIFY pgrst, 'reload schema';
