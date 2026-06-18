-- S4 (data-model refactor): order_items is the SINGLE source of line items.
-- booking_items was a full duplicate (same data, written in the same txn). This
-- (1) backfills order_items for any order that only had booking_items, then
-- (2) repoints v_bookings.services/duration at order_items. The agenda code stops
-- reading/writing booking_items (separate change). booking_items table is kept
-- (deprecated) for safety, no longer written. See DATA-MODEL-REFACTOR.md.

-- (1) Backfill: order_items from booking_items where the order has none.
INSERT INTO saas_core.order_items (order_id, service_id, name, quantity, unit_price, total, sort_order, duration_minutes, assignee_id, metadata, created_at)
SELECT b.order_id, bi.service_id, bi.name, 1, bi.price, bi.price, bi.sort_order, bi.duration_minutes, bi.assignee_id, bi.metadata, bi.created_at
FROM saas_core.booking_items bi
JOIN saas_core.bookings b ON b.id = bi.booking_id
WHERE b.order_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM saas_core.order_items oi WHERE oi.order_id = b.order_id);

-- (2) Repoint v_bookings services/duration at order_items (single source).
CREATE OR REPLACE VIEW public.v_bookings AS
SELECT b.id, b.tenant_id, b.kind, b.starts_at, b.ends_at, b.status, b.notes, b.order_id, b.location_id, b.metadata,
    b.party_id AS client_id, client.name AS client_name, client.phone AS client_phone, client.email AS client_email, client.avatar_url AS client_avatar_url,
    b.assignee_id AS professional_id, prof.name AS professional_name, prof.avatar_url AS professional_avatar_url,
    loc.name AS location_name,
    o.total AS order_total, o.status AS order_status, o.reference_number, o.status AS stage, o.metadata ->> 'direction'::text AS direction,
    ( SELECT json_agg(json_build_object('id', oi.id, 'serviceId', oi.service_id, 'name', oi.name, 'durationMinutes', oi.duration_minutes, 'price', oi.unit_price, 'assigneeId', oi.assignee_id) ORDER BY oi.sort_order)
           FROM saas_core.order_items oi WHERE oi.order_id = b.order_id) AS services,
    COALESCE((( SELECT sum(oi2.duration_minutes) FROM saas_core.order_items oi2 WHERE oi2.order_id = b.order_id))::numeric,
             EXTRACT(epoch FROM b.ends_at - b.starts_at) / 60::numeric)::integer AS total_duration_minutes,
    b.created_at, b.updated_at,
    inv.status AS payment_status, inv.paid AS order_paid, inv.balance AS order_balance
   FROM saas_core.bookings b
     LEFT JOIN saas_core.persons client ON client.id = b.party_id
     LEFT JOIN saas_core.persons prof ON prof.id = b.assignee_id
     LEFT JOIN saas_core.locations loc ON loc.id = b.location_id
     LEFT JOIN saas_core.orders o ON o.id = b.order_id
     LEFT JOIN public.v_invoice_balances inv ON inv.invoice_id = b.order_id;
ALTER VIEW public.v_bookings SET (security_invoker = true);
GRANT SELECT ON public.v_bookings TO authenticated;
NOTIFY pgrst, 'reload schema';
