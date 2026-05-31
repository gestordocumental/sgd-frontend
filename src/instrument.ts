import * as Sentry from '@sentry/react';

// Sentry is initialized only when VITE_SENTRY_DSN is set.
// In development (VITE_USE_MOCKS=true or MODE=development) no events are sent
// even if a DSN is present, so local debugging is never polluted.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    // Sample 10% of traces in production; 0 in other environments.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    integrations: [Sentry.browserTracingIntegration()],
    // Do not send events in non-production environments.
    enabled: import.meta.env.PROD,
  });
}
