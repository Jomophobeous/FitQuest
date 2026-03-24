/**
 * useSystemState — React hook for consuming SystemGuard state reactively.
 *
 * Components that depend on DB or other core services should use this
 * to gate renders or show recovery/failure UI.
 */
import { useSyncExternalStore, useCallback } from 'react';
import { systemGuard, type SystemState } from '../services/SystemGuard';

/** Subscribe to SystemGuard state changes — re-renders on transition */
export function useSystemState(): {
  systemState: SystemState;
  isReady: boolean;
  isValidating: boolean;
  isRecovering: boolean;
  isFailed: boolean;
  error: string | null;
} {
  const subscribe = useCallback((onStoreChange: () => void) => systemGuard.subscribe(onStoreChange), []);

  const getSnapshot = useCallback(() => systemGuard.state, []);

  const systemState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    systemState,
    isReady: systemState === 'READY',
    isValidating: systemState === 'VALIDATING',
    isRecovering: systemState === 'RECOVERING',
    isFailed: systemState === 'FAILED',
    error: systemGuard.error,
  };
}
