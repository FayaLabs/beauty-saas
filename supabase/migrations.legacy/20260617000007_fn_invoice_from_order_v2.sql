-- S5 adoption: generalize fn_invoice_from_order so BOTH callers (CRM approveQuote
-- and the agenda financial bridge) use the SAME atomic promotion. Adds:
--   p_installments  N installments (monthly), rounding fixed on the last
--   p_direction     credit→REC/receivable, debit→PAG/payable
--   p_status        caller passes a kind-valid status (CHECK orders_kind_status_valid)
-- Backward compatible: CRM's 3-arg named call resolves via defaults. Drops the old
-- 3-arg overload to avoid ambiguity. See docs/dogfood-sprint/DATA-MODEL-REFACTOR.md.
DROP FUNCTION IF EXISTS public.fn_invoice_from_order(uuid, date, text);
CREATE OR REPLACE FUNCTION public.fn_invoice_from_order(
  p_order_id uuid,
  p_due_date date DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_installments int DEFAULT 1,
  p_direction text DEFAULT 'credit'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, saas_core
AS $$
DECLARE
  v_order   saas_core.orders%ROWTYPE;
  v_ref     text;
  v_seq     bigint;
  v_summary text;
  v_contact text;
  v_existing uuid;
  v_kind    text;
  v_prefix  text;
  v_n       int := GREATEST(COALESCE(p_installments, 1), 1);
  v_total   numeric;
  v_base    numeric;
  v_amt     numeric;
  v_alloc   numeric := 0;
  v_due     date;
  i         int;
BEGIN
  SELECT * INTO v_order FROM saas_core.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'fn_invoice_from_order: order % not found', p_order_id; END IF;
  IF v_order.tenant_id NOT IN (SELECT public.user_tenant_ids()) THEN
    RAISE EXCEPTION 'fn_invoice_from_order: forbidden';
  END IF;

  -- Idempotent: a bill movement means already invoiced.
  SELECT id INTO v_existing FROM public.financial_movements
    WHERE invoice_id = p_order_id AND movement_kind = 'bill' LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN p_order_id; END IF;

  IF p_direction = 'debit' THEN v_kind := 'invoice_payable'; v_prefix := 'PAG';
  ELSE v_kind := 'invoice_receivable'; v_prefix := 'REC'; END IF;

  SELECT saas_core.next_sequence(v_order.tenant_id, v_kind) INTO v_seq;
  v_ref := v_prefix || '-' || lpad(v_seq::text, 5, '0');

  SELECT string_agg(name, ', ' ORDER BY sort_order) INTO v_summary
    FROM saas_core.order_items WHERE order_id = p_order_id;
  SELECT name INTO v_contact FROM saas_core.persons WHERE id = v_order.party_id;

  UPDATE saas_core.orders SET
    status = COALESCE(p_status, status),
    stage = 'invoiced',
    direction = p_direction,
    reference_number = v_ref,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'itemsSummary', COALESCE(v_summary, ''),
      'contactName', v_contact,
      'installmentCount', v_n,
      'quoteNumber', v_order.reference_number,
      'direction', p_direction
    ),
    updated_at = now()
  WHERE id = p_order_id;

  v_total := COALESCE(v_order.total, 0);
  v_base  := round(v_total / v_n, 2);
  v_due   := COALESCE(p_due_date, current_date);
  FOR i IN 1..v_n LOOP
    IF i = v_n THEN v_amt := round(v_total - v_alloc, 2);
    ELSE v_amt := v_base; v_alloc := v_alloc + v_base; END IF;
    INSERT INTO public.financial_movements
      (tenant_id, invoice_id, direction, movement_kind, amount, paid_amount, status, due_date, installment_number)
    VALUES
      (v_order.tenant_id, p_order_id, p_direction, 'bill', v_amt, 0, 'pending',
       (v_due + ((i - 1) || ' months')::interval)::date, i);
  END LOOP;

  RETURN p_order_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_invoice_from_order(uuid, date, text, int, text) TO authenticated;
