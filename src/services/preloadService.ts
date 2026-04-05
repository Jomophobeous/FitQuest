/**
 * Preload Service — Predictive background data warming.
 *
 * Preloads adjacent screen data silently so navigation feels instant.
 * All operations are fire-and-forget with error swallowing.
 *
 * Preload map:
 *   Dashboard  → Profile + Workout (fitquest) + Settings
 *   Profile    → Settings + adaptive profile data
 *   Workout    → Exercise list, saved workouts
 *
 * Phase 5 implementation.
 */

import { setCached, hasCached } from './cacheStoreService';
import {
  getUserProfile,
  getUserProgress,
  getStreak,
  getMuscleFatigue,
  getRecentSessions,
  getAppState,
} from '../database/service';
import { getXPData } from './xpService';
import { getCachedReadiness } from '../engines/ReadinessEngine';
import { getAdaptiveTrainingProfile } from './adaptiveTrainingService';

const USER_ID = 'user_local_001';
const PRELOAD_TTL_MS = 5 * 60 * 1000; // 5 min TTL for preloaded data

/** Silently swallow errors and cache failures — preloads must never break UI */
function safe<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch(() => null);
}

// ── Profile preload ──

export async function preloadProfileData(): Promise<void> {
  if (hasCached('preload', 'profile')) return; // already warm

  const [profile, progress, streak, xp, adaptive] = await Promise.all([
    safe(getUserProfile(USER_ID)),
    safe(getUserProgress()),
    safe(getStreak(USER_ID)),
    safe(getXPData()),
    safe(getAdaptiveTrainingProfile(USER_ID)),
  ]);

  await setCached('preload', 'profile', { profile, progress, streak, xp, adaptive }, PRELOAD_TTL_MS);
}

// ── Dashboard preload ──

export async function preloadDashboardData(): Promise<void> {
  if (hasCached('preload', 'dashboard')) return;

  const [progress, sessions, fatigue, readiness] = await Promise.all([
    safe(getUserProgress()),
    safe(getRecentSessions(USER_ID, 5)),
    safe(getMuscleFatigue(USER_ID)),
    safe(getCachedReadiness(USER_ID)),
  ]);

  await setCached('preload', 'dashboard', { progress, sessions, fatigue, readiness }, PRELOAD_TTL_MS);
}

// ── Settings preload ──

export async function preloadSettingsData(): Promise<void> {
  if (hasCached('preload', 'settings')) return;

  const [notifState, mealRegion] = await Promise.all([
    safe(getAppState('notification.settings')),
    safe(getAppState('meal.region_override')),
  ]);

  await setCached('preload', 'settings', { notifState, mealRegion }, PRELOAD_TTL_MS);
}

// ── Workout/FitQuest preload ──

export async function preloadWorkoutData(): Promise<void> {
  if (hasCached('preload', 'workout')) return;

  const [fatigue, readiness, sessions] = await Promise.all([
    safe(getMuscleFatigue(USER_ID)),
    safe(getCachedReadiness(USER_ID)),
    safe(getRecentSessions(USER_ID, 3)),
  ]);

  await setCached('preload', 'workout', { fatigue, readiness, sessions }, PRELOAD_TTL_MS);
}

// ── Preload triggers per screen ──

/**
 * Call this when Dashboard mounts.
 * Warms Profile + Workout caches in the background.
 */
export function preloadFromDashboard(): void {
  setTimeout(() => {
    void preloadProfileData();
    void preloadWorkoutData();
    void preloadSettingsData();
  }, 1200); // Wait after first render — don't race mount
}

/**
 * Call this when Profile mounts.
 * Warms Settings cache.
 */
export function preloadFromProfile(): void {
  setTimeout(() => {
    void preloadSettingsData();
  }, 800);
}

/**
 * Call this when FitQuest/Workout mounts.
 * Warms Dashboard cache (returning to dashboard should be instant).
 */
export function preloadFromWorkout(): void {
  setTimeout(() => {
    void preloadDashboardData();
  }, 1000);
}

/** Read preloaded profile data (consumed by useProfileViewModel) */
export async function getPreloadedProfileData(): Promise<{
  profile: Awaited<ReturnType<typeof getUserProfile>>;
  progress: Awaited<ReturnType<typeof getUserProgress>> | null;
  streak: { current: number; longest: number } | null;
  xp: Awaited<ReturnType<typeof getXPData>> | null;
  adaptive: Awaited<ReturnType<typeof getAdaptiveTrainingProfile>> | null;
} | null> {
  const { getCached } = await import('./cacheStoreService');
  const cached = await getCached<{
    profile: Awaited<ReturnType<typeof getUserProfile>>;
    progress: Awaited<ReturnType<typeof getUserProgress>> | null;
    streak: { current: number; longest: number } | null;
    xp: Awaited<ReturnType<typeof getXPData>> | null;
    adaptive: Awaited<ReturnType<typeof getAdaptiveTrainingProfile>> | null;
  }>('preload', 'profile');
  return cached.value;
}
