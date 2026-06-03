import * as Sentry from '@sentry/react';
import { apiClient } from './client';

export interface ApiUserRole {
  roleId: string;
  roleName: string;
}

export interface ApiUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  position: string;
  idNumber: string | null;
  departamentoId: string | null;
  areaId: string | null;
  cargoId: string | null;
  email: string;
  registrationStatus: 'pending_credentials' | 'active';
  isActive: boolean;
  isSuperAdmin: boolean;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ApiUserWithRoles extends ApiUser {
  roles: ApiUserRole[];
  orgRemovedAt: string | null;
  /** Per-org flag: true when this user is an optional reviewer in the specific organization that returned this record. */
  isOptionalReviewer: boolean;
}

export interface CreateUserDto {
  email: string;
  isSuperAdmin?: boolean;
  orgId?: string;
  roleId?: string;
  departamentoId?: string;
  areaId?: string;
  cargoId?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  idNumber?: string;
  position?: string;
  isActive?: boolean;
  departamentoId?: string | null;
  areaId?: string | null;
  cargoId?: string | null;
}

export interface UserOrgRoleResponseDto {
  id: string;
  userId: string;
  orgId: string;
  roleId: string;
  assignedBy: string | null;
  createdAt: string;
}

export interface ApiUserCreated extends ApiUser {
  /** Token de invitación de un solo uso (72 h). Mismo token enviado por email.
   *  @internal Consumir sólo para construir la URL de registro; no persistir en estado de UI. */
  invitationToken: string;
  /** true cuando el usuario ya existía como PENDING y se regeneró la invitación. */
  invitationResent?: boolean;
}

/** Datos mínimos que la UI necesita tras crear/reenviar una invitación.
 *  El token ya fue consumido para construir la URL y no se almacena. */
export interface InvitedUserInfo {
  email: string;
  invitationUrl: string;
  invitationResent?: boolean;
}

export interface CompleteRegistrationDto {
  token: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  password: string;
}

export interface OrgUserCount {
  orgId: string;
  total: number;
  active: number;
  inactive: number;
}

export const usersApi = {
  list: () => apiClient.get<{ data: ApiUser[]; total: number }>('/users').then((r) => r.data.data),

  countsByOrg: () =>
    apiClient.get<OrgUserCount[]>('/users/admin/counts-by-org').then((r) => r.data),

  getById: (id: string) => apiClient.get<ApiUserWithRoles>(`/users/${id}`).then((r) => r.data),

  listSuperAdmin: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive' | 'deleted' | 'pending';
  }) =>
    apiClient
      .get<{ data: ApiUser[]; total: number }>('/users/super-admins', { params })
      .then((r) => r.data),

  listUsersByOrg: (
    orgId: string,
    page = 1,
    limit = 500,
  ): Promise<{ data: ApiUserWithRoles[]; total: number }> =>
    apiClient
      .get<{
        data: ApiUserWithRoles[];
        total: number;
      }>(`/users/by-org/${orgId}`, { params: { page, limit } })
      .then((r) => {
        const result = r.data;
        if (result.total > limit) {
          Sentry.captureMessage(
            `listUsersByOrg truncated: ${result.total} > ${limit} for org ${orgId}`,
            { level: 'warning' },
          );
        }
        return result;
      }),

  create: (dto: CreateUserDto) => apiClient.post<ApiUserCreated>('/users', dto).then((r) => r.data),

  update: (id: string, dto: UpdateUserDto) =>
    apiClient.patch<ApiUser>(`/users/${id}`, dto).then((r) => r.data),

  remove: (id: string) => apiClient.delete<void>(`/users/${id}`).then((r) => r.data),

  restore: (id: string) => apiClient.post<ApiUser>(`/users/${id}/restore`).then((r) => r.data),

  disable: (id: string) => apiClient.patch<ApiUser>(`/users/${id}/disable`).then((r) => r.data),

  enable: (id: string) => apiClient.patch<ApiUser>(`/users/${id}/enable`).then((r) => r.data),

  toggleSuperAdmin: (id: string, enabled: boolean) =>
    apiClient.patch<ApiUser>(`/users/${id}/super-admin`, { enabled }).then((r) => r.data),

  assignUserToOrg: (userId: string, orgId: string, roleId?: string) =>
    apiClient
      .post<UserOrgRoleResponseDto>(`/users/${userId}/orgs`, { orgId, roleId })
      .then((r) => r.data),

  removeUserFromOrg: (userId: string, orgId: string) =>
    apiClient.delete<void>(`/users/${userId}/orgs/${orgId}`).then((r) => r.data),

  setOptionalReviewer: (userId: string, orgId: string, value: boolean) =>
    apiClient
      .patch<void>(`/users/${userId}/orgs/${orgId}/optional-reviewer`, { value })
      .then((r) => r.data),

  // No USERS:READ required — a user can always read their own roles in their current company
  getMyOrgRoles: () =>
    apiClient.get<UserOrgRoleResponseDto[]>('/users/me/org-roles').then((r) => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return apiClient
      .patch<ApiUser>('/users/me/avatar', form, {
        // Remove the default 'application/json' so axios sets
        // 'multipart/form-data; boundary=...' automatically for FormData.
        headers: { 'Content-Type': undefined },
      })
      .then((r) => r.data);
  },

  resendInvitation: (id: string) =>
    apiClient
      .post<ApiUserCreated>(`/users/${id}/resend-invitation`)
      .then((r) => ({ ...r.data, invitationResent: true as const })),

  // Endpoint público — no requiere JWT. Valida el token de invitación en Redis,
  // completa el perfil del usuario y crea sus credenciales.
  // Backend: POST /users/complete-registration
  completeRegistration: (dto: CompleteRegistrationDto) =>
    apiClient.post<void>('/users/complete-registration', dto).then((r) => r.data),
};
