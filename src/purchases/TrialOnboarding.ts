/**
 * FitQuest Trial Onboarding
 * 
 * Manages the 14-day trial experience with scheduled engagement
 * notifications at key moments: Day 0, 3, 7, 12, 14.
 */

import { getDatabase } from '../database';

// ============================================
// TYPES
// ============================================

interface TrialStats {
  workouts: number;
  pagesRead: number;
  stepsTotal: number;
  daysActive: number;
}

// ============================================
// TRIAL ONBOARDING
// ============================================

export class TrialOnboarding {
  private static instance: TrialOnboarding | null = null;

  static getInstance(): TrialOnboarding {
    if (!this.instance) {
      this.instance = new TrialOnboarding();
    }
    return this.instance;
  }

  async startTrialExperience(): Promise<void> {
    const db = await getDatabase();
    const userId = 'user_local_001';
    const now = Date.now();
    const trialEnd = now + 14 * 24 * 60 * 60 * 1000;

    // Record trial start
    await db.runAsync(`
      INSERT OR REPLACE INTO trial_state 
      (user_id, started_at, ends_at, converted, notifications_sent)
      VALUES (?, ?, ?, 0, ?)
    `, [userId, now, trialEnd, JSON.stringify(['day0'])]);

    // Schedule notifications via Expo Notifications
    await this.scheduleDay0();
    await this.scheduleDay3();
    await this.scheduleDay7();
    await this.scheduleDay12();
    await this.scheduleDay14();
  }

  async getTrialStats(): Promise<TrialStats> {
    const db = await getDatabase();
    const userId = 'user_local_001';

    const trial = await db.getFirstAsync<{ started_at: number }>(
      'SELECT started_at FROM trial_state WHERE user_id = ?', [userId]
    );
    const startedAt = trial?.started_at ?? Date.now();

    // Workouts since trial start
    const workoutResult = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM workout_sessions 
       WHERE user_id = ? AND started_at >= ?`,
      [userId, startedAt]
    );

    // Steps since trial start
    const stepResult = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(steps), 0) as total FROM daily_steps 
       WHERE user_id = ? AND date >= ?`,
      [userId, new Date(startedAt).toISOString().split('T')[0]]
    );

    // Reading sessions since trial
    const readingResult = await db.getFirstAsync<{ pages: number }>(
      `SELECT COALESCE(SUM(pages_read), 0) as pages FROM fitmind_reading_sessions 
       WHERE started_at >= ?`,
      [startedAt]
    );

    // Active days
    const activeDays = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(DISTINCT date) as cnt FROM daily_steps 
       WHERE user_id = ? AND date >= ? AND steps > 100`,
      [userId, new Date(startedAt).toISOString().split('T')[0]]
    );

    return {
      workouts: workoutResult?.cnt ?? 0,
      pagesRead: readingResult?.pages ?? 0,
      stepsTotal: stepResult?.total ?? 0,
      daysActive: activeDays?.cnt ?? 0,
    };
  }

  async getTrialDayNumber(): Promise<number> {
    const db = await getDatabase();
    const trial = await db.getFirstAsync<{ started_at: number }>(
      'SELECT started_at FROM trial_state WHERE user_id = ?', ['user_local_001']
    );
    if (!trial) return 0;
    return Math.floor((Date.now() - trial.started_at) / (1000 * 60 * 60 * 24));
  }

  async hasFeatureBeenUsed(feature: 'workout' | 'fitmind' | 'health' | 'analytics'): Promise<boolean> {
    const db = await getDatabase();
    const userId = 'user_local_001';

    switch (feature) {
      case 'workout': {
        const r = await db.getFirstAsync<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM workout_sessions WHERE user_id = ?', [userId]
        );
        return (r?.cnt ?? 0) > 0;
      }
      case 'fitmind': {
        const r = await db.getFirstAsync<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM fitmind_documents'
        );
        return (r?.cnt ?? 0) > 0;
      }
      case 'health': {
        const r = await db.getFirstAsync<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM daily_health_summaries WHERE user_id = ?', [userId]
        );
        return (r?.cnt ?? 0) > 0;
      }
      case 'analytics': {
        // Analytics is visited if we have step data
        const r = await db.getFirstAsync<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM daily_steps WHERE user_id = ?', [userId]
        );
        return (r?.cnt ?? 0) > 3;
      }
      default:
        return false;
    }
  }

  // ── Notification Scheduling (uses expo-notifications when available) ──

  private async getNotificationModule(): Promise<any | null> {
    try {
      return require('expo-notifications');
    } catch {
      return null;
    }
  }

  private async scheduleDay0(): Promise<void> {
    const Notifications = await this.getNotificationModule();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 Your 14-Day Trial Started',
          body: 'Full access to all FitQuest features. No limits.',
          data: { type: 'TRIAL_STARTED' },
        },
        trigger: null, // Immediately
      });
    } catch (e) {
      console.log('[TrialOnboarding] Day 0 notification error:', e);
    }
  }

  private async scheduleDay3(): Promise<void> {
    const Notifications = await this.getNotificationModule();
    if (!Notifications) return;

    const hasDoc = await this.hasFeatureBeenUsed('fitmind');
    if (!hasDoc) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '📚 Try FitMind',
            body: 'Import a book and see how AI helps you learn faster.',
            data: { type: 'FEATURE_PROMPT', feature: 'fitmind' },
          },
          trigger: { seconds: 3 * 24 * 60 * 60, type: 'timeInterval' as any },
        });
      } catch (e) {
        console.log('[TrialOnboarding] Day 3 notification error:', e);
      }
    }
  }

  private async scheduleDay7(): Promise<void> {
    const Notifications = await this.getNotificationModule();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📊 Your Week 1 Progress',
          body: 'Check your analytics to see how far you\'ve come!',
          data: { type: 'PROGRESS_CHECKIN' },
        },
        trigger: { seconds: 7 * 24 * 60 * 60, type: 'timeInterval' as any },
      });
    } catch (e) {
      console.log('[TrialOnboarding] Day 7 notification error:', e);
    }
  }

  private async scheduleDay12(): Promise<void> {
    const Notifications = await this.getNotificationModule();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏳ 3 Days Left',
          body: 'Subscribe to keep your data and continue your progress.',
          data: { type: 'TRIAL_ENDING_SOON' },
        },
        trigger: { seconds: 12 * 24 * 60 * 60, type: 'timeInterval' as any },
      });
    } catch (e) {
      console.log('[TrialOnboarding] Day 12 notification error:', e);
    }
  }

  private async scheduleDay14(): Promise<void> {
    const Notifications = await this.getNotificationModule();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔒 Last Day of Trial',
          body: 'Subscribe now to continue with full access.',
          data: { type: 'TRIAL_LAST_DAY' },
        },
        trigger: { seconds: 14 * 24 * 60 * 60, type: 'timeInterval' as any },
      });
    } catch (e) {
      console.log('[TrialOnboarding] Day 14 notification error:', e);
    }
  }
}

export const trialOnboarding = TrialOnboarding.getInstance();
