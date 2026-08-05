-- ============================================================================
-- Analytics: register the salon read models + flags for rate metrics
-- ----------------------------------------------------------------------------
-- The engine (plg_analytics_read_models, analytics_assert_column, analytics_run)
-- ships in the SDK as packages/db/migrations/024_analytics_engine.sql. It is
-- domain-free: it aggregates any read model that is REGISTERED, and refuses
-- anything that is not. This migration registers the salon's own rep_* views so
-- the Analytics dashboard can group and bucket them.
--
-- A note on which view means what, because the two are easy to confuse and the
-- difference is money:
--
--   rep_appointments_by_period  EVERY booking, cancelled and no-show included.
--                               Correct for counting appointments. WRONG for
--                               revenue — summing it bills the client for the
--                               haircut they never turned up for.
--   rep_revenue_by_service      already excludes cancelled/no_show. This is the
--   rep_revenue_by_professional revenue spine.
--
-- Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Appointment flags.
--
--    "Cancellation rate" and "no-show rate" are the two numbers a salon owner
--    actually runs on, and neither is expressible over a text `status` column:
--    the aggregate vocabulary is sum/avg/count, not CASE. Projecting each status
--    as a 0/1 integer turns a rate into one sum over one column — which is also
--    what lets the KPI and the report behind it stay the same query.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.rep_appointments_metrics
WITH (security_invoker = true) AS
SELECT
  a.tenant_id,
  a.booking_id,
  a.date,
  a.starts_at,
  a.client_id,
  a.client_name,
  a.professional_id,
  a.professional_name,
  a.service_name,
  a.status,
  a.revenue,
  1                                                                    AS appointment_count,
  (CASE WHEN a.status = 'cancelled'   THEN 1 ELSE 0 END)               AS is_cancelled,
  (CASE WHEN a.status = 'no_show'     THEN 1 ELSE 0 END)               AS is_no_show,
  (CASE WHEN a.status = 'completed'   THEN 1 ELSE 0 END)               AS is_completed,
  (CASE WHEN a.status = 'confirmed'   THEN 1 ELSE 0 END)               AS is_confirmed,
  -- Anything not cancelled and not a no-show is a booking the chair was
  -- actually held for; this is the denominator honest rates divide by.
  (CASE WHEN a.status NOT IN ('cancelled', 'no_show') THEN 1 ELSE 0 END) AS is_effective,
  -- Revenue that survived: the same rule rep_revenue_by_* already applies, so
  -- a revenue figure taken from here matches the revenue reports exactly.
  (CASE WHEN a.status NOT IN ('cancelled', 'no_show') THEN a.revenue ELSE 0 END)::numeric AS effective_revenue,
  (CASE WHEN a.status IN ('cancelled', 'no_show') THEN a.revenue ELSE 0 END)::numeric     AS lost_revenue,
  a.created_at,
  a.updated_at
FROM public.rep_appointments_by_period a;

GRANT SELECT ON public.rep_appointments_metrics TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Register the read models.
--
--    date_column is declared HERE rather than taken from the caller: the read
--    model is the authority on which of its columns means "when this happened",
--    and letting a client redirect the range onto some other timestamp is both
--    a wrong-answer bug and an injection surface.
--
--    rep_client_frequency has no event date at all — it is a per-client
--    snapshot. It gets updated_at so the column reference is always valid, and
--    its cards pass no window, so the value is never actually used.
-- ----------------------------------------------------------------------------
INSERT INTO public.plg_analytics_read_models (name, date_column, tenant_column, description) VALUES
  ('rep_appointments_metrics',            'date',       'tenant_id', 'Every booking with 0/1 status flags — the rate metrics spine'),
  ('rep_appointments_by_period',          'date',       'tenant_id', 'Every booking; includes cancelled and no-show'),
  ('rep_revenue_by_service',              'date',       'tenant_id', 'Revenue per service per day, excluding cancelled/no-show'),
  ('rep_revenue_by_professional',         'date',       'tenant_id', 'Revenue per professional per day, excluding cancelled/no-show'),
  ('rep_new_clients',                     'date',       'tenant_id', 'Client acquisition by first booking date'),
  ('rep_client_frequency',                'updated_at', 'tenant_id', 'Per-client visit/spend snapshot — no event date'),
  ('rep_financial_accounting_dimensions', 'date',       'tenant_id', 'Invoice totals by account and cost centre'),
  ('rep_confirmation_queue',              'date',       'tenant_id', 'Bookings awaiting confirmation'),
  ('rep_waitlist_queue',                  'date',       'tenant_id', 'Waitlist requests and their conversion')
ON CONFLICT (name) DO UPDATE
  SET date_column   = EXCLUDED.date_column,
      tenant_column = EXCLUDED.tenant_column,
      description   = EXCLUDED.description;
