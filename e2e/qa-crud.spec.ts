import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Clients CRUD — createCrudPage(clientEntity, extensionTable 'clients').
//
// Full lifecycle (create → edit → delete). This spec previously PINNED the
// schema-drift bug B11 ("anamnesis_notes column missing" on the live salon
// pool); the missing care-profile columns were applied on 2026-07-21 and the
// pinned test flipped — this is the restored real coverage.
// ---------------------------------------------------------------------------

test.describe('Clients CRUD (owner, QA tenant)', () => {
  test.describe.configure({ mode: 'serial' })
  const stamp = Date.now()
  const name = `QA Cliente ${stamp}`
  const renamed = `${name} Editado`

  test('create a client', async ({ page }) => {
    await page.goto('/#/clients')
    await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: '+ Adicionar Cliente', exact: true }).click()
    await expect(page).toHaveURL(/#\/clients\/new/)

    await page.locator('input[type="text"]').first().fill(name)                       // Nome*
    await page.locator('input[type="email"]').first().fill(`qa.${stamp}@example.com`) // E-mail*
    await page.getByRole('button', { name: 'Adicionar Cliente', exact: true }).click()

    // Save succeeds: leaves /new and the row is listed.
    await expect(page).not.toHaveURL(/#\/clients\/new/, { timeout: 15_000 })
    await page.goto('/#/clients')
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  })

  test('edit the client', async ({ page }) => {
    await page.goto('/#/clients')
    await page.getByText(name, { exact: false }).first().click()
    const nameInput = page.locator('input[type="text"]').first()
    await expect(nameInput).toHaveValue(new RegExp(name.slice(0, 12)), { timeout: 15_000 })
    await nameInput.fill(renamed)
    await page.getByRole('button', { name: /Salvar/i }).first().click()
    await page.goto('/#/clients')
    await expect(page.getByText(renamed, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  })

  test('delete the client', async ({ page }) => {
    await page.goto('/#/clients')
    await page.getByText(renamed, { exact: false }).first().click()
    await page.getByRole('button', { name: 'Excluir', exact: true }).first().click()
    // Confirm dialog ("Excluir Cliente?") — destructive confirm button.
    await page.getByRole('button', { name: 'Excluir', exact: true }).last().click()
    await page.goto('/#/clients')
    await expect(page.getByText(renamed, { exact: false })).toHaveCount(0, { timeout: 15_000 })
  })
})
