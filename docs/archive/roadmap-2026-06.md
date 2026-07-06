# Roadmap: From Dumb-SaaS to Functional Beauty Platform

Latest executive checkpoint: [`docs/roadmap/status-2026-06-14.md`](./roadmap/status-2026-06-14.md)

## Context

We have:
- **saas-core**: Production-ready framework (real Supabase auth, org/tenant RBAC, CRUD data providers, plugin runtime, 7 DB migrations, theme system)
- **beauty-saas**: Working topbar layout with real Supabase auth, 4 real pages (Dashboard, Appointments, Clients CRUD, Services CRUD) + 5 placeholder pages
- **23 plugin specs**: Fully documented in `saas-core/docs/plugins/`, registered in DB via migration 00007
- **beautyplace**: Reference app at localhost:8080 with all features implemented (see REFERENCE.md)

We need to go from mock/placeholder to a fully functional beauty salon SaaS. Be aware of i18n translations for all plugins and modules.
---

## Epic 0: Foundation — Connect Real Database & Auth `DONE`
> **Goal:** Replace mocks with real Supabase. After this, users can sign up, log in, create orgs, and see empty pages backed by real DB.

### 0.1 Supabase Project Setup `DONE`
- Create/configure Supabase project (or use existing)
- Set env vars in beauty-saas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Run all 7 migrations (00001-00007) against the DB
- Verify tables exist: `tenants`, `profiles`, `tenant_members`, `plugins`, `tenant_plugins`, `verticals`, etc.

### 0.2 Switch Auth to Real `DONE`
- Change `auth: { adapter: 'mock' }` → `auth: { adapter: 'supabase', requireAuth: true }`
- Add login page logo/branding for beauty theme
- Test: sign up, email verification, sign in, sign out, OAuth (optional)

### 0.3 Switch Org to Real `DONE`
- Change `organization: { adapter: 'mock' }` → `organization: { adapter: 'supabase', multiOrg: true }`
- On first sign-in, auto-create org via `provision_tenant_plugins` RPC
- Verify: org switcher works, team tab shows real members, invite flow works

### 0.4 Plugin Provisioning `DONE`
- 23 plugins seeded with 29 dependencies
- Vertical defaults configured for beauty niche
- `useTenantPlugins` hook loads active plugins from DB

---

## Epic 1: Core CRUD Enhancements in saas-core
> **Goal:** Upgrade `createCrudPage` and add detail pages with tab injection. This is needed BEFORE building plugins, since every entity plugin uses it.

### 1.1 Entity Detail Page
- Add a **read-only detail view** at `/:id` (separate from edit at `/:id/edit`)
- Detail page: hero section (name, avatar/image, key fields) + tabbed content area
- Tab container with `WidgetSlot` zone: `<entityName>.detail.tabs`
- Default tab: "Overview" showing all fields in read layout

### 1.2 Relation Fields
- Add `type: 'relation'` to `FieldDef` — renders as a searchable select
- Config: `{ table, displayField, valueField, tenantScoped }`
- In table view: renders display name, not UUID
- In form view: async search dropdown

### 1.3 Better Form Layouts
- Support field groups / sections in EntityDef
- Two-column layout for wider forms
- Conditional field visibility

**Estimated effort:** 3-5 days
**Deliverable:** CRUD pages support detail views, tabs, relation fields, and better layouts

---

## Epic 2: Base Entity Plugins (Wave 1 — No Dependencies)
> **Goal:** Create the 3 foundational entity plugins that everything else depends on. Each uses `createCrudPage()` for CRUD + custom detail page.

### 2.1 Plugin: `clients`
- EntityDef: name, email, phone, birth_date, gender, address fields, origin, notes, warnings, avatar
- DB migration: `clients` table + `client_photos`, `client_files`, `client_service_notes`, `origins`
- Detail page with tabs: Overview, Photos, Files, Notes
- Widget zone: `clients.detail.tabs` (for other plugins to inject into)
- Navigation: main section, position 1, icon Users
- **Spec:** `saas-core/docs/plugins/01-clients.md`

### 2.2 Plugin: `staff`
- EntityDef: name, email, phone, role (professional/employee), profession, avatar
- DB migration: `staff_members`, `professions`, `staff_schedules`, `staff_schedule_exceptions`
- Detail page with tabs: Overview, Schedule, Permissions
- Widget zone: `staff.detail.tabs`
- Navigation: main section, position 3, icon UserCog
- **Spec:** `saas-core/docs/plugins/02-staff.md`

### 2.3 Plugin: `services`
- EntityDef: name, category, duration, price, color, image, is_active
- DB migration: `services`, `service_categories`, `service_packages`, `service_package_items`
- Detail page with tabs: Overview, Categories, Packages
- Widget zone: `services.detail.tabs`
- Navigation: main section, position 4, icon Briefcase
- **Spec:** `saas-core/docs/plugins/03-services.md`

**Estimated effort:** 3-5 days (can parallelize across agents)
**Deliverable:** 3 working plugins with real DB, CRUD, and detail pages.

---

## Epic 3: Core Workflow Plugins (Wave 2 — Depend on Wave 1)
> **Goal:** The big operational plugins that make the app useful.

### 3.1 Plugin: `scheduling`
- **Depends on:** clients, staff, services
- Calendar view (react-big-calendar or similar)
- Appointment CRUD: client, staff, service(s), date/time, status
- DB migration: `appointments`, `appointment_services`, `waiting_list`, `service_locations`, `pending_appointments`
- Lifecycle: scheduled → confirmed → in_progress → completed/cancelled/no_show
- Injects "Appointments" tab into `clients.detail.tabs` and `staff.detail.tabs`
- **Spec:** `saas-core/docs/plugins/04-scheduling.md`

### 3.2 Plugin: `financial`
- **Depends on:** clients
- Multi-view dashboard: Receivables, Payables, Cash Register, Cards, Statements
- DB migration: `invoices`, `invoice_items`, `financial_movements`, `bank_accounts`, `cash_register_sessions`, `payment_methods`, `chart_of_accounts`
- Auto-create invoice on appointment completion
- Injects "Payments" tab into `clients.detail.tabs`
- **Spec:** `saas-core/docs/plugins/05-financial.md`

### 3.3 Plugin: `inventory`
- **No hard dependencies** (but connects to services for default products)
- Multi-view dashboard: Products, Movements, Categories, Locations, Recipes
- DB migration: `products`, `product_categories`, `stock_movements`, `stock_locations`, `stock_positions`, `measurement_units`
- Injects "Default Products" tab into `services.detail.tabs`
- **Spec:** `saas-core/docs/plugins/06-inventory.md`

**Estimated effort:** 7-10 days
**Deliverable:** Full appointment booking, invoicing, cash register, and inventory management

---

## Epic 4: Secondary Plugins (Wave 3)
> **Goal:** Add-on features that enrich the platform.

### 4.1 Plugin: `marketing` (depends: clients)
- Message templates, automation rules, dispatch log
- Edge function: `message-dispatcher`
- **Spec:** `saas-core/docs/plugins/08-marketing.md`

### 4.2 Plugin: `crm` (depends: clients)
- Quotes, sales journey, pipeline board
- **Spec:** `saas-core/docs/plugins/13-crm.md`

### 4.3 Plugin: `custom-forms` (no deps)
- Form builder, field editor, form filler, response storage
- **Spec:** `saas-core/docs/plugins/10-custom-forms.md`

### 4.4 Plugin: `contracts` (depends: clients, services)
- Template builder, variable substitution, signature capture
- **Spec:** `saas-core/docs/plugins/09-contracts.md`

### 4.5 Plugin: `pricing` (depends: services)
- Price tables, variations, payment method configs
- **Spec:** `saas-core/docs/plugins/11-pricing.md`

### 4.6 Plugin: `commissions` (depends: staff, services, financial)
- Commission rules engine, calculation, staff payouts
- **Spec:** `saas-core/docs/plugins/12-commissions.md`

**Estimated effort:** 8-12 days (highly parallelizable)
**Deliverable:** Marketing automation, CRM pipeline, custom forms, contracts, pricing, commissions

---

## Epic 5: Integration Addons (Wave 4)
> **Goal:** External service integrations.

### 5.1 Plugin: `whatsapp` (depends: clients)
- Twilio integration, template management, 2-way chat
- Edge functions: `whatsapp-webhook`, `whatsapp-send`, `transcribe-audio`
- **Spec:** `saas-core/docs/plugins/18-whatsapp.md`

### 5.2 Plugin: `pix-payments` (depends: financial)
- PIX QR code generation, payment webhooks
- **Spec:** `saas-core/docs/plugins/19-pix-payments.md`

### 5.3 Plugin: `public-booking` (depends: scheduling, services, staff)
- Public booking wizard, client self-service portal
- **Spec:** `saas-core/docs/plugins/20-public-booking.md`

**Estimated effort:** 5-7 days
**Deliverable:** WhatsApp messaging, PIX payments, online booking

---

## Epic 6: Vertical-Specific Plugin
> **Goal:** The beauty differentiator.

### 6.1 Plugin: `beauty-journey` (depends: clients, services, scheduling)
- Client service journey timeline
- Before/after photos per visit
- Service revisions and professional notes
- Injects "Journey" tab into `clients.detail.tabs`
- **Spec:** `saas-core/docs/plugins/21-beauty-journey.md`

**Estimated effort:** 3-4 days
**Deliverable:** The unique selling point for beauty vertical

---

## Epic 7: Analytics, Search & Dashboard
> **Goal:** Real data on the dashboard and reporting.

### 7.1 Plugin: `analytics`
- Report engine reading across all active plugin tables
- Charts (Recharts), period filters, CSV/PDF export
- **Spec:** `saas-core/docs/plugins/07-analytics.md`

### 7.2 Plugin: `global-search`
- Topbar search widget with cross-entity normalized search
- **Spec:** `saas-core/docs/plugins/14-global-search.md`

### 7.3 Real Dashboard
- Replace mock Dashboard in beauty-saas with real data
- KPI cards pulling from appointments, invoices, clients tables
- Today's schedule from real appointments

**Estimated effort:** 4-6 days
**Deliverable:** Real dashboard, reports, and global search

---

## Epic 8: Polish & Production
> **Goal:** Production readiness.

- 8.1 Field Config Plugin — per-role field visibility
- 8.2 Equipment Plugin — equipment catalog
- 8.3 Dark Mode Audit — verify all plugins
- 8.4 Mobile Responsiveness — test all plugin UIs
- 8.5 Error Handling — skeleton loaders, error boundaries
- 8.6 i18n — Portuguese (BR) translations

**Estimated effort:** 5-7 days
**Deliverable:** Production-ready, polished app

---

## Execution Summary

| Epic | Name | Est. Days | Status |
|------|------|-----------|--------|
| 0 | Foundation (DB + Auth) | 1-2 | DONE |
| 1 | CRUD Enhancements | 3-5 | TODO |
| 2 | Base Entity Plugins | 3-5 | TODO |
| 3 | Core Workflow Plugins | 7-10 | TODO |
| 4 | Secondary Plugins | 8-12 | TODO |
| 5 | Integration Addons | 5-7 | TODO |
| 6 | Beauty Journey | 3-4 | TODO |
| 7 | Analytics & Dashboard | 4-6 | TODO |
| 8 | Polish & Production | 5-7 | TODO |
| **TOTAL** | | **~40-60 days** | |

## Parallelization Strategy

```
Epic 0 (Foundation) ............ DONE
  |
Epic 1 (CRUD Enhancements)
  |
Epic 2 (clients + staff + services) .......... 3 agents in parallel
  |
Epic 3 (scheduling + financial + inventory) .. 3 agents in parallel
  |
  +-- Epic 4 (6 secondary plugins) ........... 3-6 agents in parallel
  +-- Epic 5 (3 integrations) ................ 3 agents in parallel
  +-- Epic 6 (beauty-journey) ................ 1 agent
  +-- Epic 7 (analytics + search) ............ 2 agents in parallel
  |
Epic 8 (Polish)
```
