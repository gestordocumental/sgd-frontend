import { apiClient } from './client'
import type { LoginCredentials, LoginResponse } from '@/types/auth'

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient
      .post<LoginResponse>('/auth/login', credentials)
      .then((r) => r.data),

  logout: () =>
    apiClient.post<void>('/auth/logout').then((r) => r.data),

  refreshToken: (refreshToken: string) =>
    apiClient
      .post<Pick<LoginResponse, 'accessToken'>>('/auth/refresh', { refreshToken })
      .then((r) => r.data),
}
