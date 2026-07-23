import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// QA regressions — owner session (qa+beauty@fayalabs.com), QA tenant `qa-fayz`.
// Smoke-covers the shell surfaces: dashboard, company settings persistence,
// plugin settings persistence, the Tasks entry point, the chat FAB, and the
// user/workspace menu. Everything runs read-mostly; the two persistence tests
// restore the original value they changed.
// ---------------------------------------------------------------------------

test.describe('QA regressions (owner)', () => {
  test('login + dashboard renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible()
    await expect(page.getByText('Agendamentos Hoje')).toBeVisible()
    await expect(page.getByText('Clientes Ativos')).toBeVisible()
  })

  test('company settings save → reload persists', async ({ page }) => {
    await page.goto('/#/settings')
    const input = page.locator('#company-name')
    await expect(input).toBeVisible()
    // Value loads async — wait until it is populated before capturing it.
    await expect(input).toHaveValue(/.+/)
    const original = await input.inputValue()
    const probe = `${original} ~qa${Date.now() % 100000}`

    await input.fill(probe)
    await page.getByRole('button', { name: 'Salvar Alterações', exact: true }).click()
    await page.waitForTimeout(1500)

    await page.goto('/#/settings')
    await expect(page.locator('#company-name')).toHaveValue(probe)

    // Restore the original tenant name so other specs / the seed stay stable.
    await page.locator('#company-name').fill(original)
    await page.getByRole('button', { name: 'Salvar Alterações', exact: true }).click()
    await page.waitForTimeout(1200)
    await page.goto('/#/settings')
    await expect(page.locator('#company-name')).toHaveValue(original)
  })

  test('plugin (Sales & CRM) settings toggle persists', async ({ page }) => {
    await page.goto('/#/settings')
    await page.getByRole('button', { name: 'Vendas & CRM', exact: true }).click()
    const sw = page.getByRole('switch').first()
    await expect(sw).toBeVisible()

    const before = await sw.getAttribute('aria-checked')
    await sw.click()
    const flipped = await sw.getAttribute('aria-checked')
    expect(flipped).not.toBe(before)

    // Settings auto-save is debounced (~2-3s); give it time before reloading.
    await page.waitForTimeout(3500)
    await page.goto('/#/dashboard')
    await page.waitForTimeout(1000)
    await page.goto('/#/settings')
    await page.getByRole('button', { name: 'Vendas & CRM', exact: true }).click()
    const sw2 = page.getByRole('switch').first()
    await expect(sw2).toHaveAttribute('aria-checked', flipped!)

    // Restore the original value.
    await sw2.click()
    await page.waitForTimeout(3500)
  })

  test('Tasks entry point opens the tasks drawer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Tasks' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tarefas' })).toBeVisible()
  })

  test('chat FAB opens the assistant panel', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Abrir assistente' }).click()
    // The panel is a dialog with a composer; the agent connection comes from
    // VITE_FAYZ_* env, so the old "não configurado" notice no longer applies.
    const panel = page.getByRole('dialog')
    await expect(panel).toBeVisible()
    await expect(panel.locator('textarea')).toBeVisible()
  })

  test('user / workspace menu opens without crashing', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(e.message))

    await page.goto('/')
    await page.getByRole('button', { name: 'User menu' }).click()
    await expect(page.getByText('qa+beauty@fayalabs.com')).toBeVisible()
    await expect(page.getByText('Sair', { exact: true })).toBeVisible()

    expect(pageErrors, `unexpected page errors: ${pageErrors.join(' | ')}`).toHaveLength(0)
  })

  // NOTE (product finding): the topbar layout renders NO notification bell.
  // The SDK's NotificationBell only mounts in the sidebar layout; BeautySoft
  // uses `layout: 'topbar'`, so there is no "sino" to open here. Documented as
  // an exploratory finding rather than a fake assertion.
  test.skip('notification bell opens — N/A: no bell in topbar layout', async () => {})
})
