/**
 * FitQuest Backend Authority Client — Phase 25A
 *
 * Client-side interface to the FitQuest Authority Server.
 * All verification routes through this service — no local trust.
 *
 * Endpoints:
 *   POST /verify/subscription  — Authoritative subscription status
 *   POST /auth/challenge       — Request challenge nonce (Phase 25A)
 *   POST /auth/verify          — Submit challenge response (Phase 25A)
 *   POST /user/create          — User identity registration
 *   GET  /health               — Server health check
 *   POST /ai/request           — AI access authorization
 *
 * Offline behavior:
 *   All methods return null on network failure. Callers must handle
 *   null gracefully (degrade to cached state with reduced trust).
 *
 * Error handling:
 *   authorityFetch now returns structured errors for 403/429/500,
 *   enabling callers to map to UI states (blocked, rate-limited, error).
 */

import { getApiBaseUrl } from './apiBaseUrl';
import * as Application from 'expo-application';
import { getStableDeviceId, computeChallengeResponse, getAppVersion as getDeviceAppVersion } from './deviceSignature';

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

/**
 * Structured error returned when the server responds with a non-200 status.
 * Callers use `httpStatus` to map to UI states.
 */
export interface AuthorityError {
  httpStatus: number;
  message: string;
  retryAfterMs?: number;
}

/**
 * Result that distinguishes success, structured error, and offline.
 * - success: data is present
 * - error: server responded with a structured error (403/429/500)
 * - null: offline / network failure
 */
export type AuthorityResult<T> = { kind: 'success'; data: T } | { kind: 'error'; error: AuthorityError } | null;

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

/**
 * Core fetch wrapper with structured error handling and observability.
 *
 * Returns:
 *   { kind: 'success', data } — 200 with valid response body
 *   { kind: 'error', error }  — 403/429/500 with structured details
 *   null                      — offline / timeout / network failure
 */
async function authorityFetch<T>(path: string, body?: Record<string, unknown>): Promise<AuthorityResult<T>> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startTime = Date.now();

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

    const latencyMs = Date.now() - startTime;

    // Dev-mode observability: log every response
    if (__DEV__) {
      console.log(`[Authority] ${options.method} ${path} → ${res.status} (${latencyMs}ms)`);
    }

    // Try to parse body for all status codes (server sends structured JSON)
    let json: AuthorityResponse<T> | null = null;
    try {
      json = (await res.json()) as AuthorityResponse<T>;
    } catch {
      // Non-JSON response (e.g. HTML error page)
    }

    if (__DEV__ && json) {
      console.log(`[Authority] ${path} body:`, JSON.stringify(json).slice(0, 500));
    }

    // 200 OK — success
    if (res.ok && json?.success && json.data) {
      getState().consecutiveFailures = 0;
      return { kind: 'success', data: json.data };
    }

    // Non-OK: structured error for callers
    getState().consecutiveFailures += 1;

    const errorMessage = json?.error || `HTTP ${res.status}`;

    // 429 — Rate limited
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      return {
        kind: 'error',
        error: {
          httpStatus: 429,
          message: errorMessage,
          retryAfterMs: retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000,
        },
      };
    }

    // 403 — Forbidden (blocked, untrusted, invalid signature)
    // 401 — Unauthorized (missing or invalid API key)
    if (res.status === 403 || res.status === 401) {
      return {
        kind: 'error',
        error: { httpStatus: res.status, message: errorMessage },
      };
    }

    // 400 — Bad request (missing fields, validation)
    if (res.status === 400) {
      return {
        kind: 'error',
        error: { httpStatus: 400, message: errorMessage },
      };
    }

    // 500+ — Server error
    if (res.status >= 500) {
      return {
        kind: 'error',
        error: { httpStatus: res.status, message: 'Server error. Try again later.' },
      };
    }

    // Other non-OK status
    return {
      kind: 'error',
      error: { httpStatus: res.status, message: errorMessage },
    };
  } catch (_e) {
    clearTimeout(timeout);
    getState().consecutiveFailures += 1;
    const latencyMs = Date.now() - startTime;
    if (__DEV__) {
      const errMsg = _e instanceof Error ? _e.message : String(_e);
      console.warn(`[Authority] ${path} FAILED (${latencyMs}ms): ${errMsg}`);
    }
    return null; // Offline / timeout
  }
}

/**
 * Backward-compatible wrapper: extracts data from AuthorityResult or returns null.
 * Used by methods that don't need granular error handling yet.
 */
function unwrapResult<T>(result: AuthorityResult<T>): T | null {
  if (result && result.kind === 'success') return result.data;
  return null;
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

  const data = unwrapResult(result);
  if (data) {
    state.lastSubscriptionCheck = now;
    state.lastSubscriptionResult = data;
    return data;
  }

  return null;
}

/**
 * Verify device with the authority server using challenge-response protocol.
 * Phase 25A: No secrets on client. Server issues challenge, client proves liveness.
 * Throttled to max once per 30 minutes.
 *
 * Flow:
 *   1. POST /auth/challenge { user_id, device_id } → { challenge_id, nonce }
 *   2. SHA-256(nonce + device_id + app_version) → response
 *   3. POST /auth/verify { challenge_id, response, app_version } → DeviceVerification
 */
export async function verifyDevice(userId: string): Promise<DeviceVerification | null> {
  const state = getState();
  const now = Date.now();

  // Throttle — return cached result if recent
  if (now - state.lastDeviceCheck < DEVICE_CHECK_THROTTLE_MS) {
    return state.lastDeviceResult;
  }

  const deviceId = await getStableDeviceId();

  // Step 1: Request challenge
  const challengeResult = await authorityFetch<{
    challenge_id: string;
    nonce: string;
    expires_at: number;
  }>('/auth/challenge', {
    user_id: userId,
    device_id: deviceId,
  });

  if (!challengeResult || challengeResult.kind !== 'success') {
    if (__DEV__ && challengeResult && challengeResult.kind === 'error') {
      console.warn(
        `[Authority] Challenge request failed: ${challengeResult.error.httpStatus} — ${challengeResult.error.message}`,
      );
    }
    return null;
  }

  const { challenge_id, nonce } = challengeResult.data;

  // Step 2: Compute response (SHA-256, no secret)
  const response = await computeChallengeResponse(nonce, deviceId);

  // Step 3: Submit response
  const verifyResult = await authorityFetch<DeviceVerification>('/auth/verify', {
    challenge_id,
    response,
    app_version: getDeviceAppVersion(),
  });

  const data = unwrapResult(verifyResult);
  if (data) {
    state.lastDeviceCheck = now;
    state.lastDeviceResult = data;
    return data;
  }

  // Log structured error in dev
  if (__DEV__ && verifyResult && verifyResult.kind === 'error') {
    console.warn(
      `[Authority] Device verification rejected: ${verifyResult.error.httpStatus} — ${verifyResult.error.message}`,
    );
  }

  return null;
}

/**
 * Verify device with full result (including structured errors).
 * Use this when callers need to distinguish offline vs blocked vs rate-limited.
 * Phase 25A: challenge-response protocol.
 */
export async function verifyDeviceDetailed(userId: string): Promise<AuthorityResult<DeviceVerification>> {
  const deviceId = await getStableDeviceId();

  // Step 1: Request challenge
  const challengeResult = await authorityFetch<{
    challenge_id: string;
    nonce: string;
    expires_at: number;
  }>('/auth/challenge', {
    user_id: userId,
    device_id: deviceId,
  });

  if (!challengeResult || challengeResult.kind !== 'success') {
    return challengeResult as AuthorityResult<DeviceVerification>;
  }

  const { challenge_id, nonce } = challengeResult.data;

  // Step 2: Compute response
  const response = await computeChallengeResponse(nonce, deviceId);

  // Step 3: Submit
  return authorityFetch<DeviceVerification>('/auth/verify', {
    challenge_id,
    response,
    app_version: getDeviceAppVersion(),
  });
}

/**
 * Register user identity with the authority server.
 * Idempotent — safe to call multiple times.
 */
export async function createUser(id: string, email: string): Promise<UserCreateResult | null> {
  const result = await authorityFetch<UserCreateResult>('/user/create', { id, email });
  return unwrapResult(result);
}

/**
 * Check server health / reachability.
 */
export async function checkHealth(): Promise<HealthStatus | null> {
  const result = await authorityFetch<HealthStatus>('/health');
  return unwrapResult(result);
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
  const startTime = Date.now();

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

    const latencyMs = Date.now() - startTime;
    if (__DEV__) {
      console.log(`[Authority] POST /ai/request → ${res.status} (${latencyMs}ms)`);
    }

    // Parse body on all status codes (429 returns rate-limit info)
    let json: AuthorityResponse<AIAccessResult> | null = null;
    try {
      json = (await res.json()) as AuthorityResponse<AIAccessResult>;
    } catch {
      /* non-JSON */
    }

    if (__DEV__ && json) {
      console.log(`[Authority] /ai/request body:`, JSON.stringify(json).slice(0, 500));
    }

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
    clearTimeout(timeout);
    getState().consecutiveFailures += 1;
    const latencyMs = Date.now() - startTime;
    if (__DEV__) {
      const errMsg = _e instanceof Error ? _e.message : String(_e);
      console.warn(`[Authority] /ai/request FAILED (${latencyMs}ms): ${errMsg}`);
    }
    return null;
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
