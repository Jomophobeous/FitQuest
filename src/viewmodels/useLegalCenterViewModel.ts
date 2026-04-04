/**
 * Legal Center Screen ViewModel
 * Encapsulates consent record loading, policy acceptance/withdrawal, legal links, and replay orchestration.
 */
import { useState, useCallback } from 'react';
import { createViewModel } from './createViewModel';
import {
  LEGAL_POLICY_VERSION,
  acceptCurrentPolicies,
  getConsentRecord,
  getLegalLinks,
  withdrawConsentLocally,
  type ConsentRecord,
} from '../services/legalService';
import { runReplayIfDue } from '../services/replayOrchestrator';

export { LEGAL_POLICY_VERSION };
export type { ConsentRecord };

export const useLegalCenterViewModel = createViewModel(() => {
  const [consent, setConsent] = useState<ConsentRecord>({ timestamp: null, version: null, source: null });
  const [saving, setSaving] = useState(false);
  const links = getLegalLinks();

  const loadConsent = useCallback(async () => {
    const record = await getConsentRecord();
    setConsent(record);
  }, []);

  const triggerReplay = useCallback(() => {
    void runReplayIfDue({ reason: 'legal_center_load', cooldownMs: 45 * 1000 });
  }, []);

  const acceptPolicies = useCallback(async () => {
    setSaving(true);
    try {
      await acceptCurrentPolicies();
      await loadConsent();
    } finally {
      setSaving(false);
    }
  }, [loadConsent]);

  const withdrawConsent = useCallback(async () => {
    await withdrawConsentLocally();
    await loadConsent();
  }, [loadConsent]);

  return {
    consent,
    saving,
    links,
    loadConsent,
    triggerReplay,
    acceptPolicies,
    withdrawConsent,
  };
});
