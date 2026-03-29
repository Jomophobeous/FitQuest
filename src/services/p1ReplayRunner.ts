import { recordConsentTimestamp } from './authApi';
import { uploadLocalBackupToCloud } from './cloudBackupService';
import { storeConsentRecord } from './legalService';
import { flushMutationQueue, type MutationJob } from './mutationQueueService';
import { safeWarn } from './logger';

interface LegalSyncConsentPayload {
  timestamp: number;
  version: string;
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

async function handleSyncOnDemand(_job: MutationJob): Promise<void> {
  safeWarn('[p1Replay] sync.on_demand skipped — no backend server configured');
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
