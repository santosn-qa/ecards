import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_COUNTER_API_URL: 'http://127.0.0.1:4174',
      // Nothing listens on this port: tests mock the AI worker with page.route.
      VITE_AI_API_URL: 'http://127.0.0.1:4175',
      // Cloudflare's documented always-pass Turnstile test site key. Tests also
      // replace the Turnstile script, so no request reaches Cloudflare.
      VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
