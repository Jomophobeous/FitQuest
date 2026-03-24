/**
 * FitQuest Subscription Context
 *
 * React context + hook for subscription state across the app.
 * Wraps SubscriptionManager and provides reactive updates.
 *
 * Access gating: uses an explicit AccessState machine to prevent UI
 * from evaluating access before subscription state is fully hydrated.
 * Waits for DatabaseProvider.isReady before initializing to avoid
 * querying trial_state before tables exist.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import { SubscriptionManager, type SubscriptionState, type SubscriptionOfferings } from './SubscriptionManager';
import { useDatabase } from '../context/DatabaseContext';

// ============================================
// TYPES
// ============================================

/** Explicit access state machine — consumers MUST handle RESOLVING before rendering gated content */
export type AccessState = 'RESOLVING' | 'TRIAL_ACTIVE' | 'SUBSCRIBED' | 'EXPIRED';

interface SubscriptionContextType {
  /** Current subscription state */
  state: SubscriptionState;
  /** Explicit access state: RESOLVING → show loading, TRIAL_ACTIVE/SUBSCRIBED → show content, EXPIRED → show paywall */
  accessState: AccessState;
  /** Whether the user has access (trial or paid). False while RESOLVING. */
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
  monthly: { price: '$5.39', pricePerMonth: '$5.39', identifier: 'fitquest_monthly' },
  annual: { price: '$53.99', pricePerMonth: '$4.50', identifier: 'fitquest_annual', savingsPercent: 17 },
};

// ============================================
// CONTEXT
// ============================================

const SubscriptionContext = createContext<SubscriptionContextType>({
  state: defaultState,
  accessState: 'RESOLVING',
  hasAccess: false,
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
  const { isReady: dbReady } = useDatabase();
  const [state, setState] = useState<SubscriptionState>(defaultState);
  const [offerings, setOfferings] = useState<SubscriptionOfferings>(defaultOfferings);
  const [isLoading, setIsLoading] = useState(true);
  const [manager, setManager] = useState<SubscriptionManager | null>(null);
  const initializedRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    // HARD GATE: never initialize subscription before database is ready.
    // On first install, trial_state table doesn't exist until initializeDatabase() completes.
    if (!dbReady) return;

    // Prevent duplicate init on re-renders / StrictMode double-fire
    if (initializedRef.current) return;
    initializedRef.current = true;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        // getInstance() → initialize() → refresh() → refreshFromLocal()
        // guarantees trial exists in DB before returning
        const mgr = await SubscriptionManager.getInstance();
        if (cancelled) return;

        setManager(mgr);

        // Hydrate state — trial guaranteed to exist at this point
        const currentState = mgr.getState();
        const currentOfferings = await mgr.getOfferings();
        if (cancelled) return;

        // Listen for updates (before setting state to avoid missing events)
        unsubscribe = mgr.addListener((newState) => {
          if (!cancelled) setState(newState);
        });

        // Batch state updates explicitly so React flushes them in a
        // single render — prevents intermediate frames where state is
        // EXPIRED but isLoading is still true/false.
        unstable_batchedUpdates(() => {
          setState(currentState);
          setOfferings(currentOfferings);
        });
      } catch (error) {
        if (__DEV__) console.warn('[SubscriptionProvider] Init failed:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      initializedRef.current = false;
      unsubscribe?.();
    };
  }, [dbReady]);

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
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      await manager.refresh();
    } finally {
      refreshingRef.current = false;
    }
  }, [manager]);

  // ── Derived access state ──
  // Maps SubscriptionManager status to AccessState for UI gating.
  // During trial → full access, zero paywalls.
  // After expiry → immediate full-screen paywall lock.
  const accessState: AccessState = isLoading
    ? 'RESOLVING'
    : state.status === 'TRIAL'
      ? 'TRIAL_ACTIVE'
      : state.status === 'ACTIVE'
        ? 'SUBSCRIBED'
        : 'EXPIRED';

  // DEV-ONLY: catch unmapped status values that would silently fall to EXPIRED
  if (__DEV__ && !isLoading) {
    const known = ['TRIAL', 'ACTIVE', 'EXPIRED'];
    if (state.status === 'LIFETIME') {
      console.error('[SubscriptionContext] LIFETIME status reached — no activation path should produce this');
    } else if (!known.includes(state.status)) {
      console.error(`[SubscriptionContext] Unknown status "${state.status}" mapped to EXPIRED — add explicit handling`);
    }
  }

  const hasAccess = accessState === 'TRIAL_ACTIVE' || accessState === 'SUBSCRIBED';
  const trialDaysRemaining = manager?.getTrialDaysRemaining() ?? 14;

  const value: SubscriptionContextType = {
    state,
    accessState,
    hasAccess,
    trialDaysRemaining,
    offerings,
    isLoading,
    purchaseMonthly,
    purchaseAnnual,
    restorePurchases,
    refresh,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};
