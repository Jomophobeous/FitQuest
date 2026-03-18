/**
 * FitQuest Sleep Analysis Engine
 * 
 * On-device sleep quality analysis and tracking.
 * Uses accelerometer inactivity patterns + user-reported sleep times
 * to estimate sleep stages and quality.
 * 
 * Features:
 * - Sleep quality scoring (0-100)
 * - Sleep stage estimation (AWAKE, LIGHT, DEEP, REM)
 * - Sleep debt calculation
 * - Circadian rhythm analysis
 * - Sleep efficiency metrics
 * - Weekly/monthly trend analysis
 * - Recovery correlation (sleep ↔ workout performance)
 * 
 * Evidence-based sleep duration recommendations:
 * - Adults (18-64): 7-9 hours
 * - Athletes: 8-10 hours
 * - After intense training: +30-60 min
 * 
 * Data stored encrypted via EncryptedDatabase.
 */

import * as Crypto from 'expo-crypto';
import { encryptedDB } from '../security/EncryptedDatabase';
import { getDatabase } from '../database/schema';

// ============================================
// TYPES
// ============================================

export type SleepStage = 'AWAKE' | 'LIGHT' | 'DEEP' | 'REM';

export interface SleepSession {
  id: string;
  bedtime: number;           // Unix ms
  wakeTime: number;          // Unix ms
  totalDurationMs: number;
  sleepLatencyMs: number;     // Time to fall asleep
  awakeningsCount: number;    // Times woken up
  stages: SleepStageBlock[];
  qualityScore: number;       // 0-100
  efficiency: number;         // % of time in bed actually sleeping
  notes: string | null;
  source: 'MANUAL' | 'SENSOR' | 'ESTIMATED';
}

export interface SleepStageBlock {
  stage: SleepStage;
  startMs: number;          // Offset from bedtime
  durationMs: number;
}

export interface SleepAnalytics {
  avgDurationMs: number;
  avgQualityScore: number;
  avgEfficiency: number;
  avgBedtime: string;          // HH:MM format
  avgWakeTime: string;
  sleepDebtHours: number;      // Cumulative deficit
  consistencyScore: number;    // 0-100 (bedtime regularity)
  weekdayAvgMs: number;
  weekendAvgMs: number;
  trendDirection: 'IMPROVING' | 'DECLINING' | 'STABLE';
  recommendations: string[];
}

export interface SleepGoal {
  targetDurationMs: number;    // e.g., 8 hours
  targetBedtime: string;       // HH:MM
  targetWakeTime: string;      // HH:MM
}

// ============================================
// CONSTANTS
// ============================================

const RECOMMENDED_SLEEP_MS = 8 * 60 * 60 * 1000;  // 8 hours
const MIN_SLEEP_MS = 7 * 60 * 60 * 1000;           // 7 hours
const ATHLETE_SLEEP_MS = 9 * 60 * 60 * 1000;       // 9 hours
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Sleep stage distribution (typical healthy adult, % of total sleep)
const IDEAL_STAGE_DISTRIBUTION = {
  AWAKE: 0.05,   // 5% (brief awakenings)
  LIGHT: 0.50,   // 50%
  DEEP: 0.20,    // 20%
  REM: 0.25,     // 25%
};

// Sleep cycle duration (approximately 90 min)
const SLEEP_CYCLE_MS = 90 * 60 * 1000;

// ============================================
// SLEEP ANALYSIS ENGINE
// ============================================

export class SleepAnalysisEngine {
  private static instance: SleepAnalysisEngine | null = null;

  private constructor() {}

  static getInstance(): SleepAnalysisEngine {
    if (!SleepAnalysisEngine.instance) {
      SleepAnalysisEngine.instance = new SleepAnalysisEngine();
    }
    return SleepAnalysisEngine.instance;
  }

  // ============================================
  // SESSION RECORDING
  // ============================================

  /**
   * Record a manual sleep session.
   * User provides bedtime and wake time; engine estimates stages + quality.
   */
  async recordManualSession(
    bedtime: Date,
    wakeTime: Date,
    options?: {
      sleepLatencyMin?: number;
      awakenings?: number;
      notes?: string;
    }
  ): Promise<SleepSession> {
    const bedtimeMs = bedtime.getTime();
    const wakeTimeMs = wakeTime.getTime();
    const totalDurationMs = wakeTimeMs - bedtimeMs;

    if (totalDurationMs <= 0 || totalDurationMs > 24 * HOUR_MS) {
      throw new Error('Invalid sleep duration. Must be between 0 and 24 hours.');
    }

    const sleepLatencyMs = (options?.sleepLatencyMin || 15) * 60 * 1000;
    const awakeningsCount = options?.awakenings || Math.round(totalDurationMs / (2 * HOUR_MS));
    const actualSleepMs = totalDurationMs - sleepLatencyMs;

    // Estimate sleep stages
    const stages = this.estimateStages(actualSleepMs, awakeningsCount);

    // Calculate quality score
    const qualityScore = this.calculateQualityScore({
      totalDurationMs,
      actualSleepMs,
      sleepLatencyMs,
      awakeningsCount,
      stages,
      bedtimeMs,
    });

    const efficiency = totalDurationMs > 0
      ? Math.round((actualSleepMs / totalDurationMs) * 100)
      : 0;

    const session: SleepSession = {
      id: `sleep_${Date.now()}_${Crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
      bedtime: bedtimeMs,
      wakeTime: wakeTimeMs,
      totalDurationMs,
      sleepLatencyMs,
      awakeningsCount,
      stages,
      qualityScore,
      efficiency,
      notes: options?.notes || null,
      source: 'MANUAL',
    };

    // Store encrypted
    await encryptedDB.storeHealthData('sleep_session', session);

    if (__DEV__) {
      console.log(
        `[SleepEngine] Session recorded: ${(totalDurationMs / HOUR_MS).toFixed(1)}h, quality: ${qualityScore}`
      );
    }

    return session;
  }

  /**
   * Record a sensor-based session (from accelerometer inactivity data).
   */
  async recordSensorSession(
    bedtime: number,
    wakeTime: number,
    movementData: Array<{ timestamp: number; intensity: number }>
  ): Promise<SleepSession> {
    const totalDurationMs = wakeTime - bedtime;

    // Estimate sleep latency from initial movement
    const sleepLatencyMs = this.estimateSleepLatency(movementData, bedtime);

    // Count awakenings from movement spikes
    const awakeningsCount = this.countAwakenings(movementData);

    const actualSleepMs = totalDurationMs - sleepLatencyMs;
    const stages = this.estimateStagesFromMovement(movementData, bedtime, actualSleepMs);

    const qualityScore = this.calculateQualityScore({
      totalDurationMs,
      actualSleepMs,
      sleepLatencyMs,
      awakeningsCount,
      stages,
      bedtimeMs: bedtime,
    });

    const efficiency = totalDurationMs > 0
      ? Math.round((actualSleepMs / totalDurationMs) * 100)
      : 0;

    const session: SleepSession = {
      id: `sleep_${Date.now()}_${Crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
      bedtime,
      wakeTime,
      totalDurationMs,
      sleepLatencyMs,
      awakeningsCount,
      stages,
      qualityScore,
      efficiency,
      notes: null,
      source: 'SENSOR',
    };

    await encryptedDB.storeHealthData('sleep_session', session);

    return session;
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get comprehensive sleep analytics for a given period.
   */
  async getAnalytics(days = 30): Promise<SleepAnalytics> {
    const sessions = await this.getRecentSessions(days);

    if (sessions.length === 0) {
      return this.emptyAnalytics();
    }

    // Average duration
    const durations = sessions.map((s) => s.totalDurationMs);
    const avgDurationMs = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Average quality
    const qualities = sessions.map((s) => s.qualityScore);
    const avgQualityScore = Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length);

    // Average efficiency
    const efficiencies = sessions.map((s) => s.efficiency);
    const avgEfficiency = Math.round(efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length);

    // Average bed/wake times
    const avgBedtime = this.averageTimeOfDay(sessions.map((s) => s.bedtime));
    const avgWakeTime = this.averageTimeOfDay(sessions.map((s) => s.wakeTime));

    // Sleep debt
    const sleepDebtHours = this.calculateSleepDebt(sessions, days);

    // Consistency (bedtime regularity)
    const consistencyScore = this.calculateConsistency(sessions);

    // Weekday vs weekend
    const weekdaySessions = sessions.filter((s) => {
      const day = new Date(s.bedtime).getDay();
      return day >= 1 && day <= 5;
    });
    const weekendSessions = sessions.filter((s) => {
      const day = new Date(s.bedtime).getDay();
      return day === 0 || day === 6;
    });

    const weekdayAvgMs = weekdaySessions.length > 0
      ? weekdaySessions.reduce((a, b) => a + b.totalDurationMs, 0) / weekdaySessions.length
      : 0;
    const weekendAvgMs = weekendSessions.length > 0
      ? weekendSessions.reduce((a, b) => a + b.totalDurationMs, 0) / weekendSessions.length
      : 0;

    // Trend direction
    const trendDirection = this.analyzeTrend(sessions);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      avgDurationMs,
      avgQualityScore,
      avgEfficiency,
      sleepDebtHours,
      consistencyScore,
      weekdayAvgMs,
      weekendAvgMs,
    });

    return {
      avgDurationMs,
      avgQualityScore,
      avgEfficiency,
      avgBedtime,
      avgWakeTime,
      sleepDebtHours,
      consistencyScore,
      weekdayAvgMs,
      weekendAvgMs,
      trendDirection,
      recommendations,
    };
  }

  /**
   * Get sleep quality trend data for charting.
   */
  async getQualityTrend(days = 14): Promise<Array<{ date: string; quality: number; durationHours: number }>> {
    const sessions = await this.getRecentSessions(days);

    return sessions.map((s) => ({
      date: new Date(s.bedtime).toISOString().split('T')[0]!,
      quality: s.qualityScore,
      durationHours: Math.round((s.totalDurationMs / HOUR_MS) * 10) / 10,
    }));
  }

  /**
   * Get the optimal bedtime based on desired wake time and sleep cycles.
   */
  getOptimalBedtime(
    desiredWakeTime: Date,
    sleepCycles: number = 5 // 5 cycles ≈ 7.5 hours
  ): Date {
    const sleepDurationMs = sleepCycles * SLEEP_CYCLE_MS;
    const fallAsleepBuffer = 15 * 60 * 1000; // 15 min to fall asleep
    const bedtimeMs = desiredWakeTime.getTime() - sleepDurationMs - fallAsleepBuffer;
    return new Date(bedtimeMs);
  }

  /**
   * Calculate recovery impact based on sleep quality.
   * Returns a multiplier (0.5 - 1.2) for workout recovery scoring.
   */
  async getSleepRecoveryMultiplier(): Promise<number> {
    const sessions = await this.getRecentSessions(3);

    if (sessions.length === 0) return 1.0;

    const avgQuality = sessions.reduce((a, b) => a + b.qualityScore, 0) / sessions.length;
    const avgDurationMs = sessions.reduce((a, b) => a + b.totalDurationMs, 0) / sessions.length;

    // Quality factor (0.7 - 1.1)
    const qualityFactor = 0.7 + (avgQuality / 100) * 0.4;

    // Duration factor (0.7 - 1.1)
    const durationRatio = avgDurationMs / RECOMMENDED_SLEEP_MS;
    const durationFactor = Math.max(0.7, Math.min(1.1, durationRatio));

    return Math.round(qualityFactor * durationFactor * 100) / 100;
  }

  // ============================================
  // INTERNAL: SLEEP STAGE ESTIMATION
  // ============================================

  /**
   * Estimate sleep stages based on total sleep time and awakenings.
   * Uses typical sleep architecture patterns.
   */
  private estimateStages(actualSleepMs: number, awakenings: number): SleepStageBlock[] {
    const stages: SleepStageBlock[] = [];
    let offsetMs = 0;
    const numCycles = Math.max(1, Math.round(actualSleepMs / SLEEP_CYCLE_MS));

    for (let cycle = 0; cycle < numCycles; cycle++) {
      const cycleDurationMs = Math.min(SLEEP_CYCLE_MS, actualSleepMs - offsetMs);
      if (cycleDurationMs <= 0) break;

      // Early cycles: more deep sleep. Later cycles: more REM.
      const deepFraction = Math.max(0.05, 0.30 - cycle * 0.05);
      const remFraction = Math.min(0.35, 0.15 + cycle * 0.05);
      const lightFraction = 1 - deepFraction - remFraction;

      // Light sleep
      stages.push({
        stage: 'LIGHT',
        startMs: offsetMs,
        durationMs: Math.round(cycleDurationMs * lightFraction),
      });
      offsetMs += Math.round(cycleDurationMs * lightFraction);

      // Deep sleep
      stages.push({
        stage: 'DEEP',
        startMs: offsetMs,
        durationMs: Math.round(cycleDurationMs * deepFraction),
      });
      offsetMs += Math.round(cycleDurationMs * deepFraction);

      // REM
      stages.push({
        stage: 'REM',
        startMs: offsetMs,
        durationMs: Math.round(cycleDurationMs * remFraction),
      });
      offsetMs += Math.round(cycleDurationMs * remFraction);

      // Brief awakening between cycles
      if (cycle < numCycles - 1 && awakenings > cycle) {
        stages.push({
          stage: 'AWAKE',
          startMs: offsetMs,
          durationMs: 2 * 60 * 1000, // 2 min
        });
        offsetMs += 2 * 60 * 1000;
      }
    }

    return stages;
  }

  /**
   * Estimate stages from accelerometer movement data.
   */
  private estimateStagesFromMovement(
    movementData: Array<{ timestamp: number; intensity: number }>,
    bedtime: number,
    actualSleepMs: number
  ): SleepStageBlock[] {
    // Group movement data into 30-min windows
    const windowMs = 30 * 60 * 1000;
    const windows: Array<{ avgIntensity: number; offsetMs: number }> = [];

    for (let offset = 0; offset < actualSleepMs; offset += windowMs) {
      const windowStart = bedtime + offset;
      const windowEnd = windowStart + windowMs;

      const windowData = movementData.filter(
        (d) => d.timestamp >= windowStart && d.timestamp < windowEnd
      );

      const avgIntensity = windowData.length > 0
        ? windowData.reduce((a, b) => a + b.intensity, 0) / windowData.length
        : 0;

      windows.push({ avgIntensity, offsetMs: offset });
    }

    // Classify windows into stages based on movement intensity
    const stages: SleepStageBlock[] = [];
    for (const window of windows) {
      let stage: SleepStage;
      if (window.avgIntensity > 0.5) {
        stage = 'AWAKE';
      } else if (window.avgIntensity > 0.2) {
        stage = 'LIGHT';
      } else if (window.avgIntensity > 0.05) {
        stage = 'REM';  // Moderate stillness with occasional micro-movements
      } else {
        stage = 'DEEP'; // Very still
      }

      stages.push({
        stage,
        startMs: window.offsetMs,
        durationMs: windowMs,
      });
    }

    return stages;
  }

  private estimateSleepLatency(
    movementData: Array<{ timestamp: number; intensity: number }>,
    bedtime: number
  ): number {
    // Find when movement drops below threshold after bedtime
    const threshold = 0.1;
    const sortedData = [...movementData]
      .filter((d) => d.timestamp >= bedtime)
      .sort((a, b) => a.timestamp - b.timestamp);

    for (const point of sortedData) {
      if (point.intensity < threshold) {
        return Math.max(0, point.timestamp - bedtime);
      }
    }

    return 15 * 60 * 1000; // Default 15 min
  }

  private countAwakenings(movementData: Array<{ timestamp: number; intensity: number }>): number {
    let awakenings = 0;
    let wasAsleep = false;

    for (const point of movementData) {
      if (point.intensity < 0.1) {
        wasAsleep = true;
      } else if (point.intensity > 0.5 && wasAsleep) {
        awakenings++;
        wasAsleep = false;
      }
    }

    return awakenings;
  }

  // ============================================
  // INTERNAL: QUALITY SCORING
  // ============================================

  private calculateQualityScore(params: {
    totalDurationMs: number;
    actualSleepMs: number;
    sleepLatencyMs: number;
    awakeningsCount: number;
    stages: SleepStageBlock[];
    bedtimeMs: number;
  }): number {
    let score = 100;

    // Duration factor (0-30 points)
    const durationHours = params.totalDurationMs / HOUR_MS;
    if (durationHours < 6) {
      score -= 30;
    } else if (durationHours < 7) {
      score -= 20;
    } else if (durationHours < 7.5) {
      score -= 10;
    } else if (durationHours > 9.5) {
      score -= 5; // Too much sleep can also be suboptimal
    }

    // Sleep efficiency (0-20 points)
    const efficiency = params.actualSleepMs / params.totalDurationMs;
    if (efficiency < 0.75) score -= 20;
    else if (efficiency < 0.85) score -= 10;
    else if (efficiency < 0.90) score -= 5;

    // Sleep latency (0-15 points)
    const latencyMin = params.sleepLatencyMs / 60000;
    if (latencyMin > 30) score -= 15;
    else if (latencyMin > 20) score -= 10;
    else if (latencyMin > 15) score -= 5;

    // Awakenings (0-15 points)
    if (params.awakeningsCount > 5) score -= 15;
    else if (params.awakeningsCount > 3) score -= 10;
    else if (params.awakeningsCount > 1) score -= 5;

    // Deep sleep ratio (0-10 points)
    const deepMs = params.stages
      .filter((s) => s.stage === 'DEEP')
      .reduce((a, b) => a + b.durationMs, 0);
    const deepRatio = deepMs / params.actualSleepMs;
    if (deepRatio < 0.10) score -= 10;
    else if (deepRatio < 0.15) score -= 5;

    // REM ratio (0-10 points)
    const remMs = params.stages
      .filter((s) => s.stage === 'REM')
      .reduce((a, b) => a + b.durationMs, 0);
    const remRatio = remMs / params.actualSleepMs;
    if (remRatio < 0.15) score -= 10;
    else if (remRatio < 0.20) score -= 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ============================================
  // INTERNAL: ANALYTICS HELPERS
  // ============================================

  private async getRecentSessions(days: number): Promise<SleepSession[]> {
    try {
      const raw = await encryptedDB.getRecentHealthData('sleep_session', days);
      return raw as SleepSession[];
    } catch {
      return [];
    }
  }

  private averageTimeOfDay(timestamps: number[]): string {
    if (timestamps.length === 0) return '00:00';

    const minutesOfDay = timestamps.map((ts) => {
      const d = new Date(ts);
      let minutes = d.getHours() * 60 + d.getMinutes();
      // Handle times past midnight (e.g., 11 PM → next day 7 AM)
      if (minutes < 12 * 60) minutes += 24 * 60; // Treat as "late night"
      return minutes;
    });

    const avgMinutes = Math.round(
      minutesOfDay.reduce((a, b) => a + b, 0) / minutesOfDay.length
    ) % (24 * 60);

    const hours = Math.floor(avgMinutes / 60);
    const mins = avgMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private calculateSleepDebt(sessions: SleepSession[], days: number): number {
    const totalSleepMs = sessions.reduce((a, b) => a + b.totalDurationMs, 0);
    const targetMs = days * RECOMMENDED_SLEEP_MS;
    // Allow surplus sleep to partially pay off debt (capped at 0 — you can't go negative)
    // but also cap maximum reported debt at 3 days worth to avoid alarming numbers
    const rawDebtMs = targetMs - totalSleepMs;
    const cappedDebtMs = Math.max(0, Math.min(rawDebtMs, 3 * RECOMMENDED_SLEEP_MS));
    return Math.round((cappedDebtMs / HOUR_MS) * 10) / 10;
  }

  private calculateConsistency(sessions: SleepSession[]): number {
    if (sessions.length < 3) return 50;

    // Measure bedtime variation
    const bedtimeMinutes = sessions.map((s) => {
      const d = new Date(s.bedtime);
      let min = d.getHours() * 60 + d.getMinutes();
      if (min < 12 * 60) min += 24 * 60;
      return min;
    });

    const avg = bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length;
    const variance = bedtimeMinutes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / bedtimeMinutes.length;
    const stdDev = Math.sqrt(variance); // in minutes

    // < 15 min std dev = very consistent (100), > 90 min = very inconsistent (0)
    const score = Math.max(0, Math.min(100, Math.round(100 - (stdDev - 15) * (100 / 75))));
    return score;
  }

  private analyzeTrend(sessions: SleepSession[]): 'IMPROVING' | 'DECLINING' | 'STABLE' {
    if (sessions.length < 5) return 'STABLE';

    const half = Math.floor(sessions.length / 2);
    const firstHalf = sessions.slice(0, half);
    const secondHalf = sessions.slice(half);

    const firstAvg = firstHalf.reduce((a, b) => a + b.qualityScore, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b.qualityScore, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    if (diff > 5) return 'IMPROVING';
    if (diff < -5) return 'DECLINING';
    return 'STABLE';
  }

  private generateRecommendations(analytics: {
    avgDurationMs: number;
    avgQualityScore: number;
    avgEfficiency: number;
    sleepDebtHours: number;
    consistencyScore: number;
    weekdayAvgMs: number;
    weekendAvgMs: number;
  }): string[] {
    const recs: string[] = [];
    const avgHours = analytics.avgDurationMs / HOUR_MS;

    if (avgHours < 7) {
      recs.push(`You're averaging ${avgHours.toFixed(1)} hours — aim for 7-9 hours. Try going to bed 30 minutes earlier.`);
    }

    if (analytics.avgQualityScore < 60) {
      recs.push('Sleep quality is low. Limit caffeine after 2 PM and avoid screens 1 hour before bed.');
    }

    if (analytics.avgEfficiency < 85) {
      recs.push('Sleep efficiency is below 85%. Try not to stay in bed if you can\'t sleep — get up and do something relaxing.');
    }

    if (analytics.sleepDebtHours > 5) {
      recs.push(`You have ${analytics.sleepDebtHours}h of sleep debt. Prioritize earlier bedtimes this week.`);
    }

    if (analytics.consistencyScore < 50) {
      recs.push('Your bedtime varies a lot. A consistent schedule helps regulate your circadian rhythm.');
    }

    const weekdayH = analytics.weekdayAvgMs / HOUR_MS;
    const weekendH = analytics.weekendAvgMs / HOUR_MS;
    if (weekendH - weekdayH > 1.5) {
      recs.push(`You sleep ${(weekendH - weekdayH).toFixed(1)}h more on weekends — "social jet lag" hurts recovery.`);
    }

    if (recs.length === 0) {
      recs.push('Great sleep habits! Keep up the consistent routine.');
    }

    return recs;
  }

  private emptyAnalytics(): SleepAnalytics {
    return {
      avgDurationMs: 0,
      avgQualityScore: 0,
      avgEfficiency: 0,
      avgBedtime: '--:--',
      avgWakeTime: '--:--',
      sleepDebtHours: 0,
      consistencyScore: 0,
      weekdayAvgMs: 0,
      weekendAvgMs: 0,
      trendDirection: 'STABLE',
      recommendations: ['Start tracking your sleep to get personalized insights.'],
    };
  }
}

// Singleton
export const sleepEngine = SleepAnalysisEngine.getInstance();
