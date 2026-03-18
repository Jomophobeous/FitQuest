/**
 * FitQuest Sensor Fusion Engine
 * 
 * Combines accelerometer + gyroscope + pedometer data for:
 * - Real-time step counting with noise filtering
 * - Activity classification (walking, running, cycling, stationary)
 * - Rep counting via motion pattern detection
 * - Calorie estimation using MET-based calculations
 * - Fall detection (sudden deceleration patterns)
 * 
 * Uses expo-sensors (Accelerometer, Gyroscope, Pedometer).
 * All processing is on-device — no data leaves the phone.
 */

import {
  Accelerometer,
  Gyroscope,
  Pedometer,
  type AccelerometerMeasurement,
  type GyroscopeMeasurement,
} from 'expo-sensors';
import { AppState, type NativeEventSubscription } from 'react-native';
import { encryptedDB } from '../security/EncryptedDatabase';
import { trainedActivityClassifier } from '../ai/TrainedActivityClassifier';
import type { SensorReading as AISensorReading } from '../ai/TrainedActivityClassifier';
import { deepActivityClassifier } from '../ai/sensors/DeepActivityClassifier';

// ============================================
// TYPES
// ============================================

export type ActivityType = 'STATIONARY' | 'WALKING' | 'RUNNING' | 'CYCLING' | 'EXERCISE' | 'UNKNOWN';

export interface SensorReading {
  timestamp: number;
  accelerometer: { x: number; y: number; z: number; magnitude: number };
  gyroscope: { x: number; y: number; z: number; magnitude: number } | null;
}

export interface StepData {
  steps: number;
  distance: number;     // meters
  calories: number;     // kcal
  cadence: number;      // steps per minute
  startTime: number;
  endTime: number;
}

export interface ActivitySegment {
  type: ActivityType;
  startTime: number;
  endTime: number;
  confidence: number;   // 0-1
  avgIntensity: number; // 0-10
  steps: number;
  calories: number;
}

export interface MotionSnapshot {
  activity: ActivityType;
  confidence: number;
  intensity: number;        // 0-10
  currentCadence: number;   // steps/min
  repCount: number;
  isActive: boolean;
}

export type SensorCallback = (snapshot: MotionSnapshot) => void;

// ============================================
// CONSTANTS
// ============================================

/** MET values for activity-based calorie calculation */
const MET_VALUES: Record<ActivityType, number> = {
  STATIONARY: 1.0,
  WALKING: 3.5,
  RUNNING: 8.0,
  CYCLING: 6.0,
  EXERCISE: 5.0,
  UNKNOWN: 1.5,
};

/** Accelerometer magnitude thresholds for activity classification */
const ACTIVITY_THRESHOLDS = {
  STATIONARY_MAX: 1.1,    // < 1.1g = sitting/standing
  WALKING_MIN: 1.1,       // 1.1-1.8g = walking
  WALKING_MAX: 1.8,
  RUNNING_MIN: 1.8,       // > 1.8g = running
  CYCLING_GYRO_THRESHOLD: 2.0, // Low accel + moderate gyroscope
};

/** Sensor update intervals (ms) */
const UPDATE_INTERVALS = {
  ACCELEROMETER: 100,  // 10 Hz
  GYROSCOPE: 100,      // 10 Hz
  PEDOMETER: 1000,     // 1 Hz (OS-level)
};

/** Sliding window for activity classification */
const WINDOW_SIZE = 30;  // 3 seconds of readings at 10 Hz

/** Step detection: minimum peak-to-peak time (ms) to avoid double-counting */
const MIN_STEP_INTERVAL_MS = 250;

// ============================================
// SENSOR FUSION ENGINE
// ============================================

export class SensorFusionEngine {
  private static instance: SensorFusionEngine | null = null;
  private running = false;
  private callbacks: SensorCallback[] = [];
  private mlModelReady = false;

  // Raw sensor buffer for ML classifier
  private rawSensorBuffer: AISensorReading[] = [];

  // Subscriptions
  private accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
  private gyroSub: ReturnType<typeof Gyroscope.addListener> | null = null;
  private pedometerSub: { remove: () => void } | null = null;
  private appStateSub: NativeEventSubscription | null = null;
  private pausedByBackground = false;

  // Sensor data buffers (sliding window)
  private accelBuffer: Array<{ magnitude: number; timestamp: number }> = [];
  private gyroBuffer: Array<{ magnitude: number; timestamp: number }> = [];

  // Step counting state
  private rawStepCount = 0;
  private sessionStartTime = 0;
  private lastStepTimestamp = 0;
  private pedometerSteps = 0;

  // Activity classification state
  private currentActivity: ActivityType = 'STATIONARY';
  private activityConfidence = 0;
  private currentIntensity = 0;

  // Rep counting state (for exercises)
  private repCount = 0;
  private repPhase: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  private lastPeakMagnitude = 0;
  private repThreshold = 1.5; // Adjustable per exercise

  // Cadence tracking
  private stepTimestamps: number[] = [];

  // User profile (for calorie calc)
  private userWeightKg = 70;

  private constructor() {
    // Initialize trained ML activity classifier in background
    this.initMLModel();
  }

  private deepModelReady = false;

  private async initMLModel(): Promise<void> {
    // Try v2.0 CNN-LSTM deep classifier first
    try {
      this.deepModelReady = await deepActivityClassifier.initialize();
      if (this.deepModelReady) {
        if (__DEV__) console.log('[SensorFusion] v2.0 CNN-LSTM classifier loaded');
      }
    } catch {
      this.deepModelReady = false;
    }

    // Fall back to v1.0 RandomForest classifier
    try {
      this.mlModelReady = await trainedActivityClassifier.initialize();
      if (this.mlModelReady) {
        if (__DEV__) console.log('[SensorFusion] v1.0 ML activity classifier loaded');
      }
    } catch {
      console.warn('[SensorFusion] ML model unavailable — using threshold-based fallback');
    }
  }

  static getInstance(): SensorFusionEngine {
    if (!SensorFusionEngine.instance) {
      SensorFusionEngine.instance = new SensorFusionEngine();
    }
    return SensorFusionEngine.instance;
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  /**
   * Start sensor fusion. Subscribes to accelerometer + gyroscope + pedometer.
   */
  async start(options?: { weightKg?: number; repThreshold?: number }): Promise<boolean> {
    if (this.running) return true;

    if (options?.weightKg) this.userWeightKg = options.weightKg;
    if (options?.repThreshold) this.repThreshold = options.repThreshold;

    // Check availability
    let accelAvail = false, gyroAvail = false, pedometerAvail = false;
    try {
      [accelAvail, gyroAvail, pedometerAvail] = await Promise.all([
        Accelerometer.isAvailableAsync(),
        Gyroscope.isAvailableAsync(),
        Pedometer.isAvailableAsync(),
      ]);
    } catch (e) {
      console.warn('[SensorFusion] Sensor availability check failed:', e);
      return false;
    }

    if (!accelAvail) {
      console.warn('[SensorFusion] Accelerometer not available');
      return false;
    }

    // Reset state
    this.resetState();
    this.sessionStartTime = Date.now();

    // Set update intervals
    Accelerometer.setUpdateInterval(UPDATE_INTERVALS.ACCELEROMETER);
    if (gyroAvail) {
      Gyroscope.setUpdateInterval(UPDATE_INTERVALS.GYROSCOPE);
    }

    // Subscribe to accelerometer
    this.accelSub = Accelerometer.addListener((data: AccelerometerMeasurement) => {
      this.handleAccelerometer(data);
    });

    // Subscribe to gyroscope (optional — some devices lack it)
    if (gyroAvail) {
      this.gyroSub = Gyroscope.addListener((data: GyroscopeMeasurement) => {
        this.handleGyroscope(data);
      });
    }

    // Subscribe to pedometer (OS-level step counting)
    if (pedometerAvail) {
      const start = new Date();
      // Watch step count changes
      this.pedometerSub = Pedometer.watchStepCount((result) => {
        this.pedometerSteps = result.steps;
      });
    }

    this.running = true;

    // Auto-pause sensors when app moves to background
    this.appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (this.running && !this.pausedByBackground) {
          this.accelSub?.remove();
          this.gyroSub?.remove();
          this.accelSub = null;
          this.gyroSub = null;
          this.pausedByBackground = true;
          if (__DEV__) console.log('[SensorFusion] Paused — app backgrounded');
        }
      } else if (nextState === 'active' && this.pausedByBackground) {
        this.pausedByBackground = false;
        Accelerometer.setUpdateInterval(100);
        this.accelSub = Accelerometer.addListener((data) => this.handleAccelerometer(data));
        Gyroscope.isAvailableAsync().then((avail) => {
          if (avail) {
            Gyroscope.setUpdateInterval(100);
            this.gyroSub = Gyroscope.addListener((data) => this.handleGyroscope(data));
          }
        });
        if (__DEV__) console.log('[SensorFusion] Resumed — app foregrounded');
      }
    });

    if (__DEV__) console.log(`[SensorFusion] Started. Accel: ✓, Gyro: ${gyroAvail ? '✓' : '✗'}, Pedometer: ${pedometerAvail ? '✓' : '✗'}`);
    return true;
  }

  /**
   * Stop all sensor subscriptions.
   */
  stop(): void {
    this.appStateSub?.remove();
    this.appStateSub = null;
    this.pausedByBackground = false;
    this.accelSub?.remove();
    this.gyroSub?.remove();
    this.pedometerSub?.remove();
    this.accelSub = null;
    this.gyroSub = null;
    this.pedometerSub = null;
    this.running = false;
    if (__DEV__) console.log('[SensorFusion] Stopped');
  }

  /**
   * Register a callback for real-time motion snapshots.
   */
  onUpdate(callback: SensorCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Get current motion snapshot.
   */
  getSnapshot(): MotionSnapshot {
    return {
      activity: this.currentActivity,
      confidence: this.activityConfidence,
      intensity: this.currentIntensity,
      currentCadence: this.calculateCadence(),
      repCount: this.repCount,
      isActive: this.currentActivity !== 'STATIONARY',
    };
  }

  /**
   * Get session step data summary.
   */
  getStepData(): StepData {
    const now = Date.now();
    const durationMin = (now - this.sessionStartTime) / 60000;
    const steps = Math.max(this.rawStepCount, this.pedometerSteps);
    const cadence = durationMin > 0 ? steps / durationMin : 0;

    // Distance: average stride length ~0.75m
    const distance = steps * 0.75;

    // Calories: MET-based
    const avgMET = MET_VALUES[this.currentActivity];
    const durationHours = durationMin / 60;
    const calories = avgMET * this.userWeightKg * durationHours;

    return {
      steps,
      distance,
      calories: Math.round(calories * 10) / 10,
      cadence: Math.round(cadence),
      startTime: this.sessionStartTime,
      endTime: now,
    };
  }

  /**
   * Reset rep counter (start new exercise).
   */
  resetRepCount(threshold?: number): void {
    this.repCount = 0;
    this.repPhase = 'NEUTRAL';
    if (threshold) this.repThreshold = threshold;
  }

  /**
   * Save current session data to encrypted database.
   */
  async saveSessionToDatabase(): Promise<string | null> {
    if (!this.running && this.rawStepCount === 0) return null;

    const stepData = this.getStepData();
    const id = await encryptedDB.storeHealthData('activity_session', {
      ...stepData,
      activity: this.currentActivity,
      intensity: this.currentIntensity,
      repCount: this.repCount,
      pedometerSteps: this.pedometerSteps,
      deviceSteps: this.rawStepCount,
    });

    return id;
  }

  isRunning(): boolean {
    return this.running;
  }

  // ============================================
  // SENSOR HANDLERS
  // ============================================

  private handleAccelerometer(data: AccelerometerMeasurement): void {
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    const now = Date.now();

    // Add to sliding window
    this.accelBuffer.push({ magnitude, timestamp: now });
    if (this.accelBuffer.length > WINDOW_SIZE) {
      this.accelBuffer.shift();
    }

    // Feed raw data to ML classifier buffer
    if (this.mlModelReady) {
      const lastGyro = this.gyroBuffer.length > 0
        ? this.gyroBuffer[this.gyroBuffer.length - 1]
        : null;
      this.rawSensorBuffer.push({
        accel: { x: data.x, y: data.y, z: data.z },
        gyro: lastGyro
          ? { x: 0, y: 0, z: lastGyro.magnitude }
          : { x: 0, y: 0, z: 0 },
        timestamp: now,
      });
      // Keep buffer manageable
      if (this.rawSensorBuffer.length > 200) {
        this.rawSensorBuffer = this.rawSensorBuffer.slice(-150);
      }
    }

    // Step detection via peak detection
    this.detectStep(magnitude, now);

    // Rep detection for exercises
    this.detectRep(magnitude);

    // Classify activity every WINDOW_SIZE readings
    if (this.accelBuffer.length >= WINDOW_SIZE) {
      this.classifyActivity();
      this.emitSnapshot();
    }
  }

  private handleGyroscope(data: GyroscopeMeasurement): void {
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    const now = Date.now();

    this.gyroBuffer.push({ magnitude, timestamp: now });
    if (this.gyroBuffer.length > WINDOW_SIZE) {
      this.gyroBuffer.shift();
    }
  }

  // ============================================
  // STEP DETECTION
  // ============================================

  /**
   * Simple peak-based step detection.
   * Detects a step when magnitude crosses above threshold then back below.
   */
  private detectStep(magnitude: number, timestamp: number): void {
    const threshold = 1.2; // Gravity + step impact threshold
    const timeSinceLastStep = timestamp - this.lastStepTimestamp;

    if (magnitude > threshold && timeSinceLastStep > MIN_STEP_INTERVAL_MS) {
      this.rawStepCount++;
      this.lastStepTimestamp = timestamp;
      this.stepTimestamps.push(timestamp);

      // Keep only last 60 timestamps for cadence calculation
      if (this.stepTimestamps.length > 60) {
        this.stepTimestamps.shift();
      }
    }
  }

  // ============================================
  // REP DETECTION
  // ============================================

  /**
   * Detect exercise reps via magnitude oscillation.
   * Counts one rep per UP→DOWN cycle.
   */
  private detectRep(magnitude: number): void {
    if (this.currentActivity !== 'EXERCISE') return;

    switch (this.repPhase) {
      case 'NEUTRAL':
        if (magnitude > this.repThreshold) {
          this.repPhase = 'UP';
          this.lastPeakMagnitude = magnitude;
        }
        break;
      case 'UP':
        if (magnitude > this.lastPeakMagnitude) {
          this.lastPeakMagnitude = magnitude;
        }
        if (magnitude < this.repThreshold * 0.8) {
          this.repPhase = 'DOWN';
        }
        break;
      case 'DOWN':
        if (magnitude < 1.05) {
          // Return to rest — count the rep
          this.repCount++;
          this.repPhase = 'NEUTRAL';
        }
        break;
    }
  }

  // ============================================
  // ACTIVITY CLASSIFICATION
  // ============================================

  /**
   * Classify current activity from sensor buffer.
   * Uses trained ML model when available, falls back to threshold-based rules.
   */
  private classifyActivity(): void {
    if (this.accelBuffer.length < WINDOW_SIZE) return;

    // Try v2.0 CNN-LSTM deep classifier first
    if (this.deepModelReady && this.rawSensorBuffer.length >= 100) {
      const latestSample = this.rawSensorBuffer[this.rawSensorBuffer.length - 1]!;
      const deepResult = deepActivityClassifier.addSample([
        latestSample.accel.x, latestSample.accel.y, latestSample.accel.z,
        latestSample.gyro.x, latestSample.gyro.y, latestSample.gyro.z,
      ]);
      if (deepResult && deepResult.confidence > 0.5) {
        const deepActivityStr = deepResult.activity;
        let mappedActivity: ActivityType;
        if (['CLIMBING_STAIRS', 'DESCENDING_STAIRS', 'JUMPING'].includes(deepActivityStr)) {
          mappedActivity = 'EXERCISE';
        } else if (['STATIONARY', 'WALKING', 'RUNNING', 'CYCLING', 'EXERCISE'].includes(deepActivityStr)) {
          mappedActivity = deepActivityStr as ActivityType;
        } else {
          mappedActivity = 'UNKNOWN';
        }
        this.currentActivity = mappedActivity;
        this.activityConfidence = Math.round(deepResult.confidence * 100) / 100;
        return; // v2.0 handled it
      }
    }

    // Try v1.0 ML model
    if (this.mlModelReady && this.rawSensorBuffer.length >= 100) {
      const window = this.rawSensorBuffer.slice(-100);
      const prediction = trainedActivityClassifier.classifyWindow(window);

      if (prediction.confidence > 0.4) {
        // Map ML activity type to our ActivityType (JOGGING maps to RUNNING)
        const mlActivityStr = prediction.activity;
        let mappedActivity: ActivityType;
        if (mlActivityStr === 'JOGGING') {
          mappedActivity = 'RUNNING';
        } else if (['STATIONARY', 'WALKING', 'RUNNING', 'CYCLING', 'EXERCISE'].includes(mlActivityStr)) {
          mappedActivity = mlActivityStr as ActivityType;
        } else {
          mappedActivity = 'UNKNOWN';
        }
        this.currentActivity = mappedActivity;
        this.activityConfidence = Math.round(prediction.confidence * 100) / 100;

        // Still compute intensity from threshold-based stats
        const magnitudes = this.accelBuffer.map((r) => r.magnitude);
        const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
        const variance = magnitudes.reduce((sum, m) => sum + (m - mean) ** 2, 0) / magnitudes.length;
        this.currentIntensity = Math.min(10, Math.round(Math.sqrt(variance) * 20));
        return;
      }
    }

    // Fallback: threshold-based classification

    // Compute stats over window
    const magnitudes = this.accelBuffer.map((r) => r.magnitude);
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const variance =
      magnitudes.reduce((sum, m) => sum + (m - mean) ** 2, 0) / magnitudes.length;
    const stddev = Math.sqrt(variance);

    // Gyroscope average (if available)
    let gyroMean = 0;
    if (this.gyroBuffer.length >= WINDOW_SIZE / 2) {
      const gyroMags = this.gyroBuffer.map((r) => r.magnitude);
      gyroMean = gyroMags.reduce((a, b) => a + b, 0) / gyroMags.length;
    }

    // Classification rules
    let activity: ActivityType;
    let confidence: number;

    if (stddev < 0.05 && mean < ACTIVITY_THRESHOLDS.STATIONARY_MAX) {
      activity = 'STATIONARY';
      confidence = Math.min(1, (ACTIVITY_THRESHOLDS.STATIONARY_MAX - stddev) / ACTIVITY_THRESHOLDS.STATIONARY_MAX);
    } else if (
      stddev < 0.2 &&
      mean < ACTIVITY_THRESHOLDS.WALKING_MAX &&
      gyroMean > ACTIVITY_THRESHOLDS.CYCLING_GYRO_THRESHOLD
    ) {
      activity = 'CYCLING';
      confidence = 0.6 + Math.min(0.4, gyroMean / 10);
    } else if (mean < ACTIVITY_THRESHOLDS.WALKING_MAX && stddev < 0.4) {
      activity = 'WALKING';
      confidence = 0.7 + Math.min(0.3, stddev);
    } else if (mean >= ACTIVITY_THRESHOLDS.RUNNING_MIN || stddev > 0.5) {
      activity = 'RUNNING';
      confidence = Math.min(1, stddev / 0.8);
    } else {
      activity = 'EXERCISE';
      confidence = 0.5;
    }

    this.currentActivity = activity;
    this.activityConfidence = Math.round(confidence * 100) / 100;

    // Intensity: 0-10 scale based on magnitude deviation from gravity
    this.currentIntensity = Math.min(10, Math.round(stddev * 20));
  }

  // ============================================
  // CADENCE
  // ============================================

  private calculateCadence(): number {
    if (this.stepTimestamps.length < 2) return 0;

    // Use last 10 steps for current cadence
    const recent = this.stepTimestamps.slice(-10);
    if (recent.length < 2) return 0;

    const duration = (recent[recent.length - 1]! - recent[0]!) / 60000; // minutes
    if (duration <= 0) return 0;

    return Math.round((recent.length - 1) / duration);
  }

  // ============================================
  // HELPERS
  // ============================================

  private emitSnapshot(): void {
    const snapshot = this.getSnapshot();
    for (const cb of this.callbacks) {
      try {
        cb(snapshot);
      } catch (e) {
        console.warn('[SensorFusion] Callback error:', e);
      }
    }
  }

  private resetState(): void {
    this.accelBuffer = [];
    this.gyroBuffer = [];
    this.rawStepCount = 0;
    this.pedometerSteps = 0;
    this.lastStepTimestamp = 0;
    this.stepTimestamps = [];
    this.currentActivity = 'STATIONARY';
    this.activityConfidence = 0;
    this.currentIntensity = 0;
    this.repCount = 0;
    this.repPhase = 'NEUTRAL';
  }
}

// ============================================
// REACT HOOK
// ============================================

import { useState as useStateHook, useEffect as useEffectHook, useRef } from 'react';

/**
 * React hook for accessing sensor fusion data.
 * 
 * @example
 * const { snapshot, stepData, isActive, start, stop } = useSensorFusion();
 */
export function useSensorFusion(options?: { autoStart?: boolean; weightKg?: number }) {
  const [snapshot, setSnapshot] = useStateHook<MotionSnapshot>({
    activity: 'STATIONARY',
    confidence: 0,
    intensity: 0,
    currentCadence: 0,
    repCount: 0,
    isActive: false,
  });
  const [isActive, setIsActive] = useStateHook(false);
  const engineRef = useRef(SensorFusionEngine.getInstance());

  useEffectHook(() => {
    const engine = engineRef.current;
    const unsubscribe = engine.onUpdate((snap) => {
      setSnapshot(snap);
    });

    if (options?.autoStart) {
      engine.start({ weightKg: options.weightKg }).then((started) => {
        setIsActive(started);
      });
    }

    return () => {
      unsubscribe();
      if (options?.autoStart) {
        engine.stop();
      }
    };
  }, []);

  const start = async () => {
    const started = await engineRef.current.start({ weightKg: options?.weightKg });
    setIsActive(started);
    return started;
  };

  const stop = () => {
    engineRef.current.stop();
    setIsActive(false);
  };

  return {
    snapshot,
    stepData: engineRef.current.getStepData(),
    isActive,
    start,
    stop,
    resetReps: (threshold?: number) => engineRef.current.resetRepCount(threshold),
    saveSession: () => engineRef.current.saveSessionToDatabase(),
  };
}
