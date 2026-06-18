// Fayz migration applier (thin Management-API executor — the editor-host path).
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
const ENABLED_PLUGINS = ['plugin-financial', 'plugin-crm', 'plugin-inventory', 'plugin-forms', 'plugin-tasks']

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
}

for (const p of ENABLED_PLUGINS) {
  console.log(`▸ ${p} (companion SQL)`)
  for (const f of sqlFiles(resolve(SDK, 'plugins', p, 'src', 'migrations'))) {
    await run(readFileSync(f, 'utf8'), `${p}/${f.split('/').pop()}`)
  }
}

await run("NOTIFY pgrst, 'reload schema';", 'reload PostgREST schema cache')
console.log('✓ migration pipeline complete')
