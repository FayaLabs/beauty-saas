const encoder = new TextEncoder()
const decoder = new TextDecoder()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function toBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function fromBase64Url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function parseConfiguredOrigins(rawOrigins = '') {
  return rawOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin]
      } catch {
        return []
      }
    })
}

export function isLocalDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin)
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]')
    )
  } catch {
    return false
  }
}

export function isAllowedOrigin(origin, rawOrigins = '') {
  if (!origin) return true
  if (isLocalDevelopmentOrigin(origin)) return true
  return parseConfiguredOrigins(rawOrigins).includes(origin)
}

export function corsHeaders(origin, rawOrigins = '') {
  const headers = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  }
  if (origin && isAllowedOrigin(origin, rawOrigins)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

export function sanitizeRedirectTo(candidate, rawOrigins = '') {
  let url
  try {
    url = new URL(String(candidate ?? ''))
  } catch {
    throw new Error('Invalid OAuth return URL')
  }
  if (!isAllowedOrigin(url.origin, rawOrigins)) {
    throw new Error('OAuth return URL is not allowed')
  }
  if (url.username || url.password) {
    throw new Error('OAuth return URL must not contain credentials')
  }
  return url.toString()
}

export function parseBearerToken(header) {
  if (!header) return null
  const match = /^Bearer\s+(.+)$/iu.exec(header.trim())
  return match?.[1]?.trim() || null
}

export function isNewerGoogleMessage(messageNumber, previous) {
  if (!previous) return true
  try {
    return BigInt(messageNumber) > BigInt(previous)
  } catch {
    return false
  }
}

export async function constantTimeEqual(left, right) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode('beauty-saas-constant-time-comparison'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const [leftDigest, rightDigest] = await Promise.all(
    [left, right].map((value) => crypto.subtle.sign('HMAC', key, encoder.encode(String(value)))),
  )
  const leftBytes = new Uint8Array(leftDigest)
  const rightBytes = new Uint8Array(rightDigest)
  let difference = leftBytes.length ^ rightBytes.length
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return difference === 0
}

async function importStateKey(secret, usages) {
  if (!secret) throw new Error('OAuth state secret is not configured')
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  )
}

export async function createOAuthState(
  { tenantId, userId, redirectTo },
  secret,
  { now = Date.now(), ttlMs = 10 * 60_000, nonce = crypto.randomUUID() } = {},
) {
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(userId)) {
    throw new Error('Invalid OAuth state identity')
  }
  const payload = {
    tenantId,
    userId,
    redirectTo,
    nonce,
    issuedAt: now,
    expiresAt: now + ttlMs,
  }
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const key = await importStateKey(secret, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload))
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`
}

export async function verifyOAuthState(state, secret, { now = Date.now(), maxTtlMs = 10 * 60_000 } = {}) {
  const [encodedPayload, encodedSignature, extra] = String(state ?? '').split('.')
  if (!encodedPayload || !encodedSignature || extra) throw new Error('Invalid OAuth state')

  let signature
  try {
    signature = fromBase64Url(encodedSignature)
  } catch {
    throw new Error('Invalid OAuth state')
  }

  const key = await importStateKey(secret, ['verify'])
  const verified = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(encodedPayload))
  if (!verified) throw new Error('Invalid OAuth state')

  let payload
  try {
    payload = JSON.parse(decoder.decode(fromBase64Url(encodedPayload)))
  } catch {
    throw new Error('Invalid OAuth state')
  }

  if (
    !UUID_RE.test(payload.tenantId) ||
    !UUID_RE.test(payload.userId) ||
    typeof payload.redirectTo !== 'string' ||
    typeof payload.nonce !== 'string' ||
    typeof payload.issuedAt !== 'number' ||
    typeof payload.expiresAt !== 'number'
  ) {
    throw new Error('Invalid OAuth state')
  }
  if (
    payload.issuedAt > now + 30_000 ||
    payload.expiresAt <= now ||
    payload.expiresAt - payload.issuedAt > maxTtlMs
  ) {
    throw new Error('Expired OAuth state')
  }
  return payload
}

export function appendOAuthResult(redirectTo, status, message) {
  const url = new URL(redirectTo)
  url.searchParams.set('googleCalendar', status)
  if (message) url.searchParams.set('googleCalendarMessage', message.slice(0, 160))
  return url.toString()
}
