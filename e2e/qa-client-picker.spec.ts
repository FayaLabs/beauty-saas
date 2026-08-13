import { test, expect } from '@playwright/test'
import { SEED } from './fixtures/credentials'

// ---------------------------------------------------------------------------
// Client picker in the agenda — the regression that made an existing client
// unfindable.
//
// The lookup is tenant-scoped and reads the active tenant when it runs. Opening
// the modal and typing BEFORE the org store resolves used to answer with an
// empty list — indistinguishable from "no such client" — and never retry, so
// the only option left on screen was "New client", which is how duplicates get
// born. This spec types immediately after load, on purpose: the race is the
// subject, not an accident of timing.
//
// Read-only: the modal is dismissed with Escape, nothing is saved.
// ---------------------------------------------------------------------------

const CLIENT = SEED.clients[1] // QA Cliente Dois

test('finds an existing client even when typing before the org resolves', async ({ page }) => {
  await page.goto('/#/agenda')

  // Deliberately NOT waiting for the workspace name to render.
  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Novo Agendamento' })).toBeVisible()

  const input = dialog.getByPlaceholder(/Buscar cliente/i)
  await input.click()
  await input.pressSequentially(CLIENT.slice(0, 6), { delay: 60 })

  // The match must appear once the tenant lands, without further typing.
  await expect(page.getByRole('option', { name: new RegExp(CLIENT, 'i') })).toBeVisible({ timeout: 15_000 })

  await page.keyboard.press('Escape')
})

test('a narrowing query is not overwritten by its own prefix', async ({ page }) => {
  await page.goto('/#/agenda')
  await expect(page.getByText(/QA Fayz BeautySoft/i).first()).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Criar', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Novo Agendamento' })).toBeVisible()

  const input = dialog.getByPlaceholder(/Buscar cliente/i)
  await input.click()
  // Slow enough that each prefix fires its own request: the broad early one
  // ("qa") must not land on top of the narrow later one.
  await input.pressSequentially('qa', { delay: 300 })
  await page.waitForTimeout(400)
  await input.pressSequentially(' cliente dois', { delay: 60 })
  await page.waitForTimeout(2000)

  const options = await page.getByRole('option').allInnerTexts()
  const matches = options.filter((o) => !/Novo cliente/i.test(o))
  expect(matches.every((o) => new RegExp(CLIENT, 'i').test(o))).toBe(true)

  await page.keyboard.press('Escape')
})
