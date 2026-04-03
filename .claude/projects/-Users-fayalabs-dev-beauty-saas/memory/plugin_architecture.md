---
name: Plugin architecture pattern
description: Established pattern for saas-core plugins — factory, types, provider, store, context, registries, migrations, views
type: project
---

Every saas-core plugin follows this structure:
- `index.ts` — `createXxxPlugin(options)` factory returning `PluginManifest`
- `types.ts` — pure TS types, zero deps
- `data/types.ts` — `XxxDataProvider` interface
- `data/mock.ts` — in-memory mock provider
- `store.ts` — zustand UI state store
- `XxxContext.tsx` — React contexts (config, provider, store) + hooks
- `XxxPage.tsx` — main page using `ModulePage` + `useModuleNavigation`
- `registries.ts` — `PluginRegistryDef[]` for CRUD settings
- `views/` — all sub-views
- `components/` — settings panel, onboarding wizard
- `migrations/` — SQL files
- `README.md` — documentation

Plugins are imported via subpath: `@fayz/saas-core/plugins/financial`

**Why:** This pattern was established with the Financial plugin and validated with Inventory. It will be the template for 100+ plugins.
**How to apply:** When creating any new plugin, follow this exact structure. Check the financial or inventory README for reference.
