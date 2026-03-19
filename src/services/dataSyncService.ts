/**
 * FitQuest Data Sync Service
 *
 * Centralized data synchronization layer that:
 * - Provides event-based data freshness notifications
 * - Ensures all screens re-fetch when data changes
 * - Coordinates writes across the app
 * - Tracks data staleness and triggers refreshes
 * - Provides optimistic update patterns
 *
 * Architecture: Event emitter pattern with typed channels.
 * Screens subscribe to channels they care about and get notified
 * when underlying data changes (e.g. workout completed → dashboard refreshes).
 */

// ============================================
// TYPES
// ============================================

/** Data channels that screens can subscribe to */
export type DataChannel =
  | 'workout_completed'
  | 'workout_started'
  | 'workout_cancelled'
  | 'exercise_completed'
  | 'profile_updated'
  | 'steps_updated'
  | 'jog_completed'
  | 'xp_awarded'
  | 'level_up'
  | 'streak_updated'
  | 'fatigue_updated'
  | 'health_data_updated'
  | 'settings_changed'
  | 'fitmind_document_added'
  | 'fitmind_session_completed'
  | 'flashcard_reviewed'
  | 'meal_saved'
  | 'body_craft_updated'
  | 'custom_workout_created'
  | 'custom_workout_deleted'
  | 'rank_milestone_reached';

export interface DataEvent<T = any> {
  channel: DataChannel;
  timestamp: number;
  payload?: T;
}

type DataListener = (event: DataEvent) => void;

// ============================================
// SYNC ENGINE
// ============================================

class DataSyncService {
  private listeners: Map<DataChannel, Set<DataListener>> = new Map();
  private lastEvents: Map<DataChannel, DataEvent> = new Map();
  private pendingBatch: DataEvent[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Subscribe to a data channel. Returns unsubscribe function.
   */
  subscribe(channel: DataChannel, listener: DataListener): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(listener);

    return () => {
      const channelListeners = this.listeners.get(channel);
      if (channelListeners) {
        channelListeners.delete(listener);
        if (channelListeners.size === 0) {
          this.listeners.delete(channel);
        }
      }
    };
  }

  /**
   * Subscribe to multiple channels at once
   */
  subscribeMany(channels: DataChannel[], listener: DataListener): () => void {
    const unsubs = channels.map(ch => this.subscribe(ch, listener));
    return () => unsubs.forEach(fn => fn());
  }

  /**
   * Emit a data change event — immediately notifies all subscribers
   */
  emit(channel: DataChannel, payload?: any): void {
    const event: DataEvent = {
      channel,
      timestamp: Date.now(),
      payload,
    };

    this.lastEvents.set(channel, event);

    const channelListeners = this.listeners.get(channel);
    if (channelListeners) {
      for (const listener of channelListeners) {
        try {
          listener(event);
        } catch (e) {
          if (__DEV__) console.warn(`[DataSync] Listener error on ${channel}:`, e);
        }
      }
    }
  }

  /**
   * Batch multiple events and emit them all at once (debounced)
   * Useful when a single action triggers multiple data changes
   */
  emitBatch(events: Array<{ channel: DataChannel; payload?: any }>): void {
    for (const { channel, payload } of events) {
      this.emit(channel, payload);
    }
  }

  /**
   * Get the last event for a channel (for staleness checking)
   */
  getLastEvent(channel: DataChannel): DataEvent | undefined {
    return this.lastEvents.get(channel);
  }

  /**
   * Check if data on a channel is stale (older than maxAge ms)
   */
  isStale(channel: DataChannel, maxAgeMs: number = 60000): boolean {
    const last = this.lastEvents.get(channel);
    if (!last) return true;
    return Date.now() - last.timestamp > maxAgeMs;
  }

  /**
   * Clear all listeners (for cleanup/testing)
   */
  reset(): void {
    this.listeners.clear();
    this.lastEvents.clear();
  }
}

// Singleton
export const dataSync = new DataSyncService();

// ============================================
// CONVENIENCE EMITTERS
// ============================================

/**
 * Call after a workout is completed — triggers dashboard, analytics, profile refresh
 */
export function notifyWorkoutCompleted(data?: {
  sessionId: string;
  exercisesCompleted: number;
  totalExercises: number;
  durationMinutes: number;
  xpEarned: number;
}): void {
  dataSync.emitBatch([
    { channel: 'workout_completed', payload: data },
    { channel: 'xp_awarded', payload: data?.xpEarned },
    { channel: 'fatigue_updated' },
    { channel: 'streak_updated' },
  ]);
}

/**
 * Call after steps are recorded
 */
export function notifyStepsUpdated(steps: number): void {
  dataSync.emit('steps_updated', { steps });
}

/**
 * Call after XP is awarded
 */
export function notifyXPAwarded(xp: number, levelUp?: boolean, newLevel?: number): void {
  dataSync.emit('xp_awarded', { xp, levelUp, newLevel });
  if (levelUp) {
    dataSync.emit('level_up', { newLevel });
  }
}

/**
 * Call after profile is updated
 */
export function notifyProfileUpdated(): void {
  dataSync.emit('profile_updated');
}

/**
 * Call after a custom workout is created
 */
export function notifyCustomWorkoutCreated(sessionId: string): void {
  dataSync.emit('custom_workout_created', { sessionId });
}

/**
 * Call after a jog session completes
 */
export function notifyJogCompleted(distanceMeters: number, durationSeconds: number): void {
  dataSync.emitBatch([
    { channel: 'jog_completed', payload: { distanceMeters, durationSeconds } },
    { channel: 'xp_awarded' },
    { channel: 'steps_updated' },
  ]);
}

/**
 * Call after a rank milestone is reached
 */
export function notifyRankMilestoneReached(milestone: { rank: string; level: number }): void {
  dataSync.emit('rank_milestone_reached', milestone);
}

/**
 * Call after a meal is saved
 */
export function notifyMealSaved(): void {
  dataSync.emit('meal_saved');
}

/**
 * Call after settings change
 */
export function notifySettingsChanged(key: string): void {
  dataSync.emit('settings_changed', { key });
}

// ============================================
// REACT HOOK
// ============================================

/**
 * React hook to subscribe to data sync channels.
 * Automatically unsubscribes on unmount.
 *
 * Usage:
 * ```tsx
 * useDataSync(['workout_completed', 'xp_awarded'], () => {
 *   loadProgress(); // Re-fetch data
 * });
 * ```
 */
import { useEffect, useRef, useMemo } from 'react';

export function useDataSync(
  channels: DataChannel | DataChannel[],
  onUpdate: (event: DataEvent) => void,
): void {
  // Memoize channelArray to prevent recreation on every render
  const channelArray = useMemo(
    () => (Array.isArray(channels) ? channels : [channels]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Array.isArray(channels) ? channels.join(',') : channels]
  );
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    const unsub = dataSync.subscribeMany(channelArray, (event) => {
      callbackRef.current(event);
    });
    return unsub;
  }, [channelArray]);
}
