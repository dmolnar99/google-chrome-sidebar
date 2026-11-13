import { defineConfig } from '@playwright/test';

// Drives the built extension (.output/chrome-mv3) in Playwright's Chromium. Run `pnpm test:e2e`,
// which builds first. Test pages come from a local server, so no internet is needed.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  webServer: { command: 'node e2e/server.mjs', port: 4317, reuseExistingServer: true },
});
