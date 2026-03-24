/**
 * SnapshotService — Automatic periodic encrypted snapshots with rotation and diff tracking.
 *
 * Builds on existing backupService infrastructure. Provides:
 * - Event-driven snapshots (workout complete, session end, app background)
 * - Periodic snapshots (configurable interval, default 6h)
 * - Snapshot rotation (keeps last MAX_SNAPSHOTS, deletes oldest)
 * - Integrity verification before restore
 * - Diff-based snapshots: store WAL checkpoint instead of full DB when changes are small
 * - Full snapshots forced every N diffs or on major events
 */

import * as FileSystem from 'expo-file-system/legacy';
import {
  exportEncryptedBackup,
  listEncryptedBackups,
  deleteEncryptedBackup,
  type BackupListItem,
} from './backupService';
import { walService, type WALEntry } from './WriteAheadLogService';
import { encryptV3, decryptV3, getOrCreateMasterKey, type EncryptedPayload } from '../security/AESEncryption';
import { captureException } from './crashReporting';

// ============================================
// CONSTANTS
// ============================================

const SNAPSHOT_DIR = `${FileSystem.documentDirectory}snapshots/`;
const DIFF_DIR = `${FileSystem.documentDirectory}snapshots/diffs/`;
const MAX_SNAPSHOTS = 3;
const MAX_DIFFS_BEFORE_FULL = 10; // Force full snapshot after 10 diffs
const MIN_SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000; // 30 min floor between snapshots
const PERIODIC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const SNAPSHOT_PREFIX = 'fitquest_snapshot_';
const DIFF_PREFIX = 'fitquest_diff_';

// ============================================
// TYPES
// ============================================

export interface SnapshotInfo {
  uri: string;
  filename: string;
  bytes: number;
  created_at: number;
  type: 'full' | 'diff';
}

export interface DiffSnapshot {
  version: 1;
  type: 'diff';
  base_snapshot_ts: number; // timestamp of the full snapshot this diff is based on
  checkpoint_from: number; // WAL checkpoint start
  checkpoint_to: number; // WAL checkpoint end
  wal_entries: WALEntry[]; // WAL entries in this diff window
  created_at: number;
}

export type SnapshotTrigger =
  | 'periodic'
  | 'workout_complete'
  | 'session_end'
  | 'app_background'
  | 'pre_migration'
  | 'manual'
  | 'profile_updated'
  | 'xp_milestone';

// ============================================
// SERVICE
// ============================================

class SnapshotServiceImpl {
  private lastSnapshotAt = 0;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotInProgress = false;
  private diffCountSinceFullSnapshot = 0;
  private lastFullSnapshotTs = 0;

  /**
   * Create a snapshot if enough time has elapsed since the last one.
   * Returns snapshot info if created, null if skipped (cooldown or already in progress).
   */
  async createSnapshot(trigger: SnapshotTrigger): Promise<SnapshotInfo | null> {
    // Guard: no concurrent snapshots
    if (this.snapshotInProgress) {
      if (__DEV__) console.log(`[Snapshot] Skipped (${trigger}) — already in progress`);
      return null;
    }

    // Guard: cooldown (except pre_migration and manual — always allowed)
    if (trigger !== 'pre_migration' && trigger !== 'manual') {
      if (Date.now() - this.lastSnapshotAt < MIN_SNAPSHOT_INTERVAL_MS) {
        if (__DEV__) console.log(`[Snapshot] Skipped (${trigger}) — cooldown`);
        return null;
      }
    }

    this.snapshotInProgress = true;
    try {
      const createdAt = Date.now();
      const filename = `${SNAPSHOT_PREFIX}${createdAt}.json`;
      const destinationUri = `${SNAPSHOT_DIR}${filename}`;

      await ensureSnapshotDir();
      const result = await exportEncryptedBackup({ destinationUri });

      this.lastSnapshotAt = createdAt;
      this.lastFullSnapshotTs = createdAt;
      this.diffCountSinceFullSnapshot = 0;
      if (__DEV__) console.log(`[Snapshot] Created (${trigger}): ${filename} [${result.bytes} bytes]`);

      // Rotate: keep only MAX_SNAPSHOTS
      await this.rotateSnapshots();

      return {
        uri: result.uri,
        filename,
        bytes: result.bytes,
        created_at: createdAt,
        type: 'full' as const,
      };
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'SnapshotService.createSnapshot',
        trigger,
      });
      if (__DEV__) console.error('[Snapshot] Failed:', error);
      return null;
    } finally {
      this.snapshotInProgress = false;
    }
  }

  /**
   * Create a diff-based snapshot: stores only WAL entries since last checkpoint.
   * Much faster and smaller than a full snapshot.
   * Returns null if no WAL changes since last checkpoint.
   * Forces a full snapshot if diffCountSinceFullSnapshot >= MAX_DIFFS_BEFORE_FULL.
   */
  async createDiffSnapshot(trigger: SnapshotTrigger): Promise<SnapshotInfo | null> {
    // Force full snapshot if too many diffs accumulated
    if (this.diffCountSinceFullSnapshot >= MAX_DIFFS_BEFORE_FULL) {
      if (__DEV__)
        console.log(`[Snapshot] Forcing full snapshot (${this.diffCountSinceFullSnapshot} diffs accumulated)`);
      this.diffCountSinceFullSnapshot = 0;
      return this.createSnapshot(trigger);
    }

    // Guard: no concurrent snapshots
    if (this.snapshotInProgress) return null;

    // Guard: need a base full snapshot to diff against
    if (this.lastFullSnapshotTs === 0) {
      const latest = await this.getLatestSnapshot();
      if (!latest || latest.type !== 'full') {
        if (__DEV__) console.log('[Snapshot] No base full snapshot — creating full instead of diff');
        return this.createSnapshot(trigger);
      }
      this.lastFullSnapshotTs = latest.created_at;
    }

    this.snapshotInProgress = true;
    try {
      const checkpoint = await walService.getCheckpoint();
      const walEntries = await walService.getEntriesSinceCheckpoint(checkpoint);

      if (walEntries.length === 0) {
        if (__DEV__) console.log(`[Snapshot] Diff skipped (${trigger}) — no WAL changes since checkpoint`);
        return null;
      }

      const createdAt = Date.now();
      const diff: DiffSnapshot = {
        version: 1,
        type: 'diff',
        base_snapshot_ts: this.lastFullSnapshotTs,
        checkpoint_from: checkpoint,
        checkpoint_to: createdAt,
        wal_entries: walEntries,
        created_at: createdAt,
      };

      const key = await getOrCreateMasterKey();
      const encrypted = await encryptV3(JSON.stringify(diff), key);

      await ensureDiffDir();
      const filename = `${DIFF_PREFIX}${createdAt}.json`;
      const uri = `${DIFF_DIR}${filename}`;
      const json = JSON.stringify(encrypted);
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

      // Advance WAL checkpoint
      await walService.advanceCheckpoint();
      this.diffCountSinceFullSnapshot++;
      this.lastSnapshotAt = createdAt;

      const fileInfo = await FileSystem.getInfoAsync(uri);
      const bytes = 'size' in fileInfo && typeof fileInfo.size === 'number' ? fileInfo.size : json.length;

      if (__DEV__)
        console.log(
          `[Snapshot] Diff created (${trigger}): ${filename} [${bytes} bytes, ${walEntries.length} WAL entries]`,
        );

      return { uri, filename, bytes, created_at: createdAt, type: 'diff' };
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'SnapshotService.createDiffSnapshot',
        trigger,
      });
      if (__DEV__) console.error('[Snapshot] Diff failed:', error);
      return null;
    } finally {
      this.snapshotInProgress = false;
    }
  }

  /**
   * List diff snapshots, newest first.
   */
  async listDiffSnapshots(): Promise<SnapshotInfo[]> {
    await ensureDiffDir();
    const names = await FileSystem.readDirectoryAsync(DIFF_DIR);
    const diffs: SnapshotInfo[] = [];

    for (const name of names) {
      if (!name.startsWith(DIFF_PREFIX) || !name.endsWith('.json')) continue;
      const uri = `${DIFF_DIR}${name}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) continue;

      const tsStr = name.replace(DIFF_PREFIX, '').replace('.json', '');
      const ts = parseInt(tsStr, 10);

      diffs.push({
        uri,
        filename: name,
        bytes: info.size ?? 0,
        created_at: isNaN(ts) ? 0 : ts,
        type: 'diff',
      });
    }

    return diffs.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Restore from a diff snapshot: decrypt → import WAL entries → replay.
   * Requires the base full snapshot to have been restored first.
   */
  async restoreDiffSnapshot(uri: string): Promise<{ replayed: number; skipped: number; failed: number } | null> {
    try {
      const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const encrypted = JSON.parse(raw) as EncryptedPayload;
      if (encrypted.v !== 3) throw new Error(`[Snapshot] Unsupported diff payload version: ${(encrypted as any).v}`);
      const key = await getOrCreateMasterKey();
      const decrypted = await decryptV3(encrypted as import('../security/AESEncryption').EncryptedPayloadV3, key);
      const diff = JSON.parse(decrypted) as DiffSnapshot;

      if (diff.type !== 'diff' || !diff.wal_entries?.length) return null;

      await walService.importEntries(diff.wal_entries);
      const result = await walService.replayPendingIntents();

      return { replayed: result.replayed, skipped: result.skipped, failed: result.failed };
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'SnapshotService.restoreDiffSnapshot',
      });
      return null;
    }
  }

  /**
   * List all snapshots, newest first.
   */
  async listSnapshots(): Promise<SnapshotInfo[]> {
    await ensureSnapshotDir();
    const names = await FileSystem.readDirectoryAsync(SNAPSHOT_DIR);
    const snapshots: SnapshotInfo[] = [];

    for (const name of names) {
      if (!name.startsWith(SNAPSHOT_PREFIX) || !name.endsWith('.json')) continue;
      const uri = `${SNAPSHOT_DIR}${name}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) continue;

      // Extract timestamp from filename
      const tsStr = name.replace(SNAPSHOT_PREFIX, '').replace('.json', '');
      const ts = parseInt(tsStr, 10);

      snapshots.push({
        uri,
        filename: name,
        bytes: info.size ?? 0,
        created_at: isNaN(ts) ? 0 : ts,
        type: 'full',
      });
    }

    return snapshots.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Get the latest snapshot, or null if none exists.
   */
  async getLatestSnapshot(): Promise<SnapshotInfo | null> {
    const snapshots = await this.listSnapshots();
    return snapshots[0] ?? null;
  }

  /**
   * Verify a snapshot file exists and has valid AES-256-GCM integrity.
   * Performs trial decryption — GCM auth tag validates data hasn't been tampered with.
   */
  async verifySnapshot(uri: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || (info.size ?? 0) < 100) return false;

      const raw = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const parsed = JSON.parse(raw);
      if (!parsed?.meta?.created_at || !parsed?.payload) return false;

      // Cryptographic integrity: trial decrypt with master key (GCM auth tag validates)
      const key = await getOrCreateMasterKey();
      const payloadObj = parsed.payload as EncryptedPayload;
      if (payloadObj.v !== 3)
        throw new Error(`[Snapshot] Unsupported snapshot payload version: ${(payloadObj as any).v}`);
      const decrypted = await decryptV3(payloadObj as import('../security/AESEncryption').EncryptedPayloadV3, key);
      if (!decrypted) return false;

      // Structural check on decrypted content
      const inner = JSON.parse(decrypted);
      return !!(inner?.meta && inner?.db_base64);
    } catch {
      return false;
    }
  }

  /**
   * Delete a specific snapshot.
   */
  async deleteSnapshot(uri: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  }

  /**
   * Start periodic snapshot timer.
   */
  startPeriodicSnapshots(): void {
    if (this.periodicTimer) return;
    this.periodicTimer = setInterval(() => {
      this.createSnapshot('periodic').catch(() => {});
    }, PERIODIC_INTERVAL_MS);
    if (__DEV__) console.log('[Snapshot] Periodic snapshots started (every 6h)');
  }

  /**
   * Stop periodic snapshot timer.
   */
  stopPeriodicSnapshots(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  /**
   * Keep only MAX_SNAPSHOTS, delete the oldest.
   */
  private async rotateSnapshots(): Promise<void> {
    const snapshots = await this.listSnapshots();
    if (snapshots.length <= MAX_SNAPSHOTS) return;

    const toDelete = snapshots.slice(MAX_SNAPSHOTS);
    for (const snap of toDelete) {
      await this.deleteSnapshot(snap.uri);
      if (__DEV__) console.log(`[Snapshot] Rotated out: ${snap.filename}`);
    }
  }
}

// ============================================
// HELPERS
// ============================================

async function ensureSnapshotDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(SNAPSHOT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SNAPSHOT_DIR, { intermediates: true });
  }
}

async function ensureDiffDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIFF_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIFF_DIR, { intermediates: true });
  }
}

// ============================================
// SINGLETON
// ============================================

export const snapshotService = new SnapshotServiceImpl();
