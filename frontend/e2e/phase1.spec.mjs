import { test, expect } from '@playwright/test'

const password = 'isolated-browser-test-password'
const api = 'http://127.0.0.1:8001'
const unique = () =>
  `phase1-${Date.now()}-${Math.random().toString(36).slice(2)}`

async function createAccount(request) {
  const username = unique()
  const response = await request.post(`${api}/signup`, {
    data: { username, password },
  })
  expect(response.status()).toBe(200)
  return username
}
async function login(page, username) {
  await page.goto('/#/login')
  await page.getByPlaceholder('Username', { exact: true }).fill(username)
  await page.getByPlaceholder('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
  await expect(page.getByText('Loading internships...')).toHaveCount(0)
}
async function fillInternship(page, company = 'Phase 1 Example') {
  const cards = page.getByRole('button', { name: 'Card view', exact: true })
  if (await cards.isVisible()) await cards.click()
  if (
    !(await page.getByPlaceholder('Company *', { exact: true }).isVisible())
  ) {
    await page
      .getByRole('main')
      .getByRole('button', { name: 'New application', exact: true })
      .click()
  }
  await page.getByPlaceholder('Company *', { exact: true }).fill(company)
  await page
    .getByPlaceholder('Role *', { exact: true })
    .fill('Engineering Intern')
  await page.locator('[name="application_date"]').fill('2026-10-23')
  await page.locator('[name="location"]').fill('Bengaluru')
  await page.locator('[name="job_url"]').fill('https://example.com/job')
  await page.locator('[name="notes"]').fill('Test notes\nSecond line')
}
async function noHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('body *')]
      .filter(
        (element) =>
          element.getBoundingClientRect().right > innerWidth + 1 &&
          element.getBoundingClientRect().width,
      )
      .slice(0, 8)
      .map((element) => element.className?.baseVal ?? element.className),
  }))
  expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.width,
  )
}

test('signup, login, CRUD persistence, search, filters, logout and account isolation', async ({
  page,
  request,
}) => {
  const username = unique()
  await page.goto('/#/login')
  await page.getByText("Don't have an account? Sign up").click()
  await page.getByPlaceholder('Username', { exact: true }).fill(username)
  await page.getByPlaceholder('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click()
  await expect(
    page.getByText('Account created! You can now log in.'),
  ).toBeVisible()
  await page.getByPlaceholder('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
  await fillInternship(page)
  await page
    .getByRole('button', { name: 'Add Internship', exact: true })
    .click()
  const card = page.locator('article').filter({ hasText: 'Phase 1 Example' })
  await expect(card).toHaveCount(1)
  await page.reload()
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('Second line')
  await card.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('[name="status"]').selectOption('Interview')
  await page.locator('[name="notes"]').fill('Updated notes')
  await page
    .getByRole('button', { name: 'Update Internship', exact: true })
    .click()
  await expect(card).toContainText('Updated notes')
  await page.reload()
  await expect(card).toContainText('Interview')
  await page
    .getByPlaceholder('Search company, role, or location...')
    .fill('Bengaluru')
  await expect(card).toHaveCount(1)
  await page
    .getByLabel('Filter by status', { exact: true })
    .selectOption('Rejected')
  await expect(page.locator('article')).toHaveCount(0)
  await page.getByRole('button', { name: 'Logout' }).click()
  const other = await createAccount(request)
  await login(page, other)
  await expect(page.locator('article')).toHaveCount(0)
  await page.getByRole('button', { name: 'Logout' }).click()
  await login(page, username)
  await expect(card).toHaveCount(1)
  page.once('dialog', (dialog) => dialog.accept())
  await card.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(card).toHaveCount(0)
  await page.reload()
  await expect(card).toHaveCount(0)
})

test('mobile layout at 320, 375, 390, 768 and desktop 1280 pixels', async ({
  page,
  request,
}) => {
  const username = await createAccount(request)
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/#/login')
    await noHorizontalOverflow(page)
  }
  await login(page, username)
  await fillInternship(page, 'A'.repeat(200))
  await page
    .getByRole('button', { name: 'Add Internship', exact: true })
    .click()
  await expect(page.locator('article')).toHaveCount(1)
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await noHorizontalOverflow(page)
    await expect(
      page.getByRole('button', { name: 'Delete', exact: true }),
    ).toBeVisible()
  }
})

test('network and malformed responses are readable, expired sessions require login', async ({
  page,
  request,
}) => {
  const username = await createAccount(request)
  await login(page, username)
  await page.route('**/internships', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'text/html',
      body: 'Unavailable',
    }),
  )
  await fillInternship(page)
  await page
    .getByRole('button', { name: 'Add Internship', exact: true })
    .click()
  await expect(page.locator('.error')).toContainText('503')
  await expect(page.locator('[name="company"]')).toHaveValue('Phase 1 Example')
  await page.unroute('**/internships')
  await page.route('**/internships', (route) => route.abort())
  await page
    .getByRole('button', { name: 'Add Internship', exact: true })
    .click()
  await expect(page.locator('.error')).toContainText('Unable to reach the API')
  await expect(page.locator('[name="company"]')).toHaveValue('Phase 1 Example')
  await page.unroute('**/internships')
  await page.route('**/internships', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"unexpected":true}',
    }),
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
  await expect(page.locator('.error')).toBeVisible()
  await page.unroute('**/internships')
  await page.evaluate(() => localStorage.setItem('token', 'expired-test-token'))
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }),
  ).toBeVisible()
})

test('pending deletion blocks edit/save and logout discards its result', async ({
  page,
  request,
}) => {
  await login(page, await createAccount(request))
  await fillInternship(page)
  await page
    .getByRole('button', { name: 'Add Internship', exact: true })
    .click()
  await expect(page.locator('article')).toHaveCount(1)
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/internships/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      await gate
      await route.continue()
    } else await route.continue()
  })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Edit', exact: true }),
  ).toBeDisabled()
  await expect(
    page
      .getByRole('main')
      .getByRole('button', { name: 'New application', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Logout' }).click()
  release()
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }),
  ).toBeVisible()
  await expect(page.locator('article')).toHaveCount(0)
})
