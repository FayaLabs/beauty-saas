-- Seed for the core platform tables (plans + RBAC catalog).
--
-- Schema note: the legacy saas_core schema was dissolved into public by
-- @fayz-ai/db; all references here target public (verified against the live
-- pool 2026-07-21).
--
-- These tables are CREATED by @fayz-ai/db migrations but were never seeded,
-- so plans/permissions/role_permissions ship empty. This file backfills the
-- canonical catalog the SDK shell consumes:
--   * public.plans            -> billing plan tiers (useBilling.fetchPlans)
--   * public.permissions      -> RBAC permission catalog (category.action ids)
--   * public.role_permissions -> default grants per role (owner is implicit)
--
-- Permission ids use the `category.action` form that buildPermissionProfiles()
-- parses (org adapter). Supported actions: read, create, update, manage,
-- delete, configure, invite. Owner implicitly gets ALL permissions, so only
-- admin/manager/staff/viewer need explicit role_permissions rows.
--
-- Idempotent: safe to re-run (ON CONFLICT upserts).

-- ---------------------------------------------------------------------------
-- Plans (whole-currency units; rendered directly in the UI)
--
-- MIRROR of src/config/billing.ts (the source of truth): same ids
-- (free/pro/business — the vocabulary tenants.plan uses), same prices, and the
-- same `entitlements` structure the client resolves (PlanEntitlements:
-- {features: {id: bool}, limits: {key: number}}, -1 = unlimited). The pool copy
-- exists for SERVER-side enforcement (agent RPC guard reads
-- tenants.plan → plans.entitlements). TRANSITIONAL writer: once the Fayz
-- platform upserts this catalog on `fayz manifest sync`, drop this block.
-- ---------------------------------------------------------------------------
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS entitlements jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

INSERT INTO public.plans (id, name, description, vertical_id, price_monthly, price_yearly, features, is_popular, sort_order, entitlements)
VALUES
  ('free', 'Grátis', 'Comece grátis — sem cartão.', NULL, 0, 0,
   '["Até 2 profissionais","Até 100 clientes","Até 25 produtos","Relatórios básicos","Suporte por e-mail"]'::jsonb,
   false, 0,
   '{"features": {"marketing": false, "reports": false, "fin_reconciliation": false},
     "limits": {"users": 2, "locations": 1, "clients": 100, "bookings_month": 150, "products": 25}}'::jsonb),
  ('pro', 'Profissional', 'Para salões em crescimento.', NULL, 79, 759,
   '["Até 10 profissionais","Agendamentos ilimitados","Análises avançadas","Lembretes por SMS","Página de agendamento online","Suporte prioritário"]'::jsonb,
   true, 1,
   '{"features": {"marketing": true, "reports": true, "fin_reconciliation": true},
     "limits": {"users": 10, "locations": 1, "clients": -1, "bookings_month": -1, "products": -1}}'::jsonb),
  ('business', 'Empresarial', 'Para negócios multi-unidades.', NULL, 199, 1909,
   '["Profissionais ilimitados","Multi-unidades","Marca personalizada","Acesso à API","Gerente de conta dedicado","Integrações personalizadas"]'::jsonb,
   false, 2,
   '{"features": {"marketing": true, "reports": true, "fin_reconciliation": true},
     "limits": {"users": -1, "locations": -1, "clients": -1, "bookings_month": -1, "products": -1}}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  vertical_id = EXCLUDED.vertical_id,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  sort_order = EXCLUDED.sort_order,
  entitlements = EXCLUDED.entitlements;

-- ---------------------------------------------------------------------------
-- Permissions catalog (id = category.action)
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (id, category, description)
VALUES
  ('tenant.manage',        'tenant',    'Manage organization profile and settings'),
  ('team.read',            'team',      'View team members'),
  ('team.invite',          'team',      'Invite team members'),
  ('team.manage',          'team',      'Add, edit and remove team members'),
  ('team.manage_roles',    'team',      'Assign roles and manage permissions'),
  ('billing.read',         'billing',   'View billing, plan and invoices'),
  ('billing.manage',       'billing',   'Manage subscription and payment methods'),
  ('settings.read',        'settings',  'View workspace settings'),
  ('settings.update',      'settings',  'Update workspace settings'),
  ('locations.read',       'locations', 'View locations'),
  ('locations.manage',     'locations', 'Create, edit and remove locations'),
  ('plugins.read',         'plugins',   'View installed plugins'),
  ('plugins.manage',       'plugins',   'Enable, disable and configure plugins'),
  ('audit.read',           'audit',     'View the audit log')
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- Default role grants (owner implicit = all permissions, no rows needed)
--   admin   -> full operational control (mirrors owner)
--   manager -> read across the board + manage day-to-day content
--   staff   -> read team & settings (operate inside the app)
--   viewer  -> read team only
-- actions[] mirrors the action in the permission id (not used by grant builder,
-- but kept consistent for clarity / future use).
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission_id, actions)
VALUES
  -- admin: everything
  ('admin', 'tenant.manage',     '{manage}'),
  ('admin', 'team.read',         '{read}'),
  ('admin', 'team.invite',       '{invite}'),
  ('admin', 'team.manage',       '{manage}'),
  ('admin', 'team.manage_roles', '{manage}'),
  ('admin', 'billing.read',      '{read}'),
  ('admin', 'billing.manage',    '{manage}'),
  ('admin', 'settings.read',     '{read}'),
  ('admin', 'settings.update',   '{update}'),
  ('admin', 'locations.read',    '{read}'),
  ('admin', 'locations.manage',  '{manage}'),
  ('admin', 'plugins.read',      '{read}'),
  ('admin', 'plugins.manage',    '{manage}'),
  ('admin', 'audit.read',        '{read}'),
  -- manager: reads + locations management
  ('manager', 'team.read',       '{read}'),
  ('manager', 'billing.read',    '{read}'),
  ('manager', 'settings.read',   '{read}'),
  ('manager', 'locations.read',  '{read}'),
  ('manager', 'locations.manage','{manage}'),
  ('manager', 'plugins.read',    '{read}'),
  ('manager', 'audit.read',      '{read}'),
  -- staff: operate inside the app
  ('staff', 'team.read',         '{read}'),
  ('staff', 'settings.read',     '{read}'),
  ('staff', 'locations.read',    '{read}'),
  -- viewer: minimal visibility
  ('viewer', 'team.read',        '{read}')
ON CONFLICT (role, permission_id) DO UPDATE SET
  actions = EXCLUDED.actions;

-- ===========================================================================
-- BEAUTY SALON — granular business permission catalog + domain roles
-- ---------------------------------------------------------------------------
-- App-owned (this is a dogfood app; the SDK is domain-agnostic). Turns the old
-- one-permission-per-plugin model into per-submodule permissions grouped by
-- module, and seeds salon roles (proprietário/administrador/secretária/
-- profissional/marketing/financeiro). `owner` stays implicit-all (no rows).
--
-- Every business category gets all four actions in the CATALOG so the matrix is
-- fully editable (toggling an action writes a tenant_role_overrides row that FKs
-- to permissions.id — a missing id would fail the save). Role DEFAULTS below
-- grant only the sensible subset per role.
-- ===========================================================================
INSERT INTO public.permissions (id, category, description)
SELECT c.category || '.' || a.action, c.category, c.label || ' — ' || a.action
FROM (VALUES
  ('dashboard',          'Dashboard'),
  ('appointments',       'Calendar / Agenda'),
  ('agenda_waitlist',    'Waitlist'),
  ('agenda_schedules',   'Working hours'),
  ('agenda_settings',    'Agenda settings'),
  ('clients',            'Clients'),
  ('services',           'Services'),
  ('inventory',          'Inventory (module access)'),
  ('inv_products',       'Products'),
  ('inv_stock',          'Stock movements'),
  ('inv_settings',       'Inventory registry'),
  ('sales',              'Sales (module access)'),
  ('crm_pipeline',       'Sales pipeline'),
  ('crm_leads',          'Leads'),
  ('crm_quotes',         'Quotes'),
  ('crm_activities',     'Activities'),
  ('financial',          'Financial (module access)'),
  ('fin_receivables',    'Accounts receivable'),
  ('fin_payables',       'Accounts payable'),
  ('fin_cashbox',        'Cash register (open/close)'),
  ('fin_statements',     'Statements'),
  ('fin_commissions',    'Commissions'),
  ('fin_cards',          'Cards'),
  ('fin_reconciliation', 'Reconciliation'),
  ('fin_settings',       'Financial registry'),
  ('marketing',          'Marketing (module access)'),
  ('mkt_campaigns',      'Campaigns'),
  ('mkt_channels',       'Channels'),
  ('mkt_funnel',         'Funnel'),
  ('reports',            'Reports (module access)'),
  ('reports_operations', 'Operational reports'),
  ('reports_financial',  'Financial reports'),
  ('reports_clients',    'Client reports')
) AS c(category, label)
CROSS JOIN (VALUES ('read'), ('create'), ('update'), ('delete')) AS a(action)
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- administrador — full operational control (all business + team/settings/
-- locations/plugins/audit). NOT the billing owner (owner keeps billing).
-- Generated from the catalog so it always covers every business permission.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission_id, actions)
SELECT 'administrador', id, ARRAY[split_part(id, '.', 2)]
FROM public.permissions
WHERE category NOT IN ('tenant', 'billing')
ON CONFLICT (role, permission_id) DO UPDATE SET actions = EXCLUDED.actions;

-- ---------------------------------------------------------------------------
-- Limited domain roles. permission_id already encodes the action; actions[] is
-- cosmetic (the grant builder keys off permission_id only).
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission_id, actions)
VALUES
  -- secretária — front desk: agenda + clients (full), checkout + caixa, capture
  ('secretaria', 'dashboard.read',          '{read}'),
  ('secretaria', 'appointments.read',       '{read}'),
  ('secretaria', 'appointments.create',     '{create}'),
  ('secretaria', 'appointments.update',     '{update}'),
  ('secretaria', 'appointments.delete',     '{delete}'),
  ('secretaria', 'agenda_waitlist.read',    '{read}'),
  ('secretaria', 'agenda_waitlist.create',  '{create}'),
  ('secretaria', 'agenda_waitlist.update',  '{update}'),
  ('secretaria', 'agenda_schedules.read',   '{read}'),
  ('secretaria', 'agenda_settings.read',    '{read}'),
  ('secretaria', 'clients.read',            '{read}'),
  ('secretaria', 'clients.create',          '{create}'),
  ('secretaria', 'clients.update',          '{update}'),
  ('secretaria', 'clients.delete',          '{delete}'),
  ('secretaria', 'services.read',           '{read}'),
  ('secretaria', 'inventory.read',          '{read}'),
  ('secretaria', 'inv_products.read',       '{read}'),
  ('secretaria', 'sales.read',              '{read}'),
  ('secretaria', 'crm_leads.read',          '{read}'),
  ('secretaria', 'crm_leads.create',        '{create}'),
  ('secretaria', 'crm_quotes.read',         '{read}'),
  ('secretaria', 'crm_quotes.create',       '{create}'),
  ('secretaria', 'financial.read',          '{read}'),
  ('secretaria', 'fin_receivables.read',    '{read}'),
  ('secretaria', 'fin_receivables.create',  '{create}'),
  ('secretaria', 'fin_cashbox.read',        '{read}'),
  ('secretaria', 'fin_cashbox.create',      '{create}'),
  ('secretaria', 'fin_cashbox.update',      '{update}'),
  ('secretaria', 'fin_statements.read',     '{read}'),
  ('secretaria', 'reports.read',            '{read}'),
  ('secretaria', 'reports_operations.read', '{read}'),

  -- profissional — stylist: own agenda + read clients/services. No financial nav.
  ('profissional', 'dashboard.read',        '{read}'),
  ('profissional', 'appointments.read',     '{read}'),
  ('profissional', 'appointments.create',   '{create}'),
  ('profissional', 'appointments.update',   '{update}'),
  ('profissional', 'clients.read',          '{read}'),
  ('profissional', 'services.read',         '{read}'),

  -- marketing — campaigns/channels + audience reports. No financial/agenda-edit.
  ('marketing', 'dashboard.read',           '{read}'),
  ('marketing', 'appointments.read',        '{read}'),
  ('marketing', 'clients.read',             '{read}'),
  ('marketing', 'marketing.read',           '{read}'),
  ('marketing', 'mkt_campaigns.read',       '{read}'),
  ('marketing', 'mkt_campaigns.create',     '{create}'),
  ('marketing', 'mkt_campaigns.update',     '{update}'),
  ('marketing', 'mkt_campaigns.delete',     '{delete}'),
  ('marketing', 'mkt_channels.read',        '{read}'),
  ('marketing', 'mkt_channels.update',      '{update}'),
  ('marketing', 'mkt_funnel.read',          '{read}'),
  ('marketing', 'reports.read',             '{read}'),
  ('marketing', 'reports_operations.read',  '{read}'),
  ('marketing', 'reports_clients.read',     '{read}'),

  -- financeiro / caixa — owns the financial module + financial reports.
  ('financeiro', 'dashboard.read',          '{read}'),
  ('financeiro', 'clients.read',            '{read}'),
  ('financeiro', 'financial.read',          '{read}'),
  ('financeiro', 'fin_receivables.read',    '{read}'),
  ('financeiro', 'fin_receivables.create',  '{create}'),
  ('financeiro', 'fin_receivables.update',  '{update}'),
  ('financeiro', 'fin_receivables.delete',  '{delete}'),
  ('financeiro', 'fin_payables.read',       '{read}'),
  ('financeiro', 'fin_payables.create',     '{create}'),
  ('financeiro', 'fin_payables.update',     '{update}'),
  ('financeiro', 'fin_payables.delete',     '{delete}'),
  ('financeiro', 'fin_cashbox.read',        '{read}'),
  ('financeiro', 'fin_cashbox.create',      '{create}'),
  ('financeiro', 'fin_cashbox.update',      '{update}'),
  ('financeiro', 'fin_statements.read',     '{read}'),
  ('financeiro', 'fin_commissions.read',    '{read}'),
  ('financeiro', 'fin_commissions.create',  '{create}'),
  ('financeiro', 'fin_commissions.update',  '{update}'),
  ('financeiro', 'fin_cards.read',          '{read}'),
  ('financeiro', 'fin_cards.create',        '{create}'),
  ('financeiro', 'fin_cards.update',        '{update}'),
  ('financeiro', 'fin_reconciliation.read', '{read}'),
  ('financeiro', 'fin_reconciliation.update','{update}'),
  ('financeiro', 'fin_settings.read',       '{read}'),
  ('financeiro', 'fin_settings.update',     '{update}'),
  ('financeiro', 'reports.read',            '{read}'),
  ('financeiro', 'reports_financial.read',  '{read}'),
  ('financeiro', 'reports_operations.read', '{read}')
ON CONFLICT (role, permission_id) DO UPDATE SET actions = EXCLUDED.actions;

-- ---------------------------------------------------------------------------
-- RLS: teach is_tenant_admin() the salon admin role. The SDK ships this helper
-- hardcoded to ('owner','admin'); our admin role is 'administrador'. Override
-- idempotently so administrador retains org-management RLS rights.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'administrador')
  );
$$;

-- ---------------------------------------------------------------------------
-- Custom roles: when a user duplicates a static system role and renames it, the
-- new role's identity (key/name/description) lives here; its grants live in
-- tenant_role_overrides (keyed by role = key). System roles are NOT stored here.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
ALTER TABLE public.tenant_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_roles_read ON public.tenant_roles;
CREATE POLICY tenant_roles_read ON public.tenant_roles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tenant_members m
    WHERE m.tenant_id = tenant_roles.tenant_id AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS tenant_roles_manage ON public.tenant_roles;
CREATE POLICY tenant_roles_manage ON public.tenant_roles FOR ALL
  USING (public.is_tenant_admin(tenant_roles.tenant_id))
  WITH CHECK (public.is_tenant_admin(tenant_roles.tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_roles TO authenticated;

-- ---------------------------------------------------------------------------
-- Invite acceptance — provision membership from the TRUSTED invitations table.
-- Flow: an admin creates a public.invitations row (RLS: admins only) and the
-- app fires a native magic-link (auth.signInWithOtp) to the invitee. When the
-- invitee confirms (clicks the link), this trigger matches a pending invite by
-- e-mail and inserts tenant_members with the invited role. It deliberately does
-- NOT read auth metadata (a client could forge tenant_id/role) — the invitations
-- row, written under RLS by a verified admin, is the only source of truth.
-- Also backfills public.profiles so Team/members show a real identity.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_invited_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = saas_core, public AS $$
DECLARE
  inv record;
BEGIN
  -- Always keep a profile row so members render with name/e-mail.
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

  -- Only grant membership once the e-mail is confirmed (i.e. the invite accepted).
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  FOR inv IN
    SELECT id, tenant_id, role
    FROM public.invitations
    WHERE lower(email) = lower(NEW.email)
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (inv.tenant_id, NEW.id, inv.role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = inv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_invited ON auth.users;
CREATE TRIGGER on_auth_user_invited
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_invited_user();

-- Backfill: an invitee who confirmed BEFORE this trigger existed won't get the
-- trigger retroactively (email_confirmed_at is already set). Provision any pending
-- invite whose invitee already has a confirmed auth user. Idempotent (accepted
-- invites are no longer pending, so re-runs are no-ops).
DO $$
DECLARE
  inv record;
  u   record;
BEGIN
  FOR inv IN
    SELECT id, tenant_id, role, email FROM public.invitations
    WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > now())
  LOOP
    SELECT id, email, raw_user_meta_data INTO u
    FROM auth.users
    WHERE lower(email) = lower(inv.email) AND email_confirmed_at IS NOT NULL
    LIMIT 1;

    IF u.id IS NOT NULL THEN
      INSERT INTO public.profiles (id, email, full_name)
      VALUES (u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'))
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

      INSERT INTO public.tenant_members (tenant_id, user_id, role)
      VALUES (inv.tenant_id, u.id, inv.role)
      ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

      UPDATE public.invitations SET status = 'accepted', accepted_at = now() WHERE id = inv.id;
    END IF;
  END LOOP;
END $$;
