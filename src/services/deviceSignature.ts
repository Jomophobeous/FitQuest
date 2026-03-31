/**
 * Device Identity & Challenge-Response — Phase 25A
 *
 * Secure device verification using server-issued challenges.
 * No secrets on client. No HMAC. No signing key.
 *
 * Protocol:
 *   1. Client → POST /auth/challenge { user_id, device_id }
 *   2. Server → { challenge_id, nonce, expires_at }
 *   3. Client computes: SHA-256(nonce + device_id + app_version) — NO secret
 *   4. Client → POST /auth/verify { challenge_id, response, app_version }
 *   5. Server validates: reconstructs hash, constant-time compare
 *
 * Security properties:
 *   - No secret in APK → nothing to extract
 *   - Each request tied to ephemeral server-issued nonce (60s TTL)
 *   - Challenges consumed after use → no replay
 *   - Trust anchored entirely on server
 */

import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// ── Device ID ──

const DEVICE_ID_KEY = 'fitquest_device_id';
let _cachedDeviceId: string | null = null;

/**
 * Get a stable device identifier.
 * Generated once as a UUID and persisted in SecureStore across app launches.
 * Falls back to a runtime-only UUID if SecureStore is unavailable.
 */
export async function getStableDeviceId(): Promise<string> {
  if (_cachedDeviceId) return _cachedDeviceId;
  try {
    // Try to read existing ID from SecureStore
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) {
      _cachedDeviceId = stored;
      return stored;
    }
    // Generate a new stable ID
    const newId = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
    _cachedDeviceId = newId;
    return newId;
  } catch {
    // SecureStore unavailable (web, test environment) — generate a runtime ID
    if (!_cachedDeviceId) {
      _cachedDeviceId = Crypto.randomUUID();
    }
    return _cachedDeviceId;
  }
}

/**
 * Get the app version string (e.g. "1.0.0").
 */
export function getAppVersion(): string {
  return Application.nativeApplicationVersion || '1.0.0';
}

// ── Challenge-Response ──

/**
 * Compute the challenge response: SHA-256(nonce + device_id + app_version).
 * No secret involved — security comes from server-issued ephemeral nonce.
 */
export async function computeChallengeResponse(nonce: string, deviceId: string): Promise<string> {
  const appVersion = getAppVersion();
  const payload = `${nonce}${deviceId}${appVersion}`;
  // Use expo-crypto for SHA-256 (works in all Expo environments)
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
  return digest;
}
