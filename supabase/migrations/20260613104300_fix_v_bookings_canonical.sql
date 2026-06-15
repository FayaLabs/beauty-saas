-- ============================================================================
-- Fix v_bookings drift: canonical booking read model with legacy-compatible
-- columns for older SDK consumers.
-- ============================================================================

DROP VIEW IF EXISTS public.v_bookings;
CREATE OR REPLACE VIEW public.v_bookings AS
SELECT
  b.id,
  b.tenant_id,
  b.kind,
  b.starts_at,
  b.ends_at,
  b.status,
  b.notes,
  b.order_id,
  b.location_id,
  b.metadata,

  b.party_id AS client_id,
  client.name AS client_name,
  client.phone AS client_phone,
  client.email AS client_email,
  client.avatar_url AS client_avatar_url,

  b.assignee_id AS professional_id,
  prof.name AS professional_name,
  prof.avatar_url AS professional_avatar_url,

  loc.name AS location_name,

  o.total AS order_total,
  o.status AS order_status,
  o.reference_number,
  o.status AS stage,
  o.metadata->>'direction' AS direction,

  (
    SELECT json_agg(
      json_build_object(
        'id', bi.id,
        'serviceId', bi.service_id,
        'name', bi.name,
        'durationMinutes', bi.duration_minutes,
        'price', bi.price,
        'assigneeId', bi.assignee_id
      ) ORDER BY bi.sort_order
    )
    FROM saas_core.booking_items bi
    WHERE bi.booking_id = b.id
  ) AS services,

  COALESCE(
    (SELECT SUM(bi2.duration_minutes) FROM saas_core.booking_items bi2 WHERE bi2.booking_id = b.id),
    EXTRACT(EPOCH FROM (b.ends_at - b.starts_at)) / 60
  )::integer AS total_duration_minutes,

  b.created_at,
  b.updated_at

FROM saas_core.bookings b
LEFT JOIN saas_core.persons client ON client.id = b.party_id
LEFT JOIN saas_core.persons prof ON prof.id = b.assignee_id
LEFT JOIN saas_core.locations loc ON loc.id = b.location_id
LEFT JOIN saas_core.orders o ON o.id = b.order_id;
ALTER VIEW public.v_bookings SET (security_invoker = on);
GRANT SELECT ON public.v_bookings TO authenticated, service_role, anon;
CREATE INDEX IF NOT EXISTS bookings_range_idx
  ON saas_core.bookings (tenant_id, assignee_id, starts_at, ends_at)
  WHERE status NOT IN ('cancelled', 'no_show');
CREATE OR REPLACE FUNCTION public.check_booking_conflict(
  p_tenant_id uuid,
  p_assignee_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM saas_core.bookings
    WHERE tenant_id = p_tenant_id
      AND assignee_id = p_assignee_id
      AND status NOT IN ('cancelled', 'no_show')
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND starts_at < p_ends_at
      AND ends_at > p_starts_at
  );
$$;
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_tenant_id uuid,
  p_assignee_id uuid,
  p_date date,
  p_duration_minutes integer,
  p_slot_interval integer DEFAULT 30,
  p_schedule_kind text DEFAULT 'working_hours'
) RETURNS TABLE(slot_start timestamptz, slot_end timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_day_of_week smallint;
  v_has_date_override boolean;
  v_schedule RECORD;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date)::smallint;

  SELECT EXISTS (
    SELECT 1
    FROM saas_core.schedules s
    WHERE s.tenant_id = p_tenant_id
      AND s.assignee_id = p_assignee_id
      AND s.kind = p_schedule_kind
      AND s.specific_date = p_date
  ) INTO v_has_date_override;

  FOR v_schedule IN
    SELECT s.starts_at AS sched_start, s.ends_at AS sched_end
    FROM saas_core.schedules s
    WHERE s.tenant_id = p_tenant_id
      AND s.assignee_id = p_assignee_id
      AND s.kind = p_schedule_kind
      AND s.is_active = true
      AND (
        (v_has_date_override AND s.specific_date = p_date)
        OR (NOT v_has_date_override AND s.day_of_week = v_day_of_week AND s.specific_date IS NULL)
      )
    ORDER BY s.starts_at
  LOOP
    v_slot_start := p_date + v_schedule.sched_start;
    LOOP
      v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::interval;
      EXIT WHEN v_slot_end > p_date + v_schedule.sched_end;

      IF NOT public.check_booking_conflict(
        p_tenant_id, p_assignee_id, v_slot_start, v_slot_end
      ) THEN
        slot_start := v_slot_start;
        slot_end := v_slot_end;
        RETURN NEXT;
      END IF;

      v_slot_start := v_slot_start + (p_slot_interval || ' minutes')::interval;
    END LOOP;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_booking_conflict TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_available_slots TO authenticated, service_role;
