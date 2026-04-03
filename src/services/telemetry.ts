import { getAppState, setAppState } from '../database/service';
import { captureException, capturePerformanceMetric, captureFatalCrash, getSessionErrorCount } from './crashReporting';
import { redactForLog, safeWarn } from './logger';
import { getPostHogClient } from './posthogService';
import { tamperEngine } from './security/tamperEngine';
import { debugLogEvent } from './debugBuffer';
import { isAnalyticsEnabled, isCriticalEvent } from './analyticsOptOut';

type TelemetryType = 'error' | 'event' | 'perf';

interface TelemetryEntry {
  id: string;
  type: TelemetryType;
  name: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const TELEMETRY_KEY = 'telemetry_log';
const MAX_ENTRIES = 50;
let sequence = 0;

function makeId(): string {
  sequence += 1;
  return `telemetry_${Date.now()}_${sequence}`;
}

function safeParse(raw: string | null): TelemetryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendTelemetry(entry: TelemetryEntry): Promise<void> {
  try {
    const existingRaw = await getAppState(TELEMETRY_KEY);
    const existing = safeParse(existingRaw);
    const next = [...existing, entry].slice(-MAX_ENTRIES);
    await setAppState(TELEMETRY_KEY, JSON.stringify(next));
  } catch (error) {
    safeWarn('[Telemetry] Failed to write entry', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Forward an event to PostHog (fire-and-forget). */
async function posthogCapture(eventName: string, properties?: Record<string, unknown>): Promise<void> {
  try {
    tamperEngine.recordTelemetryEvent();
    const client = await getPostHogClient();
    if (client) {
      client.capture(eventName, properties as Record<string, any>);
    }
  } catch {
    // PostHog delivery is best-effort — never block telemetry
  }
}

export async function logEvent(name: string, data?: Record<string, unknown>): Promise<void> {
  debugLogEvent(name, data);
  if (!isAnalyticsEnabled() && !isCriticalEvent(name)) return;
  void posthogCapture(name, data);
  await appendTelemetry({
    id: makeId(),
    type: 'event',
    name,
    data,
    timestamp: Date.now(),
  });
}

export async function logPerf(name: string, durationMs: number, data?: Record<string, unknown>): Promise<void> {
  capturePerformanceMetric(name, durationMs);
  void posthogCapture(`perf_${name}`, { duration_ms: durationMs, ...data });
  await appendTelemetry({
    id: makeId(),
    type: 'perf',
    name,
    data: { durationMs, ...data },
    timestamp: Date.now(),
  });
}

export async function logError(error: unknown, context?: Record<string, unknown>): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const sanitized = redactForLog(context || {});
  captureException(error, sanitized);
  void posthogCapture('app_error', {
    error_name: error instanceof Error ? error.name : 'Error',
    error_message: message,
    ...sanitized,
  });
  await appendTelemetry({
    id: makeId(),
    type: 'error',
    name: error instanceof Error ? error.name : 'Error',
    message,
    data: sanitized,
    timestamp: Date.now(),
  });
}

/**
 * Log a fatal/unhandled crash.
 * Distinct from logError: marks as fatal in Sentry, fires `app_crash` to PostHog,
 * and includes session error count for anomaly detection.
 */
export async function logCrash(error: unknown, context?: Record<string, unknown>): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const sanitized = redactForLog(context || {});
  captureFatalCrash(error, sanitized);
  void posthogCapture('app_crash', {
    error_name: error instanceof Error ? error.name : 'Error',
    error_message: message,
    session_error_count: getSessionErrorCount(),
    ...sanitized,
  });
  await appendTelemetry({
    id: makeId(),
    type: 'error',
    name: `FATAL:${error instanceof Error ? error.name : 'Error'}`,
    message,
    data: { ...sanitized, fatal: true },
    timestamp: Date.now(),
  });
}
