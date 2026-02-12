import { getAppState, setAppState } from '../database/service';
import { captureException, capturePerformanceMetric } from './crashReporting';
import { redactForLog, safeWarn } from './logger';

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

export async function logEvent(name: string, data?: Record<string, unknown>): Promise<void> {
  await appendTelemetry({
    id: makeId(),
    type: 'event',
    name,
    data,
    timestamp: Date.now(),
  });
}

export async function logPerf(
  name: string,
  durationMs: number,
  data?: Record<string, unknown>
): Promise<void> {
  capturePerformanceMetric(name, durationMs);
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
  await appendTelemetry({
    id: makeId(),
    type: 'error',
    name: error instanceof Error ? error.name : 'Error',
    message,
    data: sanitized,
    timestamp: Date.now(),
  });
}
