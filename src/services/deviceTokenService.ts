/**
 * Device Token Service — Phase 26
 *
 * Manages the server-issued device_token lifecycle:
 *   - Registration (POST /device/register after auth/verify)
 *   - Secure storage (expo-secure-store)
 *   - Retrieval for protected requests
 *   - Rotation (POST /device/rotate on anomaly)
 *   - Revocation cleanup
 *
 * The device_token proves device identity to the server.
 * Without it, all protected endpoints reject with 401/403.
 */

import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from './apiBaseUrl';
import { getStableDeviceId, computeChallengeResponse, getAppVersion } from './deviceSignature';

// ── Constants ──

const DEVICE_TOKEN_KEY = 'fitquest_device_token';
const REQUEST_TIMEOUT_MS = 15_000;
const AUTHORITY_API_KEY = process.env.EXPO_PUBLIC_AUTHORITY_API_KEY || '';
const USER_ID = 'user_local_001';

let _cachedToken: string | null = null;

// ── Public API ──

/**
 * Get stored device_token, or null if not registered.
 */
export async function getDeviceToken(): Promise<string | null> {
  if (_cachedToken) return _cachedToken;

  try {
    const stored = await SecureStore.getItemAsync(DEVICE_TOKEN_KEY);
    if (stored) {
      _cachedToken = stored;
    }
    return stored;
  } catch {
    return null;
  }
}

/**
 * Register this device with the server and store the issued token.
 * Requires a fresh challenge-response handshake.
 *
 * Returns the device_token on success, null on failure.
 */
export async function registerDevice(): Promise<string | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const deviceId = await getStableDeviceId();
    const appVersion = getAppVersion();

    // Step 1: Acquire challenge
    const challengeRes = await timedFetch(`${baseUrl}/auth/challenge`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ user_id: USER_ID, device_id: deviceId }),
    });

    if (!challengeRes.ok) {
      if (__DEV__) console.warn('[DeviceToken] Challenge failed:', challengeRes.status);
      return null;
    }

    const challengeJson = await challengeRes.json();
    const { challenge_id, nonce } = challengeJson.data || {};
    if (!challenge_id || !nonce) return null;

    // Step 2: Compute response
    const response = await computeChallengeResponse(nonce, deviceId);

    // Step 3: Register device
    const registerRes = await timedFetch(`${baseUrl}/device/register`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        user_id: USER_ID,
        device_id: deviceId,
        app_version: appVersion,
        challenge_id,
        challenge_response: response,
      }),
    });

    if (!registerRes.ok) {
      if (__DEV__) console.warn('[DeviceToken] Registration failed:', registerRes.status);
      return null;
    }

    const registerJson = await registerRes.json();
    const deviceToken = registerJson.data?.device_token;
    if (!deviceToken) return null;

    // Step 4: Store securely
    await storeToken(deviceToken);

    if (__DEV__) {
      console.log(`[DeviceToken] Registered (new=${registerJson.data?.is_new})`);
    }

    return deviceToken;
  } catch (e) {
    if (__DEV__) console.warn('[DeviceToken] Registration error:', e);
    return null;
  }
}

/**
 * Ensure device is registered. Returns token if available, registers if not.
 */
export async function ensureDeviceRegistered(): Promise<string | null> {
  const existing = await getDeviceToken();
  if (existing) return existing;
  return registerDevice();
}

/**
 * Rotate the device token (e.g., on anomaly detection).
 * Revokes old token and issues a new one.
 */
export async function rotateDeviceToken(): Promise<string | null> {
  try {
    const currentToken = await getDeviceToken();
    if (!currentToken) return registerDevice();

    const baseUrl = getApiBaseUrl();
    const deviceId = await getStableDeviceId();
    const appVersion = getAppVersion();

    // Acquire fresh challenge for rotation
    const challengeRes = await timedFetch(`${baseUrl}/auth/challenge`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ user_id: USER_ID, device_id: deviceId }),
    });

    if (!challengeRes.ok) return null;

    const challengeJson = await challengeRes.json();
    const { challenge_id, nonce } = challengeJson.data || {};
    if (!challenge_id || !nonce) return null;

    const response = await computeChallengeResponse(nonce, deviceId);

    const rotateRes = await timedFetch(`${baseUrl}/device/rotate`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        user_id: USER_ID,
        device_id: deviceId,
        device_token: currentToken,
        app_version: appVersion,
        challenge_id,
        challenge_response: response,
      }),
    });

    if (!rotateRes.ok) {
      if (__DEV__) console.warn('[DeviceToken] Rotation failed:', rotateRes.status);
      // If 401/403, token may be revoked — clear local copy
      if (rotateRes.status === 401 || rotateRes.status === 403) {
        await clearToken();
      }
      return null;
    }

    const rotateJson = await rotateRes.json();
    const newToken = rotateJson.data?.device_token;
    if (!newToken) return null;

    await storeToken(newToken);
    if (__DEV__) console.log('[DeviceToken] Rotated successfully');
    return newToken;
  } catch (e) {
    if (__DEV__) console.warn('[DeviceToken] Rotation error:', e);
    return null;
  }
}

/**
 * Clear stored device token (on revocation or logout).
 */
export async function clearDeviceToken(): Promise<void> {
  await clearToken();
}

/**
 * Handle 401/403 from server — may need re-registration.
 * Call this when a protected request fails with auth error.
 */
export async function handleAuthFailure(status: number): Promise<string | null> {
  if (status === 401 || status === 403) {
    await clearToken();
    // Attempt re-registration
    return registerDevice();
  }
  return null;
}

// ── Internal ──

async function storeToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
    _cachedToken = token;
  } catch {
    // SecureStore unavailable — cache only
    _cachedToken = token;
  }
}

async function clearToken(): Promise<void> {
  _cachedToken = null;
  try {
    await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
  } catch {
    // Ignore cleanup errors
  }
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': getAppVersion(),
  };
  if (AUTHORITY_API_KEY) {
    headers['Authorization'] = `Bearer ${AUTHORITY_API_KEY}`;
  }
  return headers;
}

async function timedFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
