import { useState, useCallback, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { workflowsApi, type ApiWorkflow, type ApiWorkflowAttachment, type WorkflowStatus } from '@/lib/api/workflows'
import { typologiesApi } from '@/lib/api/typologies'
import { usersApi } from '@/lib/api/users'
import { rolesApi } from '@/lib/api/roles'
import { workflowFilesApi, type WorkflowFileUploadResponse } from '@/lib/api/workflow-files'

// ── Schemas ───────────────────────────────────────────────────────────────────

const createWorkflowSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres').max(500, 'Máximo 500 caracteres'),
  description: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
})

const approveSchema = z.object({
  observations: z.string().max(2000).optional(),
})

const rejectSchema = z.object({
  observations: z.string().min(10, 'Mínimo 10 caracteres').max(3000, 'Máximo 3000 caracteres'),
})

export type CreateWorkflowForm = z.infer<typeof createWorkflowSchema>
export type ApproveForm = z.infer<typeof approveSchema>
export type RejectForm = z.infer<typeof rejectSchema>

export type WorkflowsInnerTab = 'all' | 'my-tasks' | 'my-available'

export interface ExtractionResult {
  nombre: string | null
  codigo: string | null
  version: string | null
}

/** null = la tipología no tiene valor declarado para ese campo */
export interface DocumentComparison {
  nombre: boolean | null
  codigo: boolean | null
  version: boolean | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWorkflows(companyId: string) {
  const queryClient = useQueryClient()

  // ── Dialog / UI state ────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTypologyId, setSelectedTypologyId] = useState('')
  const [approverIds, setApproverIds] = useState<string[]>([])
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Document extraction state ─────────────────────────────────────────────
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentExtraction, setDocumentExtraction] = useState<ExtractionResult | null>(null)
  const [documentExtractionLoading, setDocumentExtractionLoading] = useState(false)
  const [documentExtractionError, setDocumentExtractionError] = useState<string | null>(null)

  // ── Supporting attachments state ──────────────────────────────────────────
  const [supportingFiles, setSupportingFiles] = useState<File[]>([])

  const [approveAttachmentFiles, setApproveAttachmentFiles] = useState<File[]>([])

  // ── Final users state ─────────────────────────────────────────────────────
  const [finalUserIds, setFinalUserIds] = useState<string[]>([])

  const [detailWorkflow, setDetailWorkflow] = useState<ApiWorkflow | null>(null)
  const [approveWorkflow, setApproveWorkflow] = useState<ApiWorkflow | null>(null)
  const [rejectWorkflow, setRejectWorkflow] = useState<ApiWorkflow | null>(null)
  const [timelineWorkflowId, setTimelineWorkflowId] = useState<string | null>(null)
  const [deleteWorkflow, setDeleteWorkflow] = useState<ApiWorkflow | null>(null)
  const [editWorkflow, setEditWorkflow] = useState<ApiWorkflow | null>(null)
  const [editApproverIds, setEditApproverIds] = useState<string[]>([])
  const [editDocumentFile, setEditDocumentFile] = useState<File | null>(null)
  const [editSupportingFiles, setEditSupportingFiles] = useState<File[]>([])
  const [editExistingAttachments, setEditExistingAttachments] = useState<ApiWorkflowAttachment[]>([])
  const [editFinalUserId, setEditFinalUserId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | undefined>(undefined)
  const [innerTab, setInnerTab] = useState<WorkflowsInnerTab>('all')

  // ── Review cycle state ────────────────────────────────────────────────────
  const [reviewCycleWorkflow, setReviewCycleWorkflow] = useState<ApiWorkflow | null>(null)
  const [reviewCycleReviewerIds, setReviewCycleReviewerIds] = useState<string[]>([])
  const [completeStepWorkflow, setCompleteStepWorkflow] = useState<ApiWorkflow | null>(null)
  const [completeStepFiles, setCompleteStepFiles] = useState<File[]>([])
  const [completeStepNotes, setCompleteStepNotes] = useState('')

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: paginatedWorkflows, isLoading: workflowsLoading, isFetching: workflowsIsFetching, dataUpdatedAt: workflowsUpdatedAt } = useQuery({
    queryKey: ['workflows', statusFilter],
    queryFn: () => workflowsApi.list({ status: statusFilter, limit: 50 }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    enabled: innerTab === 'all',
  })

  const { data: myTasks = [], isLoading: myTasksLoading, isFetching: myTasksIsFetching, dataUpdatedAt: myTasksUpdatedAt } = useQuery({
    queryKey: ['workflows-my-tasks'],
    queryFn: () => workflowsApi.myTasks(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  })

  const { data: myAvailable = [], isLoading: myAvailableLoading, isFetching: myAvailableIsFetching, dataUpdatedAt: myAvailableUpdatedAt } = useQuery({
    queryKey: ['workflows-my-available'],
    queryFn: () => workflowsApi.myAvailable(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  })

  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ['workflow-timeline', timelineWorkflowId],
    queryFn: () => workflowsApi.getTimeline(timelineWorkflowId!),
    staleTime: 30_000,
    enabled: !!timelineWorkflowId,
  })

  // Detalle completo (con adjuntos) cuando se abre el dialog de detalle
  const { data: detailWorkflowFull } = useQuery({
    queryKey: ['workflow', detailWorkflow?.id],
    queryFn: () => workflowsApi.getById(detailWorkflow!.id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !!detailWorkflow,
  })

  // Tipologías activas de la organización — para el selector del formulario
  const { data: typologies = [] } = useQuery({
    queryKey: ['typologies', companyId],
    queryFn: () => typologiesApi.list(companyId),
    staleTime: 60_000,
    enabled: !!companyId && createOpen,
  })

  // Usuarios de la organización — para el selector de aprobadores y resolución de nombres en detalle
  const { data: orgUsers = [] } = useQuery({
    queryKey: ['company-users', companyId],
    queryFn: () => usersApi.listUsersByOrg(companyId),
    staleTime: 60_000,
    enabled: !!companyId && (createOpen || !!detailWorkflow || !!timelineWorkflowId || !!editWorkflow),
  })

  // Roles con sus permisos — para filtrar aprobadores elegibles
  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles', companyId],
    queryFn: () => rolesApi.listRoles(companyId),
    staleTime: 60_000,
    enabled: !!companyId && (createOpen || !!editWorkflow),
  })

  // ── Invalidations ─────────────────────────────────────────────────────────
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['workflows'] })
    queryClient.invalidateQueries({ queryKey: ['workflows-my-tasks'] })
    queryClient.invalidateQueries({ queryKey: ['workflows-my-available'] })
  }, [queryClient])

  const isRefreshing = workflowsIsFetching || myTasksIsFetching || myAvailableIsFetching
  // Latest successful fetch across all three queries — changes once per fetch completion
  const workflowsDataUpdatedAt = Math.max(workflowsUpdatedAt, myTasksUpdatedAt, myAvailableUpdatedAt)

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async ({
      form,
      typologyId,
      approvers,
      mainFile,
      supportingFilesToUpload,
      selectedFinalUserIds,
    }: {
      form: CreateWorkflowForm
      typologyId: string
      approvers: string[]
      mainFile: File | null
      supportingFilesToUpload: File[]
      selectedFinalUserIds: string[]
    }) => {
      // 1. Subir documento principal si existe
      let mainDocument: WorkflowFileUploadResponse | undefined
      if (mainFile) {
        mainDocument = await workflowFilesApi.upload(companyId, mainFile)
      }

      // 2. Subir adjuntos de soporte
      const attachments: WorkflowFileUploadResponse[] = await Promise.all(
        supportingFilesToUpload.map((f) => workflowFilesApi.upload(companyId, f)),
      )

      // 3. Crear el workflow
      return workflowsApi.create({
        title:        form.title,
        description:  form.description,
        typologyId,
        approvers:    approvers.map((userId, i) => ({ userId, stepOrder: i + 1 })),
        mainDocument,
        attachments:  attachments.length > 0 ? attachments : undefined,
        finalUserIds: selectedFinalUserIds,
      })
    },
    onSuccess: () => {
      invalidateAll()
      setCreateOpen(false)
      createForm.reset()
      setSelectedTypologyId('')
      setApproverIds([])
      setFinalUserIds([])
      setCreateError(null)
      setDocumentFile(null)
      setDocumentExtraction(null)
      setDocumentExtractionError(null)
      setSupportingFiles([])
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id, dto, mainFile, supportingFilesToUpload, newFinalUserId,
      existingAttachments, originalAttachmentCount,
    }: {
      id: string
      dto: { title?: string; description?: string; approvers?: { userId: string; stepOrder: number }[] }
      mainFile: File | null
      supportingFilesToUpload: File[]
      newFinalUserId: string | null
      existingAttachments: ApiWorkflowAttachment[]
      originalAttachmentCount: number
    }) => {
      let mainDocument: WorkflowFileUploadResponse | undefined
      if (mainFile) {
        mainDocument = await workflowFilesApi.upload(companyId, mainFile)
      }

      const newlyUploaded: WorkflowFileUploadResponse[] = await Promise.all(
        supportingFilesToUpload.map((f) => workflowFilesApi.upload(companyId, f)),
      )

      // Solo enviar attachments si hubo cambios (se eliminó alguno o se añadió uno nuevo)
      const attachmentsChanged =
        existingAttachments.length !== originalAttachmentCount || newlyUploaded.length > 0

      const toFileRef = (a: { storageKey: string; originalName: string; mimeType: string; fileSizeBytes?: number | null }) => ({
        storageKey:    a.storageKey,
        originalName:  a.originalName,
        mimeType:      a.mimeType,
        ...(typeof a.fileSizeBytes === 'number' && { fileSizeBytes: a.fileSizeBytes }),
      })

      const attachmentsToSend = attachmentsChanged
        ? [
            ...existingAttachments.map(toFileRef),
            ...newlyUploaded.map(toFileRef),
          ]
        : undefined

      return workflowsApi.update(id, {
        ...dto,
        mainDocument,
        attachments: attachmentsToSend,
        finalUserIds: newFinalUserId ? [newFinalUserId] : undefined,
      })
    },
    onSuccess: (updated) => {
      invalidateAll()
      queryClient.setQueryData(['workflow', updated.id], updated)
      setDetailWorkflow(updated)
      setEditWorkflow(null)
      setEditApproverIds([])
      setEditDocumentFile(null)
      setEditSupportingFiles([])
      setEditExistingAttachments([])
      setEditFinalUserId(null)
    },
  })

  const notifyNoFinalUsersMutation = useMutation({
    mutationFn: (dto: { typologyId: string; typologyName: string; recipientIds: string[] }) =>
      workflowsApi.notifyNoFinalUsers(dto),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.remove(id),
    onSuccess: () => {
      invalidateAll()
      setDeleteWorkflow(null)
    },
  })

  const startApprovalMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.startApproval(id),
    onSuccess: (updated) => {
      invalidateAll()
      queryClient.setQueryData(['workflow', updated.id], updated)
    },
  })

  const approveMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: ApproveForm }) => {
      const attachments = await Promise.all(
        approveAttachmentFiles.map((file) => workflowFilesApi.upload(companyId, file)),
      )
      return workflowsApi.approve(id, {
        ...dto,
        attachments: attachments.length > 0 ? attachments : undefined,
      })
    },
    onSuccess: () => {
      invalidateAll()
      setApproveWorkflow(null)
      setApproveAttachmentFiles([])
      approveForm.reset()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RejectForm }) =>
      workflowsApi.reject(id, dto),
    onSuccess: () => {
      invalidateAll()
      setRejectWorkflow(null)
      rejectForm.reset()
    },
  })

  const createAdminCycleMutation = useMutation({
    mutationFn: ({ id, reviewerIds }: { id: string; reviewerIds: string[] }) =>
      workflowsApi.createAdminCycle(id, {
        steps: reviewerIds.map((userId, i) => ({ userId, stepOrder: i + 1 })),
      }),
    onSuccess: (_, { id }) => {
      invalidateAll()
      queryClient.invalidateQueries({ queryKey: ['workflow', id] })
      setReviewCycleWorkflow(null)
      setReviewCycleReviewerIds([])
    },
  })

  const skipReviewCycleMutation = useMutation({
    mutationFn: (id: string) => workflowsApi.skipReviewCycle(id),
    onSuccess: () => {
      invalidateAll()
      setReviewCycleWorkflow(null)
    },
  })

  const completeStepMutation = useMutation({
    mutationFn: async ({
      workflow, notes, files,
    }: { workflow: ApiWorkflow; notes: string; files: File[] }) => {
      const cycle = workflow.activeAdminCycle
      if (!cycle) throw new Error('No hay ciclo de revisión activo')
      const currentStep = cycle.steps.find((s) => s.status === 'PENDING')
      if (!currentStep) throw new Error('No hay paso pendiente en el ciclo')
      const uploadedAttachments = await Promise.all(
        files.map((f) => workflowFilesApi.upload(workflow.orgId, f)),
      )
      return workflowsApi.completeAdminStep(
        workflow.id,
        cycle.id,
        currentStep.id,
        {
          notes: notes.trim() || undefined,
          attachments: uploadedAttachments.length > 0 ? uploadedAttachments.map((a) => ({
            storageKey:   a.storageKey,
            originalName: a.originalName,
            mimeType:     a.mimeType,
            ...(typeof a.fileSizeBytes === 'number' && { fileSizeBytes: a.fileSizeBytes }),
          })) : undefined,
        },
      )
    },
    onSuccess: () => {
      invalidateAll()
      setCompleteStepWorkflow(null)
      setCompleteStepFiles([])
      setCompleteStepNotes('')
    },
  })

  // ── Forms ─────────────────────────────────────────────────────────────────
  const createForm = useForm<CreateWorkflowForm>({
    resolver: zodResolver(createWorkflowSchema),
    mode: 'onChange',
    defaultValues: { title: '', description: '' },
  })

  const approveForm = useForm<ApproveForm>({
    resolver: zodResolver(approveSchema),
    mode: 'onChange',
  })

  const rejectForm = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
    mode: 'onChange',
  })

  const editForm = useForm<CreateWorkflowForm>({
    resolver: zodResolver(createWorkflowSchema),
    mode: 'onChange',
  })

  // ── Approvers helpers ─────────────────────────────────────────────────────
  const addApprover = useCallback((userId: string) => {
    setApproverIds((prev) => prev.includes(userId) ? prev : [...prev, userId])
  }, [])

  const removeApprover = useCallback((userId: string) => {
    setApproverIds((prev) => prev.filter((id) => id !== userId))
  }, [])

  // ── Final user helpers ────────────────────────────────────────────────────
  const addFinalUser = useCallback((userId: string) => {
    setFinalUserIds([userId])
  }, [])

  const removeFinalUser = useCallback((userId: string) => {
    setFinalUserIds((prev) => prev.filter((id) => id !== userId))
  }, [])

  // ── Supporting files helpers ──────────────────────────────────────────────
  const addSupportingFile = useCallback((file: File) => {
    setSupportingFiles((prev) => [...prev, file])
  }, [])

  const removeSupportingFile = useCallback((index: number) => {
    setSupportingFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ── Document extraction handler ───────────────────────────────────────────
  const handleDocumentFile = useCallback(async (file: File) => {
    setDocumentFile(file)
    setDocumentExtraction(null)
    setDocumentExtractionError(null)
    setDocumentExtractionLoading(true)
    try {
      const result = await typologiesApi.previewExtract(companyId, file)
      setDocumentExtraction(result)
    } catch {
      setDocumentExtractionError('No se pudo extraer la información del documento')
    } finally {
      setDocumentExtractionLoading(false)
    }
  }, [companyId])

  // ── Submit handler ────────────────────────────────────────────────────────
  const submitCreate = createForm.handleSubmit((values) => {
    if (!selectedTypologyId) {
      setCreateError('ERR_NO_TYPOLOGY')
      return
    }
    if (approverIds.length === 0) {
      setCreateError('ERR_NO_APPROVER')
      return
    }
    if (finalUserIds.length === 0) {
      setCreateError('ERR_NO_FINAL_USER')
      return
    }
    setCreateError(null)
    createMutation.mutate({
      form:                    values,
      typologyId:              selectedTypologyId,
      approvers:               approverIds,
      mainFile:                documentFile,
      supportingFilesToUpload: supportingFiles,
      selectedFinalUserIds:    finalUserIds,
    })
  })

  // ── Open detail by ID (used from notification bell) ──────────────────────
  // Use a ref to access latest cached data without adding them as deps,
  // avoiding unnecessary recreation of the callback on every poll cycle.
  const cachedRef = useRef({ paginatedWorkflows, myTasks, myAvailable })
  cachedRef.current = { paginatedWorkflows, myTasks, myAvailable }

  const openDetailById = useCallback(async (workflowId: string) => {
    const { paginatedWorkflows: pw, myTasks: mt, myAvailable: ma } = cachedRef.current
    const cached = [
      ...(pw?.data ?? []),
      ...mt,
      ...ma,
    ].find((w) => w.id === workflowId)

    if (cached) {
      setDetailWorkflow(cached)
    } else {
      try {
        const workflow = await workflowsApi.getById(workflowId)
        setDetailWorkflow(workflow)
      } catch { /* ignore — detail simply won't open */ }
    }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    createForm.reset({ title: '', description: '' })
    setSelectedTypologyId('')
    setApproverIds([])
    setFinalUserIds([])
    setCreateError(null)
    setDocumentFile(null)
    setDocumentExtraction(null)
    setDocumentExtractionError(null)
    setDocumentExtractionLoading(false)
    setSupportingFiles([])
    setCreateOpen(true)
  }

  const openApprove = (workflow: ApiWorkflow) => {
    approveForm.reset()
    setApproveAttachmentFiles([])
    setApproveWorkflow(workflow)
  }

  const openReject = (workflow: ApiWorkflow) => {
    rejectForm.reset()
    setRejectWorkflow(workflow)
  }

  const openTimeline = (workflowId: string) => {
    setTimelineWorkflowId(workflowId)
  }

  const openReviewCycle = (workflow: ApiWorkflow) => {
    setReviewCycleReviewerIds([])
    setReviewCycleWorkflow(workflow)
  }

  const openCompleteStep = (workflow: ApiWorkflow) => {
    setCompleteStepFiles([])
    setCompleteStepNotes('')
    setCompleteStepWorkflow(workflow)
  }

  const openEdit = (workflow: ApiWorkflow) => {
    editForm.reset({ title: workflow.title, description: workflow.description ?? '' })
    setEditApproverIds(
      [...workflow.approvalSteps].sort((a, b) => a.stepOrder - b.stepOrder).map((s) => s.userId),
    )
    setEditDocumentFile(null)
    setEditSupportingFiles([])
    setEditExistingAttachments(
      (workflow.attachments ?? []).filter((a) => a.attachmentType === 'SUPPORTING'),
    )
    setEditFinalUserId(workflow.finalUserIds?.[0] ?? null)
    setEditWorkflow(workflow)
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const activeTypologies = useMemo(
    () => typologies.filter((t) => t.typologyStatus === 'ACTIVE'),
    [typologies],
  )

  const activeOrgUsers = useMemo(
    () => orgUsers.filter((u) => u.isActive && !u.deletedAt && u.registrationStatus === 'active'),
    [orgUsers],
  )

  /** Mapa userId → nombre completo para todos los usuarios de la org */
  const orgUsersMap = useMemo(
    () => new Map(
      orgUsers.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      ]),
    ),
    [orgUsers],
  )

  /** IDs de roles que tienen permiso WORKFLOWS:APPROVE */
  const approveRoleIds = useMemo(
    () => new Set(
      allRoles
        .filter((r) => r.permissions.some((p) => p.module === 'WORKFLOWS' && p.action === 'APPROVE'))
        .map((r) => r.id),
    ),
    [allRoles],
  )

  /** Usuarios activos que pueden ser aprobadores (tienen al menos un rol con WORKFLOWS:APPROVE) */
  const approverEligibleUsers = useMemo(
    () => activeOrgUsers.filter((u) => u.roles.some((r) => approveRoleIds.has(r.roleId))),
    [activeOrgUsers, approveRoleIds],
  )

  const selectedTypology = useMemo(
    () => activeTypologies.find((t) => t.id === selectedTypologyId) ?? null,
    [activeTypologies, selectedTypologyId],
  )

  /**
   * Usuarios elegibles como usuarios finales: activos y que coincidan con la estructura
   * organizacional de la tipología seleccionada (departamento, área, cargo).
   */
  const finalUserEligibleUsers = useMemo(
    () => selectedTypology
      ? activeOrgUsers.filter((u) => {
          const org = selectedTypology.estructuraOrg
          if (u.departamentoId !== org.departamentoId) return false
          if (org.areaId !== null && u.areaId !== org.areaId) return false
          if (org.cargoId !== null && u.cargoId !== org.cargoId) return false
          return true
        })
      : [],
    [selectedTypology, activeOrgUsers],
  )

  /** Comparación campo a campo: true=coincide, false=no coincide, null=tipología sin valor declarado */
  const documentComparison: DocumentComparison | null = useMemo(
    () => documentExtraction && selectedTypology
      ? {
          nombre: selectedTypology.datosDeclarados.nombre !== null
            ? documentExtraction.nombre === selectedTypology.datosDeclarados.nombre
            : null,
          codigo: selectedTypology.datosDeclarados.codigo !== null
            ? documentExtraction.codigo === selectedTypology.datosDeclarados.codigo
            : null,
          version: selectedTypology.datosDeclarados.version !== null
            ? documentExtraction.version === selectedTypology.datosDeclarados.version
            : null,
        }
      : null,
    [documentExtraction, selectedTypology],
  )

  /**
   * true cuando hay un documento cargado y algún campo no coincide con la tipología.
   * En ese caso el botón Crear debe estar bloqueado.
   */
  const createBlocked = useMemo(
    () => documentExtractionLoading ||
      (documentComparison !== null && Object.values(documentComparison).some((v) => v === false)),
    [documentExtractionLoading, documentComparison],
  )

  return {
    // State
    createOpen, setCreateOpen,
    selectedTypologyId, setSelectedTypologyId,
    approverIds, setApproverIds,
    createError,
    detailWorkflow: detailWorkflowFull ?? detailWorkflow,
    setDetailWorkflow,
    approveWorkflow, setApproveWorkflow,
    approveAttachmentFiles, setApproveAttachmentFiles,
    rejectWorkflow, setRejectWorkflow,
    timelineWorkflowId, setTimelineWorkflowId,
    deleteWorkflow, setDeleteWorkflow,
    editWorkflow, setEditWorkflow,
    editApproverIds, setEditApproverIds,
    editDocumentFile, setEditDocumentFile,
    editSupportingFiles, setEditSupportingFiles,
    editExistingAttachments, setEditExistingAttachments,
    editFinalUserId, setEditFinalUserId,
    statusFilter, setStatusFilter,
    innerTab, setInnerTab,

    // Document extraction
    documentFile,
    documentExtraction,
    documentExtractionLoading,
    documentExtractionError,
    documentComparison,
    createBlocked,
    handleDocumentFile,

    // Supporting attachments
    supportingFiles,
    addSupportingFile,
    removeSupportingFile,

    // Users
    orgUsersMap,
    activeOrgUsers,
    approverEligibleUsers,
    finalUserEligibleUsers,
    finalUserIds,

    // Queries
    workflows: paginatedWorkflows?.data ?? [],
    workflowsTotal: paginatedWorkflows?.total ?? 0,
    workflowsLoading,
    myTasks,
    myTasksLoading,
    myAvailable,
    myAvailableLoading,
    isRefreshing,
    workflowsDataUpdatedAt,
    invalidateAll,
    timeline,
    timelineLoading,
    activeTypologies,

    // Mutations
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

    // Forms
    createForm,
    submitCreate,
    editForm,
    approveForm,
    rejectForm,

    // Review cycle state
    reviewCycleWorkflow, setReviewCycleWorkflow,
    reviewCycleReviewerIds, setReviewCycleReviewerIds,
    completeStepWorkflow, setCompleteStepWorkflow,
    completeStepFiles, setCompleteStepFiles,
    completeStepNotes, setCompleteStepNotes,

    // Helpers
    openCreate,
    openDetailById,
    addApprover,
    removeApprover,
    addFinalUser,
    removeFinalUser,
    openApprove,
    openReject,
    openTimeline,
    openEdit,
    openReviewCycle,
    openCompleteStep,
  }
}
