/**
 * FitQuest Health Monitor
 *
 * Continuous health monitoring service that:
 * - Tracks daily activity (steps, calories, active minutes)
 * - Monitors workout intensity and recovery
 * - Detects anomalies (sudden heart rate changes, unusual inactivity)
 * - Generates health alerts stored via encrypted database
 * - Provides daily/weekly/monthly health summaries
 *
 * All data processed and stored on-device. Nothing leaves the phone.
 */

import { SensorFusionEngine, type ActivityType, type MotionSnapshot } from './SensorFusionEngine';
import { encryptedDB } from '../security/EncryptedDatabase';
import { getAppState, setAppState } from '../database/service';

// ============================================
// TYPES
// ============================================

export interface DailyHealthSummary {
  date: string; // YYYY-MM-DD
  totalSteps: number;
  totalDistance: number; // meters
  totalCalories: number; // kcal
  activeMinutes: number;
  workoutCount: number;
  avgIntensity: number; // 0-10
  dominantActivity: ActivityType;
  restingHeartRate?: number; // bpm (manual input or wearable)
  sleepHours?: number; // manual input
  hydrationLiters?: number; // manual input
  moodScore?: number; // 1-5
  energyLevel?: number; // 1-5
  streakDays: number;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  avgDailySteps: number;
  totalCalories: number;
  totalWorkouts: number;
  avgIntensity: number;
  activeMinutesTotal: number;
  bestDay: string;
  worstDay: string;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export interface HealthGoals {
  dailySteps: number; // default 10000
  dailyCalories: number; // default 500
  dailyActiveMinutes: number; // default 30
  weeklyWorkouts: number; // default 4
  dailyWaterLiters: number; // default 2.5
  sleepHoursTarget: number; // default 7.5
}

export interface HealthAlert {
  type: 'INACTIVITY' | 'OVERTRAINING' | 'HYDRATION' | 'SLEEP' | 'STREAK' | 'GOAL_REACHED' | 'RECOVERY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  actionable: boolean;
  action?: string;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_GOALS: HealthGoals = {
  dailySteps: 10000,
  dailyCalories: 500,
  dailyActiveMinutes: 30,
  weeklyWorkouts: 4,
  dailyWaterLiters: 2.5,
  sleepHoursTarget: 7.5,
};

const INACTIVITY_THRESHOLD_MINUTES = 60; // Alert after 60 min no movement
const OVERTRAINING_THRESHOLD_HOURS = 2.5; // Alert after 2.5h continuous exercise

// ============================================
// HEALTH MONITOR SERVICE
// ============================================

export class HealthMonitorService {
  private static instance: HealthMonitorService | null = null;
  private goals: HealthGoals = { ...DEFAULT_GOALS };
  private initialized = false;

  // Today's running totals (in-memory, persisted on save)
  private todaySteps = 0;
  private todayCalories = 0;
  private todayActiveMinutes = 0;
  private todayWorkouts = 0;
  private lastActivityTimestamp = 0;
  private continuousExerciseStart = 0;

  // Monitoring
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private sensorUnsubscribe: (() => void) | null = null;

  // Track which alert types have already fired today to prevent duplicates
  private alertsFiredToday: Set<string> = new Set();
  private alertsResetDate: string = '';

  private constructor() {}

  static getInstance(): HealthMonitorService {
    if (!HealthMonitorService.instance) {
      HealthMonitorService.instance = new HealthMonitorService();
    }
    return HealthMonitorService.instance;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize health monitor. Loads today's data and starts monitoring.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load saved goals
    await this.loadGoals();

    // Load today's running totals
    await this.loadTodaySummary();

    // Subscribe to sensor updates
    const engine = SensorFusionEngine.getInstance();
    this.sensorUnsubscribe = engine.onUpdate((snapshot) => {
      this.handleSensorUpdate(snapshot);
    });

    // Start periodic monitoring (check for alerts every 5 min)
    this.monitoringInterval = setInterval(
      () => {
        this.checkForAlerts();
      },
      5 * 60 * 1000,
    );

    this.initialized = true;
    if (__DEV__) console.warn('[HealthMonitor] Initialized');
  }

  /**
   * Stop monitoring and save state.
   */
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.sensorUnsubscribe) {
      this.sensorUnsubscribe();
      this.sensorUnsubscribe = null;
    }

    await this.saveTodaySummary();
    this.initialized = false;
    if (__DEV__) console.warn('[HealthMonitor] Shutdown');
  }

  // ============================================
  // MANUAL INPUT (for data not available from sensors)
  // ============================================

  /**
   * Log manual health metrics (sleep, hydration, mood, resting HR).
   */
  async logManualMetrics(metrics: {
    restingHeartRate?: number;
    sleepHours?: number;
    hydrationLiters?: number;
    moodScore?: number;
    energyLevel?: number;
    weightKg?: number;
  }): Promise<void> {
    const today = this.getTodayKey();

    await encryptedDB.storeHealthData('manual_metrics', {
      date: today,
      ...metrics,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a completed workout (called from useFitQuestWorkout on completion).
   */
  recordWorkoutComplete(data: {
    durationMinutes: number;
    exerciseCount: number;
    caloriesBurned: number;
    intensity: number;
  }): void {
    this.todayWorkouts++;
    this.todayCalories += data.caloriesBurned;
    this.todayActiveMinutes += data.durationMinutes;
  }

  // ============================================
  // GOALS
  // ============================================

  getGoals(): HealthGoals {
    return { ...this.goals };
  }

  async setGoals(goals: Partial<HealthGoals>): Promise<void> {
    this.goals = { ...this.goals, ...goals };
    await setAppState('health_goals', JSON.stringify(this.goals));
  }

  /**
   * Get progress toward today's goals (0-1 per metric).
   */
  getGoalProgress(): Record<string, number> {
    return {
      steps: this.goals.dailySteps > 0 ? Math.min(1, this.todaySteps / this.goals.dailySteps) : 0,
      calories: this.goals.dailyCalories > 0 ? Math.min(1, this.todayCalories / this.goals.dailyCalories) : 0,
      activeMinutes:
        this.goals.dailyActiveMinutes > 0 ? Math.min(1, this.todayActiveMinutes / this.goals.dailyActiveMinutes) : 0,
    };
  }

  // ============================================
  // SUMMARIES
  // ============================================

  /**
   * Get today's health summary.
   */
  getTodaySummary(): Partial<DailyHealthSummary> {
    return {
      date: this.getTodayKey(),
      totalSteps: this.todaySteps,
      totalCalories: Math.round(this.todayCalories * 10) / 10,
      activeMinutes: this.todayActiveMinutes,
      workoutCount: this.todayWorkouts,
    };
  }

  /**
   * Get daily summaries for a date range (from encrypted storage).
   */
  async getDailySummaries(days = 7): Promise<Partial<DailyHealthSummary>[]> {
    const data = await encryptedDB.getRecentHealthData('daily_summary', days);
    return data as Partial<DailyHealthSummary>[];
  }

  /**
   * Generate weekly summary from daily data.
   */
  async getWeeklySummary(): Promise<WeeklySummary | null> {
    const dailies = await this.getDailySummaries(7);
    if (dailies.length === 0) return null;

    const totalSteps = dailies.reduce((sum, d) => sum + ((d as any).totalSteps || 0), 0);
    const totalCalories = dailies.reduce((sum, d) => sum + ((d as any).totalCalories || 0), 0);
    const totalWorkouts = dailies.reduce((sum, d) => sum + ((d as any).workoutCount || 0), 0);
    const totalActive = dailies.reduce((sum, d) => sum + ((d as any).activeMinutes || 0), 0);

    const stepsPerDay = dailies.map((d) => (d as any).totalSteps || 0);
    const maxSteps = Math.max(...stepsPerDay);
    const minSteps = Math.min(...stepsPerDay);
    const bestIdx = stepsPerDay.indexOf(maxSteps);
    const worstIdx = stepsPerDay.indexOf(minSteps);

    // Trend: compare first half vs second half
    const mid = Math.floor(dailies.length / 2);
    const firstHalf = stepsPerDay.slice(0, mid);
    const secondHalf = stepsPerDay.slice(mid);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
    const trend = secondAvg > firstAvg * 1.1 ? 'IMPROVING' : secondAvg < firstAvg * 0.9 ? 'DECLINING' : 'STABLE';

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);

    return {
      weekStart: weekStart.toISOString().split('T')[0]!,
      weekEnd: now.toISOString().split('T')[0]!,
      avgDailySteps: Math.round(totalSteps / dailies.length),
      totalCalories: Math.round(totalCalories),
      totalWorkouts,
      avgIntensity: 0,
      activeMinutesTotal: totalActive,
      bestDay: dailies[bestIdx]?.date || '',
      worstDay: dailies[worstIdx]?.date || '',
      trend,
    };
  }

  // ============================================
  // ALERT SYSTEM
  // ============================================

  /**
   * Check current state and generate alerts.
   */
  private async checkForAlerts(): Promise<void> {
    const alerts: HealthAlert[] = [];
    const now = Date.now();

    // Inactivity alert
    if (this.lastActivityTimestamp > 0) {
      const inactiveMinutes = (now - this.lastActivityTimestamp) / 60000;
      if (inactiveMinutes > INACTIVITY_THRESHOLD_MINUTES) {
        alerts.push({
          type: 'INACTIVITY',
          severity: 'LOW',
          title: 'Time to Move!',
          message: `You've been inactive for ${Math.round(inactiveMinutes)} minutes. A short walk can boost your energy.`,
          actionable: true,
          action: 'START_WALK',
        });
      }
    }

    // Overtraining alert
    if (this.continuousExerciseStart > 0) {
      const exerciseHours = (now - this.continuousExerciseStart) / 3600000;
      if (exerciseHours > OVERTRAINING_THRESHOLD_HOURS) {
        alerts.push({
          type: 'OVERTRAINING',
          severity: 'HIGH',
          title: 'Recovery Recommended',
          message: `You've been exercising for ${Math.round(exerciseHours * 10) / 10} hours. Consider taking a break to prevent injury.`,
          actionable: true,
          action: 'REST',
        });
      }
    }

    // Goal reached alerts
    const progress = this.getGoalProgress();
    if ((progress.steps ?? 0) >= 1.0 && this.todaySteps > 0) {
      alerts.push({
        type: 'GOAL_REACHED',
        severity: 'LOW',
        title: '🎉 Step Goal Reached!',
        message: `You've hit ${this.todaySteps.toLocaleString()} steps today!`,
        actionable: false,
      });
    }

    // Reset alert dedup tracker at midnight
    const today = new Date().toISOString().slice(0, 10);
    if (this.alertsResetDate !== today) {
      this.alertsFiredToday.clear();
      this.alertsResetDate = today;
    }

    // Store alerts in encrypted database (deduplicated per type per day)
    for (const alert of alerts) {
      if (this.alertsFiredToday.has(alert.type)) continue;
      this.alertsFiredToday.add(alert.type);
      await encryptedDB.createHealthAlert(alert.type, alert.severity, {
        title: alert.title,
        message: alert.message,
        action: alert.action,
      });
    }
  }

  // ============================================
  // SENSOR UPDATE HANDLER
  // ============================================

  private handleSensorUpdate(snapshot: MotionSnapshot): void {
    if (snapshot.isActive) {
      this.lastActivityTimestamp = Date.now();

      // Track continuous exercise
      if (snapshot.activity === 'EXERCISE' || snapshot.activity === 'RUNNING') {
        if (this.continuousExerciseStart === 0) {
          this.continuousExerciseStart = Date.now();
        }
      } else {
        this.continuousExerciseStart = 0;
      }
    }

    // Update step count
    const engine = SensorFusionEngine.getInstance();
    const stepData = engine.getStepData();
    this.todaySteps = Math.max(this.todaySteps, stepData.steps);
    this.todayCalories = Math.max(this.todayCalories, stepData.calories);
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private async saveTodaySummary(): Promise<void> {
    const summary = this.getTodaySummary();
    await encryptedDB.storeHealthData('daily_summary', summary);
  }

  private async loadTodaySummary(): Promise<void> {
    try {
      const today = this.getTodayKey();
      const summaries = await encryptedDB.getRecentHealthData('daily_summary', 1);
      const todaySummary = summaries.find((s: any) => s.date === today);

      if (todaySummary) {
        this.todaySteps = (todaySummary as any).totalSteps || 0;
        this.todayCalories = (todaySummary as any).totalCalories || 0;
        this.todayActiveMinutes = (todaySummary as any).activeMinutes || 0;
        this.todayWorkouts = (todaySummary as any).workoutCount || 0;
      }
    } catch (e) {
      if (__DEV__) console.warn("[HealthMonitor] Failed to load today's summary:", e);
    }
  }

  private async loadGoals(): Promise<void> {
    try {
      const value = await getAppState('health_goals');
      if (value) {
        this.goals = { ...DEFAULT_GOALS, ...JSON.parse(value) };
      }
    } catch (_e) {
      if (__DEV__) console.warn('[HealthMonitor] Failed to load goals, using defaults');
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private getTodayKey(): string {
    return new Date().toISOString().split('T')[0]!;
  }
}

// Singleton accessor
export const healthMonitor = HealthMonitorService.getInstance();
