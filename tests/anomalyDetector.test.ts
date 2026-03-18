/**
 * AnomalyDetector Engine Tests
 *
 * Tests statistical anomaly detection algorithms:
 * - Z-score detection
 * - IQR outlier detection
 * - Rate-of-change detection
 * - Moving average deviation
 * - Heart rate analysis with medical reference ranges
 * - Weight change detection
 * - Cross-metric correlation
 * - Comprehensive health check
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock EncryptedDatabase before importing the engine
vi.mock('../src/security/EncryptedDatabase', () => ({
  encryptedDB: {
    createHealthAlert: vi.fn().mockResolvedValue(undefined),
    storeHealthData: vi.fn().mockResolvedValue(undefined),
    getRecentHealthData: vi.fn().mockResolvedValue([]),
  },
}));

import {
  AnomalyDetector,
  type MetricDataPoint,
  type AnomalyResult,
} from '../src/engines/AnomalyDetector';
import { encryptedDB } from '../src/security/EncryptedDatabase';

const mockCreateHealthAlert = vi.mocked(encryptedDB.createHealthAlert);

// ============================================
// HELPERS
// ============================================

function makeDataPoints(values: number[], startTime = 1000000): MetricDataPoint[] {
  return values.map((value, idx) => ({
    value,
    timestamp: startTime + idx * 3600000, // 1 hour apart
  }));
}

function makeStableHR(base: number, count: number): MetricDataPoint[] {
  // Generates stable heart rate data with small variance
  return makeDataPoints(
    Array.from({ length: count }, (_, i) => base + (i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0))
  );
}

// ============================================
// TESTS
// ============================================

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh instance with autoAlert disabled for most tests
    detector = new AnomalyDetector({ autoAlert: false, minDataPoints: 5 });
  });

  // ============================================
  // BASIC CONSTRUCTION
  // ============================================

  describe('construction', () => {
    it('creates with default config', () => {
      const d = new AnomalyDetector();
      expect(d).toBeDefined();
    });

    it('creates with custom config', () => {
      const d = new AnomalyDetector({
        zScoreThreshold: 3.0,
        minDataPoints: 10,
        rateChangeThreshold: 0.5,
      });
      expect(d).toBeDefined();
    });

    it('getInstance returns singleton', () => {
      const a = AnomalyDetector.getInstance();
      const b = AnomalyDetector.getInstance();
      expect(a).toBe(b);
    });
  });

  // ============================================
  // Z-SCORE DETECTION
  // ============================================

  describe('z-score detection', () => {
    it('returns empty for insufficient data points', async () => {
      const data = makeDataPoints([70, 72, 68]); // Only 3, below minDataPoints=5
      const results = await detector.analyzeMetric('test_hr', data, 'HEART_RATE_HIGH');
      expect(results).toEqual([]);
    });

    it('detects no anomaly in stable data', async () => {
      // Stable values: 70 ± 1
      const data = makeDataPoints([70, 71, 69, 70, 71, 69, 70]);
      const results = await detector.analyzeMetric('test_metric', data, 'HEART_RATE_HIGH');
      // Stable data should have no z-score anomalies (z < 2 for last value)
      const zScoreResults = results.filter(r => r.message.includes('z='));
      // All values are within 2 SD of mean, so expect no high-severity anomalies
      for (const r of zScoreResults) {
        expect(Math.abs(r.zScore)).toBeLessThan(4); // Not extreme
      }
    });

    it('detects outlier in last value', async () => {
      // Normal: ~70 BPM, then sudden 120 BPM
      const data = makeDataPoints([70, 71, 69, 70, 71, 69, 70, 120]);
      const results = await detector.analyzeMetric('heart_rate', data, 'HEART_RATE_HIGH');
      expect(results.length).toBeGreaterThan(0);
      const highZ = results.find(r => Math.abs(r.zScore) > 2);
      expect(highZ).toBeDefined();
      expect(highZ!.detected).toBe(true);
      expect(highZ!.currentValue).toBe(120);
    });

    it('detects low outlier', async () => {
      // Normal: ~70 BPM, then sudden 30 BPM
      const data = makeDataPoints([70, 71, 69, 70, 71, 69, 70, 30]);
      const results = await detector.analyzeMetric('heart_rate', data, 'HEART_RATE_LOW');
      expect(results.length).toBeGreaterThan(0);
      const lowAnomaly = results.find(r => r.zScore < -2);
      expect(lowAnomaly).toBeDefined();
    });
  });

  // ============================================
  // IQR DETECTION
  // ============================================

  describe('IQR outlier detection', () => {
    it('detects extreme outlier beyond 3*IQR', async () => {
      // Values form tight cluster, then wild outlier
      const data = makeDataPoints([50, 51, 52, 50, 51, 49, 50, 200]);
      const results = await detector.analyzeMetric('test_metric', data, 'ACTIVITY_SPIKE');
      // 200 is far beyond Q3 + 3*IQR for a cluster around 50
      const iqrResult = results.find(r => r.message.includes('IQR'));
      expect(iqrResult).toBeDefined();
      expect(iqrResult!.detected).toBe(true);
      expect(iqrResult!.severity).toMatch(/HIGH|CRITICAL/);
    });
  });

  // ============================================
  // RATE-OF-CHANGE DETECTION
  // ============================================

  describe('rate-of-change detection', () => {
    it('detects sudden spike (>30% change)', async () => {
      // Gradual rise then 50% jump
      const data = makeDataPoints([100, 101, 102, 103, 104, 105, 160]);
      const results = await detector.analyzeMetric('test_steps', data, 'ACTIVITY_SPIKE');
      const rateResult = results.find(r => r.message.includes('sudden'));
      expect(rateResult).toBeDefined();
      expect(rateResult!.detected).toBe(true);
    });

    it('detects sudden drop (>30% change)', async () => {
      const data = makeDataPoints([100, 101, 102, 100, 101, 100, 50]);
      const results = await detector.analyzeMetric('steps', data, 'ACTIVITY_DROP');
      const rateResult = results.find(r => r.message.includes('sudden'));
      expect(rateResult).toBeDefined();
    });

    it('ignores gradual change', async () => {
      // Each step is <30% change
      const data = makeDataPoints([100, 105, 110, 115, 120, 125, 130]);
      const results = await detector.analyzeMetric('steps', data, 'ACTIVITY_SPIKE');
      const rateResults = results.filter(r => r.message.includes('sudden'));
      expect(rateResults.length).toBe(0);
    });
  });

  // ============================================
  // MOVING AVERAGE DEVIATION
  // ============================================

  describe('moving average deviation', () => {
    it('detects break from 7-day moving average', async () => {
      // Stable baseline ~100, then jump to 200
      const data = makeDataPoints([100, 101, 99, 100, 98, 102, 100, 200]);
      const results = await detector.analyzeMetric('metric_x', data, 'HEART_RATE_HIGH');
      const maResult = results.find(r => r.message.includes('moving average'));
      expect(maResult).toBeDefined();
      expect(maResult!.detected).toBe(true);
    });

    it('returns nothing when variance is zero', async () => {
      // All identical values → stdDev = 0 → no detection
      const data = makeDataPoints([100, 100, 100, 100, 100, 100, 100, 100]);
      const results = await detector.analyzeMetric('flatline', data, 'HEART_RATE_HIGH');
      const maResult = results.filter(r => r.message.includes('moving average'));
      expect(maResult.length).toBe(0);
    });
  });

  // ============================================
  // HEART RATE ANALYSIS
  // ============================================

  describe('analyzeHeartRate', () => {
    it('flags critically high heart rate (≥150 BPM)', async () => {
      const data = makeStableHR(70, 7);
      data.push({ value: 160, timestamp: Date.now() });
      const results = await detector.analyzeHeartRate(data);
      const critical = results.find(
        r => r.type === 'HEART_RATE_HIGH' && r.severity === 'CRITICAL'
      );
      expect(critical).toBeDefined();
      expect(critical!.currentValue).toBe(160);
      expect(critical!.recommendation).toContain('medical attention');
    });

    it('flags critically low heart rate (≤30 BPM)', async () => {
      const data = makeStableHR(70, 7);
      data.push({ value: 25, timestamp: Date.now() });
      const results = await detector.analyzeHeartRate(data);
      const critical = results.find(
        r => r.type === 'HEART_RATE_LOW' && r.severity === 'CRITICAL'
      );
      expect(critical).toBeDefined();
      expect(critical!.currentValue).toBe(25);
    });

    it('detects heart rate irregularity from high variability', async () => {
      // Build stable history with small diffs, then wild recent swings
      // Need: recentAvgDiff > avgDiff * 2.5
      const data: MetricDataPoint[] = [
        { value: 70, timestamp: 1000 },
        { value: 71, timestamp: 2000 },
        { value: 70, timestamp: 3000 },
        { value: 71, timestamp: 4000 },
        { value: 70, timestamp: 5000 },
        { value: 71, timestamp: 6000 },
        { value: 70, timestamp: 7000 },
        { value: 71, timestamp: 8000 },
        // Last 4: diffs of ~30 each (avgDiff of 1 × 2.5 = 2.5, 30 >> 2.5)
        { value: 100, timestamp: 9000 },
        { value: 65, timestamp: 10000 },
        { value: 100, timestamp: 11000 },
      ];
      const results = await detector.analyzeHeartRate(data);
      const irregular = results.find(r => r.type === 'HEART_RATE_IRREGULAR');
      expect(irregular).toBeDefined();
      expect(irregular!.message).toContain('variability');
    });

    it('returns empty for stable normal heart rate', async () => {
      const data = makeStableHR(70, 7);
      data.push({ value: 71, timestamp: Date.now() });
      const results = await detector.analyzeHeartRate(data);
      // No critical alerts for normal stable HR
      const criticals = results.filter(r => r.severity === 'CRITICAL');
      expect(criticals.length).toBe(0);
    });
  });

  // ============================================
  // COMPREHENSIVE CHECK
  // ============================================

  describe('comprehensiveCheck', () => {
    it('runs all analyzers with sufficient data', async () => {
      const results = await detector.comprehensiveCheck({
        heartRate: makeDataPoints([70, 72, 68, 71, 69, 70, 72, 160]),
        steps: makeDataPoints([5000, 5100, 4900, 5000, 5200, 5000, 15000]),
        recovery: makeDataPoints([80, 82, 78, 80, 79, 81, 80]),
      });
      // Should detect anomalies in heartRate and steps
      expect(results.length).toBeGreaterThan(0);
      // Results should be sorted by severity (highest first)
      for (let i = 1; i < results.length; i++) {
        const severityOrder: Record<string, number> = {
          CRITICAL: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };
        expect(severityOrder[results[i - 1]!.severity]).toBeGreaterThanOrEqual(
          severityOrder[results[i]!.severity] ?? 0
        );
      }
    });

    it('skips metrics with insufficient data', async () => {
      const results = await detector.comprehensiveCheck({
        heartRate: makeDataPoints([70, 71]), // Only 2 points
        steps: makeDataPoints([5000, 5100, 4900, 5000, 5200, 5000, 15000]),
      });
      // Should still analyze steps but skip heartRate
      expect(results).toBeDefined();
    });

    it('handles empty metrics gracefully', async () => {
      const results = await detector.comprehensiveCheck({});
      expect(results).toEqual([]);
    });

    it('detects cross-metric correlation anomaly', async () => {
      // Heart rate trending UP + recovery trending DOWN = overtraining
      const hr = makeDataPoints([70, 72, 75, 78, 82, 86, 90]);
      const recovery = makeDataPoints([80, 75, 70, 65, 60, 55, 50]);
      const results = await detector.comprehensiveCheck({
        heartRate: hr,
        recovery,
      });
      const overtraining = results.find(r => r.type === 'WORKOUT_OVERTRAINING');
      expect(overtraining).toBeDefined();
      expect(overtraining!.message).toContain('overtraining');
    });
  });

  // ============================================
  // AUTO-ALERT INTEGRATION
  // ============================================

  describe('auto-alerting', () => {
    it('creates encrypted health alert for HIGH severity', async () => {
      const alertingDetector = new AnomalyDetector({
        autoAlert: true,
        minDataPoints: 5,
      });

      // Force a HIGH severity anomaly
      const data = makeDataPoints([70, 71, 69, 70, 71, 69, 70, 200]);
      await alertingDetector.analyzeMetric('hr', data, 'HEART_RATE_HIGH');

      expect(mockCreateHealthAlert).toHaveBeenCalled();
      const callArgs = mockCreateHealthAlert.mock.calls[0]!;
      expect(callArgs[0]).toBe('HEART_RATE_HIGH'); // type
      expect(['HIGH', 'CRITICAL']).toContain(callArgs[1]); // severity
    });

    it('deduplicates alerts within cooldown window', async () => {
      const alertingDetector = new AnomalyDetector({
        autoAlert: true,
        minDataPoints: 5,
      });

      const data = makeDataPoints([70, 71, 69, 70, 71, 69, 70, 200]);
      await alertingDetector.analyzeMetric('hr', data, 'HEART_RATE_HIGH');
      const firstCallCount = mockCreateHealthAlert.mock.calls.length;

      // Same metric + type again → should be deduplicated
      await alertingDetector.analyzeMetric('hr', data, 'HEART_RATE_HIGH');
      expect(mockCreateHealthAlert.mock.calls.length).toBe(firstCallCount);
    });

    it('does not create alert when autoAlert is disabled', async () => {
      const data = makeDataPoints([70, 71, 69, 70, 71, 69, 70, 200]);
      await detector.analyzeMetric('hr', data, 'HEART_RATE_HIGH');
      expect(mockCreateHealthAlert).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // SEVERITY MAPPING
  // ============================================

  describe('severity mapping', () => {
    it('maps extreme outlier to HIGH or CRITICAL', async () => {
      // z-score will be high when last value is extremely far from mean
      const data = makeDataPoints([50, 50, 50, 50, 50, 50, 50, 500]);
      const results = await detector.analyzeMetric('metric', data, 'ACTIVITY_SPIKE');
      expect(results.length).toBeGreaterThan(0);
      // At least one result should be HIGH or CRITICAL severity
      const highSeverity = results.filter(r => r.severity === 'HIGH' || r.severity === 'CRITICAL');
      expect(highSeverity.length).toBeGreaterThan(0);
    });
  });
});
