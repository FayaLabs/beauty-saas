-- SQL functions that do cross-schema JOINs
-- Called via supabase.rpc() — single network call, proper SQL JOIN
-- Conditional: only created if the base table exists

-- =============================================================
-- Clients: public.clients JOIN saas_core.persons
-- =============================================================
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients') THEN
  EXECUTE '
    CREATE OR REPLACE FUNCTION public.get_clients(
      p_tenant_id uuid,
      p_search text DEFAULT NULL,
      p_limit int DEFAULT 50,
      p_offset int DEFAULT 0
    ) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER AS $fn$
      SELECT json_build_object(
        ''data'', COALESCE((
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT p.id, c.tenant_id, p.name, p.email, p.phone, p.document_number,
                   p.avatar_url, p.date_of_birth, p.notes, p.is_active, p.tags,
                   c.gender, c.origin, c.visits, c.total_spent, c.last_visit,
                   c.created_at, c.updated_at
            FROM public.clients c
            JOIN saas_core.persons p ON p.id = c.person_id
            WHERE c.tenant_id = p_tenant_id
              AND (p_search IS NULL OR p.name ILIKE ''%'' || p_search || ''%'' OR p.email ILIKE ''%'' || p_search || ''%'')
            ORDER BY p.created_at DESC
            LIMIT p_limit OFFSET p_offset
          ) t
        ), ''[]''::json),
        ''total'', (
          SELECT COUNT(*)
          FROM public.clients c
          JOIN saas_core.persons p ON p.id = c.person_id
          WHERE c.tenant_id = p_tenant_id
            AND (p_search IS NULL OR p.name ILIKE ''%'' || p_search || ''%'' OR p.email ILIKE ''%'' || p_search || ''%'')
        )
      );
    $fn$;
    GRANT EXECUTE ON FUNCTION public.get_clients TO authenticated;
  ';
END IF;
END $$;

-- =============================================================
-- Staff: public.staff_members JOIN saas_core.persons
-- =============================================================
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='staff_members') THEN
  EXECUTE '
    CREATE OR REPLACE FUNCTION public.get_staff_members(
      p_tenant_id uuid,
      p_search text DEFAULT NULL,
      p_limit int DEFAULT 50,
      p_offset int DEFAULT 0
    ) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER AS $fn$
      SELECT json_build_object(
        ''data'', COALESCE((
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT p.id, sm.tenant_id, p.name, p.email, p.phone, p.document_number,
                   p.notes, p.is_active, p.tags,
                   sm.created_at, sm.updated_at
            FROM public.staff_members sm
            JOIN saas_core.persons p ON p.id = sm.person_id
            WHERE sm.tenant_id = p_tenant_id
              AND (p_search IS NULL OR p.name ILIKE ''%'' || p_search || ''%'')
            ORDER BY p.created_at DESC
            LIMIT p_limit OFFSET p_offset
          ) t
        ), ''[]''::json),
        ''total'', (
          SELECT COUNT(*)
          FROM public.staff_members sm
          JOIN saas_core.persons p ON p.id = sm.person_id
          WHERE sm.tenant_id = p_tenant_id
            AND (p_search IS NULL OR p.name ILIKE ''%'' || p_search || ''%'')
        )
      );
    $fn$;
    GRANT EXECUTE ON FUNCTION public.get_staff_members TO authenticated;
  ';
END IF;
END $$;

-- =============================================================
-- Stock movements: public.stock_movements JOIN saas_core.products
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_stock_movements(
  p_tenant_id uuid,
  p_product_id uuid DEFAULT NULL,
  p_movement_type text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT sm.*, p.name AS product_name, p.sku AS product_sku
        FROM public.stock_movements sm
        LEFT JOIN saas_core.products p ON p.id = sm.product_id
        WHERE sm.tenant_id = p_tenant_id
          AND (p_product_id IS NULL OR sm.product_id = p_product_id)
          AND (p_movement_type IS NULL OR sm.movement_type = p_movement_type)
          AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
        ORDER BY sm.movement_date DESC, sm.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) t
    ), '[]'::json),
    'total', (
      SELECT COUNT(*)
      FROM public.stock_movements sm
      LEFT JOIN saas_core.products p ON p.id = sm.product_id
      WHERE sm.tenant_id = p_tenant_id
        AND (p_product_id IS NULL OR sm.product_id = p_product_id)
        AND (p_movement_type IS NULL OR sm.movement_type = p_movement_type)
        AND (p_search IS NULL OR p.name ILIKE '%' || p_search || '%')
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_stock_movements TO authenticated;
