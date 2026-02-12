import { safeWarn } from './logger';

let initialized = false;

function getSentryDsn(): string | null {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || !dsn.trim()) return null;
  return dsn.trim();
}

export function initializeCrashReporting(): void {
  if (initialized) return;
  initialized = true;

  const dsn = getSentryDsn();
  if (!dsn) {
    safeWarn('[Observability] External crash reporting disabled (missing EXPO_PUBLIC_SENTRY_DSN)');
    return;
  }

  try {
    const sentryExpo = require('sentry-expo');
    sentryExpo.Sentry.init({
      dsn,
      enableInExpoDevelopment: false,
      debug: false,
    });
  } catch {
    safeWarn('[Observability] sentry-expo not installed; external crash reporting skipped');
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    const sentryExpo = require('sentry-expo');
    sentryExpo.Sentry.Native.captureException(error, {
      extra: context,
    });
  } catch {
    // no-op fallback
  }
}

export function capturePerformanceMetric(name: string, durationMs: number): void {
  try {
    const sentryExpo = require('sentry-expo');
    sentryExpo.Sentry.Native.addBreadcrumb({
      category: 'performance',
      message: `${name}:${durationMs}`,
      level: 'info',
    });
  } catch {
    // no-op fallback
  }
}
