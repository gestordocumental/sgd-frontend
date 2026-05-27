import { test, expect } from '@playwright/test';
import { API } from '../helpers/auth';

const VALID_TOKEN = 'valid-invitation-token-abc';

// Helper — fill every field in the complete-registration form
async function fillRegistrationForm(
  page: ReturnType<(typeof test)['info']> extends never
    ? never
    : Parameters<Parameters<typeof test>[1]>[0]['page'],
) {
  // Press Tab after each fill to trigger blur → react-hook-form (mode: 'onTouched')
  // only sets isValid:true once touched fields pass validation.
  await page.getByLabel('First name').fill('Juan');
  await page.keyboard.press('Tab');
  await page.getByLabel('Last name').fill('García');
  await page.keyboard.press('Tab');
  await page.getByLabel('ID number').fill('1234567890');
  await page.keyboard.press('Tab');
  // "Password" appears twice (password + confirm); use nth to distinguish
  await page.getByRole('textbox', { name: 'Password' }).nth(0).fill('SecurePass123!');
  await page.keyboard.press('Tab');
  await page.getByLabel('Confirm password').fill('SecurePass123!');
  await page.keyboard.press('Tab');
}

test.describe('User invitation — complete registration', () => {
  // ── Page structure ──────────────────────────────────────────────────────────

  test('shows registration form when a token is present in the URL', async ({ page }) => {
    await page.goto(`/complete-registration?token=${VALID_TOKEN}`);

    await expect(page.getByText('Complete your registration')).toBeVisible();
    await expect(page.getByLabel('First name')).toBeVisible();
    await expect(page.getByLabel('Last name')).toBeVisible();
    await expect(page.getByLabel('ID number')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' }).nth(0)).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete registration' })).toBeVisible();
  });

  test('shows "Invalid link" when no token is provided', async ({ page }) => {
    await page.goto('/complete-registration');

    await expect(page.getByText('Invalid link')).toBeVisible();
    // Provides a path back to the login page
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
    // The form should NOT be rendered
    await expect(page.getByLabel('First name')).not.toBeVisible();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  test('successful submission shows the success screen', async ({ page }) => {
    await page.route(`${API}/users/complete-registration`, (route) =>
      route.fulfill({ status: 201 }),
    );

    await page.goto(`/complete-registration?token=${VALID_TOKEN}`);
    await fillRegistrationForm(page);
    await page.getByRole('button', { name: 'Complete registration' }).click();

    await expect(page.getByText('Registration complete!')).toBeVisible({ timeout: 5_000 });
    // Success state: sign-in button becomes the primary CTA
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
    // Form should no longer be visible
    await expect(page.getByLabel('First name')).not.toBeVisible();
  });

  // ── Sad paths ───────────────────────────────────────────────────────────────

  test('expired / already-used token shows a server-side error', async ({ page }) => {
    await page.route(`${API}/users/complete-registration`, (route) =>
      route.fulfill({
        status: 400,
        json: { message: 'The invitation link has expired or has already been used.' },
      }),
    );

    await page.goto(`/complete-registration?token=expired-token`);
    await fillRegistrationForm(page);
    await page.getByRole('button', { name: 'Complete registration' }).click();

    await expect(page.getByText(/expired or has already been used/i)).toBeVisible({
      timeout: 5_000,
    });
    // Must stay on the same page — not navigate away
    await expect(page).toHaveURL(/\/complete-registration/);
  });

  test('submit button is disabled when required fields are empty', async ({ page }) => {
    await page.goto(`/complete-registration?token=${VALID_TOKEN}`);
    await expect(page.getByRole('button', { name: 'Complete registration' })).toBeDisabled();
  });
});
