import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
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
        'src/lib/jwt.ts':                    { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/lib/formatters.ts':             { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/lib/validations/schemas.ts':    { statements: 90, branches: 90, functions: 90, lines: 90 },
        // State store — slightly lower because hydrate() has OS-dependent branches
        'src/store/authStore.ts':            { statements: 70, branches: 60, functions: 80, lines: 70 },
        // Permissions hook — queries disabled paths + all hasPermission branches
        'src/features/profile/hooks/use-my-permissions.ts': { statements: 80, branches: 75, functions: 80, lines: 80 },
        // API client — interceptors + silent refresh + retry condition
        'src/lib/api/client.ts':             { statements: 75, branches: 70, functions: 75, lines: 75 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
