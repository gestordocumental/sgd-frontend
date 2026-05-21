import { apiClient } from './client'
import type { LoginCredentials, LoginResponse } from '@/types/auth'

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<LoginResponse>('/auth/login', credentials).then((r) => r.data),

  logout: () =>
    apiClient.post<void>('/auth/logout').then((r) => r.data),

  refreshToken: (refreshToken: string) =>
    apiClient
      .post<Pick<LoginResponse, 'accessToken' | 'refreshToken'>>('/auth/refresh', { refreshToken })
      .then((r) => r.data),

  getMyCompanies: () =>
    apiClient.get<string[]>('/auth/me/companies').then((r) => r.data),

  switchCompany: (companyId: string) =>
    apiClient
      .post<Pick<LoginResponse, 'accessToken' | 'refreshToken'>>('/auth/switch-company', { companyId })
      .then((r) => r.data),
}
