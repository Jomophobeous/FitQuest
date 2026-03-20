import { safeWarn } from './logger';
import Constants from 'expo-constants';

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
    if (__DEV__) console.log('[Observability] Crash reporting skipped (no EXPO_PUBLIC_SENTRY_DSN)');
    return;
  }

  try {
    const Sentry = require('@sentry/react-native');
    const appVersion = Constants.expoConfig?.version ?? '0.0.0';
    Sentry.init({
      dsn,
      environment: __DEV__ ? 'development' : 'production',
      release: `com.hugelet.fitquest@${appVersion}`,
      enableInExpoDevelopment: false,
      debug: false,
      tracesSampleRate: 0.2,
      attachScreenshot: true,
      enableNativeFramesTracking: true,
    });
  } catch {
    safeWarn('[Observability] @sentry/react-native not available; external crash reporting skipped');
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.captureException(error, {
      extra: context,
    });
  } catch {
    // no-op fallback
  }
}

export function capturePerformanceMetric(name: string, durationMs: number): void {
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${name}:${durationMs}`,
      level: 'info',
    });
  } catch {
    // no-op fallback
  }
}

/**
 * Disable Sentry crash reporting.
 * Called when user withdraws consent in Legal Center.
 */
export function disableCrashReporting(): void {
  try {
    const Sentry = require('@sentry/react-native');
    const client = Sentry.getClient();
    if (client) {
      client.getOptions().enabled = false;
    }
  } catch {
    // no-op fallback
  }
}

/**
 * Re-enable Sentry crash reporting.
 * Called when user re-accepts consent in Legal Center.
 */
export function enableCrashReporting(): void {
  try {
    const Sentry = require('@sentry/react-native');
    const client = Sentry.getClient();
    if (client) {
      client.getOptions().enabled = true;
    }
  } catch {
    // no-op fallback
  }
}
