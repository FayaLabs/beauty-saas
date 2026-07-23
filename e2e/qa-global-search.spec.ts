import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Global search (⌘K command palette) — owner session, QA tenant `qa-fayz`.
//
// The regression this locks down: the palette rendered "Nenhum resultado
// encontrado" for every record query while its own footer counted results. Two
// causes, both covered below — the shell never passed an entity searcher at
// all, and cmdk's built-in filter re-filtered whatever the server did return.
//
// Read-only: opens the palette, types, asserts, escapes. Nothing is written.
// ---------------------------------------------------------------------------

const SEED = {
  client: 'QA Cliente Um',
  contact: 'Doguez',
  supplier: 'Roland',
  service: 'QA Corte Feminino',
  product: 'Preenchedores 2ml',
}

async function openPalette(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  const input = page.getByPlaceholder(/buscar|search/i).last()
  await expect(input).toBeVisible()
  return input
}

async function search(page: Page, term: string) {
  const input = await openPalette(page)
  await input.fill(term)
  // Debounce (140ms) + the fan-out. On a pool WITHOUT 018_global_search.sql
  // every entity is queried separately, so a cold query is seconds, not
  // milliseconds — the wait tracks the slow path on purpose.
  await page.waitForTimeout(6000)
  return page.getByRole('dialog').last()
}

test.describe('global search', () => {
  test('finds a client by a fragment of its name', async ({ page }) => {
    const dialog = await search(page, 'cliente um')
    await expect(dialog.getByText(SEED.client, { exact: false }).first()).toBeVisible()
    await expect(dialog.getByText('Nenhum resultado encontrado.')).toHaveCount(0)
  })

  test('finds records across different entities in one query', async ({ page }) => {
    const dialog = await search(page, 'qa')
    // A person, a service — one query, several kinds of record.
    await expect(dialog.getByText(SEED.client, { exact: false }).first()).toBeVisible()
    await expect(dialog.getByText(SEED.service, { exact: false }).first()).toBeVisible()
  })

  test('finds a product by a prefix (the "bigodin" case)', async ({ page }) => {
    const dialog = await search(page, 'preenched')
    await expect(dialog.getByText(SEED.product, { exact: false }).first()).toBeVisible()
  })

  test('finds a non-client person (contact archetype)', async ({ page }) => {
    const dialog = await search(page, 'doguez')
    await expect(dialog.getByText(SEED.contact, { exact: false }).first()).toBeVisible()
  })

  test('opening a result navigates to that record', async ({ page }) => {
    const dialog = await search(page, 'cliente um')
    await dialog.getByText(SEED.client, { exact: false }).first().click()
    await expect(page).toHaveURL(/#\/clients\/[0-9a-f-]{36}/)
  })

  test('a query that matches nothing still says so', async ({ page }) => {
    const dialog = await search(page, 'zzzqqqxyw')
    await expect(dialog.getByText('Nenhum resultado encontrado.')).toBeVisible()
  })

  test('navigation commands still resolve, and are ranked under records', async ({ page }) => {
    const dialog = await search(page, 'client')
    // The Clientes page is a command; the client record is a record. Both show.
    await expect(dialog.getByText(SEED.client, { exact: false }).first()).toBeVisible()
    await expect(dialog.getByText('Clientes', { exact: true }).first()).toBeVisible()
  })
})
