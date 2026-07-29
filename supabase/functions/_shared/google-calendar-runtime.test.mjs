import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GoogleCalendarHttpError,
  fetchWithRetry,
  listAllEventChanges,
  processInboundEvents,
  runPushEvent,
  shouldRenewWatch,
} from './google-calendar-runtime.js'

test('retries rate limits and transient Google failures with bounded backoff', async () => {
  const statuses = [429, 503, 200]
  const delays = []
  const response = await fetchWithRetry(
    async () => new Response('{}', { status: statuses.shift(), headers: { 'Retry-After': '0' } }),
    'https://google.invalid',
    {},
    { sleep: async (ms) => delays.push(ms), random: () => 0.5 },
  )
  assert.equal(response.status, 200)
  assert.deepEqual(delays, [0, 0])
})

test('does not retry permanent Google client errors', async () => {
  let calls = 0
  const response = await fetchWithRetry(async () => {
    calls += 1
    return new Response('{}', { status: 400 })
  }, 'https://google.invalid', {}, { sleep: async () => {} })
  assert.equal(response.status, 400)
  assert.equal(calls, 1)
})

test('renews missing or expiring watches and reuses healthy ones', () => {
  const now = Date.parse('2026-07-28T12:00:00.000Z')
  assert.equal(shouldRenewWatch(null, { now }), true)
  assert.equal(shouldRenewWatch('2026-07-29T11:00:00.000Z', { now }), true)
  assert.equal(shouldRenewWatch('2026-07-30T13:00:00.000Z', { now }), false)
})

test('push_event create stores the new Google event identity', async () => {
  const calls = []
  const result = await runPushEvent({
    operation: 'insert',
    booking: { id: 'b1', status: 'scheduled' },
    existingEventId: null,
    toEvent: () => ({ summary: 'New booking' }),
    createEvent: async (event) => { calls.push(['create', event]); return { id: 'g1', etag: 'e1' } },
    updateEvent: async () => assert.fail('unexpected update'),
    deleteEvent: async () => assert.fail('unexpected delete'),
    stampEvent: async (saved) => calls.push(['stamp', saved.id]),
  })
  assert.deepEqual(result, { mode: 'create', eventId: 'g1', written: 1 })
  assert.deepEqual(calls, [['create', { summary: 'New booking' }], ['stamp', 'g1']])
})

test('push_event update patches the linked Google event without recreating it', async () => {
  let patched
  const result = await runPushEvent({
    operation: 'update',
    booking: { id: 'b1', status: 'confirmed' },
    existingEventId: 'g1',
    toEvent: () => ({ summary: 'Updated booking' }),
    createEvent: async () => assert.fail('unexpected create'),
    updateEvent: async (id, event) => { patched = { id, event }; return { id } },
    deleteEvent: async () => assert.fail('unexpected delete'),
    stampEvent: async () => assert.fail('unexpected stamp'),
  })
  assert.deepEqual(result, { mode: 'update', eventId: 'g1', written: 1 })
  assert.deepEqual(patched, { id: 'g1', event: { summary: 'Updated booking' } })
})

test('push_event cancellation deletes the linked Google event and tolerates an already-missing event', async () => {
  let deletes = 0
  const result = await runPushEvent({
    operation: 'update',
    booking: { id: 'b1', status: 'cancelled' },
    existingEventId: 'g1',
    toEvent: () => assert.fail('unexpected mapping'),
    createEvent: async () => assert.fail('unexpected create'),
    updateEvent: async () => assert.fail('unexpected update'),
    deleteEvent: async () => { deletes += 1; throw new GoogleCalendarHttpError(404, 'gone') },
    stampEvent: async () => assert.fail('unexpected stamp'),
  })
  assert.deepEqual(result, { mode: 'delete', eventId: 'g1', written: 1 })
  assert.equal(deletes, 1)
})

test('pull_events applies Google reschedules and cancellations to linked bookings', async () => {
  const applied = []
  const outcome = await processInboundEvents({
    events: [
      { id: 'g1', status: 'confirmed', start: { dateTime: '2026-07-28T12:00:00Z' } },
      { id: 'g2', status: 'cancelled' },
    ],
    autoImportNewEvents: true,
    channelRef: 'c1',
    findLinked: async (event) => ({ id: 'b-' + event.id }),
    importUnlinked: async () => assert.fail('unexpected import'),
    applyLinked: async (event, linked) => { applied.push([linked.id, event.status]); return linked.id },
  })
  assert.deepEqual(outcome, { fetched: 2, written: 2, discovered: 0 })
  assert.deepEqual(applied, [['b-g1', 'confirmed'], ['b-g2', 'cancelled']])
})

test('pull_events resets an expired cursor, paginates, and persists the final syncToken', async () => {
  const calls = []
  let saved
  const result = await listAllEventChanges({
    syncToken: 'expired-token',
    timeMin: '2026-06-28T00:00:00.000Z',
    fetchPage: async (params) => {
      calls.push(params)
      if (params.syncToken === 'expired-token') throw new GoogleCalendarHttpError(410, 'expired')
      if (!params.pageToken) return { items: [{ id: 'g1' }], nextPageToken: 'page-2' }
      return { items: [{ id: 'g2' }], nextSyncToken: 'fresh-token' }
    },
  })
  saved = result.nextSyncToken
  assert.equal(result.cursorReset, true)
  assert.equal(result.pages, 2)
  assert.deepEqual(result.items.map((event) => event.id), ['g1', 'g2'])
  assert.equal(saved, 'fresh-token')
  assert.deepEqual(calls[1], {
    syncToken: null,
    timeMin: '2026-06-28T00:00:00.000Z',
    pageToken: null,
  })
})
