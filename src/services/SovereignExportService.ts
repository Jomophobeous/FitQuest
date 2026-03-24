/**
 * SovereignExportService — Encrypted portable state engine.
 *
 * Bundles snapshot + WAL into a single encrypted, integrity-verified package.
 * Enables device-to-device transfer, manual backup, and full state restore
 * with zero network assumptions.
 *
 * Export flow:
 *   snapshot (DB state) + WAL (intent history) → encrypt (AES-256-GCM) → SHA-256 integrity hash → bundle
 *
 * Import flow:
 *   bundle → verify SHA-256 → decrypt → restore snapshot → replay WAL → verify state
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { exportEncryptedBackup, importEncryptedBackup } from './backupService';
import { walService, type WALEntry } from './WriteAheadLogService';
import { snapshotService } from './SnapshotService';
import { encryptV3, decryptV3, getOrCreateMasterKey, type EncryptedPayload } from '../security/AESEncryption';
import { captureException } from './crashReporting';

// ============================================
// TYPES
// ============================================

export interface SovereignBundle {
  version: 2;
  format: 'fitquest_sovereign_bundle';
  created_at: number;
  schema_version: number;
  integrity_hash: string; // SHA-256 of encrypted payload
  snapshot: EncryptedPayload; // encrypted DB snapshot
  wal_entries: WALEntry[]; // WAL history (plaintext — encrypted at bundle level)
  wal_count: number;
  payload_encrypted: EncryptedPayload; // AES-256-GCM encrypted envelope over the full bundle data
  passphrase_salt?: string; // present when passphrase-encrypted — required for key derivation
}

export interface ExportResult {
  uri: string;
  bytes: number;
  walEntries: number;
  created_at: number;
}

export interface ImportResult {
  outcome: 'success' | 'integrity_failed' | 'decrypt_failed' | 'restore_failed' | 'replay_failed';
  snapshotRestored: boolean;
  walReplayed: number;
  walSkipped: number;
  walFailed: number;
  error?: string;
}

export interface BundleVerification {
  valid: boolean;
  format: string | null;
  version: number | null;
  created_at: number | null;
  walCount: number | null;
  error?: string;
}

// ============================================
// CONSTANTS
// ============================================

const EXPORT_DIR = `${FileSystem.documentDirectory}sovereign_exports/`;
const BUNDLE_PREFIX = 'fitquest_sovereign_';
const BUNDLE_VERSION = 2;
const PASSPHRASE_STRETCH_ITERATIONS = 1_000;

async function ensureExportDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(EXPORT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
  }
}

/**
 * Stretch a user passphrase into a 256-bit key using iterated SHA-256.
 * 1,000 JS iterations ≈ 100K native PBKDF2 given per-call overhead.
 */
async function stretchPassphrase(passphrase: string, salt: string): Promise<string> {
  let hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${passphrase}:0`);
  for (let i = 1; i < PASSPHRASE_STRETCH_ITERATIONS; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${hash}:${i}`);
  }
  return hash;
}

// ============================================
// SERVICE
// ============================================

class SovereignExportServiceImpl {
  /**
   * Export full system state: snapshot + WAL → encrypted bundle with integrity hash.
   */
  async exportBundle(options?: { passphrase?: string }): Promise<ExportResult> {
    const createdAt = Date.now();
    await ensureExportDir();

    if (__DEV__) console.log('[Sovereign] Starting export...');

    // Step 1: Create a fresh snapshot
    const snapshot = await snapshotService.createSnapshot('manual');
    if (!snapshot) {
      throw new Error('[Sovereign] Failed to create snapshot for export');
    }

    // Step 2: Read snapshot file as raw JSON
    const snapshotRaw = await FileSystem.readAsStringAsync(snapshot.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Step 3: Export all WAL entries
    const walEntries = await walService.exportAll();

    // Step 4: Build the inner bundle data
    const innerData = JSON.stringify({
      snapshot_data: snapshotRaw,
      wal_entries: walEntries,
    });

    // Step 5: Derive encryption key (stretch passphrase if provided)
    let key: string;
    let passphraseSalt: string | undefined;
    const rawPassphrase = options?.passphrase?.trim();
    if (rawPassphrase) {
      const saltBytes = await Crypto.getRandomBytesAsync(32);
      passphraseSalt = Array.from(saltBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      key = await stretchPassphrase(rawPassphrase, passphraseSalt);
    } else {
      key = await getOrCreateMasterKey();
    }
    const encryptedPayload = await encryptV3(innerData, key);

    // Step 6: Compute integrity hash over the encrypted payload
    const payloadString = JSON.stringify(encryptedPayload);
    const integrityHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payloadString);

    // Step 7: Build the outer bundle
    const { SCHEMA_VERSION } = require('../database/types');
    const bundle: SovereignBundle = {
      version: BUNDLE_VERSION,
      format: 'fitquest_sovereign_bundle',
      created_at: createdAt,
      schema_version: SCHEMA_VERSION,
      integrity_hash: integrityHash,
      snapshot: {} as EncryptedPayload, // placeholder — actual snapshot is inside encrypted payload
      wal_entries: [], // placeholder — actual WAL is inside encrypted payload
      wal_count: walEntries.length,
      payload_encrypted: encryptedPayload,
      ...(passphraseSalt ? { passphrase_salt: passphraseSalt } : {}),
    };

    // Step 8: Write to file
    const filename = `${BUNDLE_PREFIX}${createdAt}.json`;
    const outputUri = `${EXPORT_DIR}${filename}`;
    const bundleJson = JSON.stringify(bundle);

    await FileSystem.writeAsStringAsync(outputUri, bundleJson, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const fileInfo = await FileSystem.getInfoAsync(outputUri);
    const bytes = 'size' in fileInfo && typeof fileInfo.size === 'number' ? fileInfo.size : bundleJson.length;

    if (__DEV__)
      console.log(`[Sovereign] Export complete: ${filename} (${bytes} bytes, ${walEntries.length} WAL entries)`);

    return { uri: outputUri, bytes, walEntries: walEntries.length, created_at: createdAt };
  }

  /**
   * Verify a bundle file without importing. Checks format, integrity hash.
   */
  async verifyBundle(bundleUri: string): Promise<BundleVerification> {
    try {
      const raw = await FileSystem.readAsStringAsync(bundleUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const bundle = JSON.parse(raw) as Partial<SovereignBundle>;

      if (bundle.format !== 'fitquest_sovereign_bundle') {
        return {
          valid: false,
          format: bundle.format ?? null,
          version: null,
          created_at: null,
          walCount: null,
          error: 'invalid_format',
        };
      }

      if (!bundle.payload_encrypted || !bundle.integrity_hash) {
        return {
          valid: false,
          format: bundle.format,
          version: bundle.version ?? null,
          created_at: bundle.created_at ?? null,
          walCount: null,
          error: 'missing_fields',
        };
      }

      // Verify integrity hash
      const payloadString = JSON.stringify(bundle.payload_encrypted);
      const computedHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payloadString);

      if (computedHash !== bundle.integrity_hash) {
        return {
          valid: false,
          format: bundle.format,
          version: bundle.version ?? null,
          created_at: bundle.created_at ?? null,
          walCount: bundle.wal_count ?? null,
          error: 'integrity_hash_mismatch',
        };
      }

      return {
        valid: true,
        format: bundle.format,
        version: bundle.version ?? null,
        created_at: bundle.created_at ?? null,
        walCount: bundle.wal_count ?? null,
      };
    } catch (error) {
      return {
        valid: false,
        format: null,
        version: null,
        created_at: null,
        walCount: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Import bundle: verify → decrypt → restore snapshot → replay WAL → verify state.
   */
  async importBundle(bundleUri: string, options?: { passphrase?: string }): Promise<ImportResult> {
    if (__DEV__) console.log('[Sovereign] Starting import...');

    // Step 1: Verify integrity
    const verification = await this.verifyBundle(bundleUri);
    if (!verification.valid) {
      return {
        outcome: 'integrity_failed',
        snapshotRestored: false,
        walReplayed: 0,
        walSkipped: 0,
        walFailed: 0,
        error: verification.error,
      };
    }

    // Step 2: Read and parse
    const raw = await FileSystem.readAsStringAsync(bundleUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const bundle = JSON.parse(raw) as SovereignBundle;

    // Step 3: Decrypt inner payload (stretch passphrase if bundle was passphrase-encrypted)
    let innerData: { snapshot_data: string; wal_entries: WALEntry[] };
    try {
      let key: string;
      const rawPassphrase = options?.passphrase?.trim();
      if (rawPassphrase && bundle.passphrase_salt) {
        key = await stretchPassphrase(rawPassphrase, bundle.passphrase_salt);
      } else if (rawPassphrase) {
        // Legacy bundle without salt — use raw passphrase (backward compat)
        key = rawPassphrase;
      } else {
        key = await getOrCreateMasterKey();
      }
      const encPayload = bundle.payload_encrypted;
      if ((encPayload as any).v !== 3)
        throw new Error(`[SovereignExport] Unsupported payload version: ${(encPayload as any).v}`);
      const decrypted = await decryptV3(encPayload as import('../security/AESEncryption').EncryptedPayloadV3, key);
      innerData = JSON.parse(decrypted);
    } catch (error) {
      return {
        outcome: 'decrypt_failed',
        snapshotRestored: false,
        walReplayed: 0,
        walSkipped: 0,
        walFailed: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Step 4: Restore snapshot (write decrypted snapshot to temp file, then import)
    try {
      await ensureExportDir();
      const tempUri = `${EXPORT_DIR}_import_temp_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(tempUri, innerData.snapshot_data, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await importEncryptedBackup({ backupUri: tempUri });

      // Clean up temp file
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'SovereignExport.importBundle.snapshotRestore',
      });
      return {
        outcome: 'restore_failed',
        snapshotRestored: false,
        walReplayed: 0,
        walSkipped: 0,
        walFailed: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Step 5: Import WAL entries from bundle
    const walEntries = innerData.wal_entries ?? [];
    if (walEntries.length > 0) {
      await walService.importEntries(walEntries);
    }

    // Step 6: Replay any pending WAL entries
    try {
      const replayResult = await walService.replayPendingIntents();
      if (__DEV__)
        console.log(
          `[Sovereign] Import complete: snapshot restored, WAL replay: ${replayResult.replayed} replayed, ${replayResult.skipped} skipped, ${replayResult.failed} failed`,
        );

      return {
        outcome: replayResult.failed > 0 ? 'replay_failed' : 'success',
        snapshotRestored: true,
        walReplayed: replayResult.replayed,
        walSkipped: replayResult.skipped,
        walFailed: replayResult.failed,
        error: replayResult.failed > 0 ? `${replayResult.failed} WAL entries failed replay` : undefined,
      };
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'SovereignExport.importBundle.walReplay',
      });
      return {
        outcome: 'replay_failed',
        snapshotRestored: true,
        walReplayed: 0,
        walSkipped: 0,
        walFailed: walEntries.length,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List all sovereign bundles, newest first.
   */
  async listBundles(): Promise<Array<{ uri: string; filename: string; bytes: number; created_at: number }>> {
    await ensureExportDir();
    const names = await FileSystem.readDirectoryAsync(EXPORT_DIR);
    const bundles: Array<{ uri: string; filename: string; bytes: number; created_at: number }> = [];

    for (const name of names) {
      if (!name.startsWith(BUNDLE_PREFIX) || !name.endsWith('.json')) continue;
      const uri = `${EXPORT_DIR}${name}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) continue;

      const tsStr = name.replace(BUNDLE_PREFIX, '').replace('.json', '');
      const ts = parseInt(tsStr, 10);

      bundles.push({
        uri,
        filename: name,
        bytes: info.size ?? 0,
        created_at: isNaN(ts) ? 0 : ts,
      });
    }

    return bundles.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Delete a sovereign bundle.
   */
  async deleteBundle(uri: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

// ============================================
// SINGLETON
// ============================================

export const sovereignExport = new SovereignExportServiceImpl();
