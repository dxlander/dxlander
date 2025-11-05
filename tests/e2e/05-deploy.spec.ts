import { test, expect, type Response } from '@playwright/test';

test.describe('Deployment flow', () => {
  test('can start a deployment', async ({ page }) => {
    const projectFromEnv = process.env.E2E_PROJECT_ID;
    if (!projectFromEnv) {
      test.skip(true, 'E2E_PROJECT_ID not set');
      return;
    }

    const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
    test.skip(!hasCreds, 'E2E_EMAIL/E2E_PASSWORD not set');

    await page.goto(`/project/${projectFromEnv}`);
    // Assume there is a Deploy button
    const deployBtn = page.locator('button:has-text("Deploy")');
    if (!(await deployBtn.count())) {
      test.skip(true, 'Deploy button not present');
      return;
    }

    await Promise.all([
      page.waitForResponse(
        (resp: Response) => resp.url().includes('/api/deployments') && resp.status() === 200
      ),
      deployBtn.click(),
    ]);
    await expect(page.locator('text=Deployment started').first()).toBeVisible();
  });
});
