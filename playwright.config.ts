import { defineConfig } from '@playwright/test'

// E2E runs drive the dev playground (`vite.playground.config.ts`) in Chromium; all external
// network is stubbed by `e2e/support/playground.ts`.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'playground', testDir: 'e2e/playground', use: { baseURL: 'http://localhost:5179' } },
    { name: 'consumer', testDir: 'e2e/consumer' },
  ],
  webServer: {
    command: 'pnpm exec vite --config vite.playground.config.ts --port 5179 --strictPort',
    url: 'http://localhost:5179',
    reuseExistingServer: false,
    env: { BROWSER: 'none' },
  },
})
