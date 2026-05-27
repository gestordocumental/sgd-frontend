import type { Page } from '@playwright/test';
import { companyUserJwt, globalUserJwt } from './jwt';

/** Base URL of the backend API as seen from the browser during E2E tests. */
export const API = 'http://localhost:8000';

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
}

/**
 * Catch-all fallback: any unmatched request to the API returns an empty
 * successful response so that unmocked dashboard queries don't break navigation.
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
    return route.fulfill({
      status: 501,
      json: { message: `Unmocked ${method} ${route.request().url()}` },
    });
  });
}
