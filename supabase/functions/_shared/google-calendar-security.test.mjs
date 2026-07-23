import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendOAuthResult,
  constantTimeEqual,
  corsHeaders,
  createOAuthState,
  isAllowedOrigin,
  parseBearerToken,
  sanitizeRedirectTo,
  verifyOAuthState,
} from './google-calendar-security.js'

const TENANT_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const SECRET = 'test-only-state-secret'
const APP_ORIGIN = 'https://beauty-saas.live.fayz.ai'

test('accepts configured production and localhost origins only', () => {
  assert.equal(isAllowedOrigin(APP_ORIGIN, APP_ORIGIN), true)
  assert.equal(isAllowedOrigin('http://localhost:5301', APP_ORIGIN), true)
  assert.equal(isAllowedOrigin('http://127.0.0.1:5180', APP_ORIGIN), true)
  assert.equal(isAllowedOrigin('https://attacker.example', APP_ORIGIN), false)
  assert.equal(corsHeaders(APP_ORIGIN, APP_ORIGIN)['Access-Control-Allow-Origin'], APP_ORIGIN)
  assert.equal(corsHeaders('https://attacker.example', APP_ORIGIN)['Access-Control-Allow-Origin'], undefined)
})

test('sanitizes the OAuth return URL and rejects open redirects', () => {
  assert.equal(
    sanitizeRedirectTo('http://localhost:5301/#/settings/integrations', APP_ORIGIN),
    'http://localhost:5301/#/settings/integrations',
  )
  assert.throws(
    () => sanitizeRedirectTo('https://attacker.example/steal', APP_ORIGIN),
    /not allowed/u,
  )
  assert.throws(
    () => sanitizeRedirectTo('https://user:password@beauty-saas.live.fayz.ai', APP_ORIGIN),
    /credentials/u,
  )
})

test('creates a signed, tenant-bound OAuth state and rejects tampering or expiry', async () => {
  const now = Date.UTC(2026, 6, 23, 12, 0, 0)
  const state = await createOAuthState(
    {
      tenantId: TENANT_ID,
      userId: USER_ID,
      redirectTo: 'http://localhost:5301/#/settings/integrations',
    },
    SECRET,
    { now, nonce: 'nonce-1' },
  )

  const payload = await verifyOAuthState(state, SECRET, { now: now + 1_000 })
  assert.equal(payload.tenantId, TENANT_ID)
  assert.equal(payload.userId, USER_ID)
  assert.equal(payload.nonce, 'nonce-1')

  const [body, signature] = state.split('.')
  const tampered = `${body.slice(0, -1)}A.${signature}`
  await assert.rejects(() => verifyOAuthState(tampered, SECRET, { now }), /Invalid OAuth state/u)
  await assert.rejects(
    () => verifyOAuthState(state, SECRET, { now: now + 10 * 60_000 + 1 }),
    /Expired OAuth state/u,
  )
})

test('parses bearer credentials and compares secrets without plain equality', async () => {
  assert.equal(parseBearerToken('Bearer abc.def'), 'abc.def')
  assert.equal(parseBearerToken('Basic abc'), null)
  assert.equal(await constantTimeEqual('same', 'same'), true)
  assert.equal(await constantTimeEqual('same', 'different'), false)
})

test('adds a bounded OAuth result to the approved return URL', () => {
  const result = appendOAuthResult(
    'http://localhost:5301/#/settings/integrations',
    'connected',
    'ok',
  )
  const url = new URL(result)
  assert.equal(url.searchParams.get('googleCalendar'), 'connected')
  assert.equal(url.searchParams.get('googleCalendarMessage'), 'ok')
})
