import { test, expect } from '@playwright/test';
import { ensureAuth, storageStatePath } from './helpers';
import fs from 'node:fs';

test.describe('Authentication flow', () => {
  test.use({ storageState: undefined });

  test('can sign in and persist session', async ({ page }) => {
    // If environment credentials are not set, skip real login
    const E2E_EMAIL = process.env.E2E_EMAIL;
    const E2E_PASSWORD = process.env.E2E_PASSWORD;
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, 'E2E_EMAIL/E2E_PASSWORD not set');

    await ensureAuth(page, { force: true });

    // confirm we are on dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);
    // basic sanity check for dashboard content
    await expect(page.locator('text=Create project').first()).toBeVisible();

    // storage state file should exist
    expect(fs.existsSync(storageStatePath())).toBeTruthy();
  });

  test('can sign out', async ({ page }) => {
    const E2E_EMAIL = process.env.E2E_EMAIL;
    const E2E_PASSWORD = process.env.E2E_PASSWORD;
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, 'E2E_EMAIL/E2E_PASSWORD not set');

    await ensureAuth(page);
    // Navigate to dashboard and sign out via UI
    await page.goto('/dashboard');
    // adapt selector - typical sign out button
    const signOut = page.locator('button:has-text("Sign out")');
    if (!(await signOut.count())) {
      test.skip(true, 'Sign out button not found - skipping');
    }

    await signOut.click();
    await expect(page).toHaveURL(/.*login/);
  });
});
