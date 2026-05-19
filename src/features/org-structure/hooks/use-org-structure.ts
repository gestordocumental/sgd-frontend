import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  orgStructureApi,
  type ApiDepartamento,
  type ApiArea,
  type ApiCargo,
} from '@/lib/api/org-structure'
import { requiredString, optionalString } from '@/lib/validations/schemas'

const structureSchema = z.object({
  name: requiredString('The name'),
  description: optionalString,
})

export type StructureForm = z.infer<typeof structureSchema>

export function useOrgStructure(companyId: string, enabled = true) {
  const queryClient = useQueryClient()

  // ── Filter selection (cascade) ─────────────────────────────────
  const [selectedDeptId, setSelectedDeptId] = useState<string>('')
  const [selectedAreaId, setSelectedAreaId] = useState<string>('')

  // ── Dialog state ───────────────────────────────────────────────
  const [createDeptOpen, setCreateDeptOpen] = useState(false)
  const [editDept, setEditDept] = useState<ApiDepartamento | null>(null)
  const [deleteDept, setDeleteDept] = useState<ApiDepartamento | null>(null)

  const [createAreaOpen, setCreateAreaOpen] = useState(false)
  const [editArea, setEditArea] = useState<ApiArea | null>(null)
  const [deleteArea, setDeleteArea] = useState<ApiArea | null>(null)

  const [createCargoOpen, setCreateCargoOpen] = useState(false)
  const [editCargo, setEditCargo] = useState<ApiCargo | null>(null)
  const [deleteCargo, setDeleteCargo] = useState<ApiCargo | null>(null)

  const [createDeptCargoOpen, setCreateDeptCargoOpen] = useState(false)
  const [editDeptCargo, setEditDeptCargo] = useState<ApiCargo | null>(null)
  const [deleteDeptCargo, setDeleteDeptCargo] = useState<ApiCargo | null>(null)

  // ── Forms ──────────────────────────────────────────────────────
  const deptForm = useForm<StructureForm>({ resolver: zodResolver(structureSchema), mode: 'onChange' })
  const areaForm = useForm<StructureForm>({ resolver: zodResolver(structureSchema), mode: 'onChange' })
  const cargoForm = useForm<StructureForm>({ resolver: zodResolver(structureSchema), mode: 'onChange' })
  const deptCargoForm = useForm<StructureForm>({ resolver: zodResolver(structureSchema), mode: 'onChange' })

  // ── Queries ────────────────────────────────────────────────────
  const { data: departamentos = [], isLoading: deptLoading } = useQuery({
    queryKey: ['departamentos', companyId],
    queryFn: () => orgStructureApi.listDepartamentos(companyId),
    staleTime: 60_000,
    enabled: enabled && !!companyId,
  })

  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['areas', companyId, selectedDeptId],
    queryFn: () => orgStructureApi.listAreas(companyId, selectedDeptId),
    staleTime: 60_000,
    enabled: !!companyId && !!selectedDeptId,
  })

  const { data: cargos = [], isLoading: cargosLoading } = useQuery({
    queryKey: ['cargos', companyId, selectedDeptId, selectedAreaId],
    queryFn: () => orgStructureApi.listCargos(companyId, selectedDeptId, selectedAreaId),
    staleTime: 60_000,
    enabled: !!companyId && !!selectedDeptId && !!selectedAreaId,
  })

  const { data: deptCargos = [], isLoading: deptCargosLoading } = useQuery({
    queryKey: ['dept-cargos', companyId, selectedDeptId],
    queryFn: () => orgStructureApi.listDeptCargos(companyId, selectedDeptId),
    staleTime: 60_000,
    enabled: !!companyId && !!selectedDeptId,
  })

  // ── Invalidation helpers ───────────────────────────────────────
  // Partial-key invalidation: covers all cached variants (including user modals)
  const invalidateDepts = () =>
    queryClient.invalidateQueries({ queryKey: ['departamentos', companyId] })

  const invalidateAreas = () =>
    queryClient.invalidateQueries({ queryKey: ['areas', companyId] })

  const invalidateCargos = () => {
    queryClient.invalidateQueries({ queryKey: ['cargos', companyId] })
    queryClient.invalidateQueries({ queryKey: ['dept-cargos', companyId] })
    queryClient.invalidateQueries({ queryKey: ['all-cargos', companyId] })
  }

  // ── Departamento mutations ─────────────────────────────────────
  const createDeptMutation = useMutation({
    mutationFn: (dto: StructureForm) => orgStructureApi.createDepartamento(companyId, dto),
    onSuccess: () => { invalidateDepts(); setCreateDeptOpen(false); deptForm.reset() },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e.response?.data?.message
      if (msg) deptForm.setError('name', { message: msg })
    },
  })

  const editDeptMutation = useMutation({
    mutationFn: (dto: StructureForm) =>
      orgStructureApi.updateDepartamento(companyId, editDept!.id, dto),
    onSuccess: () => { invalidateDepts(); setEditDept(null) },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e.response?.data?.message
      if (msg) deptForm.setError('name', { message: msg })
    },
  })

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => orgStructureApi.deleteDepartamento(companyId, id),
    onSuccess: () => {
      invalidateDepts()
      setDeleteDept(null)
      // Reset dependent filters when a departamento is deleted
      if (deleteDept?.id === selectedDeptId) {
        setSelectedDeptId('')
        setSelectedAreaId('')
      }
    },
  })

  // ── Area mutations ─────────────────────────────────────────────
  const createAreaMutation = useMutation({
    mutationFn: (dto: StructureForm) =>
      orgStructureApi.createArea(companyId, selectedDeptId, dto),
    onSuccess: () => { invalidateAreas(); setCreateAreaOpen(false); areaForm.reset() },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e.response?.data?.message
      if (msg) areaForm.setError('name', { message: msg })
    },
  })

  const editAreaMutation = useMutation({
    mutationFn: (dto: StructureForm) =>
      orgStructureApi.updateArea(companyId, editArea!.departamentoId, editArea!.id, dto),
    onSuccess: () => { invalidateAreas(); setEditArea(null) },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e.response?.data?.message
      if (msg) areaForm.setError('name', { message: msg })
    },
  })

  const deleteAreaMutation = useMutation({
    mutationFn: (a: ApiArea) => orgStructureApi.deleteArea(companyId, a.departamentoId, a.id),
    onSuccess: () => {
      invalidateAreas()
      setDeleteArea(null)
      if (deleteArea?.id === selectedAreaId) setSelectedAreaId('')
    },
  })

  // ── Cargo mutations ────────────────────────────────────────────
  const createCargoMutation = useMutation({
    mutationFn: (dto: StructureForm) =>
      orgStructureApi.createCargo(companyId, selectedDeptId, selectedAreaId, dto),
    onSuccess: () => { invalidateCargos(); setCreateCargoOpen(false); cargoForm.reset() },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e.response?.data?.message
      if (msg) cargoForm.setError('name', { message: msg })
    },
  })

  const editCargoMutation = useMutation({
    mutationFn: (dto: StructureForm) =>
      orgStructureApi.updateCargo(
        companyId,
        editCargo!.departamentoId,
        editCargo!.areaId,
        editCargo!.id,
        dto,
      ),
    onSuccess: () => { invalidateCargos(); setEditCargo(null) },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e.response?.data?.message
      if (msg) cargoForm.setError('name', { message: msg })
    },
  })

  const deleteCargoMutation = useMutation({
    mutationFn: (c: ApiCargo) =>
      orgStructureApi.deleteCargo(companyId, c.departamentoId, c.areaId!, c.id),
    onSuccess: () => { invalidateCargos(); setDeleteCargo(null) },
  })

  // ── Dept-level cargo mutations ─────────────────────────────────
  const createDeptCargoMutation = useMutation({
    mutationFn: (dto: StructureForm) =>
      orgStructureApi.createDeptCargo(companyId, selectedDeptId, dto),
    onSuccess: () => { invalidateCargos(); setCreateDeptCargoOpen(false); deptCargoForm.reset() },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e.response?.data?.message
      if (msg) deptCargoForm.setError('name', { message: msg })
    },
  })

  const editDeptCargoMutation = useMutation({
    mutationFn: (dto: StructureForm) =>
      orgStructureApi.updateDeptCargo(companyId, editDeptCargo!.departamentoId, editDeptCargo!.id, dto),
    onSuccess: () => { invalidateCargos(); setEditDeptCargo(null) },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const msg = e.response?.data?.message
      if (msg) deptCargoForm.setError('name', { message: msg })
    },
  })

  const deleteDeptCargoMutation = useMutation({
    mutationFn: (c: ApiCargo) =>
      orgStructureApi.deleteDeptCargo(companyId, c.departamentoId, c.id),
    onSuccess: () => { invalidateCargos(); setDeleteDeptCargo(null) },
  })

  // ── Bulk import mutation ────────────────────────────────────────
  const bulkImportMutation = useMutation({
    mutationFn: (file: File) => orgStructureApi.bulkImportStructure(companyId, file),
    onSuccess: () => {
      invalidateDepts()
      invalidateAreas()
      invalidateCargos()
    },
  })

  // ── Open helpers ───────────────────────────────────────────────
  const openEditDept = (d: ApiDepartamento) => {
    setEditDept(d)
    deptForm.reset({ name: d.name, description: d.description ?? undefined })
    deptForm.trigger()
  }

  const openEditArea = (a: ApiArea) => {
    setEditArea(a)
    areaForm.reset({ name: a.name, description: a.description ?? undefined })
    areaForm.trigger()
  }

  const openEditCargo = (c: ApiCargo) => {
    setEditCargo(c)
    cargoForm.reset({ name: c.name, description: c.description ?? undefined })
    cargoForm.trigger()
  }

  const openEditDeptCargo = (c: ApiCargo) => {
    setEditDeptCargo(c)
    deptCargoForm.reset({ name: c.name, description: c.description ?? undefined })
    deptCargoForm.trigger()
  }

  const handleSelectDept = (id: string) => {
    setSelectedDeptId(id)
    setSelectedAreaId('') // reset area when dept changes
  }

  return {
    // Filter state
    selectedDeptId, handleSelectDept,
    selectedAreaId, setSelectedAreaId,

    // Data
    departamentos, deptLoading,
    areas, areasLoading,
    cargos, cargosLoading,
    deptCargos, deptCargosLoading,

    // Departamento dialog state
    createDeptOpen, setCreateDeptOpen,
    editDept, setEditDept,
    deleteDept, setDeleteDept,
    deptForm,
    openEditDept,
    createDeptMutation, editDeptMutation, deleteDeptMutation,

    // Area dialog state
    createAreaOpen, setCreateAreaOpen,
    editArea, setEditArea,
    deleteArea, setDeleteArea,
    areaForm,
    openEditArea,
    createAreaMutation, editAreaMutation, deleteAreaMutation,

    // Cargo dialog state (area-level)
    createCargoOpen, setCreateCargoOpen,
    editCargo, setEditCargo,
    deleteCargo, setDeleteCargo,
    cargoForm,
    openEditCargo,
    createCargoMutation, editCargoMutation, deleteCargoMutation,

    // Cargo dialog state (dept-level)
    createDeptCargoOpen, setCreateDeptCargoOpen,
    editDeptCargo, setEditDeptCargo,
    deleteDeptCargo, setDeleteDeptCargo,
    deptCargoForm,
    openEditDeptCargo,
    createDeptCargoMutation, editDeptCargoMutation, deleteDeptCargoMutation,

    // Bulk import
    bulkImportMutation,
  }
}
