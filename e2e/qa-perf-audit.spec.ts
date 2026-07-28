import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { OWNER_EMAIL, QA_PASSWORD, SEED } from './fixtures/credentials'

// ---------------------------------------------------------------------------
// PERFORMANCE / REQUEST AUDIT (throwaway, not part of the regression suite).
//
// Fresh unauthenticated context so the LOGIN round-trips are measured too.
// Walks: login -> dashboard -> clients list -> create NEW client (E2E) ->
// agenda -> book that client. Every HTTP request is captured with a phase tag,
// wall-clock latency, status, method and (for writes) a body hash so we can
// spot duplicates. Emits a JSON report to scratchpad + a console summary.
// Cleans up the appointment and the client it creates.
// ---------------------------------------------------------------------------

test.use({ storageState: { cookies: [], origins: [] } }) // ignore saved owner session

const REPORT = '/private/tmp/claude-502/-Users-fayalabs-dev-fayz-app-beauty-saas/1905b650-0f12-4e8f-9530-e9a154c5f877/scratchpad/perf-audit.json'

type Rec = {
  phase: string
  method: string
  url: string
  host: string
  pathTmpl: string  // path with the query stripped, ids masked
  query: string
  resourceType: string
  status: number | null
  ms: number | null
  bodyKey: string   // method + pathTmpl + query + body  (for dup detection)
  failed: string | null
}

test('perf/request audit: login -> dashboard -> new client -> booking', async ({ page }) => {
  expect(QA_PASSWORD, 'QA_TENANT_PASSWORD must be set in beauty-saas/.env').not.toBe('')

  const recs: Rec[] = []
  const errorBodies: { phase: string; status: number; url: string; body: string }[] = []
  const consoleErrs: string[] = []
  let phase = 'boot'

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrs.push(`[${phase}] ${m.text().slice(0, 300)}`)
  })

  const mask = (u: string) => {
    try {
      const url = new URL(u)
      // Mask UUIDs and long numeric ids in the path so the same endpoint groups.
      const p = url.pathname
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
        .replace(/\/\d{3,}/g, '/:n')
      return { host: url.host, pathTmpl: p, query: url.search }
    } catch {
      return { host: '?', pathTmpl: u, query: '' }
    }
  }

  // Record the phase at request START (not finish) — a slow request that starts
  // in one phase but resolves in the next must be attributed to where it began.
  const startInfo = new Map<any, { t0: number; phase: string }>()
  page.on('request', (req) => startInfo.set(req, { t0: Date.now(), phase }))

  const finalize = (req: any, status: number | null, failed: string | null) => {
    const info = startInfo.get(req)
    const ms = info ? Date.now() - info.t0 : null
    const reqPhase = info?.phase ?? phase
    startInfo.delete(req)
    const u = req.url()
    const { host, pathTmpl, query } = mask(u)
    let body = ''
    try { body = req.postData()?.slice(0, 400) ?? '' } catch { /* opaque */ }
    recs.push({
      phase: reqPhase,
      method: req.method(),
      url: u,
      host,
      pathTmpl,
      query,
      resourceType: req.resourceType(),
      status,
      ms,
      bodyKey: `${req.method()} ${pathTmpl}${query} ${body}`,
      failed,
    })
  }

  page.on('requestfinished', async (req) => {
    let status: number | null = null
    try {
      const resp = await req.response()
      status = resp?.status() ?? null
      if (resp && status != null && status >= 400 && req.url().includes('supabase.co')) {
        let body = ''
        try { body = (await resp.text()).slice(0, 500) } catch { /* opaque */ }
        errorBodies.push({ phase, status, url: req.url(), body })
      }
    } catch { /* ignore */ }
    finalize(req, status, null)
  })
  page.on('requestfailed', (req) => finalize(req, null, req.failure()?.errorText ?? 'failed'))

  const settle = async () => { await page.waitForTimeout(1500) }

  // ---- PHASE: login -------------------------------------------------------
  phase = 'login'
  await page.goto('/')
  await page.locator('input[type="email"]').fill(OWNER_EMAIL)
  await page.locator('input[type="password"]').fill(QA_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible({ timeout: 30_000 })

  // ---- PHASE: dashboard (home) -------------------------------------------
  phase = 'dashboard'
  await settle()

  // ---- PHASE: clients list -----------------------------------------------
  phase = 'clients-list'
  await page.goto('/#/clients')
  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible()
  await settle()

  // ---- PHASE: create a NEW client (E2E) ----------------------------------
  phase = 'client-create'
  const stamp = Date.now()
  const clientName = `QA Audit ${stamp}`
  await page.getByRole('button', { name: '+ Adicionar Cliente', exact: true }).click()
  await expect(page).toHaveURL(/#\/clients\/new/)
  await page.locator('input[type="text"]').first().fill(clientName)
  await page.locator('input[type="email"]').first().fill(`qa.audit.${stamp}@example.com`)
  await page.getByRole('button', { name: 'Adicionar Cliente', exact: true }).click()
  // NON-FATAL: the save may be broken (schema/RLS). Record the outcome either way.
  let clientCreated = true
  try {
    await expect(page).not.toHaveURL(/#\/clients\/new/, { timeout: 12_000 })
  } catch {
    clientCreated = false
  }
  await settle()
  // Which client will the booking mark? The new one if it saved, else a seed client.
  const bookClient = clientCreated ? clientName : SEED.clients[1] // QA Cliente Dois

  // ---- PHASE: agenda ------------------------------------------------------
  phase = 'agenda'
  await page.goto('/#/agenda')
  await expect(page.getByRole('button', { name: 'Criar', exact: true })).toBeVisible()
  await settle()

  // ---- PHASE: booking (mark the new client) ------------------------------
  phase = 'booking'
  const PRO = SEED.professionals[0]
  const SERVICE = SEED.services[0]
  let bookingOk = true
  try {
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // Professional: a "Selecionar profissional" trigger only appears when none is
  // pre-selected; the quick-create popover defaults to one, so pick only if asked.
  const proBtn = dialog.getByRole('button', { name: /Selecionar profissional/ })
  if (await proBtn.isVisible().catch(() => false)) {
    await proBtn.click()
    await page.getByText(PRO, { exact: true }).last().click()
  }
  // Client: inline "Buscar cliente..." field.
  await dialog.getByText('Buscar cliente...', { exact: false }).click().catch(() => {})
  await dialog.locator('input').last().fill(bookClient)
  await page.waitForTimeout(1000)
  await page.getByText(bookClient, { exact: false }).last().click()
  // Service: "Adicionar serviço" reveals a search field.
  await dialog.getByText('Adicionar serviço', { exact: false }).click()
  await dialog.locator('input').last().fill(SERVICE)
  await page.waitForTimeout(1000)
  await page.getByText(SERVICE, { exact: true }).last().click()
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(dialog).toBeHidden()
  const event = page.locator('.fc-timegrid-event').filter({ hasText: bookClient })
  await expect(event.first()).toBeVisible()
  await settle()

  // ---- CLEANUP (still captured, tagged 'cleanup') ------------------------
  phase = 'cleanup'
  await event.first().dblclick({ force: true })
  const editor = page.getByRole('dialog')
  await expect(editor).toBeVisible()
  const excluir = editor.getByRole('button', { name: 'Excluir', exact: true })
  await excluir.click()
  await page.waitForTimeout(700)
  if (await excluir.isVisible().catch(() => false)) await excluir.click()
  await expect(editor).toBeHidden()
  // delete the client too — only if we actually created it this run
  if (clientCreated) {
    await page.goto('/#/clients')
    await page.getByText(clientName, { exact: false }).first().click()
    await page.getByRole('button', { name: 'Excluir', exact: true }).first().click()
    await page.getByRole('button', { name: 'Excluir', exact: true }).last().click()
    await page.waitForTimeout(1200)
  }
  } catch (e) {
    bookingOk = false
    console.log('booking/cleanup step failed (non-fatal for the report):', (e as Error).message.slice(0, 120))
  }
  console.log('bookingOk:', bookingOk)

  // ---- WRITE REPORT -------------------------------------------------------
  fs.mkdirSync(path.dirname(REPORT), { recursive: true })
  fs.writeFileSync(REPORT, JSON.stringify({ clientCreated, recs, errorBodies, consoleErrs }, null, 2))

  // ---- CONSOLE SUMMARY ----------------------------------------------------
  const supa = recs.filter((r) => r.host.includes('supabase.co'))
  const phases = ['login', 'dashboard', 'clients-list', 'client-create', 'agenda', 'booking', 'cleanup']
  const line = (label: string, arr: Rec[]) => {
    const ms = arr.map((r) => r.ms ?? 0)
    const tot = ms.reduce((a, b) => a + b, 0)
    const avg = arr.length ? Math.round(tot / arr.length) : 0
    const max = ms.length ? Math.max(...ms) : 0
    const errs = arr.filter((r) => (r.status ?? 0) >= 400 || r.failed).length
    return `${label.padEnd(16)} n=${String(arr.length).padStart(3)}  avg=${String(avg).padStart(4)}ms  max=${String(max).padStart(4)}ms  errs=${errs}`
  }
  console.log('\n===== SUPABASE REQUEST AUDIT =====')
  console.log(`TOTAL supabase requests: ${supa.length}  (all hosts: ${recs.length})`)
  for (const ph of phases) console.log('  ' + line(ph, supa.filter((r) => r.phase === ph)))
  // duplicates within the whole run
  const byKey = new Map<string, Rec[]>()
  for (const r of supa) { const k = r.bodyKey; byKey.set(k, [...(byKey.get(k) ?? []), r]) }
  const dups = [...byKey.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length)
  console.log(`\nDUPLICATE request signatures (same method+path+query+body): ${dups.length}`)
  for (const [k, v] of dups.slice(0, 20)) console.log(`  x${v.length}  ${k.slice(0, 130)}`)
  const errors = supa.filter((r) => (r.status ?? 0) >= 400 || r.failed)
  console.log(`\nCLIENT CREATE SUCCEEDED: ${clientCreated}`)
  console.log(`ERROR responses: ${errors.length}`)
  for (const e of errors.slice(0, 25)) console.log(`  ${e.status ?? e.failed}  ${e.method} ${e.pathTmpl}${e.query.slice(0, 80)}`)
  console.log(`\nERROR BODIES (supabase >=400): ${errorBodies.length}`)
  for (const e of errorBodies.slice(0, 15)) console.log(`  [${e.phase}] ${e.status} ${e.body.slice(0, 200)}`)
  console.log(`\nCONSOLE ERRORS: ${consoleErrs.length}`)
  for (const c of consoleErrs.slice(0, 15)) console.log('  ' + c)
  console.log('\nReport JSON:', REPORT)
})
