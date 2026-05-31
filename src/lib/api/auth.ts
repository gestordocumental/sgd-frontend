import { apiClient } from './client';
import type { LoginCredentials, LoginResponse } from '@/types/auth';

export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post<LoginResponse>('/auth/login', credentials).then((r) => r.data),

  logout: () => apiClient.post<void>('/auth/logout').then((r) => r.data),

  getMyCompanies: () => apiClient.get<string[]>('/auth/me/companies').then((r) => r.data),

  switchCompany: (companyId: string) =>
    apiClient
      .post<Pick<LoginResponse, 'accessToken'>>('/auth/switch-company', { companyId })
      .then((r) => r.data),

  exitCompany: () =>
    apiClient.post<Pick<LoginResponse, 'accessToken'>>('/auth/exit-company').then((r) => r.data),

  forgotPassword: (email: string) =>
    apiClient.post<{ ok: true }>('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, newPassword: string) =>
    apiClient
      .post<{ ok: true }>('/auth/reset-password', { token, newPassword })
      .then((r) => r.data),
};
