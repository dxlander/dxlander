import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const storageDir = path.resolve(process.cwd(), 'tests', 'e2e', '.auth');
const storagePath = path.join(storageDir, 'storageState.json');

const DEFAULT_BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

type EnsureAuthOptions = {
  force?: boolean;
};

export async function ensureAuth(page: Page, options: EnsureAuthOptions = {}) {
  const { force = false } = options;

  if (force) {
    fs.rmSync(storagePath, { force: true });
  }

  // If a saved storage state exists, reuse it.
  if (!force && fs.existsSync(storagePath)) {
    return;
  }

  const E2E_EMAIL = process.env.E2E_EMAIL;
  const E2E_PASSWORD = process.env.E2E_PASSWORD;
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    // Nothing to do — tests should skip or rely on unauthenticated flows
    return;
  }

  // perform login flow
  const loginUrl = new URL('/login', DEFAULT_BASE_URL).toString();
  await page.goto(loginUrl);
  // adapt selectors as needed for your app
  await page.fill('input[name="email"]', E2E_EMAIL);
  await page.fill('input[name="password"]', E2E_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ url: '**/dashboard' }),
    page.click('button:has-text("Sign in")'),
  ]);

  // save storage state for subsequent tests
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
  await page.context().storageState({ path: storagePath });
}

export function storageStatePath() {
  return storagePath;
}
