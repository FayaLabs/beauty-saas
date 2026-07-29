import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OFFICIAL_FUNCTION_ORIGIN,
  parseEnv,
  validateOAuthUrl,
  validateOfficialProject,
} from './google-calendar-smoke.mjs'

test('parses local environment files without comments or quotes', () => {
  assert.deepEqual(
    parseEnv(`
      # ignored
      SIMPLE=value
      DOUBLE="two words"
      SINGLE='safe'
    `),
    { SIMPLE: 'value', DOUBLE: 'two words', SINGLE: 'safe' },
  )
})

test('pins smoke tests to the official Supabase project', () => {
  assert.equal(
    validateOfficialProject(`${OFFICIAL_FUNCTION_ORIGIN}/path`),
    OFFICIAL_FUNCTION_ORIGIN,
  )
  assert.throws(
    () => validateOfficialProject('https://different.supabase.co'),
    /official Supabase project/u,
  )
})

test('accepts only a signed Google OAuth URL using the official callback', () => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', 'test-client')
  url.searchParams.set(
    'redirect_uri',
    `${OFFICIAL_FUNCTION_ORIGIN}/functions/v1/google-calendar-sync`,
  )
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', 'payload.signature')

  assert.deepEqual(validateOAuthUrl(url), {
    clientIdPresent: true,
    redirectUri: `${OFFICIAL_FUNCTION_ORIGIN}/functions/v1/google-calendar-sync`,
    signedState: true,
  })

  url.searchParams.set('state', 'tenant::redirect')
  assert.throws(() => validateOAuthUrl(url), /state is not signed/u)
})
