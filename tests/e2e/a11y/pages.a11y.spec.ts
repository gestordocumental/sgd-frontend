import { test } from '@playwright/test';
import { mockApiFallback } from '../helpers/auth';
import { checkPageA11y } from '../helpers/a11y';

test.describe('A11y — login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await mockApiFallback(page);
  });

  test('login page has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('form').first().waitFor();
    await checkPageA11y(page);
  });
});
