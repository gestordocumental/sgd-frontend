import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-center" richColors />
      {import.meta.env.DEV && !import.meta.env.VITE_E2E && <TanStackRouterDevtools />}
    </>
  ),
});
