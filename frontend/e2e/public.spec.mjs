import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
const api = 'http://127.0.0.1:8001'
const password = 'isolated-public-navigation-password'
async function account(request) {
  const username = `public-${Date.now()}-${Math.random().toString(36).slice(2)}`
  expect(
    (
      await request.post(`${api}/signup`, { data: { username, password } })
    ).status(),
  ).toBe(200)
  return username
}
async function enter(page, username) {
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
}
async function noOverflow(page) {
  const data = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(data.scroll, JSON.stringify(data)).toBeLessThanOrEqual(data.width)
}

test('public landing is separate, illustrative, fast, and connected to authentication history', async ({
  page,
}) => {
  const privateCalls = []
  const chartDownloads = []
  page.on('request', (request) => {
    if (request.url().startsWith(`${api}/`)) privateCalls.push(request.method())
    if (request.url().includes('AnalyticsCharts'))
      chartDownloads.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ambition,well organized.',
  )
  await expect(
    page.getByText('ILLUSTRATIVE PREVIEW', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Sample data. Your own workspace starts with your applications.',
    ),
  ).toBeVisible()
  await page.getByRole('link', { name: 'The workspace', exact: true }).click()
  await expect(page).toHaveURL(/section=workspace/)
  const sectionHistory = await page.evaluate(() => history.length)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole('link', { name: 'The workspace', exact: true }).click()
  await expect(page.locator('#workspace')).toBeFocused()
  expect(await page.evaluate(() => history.length)).toBe(sectionHistory)
  await page.getByRole('link', { name: 'Log in', exact: true }).first().click()
  await expect(page).toHaveURL(/#\/login/)
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
  await page.goBack()
  await expect(
    page.getByText('ILLUSTRATIVE PREVIEW', { exact: true }),
  ).toBeVisible()
  await page.goForward()
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Back to home', exact: true }).click()
  const homeHistory = await page.evaluate(() => history.length)
  await page
    .getByRole('link', { name: 'Internship Tracker home', exact: true })
    .last()
    .click()
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  expect(await page.evaluate(() => history.length)).toBe(homeHistory)
  await page
    .getByRole('link', { name: 'Create your workspace', exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/#\/signup/)
  await expect(
    page.getByRole('button', { name: 'Sign Up', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Make it your own.', exact: true }),
  ).toBeVisible()
  expect(privateCalls).toEqual([])
  expect(chartDownloads).toEqual([])
})

test('protected routes, refresh, back/forward and logout preserve authentication boundaries', async ({
  page,
  request,
}) => {
  const username = await account(request)
  await page.goto('/#/applications')
  await expect(page).toHaveURL(/#\/login\?next=applications$/)
  await enter(page, username)
  await expect(page).toHaveURL(/#\/applications$/)
  await expect(
    page.getByRole('button', { name: 'Applications', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Applications', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page).toHaveURL(/#\/overview$/)
  await page.goBack()
  await expect(
    page.getByRole('button', { name: 'Applications', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  await page.goForward()
  await expect(page.getByTestId('metric-total')).toHaveText('0')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }),
  ).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId('metric-total')).toHaveCount(0)
  await page.goto('/#/unknown')
  await expect(
    page.getByRole('heading', { name: 'This page took a different path.' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Back to home' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Ambition,',
  )
})

test('authentication validates clearly, masks passwords by default and rejects external return targets', async ({
  page,
}) => {
  const posts = []
  page.on('request', (request) => {
    if (request.url().startsWith(api) && request.method() === 'POST')
      posts.push(request.url())
  })
  await page.goto('/#/signup?next=https%3A%2F%2Fevil.example')
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click()
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await expect(page.getByLabel('Username', { exact: true })).toBeFocused()
  await expect(
    page.getByText('Please enter your username.', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Username', { exact: true }).fill('test-username')
  await page.getByLabel('Password', { exact: true }).fill('🙂'.repeat(19))
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click()
  await expect(
    page.getByText('This password is too long. Try fewer characters or emoji.'),
  ).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'password',
  )
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'type',
    'text',
  )
  await page.getByRole('button', { name: 'Hide password', exact: true }).click()
  await page
    .getByRole('link', { name: 'Already have an account? Login', exact: true })
    .click()
  await expect(page).toHaveURL(/#\/login\?next=overview$/)
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  expect(posts).toEqual([])
})

test('landing and authentication are responsive and accessible in both themes', async ({
  page,
}) => {
  test.setTimeout(60000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  for (const theme of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page
        .getByRole('button', { name: `Switch to ${theme} mode` })
        .click()
    for (const width of [320, 375, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await noOverflow(page)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
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
      path: `/tmp/internship-public-${theme}.png`,
      fullPage: true,
    })
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
      path: `/tmp/internship-public-mobile-${theme}.png`,
      fullPage: true,
    })
  }
  for (const mode of ['login', 'signup']) {
    await page.goto(`/#/${mode}`)
    await noOverflow(page)
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page
          .getByRole('button', { name: `Switch to ${theme} mode` })
          .click()
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
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({
        path: `/tmp/internship-auth-${mode}-${theme}.png`,
        fullPage: true,
      })
      await page.setViewportSize({ width: 390, height: 844 })
    }
  }
})

test('authenticated public visits never mix illustrative and private application data', async ({
  page,
  request,
}) => {
  const username = await account(request)
  await page.goto('/#/login')
  await enter(page, username)
  await expect(page.getByTestId('metric-total')).toHaveText('0')
  await page
    .getByRole('link', { name: 'Internship Tracker home', exact: true })
    .click()
  await expect(
    page.getByText('ILLUSTRATIVE PREVIEW', { exact: true }),
  ).toBeVisible()
  await expect(page.getByText(username, { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('link', { name: 'Open workspace', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Open workspace', exact: true }).click()
  await expect(page.getByTestId('metric-total')).toHaveText('0')
  await expect(page.getByText('Northstar Studio', { exact: true })).toHaveCount(
    0,
  )
})
