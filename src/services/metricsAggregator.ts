/**
 * SERVICE — Metrics Aggregator (Block AA)
 *
 * Computes retention and engagement metrics from existing data.
 * All reads from SQLite. No new tables. Pure computation.
 *
 * Metrics:
 * - D1 / D7 / D30 retention
 * - Session frequency (sessions per week)
 * - Workout completion rate
 * - Churn risk %
 * - Funnel completion rates
 */

import { getAppState, setAppState, getRecentSessions, getStreak } from '../database/service';
import { getCachedUserState, getUserState, type UserState } from '../engines/UserStateEngine';

// ============================================
// TYPES
// ============================================

export interface RetentionMetrics {
  /** Whether user returned on day 1 after first use */
  d1Retained: boolean;
  /** Whether user returned on day 7 */
  d7Retained: boolean;
  /** Whether user returned on day 30 */
  d30Retained: boolean;
  /** Days since first app open */
  daysSinceInstall: number;
}

export interface EngagementMetrics {
  /** Average sessions per week (last 4 weeks) */
  sessionsPerWeek: number;
  /** Workout completion rate (completed / started) */
  workoutCompletionRate: number;
  /** Current streak */
  currentStreak: number;
  /** Longest streak */
  longestStreak: number;
  /** Churn risk (from UserState) */
  churnRisk: boolean;
  /** Engagement level */
  engagementLevel: string;
}

export interface FunnelMetrics {
  /** Whether onboarding was completed */
  onboardingCompleted: boolean;
  /** Whether at least 1 workout was done */
  firstWorkoutDone: boolean;
  /** Whether paywall was ever shown */
  paywallSeen: boolean;
  /** Whether user converted (subscribed) */
  converted: boolean;
}

export interface AggregatedMetrics {
  retention: RetentionMetrics;
  engagement: EngagementMetrics;
  funnel: FunnelMetrics;
  computedAt: number;
}

// ============================================
// CORE
// ============================================

/**
 * Compute all aggregated metrics.
 * Designed to run periodically (e.g., once per day) or on-demand.
 */
export async function computeMetrics(userId: string, isSubscribed = false): Promise<AggregatedMetrics> {
  const [retention, engagement, funnel] = await Promise.all([
    computeRetention(),
    computeEngagement(userId, isSubscribed),
    computeFunnel(userId, isSubscribed),
  ]);

  return {
    retention,
    engagement,
    funnel,
    computedAt: Date.now(),
  };
}

// ============================================
// RETENTION
// ============================================

async function computeRetention(): Promise<RetentionMetrics> {
  const installDateStr = await getAppState('app.install_date').catch(() => null);
  const installDate = installDateStr ? new Date(installDateStr).getTime() : Date.now();
  const daysSinceInstall = Math.floor((Date.now() - installDate) / 86_400_000);

  // Check return dates from daily return log
  const d1Date = new Date(installDate + 86_400_000).toISOString().split('T')[0]!;
  const d7Date = new Date(installDate + 7 * 86_400_000).toISOString().split('T')[0]!;
  const d30Date = new Date(installDate + 30 * 86_400_000).toISOString().split('T')[0]!;

  const d1Return = await getAppState(`session.${d1Date}`).catch(() => null);
  const d7Return = await getAppState(`session.${d7Date}`).catch(() => null);
  const d30Return = await getAppState(`session.${d30Date}`).catch(() => null);

  return {
    d1Retained: !!d1Return,
    d7Retained: !!d7Return,
    d30Retained: !!d30Return,
    daysSinceInstall,
  };
}

// ============================================
// ENGAGEMENT
// ============================================

async function computeEngagement(userId: string, isSubscribed: boolean): Promise<EngagementMetrics> {
  const userState: UserState | null =
    getCachedUserState() || (await getUserState(userId, isSubscribed).catch(() => null));

  const streak = await getStreak(userId).catch(() => ({ current: 0, longest: 0 }));
  const sessions = await getRecentSessions(userId, 30).catch(() => []);

  // Sessions per week (last 4 weeks)
  const fourWeeksAgo = Date.now() - 28 * 86_400_000;
  const recentSessions = sessions.filter((s) => new Date(s.started_at).getTime() >= fourWeeksAgo);
  const sessionsPerWeek = recentSessions.length / 4;

  // Completion rate
  const completed = sessions.filter((s) => s.completed_at);
  const workoutCompletionRate = sessions.length > 0 ? completed.length / sessions.length : 0;

  return {
    sessionsPerWeek: Math.round(sessionsPerWeek * 10) / 10,
    workoutCompletionRate: Math.round(workoutCompletionRate * 100) / 100,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    churnRisk: userState?.churnRisk ?? false,
    engagementLevel: userState?.engagementLevel ?? 'UNKNOWN',
  };
}

// ============================================
// FUNNEL
// ============================================

async function computeFunnel(userId: string, isSubscribed: boolean): Promise<FunnelMetrics> {
  const onboardingDone = !!(await getAppState('onboarding.completed').catch(() => null));
  const sessions = await getRecentSessions(userId, 1).catch(() => []);
  const firstWorkoutDone = sessions.length > 0;
  const paywallSeen = !!(await getAppState('growth.paywall_seen').catch(() => null));

  return {
    onboardingCompleted: onboardingDone,
    firstWorkoutDone,
    paywallSeen,
    converted: isSubscribed,
  };
}

/**
 * Persist metrics snapshot for historical tracking.
 * Call once per day from background health or app start.
 */
export async function persistMetricSnapshot(userId: string, isSubscribed = false): Promise<void> {
  const metrics = await computeMetrics(userId, isSubscribed);
  const today = new Date().toISOString().split('T')[0]!;
  await setAppState(`metrics.${today}`, JSON.stringify(metrics));
}
