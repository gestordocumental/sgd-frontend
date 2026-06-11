import { defineConfig, devices } from '@playwright/test';
import { createArgosReporterOptions } from '@argos-ci/playwright';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Prevent accidental `.only` from blocking the CI suite
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI=1 (sequential, deterministic). Local=2: parallel enough to be fast,
  // low enough not to exhaust CPU/RAM with 6 full Chromium instances.
  workers: process.env.CI ? 1 : 2,
  reporter: [
    // GitHub Actions annotations — only meaningful inside a workflow run
    ...(process.env.CI ? ([['github']] as const) : []),
    ['html', { open: process.env.CI ? 'never' : 'on-failure', outputFolder: 'playwright-report' }],
    // uploadToArgos gates the network upload; the reporter itself always runs.
    // Auth hierarchy: ARGOS_TOKEN → OIDC (id-token: write) → tokenless.
    [
      '@argos-ci/playwright/reporter',
      createArgosReporterOptions({ uploadToArgos: !!process.env.CI }),
    ],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    // Capture a trace on the first retry so failures are diagnosable
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Pre-build then preview — serves static files with no on-demand compilation,
    // so all workers get sub-second page loads regardless of concurrency.
    // env vars below are embedded at build time by Vite (VITE_* are statically
    // replaced in the bundle) and remain active when preview serves the dist.
    command: 'npm run e2e:build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    env: {
      VITE_USE_MOCKS: 'false',
      // Same-origin API path so page.route('/api/v1/**') intercepts in CI.
      VITE_API_URL: '/api/v1',
      // Disables TanStack Router DevTools overlay during E2E runs.
      VITE_E2E: 'true',
    },
    // Build step (vite build) can take up to 90 s on a cold machine.
    timeout: 120_000,
  },
});
