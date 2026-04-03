/**
 * FitQuest Subscription Manager
 *
 * Simple subscription model: 14-day free trial, then monthly or annual.
 * No tiered features — full access for subscribers.
 *
 * Uses react-native-purchases (RevenueCat) when available,
 * with a local SQLite fallback for development/testing.
 */

import { getTrialState, upsertTrialState, updateTrialConverted } from '../database/service';
import * as SecureStore from 'expo-secure-store';
import { safeWarn } from '../services/logger';
import { captureException } from '../services/crashReporting';
import { logEvent } from '../services/telemetry';

// ============================================
// TYPES
// ============================================

export type SubscriptionStatus =
  | 'TRIAL' // First 14 days
  | 'ACTIVE' // Paying subscriber
  | 'EXPIRED' // Trial ended or cancelled
  | 'LIFETIME'; // DORMANT — type preserved, no activation paths exist

export interface SubscriptionState {
  status: SubscriptionStatus;
  isTrial: boolean;
  trialEndDate: number | null;
  expiresDate: number | null;
  willRenew: boolean;
  productIdentifier: string | null; // 'fitquest_monthly' | 'fitquest_annual'
  verificationSource?: 'revenuecat' | 'local' | 'offline_grace';
  lastVerifiedAt?: number | null;
}

export interface SubscriptionOfferings {
  monthly: { price: string; pricePerMonth: string; identifier: string } | null;
  annual: { price: string; pricePerMonth: string; identifier: string; savingsPercent: number } | null;
}

// ============================================
// CONSTANTS
// ============================================

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000; // 24 hours
const ENTITLEMENT_ID = 'full_access';
const PRODUCT_MONTHLY = 'fitquest_monthly';
const PRODUCT_ANNUAL = 'fitquest_annual';

const RC_PUBLIC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
const BILLING_MODE = process.env.EXPO_PUBLIC_BILLING_MODE; // 'mock' | 'live'
const MOCK_BILLING_STATE = process.env.EXPO_PUBLIC_MOCK_BILLING_STATE; // 'premium' | 'trial' | 'expired'
const SUBSCRIPTION_CACHE_KEY = 'fitquest_subscription_cache_v1';
const SUBSCRIPTION_LAST_VERIFIED_KEY = 'fitquest_subscription_last_verified_at';
const CLOCK_CHECKPOINT_KEY = 'fitquest_clock_checkpoint';

// ============================================
// SUBSCRIPTION MANAGER
// ============================================

export class SubscriptionManager {
  private static instance: SubscriptionManager | null = null;
  private currentState: SubscriptionState;
  private listeners: Array<(state: SubscriptionState) => void> = [];
  private revenueCatAvailable = false;
  private purchaseInProgress = false;

  private isMockMode = false;

  private constructor() {
    this.currentState = {
      status: 'TRIAL',
      isTrial: true,
      trialEndDate: null,
      expiresDate: null,
      willRenew: false,
      productIdentifier: null,
      verificationSource: 'local',
      lastVerifiedAt: null,
    };
  }

  static async getInstance(): Promise<SubscriptionManager> {
    if (!this.instance) {
      this.instance = new SubscriptionManager();
      await this.instance.initialize();
    }
    return this.instance;
  }

  // ── Initialization ──

  private async initialize(): Promise<void> {
    // Mock billing mode — simulate subscription states without RevenueCat
    if (BILLING_MODE === 'mock') {
      this.isMockMode = true;
      this.revenueCatAvailable = false;
      const mockState = this.buildMockState(MOCK_BILLING_STATE || 'premium');
      this.updateState(mockState);
      safeWarn(`[SubscriptionManager] Mock billing mode: ${mockState.status}`);
      void logEvent('subscription_mock_mode', { state: mockState.status });
      return;
    }

    // Try to initialize RevenueCat
    try {
      const Purchases = await this.getRevenueCatModule();
      if (Purchases) {
        const apiKey = RC_PUBLIC_API_KEY;

        // Never configure RevenueCat with a test key in production —
        // it causes a fatal SimulatedStoreErrorDialogActivity crash
        const isTestKey = apiKey?.startsWith('test_');
        if (!apiKey || (isTestKey && !__DEV__)) {
          safeWarn('[SubscriptionManager] Subscriptions disabled: ' + (!apiKey ? 'no API key' : 'test key in production') + '. App runs in trial/free mode.');
          this.revenueCatAvailable = false;
        } else if (apiKey && !apiKey.includes('your_key_here')) {
          // Guard: RevenueCat native SDK retains state across JS reloads (HMR).
          // Only configure if not already configured to avoid duplicate init warning.
          if (typeof Purchases.isConfigured === 'function' && Purchases.isConfigured()) {
            safeWarn('[SubscriptionManager] RevenueCat already configured, skipping');
          } else {
            Purchases.configure({ apiKey: apiKey.trim() });
          }
          this.revenueCatAvailable = true;

          // Listen for purchase events
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RevenueCat callback type
          Purchases.addCustomerInfoUpdateListener((info: any) => {
            this.handleCustomerInfoUpdate(info);
          });
        }
      }
    } catch {
      // RevenueCat not installed — use local trial tracking
      this.revenueCatAvailable = false;
    }

    // Load current state
    await this.refresh();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RevenueCat SDK has no TS declarations in dynamic require
  private async getRevenueCatModule(): Promise<any | null> {
    try {
      return require('react-native-purchases').default;
    } catch {
      return null;
    }
  }

  // ── Core State Management ──

  private buildMockState(mode: string): SubscriptionState {
    const now = Date.now();
    switch (mode) {
      case 'premium':
        return {
          status: 'ACTIVE',
          isTrial: false,
          trialEndDate: null,
          expiresDate: null,
          willRenew: true,
          productIdentifier: PRODUCT_ANNUAL,
          verificationSource: 'local',
          lastVerifiedAt: now,
        };
      case 'expired':
        return {
          status: 'EXPIRED',
          isTrial: false,
          trialEndDate: now - TRIAL_DURATION_MS,
          expiresDate: now - 1000,
          willRenew: false,
          productIdentifier: null,
          verificationSource: 'local',
          lastVerifiedAt: now,
        };
      case 'trial':
      default:
        return {
          status: 'TRIAL',
          isTrial: true,
          trialEndDate: now + TRIAL_DURATION_MS,
          expiresDate: now + TRIAL_DURATION_MS,
          willRenew: false,
          productIdentifier: null,
          verificationSource: 'local',
          lastVerifiedAt: now,
        };
    }
  }

  /**
   * Switch mock billing state at runtime (for testing all paths).
   * Only works when BILLING_MODE=mock.
   */
  setMockState(mode: 'premium' | 'trial' | 'expired'): void {
    if (!this.isMockMode) {
      safeWarn('[SubscriptionManager] setMockState ignored — not in mock mode');
      return;
    }
    const state = this.buildMockState(mode);
    this.updateState(state);
    void logEvent('subscription_mock_switch', { to: mode });
  }

  async refresh(): Promise<SubscriptionState> {
    if (this.isMockMode) return this.currentState;
    if (this.revenueCatAvailable) {
      return this.refreshFromRevenueCat();
    }
    return this.refreshFromLocal();
  }

  private async refreshFromRevenueCat(): Promise<SubscriptionState> {
    try {
      const Purchases = await this.getRevenueCatModule();
      if (!Purchases) return this.refreshFromLocal();

      const info = await Purchases.getCustomerInfo();
      const state = this.parseCustomerInfo(info, 'revenuecat');
      this.updateState(state);
      await this.persistVerifiedState(state);
      return state;
    } catch {
      const graceState = await this.getOfflineGraceState();
      if (graceState) {
        this.updateState(graceState);
        return graceState;
      }
      return this.refreshFromLocal();
    }
  }

  /**
   * Detect device clock tampering:
   * L1 — backward rollback: current time < last recorded time (>60s tolerance)
   * L2 — abnormal forward jump: clock jumped >24h since last checkpoint
   * Returns true if clock appears tampered.
   */
  private async isClockTampered(): Promise<boolean> {
    const now = Date.now();
    try {
      const raw = await SecureStore.getItemAsync(CLOCK_CHECKPOINT_KEY);
      if (raw) {
        const lastSeen = Number(raw);
        if (Number.isFinite(lastSeen)) {
          // L1: backward rollback (>60s tolerance for NTP drift)
          if (now < lastSeen - 60_000) {
            safeWarn('[SubscriptionManager] Clock rollback detected', { now, lastSeen });
            void logEvent('subscription_clock_tamper', { type: 'rollback', now, lastSeen });
            return true;
          }
          // L2: abnormal forward jump (>24h since last app lifecycle)
          const FORWARD_JUMP_THRESHOLD = 24 * 60 * 60 * 1000; // 24h
          if (now - lastSeen > FORWARD_JUMP_THRESHOLD) {
            safeWarn('[SubscriptionManager] Abnormal forward clock jump detected', {
              now,
              lastSeen,
              deltaHours: Math.round((now - lastSeen) / 3600000),
            });
            void logEvent('subscription_clock_tamper', {
              type: 'forward_jump',
              now,
              lastSeen,
              deltaHours: Math.round((now - lastSeen) / 3600000),
            });
            return true;
          }
        }
      }
      // Always advance the checkpoint
      await SecureStore.setItemAsync(CLOCK_CHECKPOINT_KEY, String(now));
    } catch {
      // SecureStore failure — non-fatal, continue without guard
    }
    return false;
  }

  private async refreshFromLocal(): Promise<SubscriptionState> {
    const userId = 'user_local_001';

    const trial = await getTrialState(userId);

    if (!trial) {
      // First launch — start trial
      const now = Date.now();
      const trialEnd = now + TRIAL_DURATION_MS;

      await upsertTrialState({
        user_id: userId,
        started_at: now,
        ends_at: trialEnd,
        converted: 0,
        product_identifier: null,
        notifications_sent: '[]',
      });

      const state: SubscriptionState = {
        status: 'TRIAL',
        isTrial: true,
        trialEndDate: trialEnd,
        expiresDate: trialEnd,
        willRenew: false,
        productIdentifier: null,
        verificationSource: 'local',
        lastVerifiedAt: null,
      };
      this.updateState(state);
      return state;
    }

    if (trial.converted) {
      const state: SubscriptionState = {
        status: 'ACTIVE',
        isTrial: false,
        trialEndDate: null,
        expiresDate: null, // Ongoing
        willRenew: true,
        productIdentifier: trial.product_identifier,
        verificationSource: 'local',
        lastVerifiedAt: null,
      };
      this.updateState(state);
      return state;
    }

    const now = Date.now();

    // Clock tamper guard: if device clock rolled back, force expire
    const tampered = await this.isClockTampered();
    if (tampered && !trial.converted) {
      const state: SubscriptionState = {
        status: 'EXPIRED',
        isTrial: false,
        trialEndDate: trial.ends_at,
        expiresDate: trial.ends_at,
        willRenew: false,
        productIdentifier: null,
        verificationSource: 'local',
        lastVerifiedAt: null,
      };
      this.updateState(state);
      return state;
    }

    if (now < trial.ends_at) {
      const state: SubscriptionState = {
        status: 'TRIAL',
        isTrial: true,
        trialEndDate: trial.ends_at,
        expiresDate: trial.ends_at,
        willRenew: false,
        productIdentifier: null,
        verificationSource: 'local',
        lastVerifiedAt: null,
      };
      this.updateState(state);
      return state;
    }

    // Trial expired
    const state: SubscriptionState = {
      status: 'EXPIRED',
      isTrial: false,
      trialEndDate: trial.ends_at,
      expiresDate: trial.ends_at,
      willRenew: false,
      productIdentifier: null,
      verificationSource: 'local',
      lastVerifiedAt: null,
    };
    this.updateState(state);
    return state;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RevenueCat CustomerInfo has no public TS declarations
  private parseCustomerInfo(info: any, source: 'revenuecat' | 'local' = 'local'): SubscriptionState {
    const now = Date.now();
    const entitlement = info?.entitlements?.active?.[ENTITLEMENT_ID];

    if (!entitlement) {
      return {
        status: 'EXPIRED',
        isTrial: false,
        trialEndDate: null,
        expiresDate: null,
        willRenew: false,
        productIdentifier: null,
        verificationSource: source,
        lastVerifiedAt: source === 'revenuecat' ? now : null,
      };
    }

    const isTrial = entitlement.periodType === 'TRIAL';
    const expiresDate = entitlement.expirationDate ? new Date(entitlement.expirationDate).getTime() : null;

    return {
      status: isTrial ? 'TRIAL' : 'ACTIVE',
      isTrial,
      trialEndDate: isTrial ? expiresDate : null,
      expiresDate,
      willRenew: entitlement.willRenew ?? false,
      productIdentifier: entitlement.productIdentifier ?? null,
      verificationSource: source,
      lastVerifiedAt: source === 'revenuecat' ? now : null,
    };
  }

  private async persistVerifiedState(state: SubscriptionState): Promise<void> {
    if (state.verificationSource !== 'revenuecat') return;
    const now = Date.now();
    await Promise.all([
      SecureStore.setItemAsync(SUBSCRIPTION_CACHE_KEY, JSON.stringify(state)),
      SecureStore.setItemAsync(SUBSCRIPTION_LAST_VERIFIED_KEY, String(now)),
    ]);
  }

  private async getOfflineGraceState(): Promise<SubscriptionState | null> {
    try {
      const [rawState, rawVerifiedAt] = await Promise.all([
        SecureStore.getItemAsync(SUBSCRIPTION_CACHE_KEY),
        SecureStore.getItemAsync(SUBSCRIPTION_LAST_VERIFIED_KEY),
      ]);

      if (!rawState || !rawVerifiedAt) return null;

      const lastVerifiedAt = Number(rawVerifiedAt);
      if (!Number.isFinite(lastVerifiedAt)) return null;

      const now = Date.now();
      // Reject if clock moved backward past verification time (tampering)
      if (now < lastVerifiedAt) return null;

      if (now - lastVerifiedAt > OFFLINE_GRACE_MS) {
        void logEvent('subscription_grace_expired', {
          lastVerifiedAt,
          graceDurationMs: OFFLINE_GRACE_MS,
          elapsedMs: now - lastVerifiedAt,
        });
        return null;
      }

      const parsed = JSON.parse(rawState) as SubscriptionState;
      if (parsed.status !== 'ACTIVE' && parsed.status !== 'TRIAL') {
        return null;
      }

      void logEvent('subscription_grace_used', {
        status: parsed.status,
        lastVerifiedAt,
        elapsedMs: now - lastVerifiedAt,
      });

      return {
        ...parsed,
        willRenew: false,
        verificationSource: 'offline_grace',
        lastVerifiedAt,
      };
    } catch {
      return null;
    }
  }

  // ── Purchase Methods ──

  async purchaseMonthly(): Promise<boolean> {
    if (this.isMockMode) {
      this.setMockState('premium');
      void logEvent('purchase_attempt', { plan: 'monthly', mock: true });
      return true;
    }
    if (this.purchaseInProgress) {
      safeWarn('[SubscriptionManager] Purchase already in progress, ignoring');
      return false;
    }
    this.purchaseInProgress = true;
    try {
      if (this.revenueCatAvailable) {
        return await this.purchaseRevenueCat('monthly');
      }
      return await this.purchaseLocal(PRODUCT_MONTHLY);
    } finally {
      this.purchaseInProgress = false;
    }
  }

  async purchaseAnnual(): Promise<boolean> {
    if (this.isMockMode) {
      this.setMockState('premium');
      void logEvent('purchase_attempt', { plan: 'annual', mock: true });
      return true;
    }
    if (this.purchaseInProgress) {
      safeWarn('[SubscriptionManager] Purchase already in progress, ignoring');
      return false;
    }
    this.purchaseInProgress = true;
    try {
      if (this.revenueCatAvailable) {
        return await this.purchaseRevenueCat('annual');
      }
      return await this.purchaseLocal(PRODUCT_ANNUAL);
    } finally {
      this.purchaseInProgress = false;
    }
  }

  private async purchaseRevenueCat(plan: 'monthly' | 'annual'): Promise<boolean> {
    try {
      const Purchases = await this.getRevenueCatModule();
      if (!Purchases) return false; // RC module unavailable — purchase not possible

      const offerings = await Purchases.getOfferings();
      const pkg = plan === 'monthly' ? offerings.current?.monthly : offerings.current?.annual;

      if (!pkg) {
        safeWarn(`[SubscriptionManager] ${plan} package not found in RC offerings`);
        return false;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const state = this.parseCustomerInfo(customerInfo);
      this.updateState(state);
      return state.status === 'ACTIVE' || state.status === 'TRIAL';
    } catch (error: unknown) {
      // Check if user cancelled
      try {
        const Purchases = await this.getRevenueCatModule();
        if (Purchases && Purchases.isCancelError?.(error)) {
          return false; // User cancelled — don't fall back
        }
      } catch {
        /* swallow */
      }

      // CRITICAL: Do NOT fall back to purchaseLocal() when RC is available.
      // A transient RC error must NOT grant free access on real devices.
      const errMsg = error instanceof Error ? error.message : String(error);
      safeWarn('[SubscriptionManager] RC purchase failed', { message: errMsg });
      captureException(error, { flow: 'purchase', plan, source: 'revenuecat' });
      void logEvent('purchase_failed', { plan, error: errMsg });
      return false;
    }
  }

  private async purchaseLocal(productId: string): Promise<boolean> {
    // Local purchase simulation for development
    const userId = 'user_local_001';

    await updateTrialConverted(userId, productId);

    const state: SubscriptionState = {
      status: 'ACTIVE',
      isTrial: false,
      trialEndDate: null,
      expiresDate: null,
      willRenew: true,
      productIdentifier: productId,
      verificationSource: 'local',
      lastVerifiedAt: null,
    };
    this.updateState(state);
    return true;
  }

  async restorePurchases(): Promise<SubscriptionState> {
    if (this.isMockMode) {
      void logEvent('restore_attempt', { mock: true });
      return this.currentState;
    }
    if (this.purchaseInProgress) {
      safeWarn('[SubscriptionManager] Operation in progress, ignoring restore');
      return this.currentState;
    }
    this.purchaseInProgress = true;
    try {
      if (this.revenueCatAvailable) {
        try {
          const Purchases = await this.getRevenueCatModule();
          if (Purchases) {
            const info = await Purchases.restorePurchases();
            const state = this.parseCustomerInfo(info);
            this.updateState(state);
            return state;
          }
        } catch (error) {
          safeWarn('[SubscriptionManager] Restore failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          captureException(error, { flow: 'restore_purchases', source: 'revenuecat' });
          void logEvent('restore_purchases_failed', { error: error instanceof Error ? error.message : String(error) });
        }
      }
      return this.refresh();
    } finally {
      this.purchaseInProgress = false;
    }
  }

  async getOfferings(): Promise<SubscriptionOfferings> {
    if (this.revenueCatAvailable) {
      try {
        const Purchases = await this.getRevenueCatModule();
        if (Purchases) {
          const offerings = await Purchases.getOfferings();
          const monthly = offerings.current?.monthly;
          const annual = offerings.current?.annual;

          return {
            monthly: monthly
              ? {
                  price: monthly.product.priceString,
                  pricePerMonth: monthly.product.priceString,
                  identifier: monthly.product.identifier,
                }
              : null,
            annual: annual
              ? {
                  price: annual.product.priceString,
                  pricePerMonth: `$${(annual.product.price / 12).toFixed(2)}`,
                  identifier: annual.product.identifier,
                  savingsPercent: 33,
                }
              : null,
          };
        }
      } catch {
        /* fall through */
      }
    }

    // Default offerings for development
    return {
      monthly: {
        price: '$5.39',
        pricePerMonth: '$5.39',
        identifier: PRODUCT_MONTHLY,
      },
      annual: {
        price: '$53.99',
        pricePerMonth: '$4.50',
        identifier: PRODUCT_ANNUAL,
        savingsPercent: 17,
      },
    };
  }

  // ── Accessors ──

  getState(): SubscriptionState {
    return { ...this.currentState };
  }

  hasAccess(): boolean {
    return this.currentState.status === 'TRIAL' || this.currentState.status === 'ACTIVE';
  }

  getTrialDaysRemaining(): number {
    if (!this.currentState.isTrial || !this.currentState.trialEndDate) return 0;
    const remaining = this.currentState.trialEndDate - Date.now();
    return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
  }

  // ── Event System ──

  addListener(callback: (state: SubscriptionState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private updateState(state: SubscriptionState): void {
    const prev = this.currentState.status;
    this.currentState = state;
    // Track every state transition for anomaly detection
    if (prev !== state.status) {
      void logEvent('subscription_state_change', {
        from: prev,
        to: state.status,
        source: state.verificationSource ?? 'unknown',
      });
    }
    this.listeners.forEach((l) => l(state));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RevenueCat callback type
  private handleCustomerInfoUpdate(info: any): void {
    const state = this.parseCustomerInfo(info, 'revenuecat');
    this.updateState(state);
    void this.persistVerifiedState(state);
  }
}
