import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const api = 'http://127.0.0.1:8001'
const password = 'isolated-phase2-browser-password'
const now = new Date()
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const priorMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`
const records = [
  ['Alpha', 'Applied', `${month}-01`, 'Developer', 'Remote'],
  ['Beta', 'Interview', `${priorMonth}-01`, 'Designer', 'Delhi'],
  ['Gamma', 'Offer', `${month}-02`, 'Engineer', 'Bengaluru'],
  ['Delta', 'Selected', `${month}-03`, 'Engineer', 'Remote'],
  [
    'Epsilon',
    'Rejected',
    `${now.getFullYear() - 2}-01-01`,
    'Analyst',
    'Mumbai',
  ],
]
async function account(request, data = records) {
  const username = `phase2-${Date.now()}-${Math.random().toString(36).slice(2)}`
  expect(
    (
      await request.post(`${api}/signup`, { data: { username, password } })
    ).status(),
  ).toBe(200)
  const auth = await request.post(`${api}/login`, {
    data: { username, password },
  })
  expect(auth.status()).toBe(200)
  const { access_token } = await auth.json()
  for (const [company, status, application_date, role, location] of data) {
    expect(
      (
        await request.post(`${api}/internships`, {
          headers: { Authorization: `Bearer ${access_token}` },
          data: {
            company,
            status,
            application_date,
            role,
            location,
            notes: 'A useful application note',
            job_url: 'https://example.com/application',
          },
        })
      ).status(),
    ).toBe(200)
  }
  return username
}
async function login(page, username) {
  await page.goto('/#/login')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByTestId('metric-total')).toBeVisible()
}
async function assertNoOverflow(page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
}
const rows = (page) => page.getByTestId('application-row')

test('accurate user-only analytics, chart ranges, status navigation and account switching', async ({
  page,
  request,
}) => {
  await login(page, await account(request))
  await expect(page.getByTestId('metric-total')).toHaveText('5')
  await expect(page.getByTestId('metric-interviews')).toHaveText('1')
  await expect(page.getByTestId('metric-offers')).toHaveText('1')
  await expect(page.getByTestId('metric-selection-rate')).toHaveText('20.0%')
  await expect(page.locator('.trend-summary > strong')).toHaveText('4')
  await page.getByLabel('Trend date range').selectOption('all')
  await expect(page.locator('.trend-summary > strong')).toHaveText('5')
  await page.getByText('View trend data', { exact: true }).click()
  await expect(page.locator('.chart-data tbody tr').first()).toBeVisible()
  await page
    .getByRole('button', { name: 'Filter status: Offer (1)', exact: true })
    .click()
  await expect(page.getByLabel('Filter by status')).toHaveValue('Offer')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page)).toContainText('Gamma')
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page.getByTestId('metric-total')).toHaveText('5')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await login(
    page,
    await account(request, [
      ['Other account only', 'Applied', `${month}-01`, 'Intern', 'Remote'],
    ]),
  )
  await expect(page.getByTestId('metric-total')).toHaveText('1')
  await expect(page.getByTestId('metric-offers')).toHaveText('0')
  await expect(page.getByTestId('metric-selection-rate')).toHaveText('0.0%')
  await expect(page.getByText('Gamma', { exact: true })).toHaveCount(0)
})

test('search, combined status, stable sorting, reset and both application views', async ({
  page,
  request,
}) => {
  await login(page, await account(request))
  await expect(rows(page).first()).toContainText('Delta')
  await page.getByLabel('Sort applications').selectOption('oldest')
  await expect(rows(page).first()).toContainText('Epsilon')
  await page.getByLabel('Sort applications').selectOption('company')
  await expect(rows(page).first()).toContainText('Alpha')
  await page
    .getByPlaceholder('Search company, role, or location...')
    .fill('  ENGINEER  ')
  await expect(rows(page)).toHaveCount(2)
  await page.getByLabel('Filter by status').selectOption('Offer')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page)).toContainText('Gamma')
  await expect(page.getByTestId('metric-total')).toHaveText('5')
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click()
  await expect(rows(page)).toHaveCount(5)
  await expect(page.getByLabel('Sort applications')).toHaveValue('newest')
  await page
    .getByPlaceholder('Search company, role, or location...')
    .fill('no matching company')
  await expect(
    page.getByRole('heading', { name: 'No matching applications' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Reset filters', exact: true })
    .last()
    .click()
  await page.getByRole('button', { name: 'Card view' }).click()
  await expect(page.locator('article')).toHaveCount(5)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Card view' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Table view' }).click()
  await rows(page).first().getByText('View details', { exact: true }).click()
  await expect(
    rows(page).first().getByText('A useful application note'),
  ).toBeVisible()
  await expect(
    rows(page).first().getByRole('link', { name: 'View application' }),
  ).toHaveAttribute('rel', 'noopener noreferrer')
})

test('theme persistence, keyboard sidebar navigation, mobile drawer and form focus', async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'light')
  })
  await login(page, await account(request))
  await page
    .getByRole('button', { name: 'Collapse sidebar', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Expand sidebar' }),
  ).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.getByRole('button', { name: 'Applications', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Applications', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await page
    .getByRole('button', { name: 'Switch to dark mode', exact: true })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await assertNoOverflow(page)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Workspace navigation' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Applications', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Workspace navigation' }),
  ).toHaveCount(0)
  // Navigation focuses the destination content; Escape-only dismissal returns to the trigger.
  await expect(page.getByRole('main')).toBeFocused()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused()
  await page
    .getByRole('main')
    .getByRole('button', { name: 'New application', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Add Internship', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByPlaceholder('Company *', { exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page
      .getByRole('main')
      .getByRole('button', { name: 'New application', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page
    .getByRole('dialog', { name: 'Workspace navigation' })
    .getByRole('button', { name: 'New application', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Workspace navigation' }),
  ).toHaveCount(0)
  await expect(
    page.getByPlaceholder('Company *', { exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  // The sidebar launcher is now hidden; return to its visible menu trigger.
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused()
})

test('loading skeleton and failed-list recovery never display fabricated analytics', async ({
  page,
  request,
}) => {
  const username = await account(request)
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/internships', async (route) => {
    await gate
    await route.continue()
  })
  await page.goto('/#/login')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(
    page.getByRole('status', { name: 'Loading internships...' }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('main')
      .getByRole('button', { name: 'New application', exact: true }),
  ).toBeDisabled()
  await expect(page.getByTestId('metric-total')).toHaveCount(0)
  release()
  await expect(page.getByTestId('metric-total')).toHaveText('5')
  await page.unroute('**/internships')
  await page.route('**/internships', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"detail":"Temporarily unavailable"}',
    }),
  )
  await page.reload()
  await expect(page.getByTestId('metric-total')).toHaveText('—')
  await expect(page.getByRole('alert')).toContainText('Temporarily unavailable')
  await expect(page.getByLabel('Trend date range')).toHaveCount(0)
  await page.unroute('**/internships')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByTestId('metric-total')).toHaveText('5')
})

test('pagination, delete-last-page recovery and immediate analytics updates', async ({
  page,
  request,
}) => {
  const data = Array.from({ length: 9 }, (_, index) => [
    `Company ${index}`,
    'Applied',
    `${month}-01`,
    'Intern',
    'Remote',
  ])
  await login(page, await account(request, data))
  await expect(rows(page)).toHaveCount(8)
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(rows(page)).toHaveCount(1)
  page.once('dialog', (dialog) => dialog.accept())
  await rows(page)
    .first()
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect(rows(page)).toHaveCount(8)
  await expect(page.getByTestId('metric-total')).toHaveText('8')
  await expect(
    page.getByRole('button', { name: 'Previous page' }),
  ).toBeDisabled()
  await page
    .getByRole('main')
    .getByRole('button', { name: 'New application', exact: true })
    .click()
  await page.getByPlaceholder('Company *', { exact: true }).fill('New offer')
  await page.getByPlaceholder('Role *', { exact: true }).fill('Intern')
  await page.locator('[name="application_date"]').fill(`${month}-01`)
  await page.locator('[name="status"]').selectOption('Offer')
  await page
    .getByRole('button', { name: 'Add Internship', exact: true })
    .click()
  await expect(page.getByTestId('metric-total')).toHaveText('9')
  await expect(page.getByTestId('metric-offers')).toHaveText('1')
  await expect(page.locator('.toast')).toContainText(
    'Internship added successfully!',
  )
  await page.reload()
  await expect(page.getByTestId('metric-offers')).toHaveText('1')
})

test('WCAG accessibility checks and portfolio preview in both themes', async ({
  page,
  request,
}) => {
  await page.goto('/#/login')
  for (const theme of ['light', 'dark']) {
    const current = await page.locator('html').getAttribute('data-theme')
    if (current !== theme)
      await page
        .getByRole('button', { name: `Switch to ${theme} mode` })
        .click()
    const auth = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      auth.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          detail: node.failureSummary,
        })),
      })),
    ).toEqual([])
  }
  await login(page, await account(request))
  await expect(page.locator('.recharts-surface').first()).toBeVisible()
  const notification = page.getByRole('button', {
    name: 'Dismiss notification',
  })
  if (await notification.isVisible()) await notification.click()
  for (const theme of ['light', 'dark']) {
    const current = await page.locator('html').getAttribute('data-theme')
    if (current !== theme)
      await page
        .getByRole('button', { name: `Switch to ${theme} mode` })
        .click()
    await page.screenshot({
      path: `/tmp/internship-phase2-${theme}.png`,
      fullPage: true,
    })
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          detail: node.failureSummary,
        })),
      })),
    ).toEqual([])
    await page.screenshot({
      path: `/tmp/internship-phase2-${theme}.png`,
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(
    mobile.violations.map((item) => ({
      id: item.id,
      nodes: item.nodes.map((node) => ({
        target: node.target,
        detail: node.failureSummary,
      })),
    })),
  ).toEqual([])
  await page.screenshot({
    path: '/tmp/internship-phase2-mobile.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.screenshot({
    path: '/tmp/internship-workspace-tablet.png',
    fullPage: true,
  })
})

test('a failed chart module leaves application management available', async ({
  page,
  request,
}) => {
  await page.route('**/src/components/AnalyticsCharts.jsx*', (route) =>
    route.abort(),
  )
  await login(page, await account(request))
  await expect(
    page.getByRole('heading', { name: 'Analytics couldn’t load' }),
  ).toBeVisible()
  await expect(rows(page)).toHaveCount(5)
  await page.getByRole('button', { name: 'Go to applications' }).click()
  await rows(page)
    .first()
    .getByRole('button', { name: 'Edit', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Edit Internship', exact: true }),
  ).toBeVisible()
  await page
    .getByPlaceholder('Role *', { exact: true })
    .fill('Updated despite chart outage')
  await page
    .getByRole('button', { name: 'Update Internship', exact: true })
    .click()
  await expect(rows(page).first()).toContainText('Updated despite chart outage')
})
