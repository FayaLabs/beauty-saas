// Tenant isolation for plugbank-sync (FAY-1375).
//
// The pool is one Supabase project serving N tenants, so "authenticated" is not
// "authorized": every member of every tenant in the pool holds a valid JWT for
// this function. The fake below is deliberately faithful on the one point that
// decides this bug — a client built with the service-role key bypasses RLS, a
// client built with the anon key plus the caller's Authorization header does
// not. So a handler that resolves the integration as service_role sees tenant
// B's row and a handler that resolves it as the caller does not.
//
// No credentials here: every key/token/JWT below is an inert harness string.
import assert from 'node:assert/strict'
import test from 'node:test'

import { handleRequest } from './handler.js'

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const JWT_A = 'harness-jwt-user-a'

const ENV = {
  SUPABASE_URL: 'https://pool.invalid',
  SUPABASE_ANON_KEY: 'harness-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'harness-service-role-key',
  PLUGBANK_BASE_URL: 'https://plugbank.invalid',
}
const env = (name) => ENV[name]

const LINES = [
  { externalId: 'mov-1', date: '2026-08-01', type: 'C', amount: 100, description: 'Depósito' },
  { externalId: 'mov-2', date: '2026-08-02', type: 'D', amount: 40, description: 'Tarifa' },
]

function newPool() {
  return {
    tables: {
      bank_integrations: [
        { id: 'integration-a', tenant_id: TENANT_A, provider: 'plugbank', api_token: 'harness-token-a', cnpj: '11111111000191', bank_account_id: null, active: true },
        { id: 'integration-b', tenant_id: TENANT_B, provider: 'plugbank', api_token: 'harness-token-b', cnpj: '22222222000191', bank_account_id: null, active: true },
      ],
      plg_financial_movements: [],
      bank_integration_sync_log: [],
    },
    // public.tenant_members — what public.user_tenant_ids() reads.
    members: [{ user_id: USER_A, tenant_id: TENANT_A }],
    sessions: { [JWT_A]: USER_A },
    serviceRoleClients: 0,
    plugbankCalls: [],
  }
}

function fakeClient(pool, ctx) {
  const allowed = (tenantId) =>
    ctx.serviceRole || pool.members.some((m) => m.user_id === ctx.callerId && m.tenant_id === tenantId)

  const from = (table) => {
    const rows = () => (pool.tables[table] ??= [])
    const state = { op: null, filters: [], payload: null }
    const matches = (row) => state.filters.every(([col, val]) => row[col] === val)

    const runSelect = (nullWhenEmpty) => {
      const found = rows().filter((r) => matches(r) && allowed(r.tenant_id))
      if (found.length === 1) return { data: { ...found[0] }, error: null }
      if (found.length === 0) {
        return nullWhenEmpty
          ? { data: null, error: null }
          : { data: null, error: { code: 'PGRST116', message: 'no rows returned' } }
      }
      return { data: null, error: { code: 'PGRST116', message: 'more than one row returned' } }
    }

    const run = async () => {
      if (state.op === 'insert') {
        const row = state.payload
        if (!allowed(row.tenant_id)) {
          return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } }
        }
        // uq_plg_financial_movements_external
        const dup = table === 'plg_financial_movements' && rows().some(
          (r) => r.tenant_id === row.tenant_id && r.external_source === row.external_source && r.external_id === row.external_id,
        )
        if (dup) return { data: null, error: { code: '23505', message: 'duplicate key value' } }
        rows().push({ ...row })
        return { data: null, error: null }
      }
      if (state.op === 'update') {
        for (const row of rows()) if (matches(row) && allowed(row.tenant_id)) Object.assign(row, state.payload)
        return { data: null, error: null }
      }
      return runSelect(true)
    }

    const api = {
      select() { state.op = 'select'; return api },
      insert(payload) { state.op = 'insert'; state.payload = payload; return api },
      update(payload) { state.op = 'update'; state.payload = payload; return api },
      eq(col, val) { state.filters.push([col, val]); return api },
      limit() { return api },
      maybeSingle: async () => runSelect(true),
      single: async () => runSelect(false),
      then: (resolve, reject) => run().then(resolve, reject),
    }
    return api
  }

  return {
    auth: {
      getUser: async (jwt) => {
        const id = pool.sessions[jwt]
        return id
          ? { data: { user: { id } }, error: null }
          : { data: { user: null }, error: { message: 'invalid claim: missing sub claim' } }
      },
    },
    from,
  }
}

function makeCreateClient(pool) {
  return (_url, key, options = {}) => {
    const serviceRole = key === ENV.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRole) pool.serviceRoleClients += 1
    const jwt = String(options?.global?.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '')
    return fakeClient(pool, { serviceRole, callerId: serviceRole ? null : (pool.sessions[jwt] ?? null) })
  }
}

function makeFetch(pool) {
  return async (url, init) => {
    pool.plugbankCalls.push({ url: String(url), authorization: init?.headers?.Authorization ?? null })
    return new Response(JSON.stringify({ lancamentos: [] }), { status: 200 })
  }
}

function request(body, { jwt } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (jwt) headers.Authorization = `Bearer ${jwt}`
  return new Request('https://pool.invalid/functions/v1/plugbank-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function call(pool, body, opts) {
  const res = await handleRequest(request(body, opts), {
    createClient: makeCreateClient(pool),
    env,
    fetch: makeFetch(pool),
  })
  return { status: res.status, body: await res.json() }
}

test('a caller from tenant A cannot import into tenant B ledger', async () => {
  const pool = newPool()

  const res = await call(pool, {
    action: 'import_transactions',
    integrationId: 'integration-b', // another tenant's connection, straight from the body
    from: '2026-08-01',
    to: '2026-08-31',
    lines: LINES,
  }, { jwt: JWT_A })

  assert.equal(res.status, 404, 'another tenant integration must be unresolvable')
  assert.equal(pool.tables.plg_financial_movements.length, 0, 'nothing may be written to tenant B ledger')
  assert.equal(pool.tables.bank_integration_sync_log.length, 0, 'no sync row may be written for tenant B')
  assert.equal(
    pool.tables.bank_integrations.find((r) => r.id === 'integration-b').last_sync_at,
    undefined,
    'tenant B connection must not be touched',
  )
})

test('refusal is indistinguishable from a connection that does not exist', async () => {
  const pool = newPool()
  const foreign = await call(pool, { action: 'import_transactions', integrationId: 'integration-b', lines: LINES }, { jwt: JWT_A })
  const missing = await call(pool, { action: 'import_transactions', integrationId: 'no-such-id', lines: LINES }, { jwt: JWT_A })

  assert.equal(foreign.status, missing.status)
  assert.deepEqual(foreign.body, missing.body, 'the error must not confirm that another tenant connection exists')
})

test('fetch_statement for another tenant connection never reaches PlugBank', async () => {
  const pool = newPool()
  const res = await call(pool, { action: 'fetch_statement', integrationId: 'integration-b', from: '2026-08-01', to: '2026-08-31' }, { jwt: JWT_A })

  assert.equal(res.status, 404)
  assert.deepEqual(pool.plugbankCalls, [], 'another tenant bank credential must not be used')
})

test('an unauthenticated request is refused before anything is resolved', async () => {
  const pool = newPool()
  const res = await call(pool, { action: 'import_transactions', integrationId: 'integration-a', lines: LINES })

  assert.equal(res.status, 401)
  assert.equal(pool.tables.plg_financial_movements.length, 0)
})

test('test_connection requires an authenticated caller', async () => {
  const pool = newPool()
  const res = await call(pool, { action: 'test_connection', apiToken: 'harness-token-x', cnpj: '11111111000191' })

  assert.equal(res.status, 401)
  assert.deepEqual(pool.plugbankCalls, [], 'no outbound call on behalf of an anonymous caller')
})

test('the handler never builds a service-role client', async () => {
  const pool = newPool()
  await call(pool, { action: 'import_transactions', integrationId: 'integration-a', lines: LINES }, { jwt: JWT_A })

  assert.equal(pool.serviceRoleClients, 0, 'RLS, not an if-statement, must be what separates the tenants')
})

test('the owning tenant still imports, idempotently', async () => {
  const pool = newPool()

  const first = await call(pool, {
    action: 'import_transactions',
    integrationId: 'integration-a',
    from: '2026-08-01',
    to: '2026-08-31',
    lines: LINES,
  }, { jwt: JWT_A })

  assert.equal(first.status, 200)
  assert.deepEqual(first.body, { imported: 2, duplicates: 0 })
  assert.equal(pool.tables.plg_financial_movements.length, 2)
  assert.ok(pool.tables.plg_financial_movements.every((m) => m.tenant_id === TENANT_A))
  assert.equal(pool.tables.bank_integration_sync_log.length, 1)
  assert.equal(pool.tables.bank_integration_sync_log[0].tenant_id, TENANT_A)
  assert.ok(pool.tables.bank_integrations.find((r) => r.id === 'integration-a').last_sync_at)

  const again = await call(pool, { action: 'import_transactions', integrationId: 'integration-a', lines: LINES }, { jwt: JWT_A })
  assert.deepEqual(again.body, { imported: 0, duplicates: 2 })
  assert.equal(pool.tables.plg_financial_movements.length, 2)
})
