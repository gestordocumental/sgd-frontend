import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { useAuthStore } from '@/store/authStore';
import { useIdleTimeout } from '@/lib/use-idle-timeout';

function AuthenticatedLayout() {
  useIdleTimeout();
  return <Outlet />;
}

export const Route = createFileRoute('/dashboard')({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: AuthenticatedLayout,
});
