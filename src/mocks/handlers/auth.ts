import { http, HttpResponse } from 'msw';
import type { LoginResponse } from '@/types/auth';

const MOCK_USER = {
  id: 'usr-001',
  email: 'admin@sgd.helisa.com',
  name: 'Administrador SGD',
  role: 'ADMIN',
  departmentId: 'dept-001',
};

export const authHandlers = [
  http.post('*/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === 'admin@sgd.helisa.com' && body.password === 'admin123') {
      return HttpResponse.json<LoginResponse>({
        accessToken: 'mock.jwt.access-token',
        user: MOCK_USER,
      });
    }

    return HttpResponse.json(
      { message: 'Invalid credentials. Please check your email and password.' },
      { status: 401 },
    );
  }),

  http.post('*/auth/logout', () => {
    return HttpResponse.json({ message: 'Session closed successfully' });
  }),

  http.post('*/auth/refresh', () => {
    return HttpResponse.json({ accessToken: 'mock.jwt.access-token.refreshed' });
  }),
];
