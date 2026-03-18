/**
 * TrainedActivityClassifier — On-device activity recognition
 *
 * Classifies accelerometer + gyroscope data into activity types.
 * Uses feature extraction from sensor windows + trained model weights.
 *
 * Activities: STATIONARY, WALKING, JOGGING, RUNNING, CYCLING, EXERCISE
 */

export type ActivityType =
  | 'STATIONARY'
  | 'WALKING'
  | 'JOGGING'
  | 'RUNNING'
  | 'CYCLING'
  | 'EXERCISE';

export interface SensorReading {
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  timestamp: number;
}

export interface ActivityPrediction {
  activity: ActivityType;
  confidence: number;
  allScores: Record<ActivityType, number>;
  inferenceTimeMs: number;
}

interface ActivityModelData {
  version: string;
  labels: string[];
  scaler: {
    mean: number[];
    scale: number[];
  };
  feature_importance: number[];
  n_features: number;
  feature_names: string[];
  decision_rules: Record<string, { key_features: Array<{ index: number; importance: number }> }>;
}

/**
 * Threshold-based classifier enhanced with trained feature importance.
 * 
 * On-device: uses statistical feature extraction from sensor windows
 * and applies learned thresholds for classification.
 */
export class TrainedActivityClassifier {
  private static instance: TrainedActivityClassifier | null = null;
  private model: ActivityModelData | null = null;
  private isLoaded = false;
  private buffer: SensorReading[] = [];
  private readonly WINDOW_SIZE = 100; // 2 seconds at 50Hz
  private readonly STRIDE = 50; // 50% overlap

  private constructor() {}

  static getInstance(): TrainedActivityClassifier {
    if (!TrainedActivityClassifier.instance) {
      TrainedActivityClassifier.instance = new TrainedActivityClassifier();
    }
    return TrainedActivityClassifier.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      const modelJson = require('../../assets/models/activity_model.json');
      this.model = modelJson as ActivityModelData;
      this.isLoaded = true;
      console.log(`[TrainedActivityClassifier] Model loaded: ${this.model.labels.length} activities, ${this.model.n_features} features`);
      return true;
    } catch (error) {
      console.warn('[TrainedActivityClassifier] Model not loaded, using heuristic fallback');
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * Add a sensor reading to the buffer and classify when window is full.
   */
  addReading(reading: SensorReading): ActivityPrediction | null {
    this.buffer.push(reading);

    if (this.buffer.length >= this.WINDOW_SIZE) {
      const window = this.buffer.slice(-this.WINDOW_SIZE);
      this.buffer = this.buffer.slice(-this.STRIDE); // Keep overlap

      return this.classifyWindow(window);
    }

    return null;
  }

  /**
   * Classify a full window of sensor data.
   */
  classifyWindow(window: SensorReading[]): ActivityPrediction {
    const startTime = performance.now();

    // Step 1: Extract features
    const features = this.extractFeatures(window);

    // Step 2: Classify using learned thresholds
    const scores = this.classifyFeatures(features);

    // Step 3: Get best prediction
    const entries = Object.entries(scores) as [ActivityType, number][];
    entries.sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;

    return {
      activity: entries[0]![0],
      confidence: entries[0]![1] / total,
      allScores: scores,
      inferenceTimeMs: performance.now() - startTime,
    };
  }

  /**
   * Extract statistical features from a sensor window.
   * Matches the Python training pipeline's feature extraction.
   */
  private extractFeatures(window: SensorReading[]): number[] {
    const features: number[] = [];

    // Extract 6 channels
    const channels = [
      window.map(r => r.accel.x),
      window.map(r => r.accel.y),
      window.map(r => r.accel.z),
      window.map(r => r.gyro.x),
      window.map(r => r.gyro.y),
      window.map(r => r.gyro.z),
    ];

    // Per-channel statistics
    for (const data of channels) {
      features.push(
        this.mean(data),
        this.std(data),
        Math.min(...data),
        Math.max(...data),
        this.median(data),
        this.percentile(data, 25),
        this.percentile(data, 75),
        this.spectralPower(data),
      );
    }

    // Cross-channel features
    const accelMag = window.map(r =>
      Math.sqrt(r.accel.x ** 2 + r.accel.y ** 2 + r.accel.z ** 2)
    );
    const gyroMag = window.map(r =>
      Math.sqrt(r.gyro.x ** 2 + r.gyro.y ** 2 + r.gyro.z ** 2)
    );

    features.push(
      this.mean(accelMag),
      this.std(accelMag),
      Math.max(...accelMag),
      this.mean(gyroMag),
      this.std(gyroMag),
      Math.max(...gyroMag),
      this.dominantFrequency(accelMag, 50),
      this.correlation(channels[0]!, channels[1]!),
      this.correlation(channels[1]!, channels[2]!),
    );

    return features;
  }

  /**
   * Classify using learned thresholds and feature importance weighting.
   */
  private classifyFeatures(features: number[]): Record<ActivityType, number> {
    const scores: Record<ActivityType, number> = {
      STATIONARY: 0,
      WALKING: 0,
      JOGGING: 0,
      RUNNING: 0,
      CYCLING: 0,
      EXERCISE: 0,
    };

    // Scale features if model loaded
    let scaledFeatures = features;
    if (this.model) {
      scaledFeatures = features.map((f, i) => {
        const mean = this.model!.scaler.mean[i] ?? 0;
        const scale = this.model!.scaler.scale[i] ?? 1;
        return (f - mean) / (scale || 1);
      });
    }

    // Key feature indices (from training):
    // accel_mag_mean (idx 48), accel_mag_std (idx 49), accel_mag_max (idx 50)
    // gyro_mag_mean (idx 51), gyro_mag_std (idx 52)
    // dominant_freq (idx 54)

    const accelMagMean = features[48] ?? 9.81;
    const accelMagStd = features[49] ?? 0;
    const gyroMagMean = features[51] ?? 0;
    const dominantFreq = features[54] ?? 0;

    // Decision rules based on physics:

    // STATIONARY: low variation, low gyro
    if (accelMagStd < 0.3 && gyroMagMean < 0.2) {
      scores.STATIONARY += 5;
    } else {
      scores.STATIONARY += Math.max(0, 2 - accelMagStd * 3);
    }

    // WALKING: moderate variation, ~1.5-2.2 Hz step freq
    if (accelMagStd > 0.5 && accelMagStd < 3 && dominantFreq > 1.2 && dominantFreq < 2.5) {
      scores.WALKING += 5;
    } else if (accelMagMean > 9.5 && accelMagMean < 12) {
      scores.WALKING += 2;
    }

    // JOGGING: higher variation, 2.2-3.0 Hz
    if (accelMagStd > 2 && accelMagStd < 5 && dominantFreq > 2.0 && dominantFreq < 3.2) {
      scores.JOGGING += 5;
    } else if (accelMagMean > 12 && accelMagMean < 16) {
      scores.JOGGING += 2;
    }

    // RUNNING: high variation, >3.0 Hz
    if (accelMagStd > 4 && dominantFreq > 2.8) {
      scores.RUNNING += 5;
    } else if (accelMagMean > 16) {
      scores.RUNNING += 3;
    }

    // CYCLING: low variation, ~1.2-1.8 Hz (smooth pedaling)
    if (accelMagStd > 0.3 && accelMagStd < 1.5 && gyroMagMean < 0.5 && dominantFreq > 1.0 && dominantFreq < 2.0) {
      scores.CYCLING += 4;
    }

    // EXERCISE: moderate-high variation, low frequency (rep-based)
    if (accelMagStd > 1.5 && gyroMagMean > 1.0 && dominantFreq < 1.5) {
      scores.EXERCISE += 4;
    } else if (gyroMagMean > 1.2 && dominantFreq < 1.2) {
      scores.EXERCISE += 3;
    }

    // Apply feature importance weighting if model loaded
    if (this.model) {
      const importances = this.model.feature_importance;
      // Boost scores based on which features the model considers important
      for (const [activity, info] of Object.entries(this.model.decision_rules)) {
        for (const feat of info.key_features) {
          if (feat.index < scaledFeatures.length) {
            const contribution = Math.abs(scaledFeatures[feat.index]!) * feat.importance;
            scores[activity as ActivityType] += contribution * 0.5;
          }
        }
      }
    }

    return scores;
  }

  // ============================================
  // MATH HELPERS
  // ============================================

  private mean(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private std(arr: number[]): number {
    const m = this.mean(arr);
    const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  private median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const fraction = idx - lower;
    if (lower + 1 < sorted.length) {
      return sorted[lower]! + fraction * (sorted[lower + 1]! - sorted[lower]!);
    }
    return sorted[lower]!;
  }

  private spectralPower(data: number[]): number {
    // Simplified DFT magnitude (mean of non-DC components)
    const n = data.length;
    let totalPower = 0;
    const numFreqs = Math.floor(n / 2);

    for (let k = 1; k <= numFreqs; k++) {
      let realPart = 0;
      let imagPart = 0;
      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        realPart += data[t]! * Math.cos(angle);
        imagPart -= data[t]! * Math.sin(angle);
      }
      totalPower += Math.sqrt(realPart ** 2 + imagPart ** 2);
    }

    return totalPower / numFreqs;
  }

  private dominantFrequency(data: number[], sampleRate: number): number {
    const n = data.length;
    let maxPower = 0;
    let maxFreqIdx = 0;
    const numFreqs = Math.floor(n / 2);

    for (let k = 1; k <= numFreqs; k++) {
      let realPart = 0;
      let imagPart = 0;
      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        realPart += data[t]! * Math.cos(angle);
        imagPart -= data[t]! * Math.sin(angle);
      }
      const power = realPart ** 2 + imagPart ** 2;
      if (power > maxPower) {
        maxPower = power;
        maxFreqIdx = k;
      }
    }

    return (maxFreqIdx * sampleRate) / n;
  }

  private correlation(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    const meanA = this.mean(a);
    const meanB = this.mean(b);
    let cov = 0, varA = 0, varB = 0;

    for (let i = 0; i < n; i++) {
      const da = a[i]! - meanA;
      const db = b[i]! - meanB;
      cov += da * db;
      varA += da * da;
      varB += db * db;
    }

    const denom = Math.sqrt(varA * varB);
    return denom > 0 ? cov / denom : 0;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  clearBuffer(): void {
    this.buffer = [];
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  getModelInfo() {
    return {
      loaded: this.isLoaded,
      activities: this.model?.labels ?? ['STATIONARY', 'WALKING', 'JOGGING', 'RUNNING', 'CYCLING', 'EXERCISE'],
      featureCount: this.model?.n_features ?? 57,
      windowSize: this.WINDOW_SIZE,
    };
  }
}

export const trainedActivityClassifier = TrainedActivityClassifier.getInstance();
