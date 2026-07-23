# AGENTS.md — operating manual for agents working in beauty-saas

**Read first, every session.** This is an **app** repo, not the SDK. Product as-is:
[docs/PRODUCT.md](docs/PRODUCT.md). Features still to migrate from v1: [docs/GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md).
What's left to stabilize + known bugs: [docs/FOUNDATIONS.md](docs/FOUNDATIONS.md).

## What this repo is

**BeautySoft v2** — the reference consumer of the fayz-sdk. A standalone Vite app that composes
published `@fayz-ai/*` packages via `defineSaas(config)` → `renderApp`. It is the **v2 of
`~/dev/beautyplace`** (the mature v1). Everything app-specific lives in **config, registry
overrides, and one local plugin (`src/plugins/openbanking`)** — the richest `defineSaas` config in
the fleet (`src/config/app.tsx`).

Three-repo topology: `~/dev/fayz-sdk` (the engine — `@fayz-ai/*`) · `~/dev/fayz-app/*` (dogfood
apps, this is one) · `~/dev/fayz` (the platform: AI builder, containers, publish).

## The golden rule — do not get this wrong

> **Zero SDK forks.** The spine (Ring 0) and all shared behavior live in the SDK; the app
> **consumes**. App-specific code goes in `src/config/*`, registry/CRUD overrides, custom lookups,
> or a local addon plugin — **never** by copying SDK tables, migrations, or components into the app.

If a foundation is missing (attachments, share-tokens, RLS-by-location, a theme wiring), the fix
belongs in `~/dev/fayz-sdk`, and this app pulls it. Forking here recreates the diverging "3 copies"
problem (see the archived `docs/archive/foundation-critique-2026-06.md`). The SDK contracts are canon:

| Need | Read (in `~/dev/fayz-sdk/docs/`) |
|---|---|
| Topology, layers, invariants | `ARCHITECTURE.md` |
| Plugin contract + manifest | `PLUGINS.md`, `PLUGIN-PATTERNS.md` |
| Rings, migrations, RLS canon | `DATA-MODEL.md` |
| 7-level customization ladder | `CUSTOMIZATION.md` |
| How SDK work is done | `~/dev/fayz-sdk/AGENTS.md` |

## The deploy model

Apps run **inside fayz** (Lovable-style). Two build modes, both must stay green:
- **Source mode (local dev):** `@fayz-ai/*` resolve → `../../fayz-sdk/packages/*/src` via tsconfig
  paths + `fayzVite` sibling detection. No republish while developing.
- **Published mode (the container):** npm packages only. **Never** let a build path (tailwind/
  postcss/vite config, imports) reference `../../fayz-sdk` — it doesn't exist there.

SDK changes reach this app's production only via SDK npm publish + a `package.json` spec bump here.

## Working conventions (hard rules)

1. **Parallel lanes are real.** The founder and other Claude/Codex sessions edit the SDK and these
   apps concurrently. Stage surgically (`git add <file>`), **never `git add -A`** without reading
   `git status` first; never commit/revert/sweep foreign WIP. A shared-branch SDK breakage (e.g.
   `useGlobalSearch: useRouter is not defined`) is usually the branch owner's unfinished WIP — do
   not blind-patch it. See [docs/FOUNDATIONS.md §4](docs/FOUNDATIONS.md#4-known-issues--bloqueadores-de-lançamento).
2. **"Green" means typecheck + build + dev-smoke** (dev server serves 200 + console clean), not
   type-green alone.
3. **Live-DB protocol.** This app's Supabase project holds **real data**. Only additive/idempotent
   migrations; inventory + destructive-scan before any apply; report-before-destructive. No core
   migration runner yet (`[planned FAY-1205]`) — new core DDL is applied by hand.
4. **Founder communication:** coordination asks in plain **pt-BR**, no jargon; code, commits and
   Linear stay in English. Never store credentials the founder pastes (rotate-worthy); `.env`
   values are never printed — names only.
5. **Verify before deleting/overwriting**; report failures with output; commits end with the
   `Co-Authored-By: Claude` trailer and explain the *why*.

## Doc map

| Doc | What it holds |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | The product as-is, module by module, honest status (pt-BR) |
| [docs/GAP-ANALYSIS.md](docs/GAP-ANALYSIS.md) | v1→v2 feature parity %, module by module — **what to migrate** |
| [docs/FOUNDATIONS.md](docs/FOUNDATIONS.md) | Cross-cutting foundations + **what's left to stabilize + known bugs** |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How this app is built on the SDK (config, plugins, data, RBAC) |
| [docs/USER-JOURNEYS.md](docs/USER-JOURNEYS.md) | QA scripts to run on both apps and surface divergences |
| [docs/data-model.md](docs/data-model.md) · [docs/testing.md](docs/testing.md) | Deep data-model reference · how to test |
| [docs/archive/](docs/archive/) | Superseded docs — history only, do not follow |

Ledger of record: Linear **FAY-1220** (migration checkbox ledger). v1 catalog: `~/dev/beautyplace/docs/`.
