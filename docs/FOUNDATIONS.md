# FOUNDATIONS — o que falta estabilizar para lançar o v2

Status: canonical · Atualizado: 2026-07-23
Fonte: survey verificado do SDK `~/dev/fayz-sdk` (packages `db/core/saas/ui` + docs) e do app `beauty-saas`, mais checks ao vivo em `/settings/*` (2026-07-23).

Este doc é o **de-para de fundação** (o "encanamento" cross-cutting que todo módulo herda) e o **rastreador de estabilização** para o lançamento. Companheiros:
- **Features a migrar do v1** (paridade módulo a módulo, %): [GAP-ANALYSIS.md](GAP-ANALYSIS.md).
- **Contrato de SDK / plugins / modelo de dados**: `~/dev/fayz-sdk/docs/` — [ARCHITECTURE](../../../fayz-sdk/docs/ARCHITECTURE.md), [PLUGINS](../../../fayz-sdk/docs/PLUGINS.md), [DATA-MODEL](../../../fayz-sdk/docs/DATA-MODEL.md), [CUSTOMIZATION](../../../fayz-sdk/docs/CUSTOMIZATION.md). **Regra travada:** o spine (Ring 0) é fixo — *apps never add to it*. Fundação nova mora no SDK; o app **consome**.

**Legenda de status:** ✅ paridade (existe no v2, normalmente via SDK) · 🟢 quase (osso pronto no SDK, falta verificar/wiring pequeno) · ⚠️ parcial · 🔴 gap real · 🏛️ escopo plataforma (fayz Panel, fora do app).
**Prioridade:** P0 bloqueia operar rede/franquia · P1 fundação que módulos dependem · P2 secundária.

---

## 0. Scoreboard de fundações

| # | Fundação | v1 (beautyplace) | v2 (beauty-saas) | Status | Prio |
|---|---|---|---|---|---|
| 1 | Multi-tenant (licença/tenant + RLS) | `get_user_license_id()` + `tenant_id` em ~150 tabelas | `getActiveTenantId()` + RLS canônico + `multiOrg` (SDK) | ✅ Paridade | — |
| 2 | **Multi-unidade / filial / franquia** (por usuário) | `companies` + `UnitContext` + `FranchiseContext` + escopo por usuário | só `public.locations` + seleção na agenda (~30%) | 🔴 Maior gap | **P0** |
| 2b | **Team = person-kinds** (identidade de equipe) | pessoas ⇄ acesso acoplados | Slices 1+2 no SDK (lista pessoas dos kinds); falta claim/invite | 🟢 Em andamento | **P0** |
| 3 | Permissões / RBAC editável em runtime | `permission_rules` editáveis + enforcement | editor per-tenant + overrides **já existem** no SDK; roda no app | 🟢 Verificar E2E | P1 |
| 4 | Field visibility / campos obrigatórios | `field_visibility_rules` + `required_field_rules` | `TenantFieldRules` + UI **já no SDK**; registry vazio (bug) | 🟢 Fix + verificar | P1 |
| 5 | Appearance / white-label por tenant | appearance por licença (logo/nome/cor) + refresh ao vivo | branding armazenado + UI; **cores não realimentam o tema** | ⚠️ 1 wiring | P1 |
| 6 | Module gating por tenant (runtime) | `modules` + `hasModule()` | preset por env (`VITE_BEAUTY_PRESET`) + planos em `billing.ts` | ⚠️ build-time | P2 |
| 7 | Auth avançado (tenant chooser, QR) | chooser de licença + QR gate | Supabase + Google OAuth + invites nativos | ⚠️ 2 extras | P2 |
| 8 | **Primitivas polimórficas do core** | parcial (espalhado) | ausentes (só event-bus em memória + `public.addresses`) | 🔴 Build SDK | P0/P1 |
| 9 | Super-admin / console de plataforma | console separado por token | fayz Panel (fora do app) | 🏛️ Plataforma | — |
| 10 | i18n | pt-BR hardcoded | `tl()` pt-BR/en | ✅ v2 à frente | — |

**Leitura rápida:** paridade já existe em tenancy (1), RBAC-core (3) e i18n (10). Os builds reais são **#2 (RLS por location)** e **#8 (primitivas, zero DDL)**. #3/#4/#5 são quick-wins (verificar o que o SDK já entrega + wiring pequeno).

---

## 1. A regra que reordena tudo: **80% é trabalho de SDK**

`SDK/docs/DATA-MODEL.md` trava: o spine (Ring 0) é **fixo — apps never add to it**. Forkar no app viola a regra e recria as "3 cópias" (a divergência que a análise de junho denunciou — hoje resolvida pelo pivô industry-pool: DDL do core mora só no SDK, tabelas em `public.*`). Onde o app entra:
- **(a)** fornecer **seed rows** que o core espera (ex.: `tenant_roles`);
- **(b)** montar/verificar **UI e contexto** app-side;
- **(c)** aplicar **migrations Ring 2** em `drizzle/` / `supabase/migrations/`.

**Bloqueador operacional transversal:** não há runner de migration do core (`[planned FAY-1205]`). Hoje o DDL novo do core é aplicado à mão no beauty-saas. Toda primitiva nova do SDK precisa de um caminho de apply até o runner existir.

**RLS — o padrão que toda tabela nova segue:**
- Helper canônico `public.user_tenant_ids()` (`SDK/packages/db/migrations/002_rls_user_tenant_ids.sql`) — `SETOF uuid`, SECURITY DEFINER.
- Predicado (M-LOCK): `USING (tenant_id IN (SELECT public.user_tenant_ids()))`.
- Gerador: DO-block em `002_*.sql` auto-emite as 4 policies para toda tabela `public` com `tenant_id`. CI: `scripts/check-plugin-capability.mjs`. Admin: `public.is_tenant_admin(tenant_id)`.

Esforço relativo (verificado): **#8 primitivas** GRANDE · **#2 multi-location** MÉDIO · **#3/#4/#5** PEQUENO (verificação + wiring).

---

## 2. Fundações — estado verificado + o que falta

### #2 · Multi-unidade / filial / franquia — 🔴 P0 · MÉDIO
Existem `public.locations` (kind `branch|room|zone`, `is_headquarters`; `001_core.sql`+`005_locations_archetype.sql`), `public.location_members (location_id, user_id, role)`, `invitations.location_ids uuid[]`, `OrgAdapter.listLocations/createLocation`. **`multiOrg` troca *tenant*, não location** — location é sub-unidade dentro do tenant. Falta o escopo por usuário e o contexto global.

SDK-core:
- [ ] `public.user_location_ids()` — espelhar `user_tenant_ids()` lendo `location_members` (migration nova em `@fayz-ai/db`)
- [ ] RLS por location: predicado opcional `location_id IN (SELECT user_location_ids())` (decidir quais entidades são location-scoped vs tenant-scoped)
- [ ] `OrgAdapter`: `updateLocation`/`deleteLocation`/`assignLocationMember` (hoje só list/create)

App (beauty-saas):
- [ ] `LocationContext` + switcher no topbar; location atual persistida (equiv. `current_unit_id` do v1)
- [ ] Propagar `location_id` como filtro em queries/relatórios que hoje só filtram por tenant
- [ ] Modo franqueador: quando `is_headquarters`, visões consolidadas cross-location (dashboard/rankings/metas)
- [ ] Matar `unit_id` uuid-pelado → `location_id → public.locations`

**Aceite:** usuário não-admin só vê as locations em que é `location_member`; troca persiste; HQ vê consolidado.

### #2b · Team = person-kinds — 🟢 P0 · em andamento
> `/settings/team` listava **só `tenant_members`** (login+role); pessoas de kind team (beauty `staff`; school `teacher`+`staff`) não apareciam e não havia elo pessoa↔login. **Decisão: Person-first** — a tela lista as pessoas dos kinds configurados; login+role é overlay. Pessoa sem login = "Sem acesso · Convidar".

- [x] Config seam `team: { personKinds: [] }` no `defineSaas` (SDK `packages/saas/src/app/config.ts`) — beauty `['staff']`, school `['teacher','staff']`
- [x] Elo `tenant_members.person_id → people(id)` (SDK `019_tenant_members_person_id.sql`; aplicado em beauty+school)
- [x] `OrgAdapter.listTeam(orgId, personKinds)` (people-of-kinds LEFT JOIN membership) + `TeamTab` dirigido por pessoa — **staff lista ao vivo no beauty**
- [ ] **Slice 3:** linking/claim — ao convidar (ou quando email casa com pessoa) setar `person_id` → pessoa vira "Ativo" (equiv. `claim_personnel_record` do v1)
- [ ] Verificar school-saas listando `teacher`+`staff` após reload

**Depende de:** #3 (atribuir role) · conecta com #2 (escopo por location). **Onde codar:** SDK-core + config nos apps.

### #3 · Permissões / RBAC editável em runtime — 🟢 P1 · verificar E2E
> **✅ Check ao vivo (`/settings/permissions`):** funciona. "Perfis de Permissão" + **Criar Perfil**; lista os 6 perfis do `beautyPermissions` (Sistema), com **Duplicar** → papel custom editável, **Visualizar como**, contagem de membros. `tenant_roles` **já seedado** no app.

RBAC é data-driven **e** editável per-tenant, e a UI existe. Tabelas: `permissions`, `role_permissions`, `tenant_role_overrides` (grant por tenant), `tenant_roles` (custom do tenant). CRUD via `OrgAdapter.listProfiles/createProfile/updateProfile/deleteProfile`; engine em `SDK/packages/saas/src/access/`.
- [ ] Verificar fluxo completo: Duplicar → editar matriz → atribuir na aba Equipe → logar como o membro → confirmar enforcement **deny-by-default**
- [ ] (Opcional, depende de #2) role **por location** — hoje role é por tenant (`tenant_members.role`) e por location (`location_members.role`), sem policy que use location
- [ ] NÃO portar: matriz opt-in default-allow do v1 (anti-goal)

> ⚠️ O FAY-1263 original ("granular RBAC salon roles") é **majoritariamente isto — e já funciona**. Aqui é verificação E2E, não build.

### #4 · Field visibility / campos obrigatórios — 🟢 P1 · fix + verificar
Field-visibility per-tenant **existe**: `TenantFieldRules = Record<entityKey, Record<fieldKey, {required, showInForm, showInTable, showInDetail}>>` em `tenants.settings.fieldRules` (`SDK/packages/saas/src/shell/types/crud.ts`), aplicado por `applyFieldRules` via `useFieldRules(entityKey)`, UI `FieldRulesSettings.tsx`.

> **⚠️ Check ao vivo (`/settings/field-rules`):** monta mas vem **VAZIA** — *"Nenhum tipo de cadastro disponível."* Causa: `ConnectedFieldRulesSettings` lê `getRegisteredEntities()`, populado **lazy** por `createCrudPage` (`SDK/.../createCrudPage.tsx:54`). Ao cair direto em settings sem visitar CRUDs, o registry está vazio. → ver [§4 Known issues](#4-known-issues--bloqueadores-de-lançamento).

- [ ] **Fix do registry** (o delta real): registro **eager** das entidades do app para o field-rules listar sem visitar cada CRUD
- [ ] Verificar que os toggles persistem em `tenants.settings.fieldRules` e que `applyFieldRules` esconde/torna obrigatório no CRUD
- [ ] (Opcional/MÉDIO) custom-field definitions — estender FieldRules para campos custom→`metadata`. Amarra com a decisão de #8

### #5 · Appearance / white-label por tenant — ⚠️ P1 · 1 wiring
Branding do tenant **é armazenado**: `tenants.settings.branding` (`primaryColor`, `accentColor`, `logoUrl`, `faviconUrl`) + `tenants.logo_url`, escrito por `ConnectedBrandingSettings.tsx` (upload pra bucket `avatars`/`branding/`). Engine de tema completo (`theme.store.ts` `buildTheme`/`applyTheme`). **Gap único:** `setOverrides` só é chamado a partir de `config.theme` (`admin-app.tsx:209`) — nada lê `currentOrg.settings.branding` em runtime. Logo já é consumido; cores não.

> **⚠️ Check ao vivo (`/settings/branding`):** color pickers montam (Cor Primária **#000000**, Destaque #6366f1), preview, logo, "Salvar Marca". O form mostra #000000 enquanto o app roda o navy do `config.theme` — branding salvo não realimenta o tema. → ver [§4 Known issues](#4-known-issues--bloqueadores-de-lançamento).

- [ ] **`TenantThemeInitializer`** no SDK: efeito que lê `currentOrg.settings.branding.primaryColor/accentColor` → `setOverrides`/`applyTheme` quando o org resolve/muda (espelha `ThemeInitializer`, `admin-app.tsx:199-215`). Refresh ao vivo ao salvar. Cuidar do default #000000 (não sobrescrever o tema base com preto quando o branding está vazio).

**Aceite:** admin troca a cor no painel e o app recolore ao vivo, isolado por tenant. **Menor esforço dos cinco.**

### #8 · Primitivas polimórficas do core — 🔴 P0/P1 · GRANDE (build SDK)
Nenhuma das 7 tabelas existe (`attachments`, `share_tokens`, `comments`, `entity_links`, `events/outbox`, `custom_field_definitions`, `entity_types`). Só há event-bus **em memória** (`SDK/packages/core/src/events/index.tsx`) + seam `manifest.events[]`. Precedente de tabela polimórfica: `public.addresses` com `owner_type text` (`017_core_addresses.sql`) — **copiar esse padrão**. Não construir tudo; priorizar a wave 1 que já barra trabalho.

Construir agora (P0):
- [ ] **`attachments`** — `(id, tenant_id, owner_type, owner_id, kind, storage_path, folder, mime, size, created_by, created_at)` + RLS canônico. Provider `createAttachmentProvider` em `@fayz-ai/core`. Tab genérica em `@fayz-ai/ui`. Bucket no app. **Destrava:** fotos antes/depois, documentos do cliente, RH.
- [ ] **`share_tokens`** — `(id, tenant_id, scope, entity_type, entity_id, capabilities jsonb, expires_at, token hash)` + estender `PluginRouteDefinition.guard` (`SDK/packages/core/src/types/plugins.ts`) para `'public'|'share-token'`. **Destrava:** agendamento online, portal do cliente, painéis TV, LPs ("maior gap isolado de alavancagem").

Decisão explícita antes de construir (não especular):
- [ ] `custom_field_definitions` — seam `PluginCustomFieldsDef` foi removido; caminho hoje é `metadata jsonb` + estender FieldRules. Decidir tabela vs. FieldRules. Amarra com #4.
- [ ] `entity_links` — `[decision-needed]` no ROADMAP: primitiva formal vs. convenção. Só quando a 1ª relação cross-plugin real aparecer.
- [ ] `events`+`event_outbox` — bus já existe; outbox durável adiar até automations pedir.
- [ ] `comments` — timelines por-domínio já existem (`order_events`); genérico pode esperar.
- [ ] `entity_types` — mecanismo canônico é `EntityDef`/`kind` em código, provavelmente **não fazer**.

**Aceite (wave 1):** um plugin lê/escreve `attachments` reais; uma rota `share-token` serve conteúdo sem auth de sessão.

### #6 · Module gating por tenant · #7 Auth avançado — ⚠️ P2
Deferidos. #6: gating é build-time (`VITE_BEAUTY_PRESET`); falta habilitação por tenant em runtime amarrada ao plano (`public.plugin_installations`). #7: falta tenant chooser (usuário em >1 tenant) e QR gate (→ mapeia para `share_tokens`, #8). Só sob demanda real.

---

## 3. Sequência recomendada

**Trilha rápida (quick-wins, dias — verificar + wiring):**
1. **#5 Appearance** — 1 wiring (`TenantThemeInitializer`). Valor visível imediato.
2. **#3 Permissões** — verificação E2E.
3. **#4 Field visibility** — fix do registry eager + verificar wiring.
4. **#2b Team** — fechar Slice 3 (claim/invite).

**Trilha pesada (builds SDK, em paralelo):**
5. **#8 Primitivas wave-1** — `attachments` depois `share_tokens` (decisões de custom_fields/entity_links/outbox tomadas antes de codar).
6. **#2 Multi-location** — `user_location_ids()` + RLS por location + CRUD + `LocationContext`.

> Se a dor #1 for **franquia** (a que originou a conversa), **#2 sobe** para a trilha pesada como prioridade — é independente e é a separação de dados real.

---

## 4. Known issues / bloqueadores de lançamento

Estado verificado 2026-07-23. Bugs que travam ou sujam o caminho para o lançamento.

| # | Sintoma | Causa | Onde | Status |
|---|---|---|---|---|
| B1 | `/settings/field-rules` vem vazia ("Nenhum tipo de cadastro") | registry de entidades é lazy (`createCrudPage`); settings direto → registry vazio | SDK `packages/saas/src/crud/createCrudPage.tsx` + shell | 🔴 aberto — parte do #4 |
| B2 | Branding salvo não muda a cor do app rodando | nada lê `currentOrg.settings.branding` para realimentar `applyTheme` em runtime | SDK `admin-app.tsx:209` | 🔴 aberto — é o wiring do #5 |
| B3 | `OrderDetailView` "change in the order of Hooks" + 404 no shop | `useEffect` (receivable) depois de early returns condicionais → contagem de hooks muda entre renders | SDK `plugins/plugin-shop/src/views/OrderDetailView.tsx` | ✅ **corrigido** — hook movido acima dos returns |
| B4 | Telas brancas intermitentes (beauty/school/marketplace/agency-os): `useGlobalSearch: useRouter is not defined` | WIP inacabado de outro dev no branch `feat/fab-assistant-voice` (~40 arquivos: chat/voice, `useGlobalSearch`, `AdminShell`, data-layer) — todos os apps consomem o mesmo SDK source | SDK (branch compartilhado) | ⏸️ **não é nosso** — dono do branch fecha o WIP; pull/stash para SDK limpo estabiliza |

**Regra:** B1/B2 são wiring de fundação (viram checkbox em #4/#5). B4 é WIP de terceiro no branch compartilhado — não patchar às cegas.

---

## 5. Decisões em aberto (precisam de você)
- **Onde codar #8, #2 e o wiring de #5?** O correto é **no `fayz-sdk`** (Ring 0/SDK), com o beauty-saas consumindo — forkar no app viola a regra travada. Confirmar como chega ao app (publicar `@fayz-ai/*` vs. resolver do source local em dev).
- **Runner de migration (FAY-1205) ausente:** como aplicar DDL novo do core no beauty-saas até o runner existir? (hoje manual.)

## 6. Manutenção
Ao pousar uma fundação: marque o checkbox e atualize o status no scoreboard (§0). Se desbloquear features, ajuste os % em [GAP-ANALYSIS.md](GAP-ANALYSIS.md). Este doc mede **fundação + estabilização**, não paridade de feature (isso é GAP-ANALYSIS) nem o contrato de SDK (isso é `fayz-sdk/docs/`). Supersede os antigos `FOUNDATIONS-GAP`/`FAY-1263-ticket`/`FOUNDATIONS-SEQUENCING` e `foundation-critique` (arquivado).
