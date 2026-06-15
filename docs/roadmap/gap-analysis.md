# beautyplace → beauty-saas Gap Analysis

> **Date:** 2026-06-11 · **Method:** full static exploration of both codebases + live Playwright session on beauty-saas (`localhost:5180`, user `maia.silvio.rj@gmail.com`, tenant "Glow Studio" `b9c35035`).
> **Companions:** [`backlog.md`](./backlog.md) (prioritized work), [`fayz-sdk/docs/architecture-blueprint.md`](../../../fayz-sdk/docs/architecture-blueprint.md) (layer model, primitives, epics — referenced below as **BP §n**).

**Status legend:** ✅ exists · 🟡 partial · 🧩 stubbed (placeholder on purpose) · ❌ missing · 🐞 broken (built but not working)
**Vertical tag:** `beauty` (build in this app/config) · `universal` (build in fayz-sdk) · `food` (resto-saas, document only) · `platform` (control plane)

---

## 1. Live-test findings (broken vs not-built) — 2026-06-11

These are things that exist but **misbehave**; everything else in §2 is a build gap, not a bug.

| # | Finding | Severity | Repro | Notes |
|---|---|---|---|---|
| B1 | 🐞 **Agenda modal: client search never queries the backend.** Typing in "Buscar cliente…" fires zero network requests; only the quick-create "Novo cliente …" option ever appears, even when a matching client exists (created "TESTE-CLAUDE Maria", searched "TESTE" → not found). | **P0** | Agenda → Criar → Adicionar cliente → type | Lookup wiring dead in plugin-agenda or contactLookup config. Blocks completing any booking. |
| B2 | 🐞 **Agenda modal: service search completely inert.** No dropdown, no request, no quick-create on typing. | **P0** | Agenda → Criar → Adicionar serviço → type | With B1, makes the core booking flow unusable end-to-end. |
| B3 | 🐞 **RPC `get_tenant_active_plugins` → 404 on every page load.** Function not deployed in the Supabase project; app silently falls back. | P1 | Any page, console | Deploy the migration/function, or guard the call. |
| B4 | 🐞 **Dashboard metrics are hard-coded mocks** (12, R$ 3.240, 148, 4,9 + static trends). Today's Schedule *is* real (`v_bookings`, 200, correct empty state). | P1 | `/#/` | Replace `compute` stubs in `App.tsx` with real queries → long-term BP §4.5 metric registry. |
| B5 | 🐞 **10 of 14 reports `available: false`** — `rep_*` views missing in DB. The one available report (Agendamentos por Período) generates correctly (renders, empty result, no errors). | P1 | `/#/reports` | Create the 9 `rep_*` views (occupancy, cancellations, no-show, peak hours, revenue by service/professional, client frequency, new clients). |
| B6 | 🐞 **No delete affordance on CRUD detail/edit** (client detail has only "Editar"; edit page only Cancelar/Salvar). Test data could not be removed via UI. | P2 | `/#/clients/:id` | Either rows-menu delete or detail-page danger zone, in `createCrudPage`. |
| B7 | 🐞 **i18n leaks in pt-BR UI:** "Scheduled" (booking status), "Active" (toggle), "Contact" (form section), "+ New", "Coming Soon. This module is being built as a plugin.", report badges "Essential"/"Popular". | P2 | various | Mostly missing keys in SDK plugin locales, not app keys. |
| B8 | ⚠️ **beautyplace login blocked:** `invalid_credentials` from project `xzihdmcyoyrjndpvlxdj` for the given user (same creds work on beauty-saas project `gphxclpkbtbucoqclbco`). Public route `/cardapio-digital` verified working. | n/a | beautyplace `/auth` | Needs valid beautyplace credentials to live-test the reference app; static exploration used instead. |

**What was live-verified as working** (important corrections to any "stub" assumptions):
- **Settings is NOT a stub.** Full SDK settings hub: Geral (empresa/fuso/moeda), Perfil, Segurança, Marca, Equipe, Permissões, Locais, **Regras de Campos**, + per-plugin tabs (Agenda, Financeiro, Estoque, Vendas & CRM, Tarefas, **Formulários e Documentos**). The `/settings` placeholder in `App.tsx` is dead config shadowed by the SDK shell.
- **Forms plugin is exposed** (Settings → Formulários e Documentos: Modelos/Categorias, Novo Modelo).
- Client CRUD create works; detail tabs Visão Geral / Documentos / Atividade / Pedidos all render.
- **Extension-table pattern works:** creating a Professional writes `persons` (kind=staff) + `staff_members`, and the new professional immediately appears as an agenda resource column, in the Agendas filter, and pre-selected in the booking modal.
- Financial full sub-nav works: Resumo, Contas a Pagar (+Recorrentes), Contas a Receber, Caixas, Extratos, Comissões (Visão Geral/Regras), Cartões (Visão Geral/Conciliação).
- CRM/Vendas full sub-nav works: Painel, Pipeline, Leads, Orçamentos, Atividades.
- Onboarding wizards (Estoque, Vendas, Financeiro) and the AI assistant with per-page suggestions work.
- Tasks drawer, registry pages (9 entities), report generation engine, ⌘K search shell, org/tenant resolution, login.

**Test data left in tenant "Glow Studio"** (no UI delete, see B6): client `TESTE-CLAUDE Maria` (`4e5c3bb3-…`), professional `TESTE-CLAUDE Profissional`.

---

## 2. Feature gap matrix (beautyplace capability → beauty-saas status)

### Scheduling & operations

| beautyplace feature | beauty-saas | Tag | Target block (BP) |
|---|---|---|---|
| Agenda calendar, drag-reschedule, resource columns | 🟡 works (verified), bridged plugin | universal | de-bridge (BP §7) |
| Booking types Agendamento/Tarefa/Bloqueio | ✅ (verified in modal) | universal | — |
| Confirmation flow/checklist + channels | 🟡 config exists, flow unverified (B1/B2 block it) | universal | plugin-agenda |
| Waiting list | ❌ | universal | plugin-agenda `waitlist` module |
| Holidays/blocked dates | 🟡 registry exists | universal | agenda registries |
| Work schedules per professional | ✅ (`working_hours` schedules) | universal | — |

### Clients / CRM

| beautyplace feature | beauty-saas | Tag | Target block |
|---|---|---|---|
| Client list/profile | ✅ (verified) | universal | — |
| Client photos + folders | ❌ | universal | attachments primitive (BP §4.2) |
| Client files/documents | 🟡 "Documentos" tab exists, no storage backend | universal | BP §4.2 |
| Service notes / journey timeline | 🟡 "Atividade" tab exists, no timeline data | universal | crm activities |
| Quotes (orçamentos) | ✅ nav + forms (data flow unverified) | universal | — |
| Client self-service portal (`/cliente/:token`) | ❌ | universal | plugin-portal + share tokens (BP §4.4) |
| Pets / pet species | ❌ | beauty (niche) | app extension entity |

### Services & catalog

| beautyplace feature | beauty-saas | Tag | Target block |
|---|---|---|---|
| Service catalog | ✅ (registry, verified) | universal | — |
| Service packages/bundles | ❌ | universal | policy/bundle pricing (BP §4.6) |
| Service revisions | ❌ | universal | revisions primitive (BP §4.8) |
| Default products/forms per service | ❌ | universal | entity relations (BP §4.9) |
| Price tables / variations | ❌ | universal | policy engine (BP §4.6) |
| Discount / cancellation rules | ❌ | universal | BP §4.6 |

### Inventory

| beautyplace feature | beauty-saas | Tag | Target block |
|---|---|---|---|
| Products (retail/insumo) | 🟡 plugin present (onboarding wizard, not completed in test) | universal | de-bridge |
| Barcodes | ❌ | universal | `barcode` FieldType |
| Recipes/BOM | ❌ (module flag off — right call for beauty) | universal (food-leaning) | inventory `recipes` module |
| Stock locations/movements | 🟡 plugin scope | universal | — |
| DANFE/NF-e import, DFe inbox | ❌ | addon (BR) | plugin-fiscal-br (BP §4.7) |

### Financial

| beautyplace feature | beauty-saas | Tag | Target block |
|---|---|---|---|
| Payables/receivables (+recurring) | ✅ nav verified | universal | — |
| Installments distribution | ❌ | universal | financial |
| Cash register sessions | 🟡 "Caixas" exists, flow unverified | universal | — |
| Bank statements/reconciliation | 🟡 "Extratos"/"Conciliação" navs exist, no connectors | addon (BR) | plugin-banking-br |
| Chart of accounts / cost centers | ❌ | universal | tree registries |
| Commissions | 🟡 "Comissões" + Regras nav exists | universal | policy engine (BP §4.6) |
| Payment methods config | 🟡 financial settings | universal | — |

### Marketing & messaging

| beautyplace feature | beauty-saas | Tag | Target block |
|---|---|---|---|
| Campaigns (email/SMS/WhatsApp) | 🧩 "Coming Soon" placeholder (verified) | universal | plugin-marketing |
| Message templates + dispatch log + event triggers | ❌ | universal | `@fayz/messaging` + event bus (BP §4.1) |
| WhatsApp integration | ❌ | addon | channel-whatsapp |
| Appointment reminders | ❌ (Quick Action button exists, inert) | universal | messaging + jobs (BP §4.10) |

### Forms, documents & media

| beautyplace feature | beauty-saas | Tag | Target block |
|---|---|---|---|
| Dynamic form builder | 🟡 template UI verified (Modelos/Categorias) | universal | de-bridge + grow |
| **Stencil/camera overlay forms (recent beautyplace work)** | ❌ | universal | `image-annotation` FieldType |
| Contract templates + generation | ❌ | universal | document engine (BP §4.3) |
| Required fields / field visibility | 🟡 "Regras de Campos" exists (verified) | universal | BP §4.11 full |

### Reports & analytics

| beautyplace feature | beauty-saas | Tag | Target block |
|---|---|---|---|
| Reports catalog + generation | 🟡 engine verified; 9 views missing (B5) | universal | DB views now; reports de-bridge later |
| Custom KPI panel builder (150+ metrics) | ❌ | universal | metric registry (BP §4.5) |
| Public TV panels | ❌ | universal | share tokens (BP §4.4) |
| Real dashboard metrics | 🐞 mock (B4) | universal | BP §4.5 |

### Public surfaces

| beautyplace feature | beauty-saas | Tag | Target block |
|---|---|---|---|
| **Public booking wizard** (`/booking/:configId`) | ❌ — *largest commercial gap* | universal | plugin-booking (BP §6) |
| Public digital menu | ❌ (not beauty-relevant) | food | plugin-menu + share tokens |
| Public panels | ❌ | universal | BP §4.4 |

### Other-vertical (document only — resto-saas)

Table POS/grid, waiter app, kitchen queue, production stations, cover charge, table transfers → plugin-tables / plugin-kitchen (food vertical). Not for beauty-saas.

### Platform

Super-admin license/tenant management, software profiles (white-label branding per instance), import jobs → `fayz-admin` scaffold (BP §6). The software-profile concept matters for the generator ambition: one deployment, many branded products.

---

## 3. Recent beautyplace:main updates (what just landed there)

| Update (≈ May–Jun 2026) | Classification | Where it should land |
|---|---|---|
| Stencil overlay form system (`StencilEditor`, `StencilCameraCapture`) + rendering fixes | universal | `image-annotation` FieldType in core/ui + plugin-forms |
| Inventory/recipe polish: CMV in lists, ingredient AJAX search, product photos, modal editing | universal/food | plugin-inventory (CMV = costing module), attachments for photos |
| DANFE import enhancements (175+ items), vendor detail page, supplier product mappings | addon (BR) | plugin-fiscal-br |
| Print/export: recipe printing, column customization | universal | reports/table export in `@fayz/ui` DataTable |

---

## 4. How to read this with the blueprint

Every ❌/🟡 row names its target block in [`architecture-blueprint.md`](../../../fayz-sdk/docs/architecture-blueprint.md). The rule of thumb for beauty-saas:

- 🐞 rows → fix now in the bridged plugins/app (don't wait for de-bridge) — see backlog P0.
- ❌ universal rows → **never** build app-side; they enter the SDK epic phases (BP §8).
- ❌ beauty rows → app config / extension entities, can be done anytime.
- food/platform rows → out of scope here; tracked for resto-saas / fayz-admin.
