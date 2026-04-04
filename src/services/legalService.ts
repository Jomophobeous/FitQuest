/**
 * Legal Service Stub
 * Consent management for POPIA/GDPR compliance.
 */
import * as SecureStore from 'expo-secure-store';

export const LEGAL_POLICY_VERSION = '1.0.0';

export interface ConsentRecord {
  timestamp: number | null;
  version: string | null;
  source: 'remote' | 'local' | null;
}

export async function getConsentRecord(): Promise<ConsentRecord> {
  try {
    const raw = await SecureStore.getItemAsync('fitquest.consent');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { timestamp: null, version: null, source: null };
}

export async function acceptCurrentPolicies(): Promise<ConsentRecord> {
  const record: ConsentRecord = {
    timestamp: Date.now(),
    version: LEGAL_POLICY_VERSION,
    source: 'local',
  };
  await SecureStore.setItemAsync('fitquest.consent', JSON.stringify(record));
  return record;
}

export function getLegalLinks(): {
  privacy: string;
  terms: string;
  privacyPolicyUrl: string;
  termsOfServiceUrl: string;
} {
  return {
    privacy: '/privacy-policy',
    terms: '/terms-of-service',
    privacyPolicyUrl: 'https://fitquest.app/privacy',
    termsOfServiceUrl: 'https://fitquest.app/terms',
  };
}

export async function withdrawConsentLocally(): Promise<void> {
  await SecureStore.deleteItemAsync('fitquest.consent');
}
