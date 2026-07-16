import { apiClient } from './client';
import type { AuditLogEntry } from './audit';

// ── Enums ────────────────────────────────────────────────────────────────────

export type WorkflowStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'RETURNED_TO_CREATOR' // legacy — filas antiguas en BD
  | 'REJECTED' // terminal — rechazado definitivamente
  | 'PENDING_REVIEW_CYCLE'
  | 'AVAILABLE_FOR_FINAL_USERS'
  | 'ADMIN_CYCLE_IN_PROGRESS'
  | 'CLOSED'
  | 'CANCELLED';

export type ApprovalStepStatus = 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type AdminStepStatus = 'WAITING' | 'PENDING' | 'COMPLETED';
export type TimelineEventType =
  | 'WORKFLOW_CREATED'
  | 'APPROVAL_STARTED'
  | 'STEP_APPROVED'
  | 'STEP_REJECTED'
  | 'WORKFLOW_RETURNED_TO_CREATOR'
  | 'WORKFLOW_RESUBMITTED'
  | 'WORKFLOW_APPROVED'
  | 'ATTACHMENT_ADDED'
  | 'NOTE_ADDED'
  | 'ADMIN_CYCLE_STARTED'
  | 'ADMIN_STEP_COMPLETED'
  | 'ADMIN_CYCLE_COMPLETED'
  | 'WORKFLOW_CLOSED'
  | 'WORKFLOW_CANCELLED';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface ApiWorkflowAttachment {
  id: string;
  workflowId: string;
  uploadedBy: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  attachmentType: 'MAIN_DOCUMENT' | 'SUPPORTING';
  createdAt: string;
}

export interface ApiApprovalStep {
  id: string;
  workflowId: string;
  userId: string;
  stepOrder: number;
  status: ApprovalStepStatus;
  completedAt: string | null;
}

export interface ApiApprovalAttachment {
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number | null;
}

export interface ApiApprovalAction {
  id: string;
  workflowId: string;
  stepId: string;
  userId: string;
  action: 'APPROVED' | 'REJECTED';
  observations: string | null;
  attemptNumber: number;
  attachments: ApiApprovalAttachment[];
  createdAt: string;
}

export interface ApiTimelineEvent {
  id: string;
  workflowId: string;
  eventType: TimelineEventType;
  actorId: string;
  // Resolved server-side — present regardless of whether the viewer's role has
  // USERS:READ. Null only if user-service couldn't be reached or the actor no
  // longer exists.
  actorName: string | null;
  targetUserId: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiAdminStepNote {
  id: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface ApiAdminStepAttachment {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  uploadedBy: string;
  createdAt: string;
}

export interface ApiAdminStep {
  id: string;
  cycleId: string;
  userId: string;
  stepOrder: number;
  status: AdminStepStatus;
  isOptional: boolean;
  insertedByStepId: string | null;
  completedAt: string | null;
  notes?: ApiAdminStepNote[];
  attachments?: ApiAdminStepAttachment[];
}

export interface ApiAdminCycle {
  id: string;
  workflowId: string;
  cycleNumber: number;
  initiatedBy: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  currentStepOrder: number | null;
  completedAt: string | null;
  allowedOptionalReviewerIds: string[];
  steps: ApiAdminStep[];
  createdAt: string;
}

export interface ApiWorkflow {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  typologyId: string;
  typologyCode: string;
  typologyVersion: string;
  typologyName: string;
  mainDocumentId: string | null;
  mainDocumentValidated: boolean;
  mainDocumentMetadata: Record<string, unknown> | null;
  status: WorkflowStatus;
  currentApprovalStepOrder: number | null;
  currentAssignedUserId: string | null;
  finalUserIds: string[] | null;
  createdBy: string;
  closedBy: string | null;
  closedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  approvalSteps: ApiApprovalStep[];
  approvalActions: ApiApprovalAction[];
  attachments: ApiWorkflowAttachment[];
  activeAdminCycle: ApiAdminCycle | null;
  adminCycles?: ApiAdminCycle[];
  createdAt: string;
  updatedAt: string;
  // Resolved server-side — names of every user referenced in this workflow
  // (creator, approvers, final users, admin cycle reviewers), keyed by userId.
  // Present regardless of the viewer's Users-module permission. A user missing
  // from the map means user-service couldn't resolve them (best-effort).
  participantNames: Record<string, string>;
}

export interface PaginatedWorkflows {
  data: ApiWorkflow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface ApproverStepDto {
  userId: string;
  stepOrder: number;
}

export interface WorkflowFileDto {
  storageKey: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes?: number;
}

export interface CreateWorkflowDto {
  title: string;
  description?: string;
  typologyId: string;
  approvers: ApproverStepDto[];
  mainDocument?: WorkflowFileDto;
  attachments?: WorkflowFileDto[];
  finalUserIds: string[];
}

export interface UpdateWorkflowDto {
  title?: string;
  description?: string;
  approvers?: ApproverStepDto[];
  mainDocument?: WorkflowFileDto;
  attachments?: WorkflowFileDto[];
  finalUserIds?: string[];
}

export interface ListWorkflowsParams {
  status?: WorkflowStatus;
  search?: string;
  createdBy?: string;
  page?: number;
  limit?: number;
}

// ── API object ────────────────────────────────────────────────────────────────

export interface WorkflowStats {
  totalWorkflows: number;
  statusCounts: Record<string, number>;
  myPendingTasks: number;
  weeklyTrend: { week: string; count: number }[];
  storageTotalBytes: number;
  totalAttachments: number;
}

export interface WorkflowOrgStorageStat {
  orgId: string;
  storageTotalBytes: number;
  totalAttachments: number;
}

const withIdempotency = (key?: string) =>
  key ? { headers: { 'Idempotency-Key': key } } : undefined;

export const workflowsApi = {
  stats: (signal?: AbortSignal) =>
    apiClient.get<WorkflowStats>('/workflows/stats', { signal }).then((r) => r.data),

  storagePerOrg: (signal?: AbortSignal) =>
    apiClient
      .get<WorkflowOrgStorageStat[]>('/workflows/admin/storage-per-org', { signal })
      .then((r) => r.data),

  list: (params?: ListWorkflowsParams, signal?: AbortSignal) =>
    apiClient.get<PaginatedWorkflows>('/workflows', { params, signal }).then((r) => r.data),

  getById: (id: string, signal?: AbortSignal) =>
    apiClient.get<ApiWorkflow>(`/workflows/${id}`, { signal }).then((r) => r.data),

  create: (dto: CreateWorkflowDto) =>
    apiClient.post<ApiWorkflow>('/workflows', dto).then((r) => r.data),

  update: (id: string, dto: UpdateWorkflowDto) =>
    apiClient.patch<ApiWorkflow>(`/workflows/${id}`, dto).then((r) => r.data),

  remove: (id: string) => apiClient.delete<void>(`/workflows/${id}`).then((r) => r.data),

  myTasks: (signal?: AbortSignal) =>
    apiClient.get<ApiWorkflow[]>('/workflows/my-tasks', { signal }).then((r) => r.data),

  myAvailable: (signal?: AbortSignal) =>
    apiClient.get<ApiWorkflow[]>('/workflows/my-available', { signal }).then((r) => r.data),

  startApproval: (id: string, idempotencyKey?: string) =>
    apiClient
      .post<ApiWorkflow>(
        `/workflows/${id}/start-approval`,
        undefined,
        withIdempotency(idempotencyKey),
      )
      .then((r) => r.data),

  approve: (
    id: string,
    dto: {
      observations?: string;
      attachments?: ApiApprovalAttachment[];
    },
    idempotencyKey?: string,
  ) =>
    apiClient
      .post<ApiWorkflow>(`/workflows/${id}/approve`, dto, withIdempotency(idempotencyKey))
      .then((r) => r.data),

  reject: (id: string, dto: { observations: string }, idempotencyKey?: string) =>
    apiClient
      .post<ApiWorkflow>(`/workflows/${id}/reject`, dto, withIdempotency(idempotencyKey))
      .then((r) => r.data),

  getTimeline: (id: string, signal?: AbortSignal) =>
    apiClient.get<ApiTimelineEvent[]>(`/workflows/${id}/timeline`, { signal }).then((r) => r.data),

  // Same access check as getting the workflow itself (WORKFLOWS:READ) — no
  // AUDIT:READ required, see workflows.controller.ts#getAuditLog.
  getAuditLog: (id: string, signal?: AbortSignal) =>
    apiClient.get<AuditLogEntry[]>(`/workflows/${id}/audit-log`, { signal }).then((r) => r.data),

  notifyNoFinalUsers: (dto: { typologyId: string; typologyName: string; recipientIds: string[] }) =>
    apiClient.post<void>('/workflows/notify-no-final-users', dto).then((r) => r.data),

  createAdminCycle: (
    id: string,
    dto: {
      steps: Array<{ userId: string; stepOrder: number }>;
      allowedOptionalReviewerIds?: string[];
    },
    idempotencyKey?: string,
  ) =>
    apiClient
      .post<ApiAdminCycle>(`/workflows/${id}/admin-cycles`, dto, withIdempotency(idempotencyKey))
      .then((r) => r.data),

  completeAdminStep: (
    id: string,
    cycleId: string,
    stepId: string,
    dto: {
      notes?: string;
      attachments?: Array<{
        storageKey: string;
        originalName: string;
        mimeType: string;
        fileSizeBytes?: number;
      }>;
    },
    idempotencyKey?: string,
  ) =>
    apiClient
      .patch(
        `/workflows/${id}/admin-cycles/${cycleId}/steps/${stepId}/complete`,
        dto,
        withIdempotency(idempotencyKey),
      )
      .then((r) => r.data),

  skipReviewCycle: (id: string, idempotencyKey?: string) =>
    apiClient
      .post<ApiWorkflow>(
        `/workflows/${id}/skip-review-cycle`,
        undefined,
        withIdempotency(idempotencyKey),
      )
      .then((r) => r.data),

  forwardAdminStep: (
    id: string,
    cycleId: string,
    stepId: string,
    dto: {
      optionalReviewerId: string;
      notes?: string;
      attachments?: Array<{
        storageKey: string;
        originalName: string;
        mimeType: string;
        fileSizeBytes?: number;
      }>;
    },
    idempotencyKey?: string,
  ) =>
    apiClient
      .post<ApiAdminStep>(
        `/workflows/${id}/admin-cycles/${cycleId}/steps/${stepId}/forward`,
        dto,
        withIdempotency(idempotencyKey),
      )
      .then((r) => r.data),
};
