import { apiClient } from './client'

export interface AuditLogEntry {
  id:              string
  service:         string
  actorId:         string
  orgId:           string
  action:          string
  resourceType:    string
  resourceId:      string
  resourceName?:   string | null
  correlationId?:  string | null
  ip?:             string | null
  metadata:        Record<string, unknown> | null
  timestamp:       string
  indexedAt:       string
}

export interface PaginatedAuditLogs {
  data:  AuditLogEntry[]
  total: number
  page:  number
  limit: number
}

export interface AuditLogFilters {
  orgId?:         string
  actorId?:       string
  resourceType?:  string
  resourceId?:    string
  action?:        string
  service?:       string
  correlationId?: string
  from?:          string
  to?:            string
  page?:          number
  limit?:         number
}

export interface AuditExportFilters {
  orgId?:          string
  actorId?:        string
  resourceType?:   string
  action?:         string
  service?:        string
  correlationId?:  string
  from?:           string
  to?:             string
  limit?:          number
}

export const auditApi = {
  getLogs: (filters?: AuditLogFilters) =>
    apiClient
      .get<PaginatedAuditLogs>('/audit/logs', { params: filters })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<AuditLogEntry>(`/audit/logs/${id}`).then((r) => r.data),

  exportLogs: (filters?: AuditExportFilters) =>
    apiClient
      .get<AuditLogEntry[]>('/audit/logs/export', { params: filters })
      .then((r) => r.data),
}
