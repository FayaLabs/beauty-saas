export class GoogleCalendarHttpError extends Error {
  constructor(status, message, options = {}) {
    super(message)
    this.name = 'GoogleCalendarHttpError'
    this.status = status
    this.retryAfterMs = options.retryAfterMs ?? null
    this.details = options.details ?? null
  }
}

export function isRetryableGoogleStatus(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599)
}

export function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000)
  const at = Date.parse(value)
  return Number.isFinite(at) ? Math.max(0, at - now) : null
}

export function retryDelay(attempt, options = {}) {
  const baseDelayMs = options.baseDelayMs ?? 250
  const maxDelayMs = options.maxDelayMs ?? 5_000
  const random = options.random ?? Math.random
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1))
  return Math.round(exponential * (0.75 + random() * 0.5))
}

export async function fetchWithRetry(fetchImpl, input, init, options = {}) {
  const maxAttempts = options.maxAttempts ?? 4
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response
    try {
      response = await fetchImpl(input, init)
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts) throw error
      const delayMs = retryDelay(attempt, options)
      options.onRetry?.({ attempt, delayMs, status: null, error })
      await sleep(delayMs)
      continue
    }

    if (!isRetryableGoogleStatus(response.status) || attempt === maxAttempts) return response
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
    const delayMs = retryAfterMs ?? retryDelay(attempt, options)
    options.onRetry?.({ attempt, delayMs, status: response.status, error: null })
    await sleep(delayMs)
  }

  throw lastError ?? new Error('Google request failed')
}

export function shouldRenewWatch(expiresAt, options = {}) {
  if (!expiresAt) return true
  const expiresAtMs = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiresAtMs)) return true
  const now = options.now ?? Date.now()
  const leadMs = options.leadMs ?? 24 * 60 * 60_000
  return expiresAtMs <= now + leadMs
}

export async function listAllEventChanges(options) {
  const maxPages = options.maxPages ?? 100
  let effectiveSyncToken = options.syncToken ?? null
  let pageToken = null
  let cursorReset = false
  let pages = 0
  const items = []

  while (true) {
    if (pages >= maxPages) throw new Error('Google Calendar pagination limit exceeded')
    let page
    try {
      page = await options.fetchPage({
        syncToken: effectiveSyncToken,
        timeMin: effectiveSyncToken ? undefined : options.timeMin,
        pageToken,
      })
    } catch (error) {
      if (effectiveSyncToken && error?.status === 410 && !cursorReset) {
        effectiveSyncToken = null
        pageToken = null
        cursorReset = true
        items.length = 0
        pages = 0
        options.onCursorReset?.()
        continue
      }
      throw error
    }

    pages += 1
    items.push(...(page.items ?? []))
    if (page.nextPageToken) {
      pageToken = page.nextPageToken
      continue
    }
    return {
      items,
      nextSyncToken: page.nextSyncToken ?? effectiveSyncToken,
      cursorReset,
      pages,
    }
  }
}

export async function runPushEvent(options) {
  const operation = String(options.operation ?? '')
  const booking = options.booking ?? null
  const eventId = options.existingEventId ?? null
  const shouldDelete = operation === 'delete' || !booking || booking.status === 'cancelled'

  if (shouldDelete) {
    if (!eventId) return { mode: 'delete', eventId: null, written: 0 }
    try {
      await options.deleteEvent(eventId)
    } catch (error) {
      if (error?.status !== 404) throw error
    }
    return { mode: 'delete', eventId, written: 1 }
  }

  const event = options.toEvent(booking)
  if (eventId) {
    const saved = await options.updateEvent(eventId, event)
    return { mode: 'update', eventId: saved?.id ?? eventId, written: 1 }
  }

  const saved = await options.createEvent(event)
  if (!saved?.id) throw new Error('Google Calendar did not return an event id')
  await options.stampEvent(saved)
  return { mode: 'create', eventId: saved.id, written: 1 }
}

export async function processInboundEvents(options) {
  let written = 0
  let discovered = 0

  for (const event of options.events ?? []) {
    const linked = await options.findLinked(event)
    if (!linked) {
      discovered += 1
      if (!options.autoImportNewEvents || !options.channelRef || event.status === 'cancelled') continue
      const importedId = await options.importUnlinked(event)
      if (importedId) written += 1
      continue
    }

    const updatedId = await options.applyLinked(event, linked)
    if (updatedId) written += 1
  }

  return { fetched: (options.events ?? []).length, written, discovered }
}
