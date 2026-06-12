import * as Sentry from '@sentry/react';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

// https://web.dev/articles/vitals — measurement units per metric
const VITAL_UNIT: Record<string, string> = {
  CLS: 'none',
  FCP: 'millisecond',
  INP: 'millisecond',
  LCP: 'millisecond',
  TTFB: 'millisecond',
};

function reportVital(metric: Metric): void {
  const unit = VITAL_UNIT[metric.name] ?? 'millisecond';

  // Attach measurement to the active Sentry span (pageload/navigation transaction).
  // No-op when no span is active (e.g. CLS fires on page unload after span closed).
  Sentry.setMeasurement(metric.name, metric.value, unit);

  // Always add a breadcrumb — appears in the error trail when a user also hits an error.
  Sentry.addBreadcrumb({
    type: 'debug',
    category: 'web-vitals',
    message: `${metric.name}: ${metric.rating}`,
    data: {
      value: unit === 'millisecond' ? `${Math.round(metric.value)}ms` : metric.value.toFixed(3),
      id: metric.id,
    },
    level: metric.rating === 'poor' ? 'warning' : 'info',
  });

  // Surface poor vitals as a dedicated Sentry warning so they appear in Issues/Alerts.
  if (metric.rating === 'poor') {
    Sentry.captureEvent({
      message: `Poor Web Vital: ${metric.name}`,
      level: 'warning',
      tags: { web_vital: metric.name },
      extra: { value: metric.value, id: metric.id },
      // Deduplicate by metric name — one issue per vital, not per user.
      fingerprint: ['web-vital-poor', metric.name],
    });
  }
}

/**
 * Registers Core Web Vitals observers and pipes results to Sentry.
 * Call once after `Sentry.init()`, in production only.
 */
export function initWebVitals(): void {
  onCLS(reportVital);
  onFCP(reportVital);
  onINP(reportVital);
  onLCP(reportVital);
  onTTFB(reportVital);
}
