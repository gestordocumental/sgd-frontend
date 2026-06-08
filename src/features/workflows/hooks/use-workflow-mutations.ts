import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi, type ApiWorkflow, type ApiWorkflowAttachment } from '@/lib/api/workflows';
import { workflowFilesApi, type WorkflowFileUploadResponse } from '@/lib/api/workflow-files';
import type { CreateWorkflowForm, ApproveForm, RejectForm } from './workflow-schemas';

export interface WorkflowMutationDeps {
  invalidateAll: () => void;
  /** Files to upload when approving (read from dialog state) */
  approveAttachmentFiles: File[];
  onCreateSuccess: () => void;
  onUpdateSuccess: (updated: ApiWorkflow) => void;
  onDeleteSuccess: () => void;
  onApproveSuccess: () => void;
  onRejectSuccess: () => void;
  onAdminCycleSuccess: () => void;
  onSkipCycleSuccess: () => void;
  onSkipCycleError: () => void;
  onCompleteStepSuccess: () => void;
  onForwardStepSuccess: () => void;
}

export function useWorkflowMutations(companyId: string, deps: WorkflowMutationDeps) {
  const queryClient = useQueryClient();
  // Use a ref so the useMutation instances are created once and always call the
  // latest version of each callback without being recreated on every render.
  const depsRef = useRef(deps);

  useEffect(() => {
    depsRef.current = deps;
  }, [deps]);

  const createMutation = useMutation({
    mutationFn: async ({
      form,
      typologyId,
      approvers,
      mainFile,
      supportingFilesToUpload,
      selectedFinalUserIds,
    }: {
      form: CreateWorkflowForm;
      typologyId: string;
      approvers: string[];
      mainFile: File | null;
      supportingFilesToUpload: File[];
      selectedFinalUserIds: string[];
    }) => {
      let mainDocument: WorkflowFileUploadResponse | undefined;
      if (mainFile) {
        mainDocument = await workflowFilesApi.upload(companyId, mainFile);
      }
      const attachments: WorkflowFileUploadResponse[] = await Promise.all(
        supportingFilesToUpload.map((f) => workflowFilesApi.upload(companyId, f)),
      );
      return workflowsApi.create({
        title: form.title,
        description: form.description,
        typologyId,
        approvers: approvers.map((userId, i) => ({ userId, stepOrder: i + 1 })),
        mainDocument,
        attachments: attachments.length > 0 ? attachments : undefined,
        finalUserIds: selectedFinalUserIds,
      });
    },
    onSuccess: () => {
      depsRef.current.invalidateAll();
      depsRef.current.onCreateSuccess();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
      mainFile,
      supportingFilesToUpload,
      newFinalUserId,
      existingAttachments,
      originalAttachmentCount,
    }: {
      id: string;
      dto: {
        title?: string;
        description?: string;
        approvers?: { userId: string; stepOrder: number }[];
      };
      mainFile: File | null;
      supportingFilesToUpload: File[];
      newFinalUserId: string | null;
      existingAttachments: ApiWorkflowAttachment[];
      originalAttachmentCount: number;
    }) => {
      let mainDocument: WorkflowFileUploadResponse | undefined;
      if (mainFile) {
        mainDocument = await workflowFilesApi.upload(companyId, mainFile);
      }
      const newlyUploaded: WorkflowFileUploadResponse[] = await Promise.all(
        supportingFilesToUpload.map((f) => workflowFilesApi.upload(companyId, f)),
      );

      // Solo enviar attachments si hubo cambios (se eliminó alguno o se añadió uno nuevo)
      const attachmentsChanged =
        existingAttachments.length !== originalAttachmentCount || newlyUploaded.length > 0;

      const toFileRef = (a: {
        storageKey: string;
        originalName: string;
        mimeType: string;
        fileSizeBytes?: number | null;
      }) => ({
        storageKey: a.storageKey,
        originalName: a.originalName,
        mimeType: a.mimeType,
        ...(typeof a.fileSizeBytes === 'number' && { fileSizeBytes: a.fileSizeBytes }),
      });

      const attachmentsToSend = attachmentsChanged
        ? [...existingAttachments.map(toFileRef), ...newlyUploaded.map(toFileRef)]
        : undefined;

      return workflowsApi.update(id, {
        ...dto,
        mainDocument,
        attachments: attachmentsToSend,
        finalUserIds: newFinalUserId ? [newFinalUserId] : undefined,
      });
    },
    onSuccess: (updated) => {
      depsRef.current.invalidateAll();
      queryClient.setQueryData(['workflow', updated.id], updated);
      depsRef.current.onUpdateSuccess(updated);
    },
  });

  const notifyNoFinalUsersMutation = useMutation({
    mutationFn: (dto: { typologyId: string; typologyName: string; recipientIds: string[] }) =>
      workflowsApi.notifyNoFinalUsers(dto),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.remove(id),
    onSuccess: () => {
      depsRef.current.invalidateAll();
      depsRef.current.onDeleteSuccess();
    },
  });

  const startApprovalMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.startApproval(id, crypto.randomUUID()),
    onSuccess: (updated) => {
      depsRef.current.invalidateAll();
      queryClient.setQueryData(['workflow', updated.id], updated);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: ApproveForm }) => {
      const idempotencyKey = crypto.randomUUID();
      const attachments = await Promise.all(
        depsRef.current.approveAttachmentFiles.map((file) =>
          workflowFilesApi.upload(companyId, file),
        ),
      );
      return workflowsApi.approve(
        id,
        {
          ...dto,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        idempotencyKey,
      );
    },
    onSuccess: () => {
      depsRef.current.invalidateAll();
      depsRef.current.onApproveSuccess();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RejectForm }) =>
      workflowsApi.reject(id, dto, crypto.randomUUID()),
    onSuccess: () => {
      depsRef.current.invalidateAll();
      depsRef.current.onRejectSuccess();
    },
  });

  const createAdminCycleMutation = useMutation({
    mutationFn: ({
      id,
      reviewerIds,
      optionalReviewerIds,
    }: {
      id: string;
      reviewerIds: string[];
      optionalReviewerIds?: string[];
    }) =>
      workflowsApi.createAdminCycle(
        id,
        {
          steps: reviewerIds.map((userId, i) => ({ userId, stepOrder: i + 1 })),
          allowedOptionalReviewerIds: optionalReviewerIds?.length ? optionalReviewerIds : undefined,
        },
        crypto.randomUUID(),
      ),
    onSuccess: (_, { id }) => {
      depsRef.current.invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      depsRef.current.onAdminCycleSuccess();
    },
  });

  const skipReviewCycleMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.skipReviewCycle(id, crypto.randomUUID()),
    onSuccess: (_, id) => {
      depsRef.current.invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      depsRef.current.onSkipCycleSuccess();
    },
    onError: () => {
      depsRef.current.onSkipCycleError();
    },
  });

  const completeStepMutation = useMutation({
    mutationFn: async ({
      workflow,
      notes,
      files,
    }: {
      workflow: ApiWorkflow;
      notes: string;
      files: File[];
    }) => {
      const cycle = workflow.activeAdminCycle;
      if (!cycle) throw new Error('No hay ciclo de revisión activo');
      const currentStep =
        cycle.steps.find((s) => s.stepOrder === cycle.currentStepOrder && s.status === 'PENDING') ??
        cycle.steps.find((s) => s.status === 'PENDING');
      if (!currentStep) throw new Error('No hay paso pendiente en el ciclo');
      const uploadedAttachments = await Promise.all(
        files.map((f) => workflowFilesApi.upload(workflow.orgId, f)),
      );
      return workflowsApi.completeAdminStep(
        workflow.id,
        cycle.id,
        currentStep.id,
        {
          notes: notes.trim() || undefined,
          attachments:
            uploadedAttachments.length > 0
              ? uploadedAttachments.map((a) => ({
                  storageKey: a.storageKey,
                  originalName: a.originalName,
                  mimeType: a.mimeType,
                  ...(typeof a.fileSizeBytes === 'number' && { fileSizeBytes: a.fileSizeBytes }),
                }))
              : undefined,
        },
        crypto.randomUUID(),
      );
    },
    onSuccess: () => {
      depsRef.current.invalidateAll();
      depsRef.current.onCompleteStepSuccess();
    },
  });

  const forwardStepMutation = useMutation({
    mutationFn: async ({
      workflow,
      optionalReviewerId,
      notes,
      files,
    }: {
      workflow: ApiWorkflow;
      optionalReviewerId: string;
      notes: string;
      files: File[];
    }) => {
      const cycle = workflow.activeAdminCycle;
      if (!cycle) throw new Error('No hay ciclo de revisión activo');
      const currentStep =
        cycle.steps.find((s) => s.stepOrder === cycle.currentStepOrder && s.status === 'PENDING') ??
        cycle.steps.find((s) => s.status === 'PENDING');
      if (!currentStep) throw new Error('No hay paso pendiente en el ciclo');
      const uploadedAttachments = await Promise.all(
        files.map((f) => workflowFilesApi.upload(workflow.orgId, f)),
      );
      return workflowsApi.forwardAdminStep(
        workflow.id,
        cycle.id,
        currentStep.id,
        {
          optionalReviewerId,
          notes: notes.trim() || undefined,
          attachments:
            uploadedAttachments.length > 0
              ? uploadedAttachments.map((a) => ({
                  storageKey: a.storageKey,
                  originalName: a.originalName,
                  mimeType: a.mimeType,
                  ...(typeof a.fileSizeBytes === 'number' && { fileSizeBytes: a.fileSizeBytes }),
                }))
              : undefined,
        },
        crypto.randomUUID(),
      );
    },
    onSuccess: () => {
      depsRef.current.invalidateAll();
      depsRef.current.onForwardStepSuccess();
    },
  });

  return {
    createMutation,
    updateMutation,
    notifyNoFinalUsersMutation,
    deleteMutation,
    startApprovalMutation,
    approveMutation,
    rejectMutation,
    createAdminCycleMutation,
    skipReviewCycleMutation,
    completeStepMutation,
    forwardStepMutation,
  };
}
