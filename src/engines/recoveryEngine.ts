/**
 * ENGINE 3 — Recovery & Deload Engine
 * 
 * Prevents Burnout: Fatigue management, deload triggers, recovery scheduling
 * 
 * Consumes: muscle_fatigue, failure patterns, week counters
 * Produces: deload_flag, reduced volume plans
 * 
 * Core Principle: Fatigue is the hidden weapon. Don't overcomplicate it.
 */

import {
  getMuscleFatigue,
  updateMuscleFatigue,
  applyDailyRecovery,
  getRecentSessions,
  getAppState,
  setAppState,
  getMuscleFatigueLevel,
} from '../database/service';
import { getDatabase } from '../database/schema';
import type { TargetMuscle, MuscleFatigue, WorkoutSession } from '../database/types';
import { getAdaptiveTrainingProfile } from '../services/adaptiveTrainingService';

// ============================================
// CONFIGURATION
// ============================================

const RECOVERY_CONFIG = {
  // Daily passive recovery rate (%)
  daily_recovery_rate: 8,

  // Fatigue thresholds
  fatigue_soft_threshold: 50, // Begin scoring penalty
  fatigue_hard_threshold: 70, // Skip muscle
  fatigue_critical_threshold: 85, // Force deload consideration

  // Deload triggers
  avg_fatigue_deload_trigger: 75, // If avg > this, suggest deload
  consecutive_failures_trigger: 3, // N failures → deload
  scheduled_deload_weeks: 4, // Auto-deload every N weeks

  // Deload parameters
  deload_volume_multiplier: 0.6, // 60% of normal volume
  deload_duration_days: 7,

  // Fatigue accumulation per set
  fatigue_per_set_primary: 12,
  fatigue_per_set_secondary: 6,

  // Recovery bonuses
  sleep_recovery_bonus: 5, // If user reports good sleep
  rest_day_recovery_bonus: 3, // Extra recovery on rest days
};

// ============================================
// TYPES
// ============================================

export interface DeloadStatus {
  should_deload: boolean;
  reasons: string[];
  severity: 'none' | 'suggested' | 'recommended' | 'required';
  days_until_scheduled: number;
}

export interface FatigueSnapshot {
  muscle: TargetMuscle;
  level: number;
  status: 'fresh' | 'moderate' | 'fatigued' | 'critical';
  days_since_trained: number | null;
}

export interface RecoveryPlan {
  deload_active: boolean;
  deload_days_remaining: number;
  volume_multiplier: number;
  muscles_to_avoid: TargetMuscle[];
  muscles_to_prioritize: TargetMuscle[];
  recommendations: string[];
}

// ============================================
// FATIGUE MANAGEMENT
// ============================================

/**
 * Get current fatigue snapshot for all muscles
 */
export async function getFatigueSnapshot(userId: string): Promise<FatigueSnapshot[]> {
  const fatigueRecords = await getMuscleFatigue(userId);
  const now = new Date();

  const allMuscles: TargetMuscle[] = [
    'abs', 'chest_mid', 'chest_upper', 'chest_lower', 'lats', 'rhomboids',
    'deltoids_front', 'deltoids_lateral', 'deltoids_rear', 'biceps', 'triceps',
    'forearms', 'quads', 'hamstrings', 'glutes_max', 'glutes_med', 'calves_gastrocnemius',
    'core_deep', 'lower_back', 'traps_upper', 'traps_mid', 'obliques',
  ];

  const fatigueMap = new Map(fatigueRecords.map(f => [f.muscle, f]));

  return allMuscles.map(muscle => {
    const record = fatigueMap.get(muscle);
    const level = record?.fatigue_level ?? 0;

    let status: 'fresh' | 'moderate' | 'fatigued' | 'critical' = 'fresh';
    if (level >= RECOVERY_CONFIG.fatigue_critical_threshold) {
      status = 'critical';
    } else if (level >= RECOVERY_CONFIG.fatigue_hard_threshold) {
      status = 'fatigued';
    } else if (level >= RECOVERY_CONFIG.fatigue_soft_threshold) {
      status = 'moderate';
    }

    let daysSinceTrained: number | null = null;
    if (record?.last_trained_at) {
      const trainedDate = new Date(record.last_trained_at);
      daysSinceTrained = Math.floor((now.getTime() - trainedDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      muscle,
      level,
      status,
      days_since_trained: daysSinceTrained,
    };
  });
}

/**
 * Calculate average fatigue across all tracked muscles
 */
export async function getAverageFatigue(userId: string): Promise<number> {
  const snapshot = await getFatigueSnapshot(userId);
  if (snapshot.length === 0) return 0;

  const total = snapshot.reduce((sum, s) => sum + s.level, 0);
  return Math.round(total / snapshot.length);
}

/**
 * Update fatigue after completing an exercise
 */
export async function accumulateFatigue(
  userId: string,
  primaryMuscles: TargetMuscle[],
  secondaryMuscles: TargetMuscle[],
  setsCompleted: number
): Promise<void> {
  const db = await getDatabase();

  // Use a transaction with atomic UPDATE to prevent read-modify-write races
  await db.withTransactionAsync(async () => {
    // Primary muscles get full fatigue hit — atomic increment, no separate read
    for (const muscle of primaryMuscles) {
      const increment = setsCompleted * RECOVERY_CONFIG.fatigue_per_set_primary;
      await db.runAsync(
        `INSERT INTO muscle_fatigue (user_id, muscle, fatigue_level, last_trained_at, updated_at)
         VALUES (?, ?, MIN(100, ?), datetime('now'), datetime('now'))
         ON CONFLICT(user_id, muscle) DO UPDATE SET
           fatigue_level = MIN(100, fatigue_level + ?),
           last_trained_at = datetime('now'),
           updated_at = datetime('now')`,
        [userId, muscle, increment, increment]
      );
    }

    // Secondary muscles get half fatigue hit
    for (const muscle of secondaryMuscles) {
      const increment = setsCompleted * RECOVERY_CONFIG.fatigue_per_set_secondary;
      await db.runAsync(
        `INSERT INTO muscle_fatigue (user_id, muscle, fatigue_level, last_trained_at, updated_at)
         VALUES (?, ?, MIN(100, ?), datetime('now'), datetime('now'))
         ON CONFLICT(user_id, muscle) DO UPDATE SET
           fatigue_level = MIN(100, fatigue_level + ?),
           updated_at = datetime('now')`,
        [userId, muscle, increment, increment]
      );
    }
  });
}

async function getCurrentFatigue(userId: string, muscle: TargetMuscle): Promise<number> {
  return getMuscleFatigueLevel(userId, muscle);
}

// ============================================
// DAILY RECOVERY
// ============================================

/**
 * Apply daily recovery tick (call once per day, e.g., at midnight or app open)
 */
export async function applyDailyRecoveryTick(
  userId: string,
  isRestDay = false,
  goodSleep = false
): Promise<void> {
  const adaptive = await getAdaptiveTrainingProfile(userId);
  let recoveryRate = RECOVERY_CONFIG.daily_recovery_rate;

  if (isRestDay) {
    recoveryRate += RECOVERY_CONFIG.rest_day_recovery_bonus;
  }

  if (goodSleep) {
    recoveryRate += RECOVERY_CONFIG.sleep_recovery_bonus;
  }

  recoveryRate = Math.round(recoveryRate * adaptive.fatigueSensitivity);

  await applyDailyRecovery(userId, recoveryRate);

  // Track last recovery date
  await setAppState(`${userId}_last_recovery_tick`, new Date().toISOString());
}

/**
 * Check if recovery tick is needed (hasn't been done today)
 */
export async function needsRecoveryTick(userId: string): Promise<boolean> {
  const lastTick = await getAppState(`${userId}_last_recovery_tick`);
  if (!lastTick) return true;

  const lastDate = new Date(lastTick).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  return lastDate !== today;
}

// ============================================
// DELOAD DETECTION
// ============================================

/**
 * Check if user should enter deload
 */
export async function checkDeloadStatus(userId: string): Promise<DeloadStatus> {
  const adaptive = await getAdaptiveTrainingProfile(userId);
  const reasons: string[] = [];
  let severity: 'none' | 'suggested' | 'recommended' | 'required' = 'none';

  const adjustedAvgFatigueTrigger = Math.round(
    RECOVERY_CONFIG.avg_fatigue_deload_trigger / adaptive.fatigueSensitivity
  );
  const adjustedCriticalThreshold = Math.round(
    RECOVERY_CONFIG.fatigue_critical_threshold / adaptive.fatigueSensitivity
  );
  const adjustedFailureTrigger = Math.max(
    1,
    Math.round(RECOVERY_CONFIG.consecutive_failures_trigger / adaptive.fatigueSensitivity)
  );

  // 1. Check average fatigue
  const avgFatigue = await getAverageFatigue(userId);
  if (avgFatigue >= adjustedAvgFatigueTrigger) {
    reasons.push(`Average fatigue (${avgFatigue}%) exceeds threshold (${adjustedAvgFatigueTrigger}%, adaptive)`);
    severity = 'recommended';
  }

  // 2. Check for critical muscles
  const snapshot = await getFatigueSnapshot(userId);
  const criticalMuscles = snapshot.filter(s => s.level >= adjustedCriticalThreshold);
  if (criticalMuscles.length >= 3) {
    reasons.push(`${criticalMuscles.length} muscle groups at critical fatigue (adaptive threshold)`);
    severity = 'required';
  } else if (criticalMuscles.length >= 1) {
    reasons.push(`${criticalMuscles.length} muscle group(s) at critical fatigue (adaptive threshold)`);
    if (severity === 'none') severity = 'suggested';
  }

  // 3. Check consecutive failures
  const failureCount = await getConsecutiveFailures(userId);
  if (failureCount >= adjustedFailureTrigger) {
    reasons.push(`${failureCount} consecutive workout failures (adaptive threshold ${adjustedFailureTrigger})`);
    severity = severity === 'none' ? 'recommended' : 'required';
  }

  // 4. Check scheduled deload
  const weekNumber = await getCurrentWeekNumber(userId);
  const weeksUntilScheduled = RECOVERY_CONFIG.scheduled_deload_weeks - (weekNumber % RECOVERY_CONFIG.scheduled_deload_weeks);

  if (weeksUntilScheduled === 0 || weekNumber % RECOVERY_CONFIG.scheduled_deload_weeks === 0) {
    reasons.push(`Scheduled deload week (week ${weekNumber})`);
    if (severity === 'none') severity = 'suggested';
  }

  return {
    should_deload: severity !== 'none',
    reasons,
    severity,
    days_until_scheduled: weeksUntilScheduled * 7,
  };
}

async function getConsecutiveFailures(userId: string): Promise<number> {
  const sessions = await getRecentSessions(userId, 5);
  let failures = 0;

  for (const session of sessions) {
    if (!session.success) {
      failures++;
    } else {
      break; // Streak broken
    }
  }

  return failures;
}

async function getCurrentWeekNumber(userId: string): Promise<number> {
  const weekStr = await getAppState(`${userId}_training_week`);
  return weekStr ? parseInt(weekStr, 10) : 1;
}

/**
 * Increment week counter (call after completing a week of training)
 */
export async function incrementWeekCounter(userId: string): Promise<number> {
  const current = await getCurrentWeekNumber(userId);
  const next = current + 1;
  await setAppState(`${userId}_training_week`, next.toString());
  return next;
}

// ============================================
// DELOAD MANAGEMENT
// ============================================

/**
 * Start a deload period
 */
export async function startDeload(userId: string): Promise<void> {
  const startDate = new Date().toISOString();
  await setAppState(`${userId}_deload_start`, startDate);
  await setAppState(`${userId}_deload_active`, 'true');
}

/**
 * End deload period
 */
export async function endDeload(userId: string): Promise<void> {
  await setAppState(`${userId}_deload_active`, 'false');

  // Reset all fatigue to moderate levels
  const snapshot = await getFatigueSnapshot(userId);
  for (const s of snapshot) {
    if (s.level > 30) {
      await updateMuscleFatigue(userId, s.muscle, 30, false);
    }
  }
}

/**
 * Check if currently in deload
 */
export async function isInDeload(userId: string): Promise<boolean> {
  const active = await getAppState(`${userId}_deload_active`);
  if (active !== 'true') return false;

  // Check if deload period has expired
  const startStr = await getAppState(`${userId}_deload_start`);
  if (!startStr) return false;

  const startDate = new Date(startStr);
  const now = new Date();
  const daysPassed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysPassed >= RECOVERY_CONFIG.deload_duration_days) {
    await endDeload(userId);
    return false;
  }

  return true;
}

// ============================================
// RECOVERY PLAN GENERATION
// ============================================

/**
 * Generate a recovery plan based on current state
 */
export async function generateRecoveryPlan(userId: string): Promise<RecoveryPlan> {
  const inDeload = await isInDeload(userId);
  const snapshot = await getFatigueSnapshot(userId);

  let deloadDaysRemaining = 0;
  if (inDeload) {
    const startStr = await getAppState(`${userId}_deload_start`);
    if (startStr) {
      const startDate = new Date(startStr);
      const daysPassed = (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      deloadDaysRemaining = Math.max(0, Math.ceil(RECOVERY_CONFIG.deload_duration_days - daysPassed));
    }
  }

  const volumeMultiplier = inDeload ? RECOVERY_CONFIG.deload_volume_multiplier : 1.0;

  // Muscles to avoid (fatigued or critical)
  const musclesToAvoid = snapshot
    .filter(s => s.status === 'critical' || s.status === 'fatigued')
    .map(s => s.muscle);

  // Muscles to prioritize (fresh, haven't trained recently)
  const musclesToPrioritize = snapshot
    .filter(s => s.status === 'fresh' && (s.days_since_trained === null || s.days_since_trained >= 3))
    .map(s => s.muscle);

  // Generate recommendations
  const recommendations: string[] = [];

  if (inDeload) {
    recommendations.push('Deload week active. Focus on technique, not intensity.');
    recommendations.push('Reduce weight/difficulty by 30-40%');
    recommendations.push('Prioritize sleep and nutrition');
  } else {
    const criticalCount = snapshot.filter(s => s.status === 'critical').length;
    const fatiguedCount = snapshot.filter(s => s.status === 'fatigued').length;

    if (criticalCount > 0) {
      recommendations.push(`${criticalCount} muscle group(s) need rest. Consider deload.`);
    }

    if (fatiguedCount > 0) {
      recommendations.push(`Avoid direct work on fatigued muscles: ${musclesToAvoid.slice(0, 3).join(', ')}`);
    }

    if (musclesToPrioritize.length > 0) {
      recommendations.push(`Good targets today: ${musclesToPrioritize.slice(0, 3).join(', ')}`);
    }
  }

  return {
    deload_active: inDeload,
    deload_days_remaining: deloadDaysRemaining,
    volume_multiplier: volumeMultiplier,
    muscles_to_avoid: musclesToAvoid,
    muscles_to_prioritize: musclesToPrioritize,
    recommendations,
  };
}

// ============================================
// EXPORTS
// ============================================

export { RECOVERY_CONFIG };
