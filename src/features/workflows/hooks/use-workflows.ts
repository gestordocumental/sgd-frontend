import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
  const { t } = useTranslation();
  const dialogs = useWorkflowDialogs();
  const extraction = useDocumentExtraction(companyId);
  const forms = useWorkflowForms();

  // Reopens the detail dialog for the workflow that was open right before the
  // user navigated to a secondary dialog from its footer — a no-op if that
  // secondary dialog was instead opened from somewhere else (e.g. the table
  // row menu), since returnToDetailWorkflow stays null in that case.
  const returnToDetailIfPending = () => {
    if (dialogs.returnToDetailWorkflow) {
      const workflow = dialogs.returnToDetailWorkflow;
      dialogs.setReturnToDetailWorkflow(null);
      dialogs.setDetailWorkflow(workflow);
    }
  };

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
      // Reopens detail with the fresh, just-saved workflow — not the stale
      // one returnToDetailIfPending would use — so the flag is only cleared
      // here, never handed to that helper.
      dialogs.setReturnToDetailWorkflow(null);
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
      returnToDetailIfPending();
    },
    onRejectSuccess: () => {
      dialogs.setRejectWorkflow(null);
      forms.rejectForm.reset();
      returnToDetailIfPending();
    },
    onAdminCycleSuccess: () => {
      dialogs.setReviewCycleWorkflow(null);
      dialogs.setReviewCycleReviewerIds([]);
      dialogs.setReviewCycleOptionalIds(new Set());
      returnToDetailIfPending();
    },
    onSkipCycleSuccess: () => {
      dialogs.setReviewCycleWorkflow(null);
      dialogs.setReviewCycleReviewerIds([]);
      dialogs.setReviewCycleOptionalIds(new Set());
      returnToDetailIfPending();
    },
    onSkipCycleError: () => {
      toast.error(t('workflows.dialogs.skipCycleError'));
    },
    onCompleteStepSuccess: () => {
      dialogs.setCompleteStepWorkflow(null);
      dialogs.setCompleteStepFiles([]);
      dialogs.setCompleteStepNotes('');
      returnToDetailIfPending();
    },
    onForwardStepSuccess: () => {
      dialogs.setForwardStepWorkflow(null);
      dialogs.setForwardStepOptionalId('');
      dialogs.setForwardStepNotes('');
      dialogs.setForwardStepFiles([]);
      returnToDetailIfPending();
    },
    onCloseSuccess: () => {
      dialogs.setCloseWorkflow(null);
      dialogs.setClosingNotes('');
      returnToDetailIfPending();
    },
    onAddNoteSuccess: () => {
      dialogs.setManageWorkflow(null);
      dialogs.setManageContent('');
      dialogs.setManageFiles([]);
      returnToDetailIfPending();
    },
  });

  // Closes the detail dialog to open a secondary one from its footer (view
  // timeline, edit, approve, reject, review cycle, complete/forward step),
  // remembering the workflow so the secondary dialog's close path can bring
  // detail back up — see returnToDetailIfPending.
  const navigateFromDetail = (action: () => void) => {
    if (dialogs.detailWorkflow) dialogs.setReturnToDetailWorkflow(dialogs.detailWorkflow);
    dialogs.setDetailWorkflow(null);
    action();
  };

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

  const openClose = (workflow: ApiWorkflow) => {
    dialogs.setClosingNotes('');
    dialogs.setCloseWorkflow(workflow);
  };

  const openManage = (workflow: ApiWorkflow) => {
    dialogs.setManageContent('');
    dialogs.setManageFiles([]);
    dialogs.setManageWorkflow(workflow);
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
      // Shows the cached row instantly. Its `.id` feeds `detailWorkflowId`
      // below, which reactively fetches GET /workflows/:id (detailWorkflowFull)
      // and takes priority once it resolves — that's how the exposed
      // detailWorkflow ends up with participantNames even when opened from
      // a list row that never carries them itself.
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
      // Override: each dialog closes itself by calling its setter with null
      // (Cancel button, backdrop click, or Radix's onOpenChange) — routing
      // that through here means every one of those close paths also reopens
      // detail when it was the one navigated away from, with no changes
      // needed in the individual dialog components themselves.
      setApproveWorkflow: (workflow: ApiWorkflow | null) => {
        dialogs.setApproveWorkflow(workflow);
        if (workflow === null) returnToDetailIfPending();
      },
      setRejectWorkflow: (workflow: ApiWorkflow | null) => {
        dialogs.setRejectWorkflow(workflow);
        if (workflow === null) returnToDetailIfPending();
      },
      setTimelineWorkflowId: (workflowId: string | null) => {
        dialogs.setTimelineWorkflowId(workflowId);
        if (workflowId === null) returnToDetailIfPending();
      },
      setEditWorkflow: (workflow: ApiWorkflow | null) => {
        dialogs.setEditWorkflow(workflow);
        if (workflow === null) returnToDetailIfPending();
      },
      setReviewCycleWorkflow: (workflow: ApiWorkflow | null) => {
        dialogs.setReviewCycleWorkflow(workflow);
        if (workflow === null) returnToDetailIfPending();
      },
      setCompleteStepWorkflow: (workflow: ApiWorkflow | null) => {
        dialogs.setCompleteStepWorkflow(workflow);
        if (workflow === null) returnToDetailIfPending();
      },
      setForwardStepWorkflow: (workflow: ApiWorkflow | null) => {
        dialogs.setForwardStepWorkflow(workflow);
        if (workflow === null) returnToDetailIfPending();
      },
      setCloseWorkflow: (workflow: ApiWorkflow | null) => {
        dialogs.setCloseWorkflow(workflow);
        if (workflow === null) returnToDetailIfPending();
      },
      setManageWorkflow: (workflow: ApiWorkflow | null) => {
        dialogs.setManageWorkflow(workflow);
        if (workflow === null) returnToDetailIfPending();
      },
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
      adminEligibleUsers: queries.adminEligibleUsers,
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
      openClose,
      openManage,
      navigateFromDetail,
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
