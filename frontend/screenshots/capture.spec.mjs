import { test, expect } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const api = 'http://127.0.0.1:8001'
const output = new URL('../../docs/screenshots/', import.meta.url)
const dataset = JSON.parse(await readFile(new URL('dataset.json', output), 'utf8'))

test('capture seven real views using one isolated synthetic dataset', async ({ page, request, baseURL }) => {
  test.setTimeout(60000)
  expect(new URL(baseURL).hostname).toBe('127.0.0.1')
  await mkdir(output, { recursive: true })
  const external = []
  await page.route('**/*', (route) => {
    const origin = new URL(route.request().url()).origin
    if (origin === baseURL || origin === api) return route.continue()
    external.push(origin)
    return route.abort()
  })
  await page.clock.setFixedTime(new Date(dataset.display_date))
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  const capture = async (name, target = page) => {
    await page.evaluate(() => document.fonts.ready)
    await target.screenshot({
      path: fileURLToPath(new URL(`${name}.jpg`, output)),
      type: 'jpeg', quality: 90, animations: 'disabled',
    })
  }
  await page.goto('/')
  await expect(page.getByText('ILLUSTRATIVE PREVIEW', { exact: true })).toBeVisible()
  await capture('landing')
  await page.goto('/#/login')
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await capture('login')

  // No account/password/token is reused or persisted outside this test run.
  const password = randomBytes(32).toString('hex')
  const signup = await request.post(`${api}/signup`, { data: { username: dataset.username, password } })
  expect(signup.status()).toBe(200)
  const login = await request.post(`${api}/login`, { data: { username: dataset.username, password } })
  expect(login.status()).toBe(200)
  const { access_token } = await login.json()
  for (const application of dataset.applications) {
    const response = await request.post(`${api}/internships`, {
      headers: { Authorization: `Bearer ${access_token}` }, data: application,
    })
    expect(response.status()).toBe(200)
  }
  await page.getByLabel('Username', { exact: true }).fill(dataset.username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByTestId('metric-total')).toHaveText('12')
  await expect(page.getByTestId('metric-interviews')).toHaveText('3')
  await expect(page.getByTestId('metric-offers')).toHaveText('1')
  await expect(page.locator('.trend-summary > strong')).toHaveText('12')
  await expect(page.locator('.recharts-surface').first()).toBeVisible()
  const notification = page.getByRole('button', { name: 'Dismiss notification' })
  if (await notification.isVisible()) await notification.click()
  await capture('dashboard')
  await capture('analytics', page.locator('.charts-grid').first())
  await page.getByRole('button', { name: 'Applications', exact: true }).click()
  await expect(page.getByTestId('application-row')).toHaveCount(8)
  await capture('applications')
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await capture('dark-mode')
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click()
  await page.getByRole('button', { name: 'Applications', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.application-card').first()).toBeVisible()
  await capture('mobile')
  expect(external).toEqual([])
})
