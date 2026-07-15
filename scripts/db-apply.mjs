// Fayz migration applier (thin Management-API executor — the editor-host path).
//
// ⚠️ DEPRECATED (core-v1 / industry-pools). SUPERSEDED by the `fayz db apply`
// CLI. This legacy applier assumes the pre-core-v1 world:
//   * a `saas_core` schema (dissolved into `public` by @fayz-ai/db
//     000_core_v1_convert.sql — persons->people, bookings->appointments,
//     booking_items->appointment_items);
//   * plugin tables under legacy names (renamed to plg_<plugin>_* by each
//     plugin's 000_plg_rename.sql);
//   * the app's own drizzle/*.sql baseline (which recreates saas_core stubs and
//     the bespoke `appointments` extension — now colliding with core
//     `public.appointments`; it must be regenerated as `appointment_execution`).
// Do NOT run this against a converted pool. Provision/seed via `fayz db apply`,
// which pulls @fayz-ai/db (public core), each plugin's migrations (incl.
// 000_plg_rename) and the app's regenerated extension migrations. The
// ENABLED_PLUGINS list + SDK paths below are kept only for historical reference.
//
// Applies, in order: (1) Drizzle-generated table migrations, then (2) each
// ENABLED plugin's companion SQL (functions / views / RLS / grants the Drizzle
// diff doesn't cover). This is how plugin-specific migrations JOIN the pipeline:
// enabling a plugin pulls its src/migrations/*.sql here.
//
// Plugin companion SQL is authored idempotent (CREATE OR REPLACE / IF NOT EXISTS
// / guarded DO blocks), so re-runs are safe. A real ledger (skip-applied +
// checksum drift) is the productionization step; this proves the loop.
//
// Usage: SUPABASE_PAT=sbp_... node scripts/db-apply.mjs [--plugins-only]
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const REF = process.env.SUPABASE_REF || 'gphxclpkbtbucoqclbco'
const PAT = process.env.SUPABASE_PAT
if (!PAT) { console.error('✗ SUPABASE_PAT env var required'); process.exit(1) }

const CWD = process.cwd()
const SDK = resolve(CWD, '../../fayz-sdk')
const pluginsOnly = process.argv.includes('--plugins-only')

// Enabled plugins that ship companion SQL, in provisioning order.
// (Mirror the app's plugin list; financial before crm since CRM RPCs its fn.)
const ENABLED_PLUGINS = ['plugin-financial', 'plugin-crm', 'plugin-inventory', 'plugin-forms', 'plugin-tasks', 'plugin-marketing']

async function run(sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) { console.error(`  ✗ ${label} → ${res.status} ${text.slice(0, 400)}`); process.exit(1) }
  console.log(`  ✓ ${label}`)
}

function sqlFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => resolve(dir, f))
}

if (!pluginsOnly) {
  console.log('▸ Spine — @fayz-ai/db (saas_core, fresh-provision only)')
  for (const f of sqlFiles(resolve(SDK, 'packages', 'db', 'migrations'))) {
    await run(readFileSync(f, 'utf8'), `@fayz-ai/db/${f.split('/').pop()}`)
  }
  console.log('▸ Drizzle-generated tables (drizzle/)')
  for (const f of sqlFiles(resolve(CWD, 'drizzle'))) {
    await run(readFileSync(f, 'utf8'), `drizzle/${f.split('/').pop()}`)
  }

  // saas_core catalog seed (plans + granular permissions + salon roles). Depends
  // on the spine tables above; idempotent (ON CONFLICT upserts).
  const seed = resolve(CWD, 'supabase', 'seed-saas-core.sql')
  if (existsSync(seed)) {
    console.log('▸ saas_core seed (plans + RBAC catalog + roles)')
    await run(readFileSync(seed, 'utf8'), 'supabase/seed-saas-core.sql')
  }
}

for (const p of ENABLED_PLUGINS) {
  console.log(`▸ ${p} (companion SQL)`)
  for (const f of sqlFiles(resolve(SDK, 'plugins', p, 'src', 'migrations'))) {
    await run(readFileSync(f, 'utf8'), `${p}/${f.split('/').pop()}`)
  }
}

await run("NOTIFY pgrst, 'reload schema';", 'reload PostgREST schema cache')
console.log('✓ migration pipeline complete')
