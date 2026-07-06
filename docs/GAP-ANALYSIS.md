# GAP-ANALYSIS — v1 (beautyplace) → v2 (beauty-saas), module by module

Status: canonical · Updated: 2026-07-06 — **regenerate whenever a module lands; percentages rot fast**
Sources: v1 inventory `beautyplace/docs/PRODUCT.md` + `features.md`; v2 state [PRODUCT.md](PRODUCT.md)/[ARCHITECTURE.md](ARCHITECTURE.md); destination map Linear **FAY-1220**; both grounded in code surveys of 2026-07-06.
QA counterpart: [USER-JOURNEYS.md](USER-JOURNEYS.md) — run the journeys on both apps to verify/falsify these percentages.

**How to read the % — functional completeness**: "of what v1's module does for a real salon/clinic, how much can an operator accomplish in v2 today, end-to-end, with persistence." UI-only screens score near zero; architecture quality is NOT scored here (that's the point of v2 — this doc only measures feature parity). Supersedes `archive/gap-analysis-2026-06.md` (its P0 bug list is ~60% resolved and its percentages are stale).

---

## 1. Summary scoreboard

| # | Module (v1 language) | v2 % | Verdict | Destination (FAY-1220) |
|---|---|---|---|---|
| 1 | Agenda (calendário, status, confirmação, espera, execução) | **80%** | core done; view/DnD + booking approvals missing | plugin-agenda (+ future plugin-booking) |
| 2 | Clientes (ficha, abas, jornada) | **75%** | detail consolidated; files/photos/portal missing | plugin-crm + app entity (+ future plugin-portal) |
| 3 | Painel/Dashboard | **80%** | 9/12 KPIs live; franchisor + KPI-detail missing | plugin-dashboard + app config |
| 4 | Relatórios | **85%** | 11/12; occupancy + custom panels/TV missing | plugin-reports |
| 5 | Financeiro operacional (pagar/receber/caixa/extrato) | **65%** | flows live; installments, GL, CNAB, payroll missing | plugin-financial (+ future plugin-banking-br, plugin-payroll) |
| 6 | Conciliação bancária / Open Banking | **60%** | works via PlugBank (different provider than v1) | app openbanking → future plugin-banking-br |
| 7 | Comissões | **30%** | rules CRUD + report column; **no calculation engine/payout** | plugin-financial + policy engine (future) |
| 8 | PDV / Caixa (sessões abrir/fechar) | **40%** | tables + nav exist; flow thin/unverified | plugin-financial |
| 9 | Estoque | **55%** | products+movements; barcode/positions/labels/recipes missing | plugin-inventory |
| 10 | Fiscal (DFe/DANFE inbox, conciliação, A1) | **0%** | absent | future plugin-fiscal-br |
| 11 | Serviços & Preços (pacotes, tabelas, variações) | **70%** | CRUD complete incl. price engine; **package session consumption missing** | saas CRUD (+ future plugin-services/pricing) |
| 12 | CRM (funil, leads, orçamentos) | **60%** | pipeline+quotes work; segments/loyalty/journey missing | plugin-crm |
| 13 | Marketing (campanhas, IA, brand kit, LPs) | **10%** | **façade** — static demo, only origins registry real | plugin-marketing + future WhatsApp addon |
| 14 | Comunicação / WhatsApp (Twilio, chat, disparos, IA) | **5%** | manual wa.me links only | future channel addon (plugin-conversations lane) |
| 15 | Formulários & Anamnese | **50%** | templates/kinds/fill via checklist; editor/stencil/required-fields missing | plugin-forms (+ future plugin-documents) |
| 16 | Contratos & Assinatura | **10%** | template *kind* exists; no generation/signature | future plugin-contracts |
| 17 | RH (benefícios, férias, 13º, EPI…) | **5%** | staff entity + commission_rate only | future plugin-hr |
| 18 | Escalas (turnos de equipe) | **15%** | working-hours rules only; no shift templates/assignments | future (agenda lane) |
| 19 | Agendamento online público | **0%** | absent — **largest commercial gap** | future plugin-booking (needs share-token primitive) |
| 20 | Portal do cliente (token/QR) | **0%** | absent | future plugin-portal (needs share-token) |
| 21 | Fidelidade / metas / indicações / aniversários | **0%** | absent | plugin-crm lane (future) |
| 22 | Fotos antes/depois + arquivos do cliente | **15%** | Documentos tab reads docs/attachments; no photo folders/journey UI | needs attachments primitive |
| 23 | Multi-unidade / franqueador | **30%** | locations + agenda selection; no franchisor dashboard/rankings/goals | saas org lane (future) |
| 24 | Painéis TV / relatórios públicos | **0%** | absent | future (needs share-token) |
| 25 | Auth/Permissões/Convites | **85%** | v2 is *stronger* (deny-by-default RBAC, 6 profiles, invites); missing per-user rule editor UI depth | saas (done in v0.2.0) |
| — | Restaurante (mesas/cardápio/garçom), Pets | n/a | out of beauty scope (resto-saas / not ported) | plugin-tables/menu/orders |
| — | Super-admin / licenças / white-label | n/a | platform concern (fayz Panel), not app scope | fayz platform |

**Weighted read for the clinic launch (Wave 1)**: the clinic preset needs only #1, #3, #5(subset), #25 — all ≥65% and the missing pieces (installments, GL) are not day-1 needs. **For full salon parity** (Silvio-convergence decision), the blockers are #13/#14 (marketing/WhatsApp), #19/#20 (public surfaces), #7 (commissions engine), #10 (fiscal).

## 2. Module detail (de-para)

Format: what v1 does → v2 state → what's missing to close.

### 1 · Agenda — 80%
- ✅ Calendar w/ statuses+transitions, booking CRUD, financial bridge (auto service-order), confirmations queue, cancellations w/ reasons, waitlist w/ auto-conversion, execution checklist (forms+stock), schedule rules (buffer/advance/concurrency), locations.
- ⚠️ Divergences (QA): status vocab (v1 `waiting`/`unmarked` vs v2 `in_progress`, no unmarked); v1 logs every status change (`appointment_status_logs`) — v2 equivalent unverified.
- ⛔ Missing: **professional resource columns + drag-and-drop reschedule** (v1's daily-driver interaction), month view parity, pending public-booking approvals (no public surface), holidays registry, Google-sync edge fn deploy.

### 2 · Clientes — 75%
- ✅ Care profile (lifecycle/stage/anamnesis/alerts), 5 real tabs (Perfil/Pedidos-canonical/Linha do Tempo/Documentos/Extrato), lead→client conversion, alias routes for old bookmarks.
- ⛔ Missing: client **files + folders**, **photos before/after + folders**, pets, per-client schedule view, invoice preview, interactions log depth, registration forms on profile, **portal access token/QR** (→ #20).

### 3–4 · Dashboard & Relatórios — 80% / 85%
- ✅ 9 live KPIs, Today's Schedule, onboarding; 11 `rep_*` reports incl. queues + accounting dimensions.
- ⛔ Missing: avg-rating (no ratings source — depends on reviews, v1 has review_surveys), occupancy (needs slot-capacity view), product-sales split; KPI detail modal; franchisor dashboard; **custom panel builder + public TV panels** (#24).

### 5–8 · Financeiro — 65% core
- ✅ Payables/receivables (+recurring), cash registers (structure), statements, cards view, reconciliation w/ dimension-aware scoring, chart-of-accounts + cost centers as dimensions, PlugBank sync edge fn.
- ⛔ Missing: **installments** (v1 `*_installments` everywhere), invoices model w/ adjustments/discounts, receiving-fee configs per card brand, credit-card invoice mirror, **CNAB 240**, **payroll import**, expense AI extraction, financial goals, payment-method depth (split/PIX config), double-entry/period close, **commission calculation engine + payout flow** (#7), verified open/close caixa UX (#8).

### 9–10 · Estoque & Fiscal — 55% / 0%
- ✅ Products (sale/ingredient), stock movements, categories.
- ⛔ Missing: product tabs (fiscal/asset/intermediate/options/channels/barcodes), stock **positions** + labels + usage audit, recipes+ingredients (+AI), supplier mappings, product media; entire fiscal cluster (DANFE import/conciliation, DFe inbox, A1 cert, fiscal groups → plugin-fiscal-br).

### 11 · Serviços & Preços — 70%
- ✅ Services+categories, packages (+items/validity/maxUses), price tables (+items), price variations (with a real resolution engine in agenda lookups), default products/templates per service.
- ⛔ Missing: **package session consumption/redemption at booking** (the feature that makes packages real), package unit-shares, service revisions.

### 12–14 · CRM / Marketing / Comunicação — 60% / 10% / 5%
- ✅ CRM pipeline/leads/deals/quotes/activities; origins registry.
- ⛔ CRM: segments (VIP/inactive/potential), loyalty, referrals, birthdays/returns, sales journey+executions, sales goals. Marketing: **everything** (campaigns w/ AI assets, audience, brand kit, landing pages+metrics, review surveys) — current screens are demo arrays. Comunicação: Twilio WhatsApp (2-way chat, templates, dispatch log, AI auto-reply), message events.

### 15–16 · Formulários / Contratos — 50% / 10%
- ✅ Template CRUD w/ kinds (incl. anamnesis/consent), categories, service-default forms, filled docs on client + checklist.
- ⛔ Missing: template **editor** (field types registry), standalone **filler** UX (v1 FormFiller), required-field rules per screen/entity, field-visibility (data hiding), **stencil editor + camera capture**, contract generation + tags + **signature canvas**.

### 17–18 · RH / Escalas — 5% / 15%
- ⛔ v1's 13-satellite HR cluster (benefits→PPE) and shift scheduling (templates/requirements/assignments/logs) have no v2 counterpart; only staff registry + working-hours rules exist. Destination: future plugin-hr; escalas likely an agenda-lane extension.

### 19–24 · Public & growth surfaces — 0–30%
All blocked on the same SDK primitive: **share tokens** (public, token-scoped access) + attachments. v1 proves demand: online booking (`/booking/:configId` + approval queue), client portal (`/cliente/:token`), TV panels (`/painel/:code`), landing pages (`/lp/...`), public reviews. v2 has none; `allowOnlineBooking` flag already exists on schedule rules awaiting the surface.

### 25 · Auth/Permissions — 85% (v2 ahead in kind)
v2's deny-by-default RBAC + 6 profiles + native invites is architecturally ahead of v1's opt-in default-allow matrix. Missing vs v1: per-employee/professional rule editor UI depth, action-log surface. (v1's "permissions exist but enforcement off by default" is an anti-goal — do not port.)

## 3. Cross-cutting gaps (SDK primitives v1 implies)

| Primitive | v1 evidence | Blocks |
|---|---|---|
| **Share tokens** (public token-scoped surfaces) | booking config, client portal, TV panels, LPs | #19 #20 #24 |
| **Attachments** (files/photos + folders on any entity) | client files/photos, professional attachments, bill attachments | #22, #2, #5, #17 |
| **Messaging/channel layer** (send, templates, dispatch log, webhook) | whatsapp_* + message_* clusters | #13 #14, agenda auto-confirmations |
| **Policy/calculation engine** (rules → computed outcomes) | commission rules/criteria/functions; discount rules; price variations (partially built in v2) | #7, discounts |
| Signature/annotation field types | contract signature canvas, stencil capture | #15 #16 |

These map to the fayz-sdk roadmap's plugin destinations (FAY-1220) and should be pulled by this app's waves, not built speculatively (second-real-consumer rule — norman/resto/course are the other pullers).

## 4. Maintenance rule

This file is the **single de-para**; `beautyplace/docs/features.md` keeps the exhaustive v1 catalog; FAY-1220 keeps the checkbox ledger. When a module lands in v2: update the module's % here, tick FAY-1220, and add/adjust the QA journey in [USER-JOURNEYS.md](USER-JOURNEYS.md). Percentages not touched for >30 days should be treated as suspect.
