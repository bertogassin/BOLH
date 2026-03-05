import { test, expect } from '@playwright/test'

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.example.com`

test.describe('Register -> Login -> Create order', () => {
  test('register, then create order and see it in list', async ({ page }) => {
    const email = unique()
    const password = 'TestPass123!'

    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /Register/i })).toBeVisible()

    await page.getByPlaceholder(/First/i).first().fill('E2E')
    await page.getByPlaceholder(/Last|Nom/i).fill('User')
    await page.getByPlaceholder(/you@example|email|mail/i).fill(email)
    await page.getByPlaceholder(/password/i).fill(password)
    await page.getByRole('button', { name: /Register/i }).click()

    await expect(page).toHaveURL(/\/(booking|\?)/)
    await page.goto('/booking')
    await expect(page.getByText(/BOLH|Booking|Address/i).first()).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder(/Address/i).fill('Paris, France')
    await page.waitForTimeout(600)
    const firstSuggestion = page.locator('[role="listbox"] [role="option"]').first()
    if (await firstSuggestion.isVisible()) {
      await firstSuggestion.click()
    }
    await page.getByPlaceholder(/price/i).fill('25')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /Confirm/i }).click()

    await expect(page).toHaveURL(/\/orders/, { timeout: 15000 })
    await expect(page.getByText(/Paris|Order/i).first()).toBeVisible({ timeout: 5000 })
  })
})
