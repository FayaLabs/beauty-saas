-- Plugin: CRM / Sales
-- Leads use saas_core.persons (kind='lead')
-- Deals use saas_core.orders (kind='deal')
-- Quotes use saas_core.orders (kind='quote') + saas_core.order_items

-- Pipelines
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pipelines_tenant ON public.pipelines(tenant_id);

-- Pipeline stages
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  color text DEFAULT '#6366f1',
  probability numeric(5,2) DEFAULT 0,
  is_won boolean DEFAULT false,
  is_lost boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant ON public.pipeline_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON public.pipeline_stages(pipeline_id);

-- Lead sources
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lead_sources_tenant ON public.lead_sources(tenant_id);

-- CRM tags
CREATE TABLE IF NOT EXISTS public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_tags_tenant ON public.crm_tags(tenant_id);

-- Deal extensions (links saas_core.orders kind='deal' to pipeline)
CREATE TABLE IF NOT EXISTS public.deal_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES saas_core.orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  pipeline_id uuid REFERENCES public.pipelines(id),
  stage_id uuid REFERENCES public.pipeline_stages(id),
  probability numeric(5,2) DEFAULT 0,
  expected_close_date date,
  lead_id uuid REFERENCES saas_core.persons(id),
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_extensions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_deal_extensions_tenant ON public.deal_extensions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deal_extensions_order ON public.deal_extensions(order_id);
CREATE INDEX IF NOT EXISTS idx_deal_extensions_stage ON public.deal_extensions(stage_id);

-- Activity types
CREATE TABLE IF NOT EXISTS public.crm_activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_activity_types ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_activity_types_tenant ON public.crm_activity_types(tenant_id);

-- Activities
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES saas_core.orders(id),
  lead_id uuid REFERENCES saas_core.persons(id),
  contact_id uuid REFERENCES saas_core.persons(id),
  contact_name text,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  completed_at timestamptz,
  assigned_to_id uuid,
  assigned_to_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_activities_tenant ON public.crm_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON public.crm_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON public.crm_activities(lead_id);
