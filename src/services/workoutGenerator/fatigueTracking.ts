/**
 * FitQuest Fatigue & Recovery System
 * Client-side state management
 */

import {
  WorkoutGeneratorState,
  UserProfile,
  SessionRecord,
  MuscleFatigueMap,
  ExerciseRecord,
  Muscle,
  FATIGUE_CONSTANTS,
} from './types';
import { updateFatiguePostWorkout, applyDailyRecovery, shouldTriggerDeload } from './pipeline';

// ============================================================================
// FATIGUE TRACKING MANAGER
// ============================================================================

export class FatigueTracker {
  private state: WorkoutGeneratorState;

  constructor(initialState: WorkoutGeneratorState) {
    this.state = { ...initialState };
  }

  /**
   * Initialize fatigue map for a new user
   */
  static initializeFatigueMap(muscles: Muscle[]): MuscleFatigueMap {
    const map: MuscleFatigueMap = {};
    muscles.forEach((muscle) => {
      map[muscle] = 0;
    });
    return map;
  }

  /**
   * Record a completed workout and update fatigue
   */
  recordWorkout(session: SessionRecord, prescription: any[]): void {
    // Add to history
    this.state.last_7_sessions.push(session);
    this.state.last_7_sessions = this.state.last_7_sessions.slice(-7); // Keep only last 7

    // Update fatigue map
    this.state.muscle_fatigue_map = updateFatiguePostWorkout(
      this.state.muscle_fatigue_map,
      prescription,
      true
    );

    // Update streak
    if (session.completed) {
      this.state.streak++;
    } else {
      this.state.streak = 0;
    }

    // Check if deload should be triggered
    if (shouldTriggerDeload(this.state)) {
      this.state.deload_flag = true;
    } else {
      this.state.deload_flag = false;
    }

    this.state.last_updated = new Date().toISOString();
  }

  /**
   * Apply daily recovery
   * Should be called once per day or on app launch
   */
  applyDailyRecoveryTick(): void {
    this.state.muscle_fatigue_map = applyDailyRecovery(this.state.muscle_fatigue_map);
    this.state.last_updated = new Date().toISOString();
  }

  /**
   * Get muscle fatigue level (0-100)
   */
  getMuscleFatigue(muscle: Muscle): number {
    return this.state.muscle_fatigue_map[muscle] || 0;
  }

  /**
   * Get average fatigue across all muscles
   */
  getAverageFatigue(): number {
    const values = Object.values(this.state.muscle_fatigue_map);
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get most fatigued muscles
   */
  getMostFatiguedMuscles(limit: number = 5): Array<{ muscle: Muscle; fatigue: number }> {
    return Object.entries(this.state.muscle_fatigue_map)
      .map(([muscle, fatigue]) => ({ muscle: muscle as Muscle, fatigue }))
      .sort((a, b) => b.fatigue - a.fatigue)
      .slice(0, limit);
  }

  /**
   * Check if a muscle needs recovery
   */
  shouldAvoidExercise(muscle: Muscle): boolean {
    return (
      this.state.muscle_fatigue_map[muscle] >=
      FATIGUE_CONSTANTS.FATIGUE_THRESHOLD_FOR_EXERCISE_SKIP
    );
  }

  /**
   * Get state
   */
  getState(): WorkoutGeneratorState {
    return { ...this.state };
  }

  /**
   * Update user profile (triggers regeneration)
   */
  updateUserProfile(profile: Partial<UserProfile>): void {
    this.state.user_profile = {
      ...this.state.user_profile,
      ...profile,
    };
    this.state.last_updated = new Date().toISOString();
  }

  /**
   * Force deload
   */
  triggerDeload(): void {
    this.state.deload_flag = true;
  }

  /**
   * End deload
   */
  endDeload(): void {
    this.state.deload_flag = false;
  }

  /**
   * Reset all data (start fresh)
   */
  reset(): void {
    this.state.last_7_sessions = [];
    this.state.muscle_fatigue_map = FatigueTracker.initializeFatigueMap(
      Object.keys(this.state.muscle_fatigue_map) as Muscle[]
    );
    this.state.streak = 0;
    this.state.deload_flag = false;
    this.state.current_week = 1;
    this.state.last_updated = new Date().toISOString();
  }
}

// ============================================================================
// SESSION HISTORY MANAGER
// ============================================================================

export class SessionHistoryManager {
  private sessions: SessionRecord[] = [];

  /**
   * Add a session to history
   */
  addSession(session: SessionRecord): void {
    this.sessions.push(session);
    this.sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionRecord[] {
    return [...this.sessions];
  }

  /**
   * Get sessions from last N days
   */
  getSessionsFromLastDays(days: number): SessionRecord[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.sessions.filter((s) => new Date(s.date) > cutoff);
  }

  /**
   * Get workout count
   */
  getTotalWorkoutsCompleted(): number {
    return this.sessions.filter((s) => s.completed).length;
  }

  /**
   * Get success rate (%)
   */
  getSuccessRate(): number {
    if (this.sessions.length === 0) return 0;
    const successful = this.sessions.filter((s) => s.completed).length;
    return (successful / this.sessions.length) * 100;
  }

  /**
   * Get average fatigue after workout
   */
  getAverageFatiguePostWorkout(): number {
    const fatigueValues = this.sessions
      .filter((s) => s.fatigue_post_workout !== undefined)
      .map((s) => s.fatigue_post_workout!);

    if (fatigueValues.length === 0) return 0;
    return fatigueValues.reduce((a, b) => a + b, 0) / fatigueValues.length;
  }

  /**
   * Get last workout
   */
  getLastWorkout(): SessionRecord | null {
    return this.sessions.length > 0 ? this.sessions[0] : null;
  }

  /**
   * Get most used exercises
   */
  getMostUsedExercises(limit: number = 10): Array<{ exercise_id: string; count: number }> {
    const counts = new Map<string, number>();

    this.sessions.forEach((session) => {
      session.exercises.forEach((ex) => {
        counts.set(ex.exercise_id, (counts.get(ex.exercise_id) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([exercise_id, count]) => ({ exercise_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get consistency score (workouts this week vs planned)
   */
  getConsistencyScore(plannedPerWeek: number): number {
    const thisWeekSessions = this.getSessionsFromLastDays(7);
    const completed = thisWeekSessions.filter((s) => s.completed).length;
    return (completed / plannedPerWeek) * 100;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.sessions = [];
  }
}

// ============================================================================
// ANALYTICS BUILDER
// ============================================================================

export interface WorkoutAnalytics {
  total_workouts: number;
  total_sessions_planned: number;
  success_rate: number;
  current_streak: number;
  average_fatigue: number;
  average_duration: number;
  most_used_exercise: string | null;
  consistency_this_week: number;
  last_workout_date: string | null;
}

export function buildAnalytics(
  fatigueTracker: FatigueTracker,
  sessionHistory: SessionHistoryManager,
  userProfile: UserProfile
): WorkoutAnalytics {
  const state = fatigueTracker.getState();
  const lastWorkout = sessionHistory.getLastWorkout();

  const totalDuration = state.last_7_sessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const avgDuration = state.last_7_sessions.length > 0 ? totalDuration / state.last_7_sessions.length : 0;

  return {
    total_workouts: sessionHistory.getTotalWorkoutsCompleted(),
    total_sessions_planned: sessionHistory.getAllSessions().length,
    success_rate: sessionHistory.getSuccessRate(),
    current_streak: state.streak,
    average_fatigue: fatigueTracker.getAverageFatigue(),
    average_duration: Math.round(avgDuration),
    most_used_exercise: sessionHistory.getMostUsedExercises(1)[0]?.exercise_id || null,
    consistency_this_week: sessionHistory.getConsistencyScore(userProfile.training_days_per_week),
    last_workout_date: lastWorkout?.date || null,
  };
}

// ============================================================================
// PERSISTENCE LAYER (FOR ASYNCSTORAGE)
// ============================================================================

const STATE_STORAGE_KEY = 'fitquest_workout_state';
const HISTORY_STORAGE_KEY = 'fitquest_session_history';

export async function saveState(state: WorkoutGeneratorState): Promise<void> {
  try {
    // In React Native/Expo:
    // import AsyncStorage from '@react-native-async-storage/async-storage';
    // await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    
    // For now, stub:
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

export async function loadState(): Promise<WorkoutGeneratorState | null> {
  try {
    // In React Native/Expo: await AsyncStorage.getItem(STATE_STORAGE_KEY);
    const stored = localStorage.getItem(STATE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    console.error('Failed to load state:', err);
    return null;
  }
}

export async function saveHistory(history: SessionRecord[]): Promise<void> {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

export async function loadHistory(): Promise<SessionRecord[]> {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Failed to load history:', err);
    return [];
  }
}
