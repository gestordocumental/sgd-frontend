import { describe, it, expect } from 'vitest';
import { decodeJwt, isJwtPayload } from '../jwt';

// Helper: build a minimal JWT with the given payload (no signature needed for decoding)
function buildToken(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

// Helper: build a JWT with URL-safe base64 chars in the payload segment
function buildTokenUrlSafe(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  // Replace standard base64 chars with URL-safe equivalents
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${body}.fakesig`;
}

describe('decodeJwt', () => {
  it('returns null for empty string', () => {
    expect(decodeJwt('')).toBeNull();
  });

  it('returns null for a string with fewer than 2 dots', () => {
    expect(decodeJwt('onlyone')).toBeNull();
    expect(decodeJwt('two.parts')).toBeNull();
  });

  it('returns null for a token with invalid base64 payload', () => {
    expect(decodeJwt('header.!!!invalid!!!.sig')).toBeNull();
  });

  it('decodes a valid token and returns the payload', () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      exp: 9999999999,
      iat: 1000000000,
      iss: 'sgd',
    };
    const token = buildToken(payload);
    const result = decodeJwt(token);
    expect(result).not.toBeNull();
    expect(result?.sub).toBe('user-123');
    expect(result?.email).toBe('test@example.com');
    expect(result?.exp).toBe(9999999999);
  });

  it('decodes a token with URL-safe base64 characters (- and _)', () => {
    const payload = { sub: 'user-456', email: 'url@safe.com', exp: 9999999999, iat: 1, iss: 'sgd' };
    const token = buildTokenUrlSafe(payload);
    const result = decodeJwt(token);
    expect(result).not.toBeNull();
    expect(result?.sub).toBe('user-456');
  });

  it('decodes isSuperAdmin flag correctly', () => {
    const payload = {
      sub: 'admin-1',
      email: 'admin@example.com',
      exp: 9999999999,
      iat: 1,
      iss: 'sgd',
      isSuperAdmin: true,
    };
    const result = decodeJwt(buildToken(payload));
    expect(result?.isSuperAdmin).toBe(true);
  });

  it('returns null when the token is undefined-like (handled via optional chaining)', () => {
    // @ts-expect-error testing undefined input
    expect(decodeJwt(undefined)).toBeNull();
  });
});

describe('isJwtPayload — structural validation', () => {
  const VALID = { sub: 'u-1', email: 'a@b.com', iss: 'sgd', iat: 1, exp: 9999999999 };

  // ── required fields ──────────────────────────────────────────────────────

  it('accepts a payload with the minimum required fields (sub + exp)', () => {
    expect(isJwtPayload({ sub: 'u-1', exp: 9999999999 })).toBe(true);
  });

  it('accepts a fully-populated valid payload', () => {
    expect(isJwtPayload(VALID)).toBe(true);
  });

  it('accepts optional fields with correct types (isSuperAdmin, companyId)', () => {
    expect(isJwtPayload({ ...VALID, isSuperAdmin: true, companyId: 'c-1' })).toBe(true);
  });

  // ── sub field ────────────────────────────────────────────────────────────

  it('rejects payload with missing sub', () => {
    const rest = Object.fromEntries(Object.entries(VALID).filter(([k]) => k !== 'sub'));
    expect(isJwtPayload(rest)).toBe(false);
  });

  it('rejects payload where sub is a number instead of a string', () => {
    expect(isJwtPayload({ ...VALID, sub: 123 })).toBe(false);
  });

  it('rejects payload where sub is an empty string', () => {
    expect(isJwtPayload({ ...VALID, sub: '' })).toBe(false);
  });

  it('rejects payload where sub is a whitespace-only string', () => {
    expect(isJwtPayload({ ...VALID, sub: '   ' })).toBe(false);
  });

  // ── exp field ────────────────────────────────────────────────────────────

  it('rejects payload with missing exp — prevents treating token as perpetually valid', () => {
    const rest = Object.fromEntries(Object.entries(VALID).filter(([k]) => k !== 'exp'));
    expect(isJwtPayload(rest)).toBe(false);
  });

  it('rejects payload where exp is a string instead of a number', () => {
    expect(isJwtPayload({ ...VALID, exp: '9999999999' })).toBe(false);
  });

  it('rejects payload where exp is null', () => {
    expect(isJwtPayload({ ...VALID, exp: null })).toBe(false);
  });

  it('rejects payload where exp is Infinity — would bypass expiry check', () => {
    expect(isJwtPayload({ ...VALID, exp: Number.POSITIVE_INFINITY })).toBe(false);
  });

  it('rejects payload where exp is NaN', () => {
    expect(isJwtPayload({ ...VALID, exp: NaN })).toBe(false);
  });

  it('rejects payload where exp is 0 or negative — not a valid timestamp', () => {
    expect(isJwtPayload({ ...VALID, exp: 0 })).toBe(false);
    expect(isJwtPayload({ ...VALID, exp: -1 })).toBe(false);
  });

  // ── non-object inputs ────────────────────────────────────────────────────

  it('rejects null', () => {
    expect(isJwtPayload(null)).toBe(false);
  });

  it('rejects a plain string', () => {
    expect(isJwtPayload('not-an-object')).toBe(false);
  });

  it('rejects a number', () => {
    expect(isJwtPayload(42)).toBe(false);
  });

  it('rejects an array', () => {
    expect(isJwtPayload(['sub', 'exp'])).toBe(false);
  });

  // ── decodeJwt integration ────────────────────────────────────────────────

  it('decodeJwt returns null for a token whose payload lacks sub', () => {
    const body = btoa(JSON.stringify({ exp: 9999999999 }));
    expect(decodeJwt(`hdr.${body}.sig`)).toBeNull();
  });

  it('decodeJwt returns null for a token whose payload lacks exp', () => {
    const body = btoa(JSON.stringify({ sub: 'u-1' }));
    expect(decodeJwt(`hdr.${body}.sig`)).toBeNull();
  });

  it('decodeJwt returns null when exp is a string (NaN expiry attack vector)', () => {
    const body = btoa(JSON.stringify({ sub: 'u-1', exp: '9999999999' }));
    expect(decodeJwt(`hdr.${body}.sig`)).toBeNull();
  });
});
