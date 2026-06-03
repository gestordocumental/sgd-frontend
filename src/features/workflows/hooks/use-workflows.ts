import { useMemo, useCallback, useEffect, useRef } from 'react';
import { workflowsApi, type ApiWorkflow } from '@/lib/api/workflows';
import { useWorkflowDialogs } from './use-workflow-dialogs';
import { useDocumentExtraction } from './use-document-extraction';
import { useWorkflowForms } from './use-workflow-forms';
import { useWorkflowQueries } from './use-workflow-queries';
import { useWorkflowMutations } from './use-workflow-mutations';
import type { DocumentComparison } from './workflow-schemas';

// Re-export shared types so consumers keep a single import point
export type {
  CreateWorkflowForm,
  ApproveForm,
  RejectForm,
  WorkflowsInnerTab,
  ExtractionResult,
  DocumentComparison,
} from './workflow-schemas';

export function useWorkflows(companyId: string) {
  const dialogs = useWorkflowDialogs();
  const extraction = useDocumentExtraction(companyId);
  const forms = useWorkflowForms();

  const queries = useWorkflowQueries(companyId, {
    statusFilter: dialogs.statusFilter,
    search: dialogs.search,
    page: dialogs.page,
    innerTab: dialogs.innerTab,
    detailWorkflowId: dialogs.detailWorkflow?.id,
    timelineWorkflowId: dialogs.timelineWorkflowId,
    createOpen: dialogs.createOpen,
    editWorkflowOpen: !!dialogs.editWorkflow,
    reviewCycleOpen: !!dialogs.reviewCycleWorkflow,
  });

  const mutations = useWorkflowMutations(companyId, {
    invalidateAll: queries.invalidateAll,
    approveAttachmentFiles: dialogs.approveAttachmentFiles,
    onCreateSuccess: () => {
      dialogs.setCreateOpen(false);
      forms.createForm.reset();
      dialogs.setSelectedTypologyId('');
      dialogs.setApproverIds([]);
      dialogs.setFinalUserIds([]);
      dialogs.setCreateError(null);
      extraction.reset();
      dialogs.setSupportingFiles([]);
    },
    onUpdateSuccess: (updated) => {
      dialogs.setDetailWorkflow(updated);
      dialogs.setEditWorkflow(null);
      dialogs.setEditApproverIds([]);
      dialogs.setEditDocumentFile(null);
      dialogs.setEditSupportingFiles([]);
      dialogs.setEditExistingAttachments([]);
      dialogs.setEditFinalUserId(null);
    },
    onDeleteSuccess: () => {
      dialogs.setDeleteWorkflow(null);
    },
    onApproveSuccess: () => {
      dialogs.setApproveWorkflow(null);
      dialogs.setApproveAttachmentFiles([]);
      forms.approveForm.reset();
    },
    onRejectSuccess: () => {
      dialogs.setRejectWorkflow(null);
      forms.rejectForm.reset();
    },
    onAdminCycleSuccess: () => {
      dialogs.setReviewCycleWorkflow(null);
      dialogs.setReviewCycleReviewerIds([]);
      dialogs.setReviewCycleOptionalIds(new Set());
    },
    onSkipCycleSuccess: () => {
      dialogs.setReviewCycleWorkflow(null);
    },
    onCompleteStepSuccess: () => {
      dialogs.setCompleteStepWorkflow(null);
      dialogs.setCompleteStepFiles([]);
      dialogs.setCompleteStepNotes('');
    },
    onForwardStepSuccess: () => {
      dialogs.setForwardStepWorkflow(null);
      dialogs.setForwardStepOptionalId('');
      dialogs.setForwardStepNotes('');
      dialogs.setForwardStepFiles([]);
    },
  });

  // ── Open helpers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    forms.createForm.reset({ title: '', description: '' });
    dialogs.setSelectedTypologyId('');
    dialogs.setApproverIds([]);
    dialogs.setFinalUserIds([]);
    dialogs.setCreateError(null);
    extraction.reset();
    dialogs.setSupportingFiles([]);
    dialogs.setCreateOpen(true);
  };

  const openApprove = (workflow: ApiWorkflow) => {
    forms.approveForm.reset();
    dialogs.setApproveAttachmentFiles([]);
    dialogs.setApproveWorkflow(workflow);
  };

  const openReject = (workflow: ApiWorkflow) => {
    forms.rejectForm.reset();
    dialogs.setRejectWorkflow(workflow);
  };

  const openTimeline = (workflowId: string) => {
    dialogs.setTimelineWorkflowId(workflowId);
  };

  const openReviewCycle = (workflow: ApiWorkflow) => {
    dialogs.setReviewCycleReviewerIds([]);
    dialogs.setReviewCycleOptionalIds(new Set());
    dialogs.setReviewCycleWorkflow(workflow);
  };

  const openForwardStep = (workflow: ApiWorkflow) => {
    dialogs.setForwardStepOptionalId('');
    dialogs.setForwardStepNotes('');
    dialogs.setForwardStepFiles([]);
    dialogs.setForwardStepWorkflow(workflow);
  };

  const openCompleteStep = (workflow: ApiWorkflow) => {
    dialogs.setCompleteStepFiles([]);
    dialogs.setCompleteStepNotes('');
    dialogs.setCompleteStepWorkflow(workflow);
  };

  const openEdit = (workflow: ApiWorkflow) => {
    forms.editForm.reset({ title: workflow.title, description: workflow.description ?? '' });
    dialogs.setEditApproverIds(
      [...workflow.approvalSteps].sort((a, b) => a.stepOrder - b.stepOrder).map((s) => s.userId),
    );
    dialogs.setEditDocumentFile(null);
    dialogs.setEditSupportingFiles([]);
    dialogs.setEditExistingAttachments(
      (workflow.attachments ?? []).filter((a) => a.attachmentType === 'SUPPORTING'),
    );
    dialogs.setEditFinalUserId(workflow.finalUserIds?.[0] ?? null);
    dialogs.setEditWorkflow(workflow);
  };

  // ── Open detail by ID (used from notification bell) ────────────────────────
  // Use a ref to access latest cached data without adding them as deps,
  // avoiding unnecessary recreation of the callback on every poll cycle.
  // ── Open detail by ID (used from notification bell) ────────────────────────
  // Everything accessed via ref so the callback is stable across poll cycles.
  // setDetailWorkflow is a useState setter — stable by contract — but the React
  // Compiler cannot verify that from dialogs alone, so we store it in the ref
  // alongside the query snapshots instead of wrapping it in a separate useCallback.
  const cachedRef = useRef({
    paginatedWorkflows: queries.paginatedWorkflows,
    myTasks: queries.myTasks,
    myAvailable: queries.myAvailable,
    setDetailWorkflow: dialogs.setDetailWorkflow,
  });

  useEffect(() => {
    cachedRef.current = {
      paginatedWorkflows: queries.paginatedWorkflows,
      myTasks: queries.myTasks,
      myAvailable: queries.myAvailable,
      setDetailWorkflow: dialogs.setDetailWorkflow,
    };
  }, [queries.paginatedWorkflows, queries.myTasks, queries.myAvailable, dialogs.setDetailWorkflow]);

  const openDetailById = useCallback(async (workflowId: string) => {
    const {
      paginatedWorkflows: pw,
      myTasks: mt,
      myAvailable: ma,
      setDetailWorkflow,
    } = cachedRef.current;
    const cached = [...(pw?.data ?? []), ...mt, ...ma].find((w) => w.id === workflowId);

    if (cached) {
      setDetailWorkflow(cached);
    } else {
      try {
        const workflow = await workflowsApi.getById(workflowId);
        setDetailWorkflow(workflow);
      } catch {
        /* ignore — detail simply won't open */
      }
    }
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const selectedTypology = useMemo(
    () => queries.activeTypologies.find((t) => t.id === dialogs.selectedTypologyId) ?? null,
    [queries.activeTypologies, dialogs.selectedTypologyId],
  );

  /**
   * Usuarios elegibles como usuarios finales: activos y que coincidan con la estructura
   * organizacional de la tipología seleccionada (departamento, área, cargo).
   */
  const finalUserEligibleUsers = useMemo(
    () =>
      selectedTypology
        ? queries.activeOrgUsers.filter((u) => {
            const org = selectedTypology.estructuraOrg;
            if (u.departamentoId !== org.departamentoId) return false;
            if (org.areaId !== null && u.areaId !== org.areaId) return false;
            if (org.cargoId !== null && u.cargoId !== org.cargoId) return false;
            return true;
          })
        : [],
    [selectedTypology, queries.activeOrgUsers],
  );

  /** Comparación campo a campo: true=coincide, false=no coincide, null=tipología sin valor declarado */
  const documentComparison: DocumentComparison | null = useMemo(
    () =>
      extraction.documentExtraction && selectedTypology
        ? {
            nombre:
              selectedTypology.datosDeclarados.nombre !== null
                ? extraction.documentExtraction.nombre === selectedTypology.datosDeclarados.nombre
                : null,
            codigo:
              selectedTypology.datosDeclarados.codigo !== null
                ? extraction.documentExtraction.codigo === selectedTypology.datosDeclarados.codigo
                : null,
            version:
              selectedTypology.datosDeclarados.version !== null
                ? extraction.documentExtraction.version === selectedTypology.datosDeclarados.version
                : null,
          }
        : null,
    [extraction.documentExtraction, selectedTypology],
  );

  /**
   * true cuando hay un documento cargado y algún campo no coincide con la tipología.
   * En ese caso el botón Crear debe estar bloqueado.
   */
  const createBlocked = useMemo(
    () =>
      extraction.documentExtractionLoading ||
      (documentComparison !== null && Object.values(documentComparison).some((v) => v === false)),
    [extraction.documentExtractionLoading, documentComparison],
  );

  // ── Submit handler ─────────────────────────────────────────────────────────
  const submitCreate = forms.createForm.handleSubmit((values) => {
    if (createBlocked) {
      dialogs.setCreateError('ERR_DOCUMENT_MISMATCH');
      return;
    }
    if (!dialogs.selectedTypologyId) {
      dialogs.setCreateError('ERR_NO_TYPOLOGY');
      return;
    }
    if (dialogs.approverIds.length === 0) {
      dialogs.setCreateError('ERR_NO_APPROVER');
      return;
    }
    if (dialogs.finalUserIds.length === 0) {
      dialogs.setCreateError('ERR_NO_FINAL_USER');
      return;
    }
    dialogs.setCreateError(null);
    mutations.createMutation.mutate({
      form: values,
      typologyId: dialogs.selectedTypologyId,
      approvers: dialogs.approverIds,
      mainFile: extraction.documentFile,
      supportingFilesToUpload: dialogs.supportingFiles,
      selectedFinalUserIds: dialogs.finalUserIds,
    });
  });

  return {
    // ── UI state per-dialog ────────────────────────────────────────────────────
    dialogs: {
      ...dialogs,
      // Override: expose the enriched version (with attachments) when available
      detailWorkflow: queries.detailWorkflowFull ?? dialogs.detailWorkflow,
    },

    // ── Server data (queries + derived) ───────────────────────────────────────
    queries: {
      workflows: queries.paginatedWorkflows?.data ?? [],
      workflowsTotal: queries.paginatedWorkflows?.total ?? 0,
      workflowsTotalPages: queries.workflowsTotalPages,
      workflowsLoading: queries.workflowsLoading,
      myTasks: queries.myTasks,
      myTasksLoading: queries.myTasksLoading,
      myAvailable: queries.myAvailable,
      myAvailableLoading: queries.myAvailableLoading,
      isRefreshing: queries.isRefreshing,
      workflowsDataUpdatedAt: queries.workflowsDataUpdatedAt,
      invalidateAll: queries.invalidateAll,
      timeline: queries.timeline,
      timelineLoading: queries.timelineLoading,
      activeTypologies: queries.activeTypologies,
      orgUsersMap: queries.orgUsersMap,
      activeOrgUsers: queries.activeOrgUsers,
      approverEligibleUsers: queries.approverEligibleUsers,
      finalUserEligibleUsers,
    },

    // ── Server mutations ───────────────────────────────────────────────────────
    mutations,

    // ── Forms + submit logic ───────────────────────────────────────────────────
    forms: {
      createForm: forms.createForm,
      submitCreate,
      editForm: forms.editForm,
      approveForm: forms.approveForm,
      rejectForm: forms.rejectForm,
    },

    // ── Coordinated open/close actions (combine dialog + form resets) ──────────
    actions: {
      openCreate,
      openDetailById,
      openApprove,
      openReject,
      openTimeline,
      openEdit,
      openReviewCycle,
      openCompleteStep,
      openForwardStep,
    },

    // ── Document extraction + cross-cutting derived state ──────────────────────
    extraction: {
      documentFile: extraction.documentFile,
      documentExtraction: extraction.documentExtraction,
      documentExtractionLoading: extraction.documentExtractionLoading,
      documentExtractionError: extraction.documentExtractionError,
      handleDocumentFile: extraction.handleDocumentFile,
      documentComparison,
      createBlocked,
    },
  };
}
