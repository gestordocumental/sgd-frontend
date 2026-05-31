import { test, expect } from '@playwright/test';

// Build a fake JWT that the frontend can decode (signature is not verified client-side).
function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.fakesig`;
}

const EXP = Math.floor(Date.now() / 1000) + 3600;

// Token whose decoded payload has no isSuperAdmin → treated as regular user
const USER_TOKEN = makeJwt({ sub: 'usr-001', email: 'user@test.com', iat: 0, exp: EXP });

// Token whose decoded payload has isSuperAdmin: true → super admin flow
const SA_TOKEN = makeJwt({
  sub: 'sa-001',
  email: 'sa@test.com',
  isSuperAdmin: true,
  iat: 0,
  exp: EXP,
});

// Company-scoped token returned after switch-company
const COMPANY_TOKEN = makeJwt({
  sub: 'usr-001',
  email: 'user@test.com',
  companyId: 'org-001',
  iat: 0,
  exp: EXP,
});

// ── Guards ─────────────────────────────────────────────────────────────────────

test('unauthenticated user accessing /dashboard is redirected to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
});

// ── Login page ─────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the form with expected fields and button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome to SGD' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('sign in button is disabled until the form is valid', async ({ page }) => {
    // Fresh page — both fields empty → form is invalid
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  test('shows an inline error for an invalid email format', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Email').blur();
    await expect(page.locator('[aria-invalid="true"]')).toBeVisible();
  });

  test('shows the server error message on invalid credentials (401)', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      }),
    );

    await page.getByLabel('Email').fill('wrong@test.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('WrongPass1!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('shows fallback error when the server returns a 500', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );

    await page.getByLabel('Email').fill('user@test.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('SomePass1!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // axiosRetry will retry 500s, so wait with a longer timeout
    await expect(page.locator('[role="alert"], .text-destructive')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL('/login');
  });

  test('successful login as a regular user navigates to /dashboard', async ({ page }) => {
    // Register the catch-all first so specific routes below take precedence (Playwright is LIFO)
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: USER_TOKEN }),
      }),
    );
    await page.route('**/api/v1/auth/me/companies', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['org-001']),
      }),
    );
    await page.route('**/api/v1/auth/switch-company', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: COMPANY_TOKEN }),
      }),
    );

    await page.getByLabel('Email').fill('user@test.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('ValidPass1!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('successful login as super admin navigates to /dashboard/admin', async ({ page }) => {
    // Register the catch-all first so the specific login route below takes precedence (Playwright is LIFO)
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: SA_TOKEN }),
      }),
    );

    await page.getByLabel('Email').fill('sa@test.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('AdminPass1!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard\/admin/);
  });

  test('forgot password link navigates to /forgot-password', async ({ page }) => {
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('already authenticated users are redirected away from /login', async ({ page }) => {
    // The authStore reads { user, isAuthenticated, isSuperAdmin, hasSuperAdminContext }
    // from localStorage key 'sgd-auth' on init. Setting it before navigation
    // makes the store consider the session active, triggering the /login beforeLoad redirect.
    await page.addInitScript(() => {
      localStorage.setItem(
        'sgd-auth',
        JSON.stringify({
          user: { id: 'usr-001', email: 'user@test.com', name: 'User', role: 'user' },
          isAuthenticated: true,
          isSuperAdmin: false,
          hasSuperAdminContext: false,
        }),
      );
    });

    // Allow any subsequent dashboard API calls to succeed silently
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
