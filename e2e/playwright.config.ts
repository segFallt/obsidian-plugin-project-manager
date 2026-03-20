import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  workers: 1, // One Obsidian instance at a time
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  outputDir: './test-results',
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['list'],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
