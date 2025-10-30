import { test, expect } from '@playwright/test';

test.describe('Build configuration generation', () => {
  test('can view generated configs', async ({ page }) => {
    const projectFromEnv = process.env.E2E_PROJECT_ID;
    if (!projectFromEnv) {
      test.skip(true, 'E2E_PROJECT_ID not set');
      return;
    }

    const hasCreds = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
    test.skip(!hasCreds, 'E2E_EMAIL/E2E_PASSWORD not set');

    await page.goto(`/project/${projectFromEnv}/configs`);
    await expect(page).toHaveURL(new RegExp(`/project/${projectFromEnv}/configs`));
    await expect(page.locator('text=Generated Configs').first()).toBeVisible();
  });
});
