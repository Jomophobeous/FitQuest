/**
 * FitQuest Sync Failure Handler — Phase 25B
 *
 * Centralized failure response for sync/auth/verification failures.
 * Enforces clean boundaries between recoverable and fatal failures.
 *
 * Failure classes:
 *   NETWORK  — transient, retry later (no state change)
 *   AUTH     — challenge/verify failed → clear auth cache, force re-auth
 *   TAMPER   — server rejected data as impossible → clear premium cache, log
 *   REVOKED  — subscription revoked by server → lock premium features immediately
 */

import { clearCachedSubscription } from './subscriptionEnforcer';
import { logEvent } from './telemetry';
import { safeWarn } from './logger';

// ── Failure Types ──

export type FailureClass = 'NETWORK' | 'AUTH' | 'TAMPER' | 'REVOKED';

export interface SyncFailure {
  failureClass: FailureClass;
  message: string;
  recoverable: boolean;
  action: string; // what the handler did
}

// ── Handler ──

/**
 * Handle a sync or verification failure.
 * Returns structured result describing what action was taken.
 */
export async function handleSyncFailure(
  failureClass: FailureClass,
  context: { source?: string; error?: string; statusCode?: number } = {},
): Promise<SyncFailure> {
  const { source = 'unknown', error = '', statusCode } = context;

  switch (failureClass) {
    case 'NETWORK':
      // Transient — do nothing, retry will happen on reconnect
      return {
        failureClass: 'NETWORK',
        message: 'Network unavailable',
        recoverable: true,
        action: 'none — will retry on reconnect',
      };

    case 'AUTH':
      // Challenge-response failed — clear auth cache
      try {
        const { setAppState } = await import('../database/service');
        await setAppState('last_device_verify', '');
        await setAppState('device_verified', '');
      } catch (e) {
        safeWarn('[FailureHandler] Failed to clear auth cache', { error: String(e) });
      }

      void logEvent('sync_auth_failure', {
        source,
        error,
        status_code: statusCode,
      });

      return {
        failureClass: 'AUTH',
        message: 'Authentication failed — will re-verify',
        recoverable: true,
        action: 'cleared auth cache, will re-challenge on next sync',
      };

    case 'TAMPER':
      // Server detected impossible data — clear premium cache, log anomaly
      await clearCachedSubscription();

      void logEvent('sync_tamper_detected', {
        source,
        error,
        status_code: statusCode,
        severity: 'HIGH',
      });

      return {
        failureClass: 'TAMPER',
        message: 'Data rejected by server',
        recoverable: false,
        action: 'cleared subscription cache, logged anomaly',
      };

    case 'REVOKED':
      // Subscription explicitly revoked — lock premium immediately
      await clearCachedSubscription();

      try {
        const { setAppState } = await import('../database/service');
        await setAppState('server_subscription_status', 'revoked');
      } catch (e) {
        safeWarn('[FailureHandler] Failed to set revoked status', { error: String(e) });
      }

      void logEvent('subscription_revoked_by_server', {
        source,
        error,
      });

      return {
        failureClass: 'REVOKED',
        message: 'Subscription revoked by server',
        recoverable: false,
        action: 'locked premium features, cleared subscription cache',
      };

    default:
      return {
        failureClass: 'NETWORK',
        message: 'Unknown failure',
        recoverable: true,
        action: 'none',
      };
  }
}

/**
 * Classify an HTTP status code into a failure class.
 */
export function classifyHTTPFailure(statusCode: number): FailureClass {
  if (statusCode === 0 || statusCode >= 500) return 'NETWORK';
  if (statusCode === 401 || statusCode === 403) return 'AUTH';
  if (statusCode === 409 || statusCode === 422) return 'TAMPER';
  return 'NETWORK'; // Default to transient
}
