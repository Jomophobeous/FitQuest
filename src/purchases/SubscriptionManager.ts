/**
 * FitQuest Subscription Manager
 * 
 * Simple subscription model: 14-day free trial, then monthly or annual.
 * No tiered features — full access for subscribers.
 * 
 * Uses react-native-purchases (RevenueCat) when available,
 * with a local SQLite fallback for development/testing.
 */

import { Platform } from 'react-native';
import { getDatabase } from '../database';

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
}

export interface SubscriptionOfferings {
  monthly: { price: string; pricePerMonth: string; identifier: string } | null;
  annual: { price: string; pricePerMonth: string; identifier: string; savingsPercent: number } | null;
}

// ============================================
// CONSTANTS
// ============================================

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const ENTITLEMENT_ID = 'full_access';
const PRODUCT_MONTHLY = 'fitquest_monthly';
const PRODUCT_ANNUAL = 'fitquest_annual';

// RevenuCat API keys — replace with real keys for production
const RC_API_KEYS = {
  ios: 'appl_YOUR_IOS_KEY',
  android: 'goog_YOUR_ANDROID_KEY',
};

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
    // Ensure trial_state table exists
    await this.ensureTrialTable();

    // Try to initialize RevenueCat
    try {
      const Purchases = await this.getRevenueCatModule();
      if (Purchases) {
        const apiKey = Platform.select({
          ios: RC_API_KEYS.ios,
          android: RC_API_KEYS.android,
          default: RC_API_KEYS.android,
        });

        if (apiKey && !apiKey.includes('YOUR_')) {
          Purchases.configure({ apiKey });
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

  private async ensureTrialTable(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`
      CREATE TABLE IF NOT EXISTS trial_state (
        user_id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        converted INTEGER DEFAULT 0,
        product_identifier TEXT,
        notifications_sent TEXT DEFAULT '[]'
      )
    `);
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
      const state = this.parseCustomerInfo(info);
      this.updateState(state);
      return state;
    } catch {
      return this.refreshFromLocal();
    }
  }

  private async refreshFromLocal(): Promise<SubscriptionState> {
    const db = await getDatabase();
    const userId = 'user_local_001';

    const trial = await db.getFirstAsync<{
      started_at: number;
      ends_at: number;
      converted: number;
      product_identifier: string | null;
    }>('SELECT * FROM trial_state WHERE user_id = ?', [userId]);

    if (!trial) {
      // First launch — start trial
      const now = Date.now();
      const trialEnd = now + TRIAL_DURATION_MS;
      
      await db.runAsync(
        `INSERT INTO trial_state (user_id, started_at, ends_at, converted) VALUES (?, ?, ?, 0)`,
        [userId, now, trialEnd]
      );

      const state: SubscriptionState = {
        status: 'TRIAL',
        isTrial: true,
        trialEndDate: trialEnd,
        expiresDate: trialEnd,
        willRenew: false,
        productIdentifier: null,
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
    };
    this.updateState(state);
    return state;
  }

  private parseCustomerInfo(info: any): SubscriptionState {
    const entitlement = info?.entitlements?.active?.[ENTITLEMENT_ID];

    if (!entitlement) {
      return {
        status: 'EXPIRED',
        isTrial: false,
        trialEndDate: null,
        expiresDate: null,
        willRenew: false,
        productIdentifier: null,
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
    };
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
      if (!Purchases) return false;

      const offerings = await Purchases.getOfferings();
      const pkg = plan === 'monthly'
        ? offerings.current?.monthly
        : offerings.current?.annual;

      if (!pkg) {
        console.warn(`[SubscriptionManager] ${plan} package not found`);
        return false;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const state = this.parseCustomerInfo(customerInfo);
      this.updateState(state);
      return state.status === 'ACTIVE' || state.status === 'TRIAL';
    } catch (error: any) {
      // Check if user cancelled
      try {
        const Purchases = await this.getRevenueCatModule();
        if (Purchases && !Purchases.isCancelError?.(error)) {
          console.error('[SubscriptionManager] Purchase failed:', error);
        }
      } catch { /* swallow */ }
      return false;
    }
  }

  private async purchaseLocal(productId: string): Promise<boolean> {
    // Local purchase simulation for development
    const db = await getDatabase();
    const userId = 'user_local_001';

    await db.runAsync(
      `UPDATE trial_state SET converted = 1, product_identifier = ? WHERE user_id = ?`,
      [productId, userId]
    );

    const state: SubscriptionState = {
      status: 'ACTIVE',
      isTrial: false,
      trialEndDate: null,
      expiresDate: null,
      willRenew: true,
      productIdentifier: productId,
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
        console.error('[SubscriptionManager] Restore failed:', error);
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
        price: '$9.99',
        pricePerMonth: '$9.99',
        identifier: PRODUCT_MONTHLY,
      },
      annual: {
        price: '$79.99',
        pricePerMonth: '$6.67',
        identifier: PRODUCT_ANNUAL,
        savingsPercent: 33,
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
    const state = this.parseCustomerInfo(info);
    this.updateState(state);
  }
}
