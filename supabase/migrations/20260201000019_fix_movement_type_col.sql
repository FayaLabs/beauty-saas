-- Add payment_method_type_id to financial_movements if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_movements'
      AND column_name = 'payment_method_type_id'
  ) THEN
    ALTER TABLE public.financial_movements
      ADD COLUMN payment_method_type_id uuid REFERENCES public.payment_method_types(id);
  END IF;
END $$;
