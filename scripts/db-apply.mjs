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
import { basename, resolve } from 'node:path'

const REF = process.env.SUPABASE_REF
const PAT = process.env.SUPABASE_PAT
if (!REF) { console.error('SUPABASE_REF env var required'); process.exit(1) }
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
    // Fresh financial databases need this compatibility column before the
    // split-payment migration. Older app migration chains created it separately.
    if (p === 'plugin-financial' && basename(f) === '008_split_payment_movements.sql') {
      await run(
        `ALTER TABLE public.financial_movements
         ADD COLUMN IF NOT EXISTS payment_method_type_id uuid
         REFERENCES public.payment_method_types(id);`,
        'beauty/financial-movement-type-compat',
      )
    }
    await run(readFileSync(f, 'utf8'), `${p}/${basename(f)}`)
  }
}

console.log('â–¸ Google Calendar addon')
for (const f of sqlFiles(resolve(CWD, 'supabase', 'migrations'))) {
  await run(readFileSync(f, 'utf8'), `google-calendar/${basename(f)}`)
}

console.log('â–¸ TecnoSpeed Windows bridge (Open Finance)')
for (const f of sqlFiles(resolve(CWD, 'local-services', 'tecnospeed-bridge', 'supabase', 'migrations'))) {
  await run(readFileSync(f, 'utf8'), `tecnospeed-bridge/${f.split('/').pop()}`)
}

await run("NOTIFY pgrst, 'reload schema';", 'reload PostgREST schema cache')
console.log('✓ migration pipeline complete')
