import { getAppState, setAppState } from '../database/service';
import { runP1ReplayCycle } from './p1ReplayRunner';
import { logError, logEvent } from './telemetry';

const LAST_REPLAY_AT_KEY = 'p1.replay.last_run_at';
const LAST_REPLAY_RESULT_KEY = 'p1.replay.last_result';
const DEFAULT_COOLDOWN_MS = 60 * 1000;

export interface ReplayResult {
  processed: number;
  succeeded: number;
  failed: number;
  pending: number;
}

function parseNumber(input: string | null): number {
  const num = Number(input);
  return Number.isFinite(num) ? num : 0;
}

export async function runReplayIfDue(options?: {
  cooldownMs?: number;
  reason?: string;
}): Promise<{ executed: boolean; result: ReplayResult | null }> {
  const cooldownMs = Math.max(5000, Math.floor(options?.cooldownMs ?? DEFAULT_COOLDOWN_MS));
  const now = Date.now();
  const lastRunAt = parseNumber(await getAppState(LAST_REPLAY_AT_KEY));

  if (lastRunAt > 0 && now - lastRunAt < cooldownMs) {
    return { executed: false, result: null };
  }

  try {
    const result = await runP1ReplayCycle();
    await Promise.all([
      setAppState(LAST_REPLAY_AT_KEY, String(now)),
      setAppState(LAST_REPLAY_RESULT_KEY, JSON.stringify(result)),
    ]);
    void logEvent('p1_replay_cycle', { reason: options?.reason || 'unspecified', ...result });
    return { executed: true, result };
  } catch (error) {
    void logError(error, { module: 'replayOrchestrator.runReplayIfDue', reason: options?.reason || 'unspecified' });
    throw error;
  }
}
