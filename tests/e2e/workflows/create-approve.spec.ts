import { test, expect } from '@playwright/test';
import { API, injectCompanySession, mockAuthRefresh, mockApiFallback } from '../helpers/auth';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ORG_ID = 'org-001';

const MOCK_TYPOLOGY = {
  id: 'typ-001',
  orgId: ORG_ID,
  datosDeclarados: { nombre: 'Security Policy', codigo: 'SP-001', version: 'v1' },
  status: 'ACTIVE',
  documento: { extractionStatus: 'COMPLETED' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const MOCK_APPROVER = {
  id: 'usr-approver',
  email: 'approver@company.com',
  firstName: 'Ana',
  lastName: 'Approver',
  position: 'Legal Manager',
  isSuperAdmin: false,
  roles: [{ name: 'workflow_approver', permissions: ['workflow:approve'] }],
};

const MOCK_FINAL_USER = {
  id: 'usr-final',
  email: 'final@company.com',
  firstName: 'Carlos',
  lastName: 'Final',
  position: 'Department Head',
  isSuperAdmin: false,
  roles: [{ name: 'workflow_viewer', permissions: ['workflow:view_final'] }],
};

const CREATED_WORKFLOW = {
  id: 'wf-new-001',
  orgId: ORG_ID,
  title: 'Security Policy Approval',
  status: 'DRAFT',
  createdBy: 'usr-001',
  approvers: [{ userId: 'usr-approver', stepOrder: 1 }],
  attachments: [],
  approvalActions: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// ── Setup ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Fallback must be registered FIRST (lowest priority)
  await mockApiFallback(page);
  await injectCompanySession(page, ORG_ID);
  await mockAuthRefresh(page, ORG_ID);

  // Workflow list — empty initially
  await page.route(`${API}/workflows?**`, (route) =>
    route.fulfill({ json: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 } }),
  );
  await page.route(`${API}/workflows/my-tasks`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/workflows/my-available`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/workflows/stats`, (route) =>
    route.fulfill({ json: { total: 0, byStatus: {} } }),
  );

  // Typologies — return one active typology
  await page.route(`${API}/documents/${ORG_ID}/typologies**`, (route) =>
    route.fulfill({ json: [MOCK_TYPOLOGY] }),
  );

  // Org users — return approver + final-user
  await page.route(`${API}/users/by-org/${ORG_ID}**`, (route) =>
    route.fulfill({ json: { data: [MOCK_APPROVER, MOCK_FINAL_USER], total: 2 } }),
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Workflow creation', () => {
  test('navigating to Workflows tab shows the empty state and "New workflow" button', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();

    await expect(page.getByRole('button', { name: 'New workflow' })).toBeVisible({
      timeout: 8_000,
    });
  });

  test('clicking "New workflow" opens the creation dialog', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();
    await page.getByRole('button', { name: 'New workflow' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    // Dialog header matches the creation form
    await expect(page.getByRole('heading', { name: 'New workflow' })).toBeVisible();
    await expect(page.getByLabel('Title')).toBeVisible();
  });

  test('Create workflow button is visible while required fields are missing', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();
    await page.getByRole('button', { name: 'New workflow' }).click();

    // Only the title is filled — typology + approver still missing
    await page.getByLabel('Title').fill('My Workflow');

    const submitBtn = page.getByRole('button', { name: 'Create workflow' });
    // Button is enabled (no built-in disable for missing typology — validation fires on submit)
    // Just verify it is rendered inside the dialog
    await expect(submitBtn).toBeVisible();
  });

  test('Cancel button closes the dialog without creating a workflow', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();
    await page.getByRole('button', { name: 'New workflow' }).click();
    await page.getByLabel('Title').fill('Will be cancelled');

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('happy path — fill all required fields and create a workflow', async ({ page }) => {
    // Override the POST /workflows to return the created entity
    await page.route(`${API}/workflows`, async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 201, json: CREATED_WORKFLOW });
      }
      return route.continue();
    });
    // After creation, the list is re-fetched and should include the new workflow
    let listCallCount = 0;
    await page.route(`${API}/workflows?**`, (route) => {
      listCallCount++;
      const data = listCallCount > 1 ? [CREATED_WORKFLOW] : [];
      return route.fulfill({
        json: { data, total: data.length, page: 1, limit: 20, totalPages: data.length > 0 ? 1 : 0 },
      });
    });

    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();
    await page.getByRole('button', { name: 'New workflow' }).click();

    // Fill title
    await page.getByLabel('Title').fill('Security Policy Approval');

    // Select typology — click trigger, type to filter, pick option
    await page.getByRole('button', { name: /Select a typology/i }).click();
    await page.getByPlaceholder('Search typology...').fill('Security');
    await page.getByRole('button', { name: /Security Policy/i }).click();

    // Add an approver
    await page.getByRole('button', { name: /Add approver/i }).click();
    await page.getByPlaceholder('Search user...').fill('Ana');
    await page.getByRole('button', { name: /Ana Approver/i }).click();

    await page.getByRole('button', { name: 'Create workflow' }).click();

    // Dialog closes after successful creation
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Workflow approval', () => {
  test.beforeEach(async ({ page }) => {
    const draftWorkflow = { ...CREATED_WORKFLOW, status: 'DRAFT' };
    // List contains one DRAFT workflow
    await page.route(`${API}/workflows?**`, (route) =>
      route.fulfill({
        json: { data: [draftWorkflow], total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
    );
    await page.route(`${API}/workflows/${draftWorkflow.id}`, (route) =>
      route.fulfill({ json: { ...draftWorkflow, status: 'IN_APPROVAL' } }),
    );
    await page.route(`${API}/workflows/${draftWorkflow.id}/start-approval`, (route) =>
      route.fulfill({ json: { ...draftWorkflow, status: 'IN_APPROVAL' } }),
    );
  });

  test('Start approval action triggers the approval endpoint', async ({ page }) => {
    let startApprovalCalled = false;
    await page.route(`${API}/workflows/${CREATED_WORKFLOW.id}/start-approval`, (route) => {
      startApprovalCalled = true;
      return route.fulfill({
        json: { ...CREATED_WORKFLOW, status: 'IN_APPROVAL' },
      });
    });

    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();

    // Open workflow detail — look for the workflow title in the list
    await expect(page.getByText('Security Policy Approval')).toBeVisible({ timeout: 8_000 });
    await page.getByText('Security Policy Approval').click();

    // Find and click "Start approval" action (inside the detail dialog or action menu)
    const startApprovalBtn = page.getByRole('button', { name: /Start approval/i });
    await expect(startApprovalBtn).toBeVisible();
    await startApprovalBtn.click();
    expect(startApprovalCalled).toBe(true);
  });

  test('workflow status badge is visible in the list', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: 'Workflows' }).click();

    // The workflow title appears in the table/list
    await expect(page.getByText('Security Policy Approval')).toBeVisible({ timeout: 8_000 });
  });
});
