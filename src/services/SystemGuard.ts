/**
 * SystemGuard — Central System Health Authority
 *
 * Single source of truth for whether core subsystems are operational.
 * All non-critical services MUST check systemState before operating.
 *
 * State machine:
 *   BOOTING → VALIDATING → READY
 *                        → RECOVERING → READY
 *                                     → FAILED (terminal until manual retry)
 *
 * VALIDATING = DB integrity scan in progress
 * RECOVERING = data issues found, auto-repair running
 * READY      = fully functional
 * FAILED     = unrecoverable — user must retry or reset
 */

type SystemState = 'BOOTING' | 'VALIDATING' | 'RECOVERING' | 'READY' | 'FAILED';

type SystemStateListener = (state: SystemState) => void;

class SystemGuardService {
  private static instance: SystemGuardService;
  private _state: SystemState = 'BOOTING';
  private _error: string | null = null;
  private listeners: Set<SystemStateListener> = new Set();

  private constructor() {}

  static getInstance(): SystemGuardService {
    if (!SystemGuardService.instance) {
      SystemGuardService.instance = new SystemGuardService();
    }
    return SystemGuardService.instance;
  }

  /** Current system state */
  get state(): SystemState {
    return this._state;
  }

  /** Last error message (set on RECOVERING/FAILED) */
  get error(): string | null {
    return this._error;
  }

  /** Whether core DB + services are fully operational */
  get isReady(): boolean {
    return this._state === 'READY';
  }

  /** Whether the system is actively repairing data */
  get isRecovering(): boolean {
    return this._state === 'RECOVERING';
  }

  /** Whether the system is validating DB integrity */
  get isValidating(): boolean {
    return this._state === 'VALIDATING';
  }

  /** Whether the system has failed and cannot proceed */
  get isFailed(): boolean {
    return this._state === 'FAILED';
  }

  // ── State transitions ──────────────────────────────────────

  /** Call when database + core services initialize successfully */
  markReady(): void {
    this._state = 'READY';
    this._error = null;
    this.notify();
    if (__DEV__) console.warn('[SystemGuard] State → READY');
  }

  /** Call when DB integrity validation begins */
  markValidating(): void {
    this._state = 'VALIDATING';
    this._error = null;
    this.notify();
    if (__DEV__) console.warn('[SystemGuard] State → VALIDATING');
  }

  /** Call when data issues found, auto-repair in progress */
  markRecovering(error: string): void {
    this._state = 'RECOVERING';
    this._error = error;
    this.notify();
    if (__DEV__) console.warn('[SystemGuard] State → RECOVERING:', error);
  }

  /** Call when all retries exhausted — user must manually retry or reset */
  markFailed(error: string): void {
    this._state = 'FAILED';
    this._error = error;
    this.notify();
    if (__DEV__) console.error('[SystemGuard] State → FAILED:', error);
  }

  /** Call before a retry attempt resets back to BOOTING */
  markBooting(): void {
    this._state = 'BOOTING';
    this._error = null;
    this.notify();
    if (__DEV__) console.warn('[SystemGuard] State → BOOTING (retry)');
  }

  // ── Listener management ────────────────────────────────────

  subscribe(listener: SystemStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this._state);
      } catch {
        /* never let a listener crash the guard */
      }
    }
  }
}

export const systemGuard = SystemGuardService.getInstance();
export type { SystemState };
