import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

export const OFFICIAL_PROJECT_REF = 'gphxclpkbtbucoqclbco'
export const OFFICIAL_FUNCTION_ORIGIN =
  `https://${OFFICIAL_PROJECT_REF}.supabase.co`

const LOCAL_ORIGIN = 'http://localhost:5301'
const RESULT_FILE = path.join('test-results', 'google-calendar-smoke.json')

export function parseEnv(text) {
  const result = {}
  for (const rawLine of String(text).split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/u)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[match[1]] = value
  }
  return result
}

export function loadLocalEnvironment(cwd = process.cwd()) {
  for (const file of ['.env', '.env.local', '.env.google-calendar.local']) {
    const target = path.join(cwd, file)
    if (!fs.existsSync(target)) continue
    const values = parseEnv(fs.readFileSync(target, 'utf8'))
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}

export function validateOfficialProject(supabaseUrl) {
  const url = new URL(supabaseUrl)
  if (url.origin !== OFFICIAL_FUNCTION_ORIGIN) {
    throw new Error(
      `Expected the official Supabase project ${OFFICIAL_PROJECT_REF}; received ${url.host}`,
    )
  }
  return url.origin
}

export function validateOAuthUrl(value) {
  const url = new URL(value)
  if (url.origin !== 'https://accounts.google.com') {
    throw new Error('OAuth URL does not use accounts.google.com')
  }
  if (url.pathname !== '/o/oauth2/v2/auth') {
    throw new Error('Unexpected Google OAuth path')
  }
  if (!url.searchParams.get('client_id')) throw new Error('OAuth client_id is missing')
  if (url.searchParams.get('redirect_uri') !==
    `${OFFICIAL_FUNCTION_ORIGIN}/functions/v1/google-calendar-sync`) {
    throw new Error('OAuth redirect_uri does not target the official Edge Function')
  }
  if (url.searchParams.get('access_type') !== 'offline') {
    throw new Error('OAuth offline access is not enabled')
  }
  if (url.searchParams.get('prompt') !== 'consent') {
    throw new Error('OAuth consent prompt is not explicit')
  }
  const state = url.searchParams.get('state') ?? ''
  const segments = state.split('.')
  if (segments.length !== 2 || segments.some((segment) => !segment)) {
    throw new Error('OAuth state is not signed')
  }
  return {
    clientIdPresent: true,
    redirectUri: url.searchParams.get('redirect_uri'),
    signedState: true,
  }
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function parseMode() {
  const raw = process.argv.find((argument) => argument.startsWith('--mode='))
  const mode = raw?.split('=')[1] ?? 'preflight'
  if (!['preflight', 'connected'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`)
  }
  return mode
}

function messageFromBody(body, fallback) {
  if (body && typeof body === 'object' && typeof body.error === 'string') {
    return body.error
  }
  return fallback
}

async function responseBody(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 200) }
  }
}

async function resolveTenantId(client) {
  const configured = process.env.GCAL_TEST_TENANT_ID?.trim()
  if (configured) return configured

  const attempts = [
    () => client.schema('saas_core').from('tenant_members').select('tenant_id'),
    () => client.from('tenant_members').select('tenant_id'),
  ]
  for (const query of attempts) {
    const { data, error } = await query()
    if (error || !Array.isArray(data)) continue
    const ids = [...new Set(data.map((row) => row.tenant_id).filter(Boolean))]
    if (ids.length === 1) return ids[0]
    if (ids.length > 1) {
      throw new Error('GCAL_TEST_TENANT_ID is required because the user has multiple tenants')
    }
  }
  throw new Error('Unable to discover the test tenant; set GCAL_TEST_TENANT_ID')
}

export async function runSmoke({ mode = 'preflight' } = {}) {
  loadLocalEnvironment()

  const supabaseUrl = validateOfficialProject(required('VITE_SUPABASE_URL'))
  const anonKey = required('VITE_SUPABASE_ANON_KEY')
  const functionUrl = `${supabaseUrl}/functions/v1/google-calendar-sync`
  const redirectUrl =
    process.env.GCAL_TEST_REDIRECT_URL?.trim() ||
    `${LOCAL_ORIGIN}/#/settings/agenda/_integrations`
  const results = []

  async function check(name, operation) {
    try {
      const details = await operation()
      results.push({ name, status: 'passed', details: details ?? null })
      console.log(`PASS ${name}`)
    } catch (error) {
      results.push({ name, status: 'failed', error: String(error?.message ?? error) })
      console.error(`FAIL ${name}: ${String(error?.message ?? error)}`)
    }
  }

  function skip(name, reason) {
    results.push({ name, status: 'skipped', reason })
    console.log(`SKIP ${name}: ${reason}`)
  }

  await check('allowed localhost CORS preflight', async () => {
    const response = await fetch(functionUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: LOCAL_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,apikey,content-type',
      },
    })
    if (response.status !== 204) throw new Error(`expected HTTP 204, received ${response.status}`)
    const allowedOrigin = response.headers.get('access-control-allow-origin')
    if (allowedOrigin !== LOCAL_ORIGIN) {
      throw new Error(`expected an exact localhost origin, received ${allowedOrigin ?? 'none'}`)
    }
    return { status: response.status, allowedOrigin }
  })

  await check('untrusted origin is rejected', async () => {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.invalid',
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'oauth_start',
        tenantId: '00000000-0000-4000-8000-000000000000',
        redirectTo: redirectUrl,
      }),
    })
    const body = await responseBody(response)
    if (response.status !== 403) {
      throw new Error(
        `expected HTTP 403, received ${response.status}: ${messageFromBody(body, 'no error body')}`,
      )
    }
    return { status: response.status }
  })

  await check('OAuth start requires a user bearer token', async () => {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Origin: LOCAL_ORIGIN,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'oauth_start',
        tenantId: '00000000-0000-4000-8000-000000000000',
        redirectTo: redirectUrl,
      }),
    })
    const body = await responseBody(response)
    if (response.status !== 401) {
      throw new Error(
        `expected HTTP 401, received ${response.status}: ${messageFromBody(body, 'no error body')}`,
      )
    }
    return { status: response.status }
  })

  const email = process.env.GCAL_TEST_EMAIL?.trim()
  const password = process.env.GCAL_TEST_PASSWORD
  if (!email || !password) {
    skip('authenticated OAuth start', 'set GCAL_TEST_EMAIL and GCAL_TEST_PASSWORD')
    if (mode === 'connected') {
      results.push({
        name: 'connected Google Calendar read',
        status: 'failed',
        error: 'connected mode requires GCAL_TEST_EMAIL and GCAL_TEST_PASSWORD',
      })
    } else {
      skip('connected Google Calendar read', 'run test:gcal:connected after OAuth consent')
    }
  } else {
    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    let accessToken = ''
    let tenantId = ''

    await check('Supabase test-user login and tenant membership', async () => {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      if (error || !data.session?.access_token) {
        throw new Error(error?.message ?? 'Supabase did not return a session')
      }
      accessToken = data.session.access_token
      tenantId = await resolveTenantId(client)
      return { tenantResolved: true }
    })

    if (accessToken && tenantId) {
      await check('authenticated OAuth start', async () => {
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            Origin: LOCAL_ORIGIN,
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'oauth_start',
            tenantId,
            redirectTo: redirectUrl,
          }),
        })
        const body = await responseBody(response)
        if (!response.ok || typeof body?.url !== 'string') {
          throw new Error(
            `OAuth start returned HTTP ${response.status}: ${messageFromBody(body, 'URL missing')}`,
          )
        }
        return validateOAuthUrl(body.url)
      })

      if (mode === 'connected') {
        await check('connected Google Calendar read', async () => {
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              Origin: LOCAL_ORIGIN,
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'list_calendars', tenantId }),
          })
          const body = await responseBody(response)
          if (!response.ok) {
            throw new Error(
              `list_calendars returned HTTP ${response.status}: ${messageFromBody(body, 'unknown')}`,
            )
          }
          if (!Array.isArray(body?.calendars)) throw new Error('calendars array is missing')
          return { calendarCount: body.calendars.length }
        })
      } else {
        skip('connected Google Calendar read', 'run test:gcal:connected after OAuth consent')
      }
    } else {
      skip('authenticated OAuth start', 'test-user login or tenant resolution failed')
      skip('connected Google Calendar read', 'test-user login or tenant resolution failed')
    }
    await client.auth.signOut().catch(() => undefined)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    projectRef: OFFICIAL_PROJECT_REF,
    mode,
    results,
    summary: {
      passed: results.filter((result) => result.status === 'passed').length,
      failed: results.filter((result) => result.status === 'failed').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
    },
  }
  fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true })
  fs.writeFileSync(RESULT_FILE, `${JSON.stringify(report, null, 2)}\n`)
  console.log(
    `\nResult: ${report.summary.passed} passed, ${report.summary.failed} failed, ` +
      `${report.summary.skipped} skipped`,
  )
  console.log(`Evidence: ${RESULT_FILE}`)
  if (report.summary.failed) process.exitCode = 1
  return report
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isMain) {
  try {
    await runSmoke({ mode: parseMode() })
  } catch (error) {
    console.error(`Google Calendar smoke setup failed: ${String(error?.message ?? error)}`)
    process.exitCode = 1
  }
}
