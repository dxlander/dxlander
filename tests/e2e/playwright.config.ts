import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { storageStatePath } from './helpers';

const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const resolvedStorageState = hasCreds ? storageStatePath() : undefined;
const resolvedTestDir = path.resolve(process.cwd(), 'tests/e2e');

export default defineConfig({
  testDir: resolvedTestDir,
  globalSetup: hasCreds ? path.resolve(process.cwd(), 'tests/e2e/global-setup.ts') : undefined,
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    storageState: resolvedStorageState,
    trace: 'on-first-retry',
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
