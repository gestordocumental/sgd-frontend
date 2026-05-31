import { apiClient } from './client';

export type OrgStatus = 'active' | 'inactive';

export interface ApiCompany {
  id: string;
  name: string;
  nit: string | null;
  address: string | null;
  phone: string | null;
  status: OrgStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateCompanyDto {
  name: string;
  nit?: string;
  address?: string;
  phone?: string;
}

export interface UpdateCompanyDto {
  name?: string;
  nit?: string;
  address?: string;
  phone?: string;
  status?: OrgStatus;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const companiesApi = {
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive' | 'deleted';
  }): Promise<{ data: ApiCompany[]; total: number }> =>
    apiClient.get<{ data: ApiCompany[]; total: number }>('/org', { params }).then((r) => r.data),

  getById: (id: string): Promise<ApiCompany> =>
    apiClient.get<ApiCompany>(`/org/${id}`).then((r) => r.data),

  create: (dto: CreateCompanyDto): Promise<ApiCompany> =>
    apiClient.post<ApiCompany>('/org', dto).then((r) => r.data),

  update: (id: string, dto: UpdateCompanyDto): Promise<ApiCompany> =>
    apiClient.patch<ApiCompany>(`/org/${id}`, dto).then((r) => r.data),

  remove: (id: string): Promise<void> => apiClient.delete(`/org/${id}`).then(() => undefined),

  restore: (id: string): Promise<ApiCompany> =>
    apiClient.post<ApiCompany>(`/org/${id}/restore`).then((r) => r.data),
};

// Fetches every page and returns a flat array.
// Used by the super-admin context-switcher so it never silently truncates when
// there are more than PAGE_SIZE organisations.
const FETCH_ALL_PAGE_SIZE = 100;

export async function fetchAllCompanies(): Promise<ApiCompany[]> {
  const first = await companiesApi.list({ page: 1, limit: FETCH_ALL_PAGE_SIZE });
  if (first.total <= FETCH_ALL_PAGE_SIZE) return first.data;

  const totalPages = Math.ceil(first.total / FETCH_ALL_PAGE_SIZE);
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      companiesApi.list({ page: i + 2, limit: FETCH_ALL_PAGE_SIZE }),
    ),
  );
  return [...first.data, ...rest.flatMap((r) => r.data)];
}
