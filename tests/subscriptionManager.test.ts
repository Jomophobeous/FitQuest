import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──
const {
  mockGetTrialState,
  mockUpsertTrialState,
  mockUpdateTrialConverted,
  mockSecureStoreGet,
  mockSecureStoreSet,
} = vi.hoisted(() => ({
  mockGetTrialState: vi.fn(),
  mockUpsertTrialState: vi.fn(),
  mockUpdateTrialConverted: vi.fn(),
  mockSecureStoreGet: vi.fn(),
  mockSecureStoreSet: vi.fn(),
}));

vi.mock('../src/database/service', () => ({
  getTrialState: (...args: any[]) => mockGetTrialState(...args),
  upsertTrialState: (...args: any[]) => mockUpsertTrialState(...args),
  updateTrialConverted: (...args: any[]) => mockUpdateTrialConverted(...args),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: (...args: any[]) => mockSecureStoreGet(...args),
  setItemAsync: (...args: any[]) => mockSecureStoreSet(...args),
}));

// Mock logger
vi.mock('../src/services/logger', () => ({
  safeWarn: vi.fn(),
  safeLog: vi.fn(),
  safeError: vi.fn(),
}));

// Always fail to import react-native-purchases so we test local flow
vi.mock('react-native-purchases', () => {
  throw new Error('Not installed');
});

import { SubscriptionManager, type SubscriptionState, type SubscriptionStatus } from '../src/purchases/SubscriptionManager';

describe('SubscriptionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTrialState.mockResolvedValue(null);
    mockUpsertTrialState.mockResolvedValue(undefined);
    mockUpdateTrialConverted.mockResolvedValue(undefined);
    mockSecureStoreGet.mockResolvedValue(null);
    mockSecureStoreSet.mockResolvedValue(undefined);
    // Reset singleton
    (SubscriptionManager as any).instance = null;
  });

  describe('initialization', () => {
    it('creates a singleton instance', async () => {
      const mgr1 = await SubscriptionManager.getInstance();
      const mgr2 = await SubscriptionManager.getInstance();
      expect(mgr1).toBe(mgr2);
    });

    it('starts a 14-day trial on first launch (no existing trial state)', async () => {
      mockGetTrialState.mockResolvedValue(null);
      const mgr = await SubscriptionManager.getInstance();
      const state = mgr.getState();

      expect(state.status).toBe('TRIAL');
      expect(state.isTrial).toBe(true);
      expect(state.trialEndDate).toBeTypeOf('number');
      expect(state.verificationSource).toBe('local');

      // Verify upsertTrialState was called with 14-day window
      expect(mockUpsertTrialState).toHaveBeenCalledTimes(1);
      const call = mockUpsertTrialState.mock.calls[0][0];
      expect(call.user_id).toBe('user_local_001');
      const durationMs = call.ends_at - call.started_at;
      expect(durationMs).toBe(14 * 24 * 60 * 60 * 1000);
    });
  });

  describe('trial state', () => {
    it('returns TRIAL when trial is still active', async () => {
      const now = Date.now();
      mockGetTrialState.mockResolvedValue({
        user_id: 'user_local_001',
        started_at: now - 3 * 86400000, // 3 days ago
        ends_at: now + 11 * 86400000,   // 11 days left
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      const state = mgr.getState();

      expect(state.status).toBe('TRIAL');
      expect(state.isTrial).toBe(true);
      expect(state.willRenew).toBe(false);
      expect(state.productIdentifier).toBeNull();
    });

    it('returns EXPIRED when trial has ended', async () => {
      const now = Date.now();
      mockGetTrialState.mockResolvedValue({
        user_id: 'user_local_001',
        started_at: now - 15 * 86400000, // 15 days ago
        ends_at: now - 1 * 86400000,     // expired 1 day ago
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      const state = mgr.getState();

      expect(state.status).toBe('EXPIRED');
      expect(state.isTrial).toBe(false);
    });

    it('returns ACTIVE when trial has been converted', async () => {
      mockGetTrialState.mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now() - 10 * 86400000,
        ends_at: Date.now() + 4 * 86400000,
        converted: 1,
        product_identifier: 'fitquest_monthly',
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      const state = mgr.getState();

      expect(state.status).toBe('ACTIVE');
      expect(state.isTrial).toBe(false);
      expect(state.willRenew).toBe(true);
      expect(state.productIdentifier).toBe('fitquest_monthly');
    });
  });

  describe('hasAccess', () => {
    it('returns true during trial', async () => {
      mockGetTrialState.mockResolvedValue(null); // triggers fresh trial
      const mgr = await SubscriptionManager.getInstance();
      expect(mgr.hasAccess()).toBe(true);
    });

    it('returns false when expired', async () => {
      mockGetTrialState.mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now() - 30 * 86400000,
        ends_at: Date.now() - 16 * 86400000,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      expect(mgr.hasAccess()).toBe(false);
    });

    it('returns true when active subscriber', async () => {
      mockGetTrialState.mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now() - 30 * 86400000,
        ends_at: Date.now() - 16 * 86400000,
        converted: 1,
        product_identifier: 'fitquest_annual',
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      expect(mgr.hasAccess()).toBe(true);
    });
  });

  describe('getTrialDaysRemaining', () => {
    it('returns correct days remaining during trial', async () => {
      const now = Date.now();
      const daysLeft = 10;
      mockGetTrialState.mockResolvedValue({
        user_id: 'user_local_001',
        started_at: now - 4 * 86400000,
        ends_at: now + daysLeft * 86400000,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      expect(mgr.getTrialDaysRemaining()).toBe(daysLeft);
    });

    it('returns 0 when trial has expired', async () => {
      mockGetTrialState.mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now() - 20 * 86400000,
        ends_at: Date.now() - 6 * 86400000,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      expect(mgr.getTrialDaysRemaining()).toBe(0);
    });

    it('returns 0 when user is active subscriber (not trial)', async () => {
      mockGetTrialState.mockResolvedValue({
        user_id: 'user_local_001',
        started_at: Date.now() - 20 * 86400000,
        ends_at: Date.now() - 6 * 86400000,
        converted: 1,
        product_identifier: 'fitquest_monthly',
        notifications_sent: '[]',
      });

      const mgr = await SubscriptionManager.getInstance();
      expect(mgr.getTrialDaysRemaining()).toBe(0);
    });
  });

  describe('purchaseLocal', () => {
    it('purchaseMonthly transitions to ACTIVE', async () => {
      mockGetTrialState.mockResolvedValue(null); // start trial first
      const mgr = await SubscriptionManager.getInstance();

      const success = await mgr.purchaseMonthly();

      expect(success).toBe(true);
      expect(mockUpdateTrialConverted).toHaveBeenCalledWith('user_local_001', 'fitquest_monthly');

      const state = mgr.getState();
      expect(state.status).toBe('ACTIVE');
      expect(state.isTrial).toBe(false);
      expect(state.productIdentifier).toBe('fitquest_monthly');
    });

    it('purchaseAnnual transitions to ACTIVE', async () => {
      mockGetTrialState.mockResolvedValue(null);
      const mgr = await SubscriptionManager.getInstance();

      const success = await mgr.purchaseAnnual();

      expect(success).toBe(true);
      expect(mockUpdateTrialConverted).toHaveBeenCalledWith('user_local_001', 'fitquest_annual');

      const state = mgr.getState();
      expect(state.status).toBe('ACTIVE');
      expect(state.productIdentifier).toBe('fitquest_annual');
    });
  });

  describe('getOfferings', () => {
    it('returns default offerings when RevenueCat disabled', async () => {
      const mgr = await SubscriptionManager.getInstance();
      const offerings = await mgr.getOfferings();

      expect(offerings.monthly).toBeTruthy();
      expect(offerings.annual).toBeTruthy();
      expect(offerings.monthly!.identifier).toBe('fitquest_monthly');
      expect(offerings.annual!.identifier).toBe('fitquest_annual');
      expect(offerings.annual!.savingsPercent).toBeGreaterThan(0);
    });
  });

  describe('event system', () => {
    it('notifies listeners on state change', async () => {
      mockGetTrialState.mockResolvedValue(null);
      const mgr = await SubscriptionManager.getInstance();

      const states: SubscriptionState[] = [];
      mgr.addListener((state) => states.push(state));

      await mgr.purchaseMonthly();

      expect(states.length).toBeGreaterThanOrEqual(1);
      const lastState = states[states.length - 1];
      expect(lastState.status).toBe('ACTIVE');
    });

    it('unsubscribe stops notifications', async () => {
      mockGetTrialState.mockResolvedValue(null);
      const mgr = await SubscriptionManager.getInstance();

      const states: SubscriptionState[] = [];
      const unsub = mgr.addListener((state) => states.push(state));

      unsub();
      await mgr.purchaseMonthly();

      expect(states.length).toBe(0);
    });
  });

  describe('parseCustomerInfo', () => {
    it('returns EXPIRED when no entitlements', async () => {
      const mgr = await SubscriptionManager.getInstance();
      const parseInfo = (mgr as any).parseCustomerInfo.bind(mgr);

      const state = parseInfo({ entitlements: { active: {} } }, 'revenuecat');
      expect(state.status).toBe('EXPIRED');
      expect(state.isTrial).toBe(false);
    });

    it('returns TRIAL when entitlement periodType is TRIAL', async () => {
      const mgr = await SubscriptionManager.getInstance();
      const parseInfo = (mgr as any).parseCustomerInfo.bind(mgr);

      const trialEnd = new Date(Date.now() + 7 * 86400000).toISOString();
      const state = parseInfo({
        entitlements: {
          active: {
            full_access: {
              periodType: 'TRIAL',
              expirationDate: trialEnd,
              willRenew: false,
              productIdentifier: 'fitquest_monthly',
            },
          },
        },
      }, 'revenuecat');

      expect(state.status).toBe('TRIAL');
      expect(state.isTrial).toBe(true);
      expect(state.trialEndDate).toBeTypeOf('number');
      expect(state.verificationSource).toBe('revenuecat');
    });

    it('returns ACTIVE for non-trial entitled user', async () => {
      const mgr = await SubscriptionManager.getInstance();
      const parseInfo = (mgr as any).parseCustomerInfo.bind(mgr);

      const state = parseInfo({
        entitlements: {
          active: {
            full_access: {
              periodType: 'NORMAL',
              expirationDate: new Date(Date.now() + 30 * 86400000).toISOString(),
              willRenew: true,
              productIdentifier: 'fitquest_annual',
            },
          },
        },
      }, 'revenuecat');

      expect(state.status).toBe('ACTIVE');
      expect(state.willRenew).toBe(true);
      expect(state.productIdentifier).toBe('fitquest_annual');
    });
  });

  describe('offline grace period', () => {
    it('restores cached state within 7-day grace window', async () => {
      const cachedState: SubscriptionState = {
        status: 'ACTIVE',
        isTrial: false,
        trialEndDate: null,
        expiresDate: Date.now() + 10 * 86400000,
        willRenew: true,
        productIdentifier: 'fitquest_annual',
        verificationSource: 'revenuecat',
        lastVerifiedAt: Date.now() - 3 * 86400000, // verified 3 days ago (within 7-day grace)
      };

      mockSecureStoreGet.mockImplementation((key: string) => {
        if (key.includes('cache')) return Promise.resolve(JSON.stringify(cachedState));
        if (key.includes('verified')) return Promise.resolve(String(cachedState.lastVerifiedAt));
        return Promise.resolve(null);
      });

      const mgr = await SubscriptionManager.getInstance();
      const graceState = await (mgr as any).getOfflineGraceState();

      expect(graceState).not.toBeNull();
      expect(graceState.status).toBe('ACTIVE');
      expect(graceState.verificationSource).toBe('offline_grace');
      expect(graceState.willRenew).toBe(false); // grace period doesn't guarantee renewal
    });

    it('returns null when grace period exceeded (>7 days)', async () => {
      const cachedState: SubscriptionState = {
        status: 'ACTIVE',
        isTrial: false,
        trialEndDate: null,
        expiresDate: Date.now() + 10 * 86400000,
        willRenew: true,
        productIdentifier: 'fitquest_annual',
        verificationSource: 'revenuecat',
        lastVerifiedAt: Date.now() - 8 * 86400000, // verified 8 days ago (beyond grace)
      };

      mockSecureStoreGet.mockImplementation((key: string) => {
        if (key.includes('cache')) return Promise.resolve(JSON.stringify(cachedState));
        if (key.includes('verified')) return Promise.resolve(String(cachedState.lastVerifiedAt));
        return Promise.resolve(null);
      });

      const mgr = await SubscriptionManager.getInstance();
      const graceState = await (mgr as any).getOfflineGraceState();

      expect(graceState).toBeNull();
    });

    it('returns null when cached state is EXPIRED', async () => {
      const cachedState: SubscriptionState = {
        status: 'EXPIRED',
        isTrial: false,
        trialEndDate: null,
        expiresDate: null,
        willRenew: false,
        productIdentifier: null,
        verificationSource: 'revenuecat',
        lastVerifiedAt: Date.now() - 1 * 86400000,
      };

      mockSecureStoreGet.mockImplementation((key: string) => {
        if (key.includes('cache')) return Promise.resolve(JSON.stringify(cachedState));
        if (key.includes('verified')) return Promise.resolve(String(cachedState.lastVerifiedAt));
        return Promise.resolve(null);
      });

      const mgr = await SubscriptionManager.getInstance();
      const graceState = await (mgr as any).getOfflineGraceState();

      expect(graceState).toBeNull();
    });

    it('returns null when no cached state exists', async () => {
      mockSecureStoreGet.mockResolvedValue(null);
      const mgr = await SubscriptionManager.getInstance();
      const graceState = await (mgr as any).getOfflineGraceState();

      expect(graceState).toBeNull();
    });
  });

  describe('restorePurchases', () => {
    it('falls back to refresh when RevenueCat unavailable', async () => {
      mockGetTrialState.mockResolvedValue(null);
      const mgr = await SubscriptionManager.getInstance();

      const state = await mgr.restorePurchases();
      expect(state.status).toBe('TRIAL');
      expect(state.verificationSource).toBe('local');
    });
  });

  describe('state immutability', () => {
    it('getState returns a copy, not a reference', async () => {
      const mgr = await SubscriptionManager.getInstance();
      const s1 = mgr.getState();
      const s2 = mgr.getState();
      expect(s1).toEqual(s2);
      expect(s1).not.toBe(s2); // different object references
    });
  });
});
