import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// BeautySoft (beauty-saas) E2E — runs against the REAL dev server on :5301,
// backed by the LIVE salon pool (gphxclpkbtbucoqclbco). Every spec operates
// ONLY inside the QA tenant (slug `qa-fayz`); nothing touches other tenants.
//
// The server is expected to be already running (`npm run dev`). We never tear
// it down: reuseExistingServer keeps whatever is on :5301 alive, and boots
// `npm run dev` only if the port is idle.
//
// Layout is TOPBAR: section nav lives in dropdowns at the top (group button →
// leaf item), not in a sidebar.
// ---------------------------------------------------------------------------

// Playwright does not auto-load .env — pull QA_TENANT_PASSWORD (and optional
// credential overrides) out of the app's .env so specs never hardcode a secret.
function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

const PORT = 5301
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Serial: all specs share one live QA tenant; a row created by one spec must
  // not race another spec's assertions.
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    // App renders money/dates in America/Sao_Paulo; pin the browser to match.
    timezoneId: 'America/Sao_Paulo',
    locale: 'pt-BR',
  },
  projects: [
    // 1) Authenticate once (owner + restricted) and persist both sessions.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // 2) Specs reuse the OWNER session by default. The permissions spec swaps
    //    to the restricted session via test.use({ storageState }).
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/owner.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
