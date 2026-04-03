/**
 * FitQuest Connectivity Context — Phase 25B
 *
 * Global network state provider. Detects online/offline transitions
 * and triggers sync engine on reconnect.
 *
 * Usage:
 *   const { isOnline, pendingSyncCount } = useConnectivity();
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Graceful fallback — expo-network requires native module not available in all environments
let Network: { getNetworkStateAsync: () => Promise<{ isConnected?: boolean; isInternetReachable?: boolean }> } | null = null;
try {
  Network = require('expo-network');
} catch {
  // Native module unavailable (Expo Go / web) — assume online
}

// ── Types ──

interface ConnectivityState {
  /** True when device has internet access */
  isOnline: boolean;
  /** Number of queued actions waiting for sync */
  pendingSyncCount: number;
  /** True while sync engine is running */
  isSyncing: boolean;
  /** Timestamp of last successful sync (ms epoch), null if never */
  lastSyncAt: number | null;
  /** Force a connectivity check + sync attempt */
  triggerSync: () => void;
}

const ConnectivityContext = createContext<ConnectivityState>({
  isOnline: true,
  pendingSyncCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  triggerSync: () => {},
});

export function useConnectivity(): ConnectivityState {
  return useContext(ConnectivityContext);
}

// ── Provider ──

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const wasOfflineRef = useRef(false);
  const syncInProgressRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check network state
  const checkNetwork = useCallback(async () => {
    try {
      if (!Network) return true; // Assume online when native module unavailable
      const state = await Network.getNetworkStateAsync();
      const online = !!(state.isConnected && state.isInternetReachable);
      setIsOnline((prev) => {
        if (!prev && online) {
          // Transition: offline → online
          wasOfflineRef.current = true;
        }
        return online;
      });
      return online;
    } catch {
      return false;
    }
  }, []);

  // Update pending count from queue
  const refreshPendingCount = useCallback(async () => {
    try {
      const { getPendingCount } = await import('../services/offlineQueue');
      const count = await getPendingCount();
      setPendingSyncCount(count);
    } catch {
      // Queue not ready yet
    }
  }, []);

  // Run sync engine
  const runSync = useCallback(async () => {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setIsSyncing(true);

    try {
      const { syncPendingActions } = await import('../services/syncEngine');
      const result = await syncPendingActions();
      if (result.synced > 0) {
        setLastSyncAt(Date.now());
      }
      await refreshPendingCount();
    } catch (e) {
      if (__DEV__) console.warn('[Connectivity] Sync failed:', e);
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshPendingCount]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    const online = await checkNetwork();
    if (online) {
      await runSync();
    }
  }, [checkNetwork, runSync]);

  // Poll network state (every 15s when foregrounded)
  useEffect(() => {
    checkNetwork();
    refreshPendingCount();

    pollIntervalRef.current = setInterval(() => {
      checkNetwork();
      refreshPendingCount();
    }, 15_000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [checkNetwork, refreshPendingCount]);

  // On reconnect: trigger sync
  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      wasOfflineRef.current = false;
      runSync();
    }
  }, [isOnline, runSync]);

  // On app foreground: check + sync
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkNetwork().then((online) => {
          if (online) {
            refreshPendingCount();
            runSync();
          }
        });
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [checkNetwork, refreshPendingCount, runSync]);

  return (
    <ConnectivityContext.Provider
      value={{
        isOnline,
        pendingSyncCount,
        isSyncing,
        lastSyncAt,
        triggerSync,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
}
