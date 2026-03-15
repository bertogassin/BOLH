import { test, expect } from '@playwright/test'

const API_BASE = process.env.E2E_API_BASE || 'http://localhost:8080'
const ADMIN_SECRET = process.env.E2E_ADMIN_SECRET || 'admin-e2e-secret'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin.e2e@guardian.local'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'AdminE2E!123'

test.describe('Admin smoke', () => {
  test('login page renders controls', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /admin panel login/i })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('unauthenticated dashboard redirects to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('admin login then users list/details then logout', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL)
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /^Dashboard$/i })).toBeVisible({ timeout: 20000 })
    await page.getByRole('link', { name: /^Users$/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/users/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /^Users$/i })).toBeVisible()

    const firstUserLink = page.locator('a[href^="/dashboard/users/"]').first()
    await expect(firstUserLink).toBeVisible()
    await firstUserLink.click()
    await expect(page).toHaveURL(/\/dashboard\/users\/[^/]+/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: /E2E Admin/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Profile$/i })).toBeVisible()

    await page.getByRole('link', { name: /^Settings$/i }).click()
    await expect(page).toHaveURL(/\/settings/, { timeout: 20000 })
    await page.getByRole('button', { name: /sign out admin/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 })

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 })
  })

  test('admin backend endpoints respond with admin key', async ({ request }) => {
    const usersRes = await request.get(`${API_BASE}/api/v1/admin/users`, {
      headers: { 'X-Admin-Key': ADMIN_SECRET },
    })
    expect(usersRes.ok()).toBeTruthy()
    const usersBody = (await usersRes.json()) as { users?: unknown[] }
    expect(Array.isArray(usersBody.users)).toBeTruthy()

    const securityRes = await request.get(`${API_BASE}/api/v1/admin/security/summary`, {
      headers: { 'X-Admin-Key': ADMIN_SECRET },
    })
    expect(securityRes.ok()).toBeTruthy()
    const securityBody = (await securityRes.json()) as { signed_request_mode?: string }
    expect(typeof securityBody.signed_request_mode).toBe('string')
  })
})
