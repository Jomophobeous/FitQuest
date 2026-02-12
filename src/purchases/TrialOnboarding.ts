/**
 * FitQuest Trial Onboarding
 * 
 * Manages the 14-day trial experience with scheduled engagement
 * notifications at key moments: Day 0, 3, 7, 12, 14.
 */

import { getTrialStartedAt, getTrialStats, upsertTrialState } from '../database/service';

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
    const userId = 'user_local_001';
    const now = Date.now();
    const trialEnd = now + 14 * 24 * 60 * 60 * 1000;

    // Record trial start
    await upsertTrialState({
      user_id: userId,
      started_at: now,
      ends_at: trialEnd,
      converted: 0,
      product_identifier: null,
      notifications_sent: JSON.stringify(['day0']),
    });

    // Schedule notifications via Expo Notifications
    await this.scheduleDay0();
    await this.scheduleDay3();
    await this.scheduleDay7();
    await this.scheduleDay12();
    await this.scheduleDay14();
  }

  async getTrialStats(): Promise<TrialStats> {
    const userId = 'user_local_001';
    const startedAt = (await getTrialStartedAt(userId)) ?? Date.now();
    return getTrialStats(userId, startedAt);
  }

  async getTrialDayNumber(): Promise<number> {
    const startedAt = await getTrialStartedAt('user_local_001');
    if (!startedAt) return 0;
    return Math.floor((Date.now() - startedAt) / (1000 * 60 * 60 * 24));
  }

  async hasFeatureBeenUsed(feature: 'workout' | 'fitmind' | 'health' | 'analytics'): Promise<boolean> {
    const userId = 'user_local_001';

    switch (feature) {
      case 'workout': {
        const stats = await getTrialStats(userId, 0);
        return stats.workouts > 0;
      }
      case 'fitmind': {
        const stats = await getTrialStats(userId, 0);
        return stats.pagesRead > 0;
      }
      case 'health': {
        const stats = await getTrialStats(userId, 0);
        return stats.stepsTotal > 0;
      }
      case 'analytics': {
        const stats = await getTrialStats(userId, 0);
        return stats.stepsTotal > 0;
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
