import { apiClient } from "./client";

export type OrgStatus = "active" | "inactive";

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
  list: (): Promise<ApiCompany[]> =>
    apiClient.get<ApiCompany[]>("/org").then((r) => r.data),

  getById: (id: string): Promise<ApiCompany> =>
    apiClient.get<ApiCompany>(`/org/${id}`).then((r) => r.data),

  create: (dto: CreateCompanyDto): Promise<ApiCompany> =>
    apiClient.post<ApiCompany>("/org", dto).then((r) => r.data),

  update: (id: string, dto: UpdateCompanyDto): Promise<ApiCompany> =>
    apiClient.patch<ApiCompany>(`/org/${id}`, dto).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    apiClient.delete(`/org/${id}`).then(() => undefined),

  restore: (id: string): Promise<ApiCompany> =>
    apiClient.post<ApiCompany>(`/org/${id}/restore`).then((r) => r.data),
};
