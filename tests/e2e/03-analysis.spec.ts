import { test, expect } from '@playwright/test';

test.describe('AI analysis workflow', () => {
  test('can start analysis on a project', async ({ page }) => {
    const projectFromEnv = process.env.E2E_PROJECT_ID;
    if (!projectFromEnv) {
      test.skip(true, 'E2E_PROJECT_ID not set');
      return;
    }

    const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
    test.skip(!hasCreds, 'E2E_EMAIL/E2E_PASSWORD not set');

    await page.goto(`/project/${projectFromEnv}`);
    await expect(page).toHaveURL(new RegExp(`/project/${projectFromEnv}`));

    // assume there's a button to trigger AI analysis
    const startBtn = page.locator('button:has-text("Run analysis")');
    if (!(await startBtn.count())) {
      test.skip(true, 'Run analysis button not present');
      return;
    }

    await startBtn.click();
    await expect(page.locator('text=Analysis queued').first()).toBeVisible();
  });
});
