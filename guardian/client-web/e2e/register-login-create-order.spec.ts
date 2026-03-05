import { test, expect } from '@playwright/test'

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.example.com`

test.describe('Register → Login → Create order', () => {
  test('register, then create order and see it in list', async ({ page }) => {
    const email = unique()
    const password = 'TestPass123!'

    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /Регистрация|Register/i })).toBeVisible()

    await page.getByPlaceholder(/Иван|First|Prénom/i).first().fill('E2E')
    await page.getByPlaceholder(/Фамилия|Last|Nom/i).fill('User')
    await page.getByPlaceholder(/you@example|email|mail/i).fill(email)
    await page.getByPlaceholder(/пароль|password|mot de passe/i).fill(password)
    await page.getByRole('button', { name: /Зарегистрироваться|Register|Créer/i }).click()

    await expect(page).toHaveURL(/\/(booking|\?)/)
    await page.goto('/booking')
    await expect(page.getByText(/BOLH|Réservation|Booking|Адрес/i).first()).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder(/Adresse|Address|Адрес/i).fill('Paris, France')
    await page.waitForTimeout(600)
    const firstSuggestion = page.locator('[role="listbox"] [role="option"]').first()
    if (await firstSuggestion.isVisible()) {
      await firstSuggestion.click()
    }
    await page.getByPlaceholder(/price|prix|цена/i).fill('25')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /Confirmer|Confirm|Подтвердить/i }).click()

    await expect(page).toHaveURL(/\/orders/, { timeout: 15000 })
    await expect(page.getByText(/Paris|Réservation|Order|Заказ/i).first()).toBeVisible({ timeout: 5000 })
  })
})
