/**
 * FitQuest Background Health Engine
 * 
 * Orchestrates all health monitoring subsystems with periodic
 * data collection, anomaly detection, and insight generation.
 * 
 * Runs as a foreground polling service (React Native doesn't
 * support true background tasks without native modules, but
 * this engine can be wired into expo-task-manager if needed).
 * 
 * Subsystems orchestrated:
 * - HealthMonitor (steps, calories, goals)
 * - SensorFusionEngine (activity detection, rep counting)
 * - SleepAnalysisEngine (quality, stages, debt)
 * - AnomalyDetector (outlier detection, alerts)
 * - RealisticHealthEngine (BMR, TDEE, recovery scoring)
 * 
 * Data pipeline:
 *   Sensors → Collect → Aggregate → Analyze → Detect → Alert → Store
 * 
 * All sensitive data encrypted. Runs at configurable intervals.
 */

import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Battery from 'expo-battery';
import type { EventSubscription } from 'expo-modules-core';
import { encryptedDB } from '../security/EncryptedDatabase';
import { captureHealthError } from '../services/errorTelemetry';
import { AnomalyDetector, type MetricDataPoint } from './AnomalyDetector';
import { SleepAnalysisEngine } from './SleepAnalysisEngine';
import { RealisticHealthEngine } from './RealisticHealthEngine';
import { SensorFusionEngine } from './SensorFusionEngine';
import { HealthMonitorService } from './HealthMonitor';
import { getCachedReadiness, invalidateReadinessCache } from './ReadinessEngine';
import { syncHealthData } from '../services/healthAdapters';
import {
  getAverageFatigueLevel,
  getAppState,
  getDailyStepsForDate,
  getRecoveryScoresSince,
  getStepHistory,
  getUserProfile,
  getWorkoutCountSince,
  getWorkoutStreakCurrent,
} from '../database/service';

// ============================================
// TYPES
// ============================================

export type EngineState = 'STOPPED' | 'RUNNING' | 'PAUSED';

export interface HealthSnapshot {
  timestamp: number;
  steps: number;
  calories: number;
  activeMinutes: number;
  restingHeartRate: number | null;
  recoveryScore: number;
  sleepQuality: number | null;
  anomaliesDetected: number;
  overallScore: number;        // 0-100 composite health score
}

export interface DailyHealthSummary {
  date: string;               // YYYY-MM-DD
  totalSteps: number;
  totalCalories: number;
  activeMinutes: number;
  workoutsCompleted: number;
  avgHeartRate: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  recoveryScore: number;
  healthScore: number;         // 0-100
  anomalies: string[];
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  avgDailySteps: number;
  totalWorkouts: number;
  avgRecoveryScore: number;
  avgSleepQuality: number;
  avgHealthScore: number;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  topInsight: string;
  recommendations: string[];
}

export interface BackgroundHealthConfig {
  /** Data collection interval in ms (default: 5 min) */
  collectionIntervalMs?: number;
  /** Anomaly check interval in ms (default: 30 min) */
  anomalyCheckIntervalMs?: number;
  /** Daily summary generation time (HH:MM, default: '23:30') */
  dailySummaryTime?: string;
  /** Enable anomaly auto-alerts (default: true) */
  enableAlerts?: boolean;
  /** Battery level (0-1) below which collection slows down (default: 0.20) */
  lowBatteryThreshold?: number;
  /** Battery level (0-1) below which collection pauses entirely (default: 0.10) */
  criticalBatteryThreshold?: number;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: Required<BackgroundHealthConfig> = {
  collectionIntervalMs: 1 * 60 * 1000,       // 1 min
  anomalyCheckIntervalMs: 30 * 60 * 1000,    // 30 min
  dailySummaryTime: '23:30',
  enableAlerts: true,
  lowBatteryThreshold: 0.20,
  criticalBatteryThreshold: 0.10,
};

/** Interval multipliers based on battery state */
const BATTERY_THROTTLE = {
  /** Normal battery (> lowBatteryThreshold): no throttle */
  NORMAL: 1,
  /** Low battery (criticalBatteryThreshold..lowBatteryThreshold): 3x slower */
  LOW: 3,
  /** Charging: slightly faster to take advantage of power */
  CHARGING: 0.8,
} as const;

type BatteryTier = 'NORMAL' | 'LOW' | 'CRITICAL' | 'CHARGING';

// Health score weights
const SCORE_WEIGHTS = {
  STEPS: 0.20,
  ACTIVITY: 0.15,
  RECOVERY: 0.25,
  SLEEP: 0.25,
  CONSISTENCY: 0.15,
};

// Daily goals (defaults, can be customized via app_state)
const DEFAULT_GOALS = {
  steps: 10000,
  activeMinutes: 30,
  calories: 500, // Active calories
  sleepHours: 8,
};

const EXTERNAL_HEALTH_SYNC_INTERVAL_MS = 15 * 60 * 1000;

// ============================================
// BACKGROUND HEALTH ENGINE
// ============================================

export class BackgroundHealthEngine {
  private static instance: BackgroundHealthEngine | null = null;

  private state: EngineState = 'STOPPED';
  private config: Required<BackgroundHealthConfig>;
  private collectionTimer: ReturnType<typeof setInterval> | null = null;
  private anomalyTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: any = null;
  private batterySubscription: EventSubscription | null = null;
  private currentBatteryTier: BatteryTier = 'NORMAL';
  private lastExternalHealthSyncAt = 0;
  private anomalyDetector: AnomalyDetector;
  private sleepEngine: SleepAnalysisEngine;
  private todayData: {
    steps: number;
    calories: number;
    activeMinutes: number;
    heartRateReadings: number[];
    workoutsCompleted: number;
  };

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.anomalyDetector = new AnomalyDetector({ autoAlert: true });
    this.sleepEngine = SleepAnalysisEngine.getInstance();
    this.todayData = this.resetTodayData();
  }

  static getInstance(): BackgroundHealthEngine {
    if (!BackgroundHealthEngine.instance) {
      BackgroundHealthEngine.instance = new BackgroundHealthEngine();
    }
    return BackgroundHealthEngine.instance;
  }

  // ============================================
  // ENGINE LIFECYCLE
  // ============================================

  /**
   * Start the background health engine.
   * Checks battery state and adjusts polling intervals accordingly.
   */
  async start(config?: BackgroundHealthConfig): Promise<void> {
    if (this.state === 'RUNNING') return;

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = 'RUNNING';
    this.todayData = this.resetTodayData();

    // Check initial battery state and set tier
    await this.updateBatteryTier();

    // Subscribe to battery state changes
    this.batterySubscription = Battery.addBatteryStateListener((event) => {
      this.handleBatteryStateChange(event);
    });

    // Start sensor fusion for real-time activity detection (step counting, classification)
    try {
      const sensorEngine = SensorFusionEngine.getInstance();
      if (!sensorEngine.isRunning()) {
        const profile = await getUserProfile('user_local_001');
        await sensorEngine.start({ weightKg: profile?.weight_kg ?? 70 });
        if (__DEV__) console.log('[BackgroundHealth] SensorFusion started');
      }
    } catch (e) {
      if (__DEV__) console.warn('[BackgroundHealth] SensorFusion unavailable (expected in Expo Go):', e);
    }

    // Initialize health monitor (subscribes to sensor updates + periodic alert checks)
    try {
      const monitor = HealthMonitorService.getInstance();
      await monitor.initialize();
    } catch (e) {
      if (__DEV__) console.warn('[BackgroundHealth] HealthMonitor init failed:', e);
    }

    // Start timers with battery-aware intervals
    this.restartTimers();

    // Listen for app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppState);

    // Initial collection (unless battery is critical)
    if (this.currentBatteryTier !== 'CRITICAL') {
      this.collectAndProcess();
    }

    if (__DEV__) console.log(`[BackgroundHealth] Engine started (battery: ${this.currentBatteryTier})`);
  }

  /**
   * Stop the engine and clean up all subscriptions.
   */
  stop(): void {
    if (this.collectionTimer) clearInterval(this.collectionTimer);
    if (this.anomalyTimer) clearInterval(this.anomalyTimer);
    this.appStateSubscription?.remove();
    this.batterySubscription?.remove();

    // Stop sensor subsystems
    try {
      SensorFusionEngine.getInstance().stop();
    } catch { /* already stopped */ }
    try {
      HealthMonitorService.getInstance().shutdown();
    } catch { /* already stopped */ }

    this.collectionTimer = null;
    this.anomalyTimer = null;
    this.appStateSubscription = null;
    this.batterySubscription = null;
    this.state = 'STOPPED';

    if (__DEV__) console.log('[BackgroundHealth] Engine stopped');
  }

  /**
   * Pause collection (e.g., during workout, which has its own tracking).
   */
  pause(): void {
    this.state = 'PAUSED';
  }

  /**
   * Resume collection after pause.
   */
  resume(): void {
    this.state = 'RUNNING';
  }

  /**
   * Get current engine state.
   */
  getState(): EngineState {
    return this.state;
  }

  // ============================================
  // DATA COLLECTION
  // ============================================

  /**
   * Collect current health data from all sources.
   * Called on each tick interval.
   */
  private async collectAndProcess(): Promise<void> {
    if (this.state !== 'RUNNING') return;

    try {
      await this.syncExternalHealthProvidersIfDue();

      // Read from existing health data in SQLite
      // Get today's step data
      const today = new Date().toISOString().split('T')[0]!;
      const stepRow = await getDailyStepsForDate('user_local_001', today);
      if (stepRow) {
        this.todayData.steps = stepRow.steps;
      } else {
        await this.hydrateTodayMetricsFromEncryptedData();
      }

      // Get today's workout count
      const startOfDay = new Date(today).getTime();
      this.todayData.workoutsCompleted = await getWorkoutCountSince(startOfDay);

      // Estimate active calories from steps + workouts
      if (this.todayData.calories <= 0) {
        this.todayData.calories = this.estimateActiveCalories(
          this.todayData.steps,
          this.todayData.workoutsCompleted
        );
      }

      // Estimate active minutes: check SensorFusion for real-time activity state, fall back to step estimate
      if (this.todayData.activeMinutes <= 0) {
        this.todayData.activeMinutes = Math.round(this.todayData.steps / 100);
      } else {
        // If sensor is running and user is active, increment active minutes
        try {
          const sensorEngine = SensorFusionEngine.getInstance();
          if (sensorEngine.isRunning()) {
            const snapshot = sensorEngine.getSnapshot();
            if (snapshot.isActive) {
              // Each collection tick represents ~1 minute of data
              this.todayData.activeMinutes += 1;
            }
          }
        } catch { /* sensor data unavailable */ }
      }

      // Store periodic snapshot (encrypted)
      await this.storeSnapshot();

      // Refresh readiness cache (lightweight, powers dashboard + coach)
      try {
        invalidateReadinessCache();
        await getCachedReadiness('user_local_001');
      } catch {
        // Readiness refresh is non-critical
      }
    } catch (e) {
      if (__DEV__) console.warn('[BackgroundHealth] Collection error:', e);
    }
  }

  /**
   * Record a heart rate reading (from manual input or sensor).
   */
  recordHeartRate(bpm: number): void {
    if (bpm >= 30 && bpm <= 220) {
      this.todayData.heartRateReadings.push(bpm);
      encryptedDB.storeHealthData('heart_rate', {
        bpm,
        source: 'MANUAL',
        recorded_at: Date.now(),
      }).catch((error) => {
        if (__DEV__) console.warn('[BackgroundHealth] Failed to store heart rate:', error);
      });
    }
  }

  /**
   * Record workout completion (called from workout hook).
   */
  recordWorkoutComplete(): void {
    this.todayData.workoutsCompleted++;
  }

  /**
   * Record steps (called from pedometer).
   */
  recordSteps(count: number): void {
    this.todayData.steps = count;
  }

  private async syncExternalHealthProvidersIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastExternalHealthSyncAt < EXTERNAL_HEALTH_SYNC_INTERVAL_MS) {
      return;
    }

    // Respect user's HealthConnect toggle from profile settings
    try {
      const enabled = await getAppState('healthconnect.enabled');
      if (enabled === 'false') return;
    } catch { /* proceed if flag unreadable */ }

    const fallbackProvider = Platform.OS === 'ios' ? 'healthkit' : 'health_connect';

    try {
      const syncResult = await syncHealthData({
        since: new Date(now - 24 * 60 * 60 * 1000),
        categories: ['steps', 'calories', 'heart_rate', 'sleep', 'workout'],
      });

      if (syncResult.errors > 0) {
        await captureHealthError(`Background sync completed with ${syncResult.errors} errors`, {
          provider: syncResult.provider === 'healthkit' ? 'healthkit' : 'health_connect',
          action: 'sync',
          dataType: 'batch',
        });
      }
    } catch (error) {
      await captureHealthError(
        error instanceof Error ? error : 'Background health sync failed',
        {
          provider: fallbackProvider,
          action: 'sync',
          dataType: 'batch',
        }
      );
    } finally {
      this.lastExternalHealthSyncAt = now;
    }
  }

  private async hydrateTodayMetricsFromEncryptedData(): Promise<void> {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const [stepRecords, calorieRecords, activeMinuteRecords, heartRateRecords] = await Promise.all([
      encryptedDB.getRecentHealthData('steps', 200),
      encryptedDB.getRecentHealthData('calories', 200),
      encryptedDB.getRecentHealthData('active_minutes', 200),
      encryptedDB.getRecentHealthData('heart_rate', 200),
    ]);

    const sumSince = (records: object[]) =>
      records.reduce((total, record) => {
        const entry = record as { created_at?: number; value?: number; bpm?: number; startTime?: string; endTime?: string };
        if ((entry.created_at ?? 0) < dayAgo) return total;
        if (typeof entry.value === 'number') return total + entry.value;
        return total;
      }, 0);

    const hrValues = heartRateRecords
      .map((record) => record as { created_at?: number; value?: number; bpm?: number })
      .filter((entry) => (entry.created_at ?? 0) >= dayAgo)
      .map((entry) => (typeof entry.bpm === 'number' ? entry.bpm : entry.value))
      .filter((value): value is number => typeof value === 'number' && value > 0);

    const syncedSteps = Math.round(sumSince(stepRecords));
    const syncedCalories = Math.round(sumSince(calorieRecords));
    const syncedActiveMinutes = Math.round(sumSince(activeMinuteRecords));

    if (syncedSteps > this.todayData.steps) this.todayData.steps = syncedSteps;
    if (syncedCalories > this.todayData.calories) this.todayData.calories = syncedCalories;
    if (syncedActiveMinutes > this.todayData.activeMinutes) this.todayData.activeMinutes = syncedActiveMinutes;

    if (hrValues.length > 0) {
      this.todayData.heartRateReadings = hrValues;
    }
  }

  // ============================================
  // ANOMALY DETECTION
  // ============================================

  private async runAnomalyCheck(): Promise<void> {
    if (this.state !== 'RUNNING') return;

    try {
      // Gather recent health data for anomaly detection
      const recentData = await this.gatherRecentMetrics();

      const anomalies = await this.anomalyDetector.comprehensiveCheck({
        heartRate: recentData.heartRate,
        steps: recentData.steps,
        recovery: recentData.recovery,
      });

      if (anomalies.length > 0) {
        if (__DEV__) console.log(`[BackgroundHealth] ${anomalies.length} anomalies detected`);
      }
    } catch (e) {
      if (__DEV__) console.warn('[BackgroundHealth] Anomaly check error:', e);
    }
  }

  private async gatherRecentMetrics(): Promise<{
    heartRate: MetricDataPoint[];
    steps: MetricDataPoint[];
    recovery: MetricDataPoint[];
  }> {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Get recent daily step data
    const stepRows = await getStepHistory('user_local_001', 14);
    const steps: MetricDataPoint[] = stepRows.map((r) => ({
      value: r.steps,
      timestamp: new Date(r.date).getTime(),
    }));

    // Heart rate data from encrypted storage
    let heartRate: MetricDataPoint[] = [];
    try {
      const hrData = await encryptedDB.getRecentHealthData('heart_rate', 30);
      heartRate = (hrData as Array<{ bpm: number; created_at: number }>)
        .filter((d) => d.bpm)
        .map((d) => ({ value: d.bpm, timestamp: d.created_at }));
    } catch {
      // No heart rate data yet
    }

    // Recovery scores from muscle fatigue
    const fatigueRows = await getRecoveryScoresSince(sevenDaysAgo);
    const recovery: MetricDataPoint[] = fatigueRows.map((r) => ({
      value: r.recovery_score,
      timestamp: r.updated_at,
    }));

    return { heartRate, steps, recovery };
  }

  // ============================================
  // HEALTH SCORING
  // ============================================

  /**
   * Calculate current overall health score (0-100).
   */
  async calculateHealthScore(): Promise<number> {
    let score = 0;

    // Steps score (0-20)
    const stepRatio = Math.min(1, this.todayData.steps / DEFAULT_GOALS.steps);
    score += stepRatio * (SCORE_WEIGHTS.STEPS * 100);

    // Activity score (0-15)
    const activityRatio = Math.min(1, this.todayData.activeMinutes / DEFAULT_GOALS.activeMinutes);
    score += activityRatio * (SCORE_WEIGHTS.ACTIVITY * 100);

    // Recovery score (0-25)
    try {
      const avgFatigue = await getAverageFatigueLevel();
      const recoveryScore = 100 - (avgFatigue ?? 50);
      score += (recoveryScore / 100) * (SCORE_WEIGHTS.RECOVERY * 100);
    } catch {
      score += (50 / 100) * (SCORE_WEIGHTS.RECOVERY * 100); // Default: 50% recovery
    }

    // Sleep score (0-25)
    try {
      const sleepMultiplier = await this.sleepEngine.getSleepRecoveryMultiplier();
      const sleepScore = Math.min(100, sleepMultiplier * 100);
      score += (sleepScore / 100) * (SCORE_WEIGHTS.SLEEP * 100);
    } catch {
      score += (50 / 100) * (SCORE_WEIGHTS.SLEEP * 100); // Default: 50% sleep
    }

    // Consistency score (0-15) — based on workout streak
    try {
      const currentStreak = await getWorkoutStreakCurrent('user_local_001');
      const consistencyScore = Math.min(100, currentStreak * 15);
      score += (consistencyScore / 100) * (SCORE_WEIGHTS.CONSISTENCY * 100);
    } catch {
      score += 0;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get a real-time health snapshot.
   */
  async getSnapshot(): Promise<HealthSnapshot> {
    const healthScore = await this.calculateHealthScore();

    const avgHr = this.todayData.heartRateReadings.length > 0
      ? Math.round(
          this.todayData.heartRateReadings.reduce((a, b) => a + b, 0) /
            this.todayData.heartRateReadings.length
        )
      : null;

    let sleepQuality: number | null = null;
    try {
      const analytics = await this.sleepEngine.getAnalytics(7);
      sleepQuality = analytics.avgQualityScore || null;
    } catch {
      // No sleep data
    }

    return {
      timestamp: Date.now(),
      steps: this.todayData.steps,
      calories: this.todayData.calories,
      activeMinutes: this.todayData.activeMinutes,
      restingHeartRate: avgHr,
      recoveryScore: 0, // Filled by caller if needed
      sleepQuality,
      anomaliesDetected: 0,
      overallScore: healthScore,
    };
  }

  // ============================================
  // DAILY SUMMARY
  // ============================================

  /**
   * Generate and store daily health summary.
   * Should be called near end of day (or next morning).
   */
  async generateDailySummary(date?: string): Promise<DailyHealthSummary> {
    const targetDate = date || new Date().toISOString().split('T')[0]!;
    const healthScore = await this.calculateHealthScore();

    const avgHr = this.todayData.heartRateReadings.length > 0
      ? Math.round(
          this.todayData.heartRateReadings.reduce((a, b) => a + b, 0) /
            this.todayData.heartRateReadings.length
        )
      : null;

    let sleepHours: number | null = null;
    let sleepQuality: number | null = null;
    try {
      const analytics = await this.sleepEngine.getAnalytics(1);
      sleepHours = analytics.avgDurationMs > 0
        ? Math.round((analytics.avgDurationMs / 3600000) * 10) / 10
        : null;
      sleepQuality = analytics.avgQualityScore || null;
    } catch {
      // No sleep data
    }

    // Get anomalies for today
    const anomalies: string[] = [];
    try {
      const alerts = await encryptedDB.getActiveAlerts();
      const todayStart = new Date(targetDate).getTime();
      const todayEnd = todayStart + 24 * 60 * 60 * 1000;
      for (const alert of alerts) {
        if (alert.created_at >= todayStart && alert.created_at < todayEnd) {
          anomalies.push(`${alert.alertType}: ${alert.severity}`);
        }
      }
    } catch {
      // No alerts
    }

    const summary: DailyHealthSummary = {
      date: targetDate,
      totalSteps: this.todayData.steps,
      totalCalories: this.todayData.calories,
      activeMinutes: this.todayData.activeMinutes,
      workoutsCompleted: this.todayData.workoutsCompleted,
      avgHeartRate: avgHr,
      sleepHours,
      sleepQuality,
      recoveryScore: healthScore, // Simplified — use full recovery engine in production
      healthScore,
      anomalies,
    };

    // Store summary encrypted
    await encryptedDB.storeHealthData('daily_summary', summary);

    if (__DEV__) console.log(`[BackgroundHealth] Daily summary: score=${healthScore}, steps=${this.todayData.steps}`);

    return summary;
  }

  /**
   * Generate weekly report.
   */
  async generateWeeklyReport(): Promise<WeeklyReport> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // Get daily summaries from encrypted storage
    const rawSummaries = await encryptedDB.getRecentHealthData('daily_summary', 7);
    const summaries = rawSummaries as DailyHealthSummary[];

    const avgSteps = summaries.length > 0
      ? Math.round(summaries.reduce((a, b) => a + b.totalSteps, 0) / summaries.length)
      : 0;

    const totalWorkouts = summaries.reduce((a, b) => a + b.workoutsCompleted, 0);

    const avgRecovery = summaries.length > 0
      ? Math.round(summaries.reduce((a, b) => a + b.recoveryScore, 0) / summaries.length)
      : 0;

    const sleepSummaries = summaries.filter((s) => s.sleepQuality != null);
    const avgSleepQuality = sleepSummaries.length > 0
      ? Math.round(sleepSummaries.reduce((a, b) => a + (b.sleepQuality || 0), 0) / sleepSummaries.length)
      : 0;

    const avgHealthScore = summaries.length > 0
      ? Math.round(summaries.reduce((a, b) => a + b.healthScore, 0) / summaries.length)
      : 0;

    // Trend: compare first half to second half
    let trend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
    if (summaries.length >= 4) {
      const half = Math.floor(summaries.length / 2);
      const firstAvg = summaries.slice(0, half).reduce((a, b) => a + b.healthScore, 0) / half;
      const secondAvg = summaries.slice(half).reduce((a, b) => a + b.healthScore, 0) / (summaries.length - half);
      if (secondAvg - firstAvg > 5) trend = 'IMPROVING';
      else if (firstAvg - secondAvg > 5) trend = 'DECLINING';
    }

    // Generate insight
    const topInsight = this.generateTopInsight(avgSteps, totalWorkouts, avgSleepQuality, avgRecovery);

    // Generate recommendations
    const recommendations = this.generateWeeklyRecommendations(
      avgSteps, totalWorkouts, avgSleepQuality, avgRecovery, trend
    );

    return {
      weekStart: weekStart.toISOString().split('T')[0]!,
      weekEnd: now.toISOString().split('T')[0]!,
      avgDailySteps: avgSteps,
      totalWorkouts,
      avgRecoveryScore: avgRecovery,
      avgSleepQuality,
      avgHealthScore,
      trend,
      topInsight,
      recommendations,
    };
  }

  // ============================================
  // INTERNAL HELPERS
  // ============================================

  // ============================================
  // BATTERY-AWARE SCHEDULING
  // ============================================

  /**
   * Check current battery level + charging state and determine throttle tier.
   */
  private async updateBatteryTier(): Promise<void> {
    try {
      const [level, batteryState] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
      ]);

      const isCharging =
        batteryState === Battery.BatteryState.CHARGING ||
        batteryState === Battery.BatteryState.FULL;

      if (isCharging) {
        this.currentBatteryTier = 'CHARGING';
      } else if (level >= 0 && level < this.config.criticalBatteryThreshold) {
        this.currentBatteryTier = 'CRITICAL';
      } else if (level >= 0 && level < this.config.lowBatteryThreshold) {
        this.currentBatteryTier = 'LOW';
      } else {
        this.currentBatteryTier = 'NORMAL';
      }
    } catch {
      // Battery API unavailable (e.g. web/simulator) — default to normal
      this.currentBatteryTier = 'NORMAL';
    }
  }

  /**
   * Handle battery state changes (charging/unplugged).
   * Re-evaluates tier and restarts timers with adjusted intervals.
   */
  private handleBatteryStateChange = async ({ batteryState }: { batteryState: Battery.BatteryState }): Promise<void> => {
    const previousTier = this.currentBatteryTier;
    await this.updateBatteryTier();

    if (previousTier !== this.currentBatteryTier && this.state === 'RUNNING') {
      if (__DEV__) console.log(`[BackgroundHealth] Battery tier: ${previousTier} → ${this.currentBatteryTier}`);
      this.restartTimers();
    }
  };

  /**
   * Get the interval multiplier for the current battery tier.
   */
  private getIntervalMultiplier(): number {
    switch (this.currentBatteryTier) {
      case 'CHARGING': return BATTERY_THROTTLE.CHARGING;
      case 'LOW': return BATTERY_THROTTLE.LOW;
      case 'CRITICAL': return 0; // No polling — paused
      case 'NORMAL':
      default:
        return BATTERY_THROTTLE.NORMAL;
    }
  }

  /**
   * (Re)start interval timers with battery-adjusted intervals.
   * Called on start() and when battery tier changes.
   */
  private restartTimers(): void {
    // Clear existing timers
    if (this.collectionTimer) clearInterval(this.collectionTimer);
    if (this.anomalyTimer) clearInterval(this.anomalyTimer);
    this.collectionTimer = null;
    this.anomalyTimer = null;

    const multiplier = this.getIntervalMultiplier();
    if (multiplier === 0) {
      // Critical battery — pause all polling
      if (__DEV__) console.log('[BackgroundHealth] Critical battery — polling paused');
      return;
    }

    const collectionMs = Math.round(this.config.collectionIntervalMs * multiplier);
    const anomalyMs = Math.round(this.config.anomalyCheckIntervalMs * multiplier);

    this.collectionTimer = setInterval(() => {
      this.collectAndProcess();
    }, collectionMs);

    this.anomalyTimer = setInterval(() => {
      this.runAnomalyCheck();
    }, anomalyMs);

    if (__DEV__) console.log(`[BackgroundHealth] Timers set: collect=${collectionMs}ms, anomaly=${anomalyMs}ms`);
  }

  /**
   * Get current battery tier (for UI display / diagnostics).
   */
  getBatteryTier(): BatteryTier {
    return this.currentBatteryTier;
  }

  // ============================================
  // APP STATE HANDLING
  // ============================================

  private handleAppState = async (nextState: AppStateStatus): Promise<void> => {
    if (nextState === 'background' || nextState === 'inactive') {
      // Store snapshot before going to background
      this.storeSnapshot().catch(() => {});
    } else if (nextState === 'active') {
      // Re-check battery state when foregrounded
      await this.updateBatteryTier();
      this.restartTimers();
      // Resume collection
      if (this.state === 'RUNNING' && this.currentBatteryTier !== 'CRITICAL') {
        this.collectAndProcess();
      }
    }
  };

  private async storeSnapshot(): Promise<void> {
    try {
      await encryptedDB.storeHealthData('health_snapshot', {
        ...this.todayData,
        timestamp: Date.now(),
      });
    } catch {
      // Best effort
    }
  }

  private estimateActiveCalories(steps: number, workouts: number): number {
    // Steps: ~0.04 cal per step (average for 70kg person)
    const stepCalories = steps * 0.04;
    // Workouts: ~300 cal per workout (rough estimate)
    const workoutCalories = workouts * 300;
    return Math.round(stepCalories + workoutCalories);
  }

  private resetTodayData() {
    return {
      steps: 0,
      calories: 0,
      activeMinutes: 0,
      heartRateReadings: [] as number[],
      workoutsCompleted: 0,
    };
  }

  private generateTopInsight(
    avgSteps: number,
    totalWorkouts: number,
    avgSleep: number,
    avgRecovery: number
  ): string {
    if (avgRecovery < 40) {
      return 'Recovery is low — your body needs rest. Consider lighter workouts this week.';
    }
    if (avgSleep < 60 && avgSleep > 0) {
      return 'Sleep quality is impacting your performance. Prioritize sleep hygiene.';
    }
    if (totalWorkouts >= 5) {
      return 'Excellent workout consistency! Make sure to include rest days.';
    }
    if (avgSteps < 5000) {
      return 'Activity levels are low. Try adding 10-minute walks throughout the day.';
    }
    if (avgSteps > 12000) {
      return 'Great activity levels! You\'re well above the recommended daily step count.';
    }
    return 'Keep up your current routine — consistency is the key to long-term health.';
  }

  private generateWeeklyRecommendations(
    avgSteps: number,
    totalWorkouts: number,
    avgSleep: number,
    avgRecovery: number,
    trend: string
  ): string[] {
    const recs: string[] = [];

    if (avgSteps < 7000) recs.push('Aim for 10,000 steps daily — try a post-meal walk.');
    if (totalWorkouts < 3) recs.push('Try to complete at least 3 workouts per week for optimal health.');
    if (avgSleep < 65 && avgSleep > 0) recs.push('Improve sleep: consistent bedtime, dark room, no screens 1h before bed.');
    if (avgRecovery < 50) recs.push('Take a deload week — reduce intensity by 40-50%.');
    if (trend === 'DECLINING') recs.push('Your health metrics are trending down. Review stress, sleep, and nutrition.');
    if (totalWorkouts > 6) recs.push('You\'re training heavily. Ensure at least 1 full rest day per week.');

    if (recs.length === 0) {
      recs.push('You\'re on track! Maintain your current habits for continued progress.');
    }

    return recs;
  }
}

// Singleton
export const backgroundHealth = BackgroundHealthEngine.getInstance();
