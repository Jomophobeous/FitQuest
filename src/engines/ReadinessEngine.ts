/**
 * ENGINE — Readiness & Dynamic Fatigue Engine
 *
 * Time-aware readiness scoring that replaces static fatigue snapshots
 * with intraday decay curves. Provides:
 * - readinessNow (0-100) — composite score of training readiness
 * - timeSinceLastWorkout — minutes since last completed session
 * - intradayFatigueDecay — per-muscle fatigue adjusted for elapsed time
 * - profession-aware training window recommendations
 *
 * Deterministic engine: no AI calls, no network. All math on-device.
 */

import {
  getMuscleFatigue,
  getRecentSessions,
  getStreak,
  getUserProfile,
  getAppState,
  setAppState,
} from '../database/service';
import { logPerf, logEvent } from '../services/telemetry';
import type { TargetMuscle, MuscleFatigue, WorkoutSession } from '../database/types';

// ============================================
// TYPES
// ============================================

export type ReadinessStatus = 'READY' | 'MODERATE' | 'FATIGUED' | 'RECOVERY_NEEDED';

export type TrainingWindow = 'BEFORE_WORK' | 'DURING_WORK' | 'AFTER_WORK' | 'REST_DAY' | 'FLEXIBLE';

export type ShiftType = 'day' | 'night' | 'rotating';

export interface ProfessionSchedule {
  profession_type: string;
  work_start_hour: number;   // 0-23
  work_end_hour: number;     // 0-23
  commute_minutes: number;
  preferred_windows: TrainingWindow[];
  shift_type: ShiftType;
}

export interface ReadinessSnapshot {
  score: number;             // 0-100
  status: ReadinessStatus;
  timeSinceLastWorkoutMinutes: number | null;
  globalFatigue: number;     // 0-100, time-adjusted average
  freshMuscleCount: number;
  fatiguedMuscleCount: number;
  currentWindow: TrainingWindow;
  recommendedIntensity: 'low' | 'moderate' | 'high';
  recommendation: string;
  muscleFatigueMap: MuscleFatigueDecay[];
  updatedAt: number;         // Unix ms
}

export interface MuscleFatigueDecay {
  muscle: TargetMuscle;
  rawLevel: number;          // stored fatigue 0-100
  decayedLevel: number;      // time-adjusted fatigue 0-100
  hoursSinceTrained: number | null;
  status: 'fresh' | 'moderate' | 'fatigued' | 'critical';
}

// ============================================
// CONSTANTS
// ============================================

const READINESS_CONFIG = {
  // Fatigue half-life in hours — fatigue decays exponentially
  fatigue_half_life_hours: 36,

  // Score weights for composite readiness
  weights: {
    fatigue: 0.40,      // How recovered muscles are
    recency: 0.25,      // Time since last workout (too soon = bad, too long = bad)
    streak: 0.15,       // Training consistency
    sleep_proxy: 0.10,  // Time-of-day circadian proxy
    volume_trend: 0.10, // Recent training volume trend
  },

  // Optimal hours between workouts
  optimal_rest_hours_min: 18,
  optimal_rest_hours_max: 72,

  // Readiness thresholds
  thresholds: {
    ready: 65,
    moderate: 40,
    fatigued: 20,
  },
};

// ============================================
// CORE READINESS COMPUTATION
// ============================================

/**
 * Compute the current readiness snapshot.
 * Deterministic, fast, no AI — safe for frequent calls.
 */
export async function getReadinessSnapshot(userId: string): Promise<ReadinessSnapshot> {
  const startMs = Date.now();
  const [fatigue, sessions, streakData, profile, scheduleRaw] = await Promise.all([
    getMuscleFatigue(userId).catch(() => []),
    getRecentSessions(userId, 10).catch(() => []),
    getStreak(userId).catch(() => ({ current: 0, longest: 0 })),
    getUserProfile(userId).catch(() => null),
    getAppState(`${userId}_profession_schedule`).catch(() => null),
  ]);

  const now = Date.now();

  // 1. Time-adjusted muscle fatigue
  const muscleFatigueMap = computeDecayedFatigue(fatigue, now);
  const avgDecayedFatigue = muscleFatigueMap.length > 0
    ? muscleFatigueMap.reduce((sum, m) => sum + m.decayedLevel, 0) / muscleFatigueMap.length
    : 0;

  // 2. Time since last workout
  const lastCompleted = sessions.find(s => s.completed_at);
  const timeSinceLastWorkoutMinutes = lastCompleted?.completed_at
    ? Math.floor((now - new Date(lastCompleted.completed_at).getTime()) / 60000)
    : null;

  // 3. Individual score components
  const fatigueScore = computeFatigueScore(avgDecayedFatigue);
  const recencyScore = computeRecencyScore(timeSinceLastWorkoutMinutes);
  const streakScore = computeStreakScore(streakData.current);
  const circadianScore = computeCircadianScore(new Date().getHours());
  const volumeScore = computeVolumeScore(sessions);

  // 4. Composite readiness
  const w = READINESS_CONFIG.weights;
  const rawScore =
    fatigueScore * w.fatigue +
    recencyScore * w.recency +
    streakScore * w.streak +
    circadianScore * w.sleep_proxy +
    volumeScore * w.volume_trend;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  // 5. Status classification
  const status = classifyReadiness(score);

  // 6. Training window
  let schedule: ProfessionSchedule | null = null;
  if (scheduleRaw) { try { schedule = JSON.parse(scheduleRaw) as ProfessionSchedule; } catch { /* corrupted */ } }
  const currentWindow = getCurrentTrainingWindow(new Date().getHours(), schedule);

  // 7. Intensity recommendation
  const recommendedIntensity = getRecommendedIntensity(score, currentWindow);

  // 8. Human-readable recommendation
  const recommendation = buildRecommendation(status, currentWindow, timeSinceLastWorkoutMinutes, avgDecayedFatigue);

  const freshCount = muscleFatigueMap.filter(m => m.status === 'fresh').length;
  const fatiguedCount = muscleFatigueMap.filter(m => m.status === 'fatigued' || m.status === 'critical').length;

  // Telemetry: track computation latency and result quality
  logPerf('readiness_snapshot', Date.now() - startMs, {
    score,
    status,
    muscleCount: muscleFatigueMap.length,
    hasProfessionSchedule: !!scheduleRaw,
  }).catch(() => {}); // fire-and-forget

  return {
    score,
    status,
    timeSinceLastWorkoutMinutes,
    globalFatigue: Math.round(avgDecayedFatigue),
    freshMuscleCount: freshCount,
    fatiguedMuscleCount: fatiguedCount,
    currentWindow,
    recommendedIntensity,
    recommendation,
    muscleFatigueMap,
    updatedAt: now,
  };
}

// ============================================
// FATIGUE DECAY MODEL
// ============================================

/**
 * Apply exponential decay to stored fatigue levels based on time elapsed.
 * Formula: decayed = raw × 2^(-hoursElapsed / halfLife)
 */
function computeDecayedFatigue(records: MuscleFatigue[], nowMs: number): MuscleFatigueDecay[] {
  const halfLife = READINESS_CONFIG.fatigue_half_life_hours;

  return records.map(record => {
    const hoursSinceTrained = record.last_trained_at
      ? (nowMs - new Date(record.last_trained_at).getTime()) / 3600000
      : null;

    let decayedLevel = record.fatigue_level;
    if (hoursSinceTrained !== null && hoursSinceTrained > 0) {
      decayedLevel = record.fatigue_level * Math.pow(2, -hoursSinceTrained / halfLife);
    }
    decayedLevel = Math.round(Math.max(0, Math.min(100, decayedLevel)));

    let status: 'fresh' | 'moderate' | 'fatigued' | 'critical' = 'fresh';
    if (decayedLevel >= 85) status = 'critical';
    else if (decayedLevel >= 70) status = 'fatigued';
    else if (decayedLevel >= 50) status = 'moderate';

    return {
      muscle: record.muscle,
      rawLevel: record.fatigue_level,
      decayedLevel,
      hoursSinceTrained: hoursSinceTrained !== null ? Math.round(hoursSinceTrained * 10) / 10 : null,
      status,
    };
  });
}

// ============================================
// SCORE COMPONENTS
// ============================================

/** Higher when muscles are less fatigued */
function computeFatigueScore(avgDecayedFatigue: number): number {
  return Math.max(0, 100 - avgDecayedFatigue);
}

/** Bell curve: peaks at 24-48h since last workout */
function computeRecencyScore(minutesSinceLastWorkout: number | null): number {
  if (minutesSinceLastWorkout === null) return 50; // no data, neutral

  const hours = minutesSinceLastWorkout / 60;
  const minH = READINESS_CONFIG.optimal_rest_hours_min;
  const maxH = READINESS_CONFIG.optimal_rest_hours_max;

  if (hours < minH) {
    // Too soon — linear ramp from 20 to 80
    return Math.round(20 + (hours / minH) * 60);
  } else if (hours <= maxH) {
    // Sweet spot — 80-100
    const t = (hours - minH) / (maxH - minH);
    return Math.round(80 + 20 * Math.sin(t * Math.PI));
  } else {
    // Too long — gradual decline
    const overHours = hours - maxH;
    return Math.round(Math.max(30, 80 - overHours * 0.5));
  }
}

/** Rewards consistency, caps at 14-day streak */
function computeStreakScore(currentStreak: number): number {
  return Math.min(100, currentStreak * 7);
}

/** Circadian proxy: higher during typical training windows */
function computeCircadianScore(hour: number): number {
  // Morning (6-10): 70-85
  if (hour >= 6 && hour <= 10) return 70 + (hour - 6) * 3.75;
  // Midday (11-14): 60-70
  if (hour >= 11 && hour <= 14) return 65;
  // Afternoon (15-19): 80-95 (peak performance window)
  if (hour >= 15 && hour <= 19) return 80 + (hour - 15) * 3.75;
  // Evening (20-22): 60-70
  if (hour >= 20 && hour <= 22) return 65;
  // Night/early morning: lower
  return 40;
}

/** Recent volume trend — checks if overtraining or undertrained */
function computeVolumeScore(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 50;

  const lastWeek = sessions.filter(s => {
    const d = new Date(s.started_at);
    return (Date.now() - d.getTime()) < 7 * 86400000;
  });

  const weeklyVolume = lastWeek.reduce((sum, s) => sum + (s.completed_exercises || 0), 0);

  // Optimal: 3-5 sessions, 15-30 exercises per week
  if (weeklyVolume >= 15 && weeklyVolume <= 30) return 85;
  if (weeklyVolume < 15) return 50 + weeklyVolume * 2;
  // Overtraining signal
  return Math.max(30, 85 - (weeklyVolume - 30) * 3);
}

// ============================================
// CLASSIFICATION HELPERS
// ============================================

function classifyReadiness(score: number): ReadinessStatus {
  const t = READINESS_CONFIG.thresholds;
  if (score >= t.ready) return 'READY';
  if (score >= t.moderate) return 'MODERATE';
  if (score >= t.fatigued) return 'FATIGUED';
  return 'RECOVERY_NEEDED';
}

function getCurrentTrainingWindow(hour: number, schedule: ProfessionSchedule | null): TrainingWindow {
  if (!schedule) return 'FLEXIBLE';

  const { work_start_hour, work_end_hour, commute_minutes } = schedule;
  const commuteHours = commute_minutes / 60;

  const morningFree = work_start_hour - commuteHours;
  const eveningFree = work_end_hour + commuteHours;

  if (hour < morningFree) return 'BEFORE_WORK';
  if (hour >= work_start_hour && hour < work_end_hour) return 'DURING_WORK';
  if (hour >= eveningFree) return 'AFTER_WORK';
  return 'FLEXIBLE';
}

function getRecommendedIntensity(
  score: number,
  window: TrainingWindow,
): 'low' | 'moderate' | 'high' {
  // Before work: cap at moderate (preserve energy)
  if (window === 'BEFORE_WORK') {
    return score >= 65 ? 'moderate' : 'low';
  }
  // During work: always low (if training at all)
  if (window === 'DURING_WORK') return 'low';

  // After work / flexible: full range
  if (score >= 75) return 'high';
  if (score >= 45) return 'moderate';
  return 'low';
}

function buildRecommendation(
  status: ReadinessStatus,
  window: TrainingWindow,
  minutesSince: number | null,
  avgFatigue: number,
): string {
  const windowPrefix = {
    BEFORE_WORK: 'Before work: ',
    DURING_WORK: 'Break time: ',
    AFTER_WORK: 'Post-work: ',
    REST_DAY: '',
    FLEXIBLE: '',
  }[window];

  switch (status) {
    case 'READY':
      return `${windowPrefix}You're fully recovered. Great time for a challenging workout.`;
    case 'MODERATE':
      if (avgFatigue > 50) {
        return `${windowPrefix}Some muscle groups are still recovering. A moderate session targeting fresh muscles is ideal.`;
      }
      return `${windowPrefix}Decent readiness. A balanced workout will keep your momentum.`;
    case 'FATIGUED':
      return `${windowPrefix}Your body needs more recovery. Consider mobility work or light movement.`;
    case 'RECOVERY_NEEDED':
      return `${windowPrefix}Rest is the best training today. Focus on sleep, nutrition, and hydration.`;
  }
}

// ============================================
// PROFESSION SCHEDULE PERSISTENCE
// ============================================

/**
 * Save profession schedule to app_state (JSON serialized).
 */
export async function saveProfessionSchedule(
  userId: string,
  schedule: ProfessionSchedule,
): Promise<void> {
  await setAppState(`${userId}_profession_schedule`, JSON.stringify(schedule));
  logEvent('profession_schedule_saved', {
    shiftType: schedule.shift_type,
  }).catch(() => {});
}

/**
 * Load profession schedule from app_state.
 */
export async function getProfessionSchedule(
  userId: string,
): Promise<ProfessionSchedule | null> {
  const raw = await getAppState(`${userId}_profession_schedule`);
  if (!raw) return null;
  try { return JSON.parse(raw) as ProfessionSchedule; } catch { return null; }
}

// ============================================
// READINESS CACHE (lightweight snapshot for dashboard)
// ============================================

let _cachedSnapshot: ReadinessSnapshot | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Get readiness snapshot with 1-minute in-memory cache.
 * Safe for frequent UI calls (dashboard, coach, background ticks).
 */
export async function getCachedReadiness(userId: string): Promise<ReadinessSnapshot> {
  const now = Date.now();
  if (_cachedSnapshot && (now - _cacheTimestamp) < CACHE_TTL_MS) {
    return _cachedSnapshot;
  }
  _cachedSnapshot = await getReadinessSnapshot(userId);
  _cacheTimestamp = now;
  return _cachedSnapshot;
}

/** Force cache invalidation (call after workout completion). */
export function invalidateReadinessCache(): void {
  _cachedSnapshot = null;
  _cacheTimestamp = 0;
}

// ============================================
// STATUS TEXT HELPERS (for UI + AI context)
// ============================================

/**
 * Generate a concise status string for AI Coach first-message context.
 */
export function formatStatusForAI(snapshot: ReadinessSnapshot): string {
  const parts: string[] = [];

  parts.push(`Readiness: ${snapshot.score}/100 (${snapshot.status})`);

  if (snapshot.timeSinceLastWorkoutMinutes !== null) {
    const hours = Math.floor(snapshot.timeSinceLastWorkoutMinutes / 60);
    if (hours < 1) {
      parts.push(`Last workout: ${snapshot.timeSinceLastWorkoutMinutes}min ago`);
    } else if (hours < 24) {
      parts.push(`Last workout: ${hours}h ago`);
    } else {
      const days = Math.floor(hours / 24);
      parts.push(`Last workout: ${days}d ago`);
    }
  } else {
    parts.push('No recent workouts recorded');
  }

  parts.push(`Fatigue: ${snapshot.globalFatigue}% (${snapshot.freshMuscleCount} fresh, ${snapshot.fatiguedMuscleCount} fatigued)`);
  parts.push(`Recommended intensity: ${snapshot.recommendedIntensity}`);

  if (snapshot.currentWindow !== 'FLEXIBLE') {
    parts.push(`Current window: ${snapshot.currentWindow.replace(/_/g, ' ').toLowerCase()}`);
  }

  return parts.join('. ') + '.';
}

/**
 * Generate dashboard-ready status label and color hint.
 */
export function getStatusDisplay(snapshot: ReadinessSnapshot): {
  label: string;
  sublabel: string;
  colorKey: 'success' | 'warning' | 'error' | 'accent';
  icon: string;
} {
  switch (snapshot.status) {
    case 'READY':
      return {
        label: 'Ready to Train',
        sublabel: snapshot.recommendation,
        colorKey: 'success',
        icon: 'lightning-bolt',
      };
    case 'MODERATE':
      return {
        label: 'Moderate Readiness',
        sublabel: snapshot.recommendation,
        colorKey: 'warning',
        icon: 'battery-medium',
      };
    case 'FATIGUED':
      return {
        label: 'Fatigued',
        sublabel: snapshot.recommendation,
        colorKey: 'warning',
        icon: 'battery-low',
      };
    case 'RECOVERY_NEEDED':
      return {
        label: 'Recovery Day',
        sublabel: snapshot.recommendation,
        colorKey: 'error',
        icon: 'sleep',
      };
  }
}

export { READINESS_CONFIG };
