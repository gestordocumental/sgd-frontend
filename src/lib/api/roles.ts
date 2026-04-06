import { apiClient } from './client'

export type PermissionModule = 'DOCUMENTS' | 'WORKFLOWS' | 'USERS' | 'ORGS' | 'AUDIT' | 'PLATFORM'
export type PermissionAction = 'READ' | 'WRITE' | 'DELETE' | 'APPROVE' | 'UPLOAD' | 'DOWNLOAD' | 'MANAGE'

export interface ApiPermission {
  id: string
  module: PermissionModule
  action: PermissionAction
  description: string | null
}

export interface ApiRole {
  id: string
  name: string
  description: string | null
  permissions: ApiPermission[]
  orgId: string
  createdAt: string
}

export interface CreateRoleDto {
  name: string
  description?: string
  permissionIds?: string[]
}

export interface UpdateRoleDto {
  name?: string
  description?: string
}

export const rolesApi = {
  listPermissions: () =>
    apiClient.get<ApiPermission[]>('/permissions').then((r) => r.data),

  listRoles: () =>
    apiClient.get<ApiRole[]>('/roles').then((r) => r.data),

  createRole: (dto: CreateRoleDto) =>
    apiClient.post<ApiRole>('/roles', dto).then((r) => r.data),

  updateRole: (id: string, dto: UpdateRoleDto) =>
    apiClient.patch<ApiRole>(`/roles/${id}`, dto).then((r) => r.data),

  deleteRole: (id: string) =>
    apiClient.delete<void>(`/roles/${id}`).then((r) => r.data),

  // Replaces all permissions on a role
  assignPermissions: (roleId: string, permissionIds: string[]) =>
    apiClient
      .post<ApiRole>(`/roles/${roleId}/permissions`, { permissionIds })
      .then((r) => r.data),

  removePermission: (roleId: string, permissionId: string) =>
    apiClient
      .delete<ApiRole>(`/roles/${roleId}/permissions/${permissionId}`)
      .then((r) => r.data),

}
