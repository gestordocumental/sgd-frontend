import { useState, useCallback } from 'react';
import type { ApiWorkflow, ApiWorkflowAttachment, WorkflowStatus } from '@/lib/api/workflows';
import type { WorkflowsInnerTab } from './workflow-schemas';

export function useWorkflowDialogs() {
  // ── Create dialog ──────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTypologyId, setSelectedTypologyId] = useState('');
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [finalUserIds, setFinalUserIds] = useState<string[]>([]);

  // ── Approve dialog ─────────────────────────────────────────────────────────
  const [approveWorkflow, setApproveWorkflow] = useState<ApiWorkflow | null>(null);
  const [approveAttachmentFiles, setApproveAttachmentFiles] = useState<File[]>([]);

  // ── Reject dialog ──────────────────────────────────────────────────────────
  const [rejectWorkflow, setRejectWorkflow] = useState<ApiWorkflow | null>(null);

  // ── Detail / timeline / delete dialogs ─────────────────────────────────────
  const [detailWorkflow, setDetailWorkflow] = useState<ApiWorkflow | null>(null);
  const [timelineWorkflowId, setTimelineWorkflowId] = useState<string | null>(null);
  const [deleteWorkflow, setDeleteWorkflow] = useState<ApiWorkflow | null>(null);

  // Set right before a secondary dialog (timeline, approve, reject, edit...) is
  // opened from the detail dialog's footer, so closing that secondary dialog
  // (however it closes — Cancel, backdrop click, or a successful submit) can
  // bring the detail dialog back up. Left null when a dialog is opened from
  // anywhere else (e.g. the table row menu), so nothing reopens in that case.
  const [returnToDetailWorkflow, setReturnToDetailWorkflow] = useState<ApiWorkflow | null>(null);

  // ── Edit dialog ────────────────────────────────────────────────────────────
  const [editWorkflow, setEditWorkflow] = useState<ApiWorkflow | null>(null);
  const [editApproverIds, setEditApproverIds] = useState<string[]>([]);
  const [editDocumentFile, setEditDocumentFile] = useState<File | null>(null);
  const [editSupportingFiles, setEditSupportingFiles] = useState<File[]>([]);
  const [editExistingAttachments, setEditExistingAttachments] = useState<ApiWorkflowAttachment[]>(
    [],
  );
  const [editFinalUserId, setEditFinalUserId] = useState<string | null>(null);

  // ── List filters + server-side pagination ─────────────────────────────────
  const [statusFilter, setStatusFilterRaw] = useState<WorkflowStatus | undefined>(undefined);
  const [search, setSearchRaw] = useState('');
  const [page, setPage] = useState(1);
  const [innerTab, setInnerTab] = useState<WorkflowsInnerTab>('all');

  const setStatusFilter = useCallback((v: WorkflowStatus | undefined) => {
    setStatusFilterRaw(v);
    setPage(1);
  }, []);

  const setSearch = useCallback((v: string) => {
    setSearchRaw(v);
    setPage(1);
  }, []);

  // ── Review cycle dialog ────────────────────────────────────────────────────
  const [reviewCycleWorkflow, setReviewCycleWorkflow] = useState<ApiWorkflow | null>(null);
  const [reviewCycleReviewerIds, setReviewCycleReviewerIds] = useState<string[]>([]);
  const [reviewCycleOptionalIds, setReviewCycleOptionalIds] = useState<Set<string>>(new Set());

  // ── Complete step dialog ───────────────────────────────────────────────────
  const [completeStepWorkflow, setCompleteStepWorkflow] = useState<ApiWorkflow | null>(null);
  const [completeStepFiles, setCompleteStepFiles] = useState<File[]>([]);
  const [completeStepNotes, setCompleteStepNotes] = useState('');

  // ── Forward step dialog ────────────────────────────────────────────────────
  const [forwardStepWorkflow, setForwardStepWorkflow] = useState<ApiWorkflow | null>(null);
  const [forwardStepOptionalId, setForwardStepOptionalId] = useState('');
  const [forwardStepNotes, setForwardStepNotes] = useState('');
  const [forwardStepFiles, setForwardStepFiles] = useState<File[]>([]);

  // ── Close workflow dialog ──────────────────────────────────────────────────
  const [closeWorkflow, setCloseWorkflow] = useState<ApiWorkflow | null>(null);
  const [closingNotes, setClosingNotes] = useState('');

  // ── Cancel workflow dialog ─────────────────────────────────────────────────
  const [cancelWorkflow, setCancelWorkflow] = useState<ApiWorkflow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // ── Manage workflow dialog ("Gestionar") ───────────────────────────────────
  const [manageWorkflow, setManageWorkflow] = useState<ApiWorkflow | null>(null);
  const [manageContent, setManageContent] = useState('');
  const [manageFiles, setManageFiles] = useState<File[]>([]);

  // ── List helpers ───────────────────────────────────────────────────────────
  const addApprover = useCallback((userId: string) => {
    setApproverIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  }, []);

  const removeApprover = useCallback((userId: string) => {
    setApproverIds((prev) => prev.filter((id) => id !== userId));
  }, []);

  const addFinalUser = useCallback((userId: string) => {
    setFinalUserIds([userId]);
  }, []);

  const removeFinalUser = useCallback((userId: string) => {
    setFinalUserIds((prev) => prev.filter((id) => id !== userId));
  }, []);

  const addSupportingFile = useCallback((file: File) => {
    setSupportingFiles((prev) => [...prev, file]);
  }, []);

  const removeSupportingFile = useCallback((index: number) => {
    setSupportingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    // Create
    createOpen,
    setCreateOpen,
    selectedTypologyId,
    setSelectedTypologyId,
    approverIds,
    setApproverIds,
    createError,
    setCreateError,
    supportingFiles,
    setSupportingFiles,
    finalUserIds,
    setFinalUserIds,
    // Approve
    approveWorkflow,
    setApproveWorkflow,
    approveAttachmentFiles,
    setApproveAttachmentFiles,
    // Reject
    rejectWorkflow,
    setRejectWorkflow,
    // Detail / timeline / delete
    detailWorkflow,
    setDetailWorkflow,
    timelineWorkflowId,
    setTimelineWorkflowId,
    deleteWorkflow,
    setDeleteWorkflow,
    returnToDetailWorkflow,
    setReturnToDetailWorkflow,
    // Edit
    editWorkflow,
    setEditWorkflow,
    editApproverIds,
    setEditApproverIds,
    editDocumentFile,
    setEditDocumentFile,
    editSupportingFiles,
    setEditSupportingFiles,
    editExistingAttachments,
    setEditExistingAttachments,
    editFinalUserId,
    setEditFinalUserId,
    // Filters + pagination
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    innerTab,
    setInnerTab,
    // Review cycle
    reviewCycleWorkflow,
    setReviewCycleWorkflow,
    reviewCycleReviewerIds,
    setReviewCycleReviewerIds,
    reviewCycleOptionalIds,
    setReviewCycleOptionalIds,
    // Complete step
    completeStepWorkflow,
    setCompleteStepWorkflow,
    completeStepFiles,
    setCompleteStepFiles,
    completeStepNotes,
    setCompleteStepNotes,
    // Forward step
    forwardStepWorkflow,
    setForwardStepWorkflow,
    forwardStepOptionalId,
    setForwardStepOptionalId,
    forwardStepNotes,
    setForwardStepNotes,
    forwardStepFiles,
    setForwardStepFiles,
    // Close workflow
    closeWorkflow,
    setCloseWorkflow,
    closingNotes,
    setClosingNotes,
    // Cancel workflow
    cancelWorkflow,
    setCancelWorkflow,
    cancelReason,
    setCancelReason,
    // Manage workflow
    manageWorkflow,
    setManageWorkflow,
    manageContent,
    setManageContent,
    manageFiles,
    setManageFiles,
    // Helpers
    addApprover,
    removeApprover,
    addFinalUser,
    removeFinalUser,
    addSupportingFile,
    removeSupportingFile,
  };
}
