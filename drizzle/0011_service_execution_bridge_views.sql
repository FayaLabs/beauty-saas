CREATE OR REPLACE VIEW public.rep_service_execution_default_products AS
SELECT
  sdp.id,
  sdp.tenant_id,
  sdp.service_id,
  svc.name AS service_name,
  sdp.product_id,
  prod.name AS product_name,
  prod.sku AS product_sku,
  sdp.quantity,
  sdp.unit,
  sdp.deduction_timing,
  sdp.is_required,
  sdp.sort_order,
  sdp.notes,
  sdp.created_at,
  sdp.updated_at
FROM public.service_default_products sdp
JOIN saas_core.services svc ON svc.id = sdp.service_id
JOIN saas_core.products prod ON prod.id = sdp.product_id;
--> statement-breakpoint
CREATE OR REPLACE VIEW public.rep_service_execution_default_templates AS
SELECT
  sdt.id,
  sdt.tenant_id,
  sdt.service_id,
  svc.name AS service_name,
  sdt.template_id,
  tpl.name AS template_name,
  tpl.category AS template_category,
  sdt.template_kind,
  sdt.trigger,
  sdt.is_required,
  sdt.sort_order,
  sdt.notes,
  sdt.created_at,
  sdt.updated_at
FROM public.service_default_templates sdt
JOIN saas_core.services svc ON svc.id = sdt.service_id
JOIN public.frm_templates tpl ON tpl.id = sdt.template_id
WHERE tpl.is_current = true
  AND tpl.is_active = true
  AND tpl.is_deleted = false;
