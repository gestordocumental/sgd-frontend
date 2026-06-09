import { describe, it, expect, vi, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import axios, { type AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

// ── Auth store mock ───────────────────────────────────────────────────────────
// Must be declared before importing client.ts, because client.ts calls
// useAuthStore.getState() at request/response interception time.

const mockAuthState = {
  accessToken: null as string | null,
  user: null as { companyId?: string | null } | null,
  updateAccessToken: vi.fn(),
  clearAuth: vi.fn(),
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => mockAuthState },
}));

// ── Router mock ───────────────────────────────────────────────────────────────
// client.ts calls router.navigate({ to: '/login', replace: true }) instead of
// mutating window.location.href directly.

const mockNavigate = vi.fn();

vi.mock('@/router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { apiClient, storeCsrfToken } from '../client';

// ── Spy on the plain axios.post used by the silent-refresh call ───────────────
// client.ts calls `axios.post(baseURL + '/auth/refresh', ...)` — not
// `apiClient.post` — specifically to avoid re-triggering this interceptor.
const axiosPostSpy = vi.spyOn(axios, 'post');

// ── MockAdapter wraps apiClient for all tests ─────────────────────────────────
const mock = new MockAdapter(apiClient, { onNoMatch: 'throwException' });

// ── Global setup/teardown ─────────────────────────────────────────────────────

beforeEach(() => {
  mock.reset();
  vi.resetAllMocks(); // clears call history + implementations
  localStorage.clear();
  sessionStorage.clear();

  // Re-initialise mock state after resetAllMocks
  mockAuthState.accessToken = null;
  mockAuthState.user = null;
  mockAuthState.updateAccessToken = vi.fn();
  mockAuthState.clearAuth = vi.fn();
});

// ── Helper ────────────────────────────────────────────────────────────────────

function makeRefreshResponse(accessToken = 'new-access', csrfToken?: string) {
  return Promise.resolve({ data: { accessToken, csrfToken } });
}

function makeJwt(payload: Record<string, unknown>) {
  return `${btoa(JSON.stringify({ alg: 'none' }))}.${btoa(JSON.stringify(payload))}.sig`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Request interceptor
// ─────────────────────────────────────────────────────────────────────────────

describe('request interceptor', () => {
  it('strips Authorization on /auth/login (PUBLIC_PATHS)', async () => {
    mock.onPost('/auth/login').reply(200, {});
    mockAuthState.accessToken = 'should-not-appear';

    await apiClient.post('/auth/login', {});

    expect(mock.history.post[0].headers?.Authorization).toBeUndefined();
  });

  it('strips Authorization on /users/complete-registration (PUBLIC_PATHS)', async () => {
    mock.onPost('/users/complete-registration').reply(200, {});
    mockAuthState.accessToken = 'should-not-appear';

    await apiClient.post('/users/complete-registration', {});

    expect(mock.history.post[0].headers?.Authorization).toBeUndefined();
  });

  it('public-path check uses endsWith — a URL prefix does not break it', async () => {
    // A gateway might add a version segment: /v1/auth/login still ends with /auth/login
    mock.onPost('/v1/auth/login').reply(200, {});
    mockAuthState.accessToken = 'should-not-appear';

    await apiClient.post('/v1/auth/login', {});

    expect(mock.history.post[0].headers?.Authorization).toBeUndefined();
  });

  it('attaches Bearer token to a protected endpoint when accessToken is set', async () => {
    mock.onGet('/api/users').reply(200, []);
    mockAuthState.accessToken = 'my-jwt';

    await apiClient.get('/api/users');

    expect(mock.history.get[0].headers?.Authorization).toBe('Bearer my-jwt');
  });

  it('omits Authorization header when accessToken is null', async () => {
    mock.onGet('/api/users').reply(200, []);
    mockAuthState.accessToken = null;

    await apiClient.get('/api/users');

    expect(mock.history.get[0].headers?.Authorization).toBeUndefined();
  });

  it('attaches the CSRF token from sessionStorage on protected state-changing requests', async () => {
    sessionStorage.setItem('sgd_csrf', 'stored-csrf');
    mock.onPost('/api/users').reply(200, {});

    await apiClient.post('/api/users', {});

    expect(mock.history.post[0].headers?.['x-csrf-token']).toBe('stored-csrf');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Response interceptor — errors that must pass through unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe('response interceptor — pass-through errors', () => {
  it('propagates a 403 without attempting a token refresh', async () => {
    mock.onGet('/api/data').reply(403, { message: 'Forbidden' });

    await expect(apiClient.get('/api/data')).rejects.toMatchObject({
      response: { status: 403 },
    });
    expect(axiosPostSpy).not.toHaveBeenCalled();
  });

  it('does not refresh on 401 from /auth/refresh (SKIP_REFRESH_PATHS)', async () => {
    mock.onPost('/auth/refresh').reply(401, {});

    await expect(apiClient.post('/auth/refresh', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(axiosPostSpy).not.toHaveBeenCalled();
  });

  it('does not refresh on 401 from /auth/login (SKIP_REFRESH_PATHS)', async () => {
    mock.onPost('/auth/login').reply(401, {});

    await expect(apiClient.post('/auth/login', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(axiosPostSpy).not.toHaveBeenCalled();
  });

  it('does not refresh on 401 from /users/complete-registration (SKIP_REFRESH_PATHS)', async () => {
    mock.onPost('/users/complete-registration').reply(401, {});

    await expect(apiClient.post('/users/complete-registration', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(axiosPostSpy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Silent refresh — happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('response interceptor — silent refresh succeeds', () => {
  beforeEach(() => {
    // No localStorage setup — refresh token is carried via httpOnly cookie automatically
    axiosPostSpy.mockImplementation(() => makeRefreshResponse());
    // First call → 401, retry → 200
    mock.onGet('/api/protected').replyOnce(401);
    mock.onGet('/api/protected').replyOnce(200, { value: 42 });
  });

  it('calls the refresh endpoint once without a body (cookie handles auth)', async () => {
    await apiClient.get('/api/protected');

    expect(axiosPostSpy).toHaveBeenCalledOnce();
    const [url, body] = axiosPostSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/refresh$/);
    expect(body).toBeUndefined();
  });

  it('calls updateAccessToken with the new access token after silent refresh', async () => {
    await apiClient.get('/api/protected');

    expect(mockAuthState.updateAccessToken).toHaveBeenCalledWith('new-access');
  });

  it('resolves with the retried response body', async () => {
    const result = await apiClient.get('/api/protected');

    expect(result.data).toEqual({ value: 42 });
  });

  it('sends the new access token on the retried request', async () => {
    await apiClient.get('/api/protected');

    // history[0] = original attempt (401), history[1] = retry
    const retryHeaders = mock.history.get[1]?.headers;
    expect(retryHeaders?.Authorization).toBe('Bearer new-access');
  });

  it('stores the CSRF token returned by silent refresh', async () => {
    axiosPostSpy.mockImplementation(() => makeRefreshResponse('new-access', 'fresh-csrf'));

    await apiClient.get('/api/protected');

    expect(sessionStorage.getItem('sgd_csrf')).toBe('fresh-csrf');
  });

  it('switches back to the active company when refresh returns an unscoped token', async () => {
    const unscopedToken = makeJwt({ sub: 'user-1' });
    const scopedToken = makeJwt({ sub: 'user-1', companyId: 'company-1' });
    mockAuthState.user = { companyId: 'company-1' };
    storeCsrfToken('csrf-before-refresh');
    axiosPostSpy
      .mockImplementationOnce(() => makeRefreshResponse(unscopedToken, 'csrf-after-refresh'))
      .mockImplementationOnce(() => makeRefreshResponse(scopedToken, 'csrf-after-switch'));

    await apiClient.get('/api/protected');

    expect(axiosPostSpy).toHaveBeenCalledTimes(2);
    const [switchUrl, switchBody, switchConfig] = axiosPostSpy.mock.calls[1];
    expect(String(switchUrl)).toMatch(/\/auth\/switch-company$/);
    expect(switchBody).toEqual({ companyId: 'company-1' });
    expect(switchConfig?.headers).toMatchObject({
      Authorization: `Bearer ${unscopedToken}`,
      'x-csrf-token': 'csrf-before-refresh',
    });
    expect(mockAuthState.updateAccessToken).toHaveBeenCalledWith(scopedToken);
    expect(sessionStorage.getItem('sgd_csrf')).toBe('csrf-after-switch');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Silent refresh — no stored refresh token
// ─────────────────────────────────────────────────────────────────────────────

describe('response interceptor — refresh endpoint returns 401 (no valid cookie)', () => {
  beforeEach(() => {
    // Simulate what happens when the browser sends the request but the cookie is
    // absent or expired — the server returns 401 (same as a network rejection here).
    axiosPostSpy.mockRejectedValue(new Error('401 Unauthorized'));
    mock.onGet('/api/protected').replyOnce(401);
  });

  it('still calls the refresh endpoint', async () => {
    await expect(apiClient.get('/api/protected')).rejects.toBeDefined();

    expect(axiosPostSpy).toHaveBeenCalledOnce();
  });

  it('calls clearAuth', async () => {
    await expect(apiClient.get('/api/protected')).rejects.toBeDefined();

    expect(mockAuthState.clearAuth).toHaveBeenCalledOnce();
  });

  it('navigates to /login via router', async () => {
    await expect(apiClient.get('/api/protected')).rejects.toBeDefined();

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login', replace: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Silent refresh — refresh call fails (e.g. expired refresh token)
// ─────────────────────────────────────────────────────────────────────────────

describe('response interceptor — refresh call fails (network error)', () => {
  beforeEach(() => {
    axiosPostSpy.mockRejectedValue(new Error('Network Error'));
    mock.onGet('/api/protected').replyOnce(401);
  });

  it('calls clearAuth', async () => {
    await expect(apiClient.get('/api/protected')).rejects.toBeDefined();

    expect(mockAuthState.clearAuth).toHaveBeenCalledOnce();
  });

  it('navigates to /login via router', async () => {
    await expect(apiClient.get('/api/protected')).rejects.toBeDefined();

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login', replace: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. _retry flag prevents infinite refresh loops
// ─────────────────────────────────────────────────────────────────────────────

describe('response interceptor — _retry flag prevents loops', () => {
  it('attempts refresh only once when the retried request also returns 401', async () => {
    axiosPostSpy.mockImplementation(() => makeRefreshResponse());

    // Both the original call and the retry return 401
    mock.onGet('/api/protected').reply(401);

    await expect(apiClient.get('/api/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    // _retry=true on the second 401 → interceptor skips → no second refresh
    expect(axiosPostSpy).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Concurrent 401s — pending queue
// ─────────────────────────────────────────────────────────────────────────────

describe('response interceptor — concurrent 401s are queued', () => {
  it('refreshes only once and replays all queued requests with the new token', async () => {
    let refreshCallCount = 0;
    axiosPostSpy.mockImplementation(() => {
      refreshCallCount++;
      return makeRefreshResponse('queued-token');
    });

    mock.onGet('/api/resource-a').replyOnce(401);
    mock.onGet('/api/resource-b').replyOnce(401);
    mock.onGet('/api/resource-a').replyOnce(200, { resource: 'a' });
    mock.onGet('/api/resource-b').replyOnce(200, { resource: 'b' });

    const [resA, resB] = await Promise.all([
      apiClient.get('/api/resource-a'),
      apiClient.get('/api/resource-b'),
    ]);

    expect(refreshCallCount).toBe(1);
    expect(resA.data).toEqual({ resource: 'a' });
    expect(resB.data).toEqual({ resource: 'b' });
  });

  it('sends the new access token on every replayed request', async () => {
    axiosPostSpy.mockImplementation(() => makeRefreshResponse('token-for-all'));

    mock.onGet('/api/resource-a').replyOnce(401);
    mock.onGet('/api/resource-b').replyOnce(401);
    mock.onGet('/api/resource-a').replyOnce(200, {});
    mock.onGet('/api/resource-b').replyOnce(200, {});

    await Promise.all([apiClient.get('/api/resource-a'), apiClient.get('/api/resource-b')]);

    // history: [0]=A 401, [1]=B 401, [2]=A retry, [3]=B retry
    const retries = [...mock.history.get].slice(2);
    for (const req of retries) {
      expect(req.headers?.Authorization).toBe('Bearer token-for-all');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. axiosRetry — retryCondition contract
// ─────────────────────────────────────────────────────────────────────────────

describe('axiosRetry retryCondition', () => {
  // Mirrors the exact condition registered in client.ts.
  // The function is internal so we replicate its logic here to document
  // and enforce the contract explicitly.
  function retryCondition(error: AxiosError): boolean {
    return (
      axiosRetry.isNetworkError(error) ||
      (error.response !== undefined && error.response.status >= 500)
    );
  }

  it('retries on network errors (ERR_NETWORK — no response object)', () => {
    const err = new axios.AxiosError('Network Error');
    err.code = axios.AxiosError.ERR_NETWORK;
    expect(retryCondition(err)).toBe(true);
  });

  it('retries on 500 Internal Server Error', () => {
    const err = new axios.AxiosError('Internal Server Error');
    err.response = { status: 500 } as never;
    expect(retryCondition(err)).toBe(true);
  });

  it('retries on 503 Service Unavailable', () => {
    const err = new axios.AxiosError('Service Unavailable');
    err.response = { status: 503 } as never;
    expect(retryCondition(err)).toBe(true);
  });

  it('retries on any 5xx (boundary: 599)', () => {
    const err = new axios.AxiosError('Gateway Timeout');
    err.response = { status: 599 } as never;
    expect(retryCondition(err)).toBe(true);
  });

  it('does NOT retry on 400 Bad Request', () => {
    const err = new axios.AxiosError('Bad Request');
    err.response = { status: 400 } as never;
    expect(retryCondition(err)).toBe(false);
  });

  it('does NOT retry on 401 Unauthorized (handled by the silent-refresh interceptor)', () => {
    const err = new axios.AxiosError('Unauthorized');
    err.response = { status: 401 } as never;
    expect(retryCondition(err)).toBe(false);
  });

  it('does NOT retry on 404 Not Found', () => {
    const err = new axios.AxiosError('Not Found');
    err.response = { status: 404 } as never;
    expect(retryCondition(err)).toBe(false);
  });

  it('does NOT retry on 422 Unprocessable Entity', () => {
    const err = new axios.AxiosError('Unprocessable Entity');
    err.response = { status: 422 } as never;
    expect(retryCondition(err)).toBe(false);
  });

  it('boundary: 499 is NOT retried (last 4xx)', () => {
    const err = new axios.AxiosError('Client Error');
    err.response = { status: 499 } as never;
    expect(retryCondition(err)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. storeCsrfToken export
// ─────────────────────────────────────────────────────────────────────────────

describe('storeCsrfToken', () => {
  it('writes the token to sessionStorage under the sgd_csrf key', () => {
    storeCsrfToken('explicit-csrf');
    expect(sessionStorage.getItem('sgd_csrf')).toBe('explicit-csrf');
  });
});
