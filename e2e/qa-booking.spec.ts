import { test, expect } from '@playwright/test'
import { SEED } from './fixtures/credentials'

// ---------------------------------------------------------------------------
// Agenda booking — create + delete an appointment in the QA tenant (FullCalendar
// time-grid). Uses the seeded professional / service and the seeded client
// "QA Cliente Dois" — deliberately the OTHER seeded client, so the created event
// never collides with the seeded "QA Cliente Um" appointment that the seed keeps
// on the grid. All picker options come from public.people / public.services.
//
// Cleanup: the test deletes the exact event it creates (matched by client), so
// the QA tenant is left as it was. dataCritical — it never touches the seeded
// appointment (different client).
// ---------------------------------------------------------------------------

const PRO = SEED.professionals[0]   // QA Cabeleireira Marina
const CLIENT = SEED.clients[1]      // QA Cliente Dois (distinct from seed appt)
const SERVICE = SEED.services[0]    // QA Corte Feminino

test.describe('Agenda booking (owner, QA tenant)', () => {
  test('create then delete an appointment', async ({ page }) => {
    await page.goto('/#/agenda')
    await expect(page.getByRole('button', { name: 'Criar', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Criar', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Novo Agendamento' })).toBeVisible()

    // Professional
    await dialog.getByRole('button', { name: /Selecionar profissional/ }).click()
    await page.getByText(PRO, { exact: true }).last().click()

    // Client — searchable picker.
    await dialog.getByRole('button', { name: /Adicionar cliente/ }).click()
    await page.getByRole('dialog').locator('input').last().fill(CLIENT)
    await page.waitForTimeout(800)
    await page.getByText(CLIENT, { exact: true }).last().click()

    // Service — searchable picker.
    await dialog.getByRole('button', { name: /Adicionar serviço/ }).click()
    await page.getByRole('dialog').locator('input').last().fill(SERVICE)
    await page.waitForTimeout(800)
    await page.getByText(SERVICE, { exact: true }).last().click()

    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()

    // Dialog closes; the new event lands on the calendar grid.
    await expect(dialog).toBeHidden()
    const event = page.locator('.fc-timegrid-event').filter({ hasText: CLIENT })
    await expect(event.first()).toBeVisible()

    // ---- EDIT check: reopen the event (double-click opens the editor) ------
    await event.first().dblclick({ force: true })
    const editor = page.getByRole('dialog')
    await expect(editor).toBeVisible()
    await expect(editor.getByText(PRO)).toBeVisible()
    await expect(editor.getByText(CLIENT)).toBeVisible()

    // ---- DELETE (cleanup) --------------------------------------------------
    // The editor's "Excluir" is a two-step arm→confirm control: the first click
    // arms it, the second confirms and deletes.
    const excluir = editor.getByRole('button', { name: 'Excluir', exact: true })
    await excluir.click()
    await page.waitForTimeout(700)
    if (await excluir.isVisible().catch(() => false)) await excluir.click()

    await expect(editor).toBeHidden()
    await expect(page.locator('.fc-timegrid-event').filter({ hasText: CLIENT })).toHaveCount(0)
  })
})
