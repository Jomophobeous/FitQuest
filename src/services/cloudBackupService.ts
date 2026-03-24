import * as FileSystem from 'expo-file-system/legacy';

import { getAppState, setAppState } from '../database/service';
import { exportEncryptedBackup, importEncryptedBackupFromString, listEncryptedBackups } from './backupService';
import { fetchWithAuth } from './authApi';
import { getApiBaseUrl } from './apiBaseUrl';
import { enqueueMutation } from './mutationQueueService';

const LAST_AUTO_BACKUP_KEY = 'cloud_backup.last_auto_backup_at';

function getBaseUrl(): string | null {
  return getApiBaseUrl();
}

export function isCloudBackupConfigured(): boolean {
  return getBaseUrl() !== null;
}

function requireBaseUrl(): string {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('[CloudBackup] Missing EXPO_PUBLIC_API_BASE_URL');
  return baseUrl;
}

export interface CloudBackupListItem {
  id: string;
  createdAt: number;
  meta: unknown;
}

export async function listCloudBackups(): Promise<CloudBackupListItem[]> {
  requireBaseUrl();
  const res = await fetchWithAuth('/backups', {
    method: 'GET',
  });

  if (!res.ok) throw new Error(`[CloudBackup] List failed (${res.status})`);
  const json = (await res.json()) as { backups?: CloudBackupListItem[] };
  return (json.backups ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);
}

export async function uploadLocalBackupToCloud(options?: {
  passphrase?: string;
}): Promise<{ id: string; createdAt: number }> {
  requireBaseUrl();

  const exported = await exportEncryptedBackup({ passphrase: options?.passphrase });

  // Read the encrypted bundle as a UTF-8 JSON string.
  // This is treated as an opaque blob on the server.
  const backups = await listEncryptedBackups();
  const latest = backups.find((b) => b.uri === exported.uri);

  const blob = await FileSystem.readAsStringAsync(exported.uri, {
    encoding: 'utf8',
  });

  const res = await fetchWithAuth('/backups', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      blob,
      meta: {
        bytes: exported.bytes,
        filename: latest?.filename ?? null,
      },
    }),
  });

  if (!res.ok) throw new Error(`[CloudBackup] Upload failed (${res.status})`);
  return (await res.json()) as { id: string; createdAt: number };
}

export async function restoreCloudBackup(options: { id: string; passphrase?: string }): Promise<void> {
  requireBaseUrl();

  const res = await fetchWithAuth(`/backups/${encodeURIComponent(options.id)}`, {
    method: 'GET',
  });

  if (!res.ok) throw new Error(`[CloudBackup] Fetch failed (${res.status})`);
  const json = (await res.json()) as { blob?: string };
  const blob = json.blob;
  if (!blob) throw new Error('[CloudBackup] Missing blob in response');

  await importEncryptedBackupFromString({
    rawJson: blob,
    passphrase: options.passphrase,
  });
}

export async function deleteCloudBackup(id: string): Promise<void> {
  requireBaseUrl();

  const res = await fetchWithAuth(`/backups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (res.status === 204) return;
  if (!res.ok) throw new Error(`[CloudBackup] Delete failed (${res.status})`);
}

export async function maybeAutoCloudBackupOncePerDay(): Promise<void> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return;

  try {
    const lastRaw = await getAppState(LAST_AUTO_BACKUP_KEY);
    const last = lastRaw ? Number(lastRaw) : 0;
    const now = Date.now();

    // 24h gate.
    if (Number.isFinite(last) && last > 0 && now - last < 24 * 60 * 60 * 1000) {
      return;
    }

    await uploadLocalBackupToCloud();
    await setAppState(LAST_AUTO_BACKUP_KEY, String(now));
  } catch {
    await enqueueMutation('backup.upload_latest', {}, { dedupeKey: 'backup.upload_latest.auto' });
  }
}
