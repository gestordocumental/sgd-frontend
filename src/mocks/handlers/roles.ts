import { http, HttpResponse } from 'msw';
import type { ApiRole, ApiPermission } from '@/lib/api/roles';

// ── Seed data ─────────────────────────────────────────────────────────────────

const MOCK_PERMISSIONS: ApiPermission[] = [
  { id: 'perm-01', module: 'DOCUMENTS', action: 'READ', description: 'Ver documentos' },
  { id: 'perm-02', module: 'DOCUMENTS', action: 'WRITE', description: 'Crear y editar documentos' },
  { id: 'perm-03', module: 'DOCUMENTS', action: 'DELETE', description: 'Eliminar documentos' },
  { id: 'perm-04', module: 'DOCUMENTS', action: 'UPLOAD', description: 'Subir archivos' },
  { id: 'perm-05', module: 'DOCUMENTS', action: 'DOWNLOAD', description: 'Descargar archivos' },
  { id: 'perm-06', module: 'WORKFLOWS', action: 'READ', description: 'Ver workflows' },
  { id: 'perm-07', module: 'WORKFLOWS', action: 'WRITE', description: 'Crear y editar workflows' },
  {
    id: 'perm-08',
    module: 'WORKFLOWS',
    action: 'APPROVE',
    description: 'Aprobar o rechazar workflows',
  },
  {
    id: 'perm-09',
    module: 'WORKFLOWS',
    action: 'MANAGE',
    description: 'Gestionar todos los workflows de la org',
  },
  { id: 'perm-10', module: 'USERS', action: 'READ', description: 'Ver usuarios' },
  { id: 'perm-11', module: 'USERS', action: 'WRITE', description: 'Crear y editar usuarios' },
  { id: 'perm-12', module: 'USERS', action: 'DELETE', description: 'Eliminar usuarios' },
  { id: 'perm-13', module: 'USERS', action: 'MANAGE', description: 'Gestión completa de usuarios' },
  { id: 'perm-14', module: 'ROLES', action: 'READ', description: 'Ver roles y permisos' },
  { id: 'perm-15', module: 'ROLES', action: 'WRITE', description: 'Crear y editar roles' },
  { id: 'perm-16', module: 'AUDIT', action: 'READ', description: 'Ver logs de auditoría' },
  {
    id: 'perm-17',
    module: 'ORG_STRUCTURE',
    action: 'READ',
    description: 'Ver estructura organizacional',
  },
  {
    id: 'perm-18',
    module: 'ORG_STRUCTURE',
    action: 'WRITE',
    description: 'Editar estructura organizacional',
  },
  {
    id: 'perm-19',
    module: 'ORG_STRUCTURE',
    action: 'DELETE',
    description: 'Eliminar elementos de la estructura organizacional',
  },
];

const MOCK_ROLES: ApiRole[] = [
  {
    id: 'role-001',
    name: 'ADMIN',
    description: 'Administrador de la organización',
    permissions: MOCK_PERMISSIONS.filter((p) =>
      [
        'perm-06',
        'perm-07',
        'perm-08',
        'perm-09',
        'perm-10',
        'perm-11',
        'perm-12',
        'perm-14',
        'perm-15',
      ].includes(p.id),
    ),
    orgId: 'org-001',
    isSystem: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-002',
    name: 'EMPLOYEE',
    description: 'Empleado con acceso básico',
    permissions: MOCK_PERMISSIONS.filter((p) =>
      ['perm-01', 'perm-04', 'perm-05', 'perm-06'].includes(p.id),
    ),
    orgId: 'org-001',
    isSystem: false,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-003',
    name: 'Revisor de contratos',
    description: 'Aprobador de workflows de tipo contrato',
    permissions: MOCK_PERMISSIONS.filter((p) => ['perm-06', 'perm-08'].includes(p.id)),
    orgId: 'org-001',
    isSystem: false,
    createdAt: '2024-03-15T10:30:00Z',
  },
];

let rolesDb = [...MOCK_ROLES];

// ── Handlers ──────────────────────────────────────────────────────────────────

export const rolesHandlers = [
  // All available permissions
  http.get('*/permissions', () => HttpResponse.json(MOCK_PERMISSIONS)),

  // List roles for an org — filter by orgId when provided so tests can
  // verify scoping behaviour instead of always getting the full set.
  http.get('*/roles', ({ request }) => {
    const orgId = new URL(request.url).searchParams.get('orgId');
    const data = orgId ? rolesDb.filter((r) => r.orgId === orgId) : rolesDb;
    return HttpResponse.json(data);
  }),

  // Get role by ID
  http.get('*/roles/:id', ({ params }) => {
    const role = rolesDb.find((r) => r.id === params['id']);
    if (!role) return HttpResponse.json({ message: 'Role not found' }, { status: 404 });
    return HttpResponse.json(role);
  }),

  // Create role
  http.post('*/roles', async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      description?: string;
      permissionIds?: string[];
    };
    const perms = MOCK_PERMISSIONS.filter((p) => (body.permissionIds ?? []).includes(p.id));
    const newRole: ApiRole = {
      id: `role-${Date.now()}`,
      name: body.name,
      description: body.description ?? null,
      permissions: perms,
      orgId: 'org-001',
      isSystem: false,
      createdAt: new Date().toISOString(),
    };
    rolesDb = [...rolesDb, newRole];
    return HttpResponse.json(newRole, { status: 201 });
  }),

  // Update role
  http.patch('*/roles/:id', async ({ params, request }) => {
    const body = (await request.json()) as { name?: string; description?: string };
    rolesDb = rolesDb.map((r) => (r.id === params['id'] ? { ...r, ...body } : r));
    const updated = rolesDb.find((r) => r.id === params['id']);
    if (!updated) return HttpResponse.json({ message: 'Role not found' }, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // Delete role
  http.delete('*/roles/:id', ({ params }) => {
    rolesDb = rolesDb.filter((r) => r.id !== params['id']);
    return new HttpResponse(null, { status: 204 });
  }),

  // Replace all permissions on a role
  http.post('*/roles/:id/permissions', async ({ params, request }) => {
    const body = (await request.json()) as { permissionIds: string[] };
    const perms = MOCK_PERMISSIONS.filter((p) => body.permissionIds.includes(p.id));
    rolesDb = rolesDb.map((r) => (r.id === params['id'] ? { ...r, permissions: perms } : r));
    const updated = rolesDb.find((r) => r.id === params['id']);
    if (!updated) return HttpResponse.json({ message: 'Role not found' }, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // Remove single permission from role
  http.delete('*/roles/:id/permissions/:permissionId', ({ params }) => {
    rolesDb = rolesDb.map((r) =>
      r.id === params['id']
        ? { ...r, permissions: r.permissions.filter((p) => p.id !== params['permissionId']) }
        : r,
    );
    const updated = rolesDb.find((r) => r.id === params['id']);
    if (!updated) return HttpResponse.json({ message: 'Role not found' }, { status: 404 });
    return HttpResponse.json(updated);
  }),
];
