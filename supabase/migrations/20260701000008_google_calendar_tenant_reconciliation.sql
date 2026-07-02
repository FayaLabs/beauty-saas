-- Tenant-scoped claim used by authenticated manual reconciliation.
CREATE OR REPLACE FUNCTION public.claim_google_calendar_outbox_for_tenant(
  p_tenant_id uuid,
  p_limit integer DEFAULT 25
)
RETURNS SETOF public.calendar_event_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, saas_core
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND p_tenant_id NOT IN (SELECT saas_core.user_tenant_ids()) THEN
    RAISE EXCEPTION 'tenant access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.calendar_event_outbox
     WHERE tenant_id = p_tenant_id
       AND ((status = 'pending' AND available_at <= now())
         OR (status = 'processing' AND locked_at < now() - interval '5 minutes'))
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
     LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE public.calendar_event_outbox o
     SET status = 'processing', locked_at = now(), attempts = attempts + 1
    FROM candidates c WHERE o.id = c.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_google_calendar_outbox_for_tenant(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_google_calendar_outbox_for_tenant(uuid, integer) TO authenticated, service_role;
