/**
 * Playwright config — storefront e2e tests.
 * Per `26-themes-storefront.md §11` (testing strategy).
 */

import { defineConfig, devices } from '@playwright/test';

const STOREFRONT_URL = process.env.STOREFRONT_URL ?? 'http://localhost:3030';
const API_URL = process.env.API_URL ?? 'http://localhost:4040';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // Tests share API state (orders, stock) — sequential is safer
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: STOREFRONT_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // CI: spin up storefront automatically. Local: assume dev server already running.
  webServer: process.env.CI
    ? {
        command: 'pnpm dev',
        url: STOREFRONT_URL,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          NEXT_PUBLIC_SHOPIO_API_URL: API_URL,
          SHOPIO_API_URL: API_URL,
        },
      }
    : undefined,
});
