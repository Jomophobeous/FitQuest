import { getAppState, setAppState } from '../database/service';
import { fetchWithAuth } from './authApi';
import { getApiBaseUrl } from './apiBaseUrl';

const ANALYTICS_QUEUE_KEY = 'analytics.phase4.queue';
const MAX_QUEUE_SIZE = 400;

export type AnalyticsEventType = 'workout_session_completed' | 'exercise_outcome';

export interface AnalyticsEventInput {
  event_type: AnalyticsEventType;
  goal: string;
  experience: string;
  exercise_id?: string;
  success: boolean;
  sets_completed?: number;
  duration_seconds?: number;
  occurred_at?: number;
}

interface QueuedAnalyticsEvent {
  event_type: AnalyticsEventType;
  goal: string;
  experience: string;
  exercise_id: string;
  success: boolean;
  sets_completed: number;
  duration_seconds: number;
  occurred_at: number;
}

function isConfigured(): boolean {
  return getApiBaseUrl() !== null;
}

function sanitizeEnum(value: string, fallback = 'unknown'): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 32);
}

function sanitizeId(value: string | undefined, fallback = 'all'): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 64);
}

function clampInt(value: number | undefined, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sanitizeEvent(input: AnalyticsEventInput): QueuedAnalyticsEvent {
  return {
    event_type: input.event_type,
    goal: sanitizeEnum(input.goal),
    experience: sanitizeEnum(input.experience),
    exercise_id: sanitizeId(input.exercise_id, 'all'),
    success: Boolean(input.success),
    sets_completed: clampInt(input.sets_completed, 0, 100),
    duration_seconds: clampInt(input.duration_seconds, 0, 60 * 60 * 4),
    occurred_at: clampInt(input.occurred_at, 0, Date.now()) || Date.now(),
  };
}

function safeParseQueue(raw: string | null): QueuedAnalyticsEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadQueue(): Promise<QueuedAnalyticsEvent[]> {
  return safeParseQueue(await getAppState(ANALYTICS_QUEUE_KEY));
}

async function saveQueue(events: QueuedAnalyticsEvent[]): Promise<void> {
  const bounded = events.slice(-MAX_QUEUE_SIZE);
  await setAppState(ANALYTICS_QUEUE_KEY, JSON.stringify(bounded));
}

export async function queueAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  const queue = await loadQueue();
  queue.push(sanitizeEvent(input));
  await saveQueue(queue);
}

export async function flushAnalyticsQueue(maxBatch = 120): Promise<{ sent: number; remaining: number }> {
  if (!isConfigured()) {
    const queue = await loadQueue();
    return { sent: 0, remaining: queue.length };
  }

  const queue = await loadQueue();
  if (!queue.length) return { sent: 0, remaining: 0 };

  const batch = queue.slice(0, Math.max(1, Math.floor(maxBatch)));

  const res = await fetchWithAuth('/analytics/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ events: batch }),
  });

  if (res.status === 403) {
    return { sent: 0, remaining: queue.length };
  }

  if (!res.ok) {
    throw new Error(`[Analytics] flush failed (${res.status})`);
  }

  const sent = batch.length;
  const remainingQueue = queue.slice(sent);
  await saveQueue(remainingQueue);

  return {
    sent,
    remaining: remainingQueue.length,
  };
}
