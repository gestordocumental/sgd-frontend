import * as Sentry from '@sentry/react';

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

export type CursorPage<T> = { data: T[]; nextCursor: string | null; hasMore: boolean };

export const companiesApi = {
  list: (
    params?: {
      cursor?: string;
      limit?: number;
      search?: string;
      status?: 'active' | 'inactive' | 'deleted';
    },
    signal?: AbortSignal,
  ): Promise<CursorPage<ApiCompany>> =>
    apiClient.get<CursorPage<ApiCompany>>('/org', { params, signal }).then((r) => r.data),

  getById: (id: string, signal?: AbortSignal): Promise<ApiCompany> =>
    apiClient.get<ApiCompany>(`/org/${id}`, { signal }).then((r) => r.data),

  create: (dto: CreateCompanyDto): Promise<ApiCompany> =>
    apiClient.post<ApiCompany>('/org', dto).then((r) => r.data),

  update: (id: string, dto: UpdateCompanyDto): Promise<ApiCompany> =>
    apiClient.patch<ApiCompany>(`/org/${id}`, dto).then((r) => r.data),

  remove: (id: string): Promise<void> => apiClient.delete(`/org/${id}`).then(() => undefined),

  restore: (id: string): Promise<ApiCompany> =>
    apiClient.post<ApiCompany>(`/org/${id}/restore`).then((r) => r.data),

  getMyOrgs: (ids: string[], signal?: AbortSignal): Promise<ApiCompany[]> =>
    apiClient
      .get<ApiCompany[]>('/org/mine', { params: { ids: ids.join(',') }, signal })
      .then((r) => r.data),
};

// Fetches every page sequentially and returns a flat array.
// Used by the super-admin context-switcher so it never silently truncates.
const FETCH_ALL_PAGE_SIZE = 100;

export async function fetchAllCompanies(signal?: AbortSignal): Promise<ApiCompany[]> {
  try {
    const all: ApiCompany[] = [];
    let cursor: string | undefined;
    do {
      const page = await companiesApi.list({ cursor, limit: FETCH_ALL_PAGE_SIZE }, signal);
      all.push(...page.data);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    return all;
  } catch (error) {
    Sentry.captureException(error, { tags: { context: 'fetchAllCompanies' } });
    throw error;
  }
}
