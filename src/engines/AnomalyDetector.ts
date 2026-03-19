/**
 * FitQuest Anomaly Detector Engine
 * 
 * Statistical anomaly detection for health metrics using
 * on-device algorithms (no ML framework required).
 * 
 * Detection methods:
 * - Z-score detection (normal distribution outliers)
 * - IQR (Interquartile Range) for robust outlier detection
 * - Rate-of-change detection (sudden spikes/drops)
 * - Moving average deviation (trend breaks)
 * - Multi-metric correlation anomalies
 * 
 * Supported metrics:
 * - Heart rate (resting, active, recovery)
 * - Step count patterns
 * - Workout performance (volume, intensity deviations)
 * - Sleep quality (when SleepAnalysisEngine data available)
 * - Recovery score trends
 * 
 * Generates health alerts via EncryptedDatabase when anomalies
 * exceed severity thresholds.
 */

import { encryptedDB } from '../security/EncryptedDatabase';

// ============================================
// TYPES
// ============================================

export type AnomalyType =
  | 'HEART_RATE_HIGH'
  | 'HEART_RATE_LOW'
  | 'HEART_RATE_IRREGULAR'
  | 'ACTIVITY_SPIKE'
  | 'ACTIVITY_DROP'
  | 'RECOVERY_DECLINE'
  | 'WORKOUT_OVERTRAINING'
  | 'SLEEP_DISRUPTION'
  | 'WEIGHT_RAPID_CHANGE'
  | 'METRIC_CORRELATION';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AnomalyResult {
  detected: boolean;
  type: AnomalyType;
  severity: AnomalySeverity;
  metric: string;
  currentValue: number;
  expectedRange: { min: number; max: number };
  zScore: number;
  message: string;
  recommendation: string;
  timestamp: number;
}

export interface MetricDataPoint {
  value: number;
  timestamp: number;
}

export interface AnomalyConfig {
  /** Z-score threshold for detection (default: 2.0 = ~95% confidence) */
  zScoreThreshold?: number;
  /** Minimum data points needed for reliable detection */
  minDataPoints?: number;
  /** Enable rate-of-change detection */
  enableRateDetection?: boolean;
  /** Rate-of-change threshold (fraction, e.g., 0.3 = 30% change) */
  rateChangeThreshold?: number;
  /** Auto-create health alerts for HIGH+ severity */
  autoAlert?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: Required<AnomalyConfig> = {
  zScoreThreshold: 2.0,
  minDataPoints: 7,
  enableRateDetection: true,
  rateChangeThreshold: 0.3,
  autoAlert: true,
};

// Medical reference ranges
const REFERENCE_RANGES = {
  restingHeartRate: { min: 40, max: 100, criticalMin: 30, criticalMax: 150 },
  activeHeartRate: { min: 80, max: 200, criticalMin: 60, criticalMax: 220 },
  dailySteps: { min: 500, max: 30000 },
  sleepHours: { min: 4, max: 12 },
  recoveryScore: { min: 0, max: 100 },
  bodyWeight: { minChangePerWeek: -2, maxChangePerWeek: 2 }, // kg
};

// ============================================
// ANOMALY DETECTOR ENGINE
// ============================================

export class AnomalyDetector {
  private static instance: AnomalyDetector | null = null;
  private config: Required<AnomalyConfig>;
  // Deduplication: track recently alerted anomaly types with cooldown
  private recentAlerts: Map<string, number> = new Map(); // key → timestamp
  private static ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

  constructor(config?: AnomalyConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: AnomalyConfig): AnomalyDetector {
    if (!AnomalyDetector.instance) {
      AnomalyDetector.instance = new AnomalyDetector(config);
    }
    return AnomalyDetector.instance;
  }

  // ============================================
  // PUBLIC: DETECT ANOMALIES
  // ============================================

  /**
   * Analyze a time series of metric data for anomalies.
   * Returns all detected anomalies sorted by severity.
   */
  async analyzeMetric(
    metricName: string,
    dataPoints: MetricDataPoint[],
    anomalyType: AnomalyType
  ): Promise<AnomalyResult[]> {
    if (dataPoints.length < this.config.minDataPoints) {
      return []; // Not enough data for reliable detection
    }

    const anomalies: AnomalyResult[] = [];

    // Sort by timestamp
    const sorted = [...dataPoints].sort((a, b) => a.timestamp - b.timestamp);
    const values = sorted.map((d) => d.value);

    // 1. Z-score detection on latest value
    const zScoreResult = this.detectZScore(metricName, values, anomalyType);
    if (zScoreResult) anomalies.push(zScoreResult);

    // 2. IQR outlier detection
    const iqrResult = this.detectIQR(metricName, values, anomalyType);
    if (iqrResult) anomalies.push(iqrResult);

    // 3. Rate-of-change detection
    if (this.config.enableRateDetection && values.length >= 3) {
      const rateResult = this.detectRateOfChange(metricName, sorted, anomalyType);
      if (rateResult) anomalies.push(rateResult);
    }

    // 4. Moving average deviation
    const maResult = this.detectMovingAverageDeviation(metricName, values, anomalyType);
    if (maResult) anomalies.push(maResult);

    // Auto-alert for high-severity anomalies (with deduplication)
    if (this.config.autoAlert) {
      const now = Date.now();
      for (const anomaly of anomalies) {
        if (anomaly.severity === 'HIGH' || anomaly.severity === 'CRITICAL') {
          // Dedup: skip if same anomaly type+metric alerted within cooldown window
          const dedupKey = `${anomaly.type}:${anomaly.metric}`;
          const lastAlerted = this.recentAlerts.get(dedupKey);
          if (lastAlerted && now - lastAlerted < AnomalyDetector.ALERT_COOLDOWN_MS) {
            continue;
          }

          try {
            await encryptedDB.createHealthAlert(
              anomaly.type,
              anomaly.severity,
              {
                metric: anomaly.metric,
                value: anomaly.currentValue,
                expectedRange: anomaly.expectedRange,
                zScore: anomaly.zScore,
                message: anomaly.message,
                recommendation: anomaly.recommendation,
              }
            );
            this.recentAlerts.set(dedupKey, now);
          } catch (e) {
            if (__DEV__) console.warn('[AnomalyDetector] Failed to create alert:', e);
          }
        }
      }
    }

    return anomalies.sort((a, b) => {
      const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Run a comprehensive health check across multiple metrics.
   */
  async comprehensiveCheck(metrics: {
    heartRate?: MetricDataPoint[];
    steps?: MetricDataPoint[];
    recovery?: MetricDataPoint[];
    weight?: MetricDataPoint[];
    sleep?: MetricDataPoint[];
  }): Promise<AnomalyResult[]> {
    const allAnomalies: AnomalyResult[] = [];

    if (metrics.heartRate && metrics.heartRate.length >= this.config.minDataPoints) {
      const hrAnomalies = await this.analyzeHeartRate(metrics.heartRate);
      allAnomalies.push(...hrAnomalies);
    }

    if (metrics.steps && metrics.steps.length >= this.config.minDataPoints) {
      const stepAnomalies = await this.analyzeMetric('daily_steps', metrics.steps, 'ACTIVITY_SPIKE');
      allAnomalies.push(...stepAnomalies);
    }

    if (metrics.recovery && metrics.recovery.length >= this.config.minDataPoints) {
      const recoveryAnomalies = await this.analyzeMetric('recovery_score', metrics.recovery, 'RECOVERY_DECLINE');
      allAnomalies.push(...recoveryAnomalies);
    }

    if (metrics.weight && metrics.weight.length >= this.config.minDataPoints) {
      const weightAnomalies = await this.analyzeWeightChange(metrics.weight);
      allAnomalies.push(...weightAnomalies);
    }

    if (metrics.sleep && metrics.sleep.length >= this.config.minDataPoints) {
      const sleepAnomalies = await this.analyzeMetric('sleep_hours', metrics.sleep, 'SLEEP_DISRUPTION');
      allAnomalies.push(...sleepAnomalies);
    }

    // Cross-metric correlation check
    if (metrics.heartRate && metrics.recovery) {
      const correlation = this.detectCorrelationAnomaly(metrics.heartRate, metrics.recovery);
      if (correlation) allAnomalies.push(correlation);
    }

    return allAnomalies.sort((a, b) => {
      const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  // ============================================
  // SPECIFIC ANALYZERS
  // ============================================

  /**
   * Heart rate analysis with medical reference ranges.
   */
  async analyzeHeartRate(dataPoints: MetricDataPoint[]): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];
    const values = dataPoints.map((d) => d.value);
    const latest = values[values.length - 1]!;
    const ref = REFERENCE_RANGES.restingHeartRate;

    // Critical range check
    if (latest >= ref.criticalMax) {
      anomalies.push({
        detected: true,
        type: 'HEART_RATE_HIGH',
        severity: 'CRITICAL',
        metric: 'resting_heart_rate',
        currentValue: latest,
        expectedRange: { min: ref.min, max: ref.max },
        zScore: this.calculateZScore(latest, values),
        message: `Heart rate critically elevated: ${latest} BPM`,
        recommendation: 'Seek immediate medical attention if accompanied by chest pain, dizziness, or shortness of breath.',
        timestamp: Date.now(),
      });
    } else if (latest <= ref.criticalMin) {
      anomalies.push({
        detected: true,
        type: 'HEART_RATE_LOW',
        severity: 'CRITICAL',
        metric: 'resting_heart_rate',
        currentValue: latest,
        expectedRange: { min: ref.min, max: ref.max },
        zScore: this.calculateZScore(latest, values),
        message: `Heart rate critically low: ${latest} BPM`,
        recommendation: 'Seek medical attention if experiencing fainting, dizziness, or confusion.',
        timestamp: Date.now(),
      });
    }

    // Statistical anomaly detection
    const statAnomalies = await this.analyzeMetric('resting_heart_rate', dataPoints, 'HEART_RATE_HIGH');
    anomalies.push(...statAnomalies);

    // Heart rate variability check (irregularity)
    if (values.length >= 5) {
      const diffs = [];
      for (let i = 1; i < values.length; i++) {
        diffs.push(Math.abs(values[i]! - values[i - 1]!));
      }
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const recentDiffs = diffs.slice(-3);
      const recentAvgDiff = recentDiffs.reduce((a, b) => a + b, 0) / recentDiffs.length;

      if (recentAvgDiff > avgDiff * 2.5 && avgDiff > 0) {
        anomalies.push({
          detected: true,
          type: 'HEART_RATE_IRREGULAR',
          severity: 'MEDIUM',
          metric: 'heart_rate_variability',
          currentValue: recentAvgDiff,
          expectedRange: { min: 0, max: avgDiff * 2 },
          zScore: (recentAvgDiff - avgDiff) / (this.stdDev(diffs) || 1),
          message: `Unusual heart rate variability detected (±${Math.round(recentAvgDiff)} BPM between readings)`,
          recommendation: 'Monitor closely. Consult a doctor if irregular heartbeat persists.',
          timestamp: Date.now(),
        });
      }
    }

    return anomalies;
  }

  /**
   * Weight change analysis (rapid gain/loss detection).
   */
  private async analyzeWeightChange(dataPoints: MetricDataPoint[]): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];
    const sorted = [...dataPoints].sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length < 3) return anomalies;

    // Check weekly rate of change
    const latest = sorted[sorted.length - 1]!;
    const oneWeekAgo = latest.timestamp - 7 * 86400000;
    const weekAgoPoint = sorted.find((d) => d.timestamp >= oneWeekAgo);

    if (weekAgoPoint) {
      const weeklyChange = latest.value - weekAgoPoint.value;
      const ref = REFERENCE_RANGES.bodyWeight;

      if (weeklyChange < ref.minChangePerWeek || weeklyChange > ref.maxChangePerWeek) {
        const direction = weeklyChange > 0 ? 'gain' : 'loss';
        anomalies.push({
          detected: true,
          type: 'WEIGHT_RAPID_CHANGE',
          severity: Math.abs(weeklyChange) > 3 ? 'HIGH' : 'MEDIUM',
          metric: 'body_weight',
          currentValue: latest.value,
          expectedRange: {
            min: weekAgoPoint.value + ref.minChangePerWeek,
            max: weekAgoPoint.value + ref.maxChangePerWeek,
          },
          zScore: this.calculateZScore(weeklyChange, sorted.map((d) => d.value)),
          message: `Rapid weight ${direction}: ${Math.abs(weeklyChange).toFixed(1)} kg in 7 days`,
          recommendation: direction === 'loss'
            ? 'Rapid weight loss may indicate dehydration, inadequate nutrition, or illness. Consult a healthcare provider.'
            : 'Rapid weight gain may indicate fluid retention or caloric surplus. Monitor hydration and diet.',
          timestamp: Date.now(),
        });
      }
    }

    return anomalies;
  }

  // ============================================
  // DETECTION ALGORITHMS
  // ============================================

  /**
   * Z-score based detection on the latest value.
   */
  private detectZScore(
    metricName: string,
    values: number[],
    type: AnomalyType
  ): AnomalyResult | null {
    const latest = values[values.length - 1]!;
    const z = this.calculateZScore(latest, values.slice(0, -1));

    if (Math.abs(z) < this.config.zScoreThreshold) return null;

    const mean = this.mean(values.slice(0, -1));
    const sd = this.stdDev(values.slice(0, -1));

    return {
      detected: true,
      type,
      severity: this.zScoreToSeverity(z),
      metric: metricName,
      currentValue: latest,
      expectedRange: {
        min: Math.round((mean - 2 * sd) * 10) / 10,
        max: Math.round((mean + 2 * sd) * 10) / 10,
      },
      zScore: Math.round(z * 100) / 100,
      message: `${metricName} is ${z > 0 ? 'above' : 'below'} normal range (z=${z.toFixed(1)})`,
      recommendation: this.getRecommendation(type, z),
      timestamp: Date.now(),
    };
  }

  /**
   * IQR-based outlier detection (more robust to skewed data).
   */
  private detectIQR(
    metricName: string,
    values: number[],
    type: AnomalyType
  ): AnomalyResult | null {
    const latest = values[values.length - 1]!;
    const sorted = [...values].sort((a, b) => a - b);

    const q1 = this.percentile(sorted, 25);
    const q3 = this.percentile(sorted, 75);
    const iqr = q3 - q1;

    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;

    if (latest >= lowerFence && latest <= upperFence) return null;

    const z = this.calculateZScore(latest, values);

    return {
      detected: true,
      type,
      severity: latest < q1 - 3 * iqr || latest > q3 + 3 * iqr ? 'HIGH' : 'MEDIUM',
      metric: metricName,
      currentValue: latest,
      expectedRange: {
        min: Math.round(lowerFence * 10) / 10,
        max: Math.round(upperFence * 10) / 10,
      },
      zScore: Math.round(z * 100) / 100,
      message: `${metricName} outlier detected via IQR method`,
      recommendation: this.getRecommendation(type, z),
      timestamp: Date.now(),
    };
  }

  /**
   * Rate-of-change detection (sudden spikes/drops).
   */
  private detectRateOfChange(
    metricName: string,
    dataPoints: MetricDataPoint[],
    type: AnomalyType
  ): AnomalyResult | null {
    const latest = dataPoints[dataPoints.length - 1]!;
    const prev = dataPoints[dataPoints.length - 2];

    if (!prev || prev.value === 0) return null;

    const rateOfChange = (latest.value - prev.value) / Math.abs(prev.value);

    if (Math.abs(rateOfChange) < this.config.rateChangeThreshold) return null;

    const direction = rateOfChange > 0 ? 'spike' : 'drop';
    const pct = Math.round(Math.abs(rateOfChange) * 100);

    return {
      detected: true,
      type,
      severity: pct > 50 ? 'HIGH' : 'MEDIUM',
      metric: metricName,
      currentValue: latest.value,
      expectedRange: {
        min: prev.value * (1 - this.config.rateChangeThreshold),
        max: prev.value * (1 + this.config.rateChangeThreshold),
      },
      zScore: rateOfChange / this.config.rateChangeThreshold,
      message: `${metricName} sudden ${direction}: ${pct}% change`,
      recommendation: this.getRecommendation(type, rateOfChange),
      timestamp: Date.now(),
    };
  }

  /**
   * Moving average deviation detection.
   */
  private detectMovingAverageDeviation(
    metricName: string,
    values: number[],
    type: AnomalyType
  ): AnomalyResult | null {
    if (values.length < 7) return null;

    const windowSize = Math.min(7, Math.floor(values.length / 2));
    const latest = values[values.length - 1]!;

    // Calculate moving average of previous values
    const maWindow = values.slice(-windowSize - 1, -1);
    const ma = this.mean(maWindow);
    const maStd = this.stdDev(maWindow);

    if (maStd === 0) return null;

    const deviation = (latest - ma) / maStd;

    if (Math.abs(deviation) < this.config.zScoreThreshold) return null;

    return {
      detected: true,
      type,
      severity: this.zScoreToSeverity(deviation),
      metric: metricName,
      currentValue: latest,
      expectedRange: {
        min: Math.round((ma - 2 * maStd) * 10) / 10,
        max: Math.round((ma + 2 * maStd) * 10) / 10,
      },
      zScore: Math.round(deviation * 100) / 100,
      message: `${metricName} deviates from 7-day moving average (${deviation > 0 ? 'above' : 'below'})`,
      recommendation: this.getRecommendation(type, deviation),
      timestamp: Date.now(),
    };
  }

  /**
   * Cross-metric correlation anomaly.
   * E.g., heart rate rising while recovery score drops → overtraining signal.
   */
  private detectCorrelationAnomaly(
    metricA: MetricDataPoint[],
    metricB: MetricDataPoint[]
  ): AnomalyResult | null {
    if (metricA.length < 5 || metricB.length < 5) return null;

    const aVals = metricA.slice(-7).map((d) => d.value);
    const bVals = metricB.slice(-7).map((d) => d.value);
    const len = Math.min(aVals.length, bVals.length);

    if (len < 3) return null;

    // Calculate trend direction for each metric
    const aTrend = this.linearTrend(aVals.slice(0, len));
    const bTrend = this.linearTrend(bVals.slice(0, len));

    // Heart rate rising + recovery declining = overtraining
    if (aTrend > 0.5 && bTrend < -0.5) {
      return {
        detected: true,
        type: 'WORKOUT_OVERTRAINING',
        severity: 'MEDIUM',
        metric: 'hr_recovery_correlation',
        currentValue: aTrend - bTrend,
        expectedRange: { min: -1, max: 1 },
        zScore: Math.abs(aTrend - bTrend),
        message: 'Heart rate trending up while recovery score trends down — possible overtraining',
        recommendation: 'Consider reducing workout intensity or taking a rest day. Ensure adequate sleep and nutrition.',
        timestamp: Date.now(),
      };
    }

    return null;
  }

  // ============================================
  // STATISTICAL HELPERS
  // ============================================

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private calculateZScore(value: number, population: number[]): number {
    const avg = this.mean(population);
    const sd = this.stdDev(population);
    if (sd === 0) return 0;
    return (value - avg) / sd;
  }

  private percentile(sorted: number[], p: number): number {
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower]!;
    return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower);
  }

  private linearTrend(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i]!;
      sumXY += i * values[i]!;
      sumXX += i * i;
    }

    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return 0;

    return (n * sumXY - sumX * sumY) / denom;
  }

  private zScoreToSeverity(z: number): AnomalySeverity {
    const absZ = Math.abs(z);
    if (absZ >= 4) return 'CRITICAL';
    if (absZ >= 3) return 'HIGH';
    if (absZ >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private getRecommendation(type: AnomalyType, z: number): string {
    const recommendations: Record<AnomalyType, string> = {
      HEART_RATE_HIGH: 'Rest and monitor. If persistent, consult a healthcare provider.',
      HEART_RATE_LOW: 'If you feel faint or dizzy, seek medical attention.',
      HEART_RATE_IRREGULAR: 'Track symptoms and report to your doctor at next visit.',
      ACTIVITY_SPIKE: 'Great activity level! Ensure adequate recovery between intense sessions.',
      ACTIVITY_DROP: 'Activity has decreased significantly. Consider light movement or stretching.',
      RECOVERY_DECLINE: 'Recovery trending down. Prioritize sleep, hydration, and reduce training load.',
      WORKOUT_OVERTRAINING: 'Signs of overtraining detected. Take a deload week with 50% intensity.',
      SLEEP_DISRUPTION: 'Sleep pattern disrupted. Maintain consistent sleep/wake times and limit screen time before bed.',
      WEIGHT_RAPID_CHANGE: 'Rapid weight change detected. Review diet and hydration. Consult a professional if unintentional.',
      METRIC_CORRELATION: 'Multiple health metrics showing unusual correlation. Review overall wellness habits.',
    };

    return recommendations[type] || 'Monitor this metric and consult a healthcare provider if concerned.';
  }
}

// Default singleton
export const anomalyDetector = AnomalyDetector.getInstance();
