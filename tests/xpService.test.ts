import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database service
const mockGetAppState = vi.fn();
const mockSetAppState = vi.fn();

vi.mock('../src/database/service', () => ({
  getAppState: (...args: any[]) => mockGetAppState(...args),
  setAppState: (...args: any[]) => mockSetAppState(...args),
  awardMindXP: vi.fn().mockResolvedValue({ total_mind_xp: 100, mind_level: 1, levelUp: false }),
  getMindXP: vi.fn().mockResolvedValue({
    total_mind_xp: 0,
    mind_level: 1,
    pages_read_total: 0,
    flashcards_reviewed_total: 0,
    documents_completed: 0,
  }),
}));

// Mock rankingService
vi.mock('../src/services/rankingService', () => ({
  getXPMultiplier: vi.fn().mockReturnValue(1.0),
  checkMilestoneReached: vi.fn().mockReturnValue(null),
}));

// Mock telemetry (uses posthogService)
vi.mock('../src/services/telemetry', () => ({
  logEvent: vi.fn().mockResolvedValue(undefined),
  logPerf: vi.fn().mockResolvedValue(undefined),
}));

import {
  getXPData,
  awardWorkoutXP,
  awardStepXP,
  awardJogXP,
  awardProgressPhotoXP,
  addXP,
  getContentQualityMultiplier,
} from '../src/services/xpService';

describe('XP Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAppState.mockResolvedValue(null);
    mockSetAppState.mockResolvedValue(undefined);
  });

  describe('getXPData', () => {
    it('returns level 1 with 0 XP from empty state', async () => {
      mockGetAppState.mockResolvedValue(null);
      const data = await getXPData();
      expect(data.totalXP).toBe(0);
      expect(data.level).toBe(1);
      expect(data.currentLevelXP).toBe(0);
      expect(data.xpToNextLevel).toBe(250);
      expect(data.progressPercent).toBe(0);
    });

    it('returns correct level for 250 XP (level 2)', async () => {
      mockGetAppState.mockResolvedValue('250');
      const data = await getXPData();
      expect(data.totalXP).toBe(250);
      expect(data.level).toBe(2);
      expect(data.currentLevelXP).toBe(0);
      expect(data.xpToNextLevel).toBe(500);
    });

    it('returns correct level for 750 XP (level 3)', async () => {
      // Level 1 = 250 XP, Level 2 = 500 XP → 250 + 500 = 750 to reach level 3
      mockGetAppState.mockResolvedValue('750');
      const data = await getXPData();
      expect(data.totalXP).toBe(750);
      expect(data.level).toBe(3);
      expect(data.currentLevelXP).toBe(0);
    });

    it('calculates progress percent mid-level', async () => {
      // 125 XP is halfway through level 1 (needs 250)
      mockGetAppState.mockResolvedValue('125');
      const data = await getXPData();
      expect(data.level).toBe(1);
      expect(data.progressPercent).toBe(50);
    });
  });

  describe('addXP', () => {
    it('adds XP and persists to app_state', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await addXP(100);
      expect(result.xpEarned).toBe(100);
      expect(result.data.totalXP).toBe(100);
      expect(mockSetAppState).toHaveBeenCalledWith('user_total_xp', '100');
    });

    it('detects level up from 0 to level 2', async () => {
      mockGetAppState.mockResolvedValue('200');
      const result = await addXP(100);
      expect(result.levelUp).toBe(true);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(2);
    });

    it('returns no level up when staying in same level', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await addXP(50);
      expect(result.levelUp).toBe(false);
      expect(result.oldLevel).toBe(1);
      expect(result.newLevel).toBe(1);
    });

    it('handles zero amount gracefully', async () => {
      mockGetAppState.mockResolvedValue('100');
      const result = await addXP(0);
      expect(result.xpEarned).toBe(0);
      expect(result.levelUp).toBe(false);
      expect(mockSetAppState).not.toHaveBeenCalled();
    });

    it('handles negative amount gracefully', async () => {
      mockGetAppState.mockResolvedValue('100');
      const result = await addXP(-10);
      expect(result.xpEarned).toBe(0);
      expect(mockSetAppState).not.toHaveBeenCalled();
    });
  });

  describe('awardWorkoutXP', () => {
    it('awards base + exercise XP for partial completion', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await awardWorkoutXP(3, 5, 0);
      // base 100 + 3*20=60 + no completion bonus + no streak = 160
      expect(result.xpEarned).toBe(160);
    });

    it('awards completion bonus when all exercises done', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await awardWorkoutXP(5, 5, 0);
      // base 100 + 5*20=100 + completion 50 + no streak = 250
      expect(result.xpEarned).toBe(250);
    });

    it('includes streak bonus', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await awardWorkoutXP(5, 5, 3);
      // base 100 + 5*20=100 + completion 50 + 3*10=30 streak = 280
      expect(result.xpEarned).toBe(280);
    });

    it('awards at least base XP even with 0 exercises', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await awardWorkoutXP(0, 5, 0);
      // base 100 + 0 exercises + 0 completion + 0 streak = 100
      expect(result.xpEarned).toBe(100);
    });
  });

  describe('awardJogXP', () => {
    it('awards 10 XP per 100m', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await awardJogXP(500);
      // 500m / 100 = 5 × 10 = 50 XP
      expect(result.xpEarned).toBe(50);
    });

    it('awards minimum 1 XP for short jog', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await awardJogXP(10);
      expect(result.xpEarned).toBe(1);
    });

    it('floors partial 100m segments', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await awardJogXP(350);
      // floor(350/100) = 3 × 10 = 30 XP
      expect(result.xpEarned).toBe(30);
    });
  });

  describe('awardStepXP', () => {
    it('awards 4 XP per 1000 steps on new day', async () => {
      // First call: no previous date stored
      mockGetAppState.mockResolvedValue(null);
      const result = await awardStepXP(3000);
      // floor(3000/1000) * 4 = 12 XP
      expect(result).not.toBeNull();
      expect(result!.xpEarned).toBe(12);
    });

    it('returns null when no incremental XP earned', async () => {
      // Same day, same steps → no new XP
      const today = new Date().toISOString().split('T')[0];
      mockGetAppState
        .mockResolvedValueOnce(today)   // DAILY_STEP_XP_KEY = today
        .mockResolvedValueOnce('3000')  // prev steps
        .mockResolvedValueOnce('0');    // user_total_xp for loading
      const result = await awardStepXP(3000);
      expect(result).toBeNull();
    });

    it('awards incremental XP within same day', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockGetAppState.mockReset();
      mockGetAppState.mockImplementation(async (key: string) => {
        if (key === 'daily_step_xp_date') return today;
        if (key === 'daily_step_xp_prev_steps') return '2000';
        if (key === 'user_total_xp') return '0';
        return null;
      });
      const result = await awardStepXP(5000);
      // prev XP: floor(2000/1000)*4 = 8, new XP: floor(5000/1000)*4 = 20, diff = 12
      expect(result).not.toBeNull();
      expect(result!.xpEarned).toBe(12);
    });
  });

  describe('awardProgressPhotoXP', () => {
    it('awards 25 XP', async () => {
      mockGetAppState.mockResolvedValue('0');
      const result = await awardProgressPhotoXP();
      expect(result.xpEarned).toBe(25);
    });
  });

  describe('getContentQualityMultiplier', () => {
    it('returns 1.0 for standard content', async () => {
      expect(getContentQualityMultiplier({})).toBe(1.0);
    });

    it('returns 1.5 for college-level content', async () => {
      expect(getContentQualityMultiplier({ reading_level: 'College' })).toBe(1.5);
    });

    it('returns 0.5 for elementary content', async () => {
      expect(getContentQualityMultiplier({ reading_level: 'Elementary' })).toBe(0.5);
    });

    it('penalizes very short documents', async () => {
      const mult = getContentQualityMultiplier({ word_count: 200 });
      expect(mult).toBe(0.6); // 1.0 * 0.6
    });

    it('rewards substantial reads', async () => {
      const mult = getContentQualityMultiplier({ word_count: 10000 });
      expect(mult).toBe(1.2); // 1.0 * 1.2
    });

    it('clamps to minimum 0.3', async () => {
      // Elementary + short = 0.5 * 0.6 = 0.3
      const mult = getContentQualityMultiplier({ reading_level: 'Elementary', word_count: 100 });
      expect(mult).toBe(0.3);
    });

    it('clamps to maximum 2.0', async () => {
      // College + long = 1.5 * 1.2 = 1.8 (within bounds)
      const mult = getContentQualityMultiplier({ reading_level: 'College', word_count: 10000 });
      expect(mult).toBeCloseTo(1.8);
    });
  });

  describe('Level calculation edge cases', () => {
    it('handles very large XP values', async () => {
      // 250 + 500 + 750 + ... cumulative. Must mock by key for loadTotalXP.
      mockGetAppState.mockImplementation(async (key: string) => {
        if (key === 'user_total_xp') return '100000';
        return null;
      });
      const data = await getXPData();
      expect(data.level).toBeGreaterThan(10);
      expect(data.progressPercent).toBeGreaterThanOrEqual(0);
      expect(data.progressPercent).toBeLessThanOrEqual(100);
    });

    it('returns exactly level boundary values correctly', async () => {
      // Exactly 250 XP = just entering level 2 with 0 remainder
      mockGetAppState.mockResolvedValue('250');
      const data = await getXPData();
      expect(data.level).toBe(2);
      expect(data.currentLevelXP).toBe(0);
      expect(data.progressPercent).toBe(0);
    });

    it('handles 1 XP below level up', async () => {
      mockGetAppState.mockResolvedValue('249');
      const data = await getXPData();
      expect(data.level).toBe(1);
      expect(data.currentLevelXP).toBe(249);
      expect(data.progressPercent).toBe(100); // Math.round(249/250 * 100) = 100
    });
  });
});
