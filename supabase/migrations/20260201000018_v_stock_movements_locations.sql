-- Update v_stock_movements to include location names
CREATE OR REPLACE VIEW public.v_stock_movements AS
SELECT
  sm.*,
  p.name AS product_name,
  p.sku AS product_sku,
  sl.name AS stock_location_name,
  dl.name AS destination_location_name
FROM public.stock_movements sm
LEFT JOIN saas_core.products p ON p.id = sm.product_id
LEFT JOIN public.stock_locations sl ON sl.id = sm.stock_location_id
LEFT JOIN public.stock_locations dl ON dl.id = sm.destination_location_id;
