/**
 * Screen Smoke Tests
 *
 * Since screens depend on React Native runtime (hooks, JSX, navigation),
 * we can't render them in Vitest. Instead we verify:
 * 1. Each screen module can be statically analysed (no top-level crashes)
 * 2. Key non-React exports are accessible
 * 3. Critical service functions used by screens are callable
 *
 * This catches import-time errors like the ACCENT_AMBER crash.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock database (screens use DatabaseContext → service.ts)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  mockDb: {
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    runAsync: vi.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 }),
    execAsync: vi.fn().mockResolvedValue(undefined),
    withTransactionAsync: vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
  },
}));

vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue(mocks.mockDb),
}));

vi.mock('../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockReturnValue('test-id-001'),
}));

vi.mock('../src/services/telemetry', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
  logPerf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/rankingService', () => ({
  getXPMultiplier: vi.fn().mockReturnValue(1.0),
  checkMilestoneReached: vi.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Screen module smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Service layer (used by all screens)', () => {
    it('database/service exports all CRUD functions', async () => {
      const svc = await import('../src/database/service');

      // Core exercise queries
      expect(svc.getExercises).toBeTypeOf('function');
      expect(svc.getExerciseById).toBeTypeOf('function');
      expect(svc.getExercisesByCategory).toBeTypeOf('function');
      expect(svc.getExercisesByMuscle).toBeTypeOf('function');
      expect(svc.getExerciseCount).toBeTypeOf('function');

      // Profile
      expect(svc.getUserProfile).toBeTypeOf('function');
      expect(svc.createUserProfile).toBeTypeOf('function');
      expect(svc.updateUserProfile).toBeTypeOf('function');

      // Workout sessions
      expect(svc.createWorkoutSession).toBeTypeOf('function');
      expect(svc.completeWorkoutSession).toBeTypeOf('function');
      expect(svc.getRecentSessions).toBeTypeOf('function');

      // Streaks & progress
      expect(svc.updateStreak).toBeTypeOf('function');
      expect(svc.getStreak).toBeTypeOf('function');
      expect(svc.recordProgress).toBeTypeOf('function');

      // Fatigue
      expect(svc.getMuscleFatigue).toBeTypeOf('function');
      expect(svc.updateMuscleFatigue).toBeTypeOf('function');

      // App state
      expect(svc.getAppState).toBeTypeOf('function');
      expect(svc.setAppState).toBeTypeOf('function');

      // FitMind
      expect(svc.addFitMindDocument).toBeTypeOf('function');
      expect(svc.getFitMindDocuments).toBeTypeOf('function');
      expect(svc.addFitMindFlashcard).toBeTypeOf('function');

      // Encrypted rows
      expect(svc.insertEncryptedHealthRow).toBeTypeOf('function');
      expect(svc.getEncryptedHealthRow).toBeTypeOf('function');

      // Data deletion
      expect(svc.deleteAllUserData).toBeTypeOf('function');
    });

    it('database/service: getAppState returns null for unknown key', async () => {
      mocks.mockDb.getFirstAsync.mockResolvedValueOnce(null);
      const { getAppState } = await import('../src/database/service');
      const val = await getAppState('nonexistent_key');
      expect(val).toBeNull();
    });

    it('database/service: setAppState persists a value', async () => {
      const { setAppState } = await import('../src/database/service');
      await setAppState('test_key', 'test_value');
      expect(mocks.mockDb.runAsync).toHaveBeenCalled();
    });

    it('database/service: getUserProfile returns null when no profile', async () => {
      mocks.mockDb.getFirstAsync.mockResolvedValueOnce(null);
      const { getUserProfile } = await import('../src/database/service');
      const profile = await getUserProfile('user_local_001');
      expect(profile).toBeNull();
    });

    it('database/service: getStreak returns zero for new user', async () => {
      mocks.mockDb.getFirstAsync.mockResolvedValueOnce(null);
      const { getStreak } = await import('../src/database/service');
      const streak = await getStreak('user_local_001');
      expect(streak).toEqual({ current: 0, longest: 0 });
    });
  });

  describe('Engine barrel exports', () => {
    it('engines/index exports all three engine interfaces', async () => {
      const eng = await import('../src/engines/index');

      // Workout generator
      expect(eng.generateWorkout).toBeTypeOf('function');
      expect(eng.createWorkout).toBeTypeOf('function');

      // Progression
      expect(eng.calculateProgression).toBeTypeOf('function');
      expect(eng.recordSessionPerformance).toBeTypeOf('function');

      // Recovery
      expect(eng.getFatigueSnapshot).toBeTypeOf('function');
      expect(eng.checkDeloadStatus).toBeTypeOf('function');
      expect(eng.applyDailyRecoveryTick).toBeTypeOf('function');

      // Guards
      expect(eng.validateWorkoutCanGenerate).toBeTypeOf('function');
      expect(eng.getEmergencyFallbackExercise).toBeTypeOf('function');

      // Transparency
      expect(eng.generateWorkoutSummary).toBeTypeOf('function');

      // State reset
      expect(eng.executeStateReset).toBeTypeOf('function');

      // Unified flow
      expect(eng.startWorkoutSession).toBeTypeOf('function');
      expect(eng.completeSession).toBeTypeOf('function');
    });
  });

  describe('XP service (used by dashboard + workout)', () => {
    it('exports all XP functions', async () => {
      const xp = await import('../src/services/xpService');
      expect(xp.getXPData).toBeTypeOf('function');
      expect(xp.awardWorkoutXP).toBeTypeOf('function');
      expect(xp.awardStepXP).toBeTypeOf('function');
      expect(xp.awardJogXP).toBeTypeOf('function');
      expect(xp.addXP).toBeTypeOf('function');
      expect(xp.getContentQualityMultiplier).toBeTypeOf('function');
      expect(xp.getMindXPData).toBeTypeOf('function');
    });

    it('getContentQualityMultiplier returns sensible values', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      expect(getContentQualityMultiplier({})).toBe(1.0);
      expect(getContentQualityMultiplier({ reading_level: 'college', word_count: 6000 })).toBe(1.5 * 1.2);
      expect(getContentQualityMultiplier({ reading_level: 'elementary', word_count: 200 })).toBe(0.3); // clamped min
    });
  });

  describe('Theme system (used by every screen)', () => {
    it('exports all three themes with correct structure', async () => {
      const t = await import('../src/design/theme-system');

      for (const theme of [t.darkTheme, t.lightTheme, t.blackGoldTheme]) {
        expect(theme.colors).toBeDefined();
        expect(theme.colors.background).toBeTypeOf('string');
        expect(theme.colors.text).toBeTypeOf('string');
        expect(theme.colors.accent).toBeTypeOf('string');

        // Spacing uses numeric keys
        expect(theme.spacing[0]).toBe(0);
        expect(theme.spacing[1]).toBe(4);
        expect(theme.spacing[4]).toBe(16);

        // Border radius uses named keys
        expect(theme.borderRadius.sm).toBeTypeOf('number');
        expect(theme.borderRadius.lg).toBeTypeOf('number');
        expect(theme.borderRadius.full).toBeTypeOf('number');
      }
    });

    it('dark theme has correct accent and background', async () => {
      const { darkTheme } = await import('../src/design/theme-system');
      expect(darkTheme.colors.accent).toBe('#10B981');
      expect(darkTheme.colors.background).toBeTypeOf('string');
    });
  });

  describe('Security modules', () => {
    it('AES encryption exports v2 and v3 interfaces', async () => {
      const aes = await import('../src/security/AESEncryption');
      expect(aes.encryptV2).toBeTypeOf('function');
      expect(aes.encryptV3).toBeTypeOf('function');
      expect(aes.decryptV2).toBeTypeOf('function');
      expect(aes.decryptV3).toBeTypeOf('function');
      expect(aes.isV1Payload).toBeTypeOf('function');
      expect(aes.isV2Payload).toBeTypeOf('function');
      expect(aes.isV3Payload).toBeTypeOf('function');
      expect(aes.getOrCreateMasterKey).toBeTypeOf('function');
    });

    it('EncryptedDatabase exports singleton with methods', async () => {
      const { encryptedDB } = await import('../src/security/EncryptedDatabase');
      expect(encryptedDB).toBeDefined();
      expect(encryptedDB.initialize).toBeTypeOf('function');
      expect(encryptedDB.storeHealthData).toBeTypeOf('function');
      expect(encryptedDB.getHealthData).toBeTypeOf('function');
      expect(encryptedDB.storeAIConversation).toBeTypeOf('function');
      expect(encryptedDB.createHealthAlert).toBeTypeOf('function');
    });

    it('BiometricAuth exports service class', async () => {
      const { BiometricAuthService } = await import('../src/security/BiometricAuth');
      expect(BiometricAuthService).toBeDefined();
      expect(BiometricAuthService.prototype.authenticate).toBeTypeOf('function');
    });
  });

  describe('FitMind modules', () => {
    it('FitMindService exports CRUD class', async () => {
      const { FitMindService } = await import('../src/fitmind/schema');
      expect(FitMindService).toBeDefined();
      expect(FitMindService.addDocument).toBeTypeOf('function');
      expect(FitMindService.getDocuments).toBeTypeOf('function');
    });

    it('DualAIEngine exports singleton', async () => {
      const { dualAI } = await import('../src/fitmind/DualAIEngine');
      expect(dualAI).toBeDefined();
      expect(dualAI.query).toBeTypeOf('function');
    });
  });

  describe('Database types & schema version', () => {
    it('SCHEMA_VERSION is current', async () => {
      const { SCHEMA_VERSION } = await import('../src/database/types');
      expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(15);
    });

    it('QueryCache works correctly', async () => {
      const { queryCache } = await import('../src/database/queryCache');
      queryCache.clear();

      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return 'result';
      };

      const r1 = await queryCache.getOrFetch('test-key', fetcher);
      const r2 = await queryCache.getOrFetch('test-key', fetcher);
      expect(r1).toBe('result');
      expect(r2).toBe('result');
      expect(callCount).toBe(1); // Second call used cache

      queryCache.invalidate('test-key');
      const r3 = await queryCache.getOrFetch('test-key', fetcher);
      expect(r3).toBe('result');
      expect(callCount).toBe(2); // Re-fetched after invalidation
    });
  });
});
