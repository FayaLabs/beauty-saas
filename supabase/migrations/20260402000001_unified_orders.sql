-- ---------------------------------------------------------------------------
-- Unified Order System: Stage-Based Lifecycle
--
-- Adds stage, starts_at, ends_at, direction to orders table.
-- Adds duration_minutes, assignee_id to order_items.
-- Backfills from existing bookings data.
-- Creates v_bookings view on orders for calendar consumption.
-- ---------------------------------------------------------------------------

-- ═══ 1. Add new columns to orders ═══
ALTER TABLE saas_core.orders
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS direction text;
-- ═══ 2. Add new columns to order_items ═══
ALTER TABLE saas_core.order_items
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES saas_core.persons(id) ON DELETE SET NULL;
-- ═══ 3. Indexes ═══
CREATE INDEX IF NOT EXISTS orders_starts
  ON saas_core.orders(tenant_id, starts_at)
  WHERE starts_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_stage
  ON saas_core.orders(tenant_id, stage);
-- ═══ 4. Backfill stage from existing kind+status ═══
UPDATE saas_core.orders SET stage = CASE
  -- Invoices
  WHEN kind IN ('invoice_receivable', 'invoice_payable') AND status = 'paid' THEN 'paid'
  WHEN kind IN ('invoice_receivable', 'invoice_payable') AND status = 'partial' THEN 'partial'
  WHEN kind IN ('invoice_receivable', 'invoice_payable') AND status = 'overdue' THEN 'overdue'
  WHEN kind IN ('invoice_receivable', 'invoice_payable') AND status = 'cancelled' THEN 'cancelled'
  WHEN kind IN ('invoice_receivable', 'invoice_payable') THEN 'invoiced'
  -- Service orders (pre-invoice bookings)
  WHEN kind = 'service_order' THEN 'booked'
  -- Quotes
  WHEN kind = 'quote' AND status = 'approved' THEN 'invoiced'
  WHEN kind = 'quote' AND status = 'rejected' THEN 'cancelled'
  WHEN kind = 'quote' AND status = 'expired' THEN 'cancelled'
  WHEN kind = 'quote' THEN 'quoted'
  -- Deals
  WHEN kind = 'deal' THEN 'draft'
  ELSE 'draft'
END
WHERE stage IS NULL;
-- ═══ 5. Backfill direction from kind ═══
UPDATE saas_core.orders SET direction = 'debit'
WHERE kind = 'invoice_payable' AND direction IS NULL;
UPDATE saas_core.orders SET direction = 'credit'
WHERE kind IN ('invoice_receivable', 'service_order', 'quote') AND direction IS NULL;
-- ═══ 6. Backfill starts_at/ends_at from linked bookings ═══
UPDATE saas_core.orders o SET
  starts_at = b.starts_at,
  ends_at = b.ends_at,
  kind = CASE WHEN o.kind = 'service_order' THEN 'appointment' ELSE o.kind END
FROM saas_core.bookings b
WHERE b.order_id = o.id
  AND o.starts_at IS NULL;
-- ═══ 7. Backfill order_items from booking_items (duration + assignee) ═══
-- Update existing order_items that match booking_items by service_id + sort_order
UPDATE saas_core.order_items oi SET
  duration_minutes = bi.duration_minutes,
  assignee_id = bi.assignee_id
FROM saas_core.booking_items bi
JOIN saas_core.bookings b ON b.id = bi.booking_id
WHERE b.order_id = oi.order_id
  AND bi.service_id = oi.service_id
  AND bi.sort_order = oi.sort_order
  AND oi.duration_minutes IS NULL;
-- ═══ 8. Create orders for orphan bookings (appointments without order_id) ═══
INSERT INTO saas_core.orders (id, tenant_id, kind, stage, status, party_id, assignee_id, location_id, starts_at, ends_at, total, notes, metadata, created_at, updated_at)
SELECT b.id, b.tenant_id, 'appointment', 'booked', b.status, b.party_id, b.assignee_id, b.location_id, b.starts_at, b.ends_at, 0, b.notes, b.metadata, b.created_at, b.updated_at
FROM saas_core.bookings b
WHERE b.order_id IS NULL
  AND b.kind = 'appointment'
ON CONFLICT (id) DO NOTHING;
-- Migrate booking_items to order_items for newly created orders
INSERT INTO saas_core.order_items (order_id, service_id, name, quantity, unit_price, total, sort_order, duration_minutes, assignee_id, metadata, created_at)
SELECT b.id, bi.service_id, bi.name, 1, bi.price, bi.price, bi.sort_order, bi.duration_minutes, bi.assignee_id, bi.metadata, bi.created_at
FROM saas_core.booking_items bi
JOIN saas_core.bookings b ON b.id = bi.booking_id
WHERE b.order_id IS NULL
  AND b.kind = 'appointment'
ON CONFLICT DO NOTHING;
-- ═══ 9. Create v_bookings view (calendar query endpoint) ═══
DROP VIEW IF EXISTS public.v_bookings;
CREATE VIEW public.v_bookings AS
SELECT
  o.id,
  o.tenant_id,
  o.kind,
  o.starts_at,
  o.ends_at,
  o.status,
  o.notes,
  o.id AS order_id,
  o.location_id,
  o.metadata,
  -- Client (party)
  o.party_id AS client_id,
  cp.name AS client_name,
  cp.phone AS client_phone,
  cp.email AS client_email,
  cp.avatar_url AS client_avatar_url,
  -- Professional (assignee)
  o.assignee_id AS professional_id,
  ap.name AS professional_name,
  ap.avatar_url AS professional_avatar_url,
  -- Location
  l.name AS location_name,
  -- Order totals
  o.total AS order_total,
  o.stage AS order_status,
  -- Aggregated services from order_items
  (SELECT jsonb_agg(jsonb_build_object(
    'id', oi.id,
    'serviceId', oi.service_id,
    'name', oi.name,
    'durationMinutes', oi.duration_minutes,
    'price', oi.total,
    'assigneeId', oi.assignee_id
  ) ORDER BY oi.sort_order)
  FROM saas_core.order_items oi WHERE oi.order_id = o.id) AS services,
  -- Total duration
  (SELECT COALESCE(SUM(oi.duration_minutes), 0)
   FROM saas_core.order_items oi WHERE oi.order_id = o.id) AS total_duration_minutes,
  -- Extra fields for compatibility
  o.reference_number,
  o.stage,
  o.direction,
  o.created_at,
  o.updated_at
FROM saas_core.orders o
LEFT JOIN saas_core.persons cp ON cp.id = o.party_id
LEFT JOIN saas_core.persons ap ON ap.id = o.assignee_id
LEFT JOIN saas_core.locations l ON l.id = o.location_id
WHERE o.starts_at IS NOT NULL
  AND o.kind = 'appointment';
-- Grant access to the view
GRANT SELECT ON public.v_bookings TO authenticated;
GRANT SELECT ON public.v_bookings TO anon;
