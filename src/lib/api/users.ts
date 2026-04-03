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
  email: string;
  registrationStatus: 'pending_credentials' | 'active';
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiUserWithRoles extends ApiUser {
  roles: ApiUserRole[];
}

export interface CreateUserDto {
  position: string;
  email: string;
  isSuperAdmin?: boolean;
  orgId?: string;
  roleId?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  idNumber?: string;
  position?: string;
  isActive?: boolean;
}

export interface UserOrgRoleResponseDto {
  id: string
  userId: string
  orgId: string
  roleId: string
  assignedBy: string | null
  createdAt: string
}

export interface CompleteRegistrationDto {
  token: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  password: string;
}

export const usersApi = {
  list: () => apiClient.get<ApiUser[]>("/users").then((r) => r.data),

  listSuperAdmin: () =>
    apiClient.get<ApiUser[]>("/users/super-admins").then((r) => r.data),

  listUsersByOrg: (orgId: string): Promise<ApiUserWithRoles[]> =>
    apiClient.get<ApiUserWithRoles[]>(`/users/by-org/${orgId}`).then((r) => r.data),

  create: (dto: CreateUserDto) =>
    apiClient.post<ApiUser>("/users", dto).then((r) => r.data),

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

  assignUserToOrg: (userId: string, orgId: string, roleId: string) =>
    apiClient
      .post<UserOrgRoleResponseDto>(`/users/${userId}/orgs`, { orgId, roleId })
      .then((r) => r.data),

  removeUserFromOrg: (userId: string, orgId: string) =>
    apiClient
      .delete<void>(`/users/${userId}/orgs/${orgId}`)
      .then((r) => r.data),

  // Endpoint público — no requiere JWT. Valida el token de invitación en Redis,
  // completa el perfil del usuario y crea sus credenciales.
  // Backend: POST /users/complete-registration
  completeRegistration: (dto: CompleteRegistrationDto) =>
    apiClient
      .post<void>("/users/complete-registration", dto)
      .then((r) => r.data),
};
