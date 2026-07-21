-- ===========================================================================
-- BeautySoft (beauty-saas) — QA TENANT provisioning (idempotent / re-runnable)
-- ---------------------------------------------------------------------------
-- Substituir :QA_PASSWORD antes de aplicar (via envsubst/sed/perl); nunca
-- commitar senha real. O placeholder aparece como ':QA_PASSWORD' (já entre
-- aspas SQL) — o script apply-qa-tenants.sh troca o token pela senha do env.
-- ---------------------------------------------------------------------------
-- Provisiona um QA Tenant completo no pool cluster-salon-br-01 para os testes
-- e2e de QA:
--   * tenant   slug 'qa-fayz'  (QA Fayz BeautySoft, vertical beauty, plan pro)
--   * owner    qa+beauty@fayalabs.com            (membership role 'owner')
--   * restrito qa-restrito+beauty@fayalabs.com   (membership role 'secretaria')
--   * catálogo RBAC + grants — perfis do src/config/permissions.ts:
--     administrador / secretaria / profissional / marketing / financeiro
--     (owner de membership é implicit-all no SDK).
--   * seed mínimo de domínio (2 profissionais, 2 clientes, 2 serviços,
--     horários de trabalho seg-sáb 09-18, 1 agendamento futuro).
--
-- ESPECIAL — schema-aware. O pool salon pode ser (a) core-v1 no schema `public`
-- ou (b) pré core-v1 schema-scoped em `saas_core`. Cada bloco DETECTA em runtime
-- (public tem prioridade) e opera no schema encontrado via EXECUTE format().
--   * Vocabulário de ações: public => 'edit' ; saas_core => 'update'
--     (permissions.ts usa 'edit'; o catálogo saas_core histórico usa 'update').
-- dataCritical: 100% ADITIVO. Nenhum UPDATE/DELETE toca dado que não seja do
-- QA tenant (ON CONFLICT só afeta as linhas qa-fayz / usuários qa+*).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Block A — tenant + GoTrue users (owner + restricted) + memberships
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_schema text;
  v_tenant uuid;
  v_admin  uuid;
  v_restr  uuid;
BEGIN
  IF    to_regclass('public.tenants')    IS NOT NULL THEN v_schema := 'public';
  ELSIF to_regclass('saas_core.tenants') IS NOT NULL THEN v_schema := 'saas_core';
  ELSE  RAISE NOTICE 'QA: nenhuma tabela tenants (public/saas_core) — abortando bloco A'; RETURN;
  END IF;

  -- Tenant (idempotência por slug; aditivo)
  EXECUTE format($f$
    INSERT INTO %I.tenants (id, name, slug, plan, vertical_id, settings)
    VALUES ('a0000000-0000-4000-8000-000000000001','QA Fayz BeautySoft','qa-fayz',
            'pro','beauty','{"timezone":"America/Sao_Paulo"}'::jsonb)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  $f$, v_schema);
  EXECUTE format('SELECT id FROM %I.tenants WHERE slug = %L', v_schema, 'qa-fayz') INTO v_tenant;

  -- Owner user (GoTrue; schema auth é fixo)
  SELECT id INTO v_admin FROM auth.users WHERE email = 'qa+beauty@fayalabs.com';
  IF v_admin IS NULL THEN
    v_admin := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_admin, 'authenticated', 'authenticated',
      'qa+beauty@fayalabs.com', crypt(':QA_PASSWORD', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"QA Owner (BeautySoft)"}'::jsonb, now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_admin::text, v_admin,
      jsonb_build_object('sub', v_admin::text, 'email', 'qa+beauty@fayalabs.com', 'email_verified', true),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt(':QA_PASSWORD', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()) WHERE id = v_admin;
  END IF;

  -- Restricted user — role 'secretaria'
  SELECT id INTO v_restr FROM auth.users WHERE email = 'qa-restrito+beauty@fayalabs.com';
  IF v_restr IS NULL THEN
    v_restr := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_restr, 'authenticated', 'authenticated',
      'qa-restrito+beauty@fayalabs.com', crypt(':QA_PASSWORD', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"QA Secretaria (BeautySoft)"}'::jsonb, now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_restr::text, v_restr,
      jsonb_build_object('sub', v_restr::text, 'email', 'qa-restrito+beauty@fayalabs.com', 'email_verified', true),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt(':QA_PASSWORD', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()) WHERE id = v_restr;
  END IF;

  -- Memberships (no schema detectado)
  EXECUTE format($f$
    INSERT INTO %I.tenant_members (tenant_id, user_id, role) VALUES (%L, %L, 'owner')
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role
  $f$, v_schema, v_tenant, v_admin);
  EXECUTE format($f$
    INSERT INTO %I.tenant_members (tenant_id, user_id, role) VALUES (%L, %L, 'secretaria')
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role
  $f$, v_schema, v_tenant, v_restr);
END $$;

-- ---------------------------------------------------------------------------
-- Block B — RBAC catalog + default role grants (global; schema-aware; guarded)
--   Vocabulário: public => 'edit', saas_core => 'update' (token 'edit' abaixo é
--   traduzido em runtime). owner é implicit-all no SDK (sem linhas).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_schema  text;
  v_editword text;
BEGIN
  IF    to_regclass('public.permissions')    IS NOT NULL THEN v_schema := 'public';    v_editword := 'edit';
  ELSIF to_regclass('saas_core.permissions') IS NOT NULL THEN v_schema := 'saas_core'; v_editword := 'update';
  ELSE  RAISE NOTICE 'QA: nenhuma tabela permissions (public/saas_core) — pulando RBAC'; RETURN;
  END IF;

  -- Catálogo: cada categoria (feature id) x 4 ações (edit -> v_editword).
  EXECUTE format($f$
    INSERT INTO %I.permissions (id, category, description)
    SELECT c.category || '.' || a.action, c.category, c.label || ' — ' || a.action
    FROM (VALUES
      ('dashboard','Painel'),
      ('appointments','Agenda'),('agenda_waitlist','Lista de espera'),
      ('agenda_schedules','Horários de trabalho'),('agenda_settings','Configurações da agenda'),
      ('clients','Clientes'),('services','Serviços'),
      ('inventory','Estoque (acesso)'),('inv_products','Produtos'),
      ('inv_stock','Movimentações'),('inv_settings','Cadastros de estoque'),
      ('sales','Vendas (acesso)'),('crm_pipeline','Funil'),('crm_leads','Leads'),
      ('crm_quotes','Orçamentos'),('crm_activities','Atividades'),
      ('financial','Financeiro (acesso)'),('fin_receivables','Contas a receber'),
      ('fin_payables','Contas a pagar'),('fin_cashbox','Caixa'),('fin_statements','Extrato'),
      ('fin_commissions','Comissões'),('fin_cards','Cartões'),
      ('fin_reconciliation','Conciliação'),('fin_settings','Cadastros financeiros'),
      ('marketing','Marketing (acesso)'),('mkt_campaigns','Campanhas'),
      ('mkt_channels','Canais'),('mkt_funnel','Funil de marketing'),
      ('reports','Relatórios (acesso)'),('reports_operations','Relatórios operacionais'),
      ('reports_financial','Relatórios financeiros'),('reports_clients','Relatórios de clientes')
    ) AS c(category, label)
    CROSS JOIN (VALUES ('read'),('create'),(%L),('delete')) AS a(action)
    ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, description = EXCLUDED.description
  $f$, v_schema, v_editword);

  -- Grants por perfil (owner implicit-all, sem linhas). Token 'edit' -> v_editword.
  EXECUTE format($f$
    INSERT INTO %I.role_permissions (role, permission_id, actions)
    SELECT g.role, g.cat || '.' || (CASE act WHEN 'edit' THEN %L ELSE act END),
           ARRAY[(CASE act WHEN 'edit' THEN %L ELSE act END)]
    FROM (VALUES
      -- administrador (= ALL_BUSINESS)
      ('administrador','dashboard','{read}'::text[]),
      ('administrador','appointments','{read,create,edit,delete}'::text[]),
      ('administrador','agenda_waitlist','{read,create,edit}'::text[]),
      ('administrador','agenda_schedules','{read,edit}'::text[]),
      ('administrador','agenda_settings','{read,create,edit,delete}'::text[]),
      ('administrador','clients','{read,create,edit,delete}'::text[]),
      ('administrador','services','{read,create,edit,delete}'::text[]),
      ('administrador','inventory','{read}'::text[]),
      ('administrador','inv_products','{read,create,edit,delete}'::text[]),
      ('administrador','inv_stock','{read,create,edit}'::text[]),
      ('administrador','inv_settings','{read,create,edit,delete}'::text[]),
      ('administrador','sales','{read}'::text[]),
      ('administrador','crm_pipeline','{read,edit}'::text[]),
      ('administrador','crm_leads','{read,create,edit,delete}'::text[]),
      ('administrador','crm_quotes','{read,create,edit,delete}'::text[]),
      ('administrador','crm_activities','{read,create,edit}'::text[]),
      ('administrador','financial','{read}'::text[]),
      ('administrador','fin_receivables','{read,create,edit,delete}'::text[]),
      ('administrador','fin_payables','{read,create,edit,delete}'::text[]),
      ('administrador','fin_cashbox','{read,create,edit}'::text[]),
      ('administrador','fin_statements','{read}'::text[]),
      ('administrador','fin_commissions','{read,create,edit}'::text[]),
      ('administrador','fin_cards','{read,create,edit}'::text[]),
      ('administrador','fin_reconciliation','{read,edit}'::text[]),
      ('administrador','fin_settings','{read,create,edit,delete}'::text[]),
      ('administrador','marketing','{read}'::text[]),
      ('administrador','mkt_campaigns','{read,create,edit,delete}'::text[]),
      ('administrador','mkt_channels','{read,edit}'::text[]),
      ('administrador','mkt_funnel','{read}'::text[]),
      ('administrador','reports','{read}'::text[]),
      ('administrador','reports_operations','{read}'::text[]),
      ('administrador','reports_financial','{read}'::text[]),
      ('administrador','reports_clients','{read}'::text[]),
      -- secretaria (usuário restrito de QA)
      ('secretaria','dashboard','{read}'::text[]),
      ('secretaria','appointments','{read,create,edit,delete}'::text[]),
      ('secretaria','agenda_waitlist','{read,create,edit}'::text[]),
      ('secretaria','agenda_schedules','{read}'::text[]),
      ('secretaria','agenda_settings','{read}'::text[]),
      ('secretaria','clients','{read,create,edit,delete}'::text[]),
      ('secretaria','services','{read}'::text[]),
      ('secretaria','inventory','{read}'::text[]),
      ('secretaria','inv_products','{read}'::text[]),
      ('secretaria','sales','{read}'::text[]),
      ('secretaria','crm_leads','{read,create}'::text[]),
      ('secretaria','crm_quotes','{read,create}'::text[]),
      ('secretaria','financial','{read}'::text[]),
      ('secretaria','fin_receivables','{read,create}'::text[]),
      ('secretaria','fin_cashbox','{read,create,edit}'::text[]),
      ('secretaria','fin_statements','{read}'::text[]),
      ('secretaria','reports','{read}'::text[]),
      ('secretaria','reports_operations','{read}'::text[]),
      -- profissional
      ('profissional','dashboard','{read}'::text[]),
      ('profissional','appointments','{read,create,edit}'::text[]),
      ('profissional','clients','{read}'::text[]),
      ('profissional','services','{read}'::text[]),
      -- marketing
      ('marketing','dashboard','{read}'::text[]),
      ('marketing','appointments','{read}'::text[]),
      ('marketing','clients','{read}'::text[]),
      ('marketing','marketing','{read}'::text[]),
      ('marketing','mkt_campaigns','{read,create,edit,delete}'::text[]),
      ('marketing','mkt_channels','{read,edit}'::text[]),
      ('marketing','mkt_funnel','{read}'::text[]),
      ('marketing','reports','{read}'::text[]),
      ('marketing','reports_operations','{read}'::text[]),
      ('marketing','reports_clients','{read}'::text[]),
      -- financeiro
      ('financeiro','dashboard','{read}'::text[]),
      ('financeiro','clients','{read}'::text[]),
      ('financeiro','financial','{read}'::text[]),
      ('financeiro','fin_receivables','{read,create,edit,delete}'::text[]),
      ('financeiro','fin_payables','{read,create,edit,delete}'::text[]),
      ('financeiro','fin_cashbox','{read,create,edit}'::text[]),
      ('financeiro','fin_statements','{read}'::text[]),
      ('financeiro','fin_commissions','{read,create,edit}'::text[]),
      ('financeiro','fin_cards','{read,create,edit}'::text[]),
      ('financeiro','fin_reconciliation','{read,edit}'::text[]),
      ('financeiro','fin_settings','{read,edit}'::text[]),
      ('financeiro','reports','{read}'::text[]),
      ('financeiro','reports_financial','{read}'::text[]),
      ('financeiro','reports_operations','{read}'::text[])
    ) AS g(role, cat, acts)
    CROSS JOIN LATERAL unnest(g.acts) AS act
    ON CONFLICT (role, permission_id) DO UPDATE SET actions = EXCLUDED.actions
  $f$, v_schema, v_editword, v_editword);
END $$;

-- ---------------------------------------------------------------------------
-- Block C — domain seed no QA tenant (schema-aware; guarded; 100% aditivo)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_schema text;
  v_tenant uuid;
  v_prof1  uuid;
  v_prof2  uuid;
  v_cli1   uuid;
  v_appt_start timestamptz := date_trunc('day', now()) + interval '2 days' + interval '10 hours';
BEGIN
  IF    to_regclass('public.people')    IS NOT NULL THEN v_schema := 'public';
  ELSIF to_regclass('saas_core.people') IS NOT NULL THEN v_schema := 'saas_core';
  ELSE  RAISE NOTICE 'QA: nenhuma tabela people (public/saas_core) — pulando seed de domínio'; RETURN;
  END IF;

  EXECUTE format('SELECT id FROM %I.tenants WHERE slug = %L', v_schema, 'qa-fayz') INTO v_tenant;
  IF v_tenant IS NULL THEN RAISE NOTICE 'QA: tenant qa-fayz ausente no schema %', v_schema; RETURN; END IF;

  -- Profissionais (people kind='staff')
  EXECUTE format($f$
    INSERT INTO %I.people (tenant_id, kind, name, email, is_active)
    SELECT %L, 'staff', d.name, d.email, true
    FROM (VALUES ('QA Cabeleireira Marina','qa.marina@fayalabs.com'),
                 ('QA Barbeiro Carlos','qa.carlos@fayalabs.com')) AS d(name, email)
    WHERE NOT EXISTS (SELECT 1 FROM %I.people p
      WHERE p.tenant_id = %L AND p.kind = 'staff' AND lower(p.name) = lower(d.name))
  $f$, v_schema, v_tenant, v_schema, v_tenant);

  -- Clientes (people kind='customer')
  EXECUTE format($f$
    INSERT INTO %I.people (tenant_id, kind, name, email, is_active)
    SELECT %L, 'customer', c.name, c.email, true
    FROM (VALUES ('QA Cliente Um','qa.cliente1@fayalabs.com'),
                 ('QA Cliente Dois','qa.cliente2@fayalabs.com')) AS c(name, email)
    WHERE NOT EXISTS (SELECT 1 FROM %I.people p
      WHERE p.tenant_id = %L AND p.kind = 'customer' AND lower(p.name) = lower(c.name))
  $f$, v_schema, v_tenant, v_schema, v_tenant);

  EXECUTE format('SELECT id FROM %I.people WHERE tenant_id = %L AND kind = %L AND name = %L',
    v_schema, v_tenant, 'staff', 'QA Cabeleireira Marina') INTO v_prof1;
  EXECUTE format('SELECT id FROM %I.people WHERE tenant_id = %L AND kind = %L AND name = %L',
    v_schema, v_tenant, 'staff', 'QA Barbeiro Carlos') INTO v_prof2;
  EXECUTE format('SELECT id FROM %I.people WHERE tenant_id = %L AND kind = %L AND name = %L',
    v_schema, v_tenant, 'customer', 'QA Cliente Um') INTO v_cli1;

  -- Serviços
  IF to_regclass(v_schema || '.services') IS NOT NULL THEN
    EXECUTE format($f$
      INSERT INTO %I.services (tenant_id, name, description, price, duration_minutes, currency, is_active)
      SELECT %L, s.name, s.name, s.price, s.mins, 'BRL', true
      FROM (VALUES ('QA Corte Feminino', 80, 45), ('QA Manicure', 50, 40)) AS s(name, price, mins)
      WHERE NOT EXISTS (SELECT 1 FROM %I.services x
        WHERE x.tenant_id = %L AND lower(x.name) = lower(s.name))
    $f$, v_schema, v_tenant, v_schema, v_tenant);
  END IF;

  -- Horários de trabalho (schedules kind='working_hours', seg-sáb 09-18)
  IF to_regclass(v_schema || '.schedules') IS NOT NULL AND v_prof1 IS NOT NULL THEN
    EXECUTE format($f$
      INSERT INTO %I.schedules (tenant_id, kind, assignee_id, day_of_week, starts_at, ends_at, is_active)
      SELECT %L, 'working_hours', pr.id, dow, time '09:00', time '18:00', true
      FROM (VALUES (%L::uuid), (%L::uuid)) AS pr(id)
      CROSS JOIN generate_series(1,6) AS dow
      WHERE pr.id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM %I.schedules x
          WHERE x.tenant_id = %L AND x.assignee_id = pr.id
            AND x.kind = 'working_hours' AND x.day_of_week = dow)
    $f$, v_schema, v_tenant, v_prof1, v_prof2, v_schema, v_tenant);
  END IF;

  -- 1 agendamento futuro
  IF to_regclass(v_schema || '.appointments') IS NOT NULL AND v_cli1 IS NOT NULL AND v_prof1 IS NOT NULL THEN
    EXECUTE format($f$
      INSERT INTO %I.appointments (tenant_id, kind, party_id, assignee_id, starts_at, ends_at, status, notes)
      SELECT %L, 'appointment', %L, %L, %L::timestamptz, %L::timestamptz + interval '45 minutes',
             'scheduled', 'QA e2e appointment'
      WHERE NOT EXISTS (SELECT 1 FROM %I.appointments x
        WHERE x.tenant_id = %L AND x.notes = 'QA e2e appointment')
    $f$, v_schema, v_tenant, v_cli1, v_prof1, v_appt_start, v_appt_start, v_schema, v_tenant);
  END IF;
END $$;

-- ===========================================================================
-- Verificação (rode manualmente; troque <schema> por public OU saas_core):
--   SELECT id, name, slug, plan, vertical_id, settings FROM <schema>.tenants WHERE slug='qa-fayz';
--   SELECT email FROM auth.users WHERE email IN ('qa+beauty@fayalabs.com','qa-restrito+beauty@fayalabs.com');
--   SELECT m.role, u.email FROM <schema>.tenant_members m JOIN auth.users u ON u.id=m.user_id
--     WHERE m.tenant_id=(SELECT id FROM <schema>.tenants WHERE slug='qa-fayz');
--   SELECT role, count(*) FROM <schema>.role_permissions
--     WHERE role IN ('administrador','secretaria','profissional','marketing','financeiro') GROUP BY role;
--   SELECT kind, count(*) FROM <schema>.people WHERE tenant_id=(SELECT id FROM <schema>.tenants WHERE slug='qa-fayz') GROUP BY kind;
--   SELECT count(*) services  FROM <schema>.services     WHERE tenant_id=(SELECT id FROM <schema>.tenants WHERE slug='qa-fayz');
--   SELECT count(*) schedules FROM <schema>.schedules    WHERE tenant_id=(SELECT id FROM <schema>.tenants WHERE slug='qa-fayz');
--   SELECT count(*) appts     FROM <schema>.appointments WHERE tenant_id=(SELECT id FROM <schema>.tenants WHERE slug='qa-fayz');
-- ===========================================================================
