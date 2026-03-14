export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  departmentId?: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}
