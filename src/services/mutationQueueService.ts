import { getAppState, setAppState } from '../database/service';
import { logError, logEvent } from './telemetry';

const MUTATION_QUEUE_KEY = 'sync.mutation.queue.v1';
const MAX_QUEUE_ITEMS = 300;
let sequence = 0;

export type MutationJobType = 'legal.sync_consent' | 'backup.upload_latest' | 'sync.on_demand';

export interface MutationJob<TPayload = unknown> {
  id: string;
  type: MutationJobType;
  payload: TPayload;
  dedupeKey?: string;
  createdAt: number;
  lastAttemptAt: number | null;
  attempts: number;
  status: 'pending' | 'failed';
  lastError?: string;
}

interface FlushOptions {
  maxJobs?: number;
  maxAttempts?: number;
}

type MutationHandler = (job: MutationJob) => Promise<void>;

function safeParse(raw: string | null): MutationJob[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadQueue(): Promise<MutationJob[]> {
  return safeParse(await getAppState(MUTATION_QUEUE_KEY));
}

async function saveQueue(queue: MutationJob[]): Promise<void> {
  await setAppState(MUTATION_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS)));
}

function createJob<TPayload>(type: MutationJobType, payload: TPayload, dedupeKey?: string): MutationJob<TPayload> {
  sequence += 1;
  return {
    id: `mut_${Date.now()}_${sequence}`,
    type,
    payload,
    dedupeKey,
    createdAt: Date.now(),
    lastAttemptAt: null,
    attempts: 0,
    status: 'pending',
  };
}

export async function enqueueMutation<TPayload>(
  type: MutationJobType,
  payload: TPayload,
  options?: { dedupeKey?: string },
): Promise<void> {
  const queue = await loadQueue();
  const dedupeKey = options?.dedupeKey?.trim();

  if (dedupeKey) {
    const existingIndex = queue.findIndex((job) => job.status === 'pending' && job.dedupeKey === dedupeKey);
    if (existingIndex >= 0) {
      queue[existingIndex] = {
        ...queue[existingIndex]!,
        payload,
      };
      await saveQueue(queue);
      void logEvent('mutation_queue_dedupe_update', { type, dedupeKey });
      return;
    }
  }

  queue.push(createJob(type, payload, dedupeKey));
  await saveQueue(queue);
  void logEvent('mutation_queue_enqueue', { type, hasDedupeKey: Boolean(dedupeKey) });
}

export async function flushMutationQueue(
  handlers: Partial<Record<MutationJobType, MutationHandler>>,
  options?: FlushOptions,
): Promise<{ processed: number; succeeded: number; failed: number; pending: number }> {
  const maxJobs = Math.max(1, Math.floor(options?.maxJobs ?? 20));
  const maxAttempts = Math.max(1, Math.floor(options?.maxAttempts ?? 5));

  const queue = await loadQueue();
  const pendingJobs = queue
    .filter((job) => job.status === 'pending')
    .map((job) => ({ id: job.id, type: job.type }))
    .slice(0, maxJobs);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const pendingJob of pendingJobs) {
    const index = queue.findIndex((item) => item.id === pendingJob.id);
    if (index < 0) continue;
    const job = queue[index]!;

    const handler = handlers[job.type];
    if (!handler) continue;

    processed += 1;
    const nextAttempts = job.attempts + 1;
    queue[index] = {
      ...job,
      attempts: nextAttempts,
      lastAttemptAt: Date.now(),
    };

    try {
      await handler(queue[index]!);
      queue.splice(index, 1);
      succeeded += 1;
      void logEvent('mutation_queue_job_success', { type: job.type, attempts: nextAttempts });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextStatus = nextAttempts >= maxAttempts ? 'failed' : 'pending';
      queue[index] = {
        ...queue[index]!,
        status: nextStatus,
        lastError: message.slice(0, 240),
      };
      failed += 1;
      void logError(error, {
        module: 'mutationQueueService.flushMutationQueue',
        type: job.type,
        attempts: nextAttempts,
      });
    }
  }

  await saveQueue(queue);

  const pending = queue.filter((job) => job.status === 'pending').length;
  return { processed, succeeded, failed, pending };
}

export async function getMutationQueueStatus(): Promise<{ pending: number; failed: number; total: number }> {
  const queue = await loadQueue();
  const pending = queue.filter((job) => job.status === 'pending').length;
  const failed = queue.filter((job) => job.status === 'failed').length;
  return { pending, failed, total: queue.length };
}
