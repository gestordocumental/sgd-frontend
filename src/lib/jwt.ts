import type { JwtPayload } from '@/types/auth';

// Runtime guard for the two fields that cause security/reliability failures when absent:
//   exp  — missing exp makes the expiry check (exp * 1000 < Date.now()) evaluate to
//           NaN < timestamp → false, so a structurally invalid token is treated as
//           perpetually valid.
//   sub  — missing sub silently sets the user ID to '' throughout the auth store.
// Optional fields (email, isSuperAdmin, companyId, iss, iat) are accessed with
// optional chaining at every call site and fail gracefully, so they are not validated here.
function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p['sub'] === 'string' && p['sub'].length > 0 && typeof p['exp'] === 'number';
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token?.split('.');
    if (!parts || parts.length < 2) return null;
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(padded));
    return isJwtPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export { isJwtPayload };
