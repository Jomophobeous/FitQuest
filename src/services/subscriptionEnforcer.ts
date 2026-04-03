/**
 * FitQuest Subscription Enforcer — Phase 25B
 *
 * Server-authoritative subscription enforcement.
 * NEVER trusts local subscription state for access decisions.
 *
 * Rules:
 *   Online  → verify with server → allow/deny
 *   Offline → allow TEMP access ONLY if last_verified < 24h
 *           → else block premium features
 *
 * Cached state in app_state:
 *   server_subscription_status: 'active' | 'inactive' | 'expired' | 'trialing'
 *   last_subscription_verify: Unix epoch (ms)
 */

import { getAppState, setAppState } from '../database/service';
import { getApiBaseUrl } from './apiBaseUrl';
import { getStableDeviceId, getAppVersion } from './deviceSignature';

// ── Constants ──

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUTHORITY_API_KEY = process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';
const REQUEST_TIMEOUT_MS = 10_000;

// ── Types ──

export type SubscriptionAccess = 'granted' | 'denied' | 'grace' | 'unknown';

export interface EnforcementResult {
  access: SubscriptionAccess;
  status: string;
  lastVerified: number | null;
  isOnline: boolean;
  reason: string;
}

// ── Cache Keys ──

const KEY_STATUS = 'server_subscription_status';
const KEY_LAST_VERIFY = 'last_subscription_verify';

// ── Core Enforcement ──

/**
 * Check if premium features should be accessible.
 * This is the SINGLE gate for all premium access decisions.
 */
export async function enforceSubscription(isOnline: boolean): Promise<EnforcementResult> {
  const cachedStatus = await getAppState(KEY_STATUS);
  const lastVerifyStr = await getAppState(KEY_LAST_VERIFY);
  const lastVerified = lastVerifyStr ? parseInt(lastVerifyStr, 10) : null;

  if (isOnline) {
    // Online: verify with server (authoritative)
    const serverResult = await verifyWithServer();
    if (serverResult) {
      const isActive = serverResult.status === 'active' || serverResult.status === 'trialing';
      return {
        access: isActive ? 'granted' : 'denied',
        status: serverResult.status,
        lastVerified: Date.now(),
        isOnline: true,
        reason: isActive ? 'Server verified active' : `Server status: ${serverResult.status}`,
      };
    }
    // Server unreachable despite being "online" — fall through to cache
  }

  // Offline or server unreachable: check cached state
  if (!lastVerified) {
    return {
      access: 'unknown',
      status: cachedStatus || 'unknown',
      lastVerified: null,
      isOnline,
      reason: 'Never verified with server',
    };
  }

  const elapsed = Date.now() - lastVerified;
  const isWithinGrace = elapsed < GRACE_PERIOD_MS;
  const isActive = cachedStatus === 'active' || cachedStatus === 'trialing';

  if (isActive && isWithinGrace) {
    return {
      access: 'grace',
      status: cachedStatus!,
      lastVerified,
      isOnline,
      reason: `Cached status valid (${Math.round(elapsed / 60000)}min ago)`,
    };
  }

  // Grace period expired OR not active
  return {
    access: 'denied',
    status: cachedStatus || 'expired',
    lastVerified,
    isOnline,
    reason: isWithinGrace
      ? `Subscription ${cachedStatus}`
      : `Grace period expired (${Math.round(elapsed / 3600000)}h ago)`,
  };
}

/**
 * Update cached subscription state (called by sync engine or direct verify).
 */
export async function updateCachedSubscription(status: string): Promise<void> {
  await setAppState(KEY_STATUS, status);
  await setAppState(KEY_LAST_VERIFY, Date.now().toString());
}

/**
 * Clear cached subscription state (called on failure/anomaly).
 */
export async function clearCachedSubscription(): Promise<void> {
  await setAppState(KEY_STATUS, '');
  await setAppState(KEY_LAST_VERIFY, '');
}

/**
 * Get time remaining in grace period (ms). 0 if expired.
 */
export async function getGraceRemaining(): Promise<number> {
  const lastVerifyStr = await getAppState(KEY_LAST_VERIFY);
  if (!lastVerifyStr) return 0;
  const elapsed = Date.now() - parseInt(lastVerifyStr, 10);
  return Math.max(0, GRACE_PERIOD_MS - elapsed);
}

// ── Server Verification ──

interface ServerSubscriptionResult {
  status: string;
  verified_at: string;
}

async function verifyWithServer(): Promise<ServerSubscriptionResult | null> {
  try {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return null;

    const deviceId = await getStableDeviceId();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS); // abort-timeout

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Version': getAppVersion(),
    };
    if (AUTHORITY_API_KEY) {
      headers['Authorization'] = `Bearer ${AUTHORITY_API_KEY}`;
    }

    const res = await fetch(`${baseUrl}/verify/subscription`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: 'user_local_001', device_id: deviceId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const json = await res.json();
    if (!json.success || !json.data) return null;

    // Cache the result
    await updateCachedSubscription(json.data.status);

    return {
      status: json.data.status,
      verified_at: json.data.verified_at,
    };
  } catch {
    return null;
  }
}
