import { defineConfig } from 'vitest/config'
import path from 'node:path'

const root = path.resolve(__dirname, '..')

export default defineConfig({
  resolve: {
    alias: {
      '@clutch/shared': path.join(root, 'packages/shared/src'),
      '@clutch/db': path.join(root, 'packages/db/src'),
      '@clutch/domain': path.join(root, 'packages/domain/src'),
      '@clutch/api': path.join(root, 'apps/api/src'),
      '@clutch/worker': path.join(root, 'apps/worker/src'),
    },
  },
  test: {
    include: ['e2e/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    environment: 'node',
    globalSetup: ['./e2e/global-setup.ts'],
    singleThread: true,
    sequence: { concurrent: false },
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
