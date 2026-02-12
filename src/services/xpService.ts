/**
 * FitQuest XP & Leveling Service
 * Persisted XP system using app_state table in SQLite
 * 
 * XP Sources:
 * - Workout completion: 100 XP base + 20 per exercise completed
 * - Movement (steps): 4 XP per 1,000 steps (awarded incrementally)
 * - Jog session: 10 XP per 100m jogged
 * - Streak bonus: streak_days × 10 XP per workout
 * 
 * Level Formula: XP needed = 250 × level (level 1 = 250 XP, level 2 = 500 XP, etc.)
 * This ensures a single workout cannot inflate past level 2.
 */

import { getAppState, setAppState } from '../database/service';

// ============================================
// TYPES
// ============================================

export interface XPData {
  totalXP: number;
  level: number;
  currentLevelXP: number;   // XP earned within current level
  xpToNextLevel: number;    // XP needed to reach next level
  progressPercent: number;  // 0-100
}

export interface XPGainResult {
  xpEarned: number;
  levelUp: boolean;
  oldLevel: number;
  newLevel: number;
  data: XPData;
}

// ============================================
// XP CALCULATION
// ============================================

const XP_PER_LEVEL_MULTIPLIER = 250; // Level N needs N × 250 XP

function xpNeededForLevel(level: number): number {
  return level * XP_PER_LEVEL_MULTIPLIER;
}

function calculateLevel(totalXP: number): { level: number; currentLevelXP: number } {
  let level = 1;
  let remaining = totalXP;
  while (remaining >= xpNeededForLevel(level)) {
    remaining -= xpNeededForLevel(level);
    level++;
  }
  return { level, currentLevelXP: remaining };
}

function buildXPData(totalXP: number): XPData {
  const { level, currentLevelXP } = calculateLevel(totalXP);
  const xpToNext = xpNeededForLevel(level);
  return {
    totalXP,
    level,
    currentLevelXP,
    xpToNextLevel: xpToNext,
    progressPercent: Math.round((currentLevelXP / xpToNext) * 100),
  };
}

// ============================================
// PERSISTENCE (app_state table)
// ============================================

const XP_KEY = 'user_total_xp';
const DAILY_STEP_XP_KEY = 'daily_step_xp_date'; // tracks last day step XP was awarded

async function loadTotalXP(): Promise<number> {
  const val = await getAppState(XP_KEY);
  return val ? parseInt(val, 10) : 0;
}

async function saveTotalXP(xp: number): Promise<void> {
  await setAppState(XP_KEY, xp.toString());
}

// ============================================
// XP AWARD FUNCTIONS
// ============================================

/**
 * Get current XP data
 */
export async function getXPData(): Promise<XPData> {
  const totalXP = await loadTotalXP();
  return buildXPData(totalXP);
}

/**
 * Award XP for completing a workout
 */
export async function awardWorkoutXP(
  completedExercises: number,
  totalExercises: number,
  streakDays: number = 0
): Promise<XPGainResult> {
  const baseXP = 100;
  const exerciseXP = completedExercises * 20;
  const completionBonus = completedExercises >= totalExercises ? 50 : 0;
  const streakBonus = streakDays * 10;
  const totalGain = baseXP + exerciseXP + completionBonus + streakBonus;
  
  return addXP(totalGain);
}

/**
 * Award XP for steps (4 XP per 1,000 steps)
 * Tracks previously-awarded steps to give incremental XP
 */
export async function awardStepXP(steps: number): Promise<XPGainResult | null> {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = await getAppState(DAILY_STEP_XP_KEY);
  const prevStepsKey = 'daily_step_xp_prev_steps';

  // Reset counter for a new day
  let prevSteps = 0;
  if (lastDate === today) {
    const prev = await getAppState(prevStepsKey);
    prevSteps = prev ? parseInt(prev, 10) : 0;
  }

  // Calculate incremental XP: 4 XP per 1,000 steps
  const prevXP = Math.floor(prevSteps / 1000) * 4;
  const currentXP = Math.floor(steps / 1000) * 4;
  const xpToAward = currentXP - prevXP;

  if (xpToAward <= 0) return null;

  await setAppState(DAILY_STEP_XP_KEY, today);
  await setAppState(prevStepsKey, steps.toString());
  return addXP(xpToAward);
}

/**
 * Award XP for completing a jog session
 * 10 XP per 100m (0.1 km) jogged
 */
export async function awardJogXP(distanceMeters: number): Promise<XPGainResult> {
  const xp = Math.max(Math.floor(distanceMeters / 100) * 10, 1); // 10 XP per 100m, minimum 1 XP
  return addXP(xp);
}

/**
 * Award XP for taking a progress photo
 */
export async function awardProgressPhotoXP(): Promise<XPGainResult> {
  return addXP(25);
}

/**
 * Generic add XP function
 */
export async function addXP(amount: number): Promise<XPGainResult> {
  const oldTotal = await loadTotalXP();
  const oldData = buildXPData(oldTotal);
  
  const newTotal = oldTotal + amount;
  await saveTotalXP(newTotal);
  
  const newData = buildXPData(newTotal);
  
  return {
    xpEarned: amount,
    levelUp: newData.level > oldData.level,
    oldLevel: oldData.level,
    newLevel: newData.level,
    data: newData,
  };
}
