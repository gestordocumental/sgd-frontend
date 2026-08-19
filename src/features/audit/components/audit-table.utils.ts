import type { useAudit } from '../hooks/use-audit';

export type AuditHook = ReturnType<typeof useAudit>;
export type AuditLog = AuditHook['logs'][number];

export interface SimpleUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

// metadata.changes comes straight out of Elasticsearch as loosely-typed JSON
// — nothing guarantees every entry actually has the {from, to} shape, so this
// validates the whole object before any caller destructures it. All-or-
// nothing (not per-entry filtering) so AuditDetailModal and the export always
// agree on whether a given log's metadata is well-formed.
export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

export function isAuditChanges(value: unknown): value is AuditChanges {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    (entry) => entry && typeof entry === 'object' && 'from' in entry && 'to' in entry,
  );
}

export const RESOURCE_TYPES = [
  'user',
  'company',
  'cargo',
  'area',
  'departamento',
  'typology',
  'workflow',
];

export const CORRELATION_RESOURCE_TYPES = new Set(['typology', 'workflow']);

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
    'USER_OPTIONAL_REVIEWER_CHANGED',
  ],
  'org-service': [
    'COMPANY_CREATED',
    'COMPANY_UPDATED',
    'COMPANY_DELETED',
    'COMPANY_RESTORED',
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
};

export const ALL_ACTIONS = Array.from(new Set(Object.values(ACTIONS_BY_SERVICE).flat())).sort();

export const RESOURCE_TYPE_COLORS: Record<string, string> = {
  user: 'bg-blue-100 text-blue-800',
  company: 'bg-sky-100 text-sky-800',
  cargo: 'bg-purple-100 text-purple-800',
  area: 'bg-violet-100 text-violet-800',
  departamento: 'bg-indigo-100 text-indigo-800',
  typology: 'bg-green-100 text-green-800',
  workflow: 'bg-orange-100 text-orange-800',
};

export type TFn = (key: string, opts?: Record<string, unknown>) => string;

export function resolveActorName(
  actorId: string,
  users: SimpleUser[],
  serverResolvedName?: string | null,
): string {
  // Prefer the name resolved server-side (see AuditService.resolveActorNames)
  // — works regardless of whether the viewer's role has USERS:READ. `users`
  // is only a fallback for older cached responses that predate this field.
  if (serverResolvedName) return serverResolvedName;
  const u = users.find((u) => u.id === actorId);
  if (!u) return actorId;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || actorId;
}

export function formatAction(action: string, t: TFn): string {
  return String(t(`audit.actions.${action}`, { defaultValue: action.replace(/_/g, ' ') }));
}

export function formatFieldName(field: string, t: TFn): string {
  return String(t(`audit.fields.${field}`, { defaultValue: field }));
}

export function resourceTypeColor(type: string) {
  return RESOURCE_TYPE_COLORS[type] ?? 'bg-muted text-muted-foreground';
}

export function formatResourceType(type: string, t: TFn): string {
  return String(t(`audit.resourceTypes.${type}`, { defaultValue: type }));
}

export interface AuditExportLog {
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string | null;
  actorId: string;
  actorName?: string | null;
  ip?: string | null;
  correlationId?: string | null;
  metadata: Record<string, unknown> | null;
}

// Shared by AuditExportModal (org-wide export) and DetailWorkflowDialog's
// "Descargar todo" (a single workflow's own audit trail via its Correlation
// ID) — kept in one place so a translation fix like formatFieldName only
// needs to happen once instead of drifting between two copies.
export function buildAuditExportRows(
  logs: AuditExportLog[],
  users: SimpleUser[],
  t: TFn,
): Record<string, string>[] {
  return logs.map((log) => {
    const rawChanges = log.metadata?.['changes'];
    const changes = isAuditChanges(rawChanges) ? rawChanges : null;
    const changesText = changes
      ? Object.entries(changes)
          .map(([field, { from: f, to: tv }]) => {
            const label = formatFieldName(field, t);
            return f === null && tv === null
              ? `${label}: ${t('audit.detail.modified')}`
              : `${label}: "${f === true ? t('common.active') : f === false ? t('common.inactive') : (f ?? '—')}" → "${tv === true ? t('common.active') : tv === false ? t('common.inactive') : (tv ?? '—')}"`;
          })
          .join(' | ')
      : '';

    return {
      [t('audit.columns.timestamp')]: new Date(log.timestamp).toLocaleString(),
      [t('audit.columns.action')]: formatAction(log.action, t),
      [t('audit.columns.resourceType')]: formatResourceType(log.resourceType, t),
      [t('audit.columns.resource')]: log.resourceName ?? log.resourceId,
      [t('audit.columns.actor')]: resolveActorName(log.actorId, users, log.actorName),
      [t('audit.columns.ip')]: log.ip ?? '',
      [t('audit.columns.correlationId')]: log.correlationId ?? '',
      [t('audit.detail.changes')]: changesText,
    };
  });
}

// ── Grouping a workflow's own audit trail into PDF export sections ─────────────
//
// Used by DetailWorkflowDialog's "Descargar todo" PDF export. Section per
// TimelineEventType, traced against workflow-service's actual emitters (not
// guessed from file/method names — workflow-admin-cycle.service.ts, despite
// its name, also emits the final-user actions: closeWorkflow()/
// cancelWorkflow()/addNote() there are all explicitly gated to
// `finalUserIds.includes(userId)`, not to an active admin cycle).
export type AuditExportSection = 'creation' | 'approval' | 'review' | 'finalUser' | 'other';

// Order sections appear in the exported PDF.
export const AUDIT_EXPORT_SECTION_ORDER: AuditExportSection[] = [
  'creation',
  'approval',
  'review',
  'finalUser',
  'other',
];

const ACTION_TO_SECTION: Record<string, AuditExportSection> = {
  WORKFLOW_CREATED: 'creation',
  WORKFLOW_UPDATED: 'creation',
  APPROVAL_STARTED: 'approval',
  STEP_APPROVED: 'approval',
  STEP_REJECTED: 'approval',
  WORKFLOW_RETURNED_TO_CREATOR: 'approval',
  WORKFLOW_RESUBMITTED: 'approval',
  ADMIN_CYCLE_STARTED: 'review',
  ADMIN_STEP_COMPLETED: 'review',
  ADMIN_CYCLE_COMPLETED: 'review',
  NOTE_ADDED: 'finalUser',
  ATTACHMENT_ADDED: 'finalUser',
  WORKFLOW_CLOSED: 'finalUser',
  WORKFLOW_CANCELLED: 'finalUser',
  // WORKFLOW_APPROVED intentionally absent — resolved dynamically below,
  // since it means two different things depending on where it came from.
};

/**
 * WORKFLOW_APPROVED is emitted from two different places with the same event
 * type but different meaning: the normal end of the approval chain
 * (workflow-approval.service.ts — belongs in "approval"), and
 * skipReviewCycle() (workflow-admin-cycle.service.ts — a final user opting
 * out of the review cycle, belongs in "finalUser"). Only the second one sets
 * metadata.skippedBy, so that's the disambiguator.
 */
export function sectionForAuditLog(
  log: Pick<AuditExportLog, 'action' | 'metadata'>,
): AuditExportSection {
  if (log.action === 'WORKFLOW_APPROVED') {
    return log.metadata?.['skippedBy'] ? 'finalUser' : 'approval';
  }
  return ACTION_TO_SECTION[log.action] ?? 'other';
}

/** Buckets logs into export sections, preserving each section's relative order. */
export function groupAuditLogsForExport(
  logs: AuditExportLog[],
): Record<AuditExportSection, AuditExportLog[]> {
  const groups: Record<AuditExportSection, AuditExportLog[]> = {
    creation: [],
    approval: [],
    review: [],
    finalUser: [],
    other: [],
  };
  for (const log of logs) {
    groups[sectionForAuditLog(log)].push(log);
  }
  return groups;
}

export function resolveResourceName(log: {
  resourceId: string;
  resourceName?: string | null;
  metadata: Record<string, unknown> | null;
}): string {
  if (log.resourceName) return log.resourceName;

  const m = log.metadata;
  if (!m) return log.resourceId;

  // For *_UPDATED events: the name may live in metadata.changes.name.{from,to}
  // when resourceName was not yet indexed (legacy documents).
  const changes = m['changes'];
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    const nameChange = (changes as Record<string, unknown>)['name'];
    if (nameChange && typeof nameChange === 'object' && !Array.isArray(nameChange)) {
      const { to, from } = nameChange as { to: unknown; from: unknown };
      if (to && typeof to === 'string') return to;
      if (from && typeof from === 'string') return from;
    }
  }

  // For *_CREATED events: name, email, or title may appear at the top level.
  const topLevel = (m['name'] ?? m['email'] ?? m['title']) as string | undefined;
  if (topLevel && typeof topLevel === 'string') return topLevel;

  return log.resourceId;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
