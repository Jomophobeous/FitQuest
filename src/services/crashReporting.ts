import { safeWarn } from './logger';
import Constants from 'expo-constants';

let initialized = false;
let sessionErrorCount = 0;

function getSentryDsn(): string | null {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || !dsn.trim()) return null;
  return dsn.trim();
}

export function initializeCrashReporting(): void {
  if (initialized) return;
  initialized = true;
  sessionErrorCount = 0;

  const dsn = getSentryDsn();
  if (!dsn) {
    if (__DEV__) console.warn('[Observability] Crash reporting skipped (no EXPO_PUBLIC_SENTRY_DSN)');
    return;
  }

  try {
    const Sentry = require('@sentry/react-native');
    const appVersion = Constants.expoConfig?.version ?? '0.0.0';
    const appEnv = Constants.expoConfig?.extra?.appEnv || (__DEV__ ? 'development' : 'production');
    Sentry.init({
      dsn,
      environment: appEnv,
      release: `com.hugelet.fitquest@${appVersion}`,
      enableInExpoDevelopment: false,
      debug: false,
      tracesSampleRate: 0.2,
      attachScreenshot: true,
      enableNativeFramesTracking: true,
      beforeSend(event: any) {
        event.tags = { ...event.tags, session_error_count: String(sessionErrorCount) };
        return event;
      },
    });
    // Set default user context (offline-first, single local user)
    Sentry.setUser({ id: 'user_local_001' });
    Sentry.setTag('app_version', appVersion);
  } catch {
    safeWarn('[Observability] @sentry/react-native not available; external crash reporting skipped');
  }
}

/** Set Sentry user context when profile becomes available. */
export function setSentryUserContext(userId: string, traits?: Record<string, string>): void {
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.setUser({ id: userId, ...traits });
  } catch {
    // no-op
  }
}

/** Get current session error count (for PostHog session properties). */
export function getSessionErrorCount(): number {
  return sessionErrorCount;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  sessionErrorCount += 1;
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.captureException(error, {
      extra: { ...context, session_error_count: sessionErrorCount },
    });
  } catch {
    // no-op fallback
  }
}

/**
 * Capture a fatal/unhandled crash — higher severity than captureException.
 * Used by error boundaries and unhandled rejection handlers.
 * Marks the error as fatal in Sentry and fires an `app_crash` event to PostHog.
 */
export function captureFatalCrash(error: unknown, context?: Record<string, unknown>): void {
  sessionErrorCount += 1;
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.withScope((scope: any) => {
      scope.setLevel('fatal');
      scope.setTag('crash_type', 'unhandled');
      scope.setTag('session_error_count', String(sessionErrorCount));
      scope.setExtras({ ...context, session_error_count: sessionErrorCount });
      Sentry.captureException(error);
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

/**
 * SENTRY DASHBOARD ALERTING CONFIGURATION
 *
 * Configure these alert rules in https://fitquest-x4.sentry.io:
 *
 * 1. Crash Rate Alert (Issue Alert):
 *    - Condition: New issue, level = fatal
 *    - Frequency: Notify every occurrence for first 24h, then once/hour
 *    - Action: Email + Slack (if configured)
 *
 * 2. Error Budget Alert (Metric Alert):
 *    - Metric: count() where level != info
 *    - Threshold: > 50 errors in 1 hour → WARNING, > 200 → CRITICAL
 *    - Action: Email
 *
 * 3. Session Crash Rate (Metric Alert):
 *    - Metric: session.crash_rate
 *    - Threshold: > 1% → WARNING, > 5% → CRITICAL
 *    - Action: Email + Slack
 *
 * 4. Performance Regression (Metric Alert):
 *    - Metric: transaction.duration p95
 *    - Threshold: > 3000ms
 *    - Action: Email
 */
