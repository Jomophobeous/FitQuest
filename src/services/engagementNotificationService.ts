/**
 * Engagement Notification Service — Phase 11
 *
 * Schedules local notifications for user retention:
 *   1. Streak-at-risk alert (last workout > 20h ago, streak > 0)
 *   2. Inactivity nudge (no workout in 48h+)
 *   3. Weekly progress summary (Sunday 10am)
 *
 * Works alongside existing notificationReliabilityService.ts which handles
 * the daily workout reminder. This service adds engagement-specific triggers.
 *
 * All notifications are LOCAL — no push server required.
 * State persisted in app_state table via existing service.ts functions.
 */

import { getAppState, setAppState, getWorkoutStreakCurrent } from '../database/service';
import { getDatabase } from '../database/schema';

const PREFIX = 'engagement.notifications.';
const LAST_STREAK_ALERT_KEY = `${PREFIX}last_streak_alert`;
const LAST_INACTIVITY_NUDGE_KEY = `${PREFIX}last_inactivity_nudge`;
const LAST_WEEKLY_SUMMARY_KEY = `${PREFIX}last_weekly_summary`;
const STREAK_ALERT_ID_KEY = `${PREFIX}streak_alert_id`;
const INACTIVITY_NUDGE_ID_KEY = `${PREFIX}inactivity_nudge_id`;
const WEEKLY_SUMMARY_ID_KEY = `${PREFIX}weekly_summary_id`;

const USER_ID = 'user_local_001';
const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Motivational messages — rotate to avoid fatigue
const STREAK_MESSAGES = [
  'Your streak is at risk! One quick session keeps the chain alive.',
  "Don't break the chain — a 10-minute session counts!",
  'Your consistency is your superpower. Train today to keep it going.',
  "Streak alert: you haven't trained today. Even a light workout counts!",
];

const INACTIVITY_MESSAGES = [
  "It's been a while! Your body is ready for a comeback session.",
  "Missing your workouts? Let's get back on track today.",
  'Two days without training — your muscles are calling!',
  'Ready to restart? A short session today makes all the difference.',
];

const WEEKLY_MESSAGES = [
  'Weekly wrap-up: check your progress and plan the week ahead!',
  "New week, new goals. See how last week's training went.",
  "Sunday check-in: review your stats and set this week's targets.",
];

function pickMessage(pool: string[]): string {
  const dayOfYear = Math.floor(Date.now() / 86400000);
  return pool[dayOfYear % pool.length]!;
}

async function getNotifications(): Promise<any | null> {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

async function cancelExisting(key: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    const existingId = await getAppState(key);
    if (existingId && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    }
  } catch {
    // Ignore — notification may have already fired
  }
}

async function hasPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  try {
    const result = await Notifications.getPermissionsAsync();
    return result?.status === 'granted';
  } catch {
    return false;
  }
}

async function getLastWorkoutTimestamp(): Promise<number | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ last_date: string }>(
      `SELECT MAX(started_at) as last_date FROM workout_sessions WHERE user_id = ?`,
      [USER_ID],
    );
    if (!row?.last_date) return null;
    return new Date(row.last_date).getTime();
  } catch {
    return null;
  }
}

async function getWeeklyStats(): Promise<{ workouts: number; exercises: number; streak: number }> {
  try {
    const db = await getDatabase();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const row = await db.getFirstAsync<{ count: number; exercises: number }>(
      `SELECT COUNT(*) as count, COALESCE(SUM(completed_exercises), 0) as exercises 
       FROM workout_sessions WHERE user_id = ? AND started_at > ?`,
      [USER_ID, weekAgo],
    );
    const streak = await getWorkoutStreakCurrent(USER_ID);
    return {
      workouts: row?.count ?? 0,
      exercises: row?.exercises ?? 0,
      streak,
    };
  } catch {
    return { workouts: 0, exercises: 0, streak: 0 };
  }
}

// ──────────────────────────────────────────────
// STREAK-AT-RISK ALERT
// ──────────────────────────────────────────────

export async function scheduleStreakAlert(): Promise<boolean> {
  if (!(await hasPermission())) return false;
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const streak = await getWorkoutStreakCurrent(USER_ID);
  if (streak <= 0) return false; // No streak to protect

  const lastWorkout = await getLastWorkoutTimestamp();
  if (!lastWorkout) return false;

  const hoursSinceLastWorkout = (Date.now() - lastWorkout) / (1000 * 60 * 60);

  // Only alert if they haven't trained in 20+ hours but still have a streak
  if (hoursSinceLastWorkout < 20) return false;

  // Don't send more than once per 24h
  const lastAlert = await getAppState(LAST_STREAK_ALERT_KEY);
  if (lastAlert && Date.now() - Number(lastAlert) < TWENTY_FOUR_HOURS_MS) return false;

  await cancelExisting(STREAK_ALERT_ID_KEY);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔥 ${streak}-Day Streak at Risk!`,
        body: pickMessage(STREAK_MESSAGES),
        data: { type: 'STREAK_AT_RISK', streak },
      },
      trigger: null, // Send immediately
    });

    await setAppState(STREAK_ALERT_ID_KEY, String(id || ''));
    await setAppState(LAST_STREAK_ALERT_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// INACTIVITY NUDGE
// ──────────────────────────────────────────────

export async function scheduleInactivityNudge(): Promise<boolean> {
  if (!(await hasPermission())) return false;
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const lastWorkout = await getLastWorkoutTimestamp();
  if (!lastWorkout) return false;

  const timeSinceWorkout = Date.now() - lastWorkout;
  if (timeSinceWorkout < FORTY_EIGHT_HOURS_MS) return false;

  // Don't nudge more than once per 48h
  const lastNudge = await getAppState(LAST_INACTIVITY_NUDGE_KEY);
  if (lastNudge && Date.now() - Number(lastNudge) < FORTY_EIGHT_HOURS_MS) return false;

  await cancelExisting(INACTIVITY_NUDGE_ID_KEY);

  try {
    const daysSince = Math.floor(timeSinceWorkout / TWENTY_FOUR_HOURS_MS);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💪 ${daysSince} Days Since Last Workout`,
        body: pickMessage(INACTIVITY_MESSAGES),
        data: { type: 'INACTIVITY_NUDGE', daysSince },
      },
      trigger: null,
    });

    await setAppState(INACTIVITY_NUDGE_ID_KEY, String(id || ''));
    await setAppState(LAST_INACTIVITY_NUDGE_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// WEEKLY PROGRESS SUMMARY
// ──────────────────────────────────────────────

export async function scheduleWeeklySummary(): Promise<boolean> {
  if (!(await hasPermission())) return false;
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  // Only send on Sundays (or if it hasn't been sent this week)
  const lastSummary = await getAppState(LAST_WEEKLY_SUMMARY_KEY);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (lastSummary && Date.now() - Number(lastSummary) < sevenDaysMs) return false;

  const stats = await getWeeklyStats();

  await cancelExisting(WEEKLY_SUMMARY_ID_KEY);

  try {
    const streakText = stats.streak > 0 ? ` | ${stats.streak}-day streak` : '';
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Your Week in Review',
        body: `${stats.workouts} workouts, ${stats.exercises} exercises${streakText}. ${pickMessage(WEEKLY_MESSAGES)}`,
        data: { type: 'WEEKLY_SUMMARY', ...stats },
      },
      trigger: null,
    });

    await setAppState(WEEKLY_SUMMARY_ID_KEY, String(id || ''));
    await setAppState(LAST_WEEKLY_SUMMARY_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────
// RECONCILER — run on app start / background wake
// ──────────────────────────────────────────────

export interface EngagementReconcileResult {
  streakAlert: boolean;
  inactivityNudge: boolean;
  weeklySummary: boolean;
}

/**
 * Check all engagement notification triggers.
 * Safe to call frequently — each trigger has its own cooldown.
 * Call this from _layout.tsx on app start alongside the existing
 * reconcileNotificationReliability() call.
 */
export async function reconcileEngagementNotifications(): Promise<EngagementReconcileResult> {
  const [streakAlert, inactivityNudge, weeklySummary] = await Promise.all([
    scheduleStreakAlert().catch(() => false),
    scheduleInactivityNudge().catch(() => false),
    scheduleWeeklySummary().catch(() => false),
  ]);

  return { streakAlert, inactivityNudge, weeklySummary };
}
