-- ---------------------------------------------------------------------------
-- Split bill (obligation) vs payment (cash event)
-- ---------------------------------------------------------------------------
-- Before: paying an installment mutated the bill row in place (paid_amount += x),
-- so two payments on one installment collapsed into a single summed row and the
-- extract could only ever show one transaction.
--
-- Now: each payment is its own movement_kind='payment' row (one row per cash event).
-- The bill stays a pure obligation; its paid_amount/status remain a cache that
-- v_invoice_balances reads (which already filters movement_kind='bill', so the new
-- payment rows do NOT affect invoice balances).
--
-- This backfills historical paid bills into payment movements so they keep showing
-- in the extract (which now reads payment + transfer movements). Idempotent via the
-- metadata.backfilledFromBill guard. Requires fee_amount (migration 20260618000001).
-- ---------------------------------------------------------------------------

INSERT INTO public.financial_movements
  (tenant_id, invoice_id, direction, movement_kind, amount, paid_amount, fee_amount, status,
   due_date, payment_date, installment_number, payment_method_id, payment_method_type_id,
   bank_account_id, cash_session_id, card_brand, card_installments, notes, metadata)
SELECT
  b.tenant_id, b.invoice_id, b.direction, 'payment', b.paid_amount, b.paid_amount,
  COALESCE(b.fee_amount, 0), 'paid',
  b.due_date, COALESCE(b.payment_date, b.updated_at::date, CURRENT_DATE), b.installment_number,
  b.payment_method_id, b.payment_method_type_id, b.bank_account_id, b.cash_session_id,
  b.card_brand, b.card_installments, b.notes,
  jsonb_build_object('backfilledFromBill', b.id)
FROM public.financial_movements b
WHERE b.movement_kind = 'bill'
  AND b.paid_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.financial_movements p
    WHERE p.movement_kind = 'payment'
      AND p.metadata->>'backfilledFromBill' = b.id::text
  );

-- Bills are now pure obligations — clear their cash fields so they never look like a
-- cash event. paid_amount + status are kept (the cache v_invoice_balances reads).
UPDATE public.financial_movements
SET payment_date = NULL,
    bank_account_id = NULL,
    payment_method_id = NULL,
    payment_method_type_id = NULL,
    cash_session_id = NULL,
    card_brand = NULL,
    card_installments = NULL
WHERE movement_kind = 'bill';
