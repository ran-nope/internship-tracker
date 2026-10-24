import config from './playwright.config.mjs'

// Separate capture suite: always creates its own disposable API/database.
export default {
  ...config,
  testDir: './screenshots',
  testMatch: 'capture.spec.mjs',
  use: {
    ...config.use,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'en-GB',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  },
}
