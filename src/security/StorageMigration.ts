/**
 * FitQuest Storage Migration
 * 
 * One-time migration of sensitive keys from AsyncStorage to SecureStore.
 * Non-sensitive preferences (theme, language) stay in AsyncStorage.
 * 
 * Migrated keys:
 * - authToken → SecureStore
 * - refreshToken → SecureStore
 * - user → SecureStore
 * 
 * Keys that stay in AsyncStorage:
 * - fitquest_theme (non-sensitive UI preference)
 * - fitquest_language (non-sensitive UI preference)
 * - offline_cache_* (cached API data, non-sensitive)
 * 
 * Run once on app startup. Idempotent — safe to call multiple times.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ============================================
// CONSTANTS
// ============================================

const MIGRATION_FLAG = 'fitquest_storage_migration_v1';

/** Keys to migrate from AsyncStorage → SecureStore */
const SENSITIVE_KEYS = [
  'authToken',
  'refreshToken',
  'user',
] as const;

/** Mapping of old AsyncStorage keys to new SecureStore keys */
const KEY_MAP: Record<string, string> = {
  authToken: 'fitquest_auth_token',
  refreshToken: 'fitquest_refresh_token',
  user: 'fitquest_user_profile',
};

// ============================================
// TYPES
// ============================================

export interface MigrationResult {
  migrated: string[];
  skipped: string[];
  errors: Array<{ key: string; error: string }>;
  alreadyCompleted: boolean;
}

// ============================================
// MIGRATION SERVICE
// ============================================

/**
 * Migrate sensitive AsyncStorage data to SecureStore.
 * 
 * Flow:
 * 1. Check if migration already ran (idempotent guard)
 * 2. For each sensitive key: read from AsyncStorage, write to SecureStore
 * 3. Delete original from AsyncStorage after successful copy
 * 4. Set migration flag
 * 
 * @returns MigrationResult with details of what was migrated
 */
export async function migrateToSecureStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: [],
    skipped: [],
    errors: [],
    alreadyCompleted: false,
  };

  // Check if already migrated
  try {
    const flag = await AsyncStorage.getItem(MIGRATION_FLAG);
    if (flag === 'completed') {
      result.alreadyCompleted = true;
      return result;
    }
  } catch {
    // If we can't read the flag, proceed with migration
  }

  console.log('[FitQuest Migration] Starting AsyncStorage → SecureStore migration...');

  for (const key of SENSITIVE_KEYS) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) {
        result.skipped.push(key);
        continue;
      }

      const secureKey = KEY_MAP[key] || key;

      // Check if already in SecureStore (don't overwrite)
      const existing = await SecureStore.getItemAsync(secureKey);
      if (existing) {
        // Already migrated, just clean up AsyncStorage
        await AsyncStorage.removeItem(key);
        result.skipped.push(key);
        continue;
      }

      // Write to SecureStore
      await SecureStore.setItemAsync(secureKey, value);

      // Verify it was written
      const verification = await SecureStore.getItemAsync(secureKey);
      if (verification !== value) {
        throw new Error('Verification failed — data mismatch after write');
      }

      // Remove from AsyncStorage
      await AsyncStorage.removeItem(key);
      result.migrated.push(key);
      console.log(`[FitQuest Migration] Migrated: ${key} → ${secureKey}`);
    } catch (e: any) {
      result.errors.push({ key, error: e.message || 'Unknown error' });
      console.error(`[FitQuest Migration] Failed to migrate ${key}:`, e);
      // Don't remove from AsyncStorage on error — leave original intact
    }
  }

  // Mark migration as complete (even if some keys had errors)
  if (result.errors.length === 0) {
    await AsyncStorage.setItem(MIGRATION_FLAG, 'completed');
    console.log(`[FitQuest Migration] Complete. Migrated: ${result.migrated.length}, Skipped: ${result.skipped.length}`);
  } else {
    // Partial migration — mark as incomplete so it retries next launch
    await AsyncStorage.setItem(MIGRATION_FLAG, 'partial');
    console.warn(`[FitQuest Migration] Partial. Migrated: ${result.migrated.length}, Errors: ${result.errors.length}`);
  }

  return result;
}

// ============================================
// SECURE STORAGE HELPERS
// ============================================

/**
 * Read auth token from SecureStore (post-migration) or fall back to AsyncStorage.
 */
export async function getAuthToken(): Promise<string | null> {
  // Try SecureStore first
  const secure = await SecureStore.getItemAsync(KEY_MAP.authToken);
  if (secure) return secure;

  // Fall back to AsyncStorage (pre-migration)
  return AsyncStorage.getItem('authToken');
}

/**
 * Read user profile from SecureStore (post-migration) or fall back to AsyncStorage.
 */
export async function getUserProfile(): Promise<object | null> {
  const secure = await SecureStore.getItemAsync(KEY_MAP.user);
  if (secure) {
    try { return JSON.parse(secure); } catch { return null; }
  }

  // Fall back to AsyncStorage
  const legacy = await AsyncStorage.getItem('user');
  if (legacy) {
    try { return JSON.parse(legacy); } catch { return null; }
  }

  return null;
}

/**
 * Store auth credentials in SecureStore (new writes always go to SecureStore).
 */
export async function setAuthCredentials(
  token: string,
  user: object,
  refreshToken?: string
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_MAP.authToken, token),
    SecureStore.setItemAsync(KEY_MAP.user, JSON.stringify(user)),
    refreshToken
      ? SecureStore.setItemAsync(KEY_MAP.refreshToken, refreshToken)
      : Promise.resolve(),
  ]);
}

/**
 * Clear all auth credentials from SecureStore.
 */
export async function clearAuthCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_MAP.authToken),
    SecureStore.deleteItemAsync(KEY_MAP.refreshToken),
    SecureStore.deleteItemAsync(KEY_MAP.user),
    // Also clean AsyncStorage in case migration hasn't run yet
    AsyncStorage.removeItem('authToken').catch(() => {}),
    AsyncStorage.removeItem('refreshToken').catch(() => {}),
    AsyncStorage.removeItem('user').catch(() => {}),
  ]);
}

/**
 * Check if migration has been completed.
 */
export async function isMigrationComplete(): Promise<boolean> {
  const flag = await AsyncStorage.getItem(MIGRATION_FLAG);
  return flag === 'completed';
}
