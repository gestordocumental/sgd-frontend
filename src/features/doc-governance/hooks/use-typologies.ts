import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { typologiesApi, type ApiTypology } from '@/lib/api/typologies';
import { orgStructureApi } from '@/lib/api/org-structure';
import { useAuthStore } from '@/store/authStore';
import { resolveApiError } from '@/lib/utils/api-error';

// ── Version comparison helper ──────────────────────────────────────────────

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

/** @deprecated use isExactlyOneIncrement instead */
export function versionGte(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return true;
}

/**
 * Returns true only if newVer is exactly one increment above oldVer.
 * "05"→"06" ✓  "05"→"07" ✗  "v1.0"→"v1.1" ✓  "v1.9"→"v2.0" ✓  "v1.0"→"v2.1" ✗
 */
export function isExactlyOneIncrement(newVer: string, oldVer: string): boolean {
  const nv = parseVersion(newVer);
  const ov = parseVersion(oldVer);
  const len = Math.max(nv.length, ov.length);
  while (nv.length < len) nv.push(0);
  while (ov.length < len) ov.push(0);
  let diffIdx = -1;
  for (let i = 0; i < len; i++) {
    if (nv[i] !== ov[i]) {
      diffIdx = i;
      break;
    }
  }
  if (diffIdx === -1) return false;
  if (nv[diffIdx] !== ov[diffIdx] + 1) return false;
  for (let i = diffIdx + 1; i < len; i++) {
    if (nv[i] !== 0) return false;
  }
  return true;
}

// ── Schemas ────────────────────────────────────────────────────────────────

const typologySchema = z.object({
  departamentoId: z.string().min(1, 'Seleccione un departamento'),
  areaId: z.string().optional(),
  cargoId: z.string().optional(),
  nombre: z.string().max(255).optional(),
  codigo: z.string().max(100).optional(),
  version: z.string().max(50).optional(),
});

export type TypologyForm = z.infer<typeof typologySchema>;

const uploadDocSchema = z.object({
  nombre: z.string().max(255).optional(),
  version: z.string().max(50).optional(),
});

export type UploadDocForm = z.infer<typeof uploadDocSchema>;

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTypologies(orgId: string, enabled = true) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const companyName = useAuthStore((s) => s.user?.companyName);

  // ── Create / Edit dialog ───────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editTypology, setEditTypology] = useState<ApiTypology | null>(null);
  const [deleteTypology, setDeleteTypology] = useState<ApiTypology | null>(null);

  // File attached to the create dialog (uploaded right after creation)
  const [createFile, setCreateFile] = useState<File | null>(null);

  // File attached to the edit dialog (triggers new-version flow)
  const [editFile, setEditFile] = useState<File | null>(null);

  // ── History dialog ─────────────────────────────────────────────────────
  const [historyTypology, setHistoryTypology] = useState<ApiTypology | null>(null);

  // ── Upload document dialog (from table action) ─────────────────────────
  const [uploadDocTypology, setUploadDocTypology] = useState<ApiTypology | null>(null);
  const [uploadDocFile, setUploadDocFile] = useState<File | null>(null);

  // ── Cascading selectors inside the create/edit form ────────────────────
  const [formDeptId, setFormDeptId] = useState('');
  const [formAreaId, setFormAreaId] = useState('');

  // ── Forms ──────────────────────────────────────────────────────────────
  const form = useForm<TypologyForm>({
    resolver: zodResolver(typologySchema),
    mode: 'onChange',
    defaultValues: {
      departamentoId: '',
      areaId: '',
      cargoId: '',
      nombre: '',
      codigo: '',
      version: '',
    },
  });

  const uploadDocForm = useForm<UploadDocForm>({
    resolver: zodResolver(uploadDocSchema),
    mode: 'onChange',
    defaultValues: { nombre: '', version: '' },
  });

  // ── Queries ────────────────────────────────────────────────────────────
  const { data: typologies = [], isLoading } = useQuery({
    queryKey: ['typologies', orgId],
    queryFn: () => typologiesApi.list(orgId),
    staleTime: 30_000,
    enabled: enabled && !!orgId,
    // Poll every 3 s while any typology is being processed — stops automatically
    refetchInterval: (query) =>
      (query.state.data as ApiTypology[] | undefined)?.some(
        (t) => t.documento.extractionStatus === 'PROCESSING',
      )
        ? 3_000
        : false,
  });

  const { data: departamentos = [] } = useQuery({
    queryKey: ['departamentos', orgId],
    queryFn: () => orgStructureApi.listDepartamentos(orgId),
    staleTime: 60_000,
    enabled: enabled && !!orgId,
  });

  const { data: formAreas = [] } = useQuery({
    queryKey: ['areas', orgId, formDeptId],
    queryFn: () => orgStructureApi.listAreas(orgId, formDeptId),
    staleTime: 60_000,
    enabled: !!orgId && !!formDeptId,
  });

  // Department-level cargos (no area required)
  const { data: formDeptCargos = [] } = useQuery({
    queryKey: ['dept-cargos', orgId, formDeptId],
    queryFn: () => orgStructureApi.listDeptCargos(orgId, formDeptId),
    staleTime: 60_000,
    enabled: !!orgId && !!formDeptId,
  });

  // Area-level cargos
  const { data: formAreaCargos = [] } = useQuery({
    queryKey: ['cargos', orgId, formDeptId, formAreaId],
    queryFn: () => orgStructureApi.listCargos(orgId, formDeptId, formAreaId),
    staleTime: 60_000,
    enabled: !!orgId && !!formDeptId && !!formAreaId,
  });

  // Combined: dept-level + area-level (when area selected)
  const formCargos = useMemo(
    () => [...formDeptCargos, ...formAreaCargos],
    [formDeptCargos, formAreaCargos],
  );

  const { data: historyItems = [], isLoading: historyLoading } = useQuery({
    queryKey: ['typologies-history', orgId, historyTypology?.datosDeclarados.codigo],
    queryFn: () => typologiesApi.history(orgId, historyTypology!.datosDeclarados.codigo!),
    enabled: !!historyTypology?.datosDeclarados.codigo,
    staleTime: 0,
  });

  // ── Invalidation ───────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['typologies', orgId] });

  // ── Preview extract mutation (auto-fill fields when a file is selected) ─
  const previewExtractMutation = useMutation({
    mutationFn: (file: File) => typologiesApi.previewExtract(orgId, file, companyName ?? undefined),
    onSuccess: (result) => {
      if (result.nombre) form.setValue('nombre', result.nombre, { shouldValidate: true });
      if (result.codigo) form.setValue('codigo', result.codigo, { shouldValidate: true });
      if (result.version) form.setValue('version', result.version, { shouldValidate: true });
    },
  });

  // ── Upload mutation (shared — used by create flow and upload dialog) ────
  const uploadMutation = useMutation({
    mutationFn: ({ typologyId, file }: { typologyId: string; file: File }) =>
      typologiesApi.uploadDocument(orgId, typologyId, file, companyName ?? undefined),
    onSettled: () => invalidate(),
    onError: () => toast.error(t('docGovernance.upload.uploadError')),
  });

  // ── Create mutation ────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (dto: TypologyForm) =>
      typologiesApi.create(orgId, {
        departamentoId: dto.departamentoId,
        ...(dto.areaId ? { areaId: dto.areaId } : {}),
        ...(dto.cargoId ? { cargoId: dto.cargoId } : {}),
        ...(dto.nombre ? { nombre: dto.nombre } : {}),
        ...(dto.codigo ? { codigo: dto.codigo } : {}),
        ...(dto.version ? { version: dto.version } : {}),
      }),
    onSuccess: (created) => {
      invalidate();
      setCreateOpen(false);
      resetForm();
      // If a file was attached, upload it right after creation
      if (createFile) {
        uploadMutation.mutate({ typologyId: created.id, file: createFile });
        setCreateFile(null);
      }
    },
    onError: (e: unknown) => {
      const msg = resolveApiError(e, t);
      if (msg) form.setError('root', { message: msg });
    },
  });

  // ── Edit mutation (no file — regular PATCH) ────────────────────────────
  const editMutation = useMutation({
    mutationFn: (dto: TypologyForm) =>
      typologiesApi.update(orgId, editTypology!.id, {
        departamentoId: dto.departamentoId,
        ...(dto.areaId ? { areaId: dto.areaId } : {}),
        ...(dto.cargoId ? { cargoId: dto.cargoId } : {}),
        ...(dto.nombre ? { nombre: dto.nombre } : {}),
        ...(dto.codigo ? { codigo: dto.codigo } : {}),
        ...(dto.version ? { version: dto.version } : {}),
      }),
    onSuccess: () => {
      invalidate();
      setEditTypology(null);
    },
    onError: (e: unknown) => {
      const msg = resolveApiError(e, t);
      if (msg) form.setError('root', { message: msg });
    },
  });

  // ── New version mutation (edit + file → archives old, creates new) ──────
  const newVersionMutation = useMutation({
    mutationFn: ({ dto, file }: { dto: TypologyForm; file: File }) =>
      typologiesApi.newVersion(orgId, editTypology!.id, file, {
        nombre: dto.nombre || undefined,
        version: dto.version || undefined,
        orgName: companyName ?? undefined,
      }),
    onSuccess: () => {
      invalidate();
      setEditTypology(null);
      setEditFile(null);
    },
    onError: (e: unknown) => {
      const msg = resolveApiError(e, t);
      if (msg) form.setError('root', { message: msg });
    },
  });

  // ── Retry extraction mutation ──────────────────────────────────────────
  const retryExtractionMutation = useMutation({
    mutationFn: (typologyId: string) => typologiesApi.retryExtraction(orgId, typologyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['typologies', orgId] }),
  });

  // ── View document (fetch signed URL and open in new tab) ──────────────
  const viewDocumentMutation = useMutation({
    mutationFn: (typologyId: string) => typologiesApi.signedUrl(orgId, typologyId),
    onSuccess: ({ signedUrl }) => {
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => typologiesApi.remove(orgId, id),
    onSuccess: () => {
      invalidate();
      setDeleteTypology(null);
    },
  });

  // ── Upload document mutation (dialog flow) ─────────────────────────────
  const uploadDocMutation = useMutation({
    mutationFn: async ({ values, file }: { values: UploadDocForm; file: File }) => {
      const typo = uploadDocTypology!;
      // Update nombre/version if changed
      const patchDto: Record<string, string> = {};
      if (values.nombre && values.nombre !== (typo.datosDeclarados.nombre ?? ''))
        patchDto.nombre = values.nombre;
      if (values.version && values.version !== (typo.datosDeclarados.version ?? ''))
        patchDto.version = values.version;
      if (Object.keys(patchDto).length > 0) {
        await typologiesApi.update(orgId, typo.id, patchDto);
      }
      return typologiesApi.uploadDocument(orgId, typo.id, file, companyName ?? undefined);
    },
    onSuccess: () => {
      invalidate();
      setUploadDocTypology(null);
      setUploadDocFile(null);
      uploadDocForm.reset();
    },
    onError: (e: unknown) => {
      const msg = resolveApiError(e, t);
      if (msg) uploadDocForm.setError('root', { message: msg });
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  const resetForm = () => {
    form.reset();
    setFormDeptId('');
    setFormAreaId('');
  };

  const openCreate = () => {
    resetForm();
    setCreateFile(null);
    setCreateOpen(true);
  };

  const openEdit = (typo: ApiTypology) => {
    setEditFile(null);
    setEditTypology(typo);
    const deptId = typo.estructuraOrg.departamentoId;
    const areaId = typo.estructuraOrg.areaId ?? '';
    setFormDeptId(deptId);
    setFormAreaId(areaId);
    form.reset({
      departamentoId: deptId,
      areaId: areaId,
      cargoId: typo.estructuraOrg.cargoId ?? '',
      nombre: typo.datosDeclarados.nombre ?? '',
      codigo: typo.datosDeclarados.codigo ?? '',
      version: typo.datosDeclarados.version ?? '',
    });
    form.trigger();
  };

  const openUploadDoc = (typo: ApiTypology) => {
    setUploadDocTypology(typo);
    setUploadDocFile(null);
    uploadDocForm.reset({
      nombre: typo.datosDeclarados.nombre ?? '',
      version: typo.datosDeclarados.version ?? '',
    });
  };

  const handleFormDeptChange = (id: string) => {
    setFormDeptId(id);
    setFormAreaId('');
    form.setValue('departamentoId', id);
    form.setValue('areaId', '');
    form.setValue('cargoId', '');
  };

  const handleFormAreaChange = (id: string) => {
    setFormAreaId(id);
    form.setValue('areaId', id);
    form.setValue('cargoId', '');
  };

  return {
    // Data
    typologies,
    isLoading,

    // Form org-structure data
    departamentos,
    formAreas,
    formCargos,
    formDeptId,
    formAreaId,
    handleFormDeptChange,
    handleFormAreaChange,

    // Create/Edit form & state
    form,
    createOpen,
    setCreateOpen,
    openCreate,
    editTypology,
    setEditTypology,
    openEdit,
    deleteTypology,
    setDeleteTypology,

    // File for create dialog
    createFile,
    setCreateFile,

    // Upload document dialog
    uploadDocTypology,
    setUploadDocTypology,
    openUploadDoc,
    uploadDocFile,
    setUploadDocFile,
    uploadDocForm,

    // Edit file (triggers new-version flow when set)
    editFile,
    setEditFile,

    // History dialog
    historyTypology,
    setHistoryTypology,
    historyItems,
    historyLoading,

    // Mutations
    createMutation,
    editMutation,
    newVersionMutation,
    deleteMutation,
    uploadMutation,
    uploadDocMutation,
    previewExtractMutation,
    viewDocumentMutation,
    retryExtractionMutation,
    extracting: previewExtractMutation.isPending,
  };
}
