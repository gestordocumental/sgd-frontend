import type { Page } from '@playwright/test';
import { companyUserJwt, globalUserJwt, superAdminJwt } from './jwt';

/**
 * Base path for all API route patterns.
 *
 * The app uses VITE_API_URL=/api/v1 (same-origin), so browser requests go to
 * http://localhost:5173/api/v1/... through the Vite proxy. Using a relative
 * path here relies on Playwright's baseURL merging (set to http://localhost:5173
 * in playwright.config.ts), which is more reliable than a leading-** glob when
 * matching URLs that contain a scheme (http://).
 */
export const API = '/api/v1';

// ── Persisted session ─────────────────────────────────────────────────────────

/**
 * Inject a company-user session into localStorage before the page loads.
 * This lets tests start on a protected route without going through the login form.
 *
 * The access token is intentionally absent (it lives only in memory in production).
 * The first API call will 401 → the silent-refresh interceptor renews the token
 * via the mocked /auth/refresh + /auth/switch-company routes.
 */
export async function injectCompanySession(page: Page, orgId = 'org-001') {
  await page.addInitScript(
    ({ orgId }) => {
      localStorage.setItem(
        'sgd-auth',
        JSON.stringify({
          user: {
            id: 'usr-001',
            email: 'manager@company.com',
            name: 'Test Manager',
            role: 'ADMIN',
            companyId: orgId,
            companyName: 'Test Company',
          },
          isAuthenticated: true,
          isSuperAdmin: false,
          hasSuperAdminContext: false,
        }),
      );
    },
    { orgId },
  );
}

/** Inject a super-admin session (no companyId) into localStorage. */
export async function injectAdminSession(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'sgd-auth',
      JSON.stringify({
        user: {
          id: 'sa-001',
          email: 'superadmin@sgd.com',
          name: 'Super Admin',
          isSuperAdmin: true,
          companyId: null,
        },
        isAuthenticated: true,
        isSuperAdmin: true,
        hasSuperAdminContext: false,
      }),
    );
  });
}

// ── API mock helpers ──────────────────────────────────────────────────────────

/**
 * Mock the silent-refresh + company-switch flow.
 * Must be called BEFORE page.goto() so the routes are registered in time.
 */
export async function mockAuthRefresh(page: Page, orgId = 'org-001') {
  const companyJwt = companyUserJwt(orgId);
  const globalJwt = globalUserJwt();

  await page.route(`${API}/auth/refresh`, (route) =>
    route.fulfill({ json: { accessToken: globalJwt, refreshToken: 'rt-mock' } }),
  );
  await page.route(`${API}/auth/switch-company`, (route) =>
    route.fulfill({ json: { accessToken: companyJwt, refreshToken: 'rt-company' } }),
  );
  await page.route(`${API}/auth/me/companies`, (route) => route.fulfill({ json: [orgId] }));

  // User profile — queried by useUserProfile on every dashboard mount
  await page.route(`${API}/users/usr-001`, (route) =>
    route.fulfill({
      json: {
        id: 'usr-001',
        email: 'manager@company.com',
        firstName: 'Test',
        lastName: 'Manager',
        isActive: true,
        isSuperAdmin: false,
      },
    }),
  );

  // Company detail — queried by useUserProfile to resolve company name
  await page.route(`${API}/org/${orgId}`, (route) =>
    route.fulfill({ json: { id: orgId, name: 'Test Company', nit: '000000', isActive: true } }),
  );
}

/** Mock token refresh for a super-admin session (no company context needed). */
export async function mockAdminAuthRefresh(page: Page) {
  const adminJwt = superAdminJwt();

  await page.route(`${API}/auth/refresh`, (route) =>
    route.fulfill({ json: { accessToken: adminJwt, refreshToken: 'rt-admin-mock' } }),
  );

  await page.route(`${API}/users/sa-001`, (route) =>
    route.fulfill({
      json: {
        id: 'sa-001',
        email: 'superadmin@sgd.com',
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        isSuperAdmin: true,
        avatarUrl: null,
      },
    }),
  );
}

/**
 * Catch-all fallback: any unmatched GET returns a safe empty paginated response
 * so that unmocked dashboard queries don't break navigation.
 * Unmocked mutating requests (POST/PATCH/PUT/DELETE) respond with 501 so that
 * tests fail loudly instead of silently passing with a broken contract.
 *
 * Register this BEFORE more-specific routes — Playwright evaluates routes in
 * reverse-registration order (last registered = highest priority), so specific
 * mocks added after will still take precedence.
 */
export async function mockApiFallback(page: Page) {
  await page.route(`${API}/**`, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        json: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    }
    // Fail fast for unmocked mutating requests to avoid false-positive E2E passes.
    return route.fulfill({
      status: 501,
      json: { error: `Unmocked ${method} request in mockApiFallback: ${route.request().url()}` },
    });
  });
}
