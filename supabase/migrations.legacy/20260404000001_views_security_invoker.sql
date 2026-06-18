-- Fix tenant data leak: views over saas_core tables bypass RLS because they
-- run with the view-owner's (postgres) privileges by default.
-- Setting security_invoker = true makes the view execute with the calling
-- user's permissions, so saas_core RLS policies on persons, orders, etc.
-- are properly enforced.

ALTER VIEW public.v_leads SET (security_invoker = true);
ALTER VIEW public.v_deals SET (security_invoker = true);
ALTER VIEW public.v_clients SET (security_invoker = true);
ALTER VIEW public.v_staff SET (security_invoker = true);
ALTER VIEW public.v_stock_movements SET (security_invoker = true);
ALTER VIEW public.v_financial_movements SET (security_invoker = true);
