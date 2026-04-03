/**
 * useAppReady — Lifecycle gate hook.
 *
 * Blocks UI rendering until ALL critical subsystems are operational:
 *   1. Database initialized (SystemGuard → READY)
 *   2. Auth gate resolved (AuthGate → UNLOCKED, checked via DatabaseProvider isReady)
 *   3. User profile loaded (DatabaseContext → userProfile !== null)
 *
 * Usage:
 *   const { ready } = useAppReady();
 *   if (!ready) return <LoadingScreen />;
 *
 * This is the SINGLE source of truth for "can the app render content?"
 * No screen should bypass this gate.
 */
import { useDatabase } from '../context/DatabaseContext';
import { useSystemState } from './useSystemState';

interface AppReadyState {
  /** True only when DB + Auth + Profile are all resolved */
  ready: boolean;
  /** True while subsystems are still initializing */
  loading: boolean;
  /** Non-null if a critical subsystem failed */
  error: string | null;
  /** SystemGuard state for diagnostics */
  systemState: string;
}

export function useAppReady(): AppReadyState {
  const { isReady: dbReady, isLoading: dbLoading, error: dbError, userProfile } = useDatabase();
  const { systemState, isReady: systemReady, error: systemError } = useSystemState();

  // All three conditions must be true:
  // 1. SystemGuard reports READY (DB + integrity + recovery all passed)
  // 2. DatabaseContext reports isReady (profile loaded, onboarding checked)
  // 3. User profile exists (critical for any screen that needs user data)
  const ready = systemReady && dbReady && userProfile !== null;
  const loading = !ready && !dbError && !systemError;
  const error = dbError || systemError || null;

  return { ready, loading, error, systemState };
}
