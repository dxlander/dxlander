import { test, expect } from '@playwright/test';

test.describe('Project import flow', () => {
  test('navigates to import page and shows import options', async ({ page }) => {
    const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
    if (!hasCreds) {
      test.skip(true, 'E2E_EMAIL/E2E_PASSWORD not set');
      return;
    }

    await page.goto('/dashboard/import');
    await expect(page).toHaveURL(/.*dashboard\/import/);
    // basic checks for import UI
    await expect(page.locator('text=Import from GitHub').first()).toBeVisible();
    await expect(page.locator('text=Upload ZIP').first()).toBeVisible();
  });

  test('can import from GitHub when repo env set', async ({ page }) => {
    const repoFromEnv = process.env.E2E_GITHUB_REPO; // e.g. owner/repo
    if (!repoFromEnv) {
      test.skip(true, 'E2E_GITHUB_REPO not set');
      return;
    }

    const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
    if (!hasCreds) {
      test.skip(true, 'E2E_EMAIL/E2E_PASSWORD not set');
      return;
    }

    await page.goto('/dashboard/import');
    await page.fill('input[name=githubRepo]', repoFromEnv);
    await page.click('button:has-text("Import")');
    await page.waitForURL(/.*project\/.*$/);
  });
});
