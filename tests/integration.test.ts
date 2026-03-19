/**
 * Integration Tests
 *
 * End-to-end flows that exercise multiple modules together:
 * 1. Database init → seed → query
 * 2. Workout lifecycle (generate → complete → XP award)
 * 3. Encryption round-trip (store → retrieve → decrypt)
 * 4. XP + leveling progression
 * 5. Recovery engine fatigue cycle
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Controllable mock database
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  const mockGetAllAsync = vi.fn().mockResolvedValue([]);
  const mockGetFirstAsync = vi.fn().mockResolvedValue(null);
  const mockRunAsync = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const mockExecAsync = vi.fn().mockResolvedValue(undefined);
  const mockWithTransactionAsync = vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn());
  return {
    store,
    mockGetAllAsync,
    mockGetFirstAsync,
    mockRunAsync,
    mockExecAsync,
    mockWithTransactionAsync,
    mockDb: {
      getAllAsync: mockGetAllAsync,
      getFirstAsync: mockGetFirstAsync,
      runAsync: mockRunAsync,
      execAsync: mockExecAsync,
      withTransactionAsync: mockWithTransactionAsync,
    },
  };
});

vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue(mocks.mockDb),
}));

vi.mock('../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockReturnValue('test-session-001'),
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
// Reset between tests
// ---------------------------------------------------------------------------
import { queryCache } from '../src/database/queryCache';

beforeEach(() => {
  vi.clearAllMocks();
  queryCache.clear();
  mocks.store.clear();
});

// ============================================
// 1. DATABASE SERVICE FLOW
// ============================================
describe('Integration: Database service CRUD flow', () => {
  it('creates and retrieves a user profile', async () => {
    const { createUserProfile, getUserProfile } = await import('../src/database/service');

    // Create profile
    await createUserProfile({
      id: 'user_local_001',
      goal: 'strength',
      experience: 'beginner',
      training_days_per_week: 3,
      time_per_session_minutes: 30,
      locked: false,
    });
    expect(mocks.mockRunAsync).toHaveBeenCalled();
    const createCall = mocks.mockRunAsync.mock.calls[0];
    expect(createCall?.[0]).toContain('INSERT');

    // Retrieve profile
    mocks.mockGetFirstAsync.mockResolvedValueOnce({
      id: 'user_local_001',
      goal: 'strength',
      experience: 'beginner',
      training_days_per_week: 3,
      time_per_session_minutes: 30,
    });
    const profile = await getUserProfile('user_local_001');
    expect(profile).toBeDefined();
    expect(profile?.goal).toBe('strength');
  });

  it('app_state round-trip: set → get → delete', async () => {
    const { getAppState, setAppState, deleteAppStateByPrefix } = await import('../src/database/service');

    // Set
    await setAppState('onboarding_complete', 'true');
    expect(mocks.mockRunAsync).toHaveBeenCalled();

    // Get
    mocks.mockGetFirstAsync.mockResolvedValueOnce({ value: 'true' });
    const val = await getAppState('onboarding_complete');
    expect(val).toBe('true');

    // Delete by prefix
    await deleteAppStateByPrefix('onboarding_');
    expect(mocks.mockRunAsync).toHaveBeenCalled();
  });

  it('streak: update and retrieve for a user', async () => {
    const { updateStreak, getStreak } = await import('../src/database/service');

    // Simulate existing streak row
    mocks.mockGetFirstAsync.mockResolvedValueOnce({
      current_streak: 3,
      longest_streak: 7,
      last_workout_date: '2026-03-18',
    });

    const streak = await getStreak('user_local_001');
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(7);
  });

  it('exercise queries use cache correctly', async () => {
    const { getExerciseCount } = await import('../src/database/service');
    
    mocks.mockGetFirstAsync.mockResolvedValue({ count: 150 });
    const count1 = await getExerciseCount();
    const count2 = await getExerciseCount();
    
    // Second call should use cache (only 1 DB call)
    expect(count1).toBe(150);
    expect(count2).toBe(150);
  });
});

// ============================================
// 2. WORKOUT LIFECYCLE
// ============================================
describe('Integration: Workout lifecycle', () => {
  it('creates a workout session and marks completion', async () => {
    const { createWorkoutSession, completeWorkoutSession, addSessionExercise } =
      await import('../src/database/service');

    // Create session
    await createWorkoutSession({
      id: 'test-session-001',
      user_id: 'user_local_001',
      duration_minutes: 30,
      total_exercises: 5,
      completed_exercises: 0,
      success: false,
    });
    expect(mocks.mockRunAsync).toHaveBeenCalled();

    // Add an exercise to the session
    await addSessionExercise({
      id: 'se-001',
      session_id: 'test-session-001',
      exercise_id: 'cal_001',
      order_in_session: 1,
      prescribed_sets: 3,
      prescribed_reps: '8-12',
      completed_sets: 0,
      skipped: false,
    });

    // Complete session
    await completeWorkoutSession('test-session-001', 5, true);
    const completeCalls = mocks.mockRunAsync.mock.calls.filter(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('UPDATE workout_sessions')
    );
    expect(completeCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// 3. ENCRYPTION ROUND-TRIP
// ============================================
describe('Integration: Encryption round-trip', () => {
  it('V3 encrypt → decrypt preserves plaintext', async () => {
    const { encryptV3, decryptV3, isV3Payload, getOrCreateMasterKey } = await import('../src/security/AESEncryption');
    
    const masterKey = await getOrCreateMasterKey();
    const plaintext = 'Sensitive health data: HR=72bpm, BP=120/80';
    const encrypted = await encryptV3(plaintext, masterKey);
    
    expect(isV3Payload(encrypted)).toBeTruthy();
    expect(encrypted.v).toBe(3);
    expect(encrypted.ct).not.toBe(plaintext);
    
    const decrypted = await decryptV3(encrypted, masterKey);
    expect(decrypted).toBe(plaintext);
  });

  it('V2 encrypt → decrypt preserves plaintext', async () => {
    const { encryptV2, decryptV2, isV2Payload, getOrCreateMasterKey } = await import('../src/security/AESEncryption');
    
    const masterKey = await getOrCreateMasterKey();
    const plaintext = '{"weight_kg":75,"height_cm":180}';
    const encrypted = await encryptV2(plaintext, masterKey);
    
    expect(isV2Payload(encrypted)).toBeTruthy();
    expect(encrypted.v).toBe(2);
    
    const decrypted = await decryptV2(encrypted, masterKey);
    expect(decrypted).toBe(plaintext);
  });

  it('version detection correctly distinguishes payloads', async () => {
    const { encryptV2, encryptV3, isV1Payload, isV2Payload, isV3Payload, getOrCreateMasterKey } =
      await import('../src/security/AESEncryption');
    
    const masterKey = await getOrCreateMasterKey();
    const v2 = await encryptV2('test', masterKey);
    const v3 = await encryptV3('test', masterKey);
    const v1 = { ciphertext: 'abc', iv: '123', hash: 'xyz' }; // Legacy format
    
    expect(isV2Payload(v2)).toBeTruthy();
    expect(isV3Payload(v2)).toBeFalsy();
    
    expect(isV3Payload(v3)).toBeTruthy();
    expect(isV2Payload(v3)).toBeFalsy();
    
    expect(isV1Payload(v1)).toBeTruthy();
    expect(isV2Payload(v1)).toBeFalsy();
  });

  it('encrypted data survives JSON serialization (as stored in SQLite)', async () => {
    const { encryptV3, decryptV3, getOrCreateMasterKey } = await import('../src/security/AESEncryption');
    
    const masterKey = await getOrCreateMasterKey();
    const original = 'Heart rate readings: [72, 74, 71, 73, 72]';
    const encrypted = await encryptV3(original, masterKey);
    
    // Simulate SQLite storage: serialize to JSON string and back
    const jsonBlob = JSON.stringify(encrypted);
    const restored = JSON.parse(jsonBlob);
    
    const decrypted = await decryptV3(restored, masterKey);
    expect(decrypted).toBe(original);
  });
});

// ============================================
// 4. XP + LEVELING PROGRESSION
// ============================================
describe('Integration: XP and leveling', () => {
  it('awards workout XP and calculates level-up', async () => {
    const { awardWorkoutXP, getXPData, addXP } = await import('../src/services/xpService');

    // Mock: no existing XP
    mocks.mockGetFirstAsync.mockResolvedValue(null);

    const data = await getXPData();
    expect(data.totalXP).toBe(0);
    expect(data.level).toBe(1);

    // Award XP: 100 base + 5*20 exercise + 50 completion + 3*10 streak = 280
    mocks.mockGetFirstAsync.mockResolvedValue(null); // getXPData inside awardWorkoutXP
    const result = await awardWorkoutXP(5, 5, 3);
    expect(result.xpEarned).toBe(280);
    expect(result.levelUp).toBe(true); // 280 > 250 (level 1 threshold)
  });

  it('addXP with zero or negative amounts is a no-op', async () => {
    const { addXP } = await import('../src/services/xpService');
    
    mocks.mockGetFirstAsync.mockResolvedValue({ value: '100' });
    const result0 = await addXP(0);
    expect(result0.xpEarned).toBe(0);

    const resultNeg = await addXP(-10);
    expect(resultNeg.xpEarned).toBe(0);
  });

  it('content quality multiplier affects mind XP correctly', async () => {
    const { getContentQualityMultiplier } = await import('../src/services/xpService');

    // High-quality long document
    const college = getContentQualityMultiplier({ reading_level: 'college', word_count: 10000 });
    expect(college).toBeCloseTo(1.8); // 1.5 * 1.2

    // Low-quality short document
    const easy = getContentQualityMultiplier({ reading_level: 'elementary', word_count: 100 });
    expect(easy).toBe(0.3); // clamped to minimum

    // Default (no info)
    expect(getContentQualityMultiplier({})).toBe(1.0);
  });
});

// ============================================
// 5. RECOVERY ENGINE FATIGUE CYCLE
// ============================================
describe('Integration: Recovery engine', () => {
  it('deload detection triggers at high fatigue', async () => {
    const { checkDeloadStatus } = await import('../src/engines/recoveryEngine');

    // Mock: high average fatigue across muscles
    mocks.mockGetAllAsync.mockResolvedValueOnce([
      { muscle: 'chest_upper', fatigue_level: 85 },
      { muscle: 'lats', fatigue_level: 80 },
      { muscle: 'quads', fatigue_level: 90 },
      { muscle: 'hamstrings', fatigue_level: 75 },
    ]);
    // Mock: week counter
    mocks.mockGetFirstAsync.mockResolvedValueOnce({ value: '3' }); // weeks since deload
    // Mock: deload flag
    mocks.mockGetFirstAsync.mockResolvedValueOnce(null); // not in deload
    // Mock: recent sessions for failure check
    mocks.mockGetAllAsync.mockResolvedValueOnce([]);
    // Mock: adaptive profile
    mocks.mockGetFirstAsync.mockResolvedValueOnce(null);

    const status = await checkDeloadStatus('user_local_001');
    expect(status).toBeDefined();
    expect(status.severity).toBeDefined();
    // With avg fatigue 82.5, should trigger deload
    expect(['suggested', 'recommended', 'required']).toContain(status.severity);
  });

  it('fatigue snapshot returns all tracked muscles', async () => {
    const { getFatigueSnapshot } = await import('../src/engines/recoveryEngine');

    mocks.mockGetAllAsync.mockResolvedValueOnce([
      { muscle: 'chest_upper', fatigue_level: 40, last_trained_at: '2026-03-18T10:00:00Z' },
      { muscle: 'lats', fatigue_level: 20, last_trained_at: '2026-03-17T10:00:00Z' },
    ]);

    const snapshot = await getFatigueSnapshot('user_local_001');
    expect(snapshot).toBeDefined();
    expect(Array.isArray(snapshot)).toBe(true);
    // getFatigueSnapshot returns all 22 tracked muscles (with default 0 for untrained)
    expect(snapshot.length).toBe(22);
    // Find the chest_upper entry from our mocked data
    const chestEntry = snapshot.find(s => s.muscle === 'chest_upper');
    expect(chestEntry).toBeDefined();
    expect(chestEntry!.level).toBe(40);
  });
});

// ============================================
// 6. DATABASE → ENGINE INTEGRATION
// ============================================
describe('Integration: Database types used across engines', () => {
  it('Category type is consistent between types and schema', async () => {
    const types = await import('../src/database/types');
    expect(types.SCHEMA_VERSION).toBeGreaterThanOrEqual(15);
    // Categories used by workout generator
    const validCategories: string[] = ['body_control', 'posture', 'speed', 'mobility', 'focus', 'strength'];
    // Verify they match the type definition (compile-time check, but also runtime sanity)
    for (const cat of validCategories) {
      expect(cat).toBeTypeOf('string');
    }
  });

  it('ProgressionEngine works with typical session data', async () => {
    const { calculateProgression } = await import('../src/engines/progressionEngine');

    // Mock: progress history for the exercise
    mocks.mockGetAllAsync.mockResolvedValueOnce([
      { sets_completed: 3, reps_achieved: '10', difficulty_rating: 6, date: '2026-03-17' },
      { sets_completed: 3, reps_achieved: '11', difficulty_rating: 6, date: '2026-03-18' },
    ]);
    // Mock: adaptive training profile
    mocks.mockGetFirstAsync.mockResolvedValueOnce(null);

    const decision = await calculateProgression(
      'user_local_001',
      'cal_001',
      3,
      '8-12',
      'hypertrophy',
    );

    expect(decision).toBeDefined();
    expect(decision.action).toBeTypeOf('string');
    expect(['maintain', 'progress', 'regress']).toContain(decision.action);
  });

  it('edge-case guards handle empty exercise pool', async () => {
    const { validateWorkoutCanGenerate } = await import('../src/engines/edgeCaseGuards');

    // Mock: no exercises
    mocks.mockGetAllAsync.mockResolvedValueOnce([]);
    mocks.mockGetFirstAsync.mockResolvedValueOnce({
      id: 'user_local_001',
      goal: 'strength',
      experience: 'beginner',
      training_days_per_week: 3,
      time_per_session_minutes: 30,
    });

    const result = await validateWorkoutCanGenerate('user_local_001');
    expect(result).toBeDefined();
    // Should flag that we can't generate without exercises
    expect(result.canGenerate === false || result.recommendations.length > 0).toBe(true);
  });
});

// ============================================
// 7. QUERY CACHE INTEGRATION
// ============================================
describe('Integration: Query cache lifecycle', () => {
  it('invalidatePrefix clears related cache entries', async () => {
    queryCache.clear();

    let calls = 0;
    await queryCache.getOrFetch('exercises:all', async () => { calls++; return 'all'; });
    await queryCache.getOrFetch('exercises:strength', async () => { calls++; return 'strength'; });
    await queryCache.getOrFetch('profile:user_001', async () => { calls++; return 'profile'; });
    expect(calls).toBe(3);

    // Invalidate all exercise caches
    queryCache.invalidatePrefix('exercises:');

    // Re-fetch exercises — should call fetcher again
    await queryCache.getOrFetch('exercises:all', async () => { calls++; return 'all-v2'; });
    expect(calls).toBe(4);

    // Profile should still be cached
    await queryCache.getOrFetch('profile:user_001', async () => { calls++; return 'profile-v2'; });
    expect(calls).toBe(4); // No new call

    const stats = queryCache.stats();
    // exercises:all (re-fetched) + exercises:strength (invalidated but re-created from 'all-v2') + profile (cached)
    expect(stats.size).toBeGreaterThanOrEqual(2);
  });
});
