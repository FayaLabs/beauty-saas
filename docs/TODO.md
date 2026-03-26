# Beauty SaaS — TODO Checklist

## Epic 0: Foundation
- [x] Supabase project connected
- [x] Environment variables configured (.env)
- [x] Migrations 00001-00007 applied
- [x] Auth switched to real Supabase
- [x] Org switched to real Supabase
- [x] 23 plugins seeded in DB with dependencies
- [x] Vertical defaults configured (beauty niche)
- [x] Login/signup working with real auth
- [x] Topbar layout with beauty theme

## Epic 1: CRUD Enhancements (saas-core)
- [ ] 1.1 Detail page component (`/:id` read-only view)
- [ ] 1.1 Hero section (avatar/image, name, key fields)
- [ ] 1.1 Tabbed content area with WidgetSlot zone
- [ ] 1.1 Default "Overview" tab showing all fields
- [ ] 1.2 Relation field type (`type: 'relation'`)
- [ ] 1.2 Async search dropdown for relation fields
- [ ] 1.2 Display name rendering in table columns
- [ ] 1.3 Field groups / sections in EntityDef
- [ ] 1.3 Two-column form layout
- [ ] 1.3 Conditional field visibility

## Epic 2: Base Entity Plugins
- [ ] 2.1 **clients** — DB migration (clients, client_photos, client_files, origins)
- [ ] 2.1 **clients** — EntityDef + createCrudPage
- [ ] 2.1 **clients** — Detail page (Overview, Photos, Files, Notes tabs)
- [ ] 2.1 **clients** — Widget zone `clients.detail.tabs`
- [ ] 2.1 **clients** — Register as plugin manifest
- [ ] 2.2 **staff** — DB migration (staff_members, professions, schedules)
- [ ] 2.2 **staff** — EntityDef + createCrudPage
- [ ] 2.2 **staff** — Detail page (Overview, Schedule, Permissions tabs)
- [ ] 2.2 **staff** — Widget zone `staff.detail.tabs`
- [ ] 2.2 **staff** — Register as plugin manifest
- [ ] 2.3 **services** — DB migration (services, categories, packages)
- [ ] 2.3 **services** — EntityDef + createCrudPage
- [ ] 2.3 **services** — Detail page (Overview, Categories, Packages tabs)
- [ ] 2.3 **services** — Widget zone `services.detail.tabs`
- [ ] 2.3 **services** — Register as plugin manifest

## Epic 3: Core Workflow Plugins
- [ ] 3.1 **scheduling** — DB migration (appointments, appointment_services, waiting_list, service_locations)
- [ ] 3.1 **scheduling** — Calendar view (react-big-calendar)
- [ ] 3.1 **scheduling** — Appointment CRUD (create, reschedule, cancel)
- [ ] 3.1 **scheduling** — Appointment lifecycle (scheduled → confirmed → completed)
- [ ] 3.1 **scheduling** — Inject "Appointments" tab into clients + staff detail
- [ ] 3.1 **scheduling** — Waiting list management
- [ ] 3.2 **financial** — DB migration (invoices, items, movements, bank_accounts, cash_register)
- [ ] 3.2 **financial** — Multi-view dashboard (receivables, payables, cash register)
- [ ] 3.2 **financial** — Invoice creation + payment tracking
- [ ] 3.2 **financial** — Cash register sessions (open/close)
- [ ] 3.2 **financial** — Inject "Payments" tab into clients detail
- [ ] 3.3 **inventory** — DB migration (products, categories, stock_movements, locations)
- [ ] 3.3 **inventory** — Multi-view dashboard (products, movements, categories)
- [ ] 3.3 **inventory** — Stock movement tracking (in/out/adjustment)
- [ ] 3.3 **inventory** — Inject "Default Products" tab into services detail

## Epic 4: Secondary Plugins
- [ ] 4.1 **marketing** — Templates, automations, dispatch log, edge function
- [ ] 4.2 **crm** — Quotes, sales journey, pipeline board
- [ ] 4.3 **custom-forms** — Form builder, filler, response storage
- [ ] 4.4 **contracts** — Template builder, generation, signature capture
- [ ] 4.5 **pricing** — Price tables, variations, payment method configs
- [ ] 4.6 **commissions** — Rules engine, calculation, payouts

## Epic 5: Integration Addons
- [ ] 5.1 **whatsapp** — Twilio integration, templates, 2-way chat, edge functions
- [ ] 5.2 **pix-payments** — QR code generation, webhook, auto-reconciliation
- [ ] 5.3 **public-booking** — Booking wizard, self-service portal, edge function

## Epic 6: Beauty Journey
- [ ] 6.1 **beauty-journey** — Service journey timeline
- [ ] 6.1 **beauty-journey** — Before/after photos per visit
- [ ] 6.1 **beauty-journey** — Service revisions + professional notes
- [ ] 6.1 **beauty-journey** — Inject "Journey" tab into clients detail

## Epic 7: Analytics, Search & Dashboard
- [ ] 7.1 **analytics** — Report engine with dynamic categories
- [ ] 7.1 **analytics** — Charts (Recharts), period filters, export
- [ ] 7.2 **global-search** — Cross-entity normalized search
- [ ] 7.2 **global-search** — Topbar search widget (replace placeholder)
- [ ] 7.3 **dashboard** — Real KPIs from DB (appointments, revenue, clients)
- [ ] 7.3 **dashboard** — Today's schedule from real appointments

## Epic 8: Polish & Production
- [ ] 8.1 **field-config** — Per-role field visibility and required fields
- [ ] 8.2 **equipment** — Equipment catalog and asset tracking
- [ ] 8.3 Dark mode audit across all plugins
- [ ] 8.4 Mobile responsiveness for all plugin UIs
- [ ] 8.5 Skeleton loaders, error boundaries, retry logic
- [ ] 8.6 i18n — Portuguese (BR) translations

---

**Progress:** Epic 0 complete. Next up: Epic 1 (CRUD Enhancements).
