import { http, HttpResponse } from 'msw';
import type { ApiWorkflow, PaginatedWorkflows } from '@/lib/api/workflows';

// ── Seed data ─────────────────────────────────────────────────────────────────

const BASE_WORKFLOW: ApiWorkflow = {
  id: 'wf-001',
  orgId: 'org-001',
  title: 'Revisión contrato proveedor 2025',
  description: 'Revisión y aprobación del contrato anual con proveedor principal.',
  typologyId: 'typ-001',
  typologyCode: 'CON-01',
  typologyVersion: '1.0',
  typologyName: 'Contratos',
  mainDocumentId: null,
  mainDocumentValidated: false,
  mainDocumentMetadata: null,
  status: 'DRAFT',
  currentApprovalStepOrder: null,
  currentAssignedUserId: null,
  finalUserIds: ['usr-002'],
  createdBy: 'usr-001',
  closedBy: null,
  closedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  approvalSteps: [
    {
      id: 'step-001',
      workflowId: 'wf-001',
      userId: 'usr-003',
      stepOrder: 1,
      status: 'WAITING',
      completedAt: null,
    },
  ],
  approvalActions: [],
  attachments: [],
  activeAdminCycle: null,
  adminCycles: [],
  createdAt: '2025-01-15T09:00:00Z',
  updatedAt: '2025-01-15T09:00:00Z',
};

const PENDING_WORKFLOW: ApiWorkflow = {
  ...BASE_WORKFLOW,
  id: 'wf-002',
  title: 'Orden de compra equipos IT',
  typologyCode: 'OC-03',
  typologyName: 'Órdenes de compra',
  status: 'PENDING_APPROVAL',
  currentApprovalStepOrder: 1,
  currentAssignedUserId: 'usr-001',
  createdAt: '2025-01-10T14:00:00Z',
  updatedAt: '2025-01-20T11:00:00Z',
};

const MOCK_WORKFLOWS = [BASE_WORKFLOW, PENDING_WORKFLOW];

// ── Handlers — order matters: specific static paths before :id patterns ───────

export const workflowsHandlers = [
  // Stats
  http.get('*/workflows/stats', () =>
    HttpResponse.json({ draft: 1, pendingApproval: 1, approved: 3, rejected: 0, closed: 2 }),
  ),

  // Super-admin storage
  http.get('*/workflows/admin/storage-per-org', () => HttpResponse.json([])),

  // My pending tasks (current user as approver)
  http.get('*/workflows/my-tasks', () => HttpResponse.json([PENDING_WORKFLOW])),

  // Workflows available for final user
  http.get('*/workflows/my-available', () => HttpResponse.json([])),

  // Notify when typology has no final users
  http.post('*/workflows/notify-no-final-users', () => new HttpResponse(null, { status: 204 })),

  // Timeline for a specific workflow
  http.get('*/workflows/:id/timeline', () =>
    HttpResponse.json([
      {
        id: 'evt-001',
        workflowId: 'wf-001',
        eventType: 'WORKFLOW_CREATED',
        actorId: 'usr-001',
        targetUserId: null,
        description: 'Workflow creado',
        metadata: null,
        createdAt: '2025-01-15T09:00:00Z',
      },
    ]),
  ),

  // Start approval cycle
  http.post('*/workflows/:id/start-approval', ({ params }) =>
    HttpResponse.json({ ...BASE_WORKFLOW, id: params['id'] as string, status: 'PENDING_APPROVAL' }),
  ),

  // Approve current step
  http.post('*/workflows/:id/approve', ({ params }) =>
    HttpResponse.json({
      ...BASE_WORKFLOW,
      id: params['id'] as string,
      status: 'PENDING_REVIEW_CYCLE',
    }),
  ),

  // Reject current step
  http.post('*/workflows/:id/reject', ({ params }) =>
    HttpResponse.json({ ...BASE_WORKFLOW, id: params['id'] as string, status: 'REJECTED' }),
  ),

  // Create admin cycle (review cycle)
  http.post('*/workflows/:id/admin-cycles', ({ params }) =>
    HttpResponse.json(
      {
        id: 'cycle-001',
        workflowId: params['id'] as string,
        cycleNumber: 1,
        initiatedBy: 'usr-002',
        status: 'IN_PROGRESS',
        currentStepOrder: 1,
        completedAt: null,
        allowedOptionalReviewerIds: [],
        steps: [],
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    ),
  ),

  // Complete an admin step
  http.patch(
    '*/workflows/:id/admin-cycles/:cycleId/steps/:stepId/complete',
    () => new HttpResponse(null, { status: 200 }),
  ),

  // Forward admin step to optional reviewer
  http.post(
    '*/workflows/:id/admin-cycles/:cycleId/steps/:stepId/forward',
    () => new HttpResponse(null, { status: 201 }),
  ),

  // Finalize an admin cycle
  http.post('*/workflows/:id/admin-cycles/:cycleId/finalize', ({ params }) =>
    HttpResponse.json({
      id: 'cycle-001',
      workflowId: params['id'] as string,
      cycleNumber: 1,
      initiatedBy: 'usr-002',
      status: 'COMPLETED',
      currentStepOrder: null,
      completedAt: new Date().toISOString(),
      allowedOptionalReviewerIds: [],
      steps: [],
      createdAt: new Date().toISOString(),
    }),
  ),

  // Skip review cycle
  http.post('*/workflows/:id/skip-review-cycle', ({ params }) =>
    HttpResponse.json({
      ...BASE_WORKFLOW,
      id: params['id'] as string,
      status: 'AVAILABLE_FOR_FINAL_USERS',
    }),
  ),

  // Close workflow
  http.post('*/workflows/:id/close', ({ params }) =>
    HttpResponse.json({ ...BASE_WORKFLOW, id: params['id'] as string, status: 'CLOSED' }),
  ),

  // Get single workflow by ID
  http.get('*/workflows/:id', ({ params }) => {
    const workflow = MOCK_WORKFLOWS.find((w) => w.id === params['id']);
    if (!workflow) {
      return HttpResponse.json({ message: 'Workflow not found' }, { status: 404 });
    }
    return HttpResponse.json(workflow);
  }),

  // Paginated list
  http.get('*/workflows', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const search = url.searchParams.get('search') ?? '';
    const status = url.searchParams.get('status') ?? '';

    const filtered = MOCK_WORKFLOWS.filter((w) => {
      if (status && w.status !== status) return false;
      if (search && !w.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);

    return HttpResponse.json<PaginatedWorkflows>({
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),

  // Create workflow
  http.post('*/workflows', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json<ApiWorkflow>(
      {
        ...BASE_WORKFLOW,
        id: `wf-${Date.now()}`,
        title: (body['title'] as string | undefined) ?? 'Nuevo workflow',
        description: (body['description'] as string | undefined) ?? null,
        typologyId: (body['typologyId'] as string | undefined) ?? 'typ-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  // Update workflow
  http.patch('*/workflows/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const existing = MOCK_WORKFLOWS.find((w) => w.id === params['id']);
    if (!existing) {
      return HttpResponse.json({ message: 'Workflow not found' }, { status: 404 });
    }
    return HttpResponse.json<ApiWorkflow>({
      ...existing,
      ...(body['title'] !== undefined && { title: body['title'] as string }),
      ...(body['description'] !== undefined && {
        description: body['description'] as string | null,
      }),
      updatedAt: new Date().toISOString(),
    });
  }),

  // Delete workflow (soft delete)
  http.delete('*/workflows/:id', () => new HttpResponse(null, { status: 204 })),
];
