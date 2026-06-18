-- S3 (data-model refactor): a booking's OPERATIONAL status is bookings.status
-- (single writer — already the case). Its FINANCIAL state is DERIVED from the
-- ledger (v_invoice_balances). This adds payment_status/order_paid/order_balance
-- to v_bookings (append-only) so the agenda can show payment state consistently
-- with the financial module, instead of relying on the drift-prone order.status.
-- See docs/dogfood-sprint/DATA-MODEL-REFACTOR.md.
CREATE OR REPLACE VIEW public.v_bookings AS
SELECT b.id,
    b.tenant_id,
    b.kind,
    b.starts_at,
    b.ends_at,
    b.status,
    b.notes,
    b.order_id,
    b.location_id,
    b.metadata,
    b.party_id AS client_id,
    client.name AS client_name,
    client.phone AS client_phone,
    client.email AS client_email,
    client.avatar_url AS client_avatar_url,
    b.assignee_id AS professional_id,
    prof.name AS professional_name,
    prof.avatar_url AS professional_avatar_url,
    loc.name AS location_name,
    o.total AS order_total,
    o.status AS order_status,
    o.reference_number,
    o.status AS stage,
    o.metadata ->> 'direction'::text AS direction,
    ( SELECT json_agg(json_build_object('id', bi.id, 'serviceId', bi.service_id, 'name', bi.name, 'durationMinutes', bi.duration_minutes, 'price', bi.price, 'assigneeId', bi.assignee_id) ORDER BY bi.sort_order) AS json_agg
           FROM saas_core.booking_items bi
          WHERE bi.booking_id = b.id) AS services,
    COALESCE((( SELECT sum(bi2.duration_minutes) AS sum
           FROM saas_core.booking_items bi2
          WHERE bi2.booking_id = b.id))::numeric, EXTRACT(epoch FROM b.ends_at - b.starts_at) / 60::numeric)::integer AS total_duration_minutes,
    b.created_at,
    b.updated_at,
    -- S3: derived financial state of the booking's order (NULL until invoiced)
    inv.status  AS payment_status,
    inv.paid    AS order_paid,
    inv.balance AS order_balance
   FROM saas_core.bookings b
     LEFT JOIN saas_core.persons client ON client.id = b.party_id
     LEFT JOIN saas_core.persons prof ON prof.id = b.assignee_id
     LEFT JOIN saas_core.locations loc ON loc.id = b.location_id
     LEFT JOIN saas_core.orders o ON o.id = b.order_id
     LEFT JOIN public.v_invoice_balances inv ON inv.invoice_id = b.order_id;
ALTER VIEW public.v_bookings SET (security_invoker = true);
GRANT SELECT ON public.v_bookings TO authenticated;
NOTIFY pgrst, 'reload schema';
