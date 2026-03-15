import { test, expect, type Page } from '@playwright/test'

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.example.com`
const CANCELLED_STATUS_RE = /cancelled|annul|отмен/i

async function registerViaApi(email: string, password: string, page: Page) {
  const registerRes = await page.request.post('http://localhost:8080/api/v1/auth/register', {
    data: {
      email,
      password,
      first_name: 'E2E',
      last_name: 'User',
    },
  })
  expect(registerRes.ok()).toBeTruthy()
}

async function loginViaUi(email: string, password: string, page: Page) {
  await page.goto('/login')
  await expect(page.locator('#login-email')).toBeVisible()
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/profile/, { timeout: 15000 })
}

async function createOrderViaBooking(page: Page): Promise<{ id: string; title: string }> {
  const meRes = await page.request.get('http://localhost:8080/api/v1/auth/me')
  expect(meRes.ok()).toBeTruthy()
  const mePayload = (await meRes.json()) as { id?: string; user?: { id?: string } }
  const userId = mePayload?.id || mePayload?.user?.id
  expect(userId).toBeTruthy()
  await page.evaluate((id) => {
    const key = `guardian_profile_details_${id}`
    let base: Record<string, unknown> = {}
    try {
      const raw = localStorage.getItem(key)
      base = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    } catch {
      base = {}
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        ...base,
        online: true,
        rib: String(base.rib || 'FR7630006000011234567890189'),
      })
    )
  }, userId as string)
  await page.goto('/booking')
  await expect(page.getByText(/BOLH|Booking|Address/i).first()).toBeVisible({ timeout: 10000 })
  const onlineToggle = page.getByRole('button', { name: /Online|Offline|Онлайн|Оффлайн|En ligne|Hors ligne/i })
  const onlineToggleText = (await onlineToggle.innerText()).toLowerCase()
  if (onlineToggleText.includes('offline') || onlineToggleText.includes('оффлайн') || onlineToggleText.includes('hors ligne')) {
    await onlineToggle.click()
  }
  await expect(onlineToggle).toContainText(/Online|Онлайн|En ligne/i, { timeout: 5000 })
  // New booking flow requires explicit valid time range.
  const timeInputs = page.locator('input[placeholder="00:00"]')
  await timeInputs.nth(0).fill('09:00')
  await timeInputs.nth(1).fill('10:00')
  await page.getByRole('button', { name: /Next day/i }).click()
  await page
    .locator('input[placeholder*="Address"], input[placeholder*="address"], input[placeholder*="adresse"], input[placeholder*="адрес"], input[role="combobox"]')
    .first()
    .fill('Paris, France')
  await page.waitForTimeout(600)
  const firstSuggestion = page.locator('[role="listbox"] [role="option"]').first()
  if (await firstSuggestion.isVisible()) {
    await firstSuggestion.click()
  }
  await page.locator('input[inputmode="decimal"]').first().fill('25')

  const cardNumberInput = page.getByTestId('payment-card-number')
  if (!(await cardNumberInput.isVisible())) {
    const openPaymentSheetBtn = page.getByTestId('payment-sheet-toggle')
    if (await openPaymentSheetBtn.isVisible()) {
      await openPaymentSheetBtn.click()
    }
    const openOneTimeCardBtn = page.getByTestId('payment-one-time-toggle')
    if (await openOneTimeCardBtn.isVisible()) {
      await openOneTimeCardBtn.click()
    }
  }

  await expect(cardNumberInput).toBeVisible({ timeout: 10000 })
  await page.getByTestId('payment-card-number').fill('4532 0151 1283 0366')
  await page.getByTestId('payment-card-expiry').fill('12/30')
  await page.getByTestId('payment-card-cvc').fill('123')
  await page.getByTestId('payment-card-holder').fill('E2E User')
  await expect(page.getByTestId('payment-use-card')).toBeEnabled({ timeout: 10000 })
  await page.getByTestId('payment-use-card').click()
  await page.locator('form input[type="checkbox"]').last().check()
  await page.locator('form').evaluate((form) => {
    ;(form as HTMLFormElement).requestSubmit()
  })
  await expect(page).toHaveURL(/\/orders/, { timeout: 15000 })
  const firstOrderLink = page.locator('a[href^="/orders/"]').first()
  const firstOrderTitle = firstOrderLink.locator('p').first()
  await expect(firstOrderTitle).toBeVisible({ timeout: 8000 })
  const href = await firstOrderLink.getAttribute('href')
  expect(href).toBeTruthy()
  const id = (href || '').split('/').filter(Boolean).pop() || ''
  expect(id).toBeTruthy()
  return { id, title: (await firstOrderTitle.innerText()).trim() }
}

test.describe('Register -> Login -> Create order', () => {
  test('register, login, create order, and see synced state', async ({ page, context }) => {
    const email = unique()
    const password = 'TestPass123!'

    await registerViaApi(email, password, page)

    await context.clearCookies()
    await loginViaUi(email, password, page)
    const created = await createOrderViaBooking(page)

    await page.goto('/booking')
    await expect(page.getByText(/Active order/i)).toBeVisible({ timeout: 12000 })
    await expect(page.getByText(created.title, { exact: false })).toBeVisible({ timeout: 12000 })
  })

  test('cancel in details updates orders list status', async ({ page, context }) => {
    const email = unique()
    const password = 'TestPass123!'
    await registerViaApi(email, password, page)
    await context.clearCookies()
    await loginViaUi(email, password, page)
    const created = await createOrderViaBooking(page)

    await page.goto('/orders')
    await page.locator(`a[href="/orders/${created.id}"]`).first().click()
    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })
    await page.getByRole('button', { name: /Cancel/i }).click()
    await expect(page.getByText(CANCELLED_STATUS_RE).first()).toBeVisible({ timeout: 10000 })
    await page.goto('/orders')
    const cancelledOrderItem = page.locator(`a[href="/orders/${created.id}"]`).first().locator('xpath=ancestor::li[1]')
    await expect(cancelledOrderItem.getByText(CANCELLED_STATUS_RE).first()).toBeVisible({ timeout: 12000 })
  })

  test('order chat message persists after reload', async ({ page, context }) => {
    const email = unique()
    const password = 'TestPass123!'
    await registerViaApi(email, password, page)
    await context.clearCookies()
    await loginViaUi(email, password, page)
    const created = await createOrderViaBooking(page)

    const chatMessage = `E2E chat ${Date.now()}`
    await page.goto(`/orders/${created.id}/chat`)
    await expect(page.getByPlaceholder(/message/i)).toBeVisible({ timeout: 10000 })
    await page.getByPlaceholder(/message/i).fill(chatMessage)
    const composer = page.locator('div.fixed.bottom-20')
    await composer.locator('button').click()
    await expect(page.getByText(chatMessage)).toBeVisible({ timeout: 8000 })

    await page.reload()
    await expect(page.getByText(chatMessage)).toBeVisible({ timeout: 10000 })
  })
})
