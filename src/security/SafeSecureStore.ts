/**
 * SafeSecureStore — Type-safe wrapper around expo-secure-store.
 *
 * Enforces string-only writes at runtime (not just TypeScript).
 * Logs the offending key + actual type in __DEV__ for debugging.
 * Throws with a clear message that identifies the CALLER (key name).
 *
 * Use this instead of SecureStore.setItemAsync directly when the
 * value originates from an external source (API responses, env vars).
 */

import * as SecureStore from 'expo-secure-store';

// ── Type Enforcement ──

/**
 * Safe write: enforces string type at runtime.
 * Logs + throws descriptively if value is not a string.
 */
export async function safeSetItemAsync(
  key: string,
  value: unknown,
  options?: SecureStore.SecureStoreOptions,
): Promise<void> {
  if (typeof value !== 'string') {
    const type = value === null ? 'null' : value === undefined ? 'undefined' : typeof value;
    const preview =
      value === null || value === undefined
        ? String(value)
        : typeof value === 'object'
          ? JSON.stringify(value).slice(0, 80)
          : String(value).slice(0, 80);

    if (__DEV__) {
      console.error(
        `[SafeSecureStore] Non-string write blocked.\n` +
          `  Key: "${key}"\n` +
          `  Type: ${type}\n` +
          `  Value preview: ${preview}`,
      );
    }

    throw new Error(
      `SecureStore requires a string for key "${key}" — got ${type}. ` +
        `Check the caller; consider JSON.stringify() for objects.`,
    );
  }

  return SecureStore.setItemAsync(key, value, options);
}

/**
 * Safe read: returns null if key has a corrupt/non-string value.
 * (SecureStore always returns string | null, but this guards against
 * edge cases where previously stored data might be unexpected.)
 */
export async function safeGetItemAsync(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e: any) {
    if (__DEV__) {
      console.error(`[SafeSecureStore] Read failed for key "${key}": ${e.message}`);
    }
    return null;
  }
}

/**
 * Validate that an auth session response has the required string fields.
 * Throws a clear error if fields are missing or wrong type.
 */
export function assertValidSession(
  session: unknown,
  context: string = 'auth',
): asserts session is { accessToken: string; user: object; refreshToken?: string } {
  if (!session || typeof session !== 'object') {
    throw new Error(`[${context}] Invalid session: expected object, got ${typeof session}`);
  }

  const s = session as Record<string, unknown>;

  if (typeof s['accessToken'] !== 'string' || s['accessToken'].length === 0) {
    throw new Error(
      `[${context}] Invalid session: accessToken is ${s['accessToken'] === undefined ? 'missing' : `"${typeof s['accessToken']}" (${String(s['accessToken']).slice(0, 20)})`}`,
    );
  }

  if (!s['user'] || typeof s['user'] !== 'object') {
    throw new Error(`[${context}] Invalid session: user is ${typeof s['user']}`);
  }
}
