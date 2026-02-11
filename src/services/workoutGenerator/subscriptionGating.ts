/**
 * FitQuest Subscription Gating System
 * OS-verified receipts, offline grace period
 */

import { SubscriptionStatus, SubscriptionTier, FeatureGate } from './types';

// ============================================================================
// SUBSCRIPTION STATUS MANAGER
// ============================================================================

export class SubscriptionManager {
  private subscriptionStatus: SubscriptionStatus;
  private lastVerifiedAt: string;
  private graceStartDate?: string;

  constructor() {
    this.subscriptionStatus = {
      tier: 'free',
      active: false,
      grace_period_remaining: 0,
    };
    this.lastVerifiedAt = new Date().toISOString();
  }

  /**
   * Verify subscription status from OS receipt
   * In production, this would call Apple/Google receipt validation APIs
   * For now, stub to local storage
   */
  async verifySubscriptionReceipt(receipt: string): Promise<boolean> {
    try {
      // In production:
      // - iOS: Validate with Apple App Store Server API
      // - Android: Validate with Google Play Billing Library
      // For MVP: Accept any receipt and set premium
      
      const decoded = {
        tier: 'premium' as SubscriptionTier,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      this.subscriptionStatus = {
        tier: decoded.tier,
        active: true,
        expires_at: decoded.expiresAt,
        grace_period_remaining: 0,
      };

      this.lastVerifiedAt = new Date().toISOString();
      return true;
    } catch (err) {
      console.error('Receipt verification failed:', err);
      return false;
    }
  }

  /**
   * Check if subscription is active
   * Uses offline grace period if network unavailable
   */
  isSubscriptionActive(): boolean {
    // If explicitly premium, it's active
    if (this.subscriptionStatus.tier === 'premium' && this.subscriptionStatus.active) {
      return true;
    }

    // Check grace period
    if (this.graceStartDate) {
      const daysSinceGraceStart = 
        (Date.now() - new Date(this.graceStartDate).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceGraceStart < 7) {
        this.subscriptionStatus.grace_period_remaining = Math.ceil(7 - daysSinceGraceStart);
        return true;
      }
    }

    return false;
  }

  /**
   * Start grace period when subscription expires
   * Allows 7 days of offline access
   */
  startGracePeriod(): void {
    if (!this.graceStartDate) {
      this.graceStartDate = new Date().toISOString();
      this.subscriptionStatus.grace_period_remaining = 7;
    }
  }

  /**
   * Reset grace period on successful verification
   */
  resetGracePeriod(): void {
    this.graceStartDate = undefined;
    this.subscriptionStatus.grace_period_remaining = 0;
  }

  /**
   * Get current subscription status
   */
  getStatus(): SubscriptionStatus {
    return { ...this.subscriptionStatus };
  }

  /**
   * Downgrade to free tier (when subscription expires/is cancelled)
   */
  downgradeToFree(): void {
    this.subscriptionStatus = {
      tier: 'free',
      active: false,
      grace_period_remaining: 0,
    };
  }
}

// ============================================================================
// FEATURE GATE MANAGER
// ============================================================================

export class FeatureGateManager {
  private subscriptionManager: SubscriptionManager;

  // Define which features are gated behind subscription
  private readonly gatedFeatures: Set<FeatureGate> = new Set([
    'workout_generation',
    'progression',
    'history_tracking',
    'fatigue_analytics',
    'deload_suggestion',
  ]);

  // Free features
  private readonly freeFeatures: Set<FeatureGate> = new Set([
    // These don't exist in the gate, so all unspecified are free
  ]);

  constructor(subscriptionManager: SubscriptionManager) {
    this.subscriptionManager = subscriptionManager;
  }

  /**
   * Check if a feature is accessible
   * Returns:
   * - true if free feature
   * - true if premium and subscription active
   * - false if premium but no subscription
   */
  canAccessFeature(feature: FeatureGate): boolean {
    // Free features always accessible
    if (this.freeFeatures.has(feature)) {
      return true;
    }

    // Gated features require active subscription
    if (this.gatedFeatures.has(feature)) {
      return this.subscriptionManager.isSubscriptionActive();
    }

    // Unknown features: default to free
    return true;
  }

  /**
   * Get all locked features user doesn't have access to
   */
  getLockedFeatures(): FeatureGate[] {
    if (this.subscriptionManager.isSubscriptionActive()) {
      return []; // Everything unlocked
    }

    return Array.from(this.gatedFeatures);
  }

  /**
   * Get reason why feature is locked (if locked)
   */
  getFeatureLockReason(feature: FeatureGate): string | null {
    if (this.canAccessFeature(feature)) {
      return null;
    }

    const grace = this.subscriptionManager.getStatus().grace_period_remaining;
    if (grace > 0) {
      return `Premium feature. Grace period: ${grace} days remaining.`;
    }

    return 'Premium feature. Unlock with subscription.';
  }
}

// ============================================================================
// OFFLINE GRACE PERIOD MANAGER
// ============================================================================

export class OfflineGracePeriodManager {
  private lastVerificationTime: string;
  private offlineGraceStart?: string;

  constructor() {
    this.lastVerificationTime = new Date().toISOString();
  }

  /**
   * Check if we're still in grace period for offline access
   * Grace period: 7 days from last successful verification
   */
  isInGracePeriod(): boolean {
    const daysSinceLastVerification =
      (Date.now() - new Date(this.lastVerificationTime).getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceLastVerification < 7;
  }

  /**
   * Get days remaining in offline grace period
   */
  getDaysRemainingInGrace(): number {
    const daysSinceLastVerification =
      (Date.now() - new Date(this.lastVerificationTime).getTime()) / (1000 * 60 * 60 * 24);

    return Math.max(0, Math.ceil(7 - daysSinceLastVerification));
  }

  /**
   * Mark successful online verification
   * Resets grace period counter
   */
  markSuccessfulVerification(): void {
    this.lastVerificationTime = new Date().toISOString();
    this.offlineGraceStart = undefined;
  }

  /**
   * Called when subscription expires but grace period starts
   */
  startOfflineGrace(): void {
    this.offlineGraceStart = new Date().toISOString();
  }
}

// ============================================================================
// PAYWALL MANAGER
// ============================================================================

export interface PaywallConfig {
  title: string;
  description: string;
  features: string[];
  cta_text: string;
}

export const PAYWALL_MESSAGES: Record<FeatureGate, PaywallConfig> = {
  workout_generation: {
    title: 'Unlock Personalized Workouts',
    description: 'Generate adaptive workouts tailored to your goals and equipment.',
    features: [
      'Deterministic workout planning',
      'Goal-specific progressions',
      'Equipment-aware exercises',
      'Offline-first design',
    ],
    cta_text: 'Subscribe to Premium',
  },
  progression: {
    title: 'Track Progression',
    description: 'Auto-adjust weights and reps based on your performance history.',
    features: ['Smart progression', 'Auto-scaling', 'Success tracking'],
    cta_text: 'Subscribe to Premium',
  },
  history_tracking: {
    title: 'Full Workout History',
    description: 'Keep detailed records of all your workouts and sessions.',
    features: ['Session logs', 'Exercise history', 'Performance trends'],
    cta_text: 'Subscribe to Premium',
  },
  fatigue_analytics: {
    title: 'Fatigue Analytics',
    description: 'Understand your muscle fatigue and recovery patterns.',
    features: ['Fatigue mapping', 'Recovery insights', 'Deload suggestions'],
    cta_text: 'Subscribe to Premium',
  },
  deload_suggestion: {
    title: 'Deload Intelligence',
    description: 'Get smart deload week recommendations based on your fatigue levels.',
    features: ['Automatic deload detection', 'Recovery optimization'],
    cta_text: 'Subscribe to Premium',
  },
};

// ============================================================================
// SINGLETON MANAGER
// ============================================================================

let subscriptionManager: SubscriptionManager | null = null;
let featureGateManager: FeatureGateManager | null = null;
let offlineGraceManager: OfflineGracePeriodManager | null = null;

export function initializeSubscriptionSystem(): {
  subscriptionManager: SubscriptionManager;
  featureGateManager: FeatureGateManager;
  offlineGraceManager: OfflineGracePeriodManager;
} {
  if (!subscriptionManager) {
    subscriptionManager = new SubscriptionManager();
    offlineGraceManager = new OfflineGracePeriodManager();
    featureGateManager = new FeatureGateManager(subscriptionManager);
  }

  return {
    subscriptionManager: subscriptionManager!,
    featureGateManager: featureGateManager!,
    offlineGraceManager: offlineGraceManager!,
  };
}

export function getSubscriptionManager(): SubscriptionManager {
  if (!subscriptionManager) {
    const { subscriptionManager: sm } = initializeSubscriptionSystem();
    return sm;
  }
  return subscriptionManager;
}

export function getFeatureGateManager(): FeatureGateManager {
  if (!featureGateManager) {
    const { featureGateManager: fgm } = initializeSubscriptionSystem();
    return fgm;
  }
  return featureGateManager;
}

export function getOfflineGraceManager(): OfflineGracePeriodManager {
  if (!offlineGraceManager) {
    const { offlineGraceManager: ogm } = initializeSubscriptionSystem();
    return ogm;
  }
  return offlineGraceManager;
}
