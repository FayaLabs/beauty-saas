import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Permission matrix — restricted "secretaria" (qa-restrito) vs owner.
//
// From src/config/permissions.ts, the `secretaria` profile has NO marketing
// grants and NONE of manage_team / manage_settings / manage_permissions. It
// keeps dashboard / agenda / clients / services(read) / inventory(read) /
// sales(read) / financial(read) / reports.
//
// Expected, verified live:
//   * Marketing topbar group is HIDDEN for secretaria, VISIBLE for owner.
//   * Deep-linking /#/marketing as secretaria renders the "Acesso restrito" gate.
//   * Settings exposes only Geral/Perfil/Segurança to secretaria (no Equipe,
//     no Permissões); owner sees Equipe + Permissões.
// ---------------------------------------------------------------------------

test.describe('restricted secretaria (qa-restrito)', () => {
  test.use({ storageState: 'e2e/.auth/restrito.json' })

  test('core modules visible, Marketing hidden', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible()

    // Granted modules present in the topbar.
    for (const g of ['Agenda', 'Clientes', 'Financeiro', 'Relatórios']) {
      await expect(page.getByRole('button', { name: g, exact: true })).toBeVisible()
    }
    // No marketing grant → the Marketing group must not render.
    await expect(page.getByRole('button', { name: 'Marketing', exact: true })).toHaveCount(0)
  })

  test('Marketing route is gated with "Acesso restrito"', async ({ page }) => {
    await page.goto('/#/marketing')
    await expect(page.getByText('Acesso restrito')).toBeVisible()
    await expect(page.getByText(/não tem permissão para acessar/i)).toBeVisible()
  })

  test('Settings exposes only self-service tabs (no Equipe / Permissões)', async ({ page }) => {
    await page.goto('/#/settings')
    await expect(page.getByRole('button', { name: 'Geral', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Segurança', exact: true })).toBeVisible()
    // manage_team / manage_permissions are absent for secretaria.
    await expect(page.getByRole('button', { name: 'Equipe', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Permissões', exact: true })).toHaveCount(0)
  })
})

test.describe('owner (qa+beauty)', () => {
  // Uses the default owner storageState from playwright.config.ts.
  test('Marketing group + privileged settings tabs visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Marketing', exact: true })).toBeVisible()

    await page.goto('/#/settings')
    await expect(page.getByRole('button', { name: 'Equipe', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Permissões', exact: true })).toBeVisible()
  })
})
