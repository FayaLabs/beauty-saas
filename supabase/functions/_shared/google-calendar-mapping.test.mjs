import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appointmentRowToEvent,
  eventTimes,
  resolveTargetChannel,
} from './google-calendar-mapping.js'

test('maps an appointment row to a Google event', () => {
  assert.deepEqual(
    appointmentRowToEvent({
      starts_at: '2026-07-23T13:00:00.000Z',
      ends_at: '2026-07-23T14:00:00.000Z',
      notes: 'Confirmado',
      metadata: { serviceNames: 'Corte', clientName: 'Ana' },
    }),
    {
      summary: 'Corte — Ana',
      description: 'Confirmado',
      start: { dateTime: '2026-07-23T13:00:00.000Z' },
      end: { dateTime: '2026-07-23T14:00:00.000Z' },
    },
  )
})

test('normalizes all-day Google events', () => {
  assert.deepEqual(
    eventTimes({ start: { date: '2026-07-23' }, end: { date: '2026-07-24' } }),
    { startsAt: '2026-07-23', endsAt: '2026-07-24', allDay: true },
  )
})

test('selects the most specific outbound channel', () => {
  const base = {
    isActive: true,
    direction: 'bidirectional',
    targetId: null,
  }
  const channels = [
    { ...base, id: 'global', targetKind: null },
    { ...base, id: 'location', targetKind: 'location', targetId: 'location-1' },
    { ...base, id: 'service', targetKind: 'service', targetId: 'service-1' },
    { ...base, id: 'staff', targetKind: 'assignee', targetId: 'staff-1' },
  ]
  assert.equal(
    resolveTargetChannel(channels, {
      assigneeId: 'staff-1',
      serviceIds: ['service-1'],
      locationId: 'location-1',
    }).id,
    'staff',
  )
})
