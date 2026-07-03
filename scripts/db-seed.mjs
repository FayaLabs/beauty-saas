// Seed-only applier — pushes ONLY supabase/seed-saas-core.sql (plans + granular
// permission catalog + salon roles) to the live project via the Management API.
// Unlike db-apply.mjs this does NOT re-run spine/drizzle/plugin migrations, so it
// is safe against an already-provisioned DB. The seed is idempotent (ON CONFLICT
// upserts / CREATE OR REPLACE), so re-runs are safe.
//
// Usage: SUPABASE_PAT=sbp_... node scripts/db-seed.mjs
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const REF = process.env.SUPABASE_REF || 'gphxclpkbtbucoqclbco'
const PAT = process.env.SUPABASE_PAT
if (!PAT) { console.error('✗ SUPABASE_PAT env var required'); process.exit(1) }

const seed = resolve(process.cwd(), 'supabase', 'seed-saas-core.sql')
if (!existsSync(seed)) { console.error(`✗ not found: ${seed}`); process.exit(1) }

async function run(sql, label) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) { console.error(`  ✗ ${label} → ${res.status} ${text.slice(0, 600)}`); process.exit(1) }
  console.log(`  ✓ ${label}`)
}

console.log(`▸ Seeding saas_core catalog + salon roles → ${REF}`)
await run(readFileSync(seed, 'utf8'), 'supabase/seed-saas-core.sql')
await run("NOTIFY pgrst, 'reload schema';", 'reload PostgREST schema cache')
console.log('✓ seed complete')
