/**
 * Churn Service Tests (Phase A Step 5)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/database/service', () => ({
  getRecentSessions: vi.fn(),
  getWorkoutStreakCurrent: vi.fn(),
  getWorkoutCountSince: vi.fn(),
}));

import { getChurnRisk } from '../../src/services/churnService';
import { getRecentSessions, getWorkoutStreakCurrent, getWorkoutCountSince } from '../../src/database/service';

describe('Churn Risk Scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns high risk when no workouts at all', async () => {
    vi.mocked(getRecentSessions).mockResolvedValue([]);
    vi.mocked(getWorkoutStreakCurrent).mockResolvedValue(0);
    vi.mocked(getWorkoutCountSince).mockResolvedValue(0);

    const result = await getChurnRisk('user_test');

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.tier).toBe('high');
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('returns low risk for active user', async () => {
    const now = Date.now();
    vi.mocked(getRecentSessions).mockResolvedValue([
      { id: '1', started_at: new Date(now - 60000).toISOString(), completed_at: new Date(now).toISOString(), duration_minutes: 30, total_exercises: 5 } as any,
    ]);
    vi.mocked(getWorkoutStreakCurrent).mockResolvedValue(10);
    vi.mocked(getWorkoutCountSince).mockResolvedValue(12);

    const result = await getChurnRisk('user_test');

    expect(result.score).toBeLessThan(30);
    expect(result.tier).toBe('low');
  });

  it('returns medium risk for declining engagement', async () => {
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    vi.mocked(getRecentSessions).mockResolvedValue([
      { id: '1', started_at: new Date(fiveDaysAgo).toISOString(), completed_at: new Date(fiveDaysAgo + 1800000).toISOString(), duration_minutes: 30, total_exercises: 5 } as any,
    ]);
    vi.mocked(getWorkoutStreakCurrent).mockResolvedValue(1);
    vi.mocked(getWorkoutCountSince).mockResolvedValue(2);

    const result = await getChurnRisk('user_test');

    expect(result.tier).toBe('medium');
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBeLessThan(60);
  });

  it('clamps score to 0-100 range', async () => {
    vi.mocked(getRecentSessions).mockResolvedValue([]);
    vi.mocked(getWorkoutStreakCurrent).mockResolvedValue(0);
    vi.mocked(getWorkoutCountSince).mockResolvedValue(0);

    const result = await getChurnRisk('user_test');

    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('handles DB errors gracefully with medium risk', async () => {
    vi.mocked(getRecentSessions).mockRejectedValue(new Error('DB error'));

    const result = await getChurnRisk('user_test');

    expect(result.score).toBe(50);
    expect(result.tier).toBe('medium');
    expect(result.signals).toContain('Unable to read workout data');
  });

  it('returns correct ChurnRisk shape', async () => {
    vi.mocked(getRecentSessions).mockResolvedValue([]);
    vi.mocked(getWorkoutStreakCurrent).mockResolvedValue(0);
    vi.mocked(getWorkoutCountSince).mockResolvedValue(0);

    const result = await getChurnRisk('user_test');

    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('signals');
    expect(typeof result.score).toBe('number');
    expect(['low', 'medium', 'high']).toContain(result.tier);
    expect(Array.isArray(result.signals)).toBe(true);
  });
});
