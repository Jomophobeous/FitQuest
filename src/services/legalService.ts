import Constants from 'expo-constants';
import { deleteAppStateByPrefix, getAppState, setAppState } from '../database/service';
import { recordConsentTimestamp } from './authApi';
import { enqueueMutation } from './mutationQueueService';

export const LEGAL_POLICY_VERSION = '2026-03-13.1';

const CONSENT_TIMESTAMP_KEY = 'legal.consent.timestamp';
const CONSENT_VERSION_KEY = 'legal.consent.version';
const CONSENT_SOURCE_KEY = 'legal.consent.source';

export interface ConsentRecord {
  timestamp: number | null;
  version: string | null;
  source: 'remote' | 'local' | null;
}

export interface LegalLinks {
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
}

const DEFAULT_LINKS: LegalLinks = {
  privacyPolicyUrl: 'https://fitquest.dev/privacy',
  termsOfServiceUrl: 'https://fitquest.dev/terms',
};

export async function getConsentRecord(): Promise<ConsentRecord> {
  const [timestampRaw, version, sourceRaw] = await Promise.all([
    getAppState(CONSENT_TIMESTAMP_KEY),
    getAppState(CONSENT_VERSION_KEY),
    getAppState(CONSENT_SOURCE_KEY),
  ]);

  const timestamp = timestampRaw ? Number(timestampRaw) : null;
  const source = sourceRaw === 'remote' || sourceRaw === 'local' ? sourceRaw : null;

  return {
    timestamp: Number.isFinite(timestamp as number) ? (timestamp as number) : null,
    version: version || null,
    source,
  };
}

export async function storeConsentRecord(record: {
  timestamp: number;
  version: string;
  source: 'remote' | 'local';
}): Promise<void> {
  await Promise.all([
    setAppState(CONSENT_TIMESTAMP_KEY, String(record.timestamp)),
    setAppState(CONSENT_VERSION_KEY, record.version),
    setAppState(CONSENT_SOURCE_KEY, record.source),
  ]);
}

export async function acceptCurrentPolicies(): Promise<{ timestamp: number; source: 'remote' | 'local'; version: string }> {
  const now = Date.now();
  try {
    const result = await recordConsentTimestamp();
    const timestamp = Number(result?.consentTimestamp) || now;
    await storeConsentRecord({
      timestamp,
      version: LEGAL_POLICY_VERSION,
      source: 'remote',
    });
    return { timestamp, source: 'remote', version: LEGAL_POLICY_VERSION };
  } catch {
    await storeConsentRecord({
      timestamp: now,
      version: LEGAL_POLICY_VERSION,
      source: 'local',
    });
    await enqueueMutation(
      'legal.sync_consent',
      { timestamp: now, version: LEGAL_POLICY_VERSION },
      { dedupeKey: 'legal.sync_consent.current' },
    );
    return { timestamp: now, source: 'local', version: LEGAL_POLICY_VERSION };
  }
}

export async function withdrawConsentLocally(): Promise<void> {
  await deleteAppStateByPrefix('legal.consent.');
}

export function getLegalLinks(): LegalLinks {
  const extra = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
  const legal = (extra.legal || {}) as Record<string, unknown>;

  const privacyPolicyUrl = typeof legal.privacyPolicyUrl === 'string' && legal.privacyPolicyUrl.trim().length > 0
    ? legal.privacyPolicyUrl
    : DEFAULT_LINKS.privacyPolicyUrl;

  const termsOfServiceUrl = typeof legal.termsOfServiceUrl === 'string' && legal.termsOfServiceUrl.trim().length > 0
    ? legal.termsOfServiceUrl
    : DEFAULT_LINKS.termsOfServiceUrl;

  return { privacyPolicyUrl, termsOfServiceUrl };
}
