import type { JwtPayload } from '@/types/auth'

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token?.split('.')
    if (!parts || parts.length < 2) return null
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(padded)) as JwtPayload
  } catch {
    return null
  }
}
