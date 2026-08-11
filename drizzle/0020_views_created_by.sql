-- ============================================================================
-- 0020_views_created_by.sql — as views de extensão passam a carregar o autor.
--
-- A SDK (packages/db/migrations/025_created_by.sql) põe `created_by` nas bases
-- de arquétipo e um gatilho que o preenche com `auth.uid()` na inserção. Cliente
-- e profissional, porém, não são lidos da base: são lidos de `v_clients` /
-- `v_staff`, que listam colunas uma a uma. Uma coluna nova na base não aparece
-- sozinha numa view assim — ela precisa ser nomeada aqui, ou o rodapé da ficha
-- continuaria sem saber quem cadastrou mesmo com o dado gravado.
--
-- `created_by` vem de `people` (`p.`), não da tabela de extensão: quem cria um
-- cliente cria a pessoa, e é essa inserção que o gatilho vê.
--
-- Aditivo: a coluna entra no FIM da lista, que é o que o CREATE OR REPLACE VIEW
-- aceita sem derrubar a view. `security_invoker` é reafirmado de propósito —
-- estas views são lidas com a RLS de quem consulta (ver
-- migrations.legacy/20260404000001_views_security_invoker.sql), e reescrever a
-- view sem repeti-lo é a forma silenciosa de perder isso.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_clients
WITH (security_invoker = true) AS
  SELECT p.id,
    c.tenant_id,
    p.name,
    p.email,
    p.phone,
    p.document_number,
    p.avatar_url,
    p.date_of_birth,
    p.notes,
    p.is_active,
    p.tags,
    c.gender,
    c.origin,
    c.visits,
    c.total_spent,
    c.last_visit,
    c.created_at,
    c.updated_at,
    p.created_by
  FROM public.clients c
  JOIN public.people p ON p.id = c.person_id;

CREATE OR REPLACE VIEW public.v_staff
WITH (security_invoker = true) AS
  SELECT p.id,
    sm.tenant_id,
    p.name,
    p.email,
    p.phone,
    p.document_number,
    p.notes,
    p.is_active,
    p.tags,
    sm.created_at,
    sm.updated_at,
    sm.commission_rate,
    sm.profession,
    p.created_by
  FROM public.staff_members sm
  JOIN public.people p ON p.id = sm.person_id;

GRANT SELECT ON public.v_clients TO authenticated;
GRANT SELECT ON public.v_staff TO authenticated;
