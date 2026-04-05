/**
 * Auth Event Bus — Centralized auth failure signaling.
 *
 * When ANY part of the app detects an unrecoverable auth failure
 * (expired token, failed refresh, tampered session), it emits
 * AUTH_FAILURE here. The AuthProvider listens and triggers forced logout.
 *
 * This is the SINGLE enforcement point — no silent failures allowed.
 */

type AuthEventListener = (reason: AuthFailureReason) => void;

export type AuthFailureReason =
  | 'TOKEN_EXPIRED'
  | 'REFRESH_FAILED'
  | 'SESSION_TIMEOUT'
  | 'TOKEN_INVALID'
  | 'FORCED_LOGOUT'
  | 'TAMPER_DETECTED';

class AuthEventBusImpl {
  private listeners: Set<AuthEventListener> = new Set();
  private _lastFailure: { reason: AuthFailureReason; timestamp: number } | null = null;

  /**
   * Subscribe to auth failure events.
   * Returns unsubscribe function.
   */
  subscribe(listener: AuthEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an auth failure. All subscribers (AuthProvider) will be notified.
   * Debounces: ignores duplicate reasons within 2 seconds.
   */
  emit(reason: AuthFailureReason): void {
    const now = Date.now();
    if (this._lastFailure && this._lastFailure.reason === reason && now - this._lastFailure.timestamp < 2000) {
      return; // Debounce duplicate emissions
    }
    this._lastFailure = { reason, timestamp: now };

    if (__DEV__) console.warn(`[AuthEventBus] AUTH_FAILURE: ${reason}`);

    for (const listener of this.listeners) {
      try {
        listener(reason);
      } catch {
        // Never let a listener crash the bus
      }
    }
  }

  /** Get the last failure (for diagnostics). */
  getLastFailure(): { reason: AuthFailureReason; timestamp: number } | null {
    return this._lastFailure;
  }

  /** Clear state (for tests). */
  reset(): void {
    this.listeners.clear();
    this._lastFailure = null;
  }
}

export const authEventBus = new AuthEventBusImpl();
