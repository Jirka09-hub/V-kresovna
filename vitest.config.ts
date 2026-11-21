import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'apps/web/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', 'apps/web/e2e/**', '**/.next/**'],
    environment: 'node',
  },
})
