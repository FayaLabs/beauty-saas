import { test, expect } from '@playwright/test'

// Core addresses tab — public.addresses (@fayz-ai/db 017_core_addresses) plus
// the CRUD surface in @fayz-ai/saas AddressesTab. Guards the regression this
// was written for: the tab used to render "Could not find the table
// 'public.addresses'" in every non-shop app.

test('addresses tab: create, edit, delete', async ({ page }) => {
  // Open the QA tenant's contact, then its Endereços tab.
  await page.goto('/#/registry/contacts')
  await page.getByRole('cell', { name: 'Doguez' }).click()
  await expect(page).toHaveURL(/#\/registry\/contacts\/[0-9a-f-]{36}/)
  await page.getByRole('tab', { name: 'Endereços' }).click()

  // The schema-cache error must be gone.
  await expect(page.getByText('Could not find the table')).toHaveCount(0)

  // Start from a clean slate — a previous run may have left rows behind.
  // Wait for the tab to finish loading first, or the count below reads 0 off
  // the skeleton and the cleanup silently no-ops.
  await expect(page.getByRole('button', { name: 'Adicionar endereço' })).toBeVisible()
  const editButtons = page.getByRole('button', { name: 'Editar endereço' })
  for (let left = await editButtons.count(); left > 0; left--) {
    await page.getByRole('button', { name: 'Remover este endereço?' }).first().click()
    await page.getByRole('button', { name: 'Excluir' }).click()
    await expect(editButtons).toHaveCount(left - 1)
  }

  await page.getByRole('button', { name: 'Adicionar endereço' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Novo endereço')).toBeVisible()

  await page.getByLabel('CEP *').fill('22785-215')
  await page.getByLabel('Rua *').fill('Rua dos Pássaros')
  await page.getByLabel('Número').fill('1200')

  // City still empty → Salvar must stay disabled.
  await expect(page.getByRole('button', { name: 'Salvar' })).toBeDisabled()

  await page.getByLabel('Bairro').fill('Recreio dos Bandeirantes')
  await page.getByLabel('Cidade *').fill('Rio de Janeiro')
  await page.getByLabel('UF').fill('RJ')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(page.getByText('Rua dos Pássaros, 1200')).toBeVisible()
  await expect(page.getByText('Recreio dos Bandeirantes')).toBeVisible()

  // Edit
  await page.getByRole('button', { name: 'Editar endereço' }).first().click()
  await expect(dialog.getByText('Editar endereço')).toBeVisible()
  await page.getByLabel('Número').fill('1300')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Rua dos Pássaros, 1300')).toBeVisible()

  // Delete (row trash → ConfirmDialog)
  await page.getByRole('button', { name: 'Remover este endereço?' }).first().click()
  await page.getByRole('button', { name: 'Excluir' }).click()
  await expect(page.getByText('Rua dos Pássaros')).toHaveCount(0)
})
