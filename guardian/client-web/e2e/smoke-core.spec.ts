import { test, expect } from '@playwright/test'

test.describe('Client web smoke', () => {
  test('login page renders main controls', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('#login-email')).toBeVisible()
    await expect(page.locator('#login-password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('booking page requires auth and shows login action', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/booking')
    await expect(page.locator('a[href="/login"]').first()).toBeVisible()
  })

  test('api health endpoint is reachable', async ({ request }) => {
    const res = await request.get('http://localhost:8080/health')
    expect(res.ok()).toBeTruthy()
    const data = (await res.json()) as { status?: string }
    expect(data.status).toBe('ok')
  })
})
