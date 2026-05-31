import * as Sentry from '@sentry/react';

// Sentry is initialized only when VITE_SENTRY_DSN is set.
// Events are sent only in production (import.meta.env.PROD === true).
// In development/test environments, Sentry is disabled via `enabled: false`.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    // Sample 10% of traces in production.
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
    // Do not send events in non-production environments.
    enabled: import.meta.env.PROD,
  });
}
