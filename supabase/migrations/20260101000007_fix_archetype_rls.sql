-- Fix archetype RLS policies to use SECURITY DEFINER function
-- The raw subquery on tenant_members fails due to recursive RLS

-- Create saas_core version of the helper (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION saas_core.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid();
$$;

-- Also ensure public version exists
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid();
$$;

-- Drop and recreate all archetype table policies using the SECURITY DEFINER function
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'persons', 'categories', 'products', 'services',
    'orders', 'transactions', 'bookings', 'schedules'
  ]
  LOOP
    -- Drop old policies
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON saas_core.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON saas_core.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON saas_core.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON saas_core.%I', tbl, tbl);

    -- Create new policies using SECURITY DEFINER function
    EXECUTE format(
      'CREATE POLICY "%s_select" ON saas_core.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT saas_core.user_tenant_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON saas_core.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT saas_core.user_tenant_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update" ON saas_core.%I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT saas_core.user_tenant_ids()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON saas_core.%I FOR DELETE TO authenticated USING (tenant_id IN (SELECT saas_core.user_tenant_ids()))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Fix child table policies too
DROP POLICY IF EXISTS "order_items_select" ON saas_core.order_items;
DROP POLICY IF EXISTS "order_items_insert" ON saas_core.order_items;
DROP POLICY IF EXISTS "order_items_update" ON saas_core.order_items;
DROP POLICY IF EXISTS "order_items_delete" ON saas_core.order_items;

CREATE POLICY "order_items_select" ON saas_core.order_items FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM saas_core.orders WHERE tenant_id IN (SELECT saas_core.user_tenant_ids())));
CREATE POLICY "order_items_insert" ON saas_core.order_items FOR INSERT TO authenticated
  WITH CHECK (order_id IN (SELECT id FROM saas_core.orders WHERE tenant_id IN (SELECT saas_core.user_tenant_ids())));
CREATE POLICY "order_items_update" ON saas_core.order_items FOR UPDATE TO authenticated
  USING (order_id IN (SELECT id FROM saas_core.orders WHERE tenant_id IN (SELECT saas_core.user_tenant_ids())));
CREATE POLICY "order_items_delete" ON saas_core.order_items FOR DELETE TO authenticated
  USING (order_id IN (SELECT id FROM saas_core.orders WHERE tenant_id IN (SELECT saas_core.user_tenant_ids())));

DROP POLICY IF EXISTS "booking_items_select" ON saas_core.booking_items;
DROP POLICY IF EXISTS "booking_items_insert" ON saas_core.booking_items;
DROP POLICY IF EXISTS "booking_items_update" ON saas_core.booking_items;
DROP POLICY IF EXISTS "booking_items_delete" ON saas_core.booking_items;

CREATE POLICY "booking_items_select" ON saas_core.booking_items FOR SELECT TO authenticated
  USING (booking_id IN (SELECT id FROM saas_core.bookings WHERE tenant_id IN (SELECT saas_core.user_tenant_ids())));
CREATE POLICY "booking_items_insert" ON saas_core.booking_items FOR INSERT TO authenticated
  WITH CHECK (booking_id IN (SELECT id FROM saas_core.bookings WHERE tenant_id IN (SELECT saas_core.user_tenant_ids())));
CREATE POLICY "booking_items_update" ON saas_core.booking_items FOR UPDATE TO authenticated
  USING (booking_id IN (SELECT id FROM saas_core.bookings WHERE tenant_id IN (SELECT saas_core.user_tenant_ids())));
CREATE POLICY "booking_items_delete" ON saas_core.booking_items FOR DELETE TO authenticated
  USING (booking_id IN (SELECT id FROM saas_core.bookings WHERE tenant_id IN (SELECT saas_core.user_tenant_ids())));
