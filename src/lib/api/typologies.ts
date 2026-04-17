import { apiClient } from './client'

export type TypologyStatus = 'INCOMPLETE' | 'ACTIVE' | 'ARCHIVED' | 'DELETED'
export type ExtractionStatus =
  | 'NOT_UPLOADED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'DISCREPANCY'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'FAILED'

export interface ApiTypology {
  id: string
  orgId: string
  typologyStatus: TypologyStatus
  estructuraOrg: {
    departamentoId: string
    departamentoNombre: string
    areaId: string | null
    areaNombre: string | null
    cargoId: string | null
    cargoNombre: string | null
  }
  datosDeclarados: {
    nombre: string | null
    codigo: string | null
    version: string | null
    fuente: 'EXCEL' | 'MANUAL' | 'CONFIRMED_FROM_EXTRACTION'
  }
  documento: {
    r2Key: string | null
    originalName: string | null
    mimeType: string | null
    uploadedAt: string | null
    extractionStatus: ExtractionStatus
  }
  metadataExtraida: {
    nombre: string | null
    codigo: string | null
    version: string | null
    extractedAt: string | null
    discrepancias: Array<{
      campo: string
      valorDeclarado: string
      valorExtraido: string
    }>
  }
  fuenteCreacion: 'MANUAL' | 'BULK_IMPORT'
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTypologyDto {
  departamentoId: string
  areaId?: string
  cargoId?: string
  nombre?: string
  codigo?: string
  version?: string
}

export interface UpdateTypologyDto {
  departamentoId?: string
  areaId?: string
  cargoId?: string
  nombre?: string
  codigo?: string
  version?: string
}

const base = (orgId: string) => `/documents/${orgId}/typologies`

export const typologiesApi = {
  list: (orgId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get<ApiTypology[]>(base(orgId), { params }).then((r) => r.data),

  getById: (orgId: string, id: string) =>
    apiClient.get<ApiTypology>(`${base(orgId)}/${id}`).then((r) => r.data),

  create: (orgId: string, dto: CreateTypologyDto) =>
    apiClient.post<ApiTypology>(base(orgId), dto).then((r) => r.data),

  update: (orgId: string, id: string, dto: UpdateTypologyDto) =>
    apiClient.patch<ApiTypology>(`${base(orgId)}/${id}`, dto).then((r) => r.data),

  remove: (orgId: string, id: string) =>
    apiClient.delete<void>(`${base(orgId)}/${id}`).then((r) => r.data),

  uploadDocument: (orgId: string, typologyId: string, file: File, orgName?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (orgName) form.append('orgName', orgName)
    return apiClient
      .post<ApiTypology>(`${base(orgId)}/${typologyId}/file`, form, { headers: { 'Content-Type': undefined } })
      .then((r) => r.data)
  },

  newVersion: (
    orgId: string,
    typologyId: string,
    file: File,
    dto: { nombre?: string; version?: string; orgName?: string },
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (dto.nombre)  form.append('nombre',  dto.nombre)
    if (dto.version) form.append('version', dto.version)
    if (dto.orgName) form.append('orgName', dto.orgName)
    return apiClient
      .post<ApiTypology>(`${base(orgId)}/${typologyId}/new-version`, form, { headers: { 'Content-Type': undefined } })
      .then((r) => r.data)
  },

  signedUrl: (orgId: string, typologyId: string) =>
    apiClient
      .get<{ signedUrl: string; expiresAt: string }>(`${base(orgId)}/${typologyId}/signed-url`)
      .then((r) => r.data),

  retryExtraction: (orgId: string, typologyId: string) =>
    apiClient
      .post<{ message: string; extractionStatus: string }>(`${base(orgId)}/${typologyId}/retry-extraction`)
      .then((r) => r.data),

  history: (orgId: string, codigo: string) =>
    apiClient.get<ApiTypology[]>(`${base(orgId)}/history/${encodeURIComponent(codigo)}`).then((r) => r.data),

  previewExtract: (orgId: string, file: File, orgName?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (orgName) form.append('orgName', orgName)
    return apiClient
      .post<{ nombre: string | null; codigo: string | null; version: string | null }>(
        `${base(orgId)}/preview-extract`,
        form,
        { headers: { 'Content-Type': undefined } },
      )
      .then((r) => r.data)
  },
}
