import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appFunctions = path.join(root, 'supabase', 'functions')
const candidates = [
  process.env.GCAL_SDK_TEMPLATE_ROOT,
  path.join(root, '_repos', 'fayz-sdk', 'plugins', 'plugin-agenda', 'functions'),
  path.join(root, 'node_modules', '@fayz-ai', 'plugin-agenda', 'functions'),
].filter(Boolean)

const files = [
  "_shared/google-calendar-mapping.js",
  "_shared/google-calendar-mapping.test.mjs",
  "_shared/google-calendar-security.js",
  "_shared/google-calendar-security.test.mjs",
  "_shared/google-calendar-runtime.js",
  "_shared/google-calendar-runtime.test.mjs",
  "google-calendar-sync/index.ts",
  "google-calendar-webhook/index.ts",
  "google-calendar-webhook/webhook.test.mjs"
]

async function exists(file) {
  try {
    await access(file, constants.R_OK)
    return true
  } catch {
    return false
  }
}

const canonical = await (async () => {
  for (const candidate of candidates) {
    if (await exists(path.join(candidate, 'google-calendar-sync', 'index.ts'))) return candidate
  }
  return null
})()

if (!canonical) {
  console.log('Google Calendar template parity: SKIPPED (canonical SDK functions are unavailable)')
  process.exit(0)
}

const drift = []
const normalizedSource = (source) => source.toString('utf8').replace(/\r\n/g, '\n')
for (const relative of files) {
  const appFile = path.join(appFunctions, relative)
  const sdkFile = path.join(canonical, relative)
  if (!(await exists(appFile)) || !(await exists(sdkFile))) {
    drift.push(relative + ' (missing)')
    continue
  }

  const [appSource, sdkSource] = await Promise.all([readFile(appFile), readFile(sdkFile)])
  if (normalizedSource(appSource) !== normalizedSource(sdkSource)) drift.push(relative)
}

if (drift.length) {
  console.error('Google Calendar deployment copy drifted from the SDK canonical template:')
  for (const relative of drift) console.error('  - ' + relative)
  console.error('Sync the SDK template into supabase/functions before deploying.')
  process.exitCode = 1
} else {
  console.log('Google Calendar template parity: OK (' + files.length + ' files)')
}
