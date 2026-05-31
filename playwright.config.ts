import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Prevent accidental `.only` from blocking the CI suite
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['html', { open: 'on-failure', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    // Capture a trace on the first retry so failures are diagnosable
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Start the Vite dev server without MSW — Playwright intercepts API calls directly
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Always spawn a fresh server so webServer.env (incl. VITE_E2E) is always
    // injected — reusing a stale local server would leave the overlay active.
    reuseExistingServer: false,
    env: {
      VITE_USE_MOCKS: 'false',
      // Ensures API calls use a same-origin path so page.route('/api/v1/**')
      // intercepts them.  Without this Vite falls back to http://localhost:8000
      // and the route patterns never match in CI (no backend running).
      VITE_API_URL: '/api/v1',
      // Disable TanStack Router DevTools in e2e so the overlay doesn't
      // interfere with pointer events during tests.
      VITE_E2E: 'true',
    },
    timeout: 60_000,
  },
});
