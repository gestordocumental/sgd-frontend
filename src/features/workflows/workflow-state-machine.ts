import type { ApiWorkflow, WorkflowStatus } from '@/lib/api/workflows';

/**
 * Tabla centralizada de transiciones de estado válidas (espejo del backend).
 * Permite derivar qué acciones son posibles en un estado dado sin hardcodear
 * comparaciones de strings en múltiples componentes.
 */
export const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['PENDING_REVIEW_CYCLE', 'REJECTED'],
  RETURNED_TO_CREATOR: ['PENDING_APPROVAL'],
  REJECTED: [],
  PENDING_REVIEW_CYCLE: ['ADMIN_CYCLE_IN_PROGRESS', 'AVAILABLE_FOR_FINAL_USERS'],
  AVAILABLE_FOR_FINAL_USERS: ['ADMIN_CYCLE_IN_PROGRESS', 'CLOSED'],
  ADMIN_CYCLE_IN_PROGRESS: ['AVAILABLE_FOR_FINAL_USERS'],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransitionTo(current: WorkflowStatus, next: WorkflowStatus): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export interface WorkflowActionContext {
  /** ID del usuario autenticado (del JWT decodificado o del store de auth) */
  userId: string | undefined;
  /** El usuario tiene permiso de escritura (crear/editar workflows) */
  canWrite?: boolean;
  /** El usuario tiene permiso de aprobación */
  canApprove?: boolean;
  /** La empresa tiene habilitado el ciclo de revisión administrativo (default: true) */
  reviewCycleEnabled?: boolean;
}

/**
 * Calcula qué acciones puede ejecutar un usuario sobre un workflow dado.
 * Centraliza la lógica dispersa en WorkflowsTable y DetailWorkflowDialog,
 * usando VALID_TRANSITIONS como fuente de verdad para las guardas de estado.
 */
export function getWorkflowActions(workflow: ApiWorkflow, ctx: WorkflowActionContext) {
  const { userId, canWrite = false, canApprove = false, reviewCycleEnabled = true } = ctx;
  const isCreator = workflow.createdBy === userId;
  const isFinalUser = workflow.finalUserIds?.includes(userId ?? '') ?? false;
  const isCurrentApprover = workflow.currentAssignedUserId === userId;

  const activeCycle = workflow.activeAdminCycle;
  const pendingStep = activeCycle?.steps.find((s) => s.status === 'PENDING');

  return {
    /** Creador puede iniciar aprobación solo desde DRAFT */
    canStartApproval: isCreator && canTransitionTo(workflow.status, 'PENDING_APPROVAL'),

    /** Solo creador puede borrar workflows en DRAFT o CANCELLED */
    canDelete:
      canWrite && isCreator && (workflow.status === 'DRAFT' || workflow.status === 'CANCELLED'),

    /** El aprobador actual puede aprobar/rechazar solo en PENDING_APPROVAL */
    canApproveStep: canApprove && isCurrentApprover && workflow.status === 'PENDING_APPROVAL',

    /** Un usuario final puede iniciar ciclo admin solo desde PENDING_REVIEW_CYCLE,
     *  y solo si la empresa tiene el ciclo de revisión habilitado.
     *  En AVAILABLE_FOR_FINAL_USERS el documento ya fue publicado y no corresponde
     *  mostrar "Iniciar revisión" aunque la transición técnica exista en el backend. */
    canStartReviewCycle:
      reviewCycleEnabled && isFinalUser && workflow.status === 'PENDING_REVIEW_CYCLE',

    /** El usuario asignado al paso actual puede completarlo en ADMIN_CYCLE_IN_PROGRESS */
    canCompleteAdminStep: workflow.status === 'ADMIN_CYCLE_IN_PROGRESS' && isCurrentApprover,

    /** Completar + hay revisores opcionales disponibles + el paso actual no es opcional */
    canForwardAdminStep:
      workflow.status === 'ADMIN_CYCLE_IN_PROGRESS' &&
      isCurrentApprover &&
      !!pendingStep &&
      !pendingStep.isOptional &&
      (activeCycle?.allowedOptionalReviewerIds?.length ?? 0) > 0,
  };
}
