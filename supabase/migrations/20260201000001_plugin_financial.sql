-- Plugin: Financial
-- Tables for payment methods, bank accounts, cash sessions, and financial movements

-- Payment method types (Cash, PIX, Credit Card, etc.)
CREATE TABLE IF NOT EXISTS public.payment_method_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  transaction_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  allowed_account_types jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_method_types ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_payment_method_types_tenant ON public.payment_method_types(tenant_id);

-- Payment methods (configured by users)
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  payment_method_type_id uuid REFERENCES public.payment_method_types(id),
  is_active boolean NOT NULL DEFAULT true,
  discount_mode text,
  discount_value numeric(12,2) DEFAULT 0,
  interest_mode text,
  interest_value numeric(12,2) DEFAULT 0,
  min_installments integer DEFAULT 1,
  max_installments integer DEFAULT 1,
  service_filter_mode text DEFAULT 'all',
  service_filter_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods(tenant_id);

-- Bank accounts (bank, cash register, credit card, digital wallet)
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'bank_account',
  bank_name text,
  account_number text,
  agency_number text,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  credit_limit numeric(14,2),
  due_day integer,
  closing_day integer,
  is_active boolean NOT NULL DEFAULT true,
  unit_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON public.bank_accounts(tenant_id);

-- Cash register sessions
CREATE TABLE IF NOT EXISTS public.cash_register_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id),
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by_user_id uuid,
  opened_by_name text,
  opening_balance numeric(14,2) NOT NULL,
  closed_at timestamptz,
  closed_by_user_id uuid,
  closed_by_name text,
  closing_balance numeric(14,2),
  expected_balance numeric(14,2),
  difference numeric(14,2),
  notes text,
  unit_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cash_register_sessions_tenant ON public.cash_register_sessions(tenant_id);

-- Financial movements (installments and payments)
-- Invoices use saas_core.orders (kind='invoice_payable'/'invoice_receivable')
CREATE TABLE IF NOT EXISTS public.financial_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES saas_core.orders(id),
  direction text NOT NULL,
  movement_kind text NOT NULL,
  amount numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  due_date date NOT NULL,
  payment_date date,
  installment_number integer,
  payment_method_id uuid REFERENCES public.payment_methods(id),
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  cash_session_id uuid REFERENCES public.cash_register_sessions(id),
  card_brand text,
  card_installments integer,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_financial_movements_tenant ON public.financial_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_movements_invoice ON public.financial_movements(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financial_movements_due ON public.financial_movements(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_movements_bank ON public.financial_movements(bank_account_id);

-- Chart of accounts (hierarchical)
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  node_type text NOT NULL DEFAULT 'leaf',
  parent_id uuid REFERENCES public.chart_of_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant ON public.chart_of_accounts(tenant_id);

-- Cost centers
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant ON public.cost_centers(tenant_id);

-- Card brands
CREATE TABLE IF NOT EXISTS public.card_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES saas_core.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.card_brands ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_card_brands_tenant ON public.card_brands(tenant_id);
