import { http, HttpResponse } from 'msw';
import type { ApiNotification, PaginatedNotifications } from '@/lib/api/notifications';

// ── Seed data ─────────────────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS: ApiNotification[] = [
  {
    id: 'notif-001',
    userId: 'usr-001',
    type: 'WORKFLOW_APPROVAL_REQUESTED',
    title: 'Aprobación requerida',
    message: 'El workflow "Revisión contrato proveedor 2025" está pendiente de tu aprobación.',
    orgId: 'org-001',
    orgName: 'Constructora Helisa S.A.S.',
    workflowId: 'wf-002',
    workflowTitle: 'Revisión contrato proveedor 2025',
    read: false,
    readAt: null,
    metadata: null,
    createdAt: '2025-01-20T11:00:00Z',
  },
  {
    id: 'notif-002',
    userId: 'usr-001',
    type: 'WORKFLOW_APPROVED',
    title: 'Workflow aprobado',
    message: 'El workflow "Orden de compra equipos IT" fue aprobado.',
    orgId: 'org-001',
    orgName: 'Constructora Helisa S.A.S.',
    workflowId: 'wf-003',
    workflowTitle: 'Orden de compra equipos IT',
    read: true,
    readAt: '2025-01-19T09:30:00Z',
    metadata: null,
    createdAt: '2025-01-18T16:00:00Z',
  },
  {
    id: 'notif-003',
    userId: 'usr-001',
    type: 'WORKFLOW_REJECTED',
    title: 'Workflow rechazado',
    message: 'El workflow "Solicitud vacaciones Q1" fue rechazado con observaciones.',
    orgId: 'org-001',
    orgName: 'Constructora Helisa S.A.S.',
    workflowId: 'wf-004',
    workflowTitle: 'Solicitud vacaciones Q1',
    read: false,
    readAt: null,
    metadata: { observations: 'Documentación incompleta.' },
    createdAt: '2025-01-17T10:00:00Z',
  },
];

let notificationsDb = MOCK_NOTIFICATIONS.map((n) => ({ ...n }));

// ── Handlers — order: specific static paths before :id patterns ───────────────

export const notificationsHandlers = [
  // Unread count
  http.get('*/notifications/unread-count', () => {
    const count = notificationsDb.filter((n) => !n.read).length;
    return HttpResponse.json({ count });
  }),

  // Mark all as read
  http.patch('*/notifications/read-all', () => {
    let updated = 0;
    notificationsDb = notificationsDb.map((n) => {
      if (!n.read) {
        updated++;
        return { ...n, read: true, readAt: new Date().toISOString() };
      }
      return n;
    });
    return HttpResponse.json({ updated });
  }),

  // Issue SSE ticket (one-time use)
  http.post('*/notifications/stream/ticket', () =>
    HttpResponse.json({ ticket: `mock-sse-ticket-${Date.now()}`, expiresIn: 30 }),
  ),

  // Mark single notification as read
  http.patch('*/notifications/:id/read', ({ params }) => {
    notificationsDb = notificationsDb.map((n) =>
      n.id === params['id'] ? { ...n, read: true, readAt: new Date().toISOString() } : n,
    );
    const updated = notificationsDb.find((n) => n.id === params['id']);
    if (!updated) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // Paginated list
  http.get('*/notifications', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);

    const total = notificationsDb.length;
    const data = notificationsDb.slice((page - 1) * limit, page * limit);

    return HttpResponse.json<PaginatedNotifications>({ data, total, page, limit });
  }),
];
