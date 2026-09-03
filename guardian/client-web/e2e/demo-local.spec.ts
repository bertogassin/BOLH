import { expect, test } from '@playwright/test'

test.describe('Backend-free demo', () => {
  test('password visibility and demo entry are interactive', async ({ page }) => {
    await page.goto('/login')
    const password = page.locator('#login-password')
    await password.fill('demo12345')
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByTestId('password-visibility-toggle').click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByTestId('password-visibility-toggle').click()
    await expect(password).toHaveAttribute('type', 'password')

    await page.getByTestId('demo-entry').click()
    await expect(page).toHaveURL(/\/map$/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('guardian_token'))).toBe('demo')
  })

  test('normal login form uses the local demo adapter', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#login-email').fill('demo@bolh.app')
    await page.locator('#login-password').fill('demo12345')
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/profile$/)
  })
})
