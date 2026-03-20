export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  isSuperAdmin?: boolean
  departmentId?: string
  companyId?: string
  companyName?: string
}

export interface JwtPayload {
  sub: string
  email: string
  iss: string
  iat: number
  exp: number
  isSuperAdmin?: boolean
  companyId?: string
}

export interface Company {
  id: string
  name: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}
