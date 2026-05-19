import { apiClient } from "./client";

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
  id: string
  userId: string
  orgId: string
  roleId: string
  assignedBy: string | null
  createdAt: string
}

export interface ApiUserCreated extends ApiUser {
  /** Token de invitación de un solo uso (72 h). Mismo token enviado por email. */
  invitationToken: string;
  /** true cuando el usuario ya existía como PENDING y se regeneró la invitación. */
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
  orgId: string
  total: number
  active: number
  inactive: number
}

export const usersApi = {
  list: () => apiClient.get<ApiUser[]>("/users").then((r) => r.data),

  countsByOrg: () =>
    apiClient.get<OrgUserCount[]>("/users/admin/counts-by-org").then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<ApiUserWithRoles>(`/users/${id}`).then((r) => r.data),

  listSuperAdmin: () =>
    apiClient.get<ApiUser[]>("/users/super-admins").then((r) => r.data),

  listUsersByOrg: (orgId: string): Promise<ApiUserWithRoles[]> =>
    apiClient.get<ApiUserWithRoles[]>(`/users/by-org/${orgId}`).then((r) => r.data),

  create: (dto: CreateUserDto) =>
    apiClient.post<ApiUserCreated>("/users", dto).then((r) => r.data),

  update: (id: string, dto: UpdateUserDto) =>
    apiClient.patch<ApiUser>(`/users/${id}`, dto).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete<void>(`/users/${id}`).then((r) => r.data),

  restore: (id: string) =>
    apiClient.post<ApiUser>(`/users/${id}/restore`).then((r) => r.data),

  toggleSuperAdmin: (id: string, enabled: boolean) =>
    apiClient
      .patch<ApiUser>(`/users/${id}/super-admin`, { enabled })
      .then((r) => r.data),

  assignUserToOrg: (userId: string, orgId: string, roleId?: string) =>
    apiClient
      .post<UserOrgRoleResponseDto>(`/users/${userId}/orgs`, { orgId, roleId })
      .then((r) => r.data),

  removeUserFromOrg: (userId: string, orgId: string) =>
    apiClient
      .delete<void>(`/users/${userId}/orgs/${orgId}`)
      .then((r) => r.data),

  // No USERS:READ required — a user can always read their own roles in their current company
  getMyOrgRoles: () =>
    apiClient
      .get<UserOrgRoleResponseDto[]>('/users/me/org-roles')
      .then((r) => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('avatar', file)
    return apiClient
      .patch<ApiUser>('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  resendInvitation: (id: string) =>
    apiClient
      .post<ApiUserCreated>(`/users/${id}/resend-invitation`)
      .then((r) => ({ ...r.data, invitationResent: true as const })),

  // Endpoint público — no requiere JWT. Valida el token de invitación en Redis,
  // completa el perfil del usuario y crea sus credenciales.
  // Backend: POST /users/complete-registration
  completeRegistration: (dto: CompleteRegistrationDto) =>
    apiClient
      .post<void>("/users/complete-registration", dto)
      .then((r) => r.data),
};
