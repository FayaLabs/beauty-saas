-- ONE generic function that handles ALL archetype joins
-- Replaces all entity-specific RPC functions (get_clients, get_staff, get_stock_movements)
--
-- Usage: SELECT * FROM public.archetype_join('clients', 'persons', 'person_id', tenant_id, search, limit, offset)
-- This scales to ANY extension table + archetype table combo without creating new functions

CREATE OR REPLACE FUNCTION public.archetype_join(
  p_extension_table text,        -- e.g. 'clients', 'staff_members', 'stock_movements'
  p_archetype_table text,        -- e.g. 'persons', 'products', 'orders'
  p_fk_column text,              -- e.g. 'person_id', 'product_id'
  p_tenant_id uuid,
  p_search text DEFAULT NULL,
  p_search_columns text[] DEFAULT ARRAY['name'],  -- columns to search on (in archetype table)
  p_sort_column text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_filters jsonb DEFAULT NULL   -- additional filters: {"kind": "customer", "is_active": true}
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_where text := '';
  v_search_where text := '';
  v_filter_key text;
  v_filter_val jsonb;
  v_data json;
  v_total bigint;
BEGIN
  -- Build search clause
  IF p_search IS NOT NULL AND array_length(p_search_columns, 1) > 0 THEN
    v_search_where := ' AND (' || (
      SELECT string_agg(format('a.%I ILIKE %L', col, '%' || p_search || '%'), ' OR ')
      FROM unnest(p_search_columns) AS col
    ) || ')';
  END IF;

  -- Build filter clauses from JSONB
  IF p_filters IS NOT NULL THEN
    FOR v_filter_key, v_filter_val IN SELECT * FROM jsonb_each(p_filters) LOOP
      IF jsonb_typeof(v_filter_val) = 'string' THEN
        v_where := v_where || format(' AND a.%I = %L', v_filter_key, v_filter_val #>> '{}');
      ELSIF jsonb_typeof(v_filter_val) = 'boolean' THEN
        v_where := v_where || format(' AND a.%I = %s', v_filter_key, v_filter_val);
      ELSIF jsonb_typeof(v_filter_val) = 'number' THEN
        v_where := v_where || format(' AND a.%I = %s', v_filter_key, v_filter_val);
      END IF;
    END LOOP;
  END IF;

  -- Get data with JOIN
  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json)
     FROM (
       SELECT a.*, to_jsonb(e.*) - %L - ''tenant_id'' AS _ext
       FROM saas_core.%I a
       INNER JOIN public.%I e ON e.%I = a.id
       WHERE e.tenant_id = $1 %s %s
       ORDER BY %I %s
       LIMIT $2 OFFSET $3
     ) t',
    p_fk_column, p_archetype_table, p_extension_table, p_fk_column,
    v_where, v_search_where,
    p_sort_column, p_sort_dir
  ) INTO v_data USING p_tenant_id, p_limit, p_offset;

  -- Get total count
  EXECUTE format(
    'SELECT COUNT(*)
     FROM saas_core.%I a
     INNER JOIN public.%I e ON e.%I = a.id
     WHERE e.tenant_id = $1 %s %s',
    p_archetype_table, p_extension_table, p_fk_column,
    v_where, v_search_where
  ) INTO v_total USING p_tenant_id;

  RETURN json_build_object('data', v_data, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.archetype_join TO authenticated;

-- Also create a simpler version for tables that JOIN from the OTHER direction
-- (e.g., stock_movements.product_id → products.id where stock_movements is the "main" table)
CREATE OR REPLACE FUNCTION public.table_join(
  p_main_table text,             -- e.g. 'stock_movements' (in public schema)
  p_join_table text,             -- e.g. 'products' (in saas_core schema)
  p_fk_column text,              -- e.g. 'product_id' (column on main table)
  p_join_columns text[],         -- e.g. ARRAY['name', 'sku'] (columns to include from join table)
  p_tenant_id uuid,
  p_search text DEFAULT NULL,
  p_search_columns text[] DEFAULT ARRAY['name'],
  p_sort_column text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_filters jsonb DEFAULT NULL
) RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_join_select text;
  v_where text := '';
  v_search_where text := '';
  v_filter_key text;
  v_filter_val jsonb;
  v_data json;
  v_total bigint;
BEGIN
  -- Build join column select
  v_join_select := (SELECT string_agg(format('j.%I', col), ', ') FROM unnest(p_join_columns) AS col);

  -- Build search clause (searches on join table columns)
  IF p_search IS NOT NULL AND array_length(p_search_columns, 1) > 0 THEN
    v_search_where := ' AND (' || (
      SELECT string_agg(format('j.%I ILIKE %L', col, '%' || p_search || '%'), ' OR ')
      FROM unnest(p_search_columns) AS col
    ) || ')';
  END IF;

  -- Build filter clauses
  IF p_filters IS NOT NULL THEN
    FOR v_filter_key, v_filter_val IN SELECT * FROM jsonb_each(p_filters) LOOP
      IF jsonb_typeof(v_filter_val) = 'string' THEN
        v_where := v_where || format(' AND m.%I = %L', v_filter_key, v_filter_val #>> '{}');
      ELSIF jsonb_typeof(v_filter_val) = 'boolean' THEN
        v_where := v_where || format(' AND m.%I = %s', v_filter_key, v_filter_val);
      END IF;
    END LOOP;
  END IF;

  -- Get data
  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json)
     FROM (
       SELECT m.*, %s
       FROM public.%I m
       LEFT JOIN saas_core.%I j ON j.id = m.%I
       WHERE m.tenant_id = $1 %s %s
       ORDER BY m.%I %s
       LIMIT $2 OFFSET $3
     ) t',
    v_join_select, p_main_table, p_join_table, p_fk_column,
    v_where, v_search_where,
    p_sort_column, p_sort_dir
  ) INTO v_data USING p_tenant_id, p_limit, p_offset;

  -- Get count
  EXECUTE format(
    'SELECT COUNT(*)
     FROM public.%I m
     LEFT JOIN saas_core.%I j ON j.id = m.%I
     WHERE m.tenant_id = $1 %s %s',
    p_main_table, p_join_table, p_fk_column,
    v_where, v_search_where
  ) INTO v_total USING p_tenant_id;

  RETURN json_build_object('data', v_data, 'total', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.table_join TO authenticated;
