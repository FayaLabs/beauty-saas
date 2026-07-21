import { test as setup, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { OWNER_EMAIL, RESTRITO_EMAIL, QA_PASSWORD } from './fixtures/credentials'

// Persist authenticated Supabase sessions (token lives in localStorage under the
// :5301 origin; storageState captures it). Two roles: owner (full access) and
// restrito (secretaria) for the permissions matrix spec.
const ownerFile = path.join('e2e', '.auth', 'owner.json')
const restritoFile = path.join('e2e', '.auth', 'restrito.json')

async function login(page: import('@playwright/test').Page, email: string, file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })

  await page.goto('/')

  // Split login (English shell chrome): Email + Password textboxes, "Sign in".
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(QA_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Landing on the shell (login form gone + the "Painel"/dashboard heading)
  // confirms the session is live.
  await expect(page.locator('input[type="email"]')).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible({ timeout: 30_000 })

  await page.context().storageState({ path: file })
}

setup('authenticate owner', async ({ page }) => {
  expect(QA_PASSWORD, 'QA_TENANT_PASSWORD must be set in beauty-saas/.env').not.toBe('')
  await login(page, OWNER_EMAIL, ownerFile)
})

setup('authenticate restrito', async ({ page }) => {
  await login(page, RESTRITO_EMAIL, restritoFile)
})
