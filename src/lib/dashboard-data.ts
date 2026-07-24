// Supabase-backed data helpers for the dashboard.
//
// WHY THIS EXISTS: the dashboard previously read counts via `fayz.data.*`, which
// calls the Fayz *platform runtime API* (`/api/projects/.../database/tables`).
// That backend only exists when the app runs inside the Fayz platform — in
// standalone dev (`pnpm dev` + Supabase env) there is no Fayz API, so every
// count returned empty and the dashboard showed 0/4 onboarding, 0 clients, etc.
//
// The rest of the app (auth, CRUD, plugins, archetype lookups) reads Supabase
// DIRECTLY via `getSupabaseClientOptional()`. These helpers do the same, so the
// dashboard works in BOTH modes (standalone Supabase and deployed). The call
// shape mirrors `fayz.data` so the dashboard code barely changes.
import { getSupabaseClientOptional } from '@fayz-ai/saas'
import type { FayzTableFilter } from '@fayz-ai/saas'

// supabase-js client is untyped here; the rest of the SDK uses `as any` too.
type Sb = any

function from(client: Sb, table: string, schema?: string): Sb {
  return schema ? client.schema(schema).from(table) : client.from(table)
}

function applyFilters(qb: Sb, filters?: FayzTableFilter[]): Sb {
  for (const f of filters ?? []) {
    switch (f.operator) {
      case 'gte': qb = qb.gte(f.column, f.value); break
      case 'gt': qb = qb.gt(f.column, f.value); break
      case 'lte': qb = qb.lte(f.column, f.value); break
      case 'lt': qb = qb.lt(f.column, f.value); break
      case 'neq': qb = qb.neq(f.column, f.value); break
      case 'eq':
      default: qb = qb.eq(f.column, f.value); break
    }
  }
  return qb
}

export interface DashboardQuery {
  table: string
  schema?: string
  filters?: FayzTableFilter[]
  limit?: number
}

// Count rows for the active session (RLS-scoped server-side). Returns 0 when no
// Supabase client is configured rather than throwing.
export async function countRows(options: DashboardQuery): Promise<number> {
  const client = getSupabaseClientOptional() as Sb
  if (!client) return 0
  let qb = from(client, options.table, options.schema).select('*', { count: 'exact', head: true })
  qb = applyFilters(qb, options.filters)
  const { count, error } = await qb
  if (error) throw error
  return count ?? 0
}

// Cheap existence probe for onboarding "has ≥1 row" checks. Unlike countRows,
// it does NOT ask PostgREST for an exact COUNT — on the bridge VIEWS
// (v_clients / v_appointments) an exact count forces a full scan and was costing
// 2–4s per check. `select('*').limit(1)` lets Postgres short-circuit at the first
// row and transfers at most one tiny row. select('*') (not a named column) keeps
// it safe for any table/view regardless of its column set. Returns false — never
// throws — when Supabase is unconfigured; a missing source still rejects and is
// handled by the caller.
export async function rowExists(options: DashboardQuery): Promise<boolean> {
  const client = getSupabaseClientOptional() as Sb
  if (!client) return false
  let qb = from(client, options.table, options.schema).select('*').limit(1)
  qb = applyFilters(qb, options.filters)
  const { data, error } = await qb
  if (error) throw error
  return (data?.length ?? 0) > 0
}

// List rows (bounded) for client-side aggregation (e.g. revenue sums).
export async function listRows<T = Record<string, unknown>>(
  options: DashboardQuery,
): Promise<{ rows: T[] }> {
  const client = getSupabaseClientOptional() as Sb
  if (!client) return { rows: [] }
  let qb = from(client, options.table, options.schema).select('*')
  qb = applyFilters(qb, options.filters)
  if (options.limit != null) qb = qb.limit(options.limit)
  const { data, error } = await qb
  if (error) throw error
  return { rows: (data ?? []) as T[] }
}
