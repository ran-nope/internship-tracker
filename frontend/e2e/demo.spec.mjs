import {test, expect} from '@playwright/test'

test('synthetic demo needs no API and paginates fictional records', async ({page}) => {
  await page.route('http://127.0.0.1:8001/**', route => route.abort())
  await page.goto('/')
  await page.getByRole('button', {name: 'Explore synthetic demo'}).click()
  await expect(page.getByText(/Synthetic demo — fictional data/)).toBeVisible()
  await page.goto('/#/applications')
  await expect(page.getByText('Page 1 of 3')).toBeVisible()
  await page.getByRole('button', {name: 'Next page', exact:true}).click()
  await expect(page.getByText('Page 2 of 3')).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Synthetic demo — fictional data/)).toBeVisible()
})
