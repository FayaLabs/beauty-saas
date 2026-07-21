-- ============================================================================
-- Beauty agent RPCs (app-owned — vertical business rules).
--
-- public.agent_beauty_quote_service_price — SQL port of the client-side
-- pricing engine (src/config/app.tsx resolveServicePricing/variationApplies/
-- applyPriceVariation). Rules, in order:
--   1. base = the service's own price;
--   2. the DEFAULT ACTIVE price table (date-windowed, sort_order asc, first)
--      overrides the base when it has an item for the service;
--   3. every ACTIVE variation, in sort_order: filters service/category/
--      professional/partnership/unit each with type all|only|except
--      ('only' fails on a null actual; 'except' passes — same as the TS
--      engine when the context value is absent);
--   4. percentage|fixed value, addition|subtraction, floor at 0, round 2.
--
-- A parity test (same fixture through the TS engine and through this RPC)
-- guards drift until the client itself calls the RPC and the TS copy retires.
--
-- Read-only (STABLE): no agent_guard — it exposes exactly what the tenant's
-- own pricing pages already read. Tenant-scoped everywhere.
--
-- payload: {service_id uuid, professional_id? uuid, partnership_id? uuid,
--           unit_id? uuid, date? 'YYYY-MM-DD'}
-- ============================================================================

CREATE OR REPLACE FUNCTION public.agent_beauty_quote_service_price(
  p_tenant_id uuid,
  p_actor_user_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_id uuid;
  v_professional uuid;
  v_partnership uuid;
  v_unit uuid;
  v_date date;
  v_service record;
  v_table_id uuid;
  v_price numeric;
  v_source text := 'service';
  v_var record;
  v_value numeric;
  v_delta numeric;
  v_applied jsonb := '[]'::jsonb;
BEGIN
  BEGIN
    v_service_id   := (p_payload->>'service_id')::uuid;
    v_professional := (p_payload->>'professional_id')::uuid;
    v_partnership  := (p_payload->>'partnership_id')::uuid;
    v_unit         := (p_payload->>'unit_id')::uuid;
    v_date         := COALESCE((p_payload->>'date')::date, current_date);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid payload: ' || SQLERRM);
  END;
  IF v_service_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_id is required');
  END IF;

  SELECT s.id, s.name, s.price, s.category_id,
         COALESCE(s.duration_minutes, 30) AS duration_minutes
    INTO v_service
  FROM services s
  WHERE s.id = v_service_id AND s.tenant_id = p_tenant_id
    AND s.is_active AND s.status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown or inactive service');
  END IF;

  v_price := COALESCE(v_service.price, 0);

  -- default active price table (date window, first by sort_order)
  SELECT t.id INTO v_table_id
  FROM service_price_tables t
  WHERE t.tenant_id = p_tenant_id
    AND t.is_active AND t.is_default
    AND (t.starts_on IS NULL OR t.starts_on <= v_date)
    AND (t.ends_on IS NULL OR t.ends_on >= v_date)
  ORDER BY t.sort_order ASC
  LIMIT 1;

  IF v_table_id IS NOT NULL THEN
    SELECT i.price INTO v_value
    FROM service_price_table_items i
    WHERE i.tenant_id = p_tenant_id
      AND i.price_table_id = v_table_id
      AND i.service_id = v_service_id
    LIMIT 1;
    IF FOUND AND v_value IS NOT NULL THEN
      v_price := v_value;
      v_source := 'price-table';
    END IF;
  END IF;

  -- variations in sort_order (filter semantics mirror filterMatches())
  FOR v_var IN
    SELECT * FROM service_price_variations v
    WHERE v.tenant_id = p_tenant_id AND v.is_active
    ORDER BY v.sort_order ASC
  LOOP
    IF NOT (
      (COALESCE(v_var.service_filter_type,'all') = 'all'
        OR (v_var.service_filter_type = 'only'   AND v_var.service_id IS NOT NULL AND v_var.service_id = v_service.id)
        OR (v_var.service_filter_type = 'except' AND (v_var.service_id IS NULL OR v_var.service_id <> v_service.id)))
      AND
      (COALESCE(v_var.category_filter_type,'all') = 'all'
        OR (v_var.category_filter_type = 'only'   AND v_var.category_id IS NOT NULL AND v_var.category_id = v_service.category_id)
        OR (v_var.category_filter_type = 'except' AND (v_var.category_id IS NULL OR v_var.category_id IS DISTINCT FROM v_service.category_id)))
      AND
      (COALESCE(v_var.professional_filter_type,'all') = 'all'
        OR (v_var.professional_filter_type = 'only'   AND v_var.professional_id IS NOT NULL AND v_var.professional_id = v_professional)
        OR (v_var.professional_filter_type = 'except' AND (v_var.professional_id IS NULL OR v_var.professional_id IS DISTINCT FROM v_professional)))
      AND
      (COALESCE(v_var.partnership_filter_type,'all') = 'all'
        OR (v_var.partnership_filter_type = 'only'   AND v_var.partnership_id IS NOT NULL AND v_var.partnership_id = v_partnership)
        OR (v_var.partnership_filter_type = 'except' AND (v_var.partnership_id IS NULL OR v_var.partnership_id IS DISTINCT FROM v_partnership)))
      AND
      (COALESCE(v_var.unit_filter_type,'all') = 'all'
        OR (v_var.unit_filter_type = 'only'   AND v_var.unit_id IS NOT NULL AND v_var.unit_id = v_unit)
        OR (v_var.unit_filter_type = 'except' AND (v_var.unit_id IS NULL OR v_var.unit_id IS DISTINCT FROM v_unit)))
    ) THEN
      CONTINUE;
    END IF;

    v_value := COALESCE(v_var.value, 0);
    v_delta := CASE WHEN v_var.value_type = 'percentage' THEN v_price * (v_value / 100.0) ELSE v_value END;
    v_price := CASE WHEN v_var.variation_type = 'addition' THEN v_price + v_delta ELSE v_price - v_delta END;
    v_price := GREATEST(0, round(v_price, 2));
    v_applied := v_applied || to_jsonb(v_var.id);
    IF v_source = 'service' THEN v_source := 'variation'; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'record', jsonb_build_object(
      'ref', jsonb_build_object('id', v_service.id, 'resource', 'services',
                                'archetype', 'service'),
      'service_name', v_service.name,
      'base_price', v_service.price,
      'quoted_price', v_price,
      'price_source', v_source,
      'price_table_id', v_table_id,
      'variation_ids', v_applied,
      'duration_minutes', v_service.duration_minutes,
      'date', v_date
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.agent_beauty_quote_service_price(uuid, uuid, jsonb) FROM public;
REVOKE EXECUTE ON FUNCTION public.agent_beauty_quote_service_price(uuid, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.agent_beauty_quote_service_price(uuid, uuid, jsonb)
  TO authenticated, service_role;
