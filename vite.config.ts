import { defineConfig } from 'vitest/config';

// Vite configuration (also used by Vitest).
// - AudioWorklet modules are imported with `?worker&url` and bundled as ES modules.
// - No backend: `npm run build` produces a fully static site in dist/.
export default defineConfig({
  base: './',
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
