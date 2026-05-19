import { apiClient } from './client'

export interface ApiDepartamento {
  id: string
  orgId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiArea {
  id: string
  orgId: string
  departamentoId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiCargo {
  id: string
  orgId: string
  areaId: string | null
  departamentoId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateDepartamentoDto {
  name: string
  description?: string
}

export interface UpdateDepartamentoDto {
  name?: string
  description?: string
}

export interface CreateAreaDto {
  name: string
  description?: string
}

export interface UpdateAreaDto {
  name?: string
  description?: string
}

export interface CreateCargoDto {
  name: string
  description?: string
}

export interface UpdateCargoDto {
  name?: string
  description?: string
}

export interface BulkStructureResult {
  totalRows: number
  departmentsCreated: number
  departmentsExisting: number
  areasCreated: number
  areasExisting: number
  positionsCreated: number
  positionsExisting: number
  failed: number
  errors: Array<{
    row: number
    department?: string
    area?: string
    position?: string
    reason: string
  }>
}

const base = (orgId: string) => `/org/${orgId}`

export const orgStructureApi = {
  // ── Departamentos ────────────────────────────────────────────────
  listDepartamentos: (orgId: string) =>
    apiClient.get<ApiDepartamento[]>(`${base(orgId)}/departamentos`).then((r) => r.data),

  createDepartamento: (orgId: string, dto: CreateDepartamentoDto) =>
    apiClient.post<ApiDepartamento>(`${base(orgId)}/departamentos`, dto).then((r) => r.data),

  updateDepartamento: (orgId: string, id: string, dto: UpdateDepartamentoDto) =>
    apiClient.patch<ApiDepartamento>(`${base(orgId)}/departamentos/${id}`, dto).then((r) => r.data),

  deleteDepartamento: (orgId: string, id: string) =>
    apiClient.delete<void>(`${base(orgId)}/departamentos/${id}`).then((r) => r.data),

  // ── Áreas ────────────────────────────────────────────────────────
  listAreas: (orgId: string, departamentoId: string) =>
    apiClient
      .get<ApiArea[]>(`${base(orgId)}/departamentos/${departamentoId}/areas`)
      .then((r) => r.data),

  createArea: (orgId: string, departamentoId: string, dto: CreateAreaDto) =>
    apiClient
      .post<ApiArea>(`${base(orgId)}/departamentos/${departamentoId}/areas`, dto)
      .then((r) => r.data),

  updateArea: (orgId: string, departamentoId: string, id: string, dto: UpdateAreaDto) =>
    apiClient
      .patch<ApiArea>(`${base(orgId)}/departamentos/${departamentoId}/areas/${id}`, dto)
      .then((r) => r.data),

  deleteArea: (orgId: string, departamentoId: string, id: string) =>
    apiClient
      .delete<void>(`${base(orgId)}/departamentos/${departamentoId}/areas/${id}`)
      .then((r) => r.data),

  // ── Cargos (flat — all cargos in the org) ────────────────────────
  listAllCargos: (orgId: string) =>
    apiClient.get<ApiCargo[]>(`${base(orgId)}/cargos`).then((r) => r.data),

  // ── Cargos (department-level, no area) ───────────────────────────
  listDeptCargos: (orgId: string, departamentoId: string) =>
    apiClient
      .get<ApiCargo[]>(`${base(orgId)}/departamentos/${departamentoId}/cargos`)
      .then((r) => r.data),

  createDeptCargo: (orgId: string, departamentoId: string, dto: CreateCargoDto) =>
    apiClient
      .post<ApiCargo>(`${base(orgId)}/departamentos/${departamentoId}/cargos`, dto)
      .then((r) => r.data),

  updateDeptCargo: (orgId: string, departamentoId: string, id: string, dto: UpdateCargoDto) =>
    apiClient
      .patch<ApiCargo>(`${base(orgId)}/departamentos/${departamentoId}/cargos/${id}`, dto)
      .then((r) => r.data),

  deleteDeptCargo: (orgId: string, departamentoId: string, id: string) =>
    apiClient
      .delete<void>(`${base(orgId)}/departamentos/${departamentoId}/cargos/${id}`)
      .then((r) => r.data),

  // ── Cargos (nested by area) ───────────────────────────────────────
  listCargos: (orgId: string, departamentoId: string, areaId: string) =>
    apiClient
      .get<ApiCargo[]>(`${base(orgId)}/departamentos/${departamentoId}/areas/${areaId}/cargos`)
      .then((r) => r.data),

  createCargo: (orgId: string, departamentoId: string, areaId: string, dto: CreateCargoDto) =>
    apiClient
      .post<ApiCargo>(
        `${base(orgId)}/departamentos/${departamentoId}/areas/${areaId}/cargos`,
        dto,
      )
      .then((r) => r.data),

  updateCargo: (
    orgId: string,
    departamentoId: string,
    areaId: string,
    id: string,
    dto: UpdateCargoDto,
  ) =>
    apiClient
      .patch<ApiCargo>(
        `${base(orgId)}/departamentos/${departamentoId}/areas/${areaId}/cargos/${id}`,
        dto,
      )
      .then((r) => r.data),

  deleteCargo: (orgId: string, departamentoId: string, areaId: string, id: string) =>
    apiClient
      .delete<void>(
        `${base(orgId)}/departamentos/${departamentoId}/areas/${areaId}/cargos/${id}`,
      )
      .then((r) => r.data),

  // ── Bulk import ───────────────────────────────────────────────────
  bulkImportStructure: (orgId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<BulkStructureResult>(`${base(orgId)}/structure/bulk`, form, {
        headers: { 'Content-Type': undefined },
      })
      .then((r) => r.data)
  },
}
