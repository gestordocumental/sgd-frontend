import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRoute({
  component: () => (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:border-border focus:rounded-md focus:shadow-md"
      >
        Saltar al contenido
      </a>
      <Outlet />
      <Toaster position="top-center" richColors />
      {import.meta.env.DEV && !import.meta.env.VITE_E2E && <TanStackRouterDevtools />}
    </>
  ),
});
