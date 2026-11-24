import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const ui = 'http://127.0.0.1:54750';
const auth = 'http://127.0.0.1:54751';
const api = 'http://127.0.0.1:54752';

export default defineConfig(base, {
  testDir: 'tests/online-browser',
  use: { ...base.use, baseURL: ui },
  webServer: [
    { command: 'node --import tsx tests/online-browser/testBackend.ts', url: `${api}/health`, timeout: 30_000 },
    {
      command: 'npx vite build --outDir dist-online-test && npx vite preview --outDir dist-online-test --host 127.0.0.1 --port 54750 --strictPort',
      url: ui, timeout: 60_000,
      env: {
        VITE_SUPABASE_URL: auth, VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        VITE_ONLINE_API_URL: api, VITE_ONLINE_WS_URL: 'ws://127.0.0.1:54752',
      },
    },
  ],
});
