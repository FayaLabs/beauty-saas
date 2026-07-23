import assert from 'node:assert/strict'
import test from 'node:test'

import { isNewerGoogleMessage } from '../_shared/google-calendar-security.js'

test('accepts only monotonically increasing Google message numbers', () => {
  assert.equal(isNewerGoogleMessage('2', '1'), true)
  assert.equal(isNewerGoogleMessage('1', '1'), false)
  assert.equal(isNewerGoogleMessage('1', '2'), false)
  assert.equal(isNewerGoogleMessage('18446744073709551615', '9223372036854775807'), true)
  assert.equal(isNewerGoogleMessage('invalid', '1'), false)
})
