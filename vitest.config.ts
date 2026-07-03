import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Only pick up unit tests from src/ — Playwright E2E tests in tests/e2e/ are
    // run separately via `npm run e2e` and must not be processed by Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/main.tsx',
        'src/routeTree.gen.ts',
        'src/routes/**',
        'src/mocks/**',
        '**/*.d.ts',
      ],
      // Per-file thresholds on the layers that already have tests.
      // These numbers grow as new test files are added.
      thresholds: {
        perFile: true,
        // Pure utility/logic files — high bar
        'src/lib/jwt.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/lib/formatters.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/lib/validations/schemas.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
        // State store — slightly lower because hydrate() has OS-dependent branches
        'src/store/authStore.ts': { statements: 70, branches: 60, functions: 80, lines: 70 },
        // Permissions hook — queries disabled paths + all hasPermission branches
        'src/features/profile/hooks/use-my-permissions.ts': {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        // API client — interceptors + silent refresh + retry condition
        'src/lib/api/client.ts': { statements: 75, branches: 70, functions: 75, lines: 75 },
        // Workflows UI — critical rendering, permissions, pagination, row actions
        'src/features/workflows/components/WorkflowsTable.tsx': {
          statements: 60,
          branches: 55,
          functions: 60,
          lines: 60,
        },
        // Business-logic utilities — pure functions, no React deps
        'src/features/audit/components/audit-table.utils.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'src/features/doc-governance/components/dialogs/typology-dialog-shared.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'src/features/workflows/hooks/workflow-schemas.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        // Brute-force throttle — pure functions, no React deps
        'src/lib/login-throttle.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
