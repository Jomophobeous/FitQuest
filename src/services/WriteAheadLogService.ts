/**
 * WriteAheadLogService — No-op stub.
 *
 * The real WAL service was removed during FitQ2 core extraction.
 * This stub preserves the interface so database/service.ts calls compile.
 * Re-implement when write durability guarantees are needed.
 */

let counter = 0;

export const walService = {
  initialize: async (): Promise<void> => {},
  logIntent: async (_intent: Record<string, unknown>): Promise<string> => `wal_noop_${++counter}`,
  commit: async (_walId: string): Promise<void> => {},
  markFailed: async (_walId: string): Promise<void> => {},
};
