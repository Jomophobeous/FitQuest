/**
 * Smoke Test Utilities
 *
 * Lightweight runtime checks to verify critical app pathways are functional.
 * Can be triggered manually via developer tools or automated in CI.
 *
 * Each test returns a simple pass/fail with optional details.
 * Tests are designed to be non-destructive and fast (<2s each).
 */

import { Platform } from 'react-native';
import { featureFlags, FEATURE_FLAGS } from './featureFlags';

// ============================================
// TYPES
// ============================================

export interface SmokeTestResult {
  name: string;
  group: SmokeTestGroup;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

export type SmokeTestGroup = 'reader' | 'workout' | 'health' | 'auth' | 'database' | 'navigation';

type SmokeTest = () => Promise<SmokeTestResult>;

// ============================================
// TEST REGISTRY
// ============================================

const smokeTests: Map<string, { group: SmokeTestGroup; test: SmokeTest }> = new Map();

function registerTest(name: string, group: SmokeTestGroup, test: () => Promise<boolean | { passed: boolean; details?: string }>) {
  smokeTests.set(name, {
    group,
    test: async () => {
      const start = Date.now();
      try {
        const result = await test();
        const passed = typeof result === 'boolean' ? result : result.passed;
        const details = typeof result === 'object' ? result.details : undefined;
        return {
          name,
          group,
          passed,
          durationMs: Date.now() - start,
          details,
        };
      } catch (err) {
        return {
          name,
          group,
          passed: false,
          durationMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });
}

// ============================================
// DATABASE TESTS
// ============================================

registerTest('database_connection', 'database', async () => {
  const { getDatabase } = await import('../database/schema');
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ one: number }>('SELECT 1 as one');
  return result?.one === 1;
});

registerTest('database_schema_version', 'database', async () => {
  const { getAppState } = await import('../database/service');
  const version = await getAppState('schema_version');
  return {
    passed: version !== null && parseInt(version, 10) >= 9,
    details: `Schema version: ${version}`,
  };
});

registerTest('database_exercises_seeded', 'database', async () => {
  const { getExercises } = await import('../database/service');
  const exercises = await getExercises();
  return {
    passed: exercises.length > 0,
    details: `${exercises.length} exercises available`,
  };
});

// ============================================
// WORKOUT TESTS
// ============================================

registerTest('workout_generator_import', 'workout', async () => {
  const { generateWorkout } = await import('../engines/workoutGenerator');
  return typeof generateWorkout === 'function';
});

registerTest('workout_generator_basic', 'workout', async () => {
  const { generateWorkout } = await import('../engines/workoutGenerator');
  const workout = await generateWorkout('user_local_001', false);
  const exerciseCount = workout?.exercises?.length ?? 0;
  return {
    passed: workout !== null && exerciseCount > 0,
    details: `Generated ${exerciseCount} exercises`,
  };
});

// ============================================
// HEALTH TESTS
// ============================================

registerTest('health_engine_import', 'health', async () => {
  const { backgroundHealth } = await import('../engines/BackgroundHealthEngine');
  return backgroundHealth !== null && typeof backgroundHealth.getState === 'function';
});

registerTest('health_adapters_factory', 'health', async () => {
  const { healthAdapterFactory } = await import('./healthAdapters');
  return healthAdapterFactory !== null;
});

registerTest('health_encrypted_db', 'health', async () => {
  const { encryptedDB } = await import('../security/EncryptedDatabase');
  return encryptedDB !== null && typeof encryptedDB.storeHealthData === 'function';
});

// ============================================
// AUTH TESTS
// ============================================

registerTest('auth_biometric_import', 'auth', async () => {
  const { BiometricAuthService } = await import('../security/BiometricAuth');
  const instance = BiometricAuthService.getInstance();
  return instance !== null;
});

registerTest('auth_secure_store', 'auth', async () => {
  const SecureStore = await import('expo-secure-store');
  // Just check module loads - don't read/write values
  return typeof SecureStore.getItemAsync === 'function';
});

// ============================================
// READER TESTS
// ============================================

registerTest('reader_fitmind_service', 'reader', async () => {
  const { FitMindService } = await import('../fitmind/schema');
  return FitMindService !== null;
});

registerTest('reader_document_processor', 'reader', async () => {
  const { DocumentProcessor } = await import('../fitmind/DocumentProcessor');
  return DocumentProcessor !== null;
});

registerTest('reader_dual_ai_engine', 'reader', async () => {
  const { dualAI } = await import('../fitmind/DualAIEngine');
  return dualAI !== null && typeof dualAI.query === 'function';
});

// ============================================
// NAVIGATION TESTS
// ============================================

registerTest('navigation_expo_router', 'navigation', async () => {
  const Router = await import('expo-router');
  return typeof Router.useRouter === 'function';
});

// ============================================
// RUNNER
// ============================================

export async function runSmokeTests(options?: {
  groups?: SmokeTestGroup[];
  names?: string[];
}): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: SmokeTestResult[];
  durationMs: number;
}> {
  const start = Date.now();
  const results: SmokeTestResult[] = [];

  // Check if smoke test mode is enabled (via feature flag)
  await featureFlags.initialize();
  const isSmokeTestMode = featureFlags.isEnabled(FEATURE_FLAGS.SMOKE_TEST_MODE);

  // In production without smoke test mode, skip destructive tests
  if (!__DEV__ && !isSmokeTestMode) {
    console.log('[SmokeTest] Skipping tests - not in dev mode and SMOKE_TEST_MODE flag is disabled');
    return { total: 0, passed: 0, failed: 0, results: [], durationMs: 0 };
  }

  for (const [name, { group, test }] of smokeTests.entries()) {
    // Filter by groups if specified
    if (options?.groups && !options.groups.includes(group)) continue;
    // Filter by names if specified
    if (options?.names && !options.names.includes(name)) continue;

    const result = await test();
    results.push(result);

    if (__DEV__) {
      console.log(
        `[SmokeTest] ${result.passed ? '✓' : '✗'} ${name} (${result.durationMs}ms)${result.error ? ` - ${result.error}` : ''}${result.details ? ` - ${result.details}` : ''}`
      );
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
    durationMs: Date.now() - start,
  };
}

/**
 * Run all smoke tests for a specific group
 */
export async function runGroupSmokeTests(group: SmokeTestGroup): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: SmokeTestResult[];
}> {
  const result = await runSmokeTests({ groups: [group] });
  return result;
}

/**
 * Quick health check - runs minimal critical tests
 */
export async function quickHealthCheck(): Promise<boolean> {
  const critical = await runSmokeTests({
    names: ['database_connection', 'database_exercises_seeded', 'workout_generator_import'],
  });
  return critical.failed === 0;
}

/**
 * Get list of registered test names by group
 */
export function getRegisteredTests(): Record<SmokeTestGroup, string[]> {
  const result: Record<SmokeTestGroup, string[]> = {
    reader: [],
    workout: [],
    health: [],
    auth: [],
    database: [],
    navigation: [],
  };

  for (const [name, { group }] of smokeTests.entries()) {
    result[group].push(name);
  }

  return result;
}
