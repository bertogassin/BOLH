import { test, expect } from '@playwright/test'

test.describe('Админка: дашборд', () => {
  test('главная ведёт на дашборд', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Guardian Admin')).toBeVisible()
    await page.click('text=Перейти в дашборд')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('дашборд показывает блоки статистики', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('text=Дашборд')).toBeVisible()
    await expect(page.locator('text=Всего пользователей')).toBeVisible()
    await expect(page.locator('text=Активные заказы')).toBeVisible()
  })
})

test.describe('Админка: пользователи', () => {
  test('страница пользователей загружается', async ({ page }) => {
    await page.goto('/dashboard/users')
    await expect(page.locator('text=Пользователи')).toBeVisible()
    await expect(page.locator('input[placeholder*="Поиск"]')).toBeVisible()
  })

  test('переход в карточку пользователя', async ({ page }) => {
    await page.goto('/dashboard/users')
    await page.click('text=Иван Петров')
    await expect(page).toHaveURL(/\/dashboard\/users\/1/)
    await expect(page.locator('text=Иван Петров')).toBeVisible()
  })
})
