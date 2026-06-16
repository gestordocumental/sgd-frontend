import * as Sentry from '@sentry/react';
import { initWebVitals } from '@/lib/vitals';

// Sentry is initialized only when VITE_SENTRY_DSN is set.
// Events are sent only in production (import.meta.env.PROD === true).
// In development/test environments, Sentry is disabled via `enabled: false`.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // Sample 100% of pageload/navigation spans so Web Vitals are captured for every user.
    // All other spans (API calls, interactions) are sampled at 10% to limit quota.
    tracesSampler: (ctx) => {
      const op = ctx.attributes?.['sentry.op'];
      if (op === 'pageload' || op === 'navigation') return 1.0;
      return 0.1;
    },
    // Do not send events in non-production environments.
    enabled: import.meta.env.PROD,
  });

  if (import.meta.env.PROD) {
    initWebVitals();
  }
}
