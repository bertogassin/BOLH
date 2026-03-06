import { test, expect } from '@playwright/test'

test.describe('Admin: dashboard', () => {
  test('home leads to dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Guardian Admin')).toBeVisible()
    await page.click('text=Go to dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('dashboard shows stats blocks', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Total users')).toBeVisible()
    await expect(page.locator('text=Active orders')).toBeVisible()
  })
})

test.describe('Admin: users', () => {
  test('users page loads', async ({ page }) => {
    await page.goto('/dashboard/users')
    await expect(page.locator('text=Users')).toBeVisible()
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
  })

  test('navigate to user details', async ({ page }) => {
    await page.goto('/dashboard/users')
    await page.click('text=Alex Taylor')
    await expect(page).toHaveURL(/\/dashboard\/users\/1/)
    await expect(page.locator('text=Alex Taylor')).toBeVisible()
  })
})
