import { http, HttpResponse } from 'msw';
import type { ApiCompany } from '@/lib/api/companies';

// ── Seed data ─────────────────────────────────────────────────────────────────

const MOCK_COMPANIES: ApiCompany[] = [
  {
    id: 'org-001',
    name: 'Constructora Helisa S.A.S.',
    nit: '900.123.456-7',
    address: 'Cra 15 # 93-75, Bogotá',
    phone: '+57 1 234 5678',
    status: 'active',
    createdBy: 'usr-001',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-06-01T10:00:00Z',
    deletedAt: null,
  },
  {
    id: 'org-002',
    name: 'Distribuidora Norte Ltda.',
    nit: '800.987.654-3',
    address: 'Av. El Dorado # 68-21, Bogotá',
    phone: '+57 1 345 6789',
    status: 'active',
    createdBy: 'usr-001',
    createdAt: '2024-02-20T09:30:00Z',
    updatedAt: '2024-05-15T14:20:00Z',
    deletedAt: null,
  },
  {
    id: 'org-003',
    name: 'Servicios TI Colombia S.A.',
    nit: '901.555.111-2',
    address: 'Cl 72 # 11-35, Bogotá',
    phone: null,
    status: 'inactive',
    createdBy: 'usr-001',
    createdAt: '2023-11-01T11:00:00Z',
    updatedAt: '2024-01-10T16:00:00Z',
    deletedAt: null,
  },
];

const createCompaniesDb = () => MOCK_COMPANIES.map((c) => ({ ...c }));

export function resetCompaniesDb() {
  companiesDb = createCompaniesDb();
}

let companiesDb = createCompaniesDb();

// ── Handlers ──────────────────────────────────────────────────────────────────

export const companiesHandlers = [
  // Paginated + filtered list
  http.get('*/org', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const status = url.searchParams.get('status') ?? '';

    const filtered = companiesDb.filter((c) => {
      if (status === 'deleted' && c.deletedAt === null) return false;
      if (status !== 'deleted' && c.deletedAt !== null) return false;
      if (status === 'active' && c.status !== 'active') return false;
      if (status === 'inactive' && c.status !== 'inactive') return false;
      if (search && !c.name.toLowerCase().includes(search)) return false;
      return true;
    });

    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);
    return HttpResponse.json({ data, total });
  }),

  // Restore deleted company — must come before GET /:id
  http.post('*/org/:id/restore', ({ params }) => {
    companiesDb = companiesDb.map((c) =>
      c.id === params['id'] ? { ...c, deletedAt: null, status: 'active' as const } : c,
    );
    const restored = companiesDb.find((c) => c.id === params['id']);
    if (!restored) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(restored);
  }),

  // Get single company
  http.get('*/org/:id', ({ params }) => {
    const company = companiesDb.find((c) => c.id === params['id']);
    if (!company) return HttpResponse.json({ message: 'Organization not found' }, { status: 404 });
    return HttpResponse.json(company);
  }),

  // Create company
  http.post('*/org', async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      nit?: string;
      address?: string;
      phone?: string;
    };
    const newCompany: ApiCompany = {
      id: `org-${Date.now()}`,
      name: body.name,
      nit: body.nit ?? null,
      address: body.address ?? null,
      phone: body.phone ?? null,
      status: 'active',
      createdBy: 'usr-001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    companiesDb = [...companiesDb, newCompany];
    return HttpResponse.json(newCompany, { status: 201 });
  }),

  // Update company
  http.patch('*/org/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<ApiCompany>;
    companiesDb = companiesDb.map((c) =>
      c.id === params['id'] ? { ...c, ...body, id: c.id, updatedAt: new Date().toISOString() } : c,
    );
    const updated = companiesDb.find((c) => c.id === params['id']);
    if (!updated) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // Soft delete company
  http.delete('*/org/:id', ({ params }) => {
    companiesDb = companiesDb.map((c) =>
      c.id === params['id'] ? { ...c, deletedAt: new Date().toISOString() } : c,
    );
    return new HttpResponse(null, { status: 204 });
  }),
];
