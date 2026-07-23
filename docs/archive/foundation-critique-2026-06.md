> **⚠️ ARQUIVADO (2026-07-23) — não seguir operacionalmente.** A premissa central (§0: "o schema mora em 3 lugares divergentes — `saas_core`, cópia do app, TS") foi **superada** pelo pivô industry-pool: o DDL do core mora só no SDK e as tabelas vivem em `public.*`. Os pontos ainda válidos foram absorvidos por [../FOUNDATIONS.md](../FOUNDATIONS.md). Mantido como histórico da análise adversarial de junho.

# Crítica fundacional — core / plugins / archetypes vs. a visão do fayz-sdk

> 2026-06-17. Avaliação crítica e adversarial. O objetivo NÃO é elogiar o que já está bom
> (isso está em [data-model.md](data-model.md)) — é encontrar onde a base **vai quebrar** quando
> 18 plugins × N verticais × milhares de tenants baterem nela.
> Âncora da visão: `fayz-sdk/docs/architecture-blueprint.md` (1 abstração → N SaaS; "SAP-class scope com
> velocidade de micro-SaaS") e o contrato de plugin em `fayz-sdk/packages/core/src/types/plugins.ts`.

---

## 0. A fragilidade que domina todas as outras: **o schema não tem dono único**

Hoje a mesma DDL existe, divergindo, em **três lugares**:

1. `saas-core/supabase/migrations/` — o "canônico" (pacote `@fayz/saas-core`)
2. `beauty-saas/supabase/migrations/` — cópia do app, com migrations que o app inventou
   (`generic_archetype_join`, `v_views_and_cleanup`, `staff_commission_rate`) que *talvez* tenham
   voltado pro core, talvez não
3. `fayz-sdk/packages/core/src/types/entities.ts` — a verdade em TypeScript (`EntityArchetype`,
   `PersonEntity`, etc.)

**Três fontes de verdade para o mesmo modelo = não existe fonte de verdade.** Tudo o que vem abaixo
piora com isso, porque cada correção precisa ser aplicada três vezes e à mão. Antes de qualquer
primitiva nova: a DDL do `saas_core` tem que morar em **um** lugar (o pacote core, versionado e
publicado como migrations), e os apps **consomem** — nunca forkam. Enquanto isso não acontecer, "core
modular" é convenção, não arquitetura. O `git log` do beauty-saas (B6/B7 *construído e revertido*) é a
prova viva de que features morrem na fronteira entre as cópias.

---

## 1. Governança — `kind` e `metadata` são o coração do SDK e o banco não governa nenhum dos dois

Estas duas são as mais graves porque o SDK **aposta tudo** nelas e o banco as deixa soltas.

### 1.1 `kind` é texto livre, mas o SDK constrói a identidade das entidades em cima dele

O SDK deriva `entityKey = '{archetype}:{kind}'` (`entity/registry.ts`), injeta `archetypeKind` no
provider (`data/archetype.ts`), e o registry de entidades, navegação, AI tools e CRUD todos
dependem disso. No banco:

```sql
kind text NOT NULL   -- persons, orders, bookings, transactions, schedules, categories...
```

Sem enum, sem CHECK, sem tabela de tipos, sem contrato de "quais campos são obrigatórios para este
kind". Consequências concretas:

- `orders.kind = 'deel'` cria silenciosamente um **tipo de entidade fantasma**. O registry do SDK vai
  registrar `order:deel` como se fosse legítimo.
- Não existe "liste todos os kinds válidos do tenant X" — o frontend e cada plugin reinventam a lista.
- Não há validação de que um `person.kind='lead'` tem os campos que o CRM espera.

**O que falta:** uma tabela `saas_core.entity_types` (tenant-scoped: `archetype`, `kind`, `label`,
`required_fields jsonb`, `is_active`) + trigger/FK que valide as linhas das archetypes contra ela. Isso
transforma o discriminador esperto num discriminador **governado** — e dá ao SDK uma fonte real para o
entity registry em vez de strings mágicas.

### 1.2 `metadata jsonb` é o mecanismo de custom fields — e não existe catálogo

O blueprint (§4.11) quer customização de `EntityDef` por tenant: campos custom caem em `metadata jsonb`.
O storage existe. **O catálogo não.** Não há `custom_field_definitions`. Então hoje `metadata` é uma
sopa write-only:

- Sem tipo, sem validação, sem obrigatoriedade, sem opções de select.
- Impossível responder "quais custom fields a entidade Person tem no tenant X" sem varrer linhas.
- Impossível filtrar/reportar/deduplicar de forma confiável sobre JSON não tipado.
- Sem estratégia de índice (GIN? expression index por campo quente?).

Isto é literalmente **a diferença entre "temos JSONB" e "temos uma plataforma de metadados"** — e a
plataforma de metadados é o moat real do Salesforce. Precisa de
`saas_core.custom_field_definitions (tenant_id, entity_archetype, kind, key, type, required, options, ...)`
e o SDK lendo dela para montar formulários e validação. Sem isso, "micro-SaaS generator" para no primeiro
cliente que pede um campo custom com validação.

---

## 2. Integridade referencial — para um ERP, isto é a credibilidade, e está furada

### 2.1 Soft FKs por toda parte (uuid pelado, sem REFERENCES)

Levantamento concreto do que **deveria** ser FK e não é:

| Coluna | Tabela(s) | Deveria apontar para | Hoje |
|--------|-----------|----------------------|------|
| `unit_id` | bank_accounts, stock_locations, recipes.`yield_unit_id`, recipe_ingredients.`unit_id` | `measurement_units` **ou** `locations`? (ambíguo!) | uuid pelado |
| `assigned_to_id` | crm_activities | persons / auth.users | uuid pelado + `assigned_to_name` denormalizado |
| `opened_by_user_id`, `closed_by_user_id` | cash_register_sessions | auth.users | uuid pelado + `_name` denormalizado |
| `user_id` | stock_movements | auth.users | uuid pelado |
| `activity_type` | crm_activities | crm_activity_types | **texto livre** |
| `origin` | clients | lead_sources? | texto livre |

Cada um destes vira **linha órfã** e **join quebrado nas views** silenciosamente. O `archetype provider`
do SDK faz JOIN via `v_*` — quando o alvo do soft FK some, a view retorna NULL ou some a linha, e ninguém
percebe até o cliente reclamar. Para "SAP-class", integridade referencial não é opcional.

### 2.2 `unit_id` vs `location_id` — o modelo de filial está meio-ligado

`unit_id` (claramente "filial") aparece em vários plugins como uuid pelado, enquanto as archetypes têm
`location_id → saas_core.locations` de verdade. Resultado: multi-branch — requisito core de ERP, suportado
pelo SDK — é **inconsistente**: alguns plugins são location-aware via FK real, outros via `unit_id` não
validado. Decisão: `location_id → saas_core.locations` é a única forma sancionada; mata-se `unit_id`.

### 2.3 Dinheiro sem disciplina

`amount integer` (centavos) em `saas_core.invoices` vs `numeric(14,2)` nos plugins vs `numeric` puro nas
archetypes. Currency é texto livre, `'BRL'` em uns lugares, `'brl'` em outros. Para um ERP que quer addons
`fiscal-br` e `banking-br`, isto detona em contabilidade. Precisa de um padrão único (escala consistente,
currency como FK/enum, nunca float, nunca misturar centavos-int com decimal).

---

## 3. Composabilidade — o core promete plugins compostos, mas faltam os canais entre eles

### 3.1 Não existe relação tipada entre entidades (`entity_links`)

A regra do SDK é explícita (`PLUGIN_PATTERNS.md`): *"fluxos cross-plugin usam archetypes, event bus ou
providers exportados — **nunca leitura direta de tabela de outro plugin**"*. Mas o blueprint (§4.9) quer
`saas_core.entity_links` (relações tipadas tipo "serviço → produtos padrão") e **ela não existe**. Então
hoje o ÚNICO canal cross-plugin é o FK fixo nas archetypes (`order_id`, `product_id`). Qualquer
relacionamento N:N entre domínios — um deal ligado a vários bookings, um produto que faz bundle com
serviços, uma campanha que mira um segmento — **não tem onde morar** exceto junction bespoke ou `metadata`.
Isso limita exatamente a composição que é a promessa central. Falta uma tabela polimórfica
`entity_links (tenant_id, from_archetype, from_id, to_archetype, to_id, relation_kind)`.

### 3.2 Não existe event bus / domain events — e toda a visão de automação/IA depende disso

O SDK declara `PluginEventDefinition[]` (eventos que plugins emitem), `aiTools` com `mode: 'persist'`, tem
um plugin **automations**, e o blueprint (§4.1) descreve um event bus. No banco existe **só**
`payment_events` (Stripe). Não há `events` / `event_outbox` / `subscriptions`. Logo, os eventos declarados
nos manifests são fire-and-forget em memória no melhor caso:

- Sem durabilidade, sem replay, sem reação cross-plugin confiável.
- Sem "por que isto aconteceu?" (causalidade).
- O plugin **automations não pode ser confiável** sem um log de eventos persistido + outbox transacional.

Isto é primitiva fundacional, não feature. Sem ela, "automação" é uma demo.

### 3.3 Ciclo de vida de plugin não é transacional nem reversível no banco

Migrations são SQL cru embutido no manifest (`PluginMigration[]`), aplicadas por ordem de data, com dono
identificado **por comentário**. Três rombos:

1. **Sem down-migration** → não dá pra desinstalar plugin de forma limpa. O `scope: 'addon'` do SDK promete
   "removal graceful" (L4) — **impossível** com o modelo atual.
2. **Sem ledger plugin↔migration no banco do tenant** → não dá pra perguntar "qual plugin é dono desta
   tabela / qual versão está aplicada aqui".
3. **Enablement mora em OUTRO banco.** O comentário em `saas_core.sql` diz: *"Plugin registry, verticals,
   billing live in Fayz platform DB — not here."* Mas as **tabelas** do plugin moram no banco do tenant.
   Então o estado de habilitação e o estado de schema vivem em **dois bancos sem vínculo transacional**. Um
   tenant pode estar "disabled" para financial enquanto `financial_movements` ainda tem linhas e a RLS ainda
   as expõe. **Drift garantido.**

---

## 4. Primitivas de plataforma ausentes (o blueprint já as lista — confirmando o gap)

Nenhuma destas existe no banco, e cada vertical vai reinventá-las mal:

- **`attachments`** (§4.2) — mídia/documentos polimórficos (`entity_archetype + entity_id`). Hoje: nada.
- **`comments` / timeline** — o CRM tem um feed **privado** (`crm_activities`) que **deveria ser** uma
  timeline polimórfica do core. Cada plugin vai reinventar notas.
- **`share_tokens`** (§4.4) — o próprio blueprint chama de *"maior gap isolado de alavancagem"*. Booking
  público, portal self-service, share de KPI — todos precisam. Ausente. (E o B6/B7 revertido no git log é
  a prova de que a falta disso **já barrou trabalho real**.)
- **Document/template engine** (§4.3) — merge fields → PDF/HTML. Ausente.
- **Webhooks** — tipos existem (`integrations.ts`: `WebhookConfig`, `WebhookDelivery`) mas **zero tabelas**.
- **Revisions / audit real** (§4.8) — `audit_logs` registra *que* aconteceu, não o *delta de estado*. Sem
  versionamento de linha, sem undo, sem "quem mudou de X para Y".

### 4.1 Contabilidade é cenário pintado, não razão

`chart_of_accounts`, `cost_centers`, `commission_rules` existem com **zero caminho de lançamento**: nenhum
FK de `financial_movements` para conta ou centro de custo; sem partida dobrada (um movimento é single-sided
`direction in|out`); sem livro-razão; sem fechamento de período. **Não dá pra produzir um balancete.** Para
"SAP-class scope" isto é uma parede estrutural que hoje é um backdrop.

---

## 5. Segurança & operação — a RLS está correta mas é frágil por construção

A RLS funciona, mas é **copy-paste em cada tabela**, e já tem **dois idiomas** para a mesma checagem:

```sql
-- archetypes:
tenant_id IN (SELECT tenant_id FROM saas_core.tenant_members WHERE user_id = auth.uid())
-- project tables:
tenant_id IN (SELECT saas_core.user_tenant_ids())
```

Riscos concretos à medida que 18 plugins multiplicam tabelas:

- **Vazamento silencioso de tenant**: um autor de plugin esquece uma das 4 policies numa tabela nova → a
  tabela fica aberta. Nada testa "toda tabela com `tenant_id` tem 4 policies".
- **Custo quadrático**: a subquery inline roda por-linha por-tabela em cada query. A forma
  `user_tenant_ids()` (SECURITY DEFINER + STABLE) é melhor e **deveria ser a única** sancionada.
- **Dois idiomas = drift** já começou no próprio core.

Precisa de: um único helper canônico, um **gerador** de policies (não copy-paste), e um **teste de CI** que
falhe se qualquer tabela tenant-scoped não tiver o conjunto completo de policies.

---

## 6. Entropia — "reference, don't fork" já está sendo violado dentro dos próprios plugins

A entropia que a modularidade deveria prevenir **já venceu em alguns pontos**:

- `public.bank_accounts` definida em **duas** migrations (`project_tables` + `plugin_financial`).
- `product_categories` (plugin inventory) **duplica** `saas_core.categories`.
- `crm_tags` (plugin) coexiste com a coluna `tags text[]` que toda archetype já tem.
- `deal_extensions` **e** `crm_activities` modelam "coisas presas a um deal" de formas diferentes.

Duas fontes de verdade para a mesma ideia = exatamente o modo de falha que o sistema modular deveria
impedir. Se isto já acontece com 4 plugins, com 18 vira ingovernável.

---

## 7. O kernel fundacional que eu exigiria antes de escalar plugins

Promover ao `saas_core` um conjunto pequeno de **primitivas polimórficas** que todo plugin herda de graça.
Isto é o que falta para a base ser *realmente* sólida e flexível o suficiente para o SDK:

```
saas_core.entity_types            -- governança de kind (archetype, kind, required_fields)
saas_core.custom_field_definitions-- catálogo de custom fields sobre metadata jsonb
saas_core.entity_links            -- relações tipadas polimórficas cross-plugin
saas_core.events + event_outbox   -- domain events duráveis (substrato de automations/IA)
saas_core.attachments             -- mídia/documentos polimórficos
saas_core.comments                -- timeline/notas polimórficas (CRM vira consumidor, não dono)
saas_core.share_tokens            -- superfícies públicas / portal / share de KPI
saas_core.tags + entity_tags      -- tagging polimórfico (mata crm_tags e tags text[])
saas_core.plugin_installations    -- ledger plugin↔versão↔migration NO banco do tenant
saas_core.revisions               -- versionamento de linha + ator (audit real)
```

Mais a camada de **governança/enforcement** (sem a qual as tabelas acima também derivam):

1. **DDL em um único repo** (o pacote core), apps consomem migrations versionadas — fim das 3 cópias.
2. **Helper de RLS único** + gerador de policies + teste de CI de cobertura de policy.
3. **Registro de `kind`** validado por trigger/FK contra `entity_types`.
4. **Padrão de dinheiro** único (escala + currency FK/enum).
5. **Contrato de plugin com down-migration obrigatória** e ledger de instalação no mesmo banco das tabelas.

---

## 8. Priorização por raio de explosão

| # | Fragilidade | Raio | Esforço | Por quê primeiro |
|---|-------------|------|---------|------------------|
| 1 | 3 cópias do schema (sem dono único) | **Catastrófico** | Médio | Tudo o resto precisa ser feito 1× e não 3× |
| 2 | `kind` ungoverned + sem `entity_types` | **Alto** | Médio | O SDK inteiro chaveia em `kind`; é a base do entity registry |
| 3 | Soft FKs / integridade | **Alto** | Baixo | Barato e é a credibilidade de ERP; corrói confiança |
| 4 | Event bus ausente | **Alto** | Alto | Sem ele, automations + AI-persist são demo |
| 5 | Sem catálogo de custom fields | **Alto** | Médio | É o moat (metadata platform); trava o "generator" |
| 6 | Ciclo de vida de plugin (2 bancos, sem down) | **Alto** | Alto | Sem isto não dá pra vender módulos à la carte com segurança |
| 7 | `entity_links` ausente | Médio | Médio | Limita composição cross-plugin (a promessa central) |
| 8 | Primitivas polimórficas (attachments/comments/share_tokens) | Médio | Médio | Cada vertical reinventa; share_tokens já barrou trabalho |
| 9 | RLS copy-paste (sem CI) | Médio | Baixo | Um esquecimento = vazamento de tenant |
| 10 | Contabilidade não-ligada / dinheiro | Médio | Alto | Necessário para fiscal/banking, mas pode esperar a base |
| 11 | Entropia (duplicatas) | Baixo-Médio | Baixo | Limpar agora é barato; depois é doloroso |

---

## 9. Veredito sem floreio

A **base conceitual está certa** (modelo universal de objeto, multitenancy no banco, plugins
referenciando o core, RBAC data-driven) — isso é ~70% da aposta arquitetural difícil, e está bem feito.

Mas hoje isto é um **schema de aplicação bem desenhado, não uma plataforma**. As três coisas que separam
"beauty SaaS com bons ossos" de "core de ERP modular que compete com Salesforce" são, nesta ordem:

1. **Dono único do schema** (matar as 3 cópias).
2. **Camada de metadados governada** (`entity_types` + `custom_field_definitions` sobre o `kind`/`metadata`
   que já existem mas estão soltos).
3. **Substrato de eventos + ciclo de vida de plugin transacional** (sem isso, "modular" e "automação" são
   convenção e demo, não capacidades).

Feche §7 itens 1–5 e a base para de ser frágil-por-construção e vira fundacional de verdade — flexível o
suficiente para o que o `fayz-sdk` está prometendo.
