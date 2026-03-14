import { apiClient } from './client'

export interface ApiUser {
  id: string
  name: string
  email: string
  isSuperAdmin: boolean
  createdAt: string
  deletedAt?: string | null
}

export interface CreateUserDto {
  position: string
  email: string
}

export interface UpdateUserDto {
  name?: string
  email?: string
}

export const usersApi = {
  list: () =>
    apiClient.get<ApiUser[]>('/users').then((r) => r.data),

  create: (dto: CreateUserDto) =>
    apiClient.post<ApiUser>('/users', dto).then((r) => r.data),

  update: (id: string, dto: UpdateUserDto) =>
    apiClient.patch<ApiUser>(`/users/${id}`, dto).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<void>(`/users/${id}`).then((r) => r.data),

  restore: (id: string) =>
    apiClient.post<ApiUser>(`/users/${id}/restore`).then((r) => r.data),

  toggleSuperAdmin: (id: string, isSuperAdmin: boolean) =>
    apiClient.patch<ApiUser>(`/users/${id}/super-admin`, { isSuperAdmin }).then((r) => r.data),
}
