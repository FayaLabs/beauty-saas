-- S5 (data-model refactor): atomic cross-document transition. Promote any order
-- (quote/booking/service_order) into a receivable invoice in ONE transaction —
-- ref number + stage/direction + the financial_movements installment — instead
-- of each plugin re-implementing the multi-step write (CRM approveQuote, agenda
-- bridge, financial createInvoice all duplicated this). SECURITY DEFINER so it
-- runs atomically; tenant-guarded since DEFINER bypasses RLS. Idempotent.
-- See docs/dogfood-sprint/DATA-MODEL-REFACTOR.md.
CREATE OR REPLACE FUNCTION public.fn_invoice_from_order(
  p_order_id uuid,
  p_due_date date DEFAULT NULL,
  p_status text DEFAULT 'approved'
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
  v_existing uuid;
BEGIN
  SELECT * INTO v_order FROM saas_core.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'fn_invoice_from_order: order % not found', p_order_id; END IF;

  -- DEFINER bypasses RLS → check tenant membership explicitly.
  IF v_order.tenant_id NOT IN (SELECT public.user_tenant_ids()) THEN
    RAISE EXCEPTION 'fn_invoice_from_order: forbidden';
  END IF;

  -- Idempotent: an order with a bill movement is already invoiced.
  SELECT id INTO v_existing FROM public.financial_movements
    WHERE invoice_id = p_order_id AND movement_kind = 'bill' LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN p_order_id; END IF;

  SELECT saas_core.next_sequence(v_order.tenant_id, 'invoice_receivable') INTO v_seq;
  v_ref := 'REC-' || lpad(v_seq::text, 5, '0');

  SELECT string_agg(name, ', ' ORDER BY sort_order) INTO v_summary
    FROM saas_core.order_items WHERE order_id = p_order_id;

  UPDATE saas_core.orders SET
    status = p_status,
    stage = 'invoiced',
    direction = 'credit',
    reference_number = v_ref,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'itemsSummary', COALESCE(v_summary, ''),
      'installmentCount', 1,
      'quoteNumber', v_order.reference_number
    ),
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.financial_movements
    (tenant_id, invoice_id, direction, movement_kind, amount, paid_amount, status, due_date, installment_number)
  VALUES
    (v_order.tenant_id, p_order_id, 'credit', 'bill', COALESCE(v_order.total, 0), 0, 'pending', COALESCE(p_due_date, current_date), 1);

  RETURN p_order_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_invoice_from_order(uuid, date, text) TO authenticated;
