/**
 * Device Signature Generation — Phase 24A (Integration Testing Only)
 *
 * Generates HMAC-SHA256 signatures matching the server's verification logic:
 *   payload = `${user_id}|${device_id}|${app_version}|${timestamp}`
 *   signature = HMAC-SHA256(payload, DEVICE_SIGNING_SECRET).hex()
 *
 * ═══════════════════════════════════════════════════════════════════
 * ⚠️  SECURITY WARNING — DO NOT SHIP THIS IN PRODUCTION BUILDS  ⚠️
 * ═══════════════════════════════════════════════════════════════════
 * The signing secret is embedded via EXPO_PUBLIC_DEV_SIGNING_SECRET
 * for integration testing ONLY. In production (Phase 25+), this must
 * be replaced by one of:
 *   - Server-issued short-lived tokens
 *   - Device-bound keys provisioned at registration
 *   - Challenge-response protocol
 *
 * The EXPO_PUBLIC_ prefix means this value is bundled into the JS
 * and extractable from the APK. This is acceptable ONLY for dev/test.
 * ═══════════════════════════════════════════════════════════════════
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// ── Secret access (dev-only) ──

const DEV_SIGNING_SECRET = process.env.EXPO_PUBLIC_DEV_SIGNING_SECRET || '';

/**
 * Returns true if the signing secret is available.
 * If false, signature generation will fail — callers should degrade gracefully.
 */
export function isSigningAvailable(): boolean {
  return DEV_SIGNING_SECRET.length > 0;
}

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

// ── HMAC-SHA256 Signature ──

/**
 * Generate an HMAC-SHA256 signature matching the server's `verifyDeviceSignature()`.
 *
 * Server expects: HMAC-SHA256(`${user_id}|${device_id}|${app_version}|${timestamp}`, secret)
 *
 * @param userId    - User identifier (e.g. "user_local_001")
 * @param deviceId  - Device identifier from getStableDeviceId()
 * @param timestamp - Unix epoch ms (Date.now())
 * @returns Hex-encoded HMAC signature, or null if signing secret unavailable
 */
export function generateDeviceSignature(userId: string, deviceId: string, timestamp: number): string | null {
  if (!DEV_SIGNING_SECRET) {
    if (__DEV__) {
      console.error(
        '[DeviceSignature] EXPO_PUBLIC_DEV_SIGNING_SECRET not set. ' +
          'Cannot generate HMAC signature. Set it in .env for integration testing.',
      );
    }
    return null;
  }

  const appVersion = getAppVersion();
  const payload = `${userId}|${deviceId}|${appVersion}|${timestamp}`;

  // RFC 2104 HMAC-SHA256 via @noble/hashes (audited, zero-dependency)
  const secretBytes = new TextEncoder().encode(DEV_SIGNING_SECRET);
  const mac = hmac(sha256, secretBytes, new TextEncoder().encode(payload));
  return bytesToHex(mac);
}

/**
 * Generate a complete device verification request payload.
 * Convenience wrapper that assembles all fields the server expects.
 */
export async function buildDeviceVerificationPayload(userId: string): Promise<{
  user_id: string;
  device_id: string;
  app_version: string;
  signature: string;
  timestamp: number;
} | null> {
  const deviceId = await getStableDeviceId();
  const timestamp = Date.now();
  const signature = generateDeviceSignature(userId, deviceId, timestamp);

  if (!signature) return null;

  return {
    user_id: userId,
    device_id: deviceId,
    app_version: getAppVersion(),
    signature,
    timestamp,
  };
}
