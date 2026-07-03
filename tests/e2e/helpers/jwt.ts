/**
 * Build a syntactically valid but cryptographically unsigned JWT for E2E tests.
 *
 * The payload is standard Base64-encoded so the app's `decodeJwt()` helper —
 * which calls `atob(payload.replace(/-/g,'+').replace(/_\//g,'/'))` — can parse it.
 * The signature segment is a fixed placeholder; no validation happens client-side.
 */
export function buildJwt(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  return `${header}.${body}.e2e-test-sig`;
}

const inOneHour = () => Math.floor(Date.now() / 1000) + 3_600;

/** JWT for a super-admin (no companyId). */
export function superAdminJwt(): string {
  return buildJwt({
    sub: 'sa-001',
    email: 'superadmin@sgd.com',
    isSuperAdmin: true,
    iss: 'sgd',
    iat: Math.floor(Date.now() / 1000),
    exp: inOneHour(),
  });
}

/** JWT for a company-scoped user. */
export function companyUserJwt(companyId = 'org-001'): string {
  return buildJwt({
    sub: 'usr-001',
    email: 'manager@company.com',
    isSuperAdmin: false,
    companyId,
    iss: 'sgd',
    iat: Math.floor(Date.now() / 1000),
    exp: inOneHour(),
  });
}

/** Global (non-company) JWT for a regular user — returned by /auth/refresh. */
export function globalUserJwt(): string {
  return buildJwt({
    sub: 'usr-001',
    email: 'manager@company.com',
    isSuperAdmin: false,
    iss: 'sgd',
    iat: Math.floor(Date.now() / 1000),
    exp: inOneHour(),
  });
}
