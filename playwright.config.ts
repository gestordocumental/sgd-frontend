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
    // Reuse an already-running dev server locally; always spawn a fresh one in CI
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_USE_MOCKS: 'false',
    },
    timeout: 60_000,
  },
});
