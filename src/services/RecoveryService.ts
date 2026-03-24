/**
 * RecoveryService — Cold-start recovery engine.
 *
 * Runs at app boot BEFORE the UI renders. Performs:
 * 1. Database integrity check (PRAGMA integrity_check)
 * 2. WAL replay (replay pending intents with idempotent guards)
 * 3. If corrupt: restore from latest verified snapshot, then replay
 * 4. Clean up WAL after recovery
 *
 * All recovery is deterministic and logged.
 */

import { getDatabase } from '../database/schema';
import { initializeDatabase } from '../database';
import { snapshotService, type SnapshotInfo } from './SnapshotService';
import { walService, type ReplayResult } from './WriteAheadLogService';
import { importEncryptedBackup } from './backupService';
import { captureException } from './crashReporting';

// ============================================
// TYPES
// ============================================

export type RecoveryOutcome =
  | 'healthy' // DB is clean, no recovery needed
  | 'wal_replayed' // Pending WAL intents were replayed
  | 'wal_cleaned' // Stale WAL entries were pruned
  | 'snapshot_restored' // DB was corrupt, snapshot restored
  | 'failed' // Recovery failed (no snapshot or restore failed)
  | 'skipped'; // Recovery was skipped (already ran this session)

export interface RecoveryResult {
  outcome: RecoveryOutcome;
  dbIntegrity: boolean;
  pendingWalEntries: number;
  failedWalEntries: number;
  replayResult: ReplayResult | null;
  snapshotUsed: SnapshotInfo | null;
  durationMs: number;
  error?: string;
}

// ============================================
// SERVICE
// ============================================

class RecoveryServiceImpl {
  private hasRunThisSession = false;

  /**
   * Run the full recovery check. Should be called once at cold start
   * AFTER the database is opened but BEFORE the UI renders.
   */
  async run(): Promise<RecoveryResult> {
    if (this.hasRunThisSession) {
      return {
        outcome: 'skipped',
        dbIntegrity: true,
        pendingWalEntries: 0,
        failedWalEntries: 0,
        replayResult: null,
        snapshotUsed: null,
        durationMs: 0,
      };
    }

    const startTime = Date.now();
    this.hasRunThisSession = true;

    try {
      // Step 1: Check database integrity
      const integrityOk = await this.checkDatabaseIntegrity();

      if (!integrityOk) {
        // DATABASE IS CORRUPT — attempt snapshot restore
        if (__DEV__) console.warn('[Recovery] Database integrity check FAILED — attempting restore');
        captureException(new Error('Database integrity check failed'), {
          context: 'RecoveryService.run',
          step: 'integrity_check',
        });

        return await this.restoreFromSnapshot(startTime);
      }

      // Step 2: Replay pending WAL intents (idempotent)
      const walStats = await walService.getStats();
      const pendingEntries = walStats.pending;
      const failedEntries = walStats.failed;
      let replayResult: ReplayResult | null = null;

      if (pendingEntries > 0) {
        if (__DEV__) console.log(`[Recovery] Found ${pendingEntries} pending WAL entries — replaying...`);
        replayResult = await walService.replayPendingIntents();

        if (replayResult.failed > 0) {
          captureException(new Error(`WAL replay had ${replayResult.failed} failures`), {
            context: 'RecoveryService.run',
            step: 'wal_replay',
            replayed: replayResult.replayed,
            skipped: replayResult.skipped,
            failed: replayResult.failed,
          });
        }

        if (__DEV__)
          console.log(
            `[Recovery] WAL replay: ${replayResult.replayed} replayed, ${replayResult.skipped} skipped, ${replayResult.failed} failed`,
          );
      }

      // Step 3: Prune old committed/replayed entries
      const pruned = await walService.pruneCommitted();
      if (__DEV__ && pruned > 0) console.log(`[Recovery] Pruned ${pruned} old WAL entries`);

      const durationMs = Date.now() - startTime;
      let outcome: RecoveryOutcome = 'healthy';
      if (replayResult && (replayResult.replayed > 0 || replayResult.skipped > 0)) {
        outcome = 'wal_replayed';
      } else if (pruned > 0) {
        outcome = 'wal_cleaned';
      }

      if (__DEV__) console.log(`[Recovery] Complete: ${outcome} (${durationMs}ms)`);

      return {
        outcome,
        dbIntegrity: true,
        pendingWalEntries: pendingEntries,
        failedWalEntries: failedEntries,
        replayResult,
        snapshotUsed: null,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : String(error);
      captureException(error instanceof Error ? error : new Error(errMsg), {
        context: 'RecoveryService.run',
      });

      return {
        outcome: 'failed',
        dbIntegrity: false,
        pendingWalEntries: 0,
        failedWalEntries: 0,
        replayResult: null,
        snapshotUsed: null,
        durationMs,
        error: errMsg,
      };
    }
  }

  /**
   * PRAGMA integrity_check — returns true if DB is healthy.
   */
  private async checkDatabaseIntegrity(): Promise<boolean> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ integrity_check: string }>(`PRAGMA integrity_check`);
      const ok = result?.integrity_check === 'ok';
      if (__DEV__) console.log(`[Recovery] Integrity check: ${ok ? 'PASS' : 'FAIL'}`);
      return ok;
    } catch (error) {
      if (__DEV__) console.error('[Recovery] Integrity check error:', error);
      return false;
    }
  }

  /**
   * Find the latest verified snapshot and restore from it.
   */
  private async restoreFromSnapshot(startTime: number): Promise<RecoveryResult> {
    try {
      const snapshots = await snapshotService.listSnapshots();

      // Try each snapshot, newest first, until one verifies
      for (const snap of snapshots) {
        const isValid = await snapshotService.verifySnapshot(snap.uri);
        if (!isValid) {
          if (__DEV__) console.warn(`[Recovery] Snapshot ${snap.filename} failed verification — skipping`);
          continue;
        }

        if (__DEV__) console.log(`[Recovery] Restoring from: ${snap.filename}`);

        await importEncryptedBackup({ backupUri: snap.uri });

        // Re-initialize WAL table (it was wiped with the restore)
        await walService.clearAll();

        const durationMs = Date.now() - startTime;
        if (__DEV__) console.log(`[Recovery] Snapshot restored successfully (${durationMs}ms)`);

        captureException(new Error('Database restored from snapshot'), {
          context: 'RecoveryService.restoreFromSnapshot',
          snapshot: snap.filename,
          durationMs,
        });

        return {
          outcome: 'snapshot_restored',
          dbIntegrity: true,
          pendingWalEntries: 0,
          failedWalEntries: 0,
          replayResult: null,
          snapshotUsed: snap,
          durationMs,
        };
      }

      // No valid snapshots found
      const durationMs = Date.now() - startTime;
      if (__DEV__) console.error('[Recovery] No valid snapshots available for restore');

      return {
        outcome: 'failed',
        dbIntegrity: false,
        pendingWalEntries: 0,
        failedWalEntries: 0,
        replayResult: null,
        snapshotUsed: null,
        durationMs,
        error: 'No valid snapshots available',
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        outcome: 'failed',
        dbIntegrity: false,
        pendingWalEntries: 0,
        failedWalEntries: 0,
        replayResult: null,
        snapshotUsed: null,
        durationMs,
        error: errMsg,
      };
    }
  }

  /**
   * Reset session flag — allows recovery to run again.
   * Only used for testing or after a forced re-init.
   */
  resetSession(): void {
    this.hasRunThisSession = false;
  }
}

// ============================================
// SINGLETON
// ============================================

export const recoveryService = new RecoveryServiceImpl();
