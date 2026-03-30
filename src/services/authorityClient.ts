/**
 * FitQuest Backend Authority Client — Phase 21
 *
 * Client-side interface to the FitQuest Authority Server.
 * All verification routes through this service — no local trust.
 *
 * Endpoints:
 *   POST /verify/subscription  — Authoritative subscription status
 *   POST /verify/device        — Device fingerprint + trust scoring
 *   POST /user/create          — User identity registration
 *   GET  /health               — Server health check
 *
 * Offline behavior:
 *   All methods return null on network failure. Callers must handle
 *   null gracefully (degrade to cached state with reduced trust).
 */

import { getApiBaseUrl } from './apiBaseUrl';
import * as Application from 'expo-application';

// S2: API key for authority server authentication (POST routes)
const AUTHORITY_API_KEY = process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';

// ── Types ──

export interface AuthorityResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface SubscriptionVerification {
  user_id: string;
  status: 'active' | 'inactive' | 'expired' | 'trialing';
  expires_at: string | null;
  verified_at: string;
  restricted: boolean;
}

export interface DeviceVerification {
  user_id: string;
  device_id: string;
  untrusted: boolean;
  verified_at: string;
}

export interface UserCreateResult {
  id: string;
  created: boolean;
}

export interface HealthStatus {
  service: string;
  version: string;
  status: string;
  timestamp: string;
}

export interface AIAccessResult {
  authorized: boolean;
  restricted: boolean;
  remaining: number;
  retryAfterMs?: number;
  reason?: string;
  timestamp?: string;
}

// ── Constants ──

const REQUEST_TIMEOUT_MS = 8_000;
const SUBSCRIPTION_CHECK_THROTTLE_MS = 5 * 60 * 1000; // 5 min
const DEVICE_CHECK_THROTTLE_MS = 30 * 60 * 1000; // 30 min

// ── State ──

interface AuthorityClientState {
  lastSubscriptionCheck: number;
  lastDeviceCheck: number;
  lastSubscriptionResult: SubscriptionVerification | null;
  lastDeviceResult: DeviceVerification | null;
  consecutiveFailures: number;
}

const AUTHORITY_STATE_KEY = '__authority_client';

function getState(): AuthorityClientState {
  const g = globalThis as Record<string, unknown>;
  if (!g[AUTHORITY_STATE_KEY]) {
    g[AUTHORITY_STATE_KEY] = {
      lastSubscriptionCheck: 0,
      lastDeviceCheck: 0,
      lastSubscriptionResult: null,
      lastDeviceResult: null,
      consecutiveFailures: 0,
    } satisfies AuthorityClientState;
  }
  return g[AUTHORITY_STATE_KEY] as AuthorityClientState;
}

// ── Helpers ──

function getBaseUrl(): string | null {
  try {
    return getApiBaseUrl();
  } catch {
    return null;
  }
}

function getAppVersion(): string {
  return Application.nativeApplicationVersion || '1.0.0';
}

async function authorityFetch<T>(path: string, body?: Record<string, unknown>): Promise<AuthorityResponse<T> | null> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Version': getAppVersion(),
    };

    // S2: Add auth header for POST requests
    if (body && AUTHORITY_API_KEY) {
      headers['Authorization'] = `Bearer ${AUTHORITY_API_KEY}`;
    }

    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers,
      signal: controller.signal,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(`${baseUrl}${path}`, options);
    clearTimeout(timeout);

    if (!res.ok) {
      if (__DEV__) console.warn(`[Authority] ${path} returned HTTP ${res.status}`);
      getState().consecutiveFailures += 1;
      return null;
    }

    const json = (await res.json()) as AuthorityResponse<T>;
    getState().consecutiveFailures = 0;
    return json;
  } catch (_e) {
    getState().consecutiveFailures += 1;
    if (__DEV__) console.warn(`[Authority] ${path} failed:`, _e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public API ──

/**
 * Verify subscription status with the authority server.
 * Returns null on network failure (caller should degrade gracefully).
 * Throttled to max once per 5 minutes.
 */
export async function verifySubscription(userId: string, deviceId: string): Promise<SubscriptionVerification | null> {
  const state = getState();
  const now = Date.now();

  // Throttle — return cached result if recent
  if (now - state.lastSubscriptionCheck < SUBSCRIPTION_CHECK_THROTTLE_MS) {
    return state.lastSubscriptionResult;
  }

  const result = await authorityFetch<SubscriptionVerification>('/verify/subscription', {
    user_id: userId,
    device_id: deviceId,
  });

  if (result?.success && result.data) {
    state.lastSubscriptionCheck = now;
    state.lastSubscriptionResult = result.data;
    return result.data;
  }

  return null;
}

/**
 * Verify device with the authority server.
 * Registers device fingerprint and returns trust score.
 * Throttled to max once per 30 minutes.
 */
export async function verifyDevice(
  userId: string,
  deviceId: string,
  signature: string,
): Promise<DeviceVerification | null> {
  const state = getState();
  const now = Date.now();

  // Throttle — return cached result if recent
  if (now - state.lastDeviceCheck < DEVICE_CHECK_THROTTLE_MS) {
    return state.lastDeviceResult;
  }

  const result = await authorityFetch<DeviceVerification>('/verify/device', {
    user_id: userId,
    device_id: deviceId,
    app_version: getAppVersion(),
    signature,
    timestamp: Date.now(), // S1: replay protection
  });

  if (result?.success && result.data) {
    state.lastDeviceCheck = now;
    state.lastDeviceResult = result.data;
    return result.data;
  }

  return null;
}

/**
 * Register user identity with the authority server.
 * Idempotent — safe to call multiple times.
 */
export async function createUser(id: string, email: string): Promise<UserCreateResult | null> {
  const result = await authorityFetch<UserCreateResult>('/user/create', { id, email });

  return result?.success ? result.data : null;
}

/**
 * Check server health / reachability.
 */
export async function checkHealth(): Promise<HealthStatus | null> {
  const result = await authorityFetch<HealthStatus>('/health');
  return result?.success ? result.data : null;
}

/**
 * Request AI access authorization from the authority server.
 * Returns null only on network failure (offline).
 * Unlike other methods, this reads the body on 429 to return rate-limit info.
 * Not throttled — server manages per-user/device rate limiting.
 */
export async function requestAI(userId: string, deviceId: string, prompt: string): Promise<AIAccessResult | null> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const aiHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Version': getAppVersion(),
    };
    if (AUTHORITY_API_KEY) {
      aiHeaders['Authorization'] = `Bearer ${AUTHORITY_API_KEY}`;
    }

    const res = await fetch(`${baseUrl}/ai/request`, {
      method: 'POST',
      headers: aiHeaders,
      body: JSON.stringify({
        user_id: userId,
        device_id: deviceId,
        prompt,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Parse body on all status codes (429 returns rate-limit info)
    const json = (await res.json()) as AuthorityResponse<AIAccessResult>;

    if (json?.success && json.data) {
      getState().consecutiveFailures = 0;
      return json.data;
    }

    // 429 — rate limited: server returns data with retryAfterMs
    if (res.status === 429 && json?.data) {
      return {
        authorized: false,
        restricted: true,
        remaining: 0,
        retryAfterMs: (json.data as AIAccessResult).retryAfterMs || 60_000,
      };
    }

    // 403 — suspended/denied
    if (res.status === 403) {
      return {
        authorized: false,
        restricted: true,
        remaining: 0,
        reason: json?.error || 'Access denied.',
      };
    }

    getState().consecutiveFailures += 1;
    return null;
  } catch (_e) {
    getState().consecutiveFailures += 1;
    if (__DEV__) console.warn('[Authority] /ai/request failed:', _e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get cached subscription verification (no network call).
 */
export function getCachedSubscriptionStatus(): SubscriptionVerification | null {
  return getState().lastSubscriptionResult;
}

/**
 * Get cached device verification (no network call).
 */
export function getCachedDeviceVerification(): DeviceVerification | null {
  return getState().lastDeviceResult;
}

/**
 * Get consecutive failure count (for degradation decisions).
 */
export function getAuthorityFailureCount(): number {
  return getState().consecutiveFailures;
}

/**
 * Force a fresh subscription check on next call (clears throttle).
 */
export function invalidateSubscriptionCache(): void {
  getState().lastSubscriptionCheck = 0;
}
