/**
 * Churn Risk Scoring Service — Client-side churn signals from SQLite.
 *
 * Computes a 0-100 score: 0 = fully engaged, 100 = about to churn.
 * Uses: days since last workout, current streak, 14-day session frequency.
 *
 * NO Apollo. NO AsyncStorage. SQLite only.
 */

import { getRecentSessions, getWorkoutStreakCurrent, getWorkoutCountSince } from '../database/service';

export interface ChurnRisk {
  score: number;
  tier: 'low' | 'medium' | 'high';
  signals: string[];
}

/**
 * Compute churn risk for user.
 */
export async function getChurnRisk(userId: string = 'user_local_001'): Promise<ChurnRisk> {
  const signals: string[] = [];
  let score = 0;

  try {
    // 1. Days since last workout (0-40 points)
    const recent = await getRecentSessions(userId, 1);
    let daysSinceLastWorkout = Infinity;

    if (recent.length > 0 && recent[0]) {
      const lastDate = recent[0].completed_at ?? recent[0].started_at;
      const lastMs = new Date(lastDate).getTime();
      daysSinceLastWorkout = Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000));
    }

    if (daysSinceLastWorkout > 14) {
      score += 40;
      signals.push(`No workout in ${daysSinceLastWorkout} days`);
    } else if (daysSinceLastWorkout > 7) {
      score += 25;
      signals.push(`Last workout ${daysSinceLastWorkout} days ago`);
    } else if (daysSinceLastWorkout > 3) {
      score += 10;
      signals.push(`Last workout ${daysSinceLastWorkout} days ago`);
    }

    // 2. Current streak (0-30 points, inverse)
    const streak = await getWorkoutStreakCurrent(userId);

    if (streak === 0) {
      score += 30;
      signals.push('No active streak');
    } else if (streak < 3) {
      score += 15;
      signals.push(`Streak: ${streak} days (weak)`);
    } else if (streak >= 7) {
      // Bonus: reduce risk for strong streaks
      score = Math.max(0, score - 10);
      signals.push(`Strong streak: ${streak} days`);
    }

    // 3. 14-day session frequency (0-30 points)
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const sessionCount = await getWorkoutCountSince(twoWeeksAgo);

    if (sessionCount === 0) {
      score += 30;
      signals.push('Zero sessions in 14 days');
    } else if (sessionCount < 3) {
      score += 20;
      signals.push(`Only ${sessionCount} sessions in 14 days`);
    } else if (sessionCount < 7) {
      score += 5;
      signals.push(`${sessionCount} sessions in 14 days`);
    } else {
      signals.push(`${sessionCount} sessions in 14 days (active)`);
    }
  } catch {
    // If DB fails, assume medium risk
    score = 50;
    signals.push('Unable to read workout data');
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  const tier: ChurnRisk['tier'] = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

  return { score, tier, signals };
}
