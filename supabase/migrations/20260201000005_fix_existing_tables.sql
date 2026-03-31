-- Fix tables that already existed with different column names
-- This handles the case where tables were created by earlier migrations
-- with different schemas than our plugin migrations expect

-- bank_accounts: add missing columns if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'account_type') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN account_type text NOT NULL DEFAULT 'bank_account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'bank_name') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN bank_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'account_number') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN account_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'agency_number') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN agency_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'current_balance') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN current_balance numeric(14,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'initial_balance') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN initial_balance numeric(14,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'credit_limit') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN credit_limit numeric(14,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'due_day') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN due_day integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'closing_day') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN closing_day integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'is_active') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'unit_id') THEN
    ALTER TABLE public.bank_accounts ADD COLUMN unit_id uuid;
  END IF;
END $$;

-- payment_methods: add missing columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_methods' AND column_name = 'payment_method_type_id') THEN
    ALTER TABLE public.payment_methods ADD COLUMN payment_method_type_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_methods' AND column_name = 'is_active') THEN
    ALTER TABLE public.payment_methods ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_methods' AND column_name = 'discount_mode') THEN
    ALTER TABLE public.payment_methods ADD COLUMN discount_mode text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_methods' AND column_name = 'discount_value') THEN
    ALTER TABLE public.payment_methods ADD COLUMN discount_value numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_methods' AND column_name = 'interest_mode') THEN
    ALTER TABLE public.payment_methods ADD COLUMN interest_mode text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_methods' AND column_name = 'interest_value') THEN
    ALTER TABLE public.payment_methods ADD COLUMN interest_value numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_methods' AND column_name = 'min_installments') THEN
    ALTER TABLE public.payment_methods ADD COLUMN min_installments integer DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_methods' AND column_name = 'max_installments') THEN
    ALTER TABLE public.payment_methods ADD COLUMN max_installments integer DEFAULT 1;
  END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
