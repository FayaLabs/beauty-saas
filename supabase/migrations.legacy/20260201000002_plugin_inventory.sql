-- Plugin: Inventory
-- Products use saas_core.products archetype directly
-- These are plugin-specific extension tables

-- Product categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.product_categories(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_product_categories_tenant ON public.product_categories(tenant_id);

-- Stock locations (warehouses, storage areas)
CREATE TABLE IF NOT EXISTS public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  unit_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stock_locations_tenant ON public.stock_locations(tenant_id);

-- Stock movements (entry, exit, adjustment, transfer, loss)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES saas_core.products(id),
  quantity numeric(14,4) NOT NULL,
  movement_type text NOT NULL,
  unit_cost numeric(14,2) DEFAULT 0,
  total_cost numeric(14,2) DEFAULT 0,
  stock_location_id uuid REFERENCES public.stock_locations(id),
  destination_location_id uuid REFERENCES public.stock_locations(id),
  supplier_id uuid REFERENCES saas_core.persons(id),
  document_number text,
  reason text,
  notes text,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  user_id uuid,
  batch_number text,
  expiration_date date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON public.stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(tenant_id, movement_date);

-- Stock positions (physical inventory by location + batch)
CREATE TABLE IF NOT EXISTS public.stock_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES saas_core.products(id),
  quantity numeric(14,4) NOT NULL,
  unit_cost numeric(14,2) DEFAULT 0,
  stock_location_id uuid REFERENCES public.stock_locations(id),
  batch_number text,
  expiration_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_positions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stock_positions_tenant ON public.stock_positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_positions_product ON public.stock_positions(product_id);

-- Measurement units
CREATE TABLE IF NOT EXISTS public.measurement_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  abbreviation text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_measurement_units_tenant ON public.measurement_units(tenant_id);

-- Recipes (production formulas)
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  product_id uuid REFERENCES saas_core.products(id),
  yield_quantity numeric(14,4) DEFAULT 1,
  yield_unit_id uuid,
  preparation_time_minutes integer,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_recipes_tenant ON public.recipes(tenant_id);

-- Recipe ingredients
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES saas_core.products(id),
  quantity numeric(14,4) NOT NULL,
  unit_id uuid,
  display_order integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_tenant ON public.recipe_ingredients(tenant_id);
