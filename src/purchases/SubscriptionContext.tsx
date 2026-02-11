/**
 * FitQuest Subscription Context
 * 
 * React context + hook for subscription state across the app.
 * Wraps SubscriptionManager and provides reactive updates.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SubscriptionManager, type SubscriptionState, type SubscriptionOfferings } from './SubscriptionManager';

// ============================================
// TYPES
// ============================================

interface SubscriptionContextType {
  /** Current subscription state */
  state: SubscriptionState;
  /** Whether the user has access (trial or paid) */
  hasAccess: boolean;
  /** Days remaining in trial */
  trialDaysRemaining: number;
  /** Available subscription offerings */
  offerings: SubscriptionOfferings;
  /** Whether subscriptions are still loading */
  isLoading: boolean;
  /** Purchase monthly subscription */
  purchaseMonthly: () => Promise<boolean>;
  /** Purchase annual subscription */
  purchaseAnnual: () => Promise<boolean>;
  /** Restore previous purchases */
  restorePurchases: () => Promise<SubscriptionState>;
  /** Refresh subscription state */
  refresh: () => Promise<void>;
}

// ============================================
// DEFAULT STATE
// ============================================

const defaultState: SubscriptionState = {
  status: 'TRIAL',
  isTrial: true,
  trialEndDate: null,
  expiresDate: null,
  willRenew: false,
  productIdentifier: null,
};

const defaultOfferings: SubscriptionOfferings = {
  monthly: { price: '$9.99', pricePerMonth: '$9.99', identifier: 'fitquest_monthly' },
  annual: { price: '$79.99', pricePerMonth: '$6.67', identifier: 'fitquest_annual', savingsPercent: 33 },
};

// ============================================
// CONTEXT
// ============================================

const SubscriptionContext = createContext<SubscriptionContextType>({
  state: defaultState,
  hasAccess: true,
  trialDaysRemaining: 14,
  offerings: defaultOfferings,
  isLoading: true,
  purchaseMonthly: async () => false,
  purchaseAnnual: async () => false,
  restorePurchases: async () => defaultState,
  refresh: async () => {},
});

export const useSubscription = (): SubscriptionContextType => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
};

// ============================================
// PROVIDER
// ============================================

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SubscriptionState>(defaultState);
  const [offerings, setOfferings] = useState<SubscriptionOfferings>(defaultOfferings);
  const [isLoading, setIsLoading] = useState(true);
  const [manager, setManager] = useState<SubscriptionManager | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        const mgr = await SubscriptionManager.getInstance();
        setManager(mgr);

        // Load initial state
        const currentState = mgr.getState();
        setState(currentState);

        // Load offerings
        const currentOfferings = await mgr.getOfferings();
        setOfferings(currentOfferings);

        // Listen for updates
        unsubscribe = mgr.addListener((newState) => {
          setState(newState);
        });
      } catch (error) {
        console.warn('[SubscriptionProvider] Init failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const purchaseMonthly = useCallback(async () => {
    if (!manager) return false;
    setIsLoading(true);
    try {
      return await manager.purchaseMonthly();
    } finally {
      setIsLoading(false);
    }
  }, [manager]);

  const purchaseAnnual = useCallback(async () => {
    if (!manager) return false;
    setIsLoading(true);
    try {
      return await manager.purchaseAnnual();
    } finally {
      setIsLoading(false);
    }
  }, [manager]);

  const restorePurchases = useCallback(async () => {
    if (!manager) return defaultState;
    setIsLoading(true);
    try {
      return await manager.restorePurchases();
    } finally {
      setIsLoading(false);
    }
  }, [manager]);

  const refresh = useCallback(async () => {
    if (!manager) return;
    await manager.refresh();
  }, [manager]);

  const hasAccess = manager?.hasAccess() ?? true;
  const trialDaysRemaining = manager?.getTrialDaysRemaining() ?? 14;

  const value: SubscriptionContextType = {
    state,
    hasAccess,
    trialDaysRemaining,
    offerings,
    isLoading,
    purchaseMonthly,
    purchaseAnnual,
    restorePurchases,
    refresh,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
