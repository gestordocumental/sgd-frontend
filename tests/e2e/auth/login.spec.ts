import { test, expect } from '@playwright/test';
import { superAdminJwt, companyUserJwt, globalUserJwt } from '../helpers/jwt';
import { API, mockApiFallback } from '../helpers/auth';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    // Start each test with a clean slate — no stale session
    await page.addInitScript(() => localStorage.clear());
    // Silence unmatched API calls that the dashboard makes after login
    await mockApiFallback(page);
  });

  // ── Happy paths ─────────────────────────────────────────────────────────────

  test('super-admin login redirects to /dashboard/admin', async ({ page }) => {
    await page.route(`${API}/auth/login`, (route) =>
      route.fulfill({ json: { accessToken: superAdminJwt(), refreshToken: 'rt', user: null } }),
    );
    await page.route(`${API}/auth/me/companies`, (route) => route.fulfill({ json: [] }));

    await page.goto('/login');
    await page.getByLabel('Email').fill('superadmin@sgd.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard\/admin/, { timeout: 8_000 });
  });

  test('company-user login resolves company context and redirects to /dashboard', async ({
    page,
  }) => {
    await page.route(`${API}/auth/login`, (route) =>
      route.fulfill({ json: { accessToken: globalUserJwt(), refreshToken: 'rt', user: null } }),
    );
    await page.route(`${API}/auth/me/companies`, (route) => route.fulfill({ json: ['org-001'] }));
    await page.route(`${API}/auth/switch-company`, (route) =>
      route.fulfill({ json: { accessToken: companyUserJwt(), refreshToken: 'rt-company' } }),
    );

    await page.goto('/login');
    await page.getByLabel('Email').fill('manager@company.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 8_000 });
  });

  // ── Sad paths ───────────────────────────────────────────────────────────────

  test('invalid credentials shows an error message and stays on /login', async ({ page }) => {
    await page.route(`${API}/auth/login`, (route) =>
      route.fulfill({
        status: 401,
        json: { message: 'Invalid credentials. Please check your email and password.' },
      }),
    );

    await page.goto('/login');
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpass');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/Invalid credentials/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('submit button is disabled while the form is empty', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  // ── Page structure ──────────────────────────────────────────────────────────

  test('renders email, password fields and Sign in button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Welcome to SGD')).toBeVisible();
  });

  test('authenticated user is redirected away from /login to /dashboard', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'sgd-auth',
        JSON.stringify({
          user: { id: 'usr-1', email: 'u@t.com', name: 'U', role: 'ADMIN', companyId: 'org-1' },
          isAuthenticated: true,
          isSuperAdmin: false,
          hasSuperAdminContext: false,
        }),
      );
    });

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5_000 });
  });
});
