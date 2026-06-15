# beauty-saas Development Backlog

> Derived from [`gap-analysis.md`](./gap-analysis.md) (rows referenced as **GA**) and the epic phases in [`fayz-sdk/docs/architecture-blueprint.md`](../../../fayz-sdk/docs/architecture-blueprint.md) (**BP §8 P0–P6**).
> **Dependency type:** `app` (this repo: config/pages/types) · `plugin` (fayz-sdk plugin code) · `sdk-core` (new primitive in @fayz/core or saas) · `db` (Supabase migrations/views/functions).
> Effort: S (<1 day) · M (days) · L (week+).

## P0 — Broken now, fix before anything else

| # | Item | GA ref | Effort | Dep | Notes |
|---|---|---|---|---|---|
| 1 | Fix agenda client lookup (search fires no query; only quick-create appears) | B1 | M | plugin | In bridged plugin-agenda / contactLookup wiring; booking flow is unusable without it |
| 2 | Fix agenda service lookup (completely inert) | B2 | M | plugin | Same area as #1 — likely one lookup-wiring root cause |
| 3 | Deploy `get_tenant_active_plugins` RPC (404 on every load) or guard the call | B3 | S | db | Check saas-core migrations for the function source |
| 4 | After #1–3: validate the full booking E2E (create → calendar → Today's Schedule → financial bridge order) | B1/B2 | S | — | The financial bridge (`service_order`) is currently unverifiable |

## P1 — Make the core product real

| # | Item | GA ref | Effort | Dep | Notes |
|---|---|---|---|---|---|
| 5 | Real dashboard metrics: replace the ~11 mock `compute` fns in `src/App.tsx` with Supabase queries (v_bookings, orders, persons) | B4 | M | app + db | Interim solution; long-term superseded by metric registry (BP §4.5) |
| 6 | Create the 9 missing `rep_*` views and flip reports to `available: true` | B5 | M | db | occupancy, cancellations, no_shows, peak_hours, revenue_by_service, revenue_by_professional, client_frequency, new_clients (+ summary) |
| 7 | **Public booking page** — the single largest commercial gap vs beautyplace | GA §2 public | L | sdk-core + plugin | Needs share-token/public-route primitive (BP §4.4) + plugin-booking (BP P3). Do not build app-side. |
| 8 | Reminder/confirmation messaging v1 (WhatsApp deep-link or BSP) — makes "Enviar Lembrete" quick action real | GA marketing | L | sdk-core + plugin | Messaging stack (BP P2); quick win possible with wa.me deep links app-side first |
| 9 | Delete affordance in CRUD (list row menu or detail danger zone) | B6 | S | plugin (`createCrudPage`) | Also unblocks cleaning the TESTE-CLAUDE test records |
| 10 | i18n sweep: "Scheduled", "Active", "Contact", "+ New", placeholder text, report badges | B7 | S | plugin locales | Mostly missing pt-BR keys in SDK plugins |

## P2 — Port the depth that retains salons

| # | Item | GA ref | Effort | Dep |
|---|---|---|---|---|
| 11 | Client photos & files (attachments primitive + Documentos tab backend) | GA clients | L | sdk-core (BP §4.2) |
| 12 | Client activity timeline (Atividade tab backed by interactions) | GA clients | M | plugin-crm |
| 13 | Service packages/bundles | GA services | M | plugin + BP §4.6 |
| 14 | Waiting list module in agenda | GA scheduling | M | plugin-agenda |
| 15 | Marketing v1: campaigns list/form + audience from CRM | GA marketing | L | plugin-marketing (BP P6, pull earlier if demand) |
| 16 | Commissions on policy rules (Regras already has nav) | GA financial | M | plugin + BP §4.6 |
| 17 | Contract/document generation (uses forms plugin + document engine) | GA forms | L | sdk-core (BP §4.3) |
| 18 | Stencil/annotated-capture field type (parity with beautyplace's newest feature) | GA §3 | M | sdk-core FieldType + ui |
| 19 | Client self-service portal | GA clients | L | plugin-portal (BP P3) |
| 20 | Installments, chart of accounts, cost centers | GA financial | L | plugin-financial (BP P4) |

## P3 — Generator-grade (SDK epics, beauty-saas as validation consumer)

- Metric registry + KPI panel builder (BP §4.5 → replaces item 5's interim queries)
- Policy engine UIs: price tables, discount/cancellation rules (BP §4.6)
- fiscal-br (DANFE import) & banking-br reconciliation addons (BP P5)
- Revisions/audit, full tenant field customization (BP §4.8/§4.11)
- fayz-admin control-plane scaffold + software profiles (white-label, BP §6 platform)

## Sequencing notes

- Items 7, 8, 11, 17–20 are **SDK work consumed here** — building them app-side would violate the layer model (BP §2). The app-side task is integration + config only.
- De-bridging (BP §7) runs in parallel and gates deep plugin changes: fixes #1/#2 land in the *bridged* plugin now, and survive de-bridge only if the `create*Plugin` API stays frozen.
- Dual-consumer rule: when each P2/P3 item ships, schedule its adoption in resto-saas within one phase (BP §8).

## Open items / blockers

- **beautyplace live walkthrough blocked:** `maia.silvio.rj@gmail.com` is rejected (`invalid_credentials`) by beautyplace's Supabase project (`xzihdmcyoyrjndpvlxdj`) though it works on beauty-saas. Need working credentials (or confirmation of the right project/env) to capture reference UX for booking confirmation, KPI panel builder, and the stencil form editor.
- **Test data to remove** once delete exists (item 9), tenant Glow Studio: client `TESTE-CLAUDE Maria` (`4e5c3bb3-e6dd-4dbf-8455-5b6614ba57f0`), professional `TESTE-CLAUDE Profissional`.
