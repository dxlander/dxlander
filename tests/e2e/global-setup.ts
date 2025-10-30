import { chromium } from '@playwright/test';
import { ensureAuth } from './helpers';

/**
 * Global setup logs in once and writes the storage state so that
 * subsequent tests can reuse the authenticated session.
 */
export default async function globalSetup() {
  const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
  if (!hasCreds) {
    return;
  }

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    });

    const page = await context.newPage();
    await ensureAuth(page);
    await context.close();
  } finally {
    await browser.close();
  }
}
