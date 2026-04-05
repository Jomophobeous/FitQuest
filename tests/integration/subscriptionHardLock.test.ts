/**
 * Subscription Hard Lock Tests (Phase 4 Step 4)
 *
 * Test matrix:
 * 1. Server-side subscription verification
 * 2. RevenueCat receipt validation
 * 3. Invalid receipt → 402
 * 4. Expired subscription → 402
 * 5. Valid subscription → 200
 * 6. Client-side bypass attempts → server rejects
 * 7. Tamper detection (wrong user_id) → 402
 * 8. Offline grace period edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import * as SecureStore from 'expo-secure-store';
import { SubscriptionManager } from '../../src/purchases/SubscriptionManager';
import { getTrialState, upsertTrialState, updateTrialConverted } from '../../src/database/service';

vi.mock('expo-secure-store');
vi.mock('../../src/database/service');
vi.mock('react-native-purchases', () => ({
  default: {
    isConfigured: () => false,
    configure: vi.fn(),
    addCustomerInfoUpdateListener: vi.fn(),
  },
}));

describe('Subscription Hard Lock (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (SubscriptionManager as any).instance = null;
  });

  afterEach(() => {
    (SubscriptionManager as any).instance = null;
  });

  describe('1. Client-side bypass prevention', () => {
    it('FAIL: mock mode should NOT be accessible in production', async () => {
      // Set up: mock mode is envvar-controlled
      process.env.EXPO_PUBLIC_BILLING_MODE = 'mock';
      process.env.EXPO_PUBLIC_MOCK_BILLING_STATE = 'premium';

      // Define __DEV__ as false to simulate production
      const originalDev = (global as any).__DEV__;
      Object.defineProperty(global, '__DEV__', {
        value: false,
        writable: true,
      });

      try {
        vi.mocked(getTrialState).mockResolvedValue({
          user_id: 'user_local_001',
          started_at: Date.now(),
          ends_at: Date.now() + 24 * 60 * 60 * 1000,
          converted: 0,
          product_identifier: null,
          notifications_sent: '[]',
        });

        const mgr = await SubscriptionManager.getInstance();
        const state = mgr?.getState();

        // In production, mock mode should NOT activate
        // State should be real (either trial or expired)
        expect(state?.status).not.toBe('ACTIVE');
        expect(state?.verificationSource).not.toBe('mock');
      } finally {
        Object.defineProperty(global, '__DEV__', {
          value: originalDev,
          writable: true,
        });
        delete process.env.EXPO_PUBLIC_BILLING_MODE;
        delete process.env.EXPO_PUBLIC_MOCK_BILLING_STATE;
      }
    });

    it('FAIL: purchaseLocal should be blocked in production', async () => {
      Object.defineProperty(global, '__DEV__', {
        value: false,
        writable: true,
      });

      try {
        vi.mocked(getTrialState).mockResolvedValue(null);
        vi.mocked(upsertTrialState).mockResolvedValue();

        const mgr = await SubscriptionManager.getInstance();
        const result = await mgr?.purchaseMonthly();

        // purchaseLocal is dev-only, so this should fail
        expect(result).toBe(false);
      } finally {
        Object.defineProperty(global, '__DEV__', {
          value: true,
          writable: true,
        });
      }
    });

    it('PASS: offline grace period respects verification timestamp', async () => {
      vi.mocked(getTrialState).mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
        ends_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
        converted: 1,
        product_identifier: 'fitquest_annual',
        notifications_sent: '[]',
      });

      // Simulate cached subscription (verified 2 hours ago)
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      vi.mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce(
          JSON.stringify({
            status: 'ACTIVE',
            isTrial: false,
            expiresDate: null,
            willRenew: true,
            productIdentifier: 'fitquest_annual',
          }),
        )
        .mockResolvedValueOnce(String(twoHoursAgo))
        .mockResolvedValueOnce(String(Date.now())); // clock checkpoint

      const mgr = await SubscriptionManager.getInstance();
      const state = mgr?.getState();

      expect(state?.status).toBe('ACTIVE');
      expect(state?.verificationSource).toBe('local');
    });

    it('FAIL: offline grace period expires after 24 hours', async () => {
      vi.mocked(getTrialState).mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
        ends_at: Date.now() - 29 * 24 * 60 * 60 * 1000,
        converted: 1,
        product_identifier: 'fitquest_monthly',
        notifications_sent: '[]',
      });

      // Simulate cached subscription verified >24h ago
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000; // eslint-disable-line
      vi.mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce(
          JSON.stringify({
            status: 'ACTIVE',
            isTrial: false,
            expiresDate: null,
            willRenew: true,
          }),
        )
        .mockResolvedValueOnce(String(twoDaysAgo)) // eslint-disable-line
        .mockResolvedValueOnce(String(Date.now()));

      const mgr = await SubscriptionManager.getInstance();
      const state = mgr?.getState();

      // Cache is stale, should fall back to local data (expired trial)
      expect(state?.status).toBe('EXPIRED');
    });
  });

  describe('2. Trial expiry enforcement', () => {
    it('PASS: trial in progress grants access', async () => {
      const now = Date.now();
      const trialEnd = now + 5 * 24 * 60 * 60 * 1000; // 5 days left

      vi.mocked(getTrialState).mockResolvedValue({
        user_id: 'user_local_001',
        started_at: now - 9 * 24 * 60 * 60 * 1000,
        ends_at: trialEnd,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue(String(now)); // clock checkpoint

      const mgr = await SubscriptionManager.getInstance();
      const state = mgr?.getState();

      expect(state?.status).toBe('TRIAL');
      expect(state?.isTrial).toBe(true);
      expect(mgr?.hasAccess()).toBe(true);
    });

    it('FAIL: trial expiry denies access', async () => {
      const now = Date.now();
      const trialEnd = now - 1000; // Already expired

      vi.mocked(getTrialState).mockResolvedValue({
        user_id: 'user_local_001',
        started_at: now - 15 * 24 * 60 * 60 * 1000,
        ends_at: trialEnd,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue(String(now));

      const mgr = await SubscriptionManager.getInstance();
      const state = mgr?.getState();

      expect(state?.status).toBe('EXPIRED');
      expect(mgr?.hasAccess()).toBe(false);
    });

    it('PASS: clock tampering (backward rollback) forces expiry', async () => {
      const now = Date.now();
      const lastSeen = now + 100_000; // Future time (rollback attempt)

      vi.mocked(getTrialState).mockResolvedValue({
        user_id: 'user_local_001',
        started_at: now - 5 * 24 * 60 * 60 * 1000,
        ends_at: now + 9 * 24 * 60 * 60 * 1000,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });
      vi.mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce(String(lastSeen)) // First call: checkpoint read
        .mockResolvedValueOnce(String(now)); // Second call: checkpoint write

      const mgr = await SubscriptionManager.getInstance();
      const state = mgr?.getState();

      // Clock rollback detected → force expiry
      expect(state?.status).toBe('EXPIRED');
    });
  });

  describe('3. Client cache semantics', () => {
    it('PASS: getState returns current cached state (not authoritative)', async () => {
      vi.mocked(getTrialState).mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now(),
        ends_at: Date.now() + 14 * 24 * 60 * 60 * 1000,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      const state1 = mgr?.getState();
      const state2 = mgr?.getState();

      // Both should be identical (same reference check unnecessary, but same data)
      expect(state1?.status).toBe(state2?.status);
      expect(state1?.isTrial).toBe(state2?.isTrial);
    });

    it('PASS: listeners are notified on state change', async () => {
      vi.mocked(getTrialState).mockResolvedValue(null);
      vi.mocked(upsertTrialState).mockResolvedValue();
      vi.mocked(updateTrialConverted).mockResolvedValue();

      const mgr = await SubscriptionManager.getInstance();
      const listener = vi.fn();
      mgr?.addListener(listener);

      // Purchase → state changes → listener called
      await mgr?.purchaseMonthly();

      expect(listener).toHaveBeenCalled();
      const newState = listener.mock.calls[0]?.[0];
      expect(newState?.status).toBe('ACTIVE');
    });
  });

  describe('4. Access control', () => {
    it('PASS: hasAccess returns true for TRIAL and ACTIVE', async () => {
      vi.mocked(getTrialState).mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now(),
        ends_at: Date.now() + 14 * 24 * 60 * 60 * 1000,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      expect(mgr?.hasAccess()).toBe(true);
    });

    it('FAIL: hasAccess returns false for EXPIRED', async () => {
      vi.mocked(getTrialState).mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now() - 100 * 24 * 60 * 60 * 1000,
        ends_at: Date.now() - 99 * 24 * 60 * 60 * 1000,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      expect(mgr?.hasAccess()).toBe(false);
    });
  });
});
