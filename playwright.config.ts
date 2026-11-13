import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the Vite dev server in the system-installed Microsoft Edge
 * (channel "msedge"), so no browser download is needed. A separate port keeps them apart from a
 * dev server you may already be running on 5173.
 */
const PORT = 5180;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'msedge',
    viewport: { width: 1400, height: 860 },
    acceptDownloads: true,
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
    trace: 'retain-on-failure',
  },
  webServer: {
    // E2E_BUILD=1 tests the production bundle (vite build + preview) instead of the dev server
    command: process.env.E2E_BUILD ? `npx vite build && npx vite preview --port ${PORT} --strictPort` : `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
