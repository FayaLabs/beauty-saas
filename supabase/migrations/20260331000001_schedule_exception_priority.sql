-- Fix get_available_slots to prioritize specific_date overrides over day_of_week
-- When a professional has a date exception, the weekly schedule should be ignored for that date.

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

  -- Check if a specific_date override exists for this date
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
        -- If a date override exists, only use specific_date entries
        -- Otherwise fall back to day_of_week
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
