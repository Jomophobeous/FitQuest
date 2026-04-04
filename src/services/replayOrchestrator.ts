/**
 * Replay Orchestrator Stub
 * Triggers offline action replays — no-op in offline-only mode.
 */

export async function runReplayIfDue(_opts?: { reason?: string; cooldownMs?: number }): Promise<void> {
  // no-op
}
