import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const frontendPort = Number(process.env.TEST_FRONTEND_PORT || 5174)
if (!Number.isInteger(frontendPort) || frontendPort < 1024 || frontendPort > 65535)
  throw new Error('TEST_FRONTEND_PORT must be an integer from 1024 to 65535')
const frontendUrl = `http://127.0.0.1:${frontendPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: frontendUrl,
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: `${fileURLToPath(new URL('../venv/bin/python', import.meta.url))} -B ../tests/serve_test_api.py`,
      url: 'http://127.0.0.1:8001/',
      timeout: 60000,
      reuseExistingServer: false,
      env: { TEST_FRONTEND_PORT: String(frontendPort) },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: frontendUrl,
      env: { VITE_API_URL: 'http://127.0.0.1:8001' },
      reuseExistingServer: false,
    },
  ],
})
