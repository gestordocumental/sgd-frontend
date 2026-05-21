import type { useAudit } from '../hooks/use-audit'

export type AuditHook = ReturnType<typeof useAudit>
export type AuditLog = AuditHook['logs'][number]

export interface SimpleUser {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

export const RESOURCE_TYPES = [
  'user',
  'cargo',
  'area',
  'departamento',
  'typology',
  'workflow',
]

export const CORRELATION_RESOURCE_TYPES = new Set(['typology', 'workflow'])

export const ACTIONS_BY_SERVICE: Record<string, string[]> = {
  'user-service': [
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'USER_RESTORED',
    'USER_ORG_ASSIGNED',
    'USER_ORG_ROLE_UPDATED',
    'USER_REMOVED_FROM_ORG',
    'USER_SUPER_ADMIN_CHANGED',
  ],
  'org-service': [
    'DEPARTAMENTO_CREATED',
    'DEPARTAMENTO_UPDATED',
    'DEPARTAMENTO_DELETED',
    'DEPARTAMENTO_RESTORED',
    'AREA_CREATED',
    'AREA_UPDATED',
    'AREA_DELETED',
    'AREA_RESTORED',
    'CARGO_CREATED',
    'CARGO_UPDATED',
    'CARGO_DELETED',
    'CARGO_RESTORED',
  ],
  'document-service': [
    'TYPOLOGY_CREATED',
    'TYPOLOGY_UPDATED',
    'TYPOLOGY_DELETED',
    'TYPOLOGY_VERSION_CREATED',
    'TYPOLOGY_DOCUMENT_UPLOADED',
    'TYPOLOGY_EXTRACTION_RETRIED',
    'TYPOLOGY_DISCREPANCY_RESOLVED',
  ],
  'workflow-service': [
    'WORKFLOW_CREATED',
    'WORKFLOW_UPDATED',
    'APPROVAL_STARTED',
    'STEP_APPROVED',
    'STEP_REJECTED',
    'WORKFLOW_RETURNED_TO_CREATOR',
    'WORKFLOW_RESUBMITTED',
    'WORKFLOW_APPROVED',
    'ATTACHMENT_ADDED',
    'NOTE_ADDED',
    'ADMIN_CYCLE_STARTED',
    'ADMIN_STEP_COMPLETED',
    'ADMIN_CYCLE_COMPLETED',
    'WORKFLOW_CLOSED',
    'WORKFLOW_CANCELLED',
  ],
  'audit-service': [],
}

export const ALL_ACTIONS = Array.from(new Set(Object.values(ACTIONS_BY_SERVICE).flat())).sort()

export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  user:         'bg-blue-100 text-blue-800',
  cargo:        'bg-purple-100 text-purple-800',
  area:         'bg-violet-100 text-violet-800',
  departamento: 'bg-indigo-100 text-indigo-800',
  typology:     'bg-green-100 text-green-800',
  workflow:     'bg-orange-100 text-orange-800',
}

export type TFn = (key: string, opts?: Record<string, unknown>) => string

export function resolveActorName(actorId: string, users: SimpleUser[]): string {
  const u = users.find((u) => u.id === actorId)
  if (!u) return actorId
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return name || u.email || actorId
}

export function formatAction(action: string, t: TFn): string {
  return String(t(`audit.actions.${action}`, { defaultValue: action.replace(/_/g, ' ') }))
}

export function formatFieldName(field: string, t: TFn): string {
  return String(t(`audit.fields.${field}`, { defaultValue: field }))
}

export function resourceTypeColor(type: string) {
  return RESOURCE_TYPE_COLORS[type] ?? 'bg-muted text-muted-foreground'
}

export function formatResourceType(type: string, t: TFn): string {
  return String(t(`audit.resourceTypes.${type}`, { defaultValue: type }))
}

export function resolveResourceName(log: { resourceId: string; resourceName?: string | null; metadata: Record<string, unknown> | null }): string {
  if (log.resourceName) return log.resourceName
  const m = log.metadata
  if (m) {
    const name = (m['name'] ?? m['email'] ?? m['title']) as string | undefined
    if (name) return name
  }
  return log.resourceId
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
