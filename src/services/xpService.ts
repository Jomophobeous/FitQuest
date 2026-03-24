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
import { getXPMultiplier, checkMilestoneReached } from './rankingService';
import { logEvent } from './telemetry';
import { walService } from './WriteAheadLogService';

// ============================================
// TYPES
// ============================================

export interface XPData {
  totalXP: number;
  level: number;
  currentLevelXP: number; // XP earned within current level
  xpToNextLevel: number; // XP needed to reach next level
  progressPercent: number; // 0-100
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
  const safeXpToNext = Math.max(1, xpToNext);
  return {
    totalXP,
    level,
    currentLevelXP,
    xpToNextLevel: xpToNext,
    progressPercent: Math.round((currentLevelXP / safeXpToNext) * 100),
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
  streakDays: number = 0,
): Promise<XPGainResult> {
  const baseXP = 100;
  const exerciseXP = completedExercises * 20;
  const completionBonus = completedExercises >= totalExercises ? 50 : 0;
  const streakBonus = streakDays * 10;
  const rawGain = baseXP + exerciseXP + completionBonus + streakBonus;

  // Apply rank-based XP multiplier (rewards long-term consistency)
  const currentData = await getXPData();
  const multiplier = getXPMultiplier(currentData.level);
  const totalGain = Math.round(rawGain * multiplier);

  return addXP(totalGain);
}

/**
 * Award XP for steps (4 XP per 1,000 steps)
 * Tracks previously-awarded steps to give incremental XP
 */
export async function awardStepXP(steps: number): Promise<XPGainResult | null> {
  const today = new Date().toISOString().split('T')[0]!;
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
  if (amount <= 0)
    return { xpEarned: 0, levelUp: false, oldLevel: 0, newLevel: 0, data: buildXPData(await loadTotalXP()) };
  const oldTotal = await loadTotalXP();
  const oldData = buildXPData(oldTotal);

  const newTotal = oldTotal + amount;

  const walId = await walService.logIntent({
    operation: 'add_xp',
    table_name: 'app_state',
    record_id: 'user_total_xp',
    payload: { amount, oldTotal, newTotal },
  });
  try {
    await saveTotalXP(newTotal);
    await walService.commit(walId);
  } catch (error) {
    await walService.markFailed(walId).catch(() => {});
    throw error;
  }

  const newData = buildXPData(newTotal);

  void logEvent('xp_earned', {
    xp_amount: amount,
    new_total: newTotal,
    new_level: newData.level,
    level_up: newData.level > oldData.level,
  });

  return {
    xpEarned: amount,
    levelUp: newData.level > oldData.level,
    oldLevel: oldData.level,
    newLevel: newData.level,
    data: newData,
  };
}

// ============================================
// MIND XP — Cognitive Fitness Leveling
// ============================================

export interface MindXPData {
  totalMindXP: number;
  mindLevel: number;
  currentLevelXP: number;
  xpToNextLevel: number;
  progressPercent: number;
  pagesReadTotal: number;
  flashcardsReviewedTotal: number;
  documentsCompleted: number;
}

const MIND_XP_PER_LEVEL = 200;

/**
 * Content quality multiplier — higher-quality material yields more XP.
 * "Brainrot" (low reading level, very short) provides less XP.
 */
export function getContentQualityMultiplier(doc: {
  reading_level?: string | null;
  word_count?: number | null;
  category?: string;
}): number {
  let multiplier = 1.0;

  // Reading level affects XP: advanced = 1.5x, intermediate = 1.0x, beginner/low = 0.5x
  const level = doc.reading_level?.toLowerCase();
  if (level) {
    if (level.includes('college') || level.includes('advanced') || level.includes('graduate')) {
      multiplier = 1.5;
    } else if (level.includes('high school') || level.includes('intermediate')) {
      multiplier = 1.0;
    } else if (level.includes('elementary') || level.includes('beginner') || level.includes('easy')) {
      multiplier = 0.5;
    }
  }

  // Very short documents (< 500 words) are likely low-effort content
  const words = doc.word_count ?? 0;
  if (words > 0 && words < 500) {
    multiplier *= 0.6;
  } else if (words >= 5000) {
    multiplier *= 1.2; // Substantial reads get a bonus
  }

  return Math.max(0.3, Math.min(2.0, multiplier));
}

/**
 * Award Mind XP for reading pages
 * Base: 5 XP per page × content quality multiplier
 */
export async function awardReadingXP(
  pagesRead: number,
  durationMinutes: number,
  contentQuality: number = 1.0,
): Promise<{ xpEarned: number; mindLevel: number; levelUp: boolean }> {
  try {
    const { awardMindXP } = await import('../database/service');
    const baseXP = pagesRead * 5;
    const durationBonus = Math.floor(durationMinutes / 10) * 3; // 3 XP per 10 min focused reading
    const totalXP = Math.max(1, Math.round((baseXP + durationBonus) * contentQuality));

    const result = await awardMindXP('user_local_001', totalXP, 'reading');
    return {
      xpEarned: totalXP,
      mindLevel: result.mind_level,
      levelUp: result.levelUp,
    };
  } catch (e) {
    if (__DEV__) console.warn('[XP] Failed to award reading XP:', e);
    return { xpEarned: 0, mindLevel: 1, levelUp: false };
  }
}

/**
 * Award Mind XP for flashcard review
 * Base: 3 XP per card, 5 XP if correct
 */
export async function awardFlashcardXP(
  cardsReviewed: number,
  correctCount: number = 0,
): Promise<{ xpEarned: number; mindLevel: number; levelUp: boolean }> {
  try {
    const { awardMindXP } = await import('../database/service');
    const xp = cardsReviewed * 3 + correctCount * 2;
    const result = await awardMindXP('user_local_001', xp, 'flashcard');
    return { xpEarned: xp, mindLevel: result.mind_level, levelUp: result.levelUp };
  } catch (e) {
    if (__DEV__) console.warn('[XP] Failed to award flashcard XP:', e);
    return { xpEarned: 0, mindLevel: 1, levelUp: false };
  }
}

/**
 * Award Mind XP for completing a document
 * Base: 50 XP × content quality multiplier
 */
export async function awardDocumentCompleteXP(
  contentQuality: number = 1.0,
): Promise<{ xpEarned: number; mindLevel: number; levelUp: boolean }> {
  try {
    const { awardMindXP } = await import('../database/service');
    const xp = Math.max(10, Math.round(50 * contentQuality));
    const result = await awardMindXP('user_local_001', xp, 'document_complete');
    return { xpEarned: xp, mindLevel: result.mind_level, levelUp: result.levelUp };
  } catch (e) {
    if (__DEV__) console.warn('[XP] Failed to award document complete XP:', e);
    return { xpEarned: 0, mindLevel: 1, levelUp: false };
  }
}

/**
 * Get current Mind XP data
 */
export async function getMindXPData(): Promise<MindXPData> {
  try {
    const { getMindXP } = await import('../database/service');
    const data = await getMindXP('user_local_001');
    if (!data) {
      return {
        totalMindXP: 0,
        mindLevel: 1,
        currentLevelXP: 0,
        xpToNextLevel: MIND_XP_PER_LEVEL,
        progressPercent: 0,
        pagesReadTotal: 0,
        flashcardsReviewedTotal: 0,
        documentsCompleted: 0,
      };
    }
    const currentLevelXP = data.total_mind_xp % MIND_XP_PER_LEVEL;
    return {
      totalMindXP: data.total_mind_xp,
      mindLevel: data.mind_level,
      currentLevelXP,
      xpToNextLevel: MIND_XP_PER_LEVEL,
      progressPercent: Math.round((currentLevelXP / MIND_XP_PER_LEVEL) * 100),
      pagesReadTotal: data.pages_read_total,
      flashcardsReviewedTotal: data.flashcards_reviewed_total,
      documentsCompleted: data.documents_completed,
    };
  } catch (e) {
    if (__DEV__) console.warn('[XP] Failed to get mind XP data:', e);
    return {
      totalMindXP: 0,
      mindLevel: 1,
      currentLevelXP: 0,
      xpToNextLevel: MIND_XP_PER_LEVEL,
      progressPercent: 0,
      pagesReadTotal: 0,
      flashcardsReviewedTotal: 0,
      documentsCompleted: 0,
    };
  }
}
