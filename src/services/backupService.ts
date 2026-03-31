import * as FileSystem from 'expo-file-system/legacy';

import { closeDatabase, initializeDatabase } from '../database';
import { SCHEMA_VERSION } from '../database/types';
import {
  decryptV2,
  decryptV3,
  encryptV3,
  getOrCreateMasterKey,
  isV2Payload,
  isV3Payload,
  type EncryptedPayload,
} from '../security/AESEncryption';

export interface BackupMetadata {
  created_at: number;
  schema_version: number;
  database_name: string;
}

export interface EncryptedBackupFile {
  meta: BackupMetadata;
  payload: EncryptedPayload;
}

const DATABASE_NAME = 'fitquest.db';
const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;
const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;

export interface BackupListItem {
  uri: string;
  filename: string;
  bytes: number;
  modified_at: number;
}

function getDatabaseFileUri(): string {
  return `${SQLITE_DIR}${DATABASE_NAME}`;
}

async function ensureDir(dirUri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dirUri);
  if (info.exists) return;
  await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
}

async function safeDeleteIfExists(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

async function restoreDatabaseFromBase64(dbBase64: string): Promise<void> {
  const dbUri = getDatabaseFileUri();

  await closeDatabase();
  await ensureDir(SQLITE_DIR);

  // Delete WAL/SHM companions first to avoid SQLite confusion.
  await safeDeleteIfExists(`${dbUri}-wal`);
  await safeDeleteIfExists(`${dbUri}-shm`);
  await safeDeleteIfExists(dbUri);

  await FileSystem.writeAsStringAsync(dbUri, dbBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await initializeDatabase();
}

async function decodeEncryptedBackup(rawJson: string, passphrase?: string): Promise<{ db_base64: string }> {
  let parsed: Partial<EncryptedBackupFile>;
  try {
    parsed = JSON.parse(rawJson) as Partial<EncryptedBackupFile>;
  } catch {
    throw new Error('[Backup] Invalid backup file (malformed JSON)');
  }
  if (!parsed?.payload) {
    throw new Error('[Backup] Invalid backup file (missing payload)');
  }

  // Validate schema version compatibility
  if (parsed.meta?.schema_version != null) {
    if (parsed.meta.schema_version > SCHEMA_VERSION) {
      throw new Error(
        `[Backup] Incompatible backup: schema v${parsed.meta.schema_version} is newer than current v${SCHEMA_VERSION}. Update the app first.`,
      );
    }
  }

  const key = await resolveBackupKey(passphrase);

  let decrypted: string;
  if (isV3Payload(parsed.payload)) {
    decrypted = await decryptV3(parsed.payload, key);
  } else if (isV2Payload(parsed.payload)) {
    decrypted = await decryptV2(parsed.payload, key);
  } else {
    throw new Error('[Backup] Unsupported backup payload version');
  }

  let decoded: { db_base64?: string };
  try {
    decoded = JSON.parse(decrypted) as { db_base64?: string };
  } catch {
    throw new Error('[Backup] Invalid backup payload (malformed JSON after decryption)');
  }
  if (!decoded?.db_base64) {
    throw new Error('[Backup] Invalid backup payload (missing db_base64)');
  }

  return { db_base64: decoded.db_base64 };
}

async function resolveBackupKey(passphrase?: string): Promise<string> {
  if (passphrase && passphrase.trim().length > 0) return passphrase.trim();
  return getOrCreateMasterKey();
}

export async function listEncryptedBackups(): Promise<BackupListItem[]> {
  await ensureDir(BACKUP_DIR);

  const names = await FileSystem.readDirectoryAsync(BACKUP_DIR);
  const backupNames = names.filter((n) => n.startsWith('fitquest_backup_') && n.endsWith('.json')).sort();

  const items: BackupListItem[] = [];
  for (const filename of backupNames) {
    const uri = `${BACKUP_DIR}${filename}`;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) continue;

    items.push({
      uri,
      filename,
      bytes: info.size ?? 0,
      modified_at: typeof info.modificationTime === 'number' ? Math.round(info.modificationTime * 1000) : Date.now(),
    });
  }

  return items.sort((a, b) => b.modified_at - a.modified_at);
}

export async function deleteEncryptedBackup(backupUri: string): Promise<void> {
  await safeDeleteIfExists(backupUri);
}

/**
 * Exports the on-device SQLite database file as an encrypted JSON bundle.
 *
 * If `passphrase` is provided, the bundle is encrypted with that passphrase
 * (enables cross-device restore if the user knows the passphrase).
 * Otherwise it encrypts with the device-local master key (same-device backup).
 */
export async function exportEncryptedBackup(options?: {
  passphrase?: string;
  destinationUri?: string;
}): Promise<{ uri: string; bytes: number }> {
  const createdAt = Date.now();
  const dbUri = getDatabaseFileUri();

  await closeDatabase();

  const dbInfo = await FileSystem.getInfoAsync(dbUri);
  if (!dbInfo.exists) {
    throw new Error('[Backup] Database file not found');
  }

  const dbBase64 = await FileSystem.readAsStringAsync(dbUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const meta: BackupMetadata = {
    created_at: createdAt,
    schema_version: SCHEMA_VERSION,
    database_name: DATABASE_NAME,
  };

  const key = await resolveBackupKey(options?.passphrase);
  const payload = await encryptV3(JSON.stringify({ meta, db_base64: dbBase64 }), key);

  const bundle: EncryptedBackupFile = { meta, payload };

  const destination = options?.destinationUri;
  const outUri = destination ?? `${BACKUP_DIR}fitquest_backup_${createdAt}.json`;
  await ensureDir(destination ? outUri.split('/').slice(0, -1).join('/') + '/' : BACKUP_DIR);
  const outJson = JSON.stringify(bundle);

  await FileSystem.writeAsStringAsync(outUri, outJson, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const outInfo = await FileSystem.getInfoAsync(outUri);
  const bytes = 'size' in outInfo && typeof outInfo.size === 'number' ? outInfo.size : outJson.length;
  return { uri: outUri, bytes };
}

/**
 * Restores the SQLite database file from an encrypted JSON bundle.
 *
 * WARNING: This replaces the entire local database.
 */
export async function importEncryptedBackup(options: { backupUri: string; passphrase?: string }): Promise<void> {
  const raw = await FileSystem.readAsStringAsync(options.backupUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const decoded = await decodeEncryptedBackup(raw, options.passphrase);
  await restoreDatabaseFromBase64(decoded.db_base64);
}

/**
 * Restores the SQLite database from an encrypted backup JSON string.
 *
 * Use this for cloud restores where the backup is retrieved as an opaque blob.
 */
export async function importEncryptedBackupFromString(options: {
  rawJson: string;
  passphrase?: string;
}): Promise<void> {
  const decoded = await decodeEncryptedBackup(options.rawJson, options.passphrase);
  await restoreDatabaseFromBase64(decoded.db_base64);
}
