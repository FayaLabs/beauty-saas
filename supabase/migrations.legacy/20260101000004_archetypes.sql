-- ============================================================================
-- saas_core archetype tables
-- Shared base entities that project-specific tables extend via FK
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. persons — any human entity (staff, customer, supplier, professional)
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  document_number text,
  avatar_url text,
  date_of_birth date,
  address text,
  city text,
  state text,
  country text DEFAULT 'BR',
  postal_code text,
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX persons_tenant_kind ON saas_core.persons(tenant_id, kind);
CREATE TRIGGER persons_updated_at BEFORE UPDATE ON saas_core.persons
  FOR EACH ROW EXECUTE FUNCTION saas_core.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 2. categories — generic taxonomy (species, menu categories, regions)
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  slug text,
  parent_id uuid REFERENCES saas_core.categories(id) ON DELETE SET NULL,
  icon text,
  color text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX categories_tenant_kind ON saas_core.categories(tenant_id, kind);
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON saas_core.categories
  FOR EACH ROW EXECUTE FUNCTION saas_core.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 3. products — physical/trackable items (menu items, equipment, ingredients)
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES saas_core.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sku text,
  price numeric,
  cost numeric,
  currency text DEFAULT 'BRL',
  unit text,
  image_url text,
  stock numeric,
  min_stock numeric,
  status text DEFAULT 'active',
  is_active boolean DEFAULT true,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_tenant ON saas_core.products(tenant_id);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON saas_core.products
  FOR EACH ROW EXECUTE FUNCTION saas_core.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. services — intangible offerings (exam types, consultations)
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES saas_core.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric,
  cost numeric,
  currency text DEFAULT 'BRL',
  duration_minutes integer,
  image_url text,
  status text DEFAULT 'active',
  is_active boolean DEFAULT true,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX services_tenant ON saas_core.services(tenant_id);
CREATE TRIGGER services_updated_at BEFORE UPDATE ON saas_core.services
  FOR EACH ROW EXECUTE FUNCTION saas_core.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 5. orders — business orders/jobs
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  reference_number text,
  status text DEFAULT 'draft',
  party_id uuid REFERENCES saas_core.persons(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES saas_core.persons(id) ON DELETE SET NULL,
  location_id uuid REFERENCES saas_core.locations(id) ON DELETE SET NULL,
  subtotal numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  currency text DEFAULT 'BRL',
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_tenant_kind ON saas_core.orders(tenant_id, kind);
CREATE INDEX orders_status ON saas_core.orders(tenant_id, status);
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON saas_core.orders
  FOR EACH ROW EXECUTE FUNCTION saas_core.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 6. order_items — line items for orders
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES saas_core.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES saas_core.products(id) ON DELETE SET NULL,
  service_id uuid REFERENCES saas_core.services(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_items_order ON saas_core.order_items(order_id);

-- ---------------------------------------------------------------------------
-- 7. transactions — financial movements (payments, refunds, expenses)
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  order_id uuid REFERENCES saas_core.orders(id) ON DELETE SET NULL,
  party_id uuid REFERENCES saas_core.persons(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'BRL',
  payment_method text,
  reference text,
  status text DEFAULT 'completed',
  transacted_at timestamptz DEFAULT now(),
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transactions_tenant_kind ON saas_core.transactions(tenant_id, kind);
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON saas_core.transactions
  FOR EACH ROW EXECUTE FUNCTION saas_core.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 8. bookings — reservations/appointments
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  party_id uuid REFERENCES saas_core.persons(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES saas_core.persons(id) ON DELETE SET NULL,
  location_id uuid REFERENCES saas_core.locations(id) ON DELETE SET NULL,
  order_id uuid REFERENCES saas_core.orders(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text DEFAULT 'pending',
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bookings_tenant_kind ON saas_core.bookings(tenant_id, kind);
CREATE INDEX bookings_starts ON saas_core.bookings(tenant_id, starts_at);
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON saas_core.bookings
  FOR EACH ROW EXECUTE FUNCTION saas_core.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 9. booking_items — services within a booking
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES saas_core.bookings(id) ON DELETE CASCADE,
  service_id uuid REFERENCES saas_core.services(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES saas_core.persons(id) ON DELETE SET NULL,
  name text NOT NULL,
  duration_minutes integer,
  price numeric DEFAULT 0,
  sort_order integer DEFAULT 0,
  notes text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_items_booking ON saas_core.booking_items(booking_id);

-- ---------------------------------------------------------------------------
-- 10. schedules — recurring availability/shifts
-- ---------------------------------------------------------------------------
CREATE TABLE saas_core.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  assignee_id uuid REFERENCES saas_core.persons(id) ON DELETE CASCADE,
  location_id uuid REFERENCES saas_core.locations(id) ON DELETE SET NULL,
  day_of_week smallint,
  specific_date date,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX schedules_tenant_kind ON saas_core.schedules(tenant_id, kind);
CREATE INDEX schedules_assignee ON saas_core.schedules(assignee_id, day_of_week);
CREATE TRIGGER schedules_updated_at BEFORE UPDATE ON saas_core.schedules
  FOR EACH ROW EXECUTE FUNCTION saas_core.handle_updated_at();

-- ============================================================================
-- RLS policies — tenant isolation for all archetype tables
-- ============================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'persons', 'categories', 'products', 'services',
    'orders', 'transactions', 'bookings', 'schedules'
  ]
  LOOP
    EXECUTE format('ALTER TABLE saas_core.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "%s_select" ON saas_core.%I FOR SELECT TO authenticated USING (tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON saas_core.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update" ON saas_core.%I FOR UPDATE TO authenticated USING (tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid()))',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON saas_core.%I FOR DELETE TO authenticated USING (tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid()))',
      tbl, tbl
    );
  END LOOP;

  -- Child tables (order_items, booking_items) — RLS via parent FK
  FOREACH tbl IN ARRAY ARRAY['order_items', 'booking_items']
  LOOP
    EXECUTE format('ALTER TABLE saas_core.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- order_items: access via parent order's tenant
CREATE POLICY "order_items_select" ON saas_core.order_items FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM saas_core.orders WHERE tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "order_items_insert" ON saas_core.order_items FOR INSERT TO authenticated
  WITH CHECK (order_id IN (SELECT id FROM saas_core.orders WHERE tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "order_items_update" ON saas_core.order_items FOR UPDATE TO authenticated
  USING (order_id IN (SELECT id FROM saas_core.orders WHERE tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "order_items_delete" ON saas_core.order_items FOR DELETE TO authenticated
  USING (order_id IN (SELECT id FROM saas_core.orders WHERE tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())));

-- booking_items: access via parent booking's tenant
CREATE POLICY "booking_items_select" ON saas_core.booking_items FOR SELECT TO authenticated
  USING (booking_id IN (SELECT id FROM saas_core.bookings WHERE tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "booking_items_insert" ON saas_core.booking_items FOR INSERT TO authenticated
  WITH CHECK (booking_id IN (SELECT id FROM saas_core.bookings WHERE tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "booking_items_update" ON saas_core.booking_items FOR UPDATE TO authenticated
  USING (booking_id IN (SELECT id FROM saas_core.bookings WHERE tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "booking_items_delete" ON saas_core.booking_items FOR DELETE TO authenticated
  USING (booking_id IN (SELECT id FROM saas_core.bookings WHERE tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())));

-- Grant access to archetype tables
GRANT ALL ON ALL TABLES IN SCHEMA saas_core TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA saas_core TO anon;
