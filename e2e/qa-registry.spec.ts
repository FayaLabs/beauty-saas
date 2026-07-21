import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Registry CRUD — Services (createCrudPage(serviceEntity)) in the QA tenant.
// Full lifecycle: create via the SaveBar, edit via the detail page, delete via
// the row trash icon + "Excluir {entity}?" confirm dialog. Every row it touches
// is one it created (timestamped name), honoring the dataCritical rule.
// ---------------------------------------------------------------------------

test.describe('Registry — Services CRUD (owner, QA tenant)', () => {
  test('create → edit → delete a service', async ({ page }) => {
    const stamp = Date.now()
    const name = `QA Serviço ${stamp}`
    const renamed = `${name} EDIT`

    // ---- CREATE -----------------------------------------------------------
    await page.goto('/#/registry/services')
    await expect(page.getByRole('heading', { name: 'Serviços', level: 1 })).toBeVisible()
    await page.getByRole('button', { name: '+ Adicionar Serviço', exact: true }).click()

    await expect(page).toHaveURL(/#\/registry\/services\/new/)
    const nameInput = page.locator('input[type="text"]').first()   // Nome do Serviço*
    const durInput = page.locator('input[type="number"]').first()  // Duração (min)*
    const priceInput = page.locator('input[placeholder="0,00"]').first() // Preço*
    await nameInput.fill(name)
    await durInput.fill('30')
    await priceInput.fill('99,00')
    // Confirm the required fields committed before submitting.
    await expect(nameInput).toHaveValue(name)
    await expect(durInput).toHaveValue('30')
    // Wait for the SaveBar to arm, then submit.
    await expect(page.getByText('Alterações não salvas')).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar Serviço', exact: true }).click()

    // Back on the list with the new row present.
    await expect(page).toHaveURL(/#\/registry\/services$/)
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible()

    // ---- EDIT -------------------------------------------------------------
    await page.getByText(name, { exact: true }).first().click()
    await expect(page).toHaveURL(/#\/registry\/services\/[0-9a-f-]+$/)
    await page.getByRole('button', { name: 'Editar', exact: true }).click()
    await expect(page).toHaveURL(/\/edit$/)

    const nameField = page.locator('input[type="text"]').first()
    await nameField.fill(renamed)
    // SaveBar appears on dirty; its label may be "Salvar" or "Salvar Alterações".
    await page.getByRole('button', { name: /^Salvar( Alterações)?$/ }).first().click()

    await expect(page).toHaveURL(/#\/registry\/services(\/[0-9a-f-]+)?$/)
    await page.goto('/#/registry/services')
    await expect(page.getByRole('cell', { name: renamed, exact: true })).toBeVisible()

    // ---- DELETE -----------------------------------------------------------
    const row = page.getByRole('row', { name: new RegExp(`${stamp}`) })
    await expect(row).toBeVisible()
    // Row actions: [edit pencil, delete trash]; the trash is the last button.
    const rowButtons = row.getByRole('button')
    await rowButtons.nth((await rowButtons.count()) - 1).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: /Excluir .+\?/ })).toBeVisible()
    await dialog.getByRole('button', { name: 'Excluir', exact: true }).click()

    await expect(page.getByRole('cell', { name: renamed, exact: true })).toHaveCount(0)
  })
})
