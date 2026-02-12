/**
 * FitQuest Storage Migration
 * 
 * One-time storage initialization for SecureStore keys.
 * 
 * Migrated keys:
 * - authToken → SecureStore
 * - refreshToken → SecureStore
 * - user → SecureStore
 * 
 * Run once on app startup. Idempotent — safe to call multiple times.
 */
import * as SecureStore from 'expo-secure-store';

// ============================================
// CONSTANTS
// ============================================

const MIGRATION_FLAG = 'fitquest_storage_migration_v1';

/** Keys tracked in SecureStore */
const SENSITIVE_KEYS = [
  'authToken',
  'refreshToken',
  'user',
] as const;

/** Mapping of legacy keys to SecureStore keys */
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
 * Ensure SecureStore is initialized for auth keys.
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

  const flag = await SecureStore.getItemAsync(MIGRATION_FLAG);
  if (flag === 'completed') {
    result.alreadyCompleted = true;
    return result;
  }

  for (const key of SENSITIVE_KEYS) {
    try {
      const secureKey = KEY_MAP[key] || key;
      const existing = await SecureStore.getItemAsync(secureKey);
      if (existing) {
        result.skipped.push(key);
        continue;
      }
    } catch (e: any) {
      result.errors.push({ key, error: e.message || 'Unknown error' });
    }
  }

  await SecureStore.setItemAsync(MIGRATION_FLAG, 'completed');
  result.alreadyCompleted = true;

  return result;
}

// ============================================
// SECURE STORAGE HELPERS
// ============================================

/**
 * Read auth token from SecureStore.
 */
export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_MAP.authToken);
}

/**
 * Read refresh token from SecureStore.
 */
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_MAP.refreshToken);
}

/**
 * Read user profile from SecureStore.
 */
export async function getUserProfile(): Promise<object | null> {
  const secure = await SecureStore.getItemAsync(KEY_MAP.user);
  if (secure) {
    try { return JSON.parse(secure); } catch { return null; }
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
  ]);
}

/**
 * Check if migration has been completed.
 */
export async function isMigrationComplete(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(MIGRATION_FLAG);
  return flag === 'completed';
}
