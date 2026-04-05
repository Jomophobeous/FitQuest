/**
 * Authority Client — Backend verification for AI access and subscription status.
 *
 * Calls the FitQuest Authority Server with graceful degradation:
 *   - null return = offline / unreachable → caller falls through to local mode
 *   - AIAccessResult = server responded with authorization decision
 *
 * Backend routes require device_token (Phase 26 device binding).
 * Until device binding is implemented on client, server will return 401 —
 * this client treats 401/network errors as offline (returns null).
 *
 * Throttling: AI requests max once per 2s, subscription max once per 5min.
 */

import { getApiBaseUrl } from './apiBaseUrl';

export interface AIAccessResult {
  authorized: boolean;
  restricted?: boolean;
  reason?: string;
  retryAfterMs?: number;
  remaining?: number;
}

export interface SubscriptionStatus {
  userId: string;
  status: 'active' | 'inactive' | 'expired' | 'reverify_required';
  expiresAt: string | null;
  restricted: boolean;
  verifiedAt: string;
}

// ── Throttle state ──

const AUTHORITY_TIMEOUT_MS = 8_000;
const AI_THROTTLE_MS = 2_000;
const SUB_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

let _lastAIRequestAt = 0;
let _lastSubVerifyAt = 0;
let _cachedSubStatus: SubscriptionStatus | null = null;

function getApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_AUTHORITY_API_KEY;
  return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;
}

async function authorityPost<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;

  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (apiKey) {
    headers['authorization'] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTHORITY_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      // 401/403/429/5xx — treat as offline for graceful degradation
      if (__DEV__) {
        console.warn(`[Authority] ${path} returned ${res.status}`);
      }
      return null;
    }

    const json = await res.json();
    return (json?.data ?? json) as T;
  } catch (err) {
    if (__DEV__) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Authority] ${path} failed:`, msg);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Request AI access authorization from the backend.
 * Returns null if offline/unreachable (caller should fall through to local/cloud chain).
 * Returns AIAccessResult if server responded.
 */
export async function requestAI(userId: string, deviceId: string, input: string): Promise<AIAccessResult | null> {
  // Throttle: skip if called within AI_THROTTLE_MS
  const now = Date.now();
  if (now - _lastAIRequestAt < AI_THROTTLE_MS) {
    return null; // Treat as offline — don't block the AI chain
  }
  _lastAIRequestAt = now;

  return authorityPost<AIAccessResult>('/ai/request', {
    user_id: userId,
    device_id: deviceId,
    prompt: input.slice(0, 4000),
  });
}

/**
 * Verify subscription status with the backend.
 * Returns null if offline/unreachable.
 * Returns cached result if called within SUB_THROTTLE_MS.
 */
export async function verifySubscription(userId: string, deviceId: string): Promise<SubscriptionStatus | null> {
  const now = Date.now();
  if (now - _lastSubVerifyAt < SUB_THROTTLE_MS && _cachedSubStatus) {
    return _cachedSubStatus;
  }
  _lastSubVerifyAt = now;

  const raw = await authorityPost<{
    user_id: string;
    status: string;
    expires_at: string | null;
    restricted: boolean;
    verified_at: string;
  }>('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
  });

  if (!raw) return null;

  _cachedSubStatus = {
    userId: raw.user_id,
    status: raw.status as SubscriptionStatus['status'],
    expiresAt: raw.expires_at,
    restricted: raw.restricted ?? false,
    verifiedAt: raw.verified_at,
  };

  return _cachedSubStatus;
}

/** Clear cached subscription status (e.g., after purchase) */
export function clearSubscriptionCache(): void {
  _cachedSubStatus = null;
  _lastSubVerifyAt = 0;
}

/**
 * Verify a receipt with the server (RevenueCat server-side verification).
 * Call after a successful RevenueCat purchase to register it server-side.
 */
export async function verifyReceipt(
  userId: string,
  receiptToken: string,
  productId: string,
): Promise<{ valid: boolean; entitlements: string[]; expiry: string | null } | null> {
  clearSubscriptionCache();
  return authorityPost<{ valid: boolean; entitlements: string[]; expiry: string | null }>('/subscriptions/verify', {
    user_id: userId,
    receipt_token: receiptToken,
    product_id: productId,
  });
}

/**
 * Get authoritative subscription status from server.
 * This is the DEFINITIVE check — client cache is cosmetic only.
 */
export async function getServerSubscriptionStatus(
  userId: string,
  deviceId: string,
): Promise<{ status: string; has_access: boolean; expires_at: string | null } | null> {
  return authorityPost<{ status: string; has_access: boolean; expires_at: string | null }>('/subscriptions/status', {
    user_id: userId,
    device_id: deviceId,
  });
}
