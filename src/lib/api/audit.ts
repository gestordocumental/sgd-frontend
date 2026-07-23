import { apiClient } from './client';

export interface AuditLogEntry {
  id: string;
  service: string;
  actorId: string;
  // Resolved server-side — present regardless of whether the viewer's role
  // has USERS:READ. Null only if user-service couldn't resolve it (best-effort)
  // or the actor has no name set.
  actorName?: string | null;
  orgId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string | null;
  correlationId?: string | null;
  ip?: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  indexedAt: string;
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogFilters {
  orgId?: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  action?: string;
  service?: string;
  correlationId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AuditExportFilters {
  orgId?: string;
  actorId?: string;
  resourceType?: string;
  action?: string;
  service?: string;
  correlationId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export const auditApi = {
  getLogs: (filters?: AuditLogFilters, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedAuditLogs>('/audit/logs', { params: filters, signal })
      .then((r) => r.data),

  getById: (id: string, signal?: AbortSignal) =>
    apiClient.get<AuditLogEntry>(`/audit/logs/${id}`, { signal }).then((r) => r.data),

  exportLogs: (filters?: AuditExportFilters, signal?: AbortSignal) =>
    apiClient
      .get<AuditLogEntry[]>('/audit/logs/export', { params: filters, signal })
      .then((r) => r.data),
};
