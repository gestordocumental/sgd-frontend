import '@/instrument'; // must be first — initializes Sentry before any other module
import '@/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { router } from './router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CrashPage } from '@/components/CrashPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60 s fallback for any query that does not set its own staleTime.
      // Individual hooks override this per data-freshness requirements:
      //   reference data (roles, org-structure)    → 300 000 ms
      //   operational data (workflows, users)      → 30 000–120 000 ms
      //   SSE-driven data (notifications, history) → 30 000 ms
      // Real-time freshness for SSE-driven data comes from invalidateQueries
      // fired on push events, not from staleTime: 0. Using 0 causes every
      // React 19 Strict Mode double-mount to fire a duplicate request.
      staleTime: 60_000,
      retry: 1,
    },
  },
});

// Inject the real queryClient now that it has been created.
router.update({ context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

async function init() {
  // Activa los mocks de MSW solo cuando VITE_USE_MOCKS=true
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary fallback={<CrashPage />}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

init();
