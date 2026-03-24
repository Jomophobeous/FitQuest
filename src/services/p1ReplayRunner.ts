import { recordConsentTimestamp } from './authApi';
import { uploadLocalBackupToCloud } from './cloudBackupService';
import { storeConsentRecord } from './legalService';
import { flushMutationQueue, type MutationJob } from './mutationQueueService';
import { syncOnDemand } from './syncService';

interface LegalSyncConsentPayload {
  timestamp: number;
  version: string;
}

interface SyncOnDemandPayload {
  userId?: string;
  deviceId?: string;
}

async function handleLegalSyncConsent(job: MutationJob): Promise<void> {
  const payload = job.payload as LegalSyncConsentPayload;
  const response = await recordConsentTimestamp();
  await storeConsentRecord({
    timestamp: Number(response?.consentTimestamp) || payload.timestamp,
    version: payload.version,
    source: 'remote',
  });
}

async function handleBackupUploadLatest(): Promise<void> {
  await uploadLocalBackupToCloud();
}

function parseSyncPayload(payload: unknown): SyncOnDemandPayload {
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  return {
    userId: typeof record.userId === 'string' && record.userId.trim().length > 0 ? record.userId : undefined,
    deviceId: typeof record.deviceId === 'string' && record.deviceId.trim().length > 0 ? record.deviceId : undefined,
  };
}

async function handleSyncOnDemand(job: MutationJob): Promise<void> {
  const payload = parseSyncPayload(job.payload);
  await syncOnDemand({ userId: payload.userId, deviceId: payload.deviceId });
}

export async function runP1ReplayCycle(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  pending: number;
}> {
  return flushMutationQueue(
    {
      'legal.sync_consent': handleLegalSyncConsent,
      'backup.upload_latest': handleBackupUploadLatest,
      'sync.on_demand': handleSyncOnDemand,
    },
    { maxJobs: 20, maxAttempts: 5 },
  );
}
