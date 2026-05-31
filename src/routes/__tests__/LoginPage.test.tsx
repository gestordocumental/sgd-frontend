import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import '@/i18n';

// ── Module mocks — must be declared before any import that triggers them ───────

const mockNavigate = vi.fn();
const mockSetAuth = vi.fn();

// Mock @/router so client.ts can import it without creating a real router
vi.mock('@/router', () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), update: vi.fn() },
}));

// Mock @/store/authStore for both the component (useAuthStore selector) and
// the api client interceptor (useAuthStore.getState)
vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (s: { setAuth: typeof mockSetAuth }) => unknown) =>
      selector({ setAuth: mockSetAuth }),
    {
      getState: () => ({
        isAuthenticated: false,
        accessToken: null,
        clearAuth: vi.fn(),
        updateAccessToken: vi.fn(),
      }),
    },
  ),
}));

// Mock TanStack Router hooks used by the component
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  redirect: vi.fn(),
  useNavigate: () => mockNavigate,
}));

// Import login module AFTER mocks are in place.
// With the mocked createFileRoute, Route = the options object, so
// Route.component is the LoginPage function.
import { Route } from '../login';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Build a base64url-encoded fake JWT that decodeJwt() can parse. */
function fakeJwt(payload: object): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.fake-sig`;
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

const LoginPage = (Route as unknown as { component: React.ComponentType }).component;

// ── MSW server ────────────────────────────────────────────────────────────────

const SUPER_ADMIN_JWT = fakeJwt({
  sub: 'u-admin',
  email: 'admin@test.com',
  isSuperAdmin: true,
});

const REGULAR_JWT = fakeJwt({
  sub: 'u-regular',
  email: 'user@test.com',
  isSuperAdmin: false,
});

const COMPANY_JWT = fakeJwt({
  sub: 'u-regular',
  email: 'user@test.com',
  isSuperAdmin: false,
  companyId: 'company-1',
});

const server = setupServer(
  http.post('*/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === 'admin@test.com' && body.password === 'Admin123!') {
      return HttpResponse.json({
        accessToken: SUPER_ADMIN_JWT,
        user: null,
      });
    }

    if (body.email === 'user@test.com' && body.password === 'User1234!') {
      return HttpResponse.json({
        accessToken: REGULAR_JWT,
        user: null,
      });
    }

    return HttpResponse.json(
      { message: 'Invalid credentials. Please check your email and password.' },
      { status: 401 },
    );
  }),

  http.get('*/auth/me/companies', () => HttpResponse.json(['company-1'])),

  http.post('*/auth/switch-company', () => HttpResponse.json({ accessToken: COMPANY_JWT })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LoginPage — form rendering', () => {
  it('renders email and password inputs', () => {
    render(<LoginPage />, { wrapper: makeWrapper() });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('sign-in button is disabled until the form is valid', async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper: makeWrapper() });
    const submitBtn = screen.getByRole('button', { name: 'Sign in' });

    // Initially invalid (empty fields)
    expect(submitBtn).toBeDisabled();

    // Fill only email — still disabled
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    expect(submitBtn).toBeDisabled();

    // Fill password — now enabled
    await user.type(screen.getByLabelText('Password'), 'Secret123!');
    expect(submitBtn).not.toBeDisabled();
  });
});

describe('LoginPage — super-admin login flow', () => {
  it('calls setAuth and navigates to /dashboard/admin on success', async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper: makeWrapper() });

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'Admin123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'admin@test.com' }),
        SUPER_ADMIN_JWT,
        true, // isSuperAdmin
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard/admin' });
  });
});

describe('LoginPage — regular user login flow', () => {
  it('calls switchCompany and navigates to /dashboard', async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper: makeWrapper() });

    await user.type(screen.getByLabelText('Email'), 'user@test.com');
    await user.type(screen.getByLabelText('Password'), 'User1234!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // Wait for the company switch to complete
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' });
    });

    // setAuth is called at least once (initial global token) and then again
    // with the company-scoped token
    expect(mockSetAuth).toHaveBeenCalled();
  });
});

describe('LoginPage — error handling', () => {
  it('shows server error message on invalid credentials', async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper: makeWrapper() });

    await user.type(screen.getByLabelText('Email'), 'wrong@test.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(
        screen.getByText('Invalid credentials. Please check your email and password.'),
      ).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows fallback error message when server returns a response with no message', async () => {
    // Use a 400 (not retried by axiosRetry) with no message body to trigger the fallback
    server.use(http.post('*/auth/login', () => HttpResponse.json({}, { status: 400 })));
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper: makeWrapper() });

    await user.type(screen.getByLabelText('Email'), 'anyone@test.com');
    await user.type(screen.getByLabelText('Password'), 'AnyPass1!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(
        screen.getByText('Error connecting to the server. Please try again.'),
      ).toBeInTheDocument();
    });
  });
});

describe('LoginPage — password visibility toggle', () => {
  it('toggles password field type when the eye button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage />, { wrapper: makeWrapper() });

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByLabelText('Show password'));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByLabelText('Hide password'));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
