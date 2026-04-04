/**
 * useSystemState — React hook for system readiness.
 *
 * SystemGuard was removed. This stub always reports READY
 * since DatabaseContext now handles all boot gating directly.
 */

export type SystemState = 'BOOTING' | 'VALIDATING' | 'READY' | 'RECOVERING' | 'FAILED';

/** Always returns READY — DatabaseContext is the actual gate now */
export function useSystemState(): {
  systemState: SystemState;
  isReady: boolean;
  isValidating: boolean;
  isRecovering: boolean;
  isFailed: boolean;
  error: string | null;
} {
  return {
    systemState: 'READY',
    isReady: true,
    isValidating: false,
    isRecovering: false,
    isFailed: false,
    error: null,
  };
}
