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

// ============================================
// TYPES
// ============================================

export type SubscriptionStatus =
  | 'TRIAL'      // First 14 days
  | 'ACTIVE'     // Paying subscriber
  | 'EXPIRED'    // Trial ended or cancelled
  | 'LIFETIME';  // Optional grandfathering

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
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ENTITLEMENT_ID = 'full_access';
const PRODUCT_MONTHLY = 'fitquest_monthly';
const PRODUCT_ANNUAL = 'fitquest_annual';

const RC_PUBLIC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
const SUBSCRIPTION_CACHE_KEY = 'fitquest_subscription_cache_v1';
const SUBSCRIPTION_LAST_VERIFIED_KEY = 'fitquest_subscription_last_verified_at';

// ============================================
// SUBSCRIPTION MANAGER
// ============================================

export class SubscriptionManager {
  private static instance: SubscriptionManager | null = null;
  private currentState: SubscriptionState;
  private listeners: Array<(state: SubscriptionState) => void> = [];
  private revenueCatAvailable = false;

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
    // Try to initialize RevenueCat
    try {
      const Purchases = await this.getRevenueCatModule();
      if (Purchases) {
        const apiKey = RC_PUBLIC_API_KEY;

        // Never configure RevenueCat with a test key in production —
        // it causes a fatal SimulatedStoreErrorDialogActivity crash
        const isTestKey = apiKey?.startsWith('test_');
        if (isTestKey && !__DEV__) {
          if (__DEV__) console.warn('[SubscriptionManager] Skipping RevenueCat: test key in production');
          this.revenueCatAvailable = false;
        } else if (apiKey && !apiKey.includes('your_key_here')) {
          Purchases.configure({ apiKey: apiKey.trim() });
          this.revenueCatAvailable = true;

          // Listen for purchase events
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

  private async getRevenueCatModule(): Promise<any | null> {
    try {
      return require('react-native-purchases').default;
    } catch {
      return null;
    }
  }

  // ── Core State Management ──

  async refresh(): Promise<SubscriptionState> {
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

  private parseCustomerInfo(
    info: any,
    source: 'revenuecat' | 'local' = 'local'
  ): SubscriptionState {
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
    const expiresDate = entitlement.expirationDate
      ? new Date(entitlement.expirationDate).getTime()
      : null;

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

      if (Date.now() - lastVerifiedAt > OFFLINE_GRACE_MS) {
        return null;
      }

      const parsed = JSON.parse(rawState) as SubscriptionState;
      if (parsed.status !== 'ACTIVE' && parsed.status !== 'TRIAL') {
        return null;
      }

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
    if (this.revenueCatAvailable) {
      return this.purchaseRevenueCat('monthly');
    }
    return this.purchaseLocal(PRODUCT_MONTHLY);
  }

  async purchaseAnnual(): Promise<boolean> {
    if (this.revenueCatAvailable) {
      return this.purchaseRevenueCat('annual');
    }
    return this.purchaseLocal(PRODUCT_ANNUAL);
  }

  private async purchaseRevenueCat(plan: 'monthly' | 'annual'): Promise<boolean> {
    try {
      const Purchases = await this.getRevenueCatModule();
      if (!Purchases) return this.purchaseLocal(plan === 'monthly' ? PRODUCT_MONTHLY : PRODUCT_ANNUAL);

      const offerings = await Purchases.getOfferings();
      const pkg = plan === 'monthly'
        ? offerings.current?.monthly
        : offerings.current?.annual;

      if (!pkg) {
        if (__DEV__) console.warn(`[SubscriptionManager] ${plan} package not found — falling back to local purchase`);
        return this.purchaseLocal(plan === 'monthly' ? PRODUCT_MONTHLY : PRODUCT_ANNUAL);
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const state = this.parseCustomerInfo(customerInfo);
      this.updateState(state);
      return state.status === 'ACTIVE' || state.status === 'TRIAL';
    } catch (error: any) {
      // Check if user cancelled
      try {
        const Purchases = await this.getRevenueCatModule();
        if (Purchases && Purchases.isCancelError?.(error)) {
          return false; // User cancelled — don't fall back
        }
      } catch { /* swallow */ }

      if (__DEV__) console.warn('[SubscriptionManager] RC purchase failed, falling back to local:', error?.message);
      return this.purchaseLocal(plan === 'monthly' ? PRODUCT_MONTHLY : PRODUCT_ANNUAL);
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
      }
    }
    return this.refresh();
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
            monthly: monthly ? {
              price: monthly.product.priceString,
              pricePerMonth: monthly.product.priceString,
              identifier: monthly.product.identifier,
            } : null,
            annual: annual ? {
              price: annual.product.priceString,
              pricePerMonth: `$${(annual.product.price / 12).toFixed(2)}`,
              identifier: annual.product.identifier,
              savingsPercent: 33,
            } : null,
          };
        }
      } catch { /* fall through */ }
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
    return this.currentState.status === 'TRIAL'
      || this.currentState.status === 'ACTIVE'
      || this.currentState.status === 'LIFETIME';
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
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private updateState(state: SubscriptionState): void {
    this.currentState = state;
    this.listeners.forEach(l => l(state));
  }

  private handleCustomerInfoUpdate(info: any): void {
    const state = this.parseCustomerInfo(info, 'revenuecat');
    this.updateState(state);
    void this.persistVerifiedState(state);
  }
}
