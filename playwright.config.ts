import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * Two projects:
 *  - prod: the real build in dist/ (real data artifacts)
 *  - demo: the DATA_MODE=demo build in dist-demo/ (fixtures, DEMO banner)
 * Build both first: `npm run build && npm run build:demo`.
 * Uses the pre-staged Chromium when present (remote env) instead of downloading.
 */
const stagedChromium = '/opt/pw-browsers/chromium';
const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const launchOptions = existsSync(stagedChromium)
  ? { executablePath: stagedChromium }
  : existsSync(windowsChrome)
    ? { executablePath: windowsChrome }
    : {};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 40_000,
  retries: 0,
  workers: 4,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    launchOptions,
    baseURL: 'http://127.0.0.1:4331',
  },
  projects: [
    { name: 'prod', testIgnore: /demo\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:4331' } },
    { name: 'demo', testMatch: /demo\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:4332' } },
  ],
  webServer: [
    {
      command: 'node scripts/serve-dir.mjs dist/client 4331',
      url: 'http://127.0.0.1:4331/',
      reuseExistingServer: true,
      timeout: 20_000,
    },
    {
      command: 'node scripts/serve-dir.mjs dist-demo 4332',
      url: 'http://127.0.0.1:4332/',
      reuseExistingServer: true,
      timeout: 20_000,
    },
  ],
});
