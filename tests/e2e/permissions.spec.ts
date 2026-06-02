import { test, expect, type Page } from '@playwright/test';
import { API, injectCompanySession, mockAuthRefresh, mockApiFallback } from './helpers/auth';

const ORG_ID = 'org-001';

// ── Permission mock helper ─────────────────────────────────────────────────────

/**
 * Mock the two endpoints that useMyPermissions reads.
 * Pass an empty array to simulate a user with no role assignments.
 */
async function mockPermissions(
  page: Page,
  permissions: { module: string; action: string }[],
): Promise<void> {
  const hasRole = permissions.length > 0;

  await page.route(`${API}/users/me/org-roles`, (route) =>
    route.fulfill({
      json: hasRole
        ? [
            {
              id: 'or-001',
              userId: 'usr-001',
              orgId: ORG_ID,
              roleId: 'role-test',
              assignedBy: null,
              createdAt: '2024-01-01T00:00:00Z',
            },
          ]
        : [],
    }),
  );

  await page.route(`${API}/roles`, (route) =>
    route.fulfill({
      json: hasRole
        ? [
            {
              id: 'role-test',
              name: 'Test Role',
              description: null,
              orgId: ORG_ID,
              createdAt: '2024-01-01T00:00:00Z',
              permissions: permissions.map((p, i) => ({
                id: `p${i}`,
                module: p.module,
                action: p.action,
                description: null,
              })),
            },
          ]
        : [],
    }),
  );
}

/** Stub the minimal workflow endpoints so the tab can render. */
async function mockWorkflowEndpoints(page: Page): Promise<void> {
  await page.route(`${API}/workflows?**`, (route) =>
    route.fulfill({ json: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 } }),
  );
  await page.route(`${API}/workflows/my-tasks`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/workflows/my-available`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/workflows/stats`, (route) =>
    route.fulfill({ json: { total: 0, byStatus: {} } }),
  );
}

// ── Common setup ──────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Fallback must be first (lowest priority — specific mocks registered later win).
  await mockApiFallback(page);
  await injectCompanySession(page, ORG_ID);
  await mockAuthRefresh(page, ORG_ID);

  // useCompanyUsers always fetches these on mount regardless of permissions.
  await page.route(`${API}/org/${ORG_ID}/cargos`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/permissions`, (route) => route.fulfill({ json: [] }));
});

// ── 1. No role assignments ─────────────────────────────────────────────────────

test.describe('user with no role assignments', () => {
  test.beforeEach(async ({ page }) => {
    await mockPermissions(page, []);
  });

  test('all permission-gated tabs are absent from the header', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for permissions to resolve before asserting absences.
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 8_000 });

    await expect(page.getByRole('tab', { name: 'Workflows' })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /roles/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /governance/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /audit/i })).not.toBeVisible();
    // Users tab uses t('common.users')
    await expect(page.getByRole('tab', { name: /users/i })).not.toBeVisible();
  });

  test('Overview and Company tabs are always present', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('tab', { name: 'Company' })).toBeVisible();
  });
});

// ── 2. WORKFLOWS:READ only ─────────────────────────────────────────────────────

test.describe('user with WORKFLOWS:READ only', () => {
  test.beforeEach(async ({ page }) => {
    await mockPermissions(page, [{ module: 'WORKFLOWS', action: 'READ' }]);
    await mockWorkflowEndpoints(page);
  });

  test('Workflows tab is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('tab', { name: 'Workflows' })).toBeVisible({ timeout: 8_000 });
  });

  test('Users, Roles, Governance and Audit tabs are absent', async ({ page }) => {
    await page.goto('/dashboard');
    // Anchor on the one tab that should be present.
    await expect(page.getByRole('tab', { name: 'Workflows' })).toBeVisible({ timeout: 8_000 });

    await expect(page.getByRole('tab', { name: /users/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /roles/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /governance/i })).not.toBeVisible();
    await expect(page.getByRole('tab', { name: /audit/i })).not.toBeVisible();
  });

  test('"New workflow" button is absent (WORKFLOWS:WRITE not granted)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();

    // The tab content renders but the write action must not appear.
    await expect(page.getByRole('button', { name: /new workflow/i })).not.toBeVisible({
      timeout: 8_000,
    });
  });
});

// ── 3. WORKFLOWS:READ + WORKFLOWS:WRITE ───────────────────────────────────────

test.describe('user with WORKFLOWS:READ + WORKFLOWS:WRITE', () => {
  test.beforeEach(async ({ page }) => {
    await mockPermissions(page, [
      { module: 'WORKFLOWS', action: 'READ' },
      { module: 'WORKFLOWS', action: 'WRITE' },
    ]);
    await mockWorkflowEndpoints(page);
    // Typologies required by the create-workflow dialog.
    await page.route(`${API}/documents/${ORG_ID}/typologies**`, (route) =>
      route.fulfill({ json: [] }),
    );
  });

  test('"New workflow" button is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();
    await expect(page.getByRole('button', { name: /new workflow/i })).toBeVisible({
      timeout: 8_000,
    });
  });
});

// ── 4. USERS:READ only ────────────────────────────────────────────────────────

test.describe('user with USERS:READ only', () => {
  test.beforeEach(async ({ page }) => {
    await mockPermissions(page, [{ module: 'USERS', action: 'READ' }]);
    await page.route(`${API}/users/by-org/${ORG_ID}**`, (route) =>
      route.fulfill({ json: { data: [], total: 0 } }),
    );
  });

  test('Users tab is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('tab', { name: /users/i })).toBeVisible({ timeout: 8_000 });
  });

  test('"New user" button is absent (USERS:WRITE not granted)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: /users/i }).click();

    await expect(page.getByRole('button', { name: /new user/i })).not.toBeVisible({
      timeout: 8_000,
    });
  });
});

// ── 5. USERS:READ + USERS:WRITE ───────────────────────────────────────────────

test.describe('user with USERS:READ + USERS:WRITE', () => {
  test.beforeEach(async ({ page }) => {
    await mockPermissions(page, [
      { module: 'USERS', action: 'READ' },
      { module: 'USERS', action: 'WRITE' },
    ]);
    await page.route(`${API}/users/by-org/${ORG_ID}**`, (route) =>
      route.fulfill({ json: { data: [], total: 0 } }),
    );
  });

  test('"New user" button is visible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: /users/i }).click();
    await expect(page.getByRole('button', { name: /new user/i })).toBeVisible({ timeout: 8_000 });
  });
});
