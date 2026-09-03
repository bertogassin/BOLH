import { expect, test } from '@playwright/test'

test.describe('Theme synchronization', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} theme survives navigation and reload`, async ({ page }) => {
      await page.goto('/login')
      await page.evaluate((value) => localStorage.setItem('bolh-theme', value), theme)
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await page.goto('/settings')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await page.goto('/map')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    })
  }
})
