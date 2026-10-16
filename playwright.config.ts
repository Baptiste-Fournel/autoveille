import { defineConfig, devices } from '@playwright/test';
import { READY_LINE } from './tests/e2e/worlds.js';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.ts',
  outputDir: 'test-results',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'npx vite build --logLevel warn && npx tsx tests/e2e/server.ts',
    wait: { stdout: new RegExp(READY_LINE) },
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    timeout: 120_000,
  },
});
