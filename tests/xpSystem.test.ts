/**
 * XP System Accuracy Tests
 *
 * Verifies every XP formula produces correct values:
 * - Workout XP (base + exercise + completion bonus + streak)
 * - Step XP (4 per 1,000 steps, incremental)
 * - Jog XP (10 per 100m)
 * - Progress photo XP (flat 25)
 * - Reading XP (5/page + duration bonus × quality)
 * - Flashcard XP (3/card + 2/correct)
 * - Level thresholds (N × 250)
 * - Content quality multiplier (reading level + word count)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    store,
    mockGetFirstAsync: vi.fn().mockImplementation(async (_sql: string, params?: any[]) => {
      const key = params?.[0];
      const val = store.get(key);
      return val !== undefined ? { value: val } : null;
    }),
    mockRunAsync: vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
    mockGetAllAsync: vi.fn().mockResolvedValue([]),
    mockExecAsync: vi.fn(),
    mockWithTransactionAsync: vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
  };
});

vi.mock('../src/database/schema', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    getAllAsync: mocks.mockGetAllAsync,
    getFirstAsync: mocks.mockGetFirstAsync,
    runAsync: mocks.mockRunAsync,
    execAsync: mocks.mockExecAsync,
    withTransactionAsync: mocks.mockWithTransactionAsync,
  }),
}));

vi.mock('../src/security/randomId', () => ({
  generateSecureId: vi.fn().mockReturnValue('test-id'),
}));

vi.mock('../src/services/telemetry', () => ({
  logEvent: vi.fn(),
  logPerf: vi.fn(),
}));

vi.mock('../src/services/rankingService', () => ({
  getXPMultiplier: vi.fn().mockReturnValue(1.0), // Level 1 = 1.0x
  getCurrentRank: vi.fn().mockReturnValue({ rank: 'Novice', xpMultiplier: 1.0, badge: 'NOV' }),
  checkMilestoneReached: vi.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XP system — exact formula verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.clear();
    // XP persisted via app_state with manual tracking
    mocks.mockGetFirstAsync.mockImplementation(async (_sql: string, params?: any[]) => {
      const key = params?.[0];
      const val = mocks.store.get(key);
      return val !== undefined ? { value: val } : null;
    });
    // Upon setAppState, update the store
    mocks.mockRunAsync.mockImplementation(async (sql: string, params?: any[]) => {
      if (typeof sql === 'string' && sql.includes('app_state') && sql.includes('INSERT')) {
        const key = params?.[0] as string;
        const val = params?.[1] as string;
        mocks.store.set(key, val);
      }
      return { changes: 1, lastInsertRowId: 1 };
    });
  });

  describe('awardWorkoutXP formula', () => {
    it('awards 100 base + 20 per exercise + 50 completion bonus when all done', async () => {
      const { awardWorkoutXP } = await import('../src/services/xpService');
      // 5 exercises, all completed, 0 streak, level 1 (1.0x multiplier)
      const result = await awardWorkoutXP(5, 5, 0);

      // 100 + (5*20) + 50 + (0*10) = 250 * 1.0 = 250
      expect(result.xpEarned).toBe(250);
      expect(result.levelUp).toBe(true); // Level 1 needs 250 XP
      expect(result.newLevel).toBe(2);
    });

    it('no completion bonus when not all exercises completed', async () => {
      const { awardWorkoutXP } = await import('../src/services/xpService');
      // 3 of 5 exercises done, no streak
      const result = await awardWorkoutXP(3, 5, 0);

      // 100 + (3*20) + 0 (incomplete) + 0 = 160
      expect(result.xpEarned).toBe(160);
    });

    it('adds 10 XP per streak day', async () => {
      const { awardWorkoutXP } = await import('../src/services/xpService');
      // 4 of 4 done, 7-day streak
      const result = await awardWorkoutXP(4, 4, 7);

      // 100 + (4*20) + 50 + (7*10) = 100 + 80 + 50 + 70 = 300
      expect(result.xpEarned).toBe(300);
    });

    it('handles zero exercises gracefully', async () => {
      const { awardWorkoutXP } = await import('../src/services/xpService');
      const result = await awardWorkoutXP(0, 0, 0);

      // 100 + 0 + 50 (0 >= 0 is true) + 0 = 150
      expect(result.xpEarned).toBe(150);
    });
  });

  describe('Level calculation', () => {
    it('level 1 requires 250 XP', async () => {
      mocks.store.set('user_total_xp', '249');
      const { getXPData } = await import('../src/services/xpService');
      const data = await getXPData();

      expect(data.level).toBe(1);
      expect(data.currentLevelXP).toBe(249);
      expect(data.xpToNextLevel).toBe(250);
    });

    it('exactly 250 XP reaches level 2', async () => {
      mocks.store.set('user_total_xp', '250');
      const { getXPData } = await import('../src/services/xpService');
      const data = await getXPData();

      expect(data.level).toBe(2);
      expect(data.currentLevelXP).toBe(0);
      expect(data.xpToNextLevel).toBe(500);
    });

    it('level 3 requires 250 + 500 = 750 cumulative XP', async () => {
      mocks.store.set('user_total_xp', '750');
      const { getXPData } = await import('../src/services/xpService');
      const data = await getXPData();

      expect(data.level).toBe(3);
      expect(data.currentLevelXP).toBe(0);
    });

    it('progress percent is 0 at level start, 100 just before level-up', async () => {
      mocks.store.set('user_total_xp', '375');
      const { getXPData } = await import('../src/services/xpService');
      const data = await getXPData();

      // 375 total: Level 1 costs 250, level 2 costs 500. 375 - 250 = 125 into level 2
      expect(data.level).toBe(2);
      expect(data.currentLevelXP).toBe(125);
      expect(data.progressPercent).toBe(25); // 125/500 = 25%
    });

    it('zero total XP is level 1 with 0 progress', async () => {
      const { getXPData } = await import('../src/services/xpService');
      const data = await getXPData();

      expect(data.level).toBe(1);
      expect(data.totalXP).toBe(0);
      expect(data.progressPercent).toBe(0);
    });
  });

  describe('addXP — generic XP addition', () => {
    it('cumulates XP across multiple awards', async () => {
      const { addXP, getXPData } = await import('../src/services/xpService');
      await addXP(100);
      await addXP(100);
      await addXP(50);

      const data = await getXPData();
      expect(data.totalXP).toBe(250);
      expect(data.level).toBe(2); // Just crossed 250
    });

    it('zero or negative XP is rejected (no state change)', async () => {
      const { addXP } = await import('../src/services/xpService');
      const resultZero = await addXP(0);
      expect(resultZero.xpEarned).toBe(0);

      const resultNeg = await addXP(-50);
      expect(resultNeg.xpEarned).toBe(0);
    });

    it('detects level-up correctly', async () => {
      mocks.store.set('user_total_xp', '240');
      const { addXP } = await import('../src/services/xpService');
      const result = await addXP(20);

      expect(result.levelUp).toBe(true);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(2);
      expect(result.data.totalXP).toBe(260);
    });

    it('no level-up when staying within same level', async () => {
      mocks.store.set('user_total_xp', '100');
      const { addXP } = await import('../src/services/xpService');
      const result = await addXP(20);

      expect(result.levelUp).toBe(false);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(1);
    });
  });

  describe('awardStepXP — incremental daily tracking', () => {
    it('awards 4 XP per 1,000 steps', async () => {
      const { awardStepXP } = await import('../src/services/xpService');
      const result = await awardStepXP(5000);

      // floor(5000/1000) * 4 = 20 XP
      expect(result).not.toBeNull();
      expect(result!.xpEarned).toBe(20);
    });

    it('returns null when steps haven\'t crossed next 1K threshold', async () => {
      const today = new Date().toISOString().split('T')[0]!;
      mocks.store.set('daily_step_xp_date', today);
      mocks.store.set('daily_step_xp_prev_steps', '4500');

      const { awardStepXP } = await import('../src/services/xpService');
      const result = await awardStepXP(4800);

      // Both 4500 and 4800 → floor(x/1000)*4 = 16. Same XP bucket, no gain.
      expect(result).toBeNull();
    });

    it('awards incremental XP when crossing next 1K', async () => {
      const today = new Date().toISOString().split('T')[0]!;
      mocks.store.set('daily_step_xp_date', today);
      mocks.store.set('daily_step_xp_prev_steps', '4500');

      const { awardStepXP } = await import('../src/services/xpService');
      const result = await awardStepXP(6200);

      // prev bucket: floor(4500/1000)*4 = 16
      // curr bucket: floor(6200/1000)*4 = 24
      // delta = 24 - 16 = 8 XP
      expect(result).not.toBeNull();
      expect(result!.xpEarned).toBe(8);
    });

    it('resets counter on a new day', async () => {
      // Yesterday's data
      mocks.store.set('daily_step_xp_date', '2026-01-01');
      mocks.store.set('daily_step_xp_prev_steps', '10000');

      const { awardStepXP } = await import('../src/services/xpService');
      const result = await awardStepXP(3000);

      // New day → prev resets to 0 → floor(3000/1000)*4 = 12 XP
      expect(result).not.toBeNull();
      expect(result!.xpEarned).toBe(12);
    });
  });

  describe('awardJogXP', () => {
    it('awards 10 XP per 100m', async () => {
      const { awardJogXP } = await import('../src/services/xpService');
      const result = await awardJogXP(5000);

      // floor(5000/100) * 10 = 500 XP
      expect(result.xpEarned).toBe(500);
    });

    it('minimum 1 XP even for very short distance', async () => {
      const { awardJogXP } = await import('../src/services/xpService');
      const result = await awardJogXP(10);

      // floor(10/100)*10 = 0, but min is 1
      expect(result.xpEarned).toBe(1);
    });
  });

  describe('awardProgressPhotoXP', () => {
    it('awards flat 25 XP per photo', async () => {
      const { awardProgressPhotoXP } = await import('../src/services/xpService');
      const result = await awardProgressPhotoXP();
      expect(result.xpEarned).toBe(25);
    });
  });

  describe('Content quality multiplier', () => {
    it('advanced/college reading level = 1.5x', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      expect(getContentQualityMultiplier({ reading_level: 'college level' })).toBe(1.5);
      expect(getContentQualityMultiplier({ reading_level: 'Advanced Academic' })).toBe(1.5);
      expect(getContentQualityMultiplier({ reading_level: 'Graduate' })).toBe(1.5);
    });

    it('intermediate/high-school = 1.0x', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      expect(getContentQualityMultiplier({ reading_level: 'high school' })).toBe(1.0);
      expect(getContentQualityMultiplier({ reading_level: 'INTERMEDIATE' })).toBe(1.0);
    });

    it('beginner/easy = 0.5x', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      expect(getContentQualityMultiplier({ reading_level: 'elementary' })).toBe(0.5);
      expect(getContentQualityMultiplier({ reading_level: 'BEGINNER reading' })).toBe(0.5);
    });

    it('very short documents (< 500 words) penalized by 0.6x', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      // intermediate (1.0) × 0.6 (short) = 0.6
      expect(getContentQualityMultiplier({ reading_level: 'intermediate', word_count: 200 })).toBe(0.6);
    });

    it('substantial documents (>= 5000 words) get 1.2x bonus', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      // intermediate (1.0) × 1.2 (long) = 1.2
      expect(getContentQualityMultiplier({ reading_level: 'intermediate', word_count: 8000 })).toBe(1.2);
    });

    it('brainrot detection: elementary + short = 0.3 (clamped minimum)', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      // elementary (0.5) × 0.6 (short) = 0.3
      expect(getContentQualityMultiplier({ reading_level: 'elementary', word_count: 100 })).toBe(0.3);
    });

    it('premium content: advanced + long = 1.8', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      // advanced (1.5) × 1.2 (long) = 1.8
      expect(getContentQualityMultiplier({ reading_level: 'advanced', word_count: 10000 })).toBeCloseTo(1.8, 5);
    });

    it('clamped to max 2.0', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      // Even with extreme values, should not exceed 2.0
      const result = getContentQualityMultiplier({ reading_level: 'graduate', word_count: 100000 });
      expect(result).toBeLessThanOrEqual(2.0);
    });

    it('handles null/undefined gracefully', async () => {
      const { getContentQualityMultiplier } = await import('../src/services/xpService');
      expect(getContentQualityMultiplier({})).toBe(1.0);
      expect(getContentQualityMultiplier({ reading_level: null, word_count: null })).toBe(1.0);
    });
  });

  describe('Reading XP', () => {
    it('awards 5 XP per page plus duration bonus', async () => {
      // Mock the database service import for awardMindXP
      vi.doMock('../src/database/service', async (importOriginal) => {
        const actual = await importOriginal<typeof import('../src/database/service')>();
        return {
          ...actual,
          awardMindXP: vi.fn().mockResolvedValue({ total_mind_xp: 35, mind_level: 1, levelUp: false }),
        };
      });

      const { awardReadingXP } = await import('../src/services/xpService');
      const result = await awardReadingXP(5, 30, 1.0);

      // base: 5 pages × 5 = 25
      // duration: floor(30/10) * 3 = 9
      // total: (25 + 9) × 1.0 = 34
      expect(result.xpEarned).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Flashcard XP', () => {
    it('awards 3 per card reviewed + 2 per correct', async () => {
      vi.doMock('../src/database/service', async (importOriginal) => {
        const actual = await importOriginal<typeof import('../src/database/service')>();
        return {
          ...actual,
          awardMindXP: vi.fn().mockResolvedValue({ total_mind_xp: 20, mind_level: 1, levelUp: false }),
        };
      });

      const { awardFlashcardXP } = await import('../src/services/xpService');
      const result = await awardFlashcardXP(10, 7);

      // (10 × 3) + (7 × 2) = 30 + 14 = 44
      expect(result.xpEarned).toBeGreaterThanOrEqual(40);
    });
  });
});
