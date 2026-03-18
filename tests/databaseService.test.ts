import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock expo-sqlite (already aliased) — override with controllable return values
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const mockGetAllAsync = vi.fn().mockResolvedValue([]);
  const mockGetFirstAsync = vi.fn().mockResolvedValue(null);
  const mockRunAsync = vi.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
  const mockExecAsync = vi.fn().mockResolvedValue(undefined);
  const mockWithTransactionAsync = vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn());
  return {
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
  generateSecureId: vi.fn().mockReturnValue('test-id-001'),
}));

// Mock telemetry chain
vi.mock('../src/services/telemetry', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
  logPerf: vi.fn().mockResolvedValue(undefined),
}));

import {
  getAppState,
  setAppState,
  getUserProfile,
  createUserProfile,
  updateStreak,
  getStreak,
  getExerciseCount,
  deleteAppStateByPrefix,
} from '../src/database/service';

// Import queryCache so we can clear it between tests
import { queryCache } from '../src/database/queryCache';

describe('Database Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryCache.clear();
    mocks.mockGetAllAsync.mockResolvedValue([]);
    mocks.mockGetFirstAsync.mockResolvedValue(null);
    mocks.mockRunAsync.mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
  });

  describe('App State', () => {
    it('getAppState returns value when key exists', async () => {
      mocks.mockGetFirstAsync.mockResolvedValue({ value: 'hello' });
      const result = await getAppState('test_key');
      expect(result).toBe('hello');
      expect(mocks.mockGetFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('app_state'),
        expect.arrayContaining(['test_key']),
      );
    });

    it('getAppState returns null when key missing', async () => {
      mocks.mockGetFirstAsync.mockResolvedValue(null);
      const result = await getAppState('missing_key');
      expect(result).toBeNull();
    });

    it('setAppState upserts a key-value pair', async () => {
      await setAppState('my_key', 'my_value');
      expect(mocks.mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('app_state'),
        expect.arrayContaining(['my_key', 'my_value']),
      );
    });

    it('deleteAppStateByPrefix removes matching keys', async () => {
      await deleteAppStateByPrefix('xp_');
      expect(mocks.mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        expect.arrayContaining(['xp_%']),
      );
    });
  });

  describe('User Profile', () => {
    it('getUserProfile returns null for non-existent user', async () => {
      mocks.mockGetFirstAsync.mockResolvedValue(null);
      const profile = await getUserProfile('user_nonexistent');
      expect(profile).toBeNull();
    });

    it('getUserProfile returns profile data', async () => {
      mocks.mockGetFirstAsync.mockResolvedValue({
        id: 'user_local_001',
        sex: 'male',
        weight_kg: 80,
        height_cm: 180,
        goal: 'strength',
        experience: 'intermediate',
        training_days_per_week: 4,
        time_per_session_minutes: 45,
        locked: 0,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      });
      const profile = await getUserProfile('user_local_001');
      expect(profile).not.toBeNull();
      expect(profile!.id).toBe('user_local_001');
      expect(profile!.goal).toBe('strength');
    });

    it('createUserProfile inserts profile row', async () => {
      await createUserProfile({
        id: 'user_local_001',
        sex: 'male',
        weight_kg: 75,
        height_cm: 175,
        goal: 'body_control',
        experience: 'beginner',
        training_days_per_week: 3,
        time_per_session_minutes: 30,
        locked: false,
      });
      expect(mocks.mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining(['user_local_001']),
      );
    });
  });

  describe('Streaks', () => {
    it('getStreak returns defaults when no streak exists', async () => {
      mocks.mockGetFirstAsync.mockResolvedValue(null);
      const streak = await getStreak('user_local_001');
      expect(streak).toEqual({ current: 0, longest: 0 });
    });

    it('getStreak returns current and longest values', async () => {
      mocks.mockGetFirstAsync.mockResolvedValue({
        current_streak: 5,
        longest_streak: 10,
        last_workout_date: '2025-01-15',
      });
      const streak = await getStreak('user_local_001');
      expect(streak.current).toBe(5);
      expect(streak.longest).toBe(10);
    });
  });

  describe('Exercise Count', () => {
    it('returns exercise count from database', async () => {
      mocks.mockGetFirstAsync.mockResolvedValue({ count: 438 });
      const count = await getExerciseCount();
      expect(count).toBe(438);
    });

    it('returns 0 when database is empty', async () => {
      mocks.mockGetFirstAsync.mockResolvedValue({ count: 0 });
      const count = await getExerciseCount();
      expect(count).toBe(0);
    });
  });
});

describe('QueryCache', () => {
  beforeEach(() => {
    queryCache.clear();
  });

  it('caches and returns fetched values', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return 'result';
    };
    const v1 = await queryCache.getOrFetch('key1', fetcher);
    const v2 = await queryCache.getOrFetch('key1', fetcher);
    expect(v1).toBe('result');
    expect(v2).toBe('result');
    expect(callCount).toBe(1); // fetcher called only once
  });

  it('invalidates specific key', async () => {
    let callCount = 0;
    const fetcher = async () => ++callCount;
    await queryCache.getOrFetch('key1', fetcher);
    queryCache.invalidate('key1');
    await queryCache.getOrFetch('key1', fetcher);
    expect(callCount).toBe(2);
  });

  it('invalidates by prefix', async () => {
    let count = 0;
    const fetcher = async () => ++count;
    await queryCache.getOrFetch('exercises:all', fetcher);
    await queryCache.getOrFetch('exercises:category', fetcher);
    await queryCache.getOrFetch('profile:user1', fetcher);
    queryCache.invalidatePrefix('exercises:');
    // exercises keys should be cleared, profile should remain
    const stats = queryCache.stats();
    expect(stats.size).toBe(1);
    expect(stats.keys).toContain('profile:user1');
  });

  it('expires entries after TTL', async () => {
    let count = 0;
    const fetcher = async () => ++count;
    await queryCache.getOrFetch('ttl-key', fetcher, 1); // 1ms TTL
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 5));
    await queryCache.getOrFetch('ttl-key', fetcher, 1);
    expect(count).toBe(2);
  });

  it('clear removes all entries', async () => {
    await queryCache.getOrFetch('a', async () => 1);
    await queryCache.getOrFetch('b', async () => 2);
    queryCache.clear();
    expect(queryCache.stats().size).toBe(0);
  });
});
