// One-off: seed the Reconciliation (conciliação) demo data via the Supabase
// Management API (same path as db-apply.mjs). Idempotent + tagged 'demo-rec-*'.
//
// Prereq: the reconciliation columns must exist — run `pnpm db:apply --plugins-only`
// first (applies plugin-financial 007_reconciliation.sql).
//
// Usage: SUPABASE_PAT=sbp_... node scripts/seed-reconciliation.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REF = process.env.SUPABASE_REF || 'gphxclpkbtbucoqclbco'
const PAT = process.env.SUPABASE_PAT
if (!PAT) { console.error('✗ SUPABASE_PAT env var required'); process.exit(1) }

const sql = readFileSync(resolve(process.cwd(), 'scripts/seed-reconciliation-demo.sql'), 'utf8')

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
const text = await res.text()
if (!res.ok) { console.error(`✗ seed failed → ${res.status} ${text.slice(0, 600)}`); process.exit(1) }
console.log('✓ reconciliation demo data seeded (4 bank lines + 2 internal matches for maia.silvio.rj@gmail.com)')
console.log('  open http://localhost:5180/#/financial/reconciliation')
