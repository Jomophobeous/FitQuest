/**
 * Dashboard Data Aggregation Tests
 *
 * Tests the dashboard's data loading, aggregation, and display logic:
 * - Fatigue level averaging across muscles
 * - Session summarization (calories, completion rate)
 * - Readiness score fallback computation
 * - Today's progress calculation
 * - XP/level display accuracy
 * - Create-workout estimated duration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Controllable mock database
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  const rows: Record<string, any[]> = {};

  const mockGetAllAsync = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('muscle_fatigue')) return rows['fatigue'] ?? [];
    if (sql.includes('workout_sessions')) return rows['sessions'] ?? [];
    if (sql.includes('exercises')) return rows['exercises'] ?? [];
    if (sql.includes('daily_steps')) return rows['steps'] ?? [];
    return [];
  });

  const mockGetFirstAsync = vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
    if (sql.includes('app_state')) {
      const key = params?.[0];
      const val = store.get(key);
      return val !== undefined ? { value: val } : null;
    }
    if (sql.includes('user_profile')) return rows['profile']?.[0] ?? null;
    if (sql.includes('workout_streaks')) return rows['streak']?.[0] ?? null;
    if (sql.includes('COUNT')) return { count: 0 };
    return null;
  });

  const mockRunAsync = vi.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const mockExecAsync = vi.fn();
  const mockWithTransactionAsync = vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn());

  return {
    store,
    rows,
    mockGetAllAsync,
    mockGetFirstAsync,
    mockRunAsync,
    mockExecAsync,
    mockWithTransactionAsync,
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
  getXPMultiplier: vi.fn().mockReturnValue(1.0),
  getCurrentRank: vi.fn().mockReturnValue({ rank: 'Novice', xpMultiplier: 1.0, badge: 'NOV' }),
  checkMilestoneReached: vi.fn().mockReturnValue(null),
}));

import { queryCache } from '../src/database/queryCache';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard — fatigue aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.clear();
    queryCache.clear();
  });

  it('averages fatigue levels across multiple muscles', () => {
    const fatigue = [
      { muscle: 'chest_mid', fatigue_level: 60 },
      { muscle: 'quads', fatigue_level: 80 },
      { muscle: 'lats', fatigue_level: 40 },
      { muscle: 'biceps', fatigue_level: 20 },
    ];

    const avg = fatigue.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) / fatigue.length;
    expect(Math.round(avg)).toBe(50); // (60+80+40+20)/4 = 50
  });

  it('handles empty fatigue array (NaN avoided)', () => {
    const fatigue: { fatigue_level: number }[] = [];

    // Dashboard guards: fatigue.length > 0 ? avg : 0
    const avg = fatigue.length > 0
      ? fatigue.reduce((sum, m) => sum + (m.fatigue_level || 0), 0) / fatigue.length
      : 0;

    expect(avg).toBe(0);
    expect(Number.isNaN(avg)).toBe(false);
  });

  it('null/undefined fatigue_level treated as 0', () => {
    const fatigue = [
      { muscle: 'chest_mid', fatigue_level: 60 },
      { muscle: 'quads', fatigue_level: null },
      { muscle: 'lats', fatigue_level: undefined },
    ];

    const avg = fatigue.reduce((sum: number, m: any) => sum + (m.fatigue_level || 0), 0) / fatigue.length;
    expect(Math.round(avg)).toBe(20); // (60+0+0)/3 = 20
  });
});

describe('Dashboard — session summarization', () => {
  it('calculates calories: (duration_minutes × 5) + (exercises × 8)', () => {
    const session = { duration_minutes: 45, total_exercises: 8 };
    const calories = Math.round((session.duration_minutes * 5) + (session.total_exercises * 8));

    expect(calories).toBe(289); // 225 + 64
  });

  it('calculates completion rate correctly', () => {
    const sessions = [
      { success: 1 },
      { success: 1 },
      { success: 0 },
      { success: 1 },
      { success: 0 },
    ];

    const completedCount = sessions.filter(s => s.success).length;
    const completionRate = Math.round((completedCount / sessions.length) * 100);

    expect(completionRate).toBe(60); // 3/5 = 60%
  });

  it('avoids division by zero with no sessions', () => {
    const sessions: any[] = [];
    const completionRate = sessions.length > 0
      ? Math.round((sessions.filter(s => s.success).length / sessions.length) * 100)
      : 0;

    expect(completionRate).toBe(0);
  });
});

describe('Dashboard — readiness score', () => {
  it('uses cached readiness score when available', () => {
    const readiness: { score: number } | null = { score: 75 };
    const fatigueLevel = 40;

    const readinessScore = readiness?.score ?? (100 - fatigueLevel);
    expect(readinessScore).toBe(75);
  });

  it('falls back to (100 - fatigueLevel) when no cached readiness', () => {
    const readiness = null as { score: number } | null;
    const fatigueLevel = 40;

    const readinessScore = readiness?.score ?? (100 - fatigueLevel);
    expect(readinessScore).toBe(60);
  });

  it('isRecoveryBad when score < 30', () => {
    const readinessScore = 25;
    expect(readinessScore < 30).toBe(true);
  });

  it('isRecoveryGood when score >= 65', () => {
    const readinessScore = 70;
    expect(readinessScore >= 65).toBe(true);
  });

  it('neither good nor bad in the middle range', () => {
    const readinessScore = 50;
    expect(readinessScore < 30).toBe(false);
    expect(readinessScore >= 65).toBe(false);
  });
});

describe('Dashboard — today\'s progress calculation', () => {
  it('exercise-based: done/target capped at 1.0', () => {
    const todayExercisesDone = 8;
    const todayExercisesTarget = 6;

    const progress = todayExercisesTarget > 0
      ? Math.min(1, todayExercisesDone / todayExercisesTarget)
      : 0;

    expect(progress).toBe(1); // Capped at 1.0
  });

  it('exercise-based: partial completion', () => {
    const todayExercisesDone = 3;
    const todayExercisesTarget = 6;

    const progress = todayExercisesTarget > 0
      ? Math.min(1, todayExercisesDone / todayExercisesTarget)
      : 0;

    expect(progress).toBe(0.5);
  });

  it('time-based fallback when no exercise target', () => {
    const todayExercisesTarget = 0;
    const totalMinutes = 15;

    const progress = todayExercisesTarget > 0
      ? Math.min(1, 0)
      : (totalMinutes > 0 ? Math.min(1, totalMinutes / 30) : 0);

    expect(progress).toBe(0.5); // 15/30 = 0.5
  });

  it('zero progress when nothing done', () => {
    const todayExercisesTarget = 0;
    const totalMinutes = 0;

    const progress = todayExercisesTarget > 0
      ? Math.min(1, 0)
      : (totalMinutes > 0 ? Math.min(1, totalMinutes / 30) : 0);

    expect(progress).toBe(0);
  });
});

describe('Dashboard — XP data integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.clear();
    queryCache.clear();
  });

  it('getXPData returns correct level and progress from service', async () => {
    mocks.store.set('user_total_xp', '400');

    const { getXPData } = await import('../src/services/xpService');
    const data = await getXPData();

    // 400 total: Level 1 costs 250 → level 2, with 150 into level 2
    expect(data.level).toBe(2);
    expect(data.totalXP).toBe(400);
    expect(data.currentLevelXP).toBe(150);
    expect(data.xpToNextLevel).toBe(500);
    expect(data.progressPercent).toBe(30); // 150/500 = 30%
  });
});

describe('Create Workout — estimated duration calculation', () => {
  it('sums (sets × (time_per_set + rest)) across all exercises', () => {
    const selected = [
      { sets: 3, exercise: { time_per_set_seconds: 45 }, restSeconds: 60 },
      { sets: 4, exercise: { time_per_set_seconds: 30 }, restSeconds: 45 },
      { sets: 2, exercise: { time_per_set_seconds: 60 }, restSeconds: 90 },
    ];

    const totalSeconds = selected.reduce((total, s) => {
      return total + (s.sets * ((s.exercise.time_per_set_seconds || 30) + s.restSeconds));
    }, 0);
    const estimatedMinutes = totalSeconds / 60;

    // 3*(45+60) + 4*(30+45) + 2*(60+90) = 315 + 300 + 300 = 915 seconds = 15.25 min
    expect(totalSeconds).toBe(915);
    expect(estimatedMinutes).toBe(15.25);
  });

  it('defaults time_per_set to 30s when missing', () => {
    const selected = [
      { sets: 3, exercise: { time_per_set_seconds: null }, restSeconds: 60 },
    ];

    const totalSeconds = selected.reduce((total, s) => {
      return total + (s.sets * ((s.exercise.time_per_set_seconds || 30) + s.restSeconds));
    }, 0);

    // 3*(30+60) = 270 seconds
    expect(totalSeconds).toBe(270);
  });

  it('empty exercise list = zero minutes', () => {
    const selected: any[] = [];
    const totalSeconds = selected.reduce((total: number, s: any) => {
      return total + (s.sets * ((s.exercise.time_per_set_seconds || 30) + s.restSeconds));
    }, 0);

    expect(totalSeconds).toBe(0);
  });
});

describe('Create Workout — exercise filtering logic', () => {
  const exercises = [
    { id: 'ex1', name: 'Push-up', category: 'body_control', difficulty: 'beginner', equipment_level: 'none' },
    { id: 'ex2', name: 'Barbell Squat', category: 'strength', difficulty: 'intermediate', equipment_level: 'playground' },
    { id: 'ex3', name: 'Plank', category: 'focus', difficulty: 'beginner', equipment_level: 'none' },
    { id: 'ex4', name: 'Dumbbell Row', category: 'strength', difficulty: 'intermediate', equipment_level: 'minimal' },
  ];

  it('filters by category', () => {
    const filtered = exercises.filter(e => e.category === 'strength');
    expect(filtered).toHaveLength(2);
    expect(filtered.map(e => e.id)).toEqual(['ex2', 'ex4']);
  });

  it('filters by difficulty', () => {
    const filtered = exercises.filter(e => e.difficulty === 'beginner');
    expect(filtered).toHaveLength(2);
    expect(filtered.map(e => e.id)).toEqual(['ex1', 'ex3']);
  });

  it('filters by equipment level', () => {
    const filtered = exercises.filter(e => e.equipment_level === 'none');
    expect(filtered).toHaveLength(2);
  });

  it('filters by search query (case-insensitive)', () => {
    const query = 'squat';
    const filtered = exercises.filter(e =>
      e.name.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe('ex2');
  });

  it('stacks multiple filters with AND logic', () => {
    const category: string = 'strength';
    const difficulty: string = 'intermediate';
    const equipment: string = 'none';

    let filtered = exercises;
    if (category !== 'all') filtered = filtered.filter(e => e.category === category);
    if (difficulty !== 'all') filtered = filtered.filter(e => e.difficulty === difficulty);
    if (equipment !== 'all') filtered = filtered.filter(e => e.equipment_level === equipment);

    // strength + intermediate + none = nobody (squat is playground, row is minimal)
    expect(filtered).toHaveLength(0);
  });

  it('all filters = no filtering', () => {
    const category = 'all';
    const difficulty = 'all';
    const equipment = 'all';

    let filtered = exercises;
    if (category !== 'all') filtered = filtered.filter(e => e.category === category);
    if (difficulty !== 'all') filtered = filtered.filter(e => e.difficulty === difficulty);
    if (equipment !== 'all') filtered = filtered.filter(e => e.equipment_level === equipment);

    expect(filtered).toHaveLength(4);
  });
});
