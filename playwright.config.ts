import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 15000,
  retries: 0,
  workers: 1,
  projects: [
    {
      name: 'chromium-extension',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
