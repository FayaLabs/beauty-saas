-- Seed payment_method_types and card_brands for all existing tenants

DO $$
DECLARE
  t_id uuid;
BEGIN
  FOR t_id IN (
    SELECT id FROM saas_core.tenants
    WHERE id NOT IN (SELECT DISTINCT tenant_id FROM public.payment_method_types)
  )
  LOOP
    INSERT INTO public.payment_method_types (tenant_id, name, transaction_type) VALUES
      (t_id, 'Cash', 'cash'),
      (t_id, 'PIX', 'pix'),
      (t_id, 'Credit Card', 'credit_card'),
      (t_id, 'Debit Card', 'debit_card'),
      (t_id, 'Bank Transfer', 'bank_transfer'),
      (t_id, 'Check', 'check');
  END LOOP;
END $$;

DO $$
DECLARE
  t_id uuid;
BEGIN
  FOR t_id IN (
    SELECT id FROM saas_core.tenants
    WHERE id NOT IN (SELECT DISTINCT tenant_id FROM public.card_brands)
  )
  LOOP
    INSERT INTO public.card_brands (tenant_id, name) VALUES
      (t_id, 'Visa'),
      (t_id, 'Mastercard'),
      (t_id, 'American Express'),
      (t_id, 'Elo'),
      (t_id, 'Hipercard'),
      (t_id, 'Diners Club'),
      (t_id, 'Discover'),
      (t_id, 'JCB'),
      (t_id, 'Aura'),
      (t_id, 'Hiper');
  END LOOP;
END $$;
