/**
 * Enhanced Step Counter Engine
 * 
 * Advanced step tracking with stride estimation, distance calculation,
 * cadence tracking, and activity detection.
 * 
 * Features:
 * - Height-based stride length estimation
 * - Distance calculation from steps (when GPS unavailable)
 * - Cadence tracking (steps per minute)
 * - Activity detection (walking vs running vs cycling)
 * - Calorie estimation with activity-specific multipliers
 * 
 * Usage:
 * ```tsx
 * import { stepCounterEngine, useStepCounter } from '../engines/StepCounterEngine';
 * const { steps, distance, cadence, activity } = useStepCounter();
 * ```
 */

// Lightweight EventEmitter replacement (Node 'events' module is unavailable in React Native)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventListener = (...args: any[]) => void;
class EventEmitter {
  private _listeners: Record<string, EventListener[]> = {};

  on(event: string, fn: EventListener): this {
    (this._listeners[event] ??= []).push(fn);
    return this;
  }

  off(event: string, fn: EventListener): this {
    const list = this._listeners[event];
    if (list) this._listeners[event] = list.filter(f => f !== fn);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._listeners[event];
    if (!list?.length) return false;
    for (const fn of list) fn(...args);
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) delete this._listeners[event];
    else this._listeners = {};
    return this;
  }
}

// ============================================
// TYPES
// ============================================

export type ActivityMode = 'STATIONARY' | 'WALKING' | 'RUNNING' | 'CYCLING' | 'UNKNOWN';

export interface StepCounterConfig {
  heightCm: number;           // User height for stride estimation
  weightKg: number;           // User weight for calorie estimation
  sex: 'male' | 'female' | 'other';
}

export interface StrideFactors {
  walking: number;            // Multiplier for walking stride (height * factor)
  running: number;            // Multiplier for running stride
  heightFallback: number;     // Default height if not provided
}

export interface StepData {
  steps: number;
  distanceMeters: number;
  cadence: number;            // Steps per minute
  currentActivity: ActivityMode;
  caloriesBurned: number;
  averageStrideLength: number;
  activeMinutes: number;
  walkingSteps: number;
  runningSteps: number;
}

export interface CadenceWindow {
  timestamp: number;
  steps: number;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Stride length factors based on biomechanics research
 * Walking stride ≈ 0.415 × height
 * Running stride ≈ 0.65 × height (varies with pace)
 */
const STRIDE_FACTORS: StrideFactors = {
  walking: 0.415,
  running: 0.65,
  heightFallback: 170, // cm
};

/**
 * Cadence thresholds for activity detection
 * Based on typical step rates during different activities
 */
const CADENCE_THRESHOLDS = {
  stationary: 10,      // Below 10 spm = not moving
  walking: 80,         // 10-80 spm = casual walking
  briskWalking: 120,   // 80-120 spm = brisk walking
  running: 180,        // 120-180 spm = running/jogging
  sprinting: 220,      // Above 180 spm = sprinting
};

/**
 * MET values for calorie calculation
 * MET = Metabolic Equivalent of Task
 */
const MET_VALUES = {
  stationary: 1.0,
  walking: 3.5,
  briskWalking: 5.0,
  running: 8.0,
  sprinting: 11.0,
};

/**
 * Cadence window size for smoothing (seconds)
 */
const CADENCE_WINDOW_SECONDS = 10;

// ============================================
// STEP COUNTER ENGINE
// ============================================

class StepCounterEngine extends EventEmitter {
  private static instance: StepCounterEngine;
  
  private config: StepCounterConfig;
  private totalSteps = 0;
  private walkingSteps = 0;
  private runningSteps = 0;
  private distanceMeters = 0;
  private caloriesBurned = 0;
  private activeMinutes = 0;
  private currentActivity: ActivityMode = 'STATIONARY';
  
  private cadenceWindow: CadenceWindow[] = [];
  private lastStepTime: number | null = null;
  private sessionStartTime: number | null = null;
  private walkingStrideLength: number;
  private runningStrideLength: number;
  
  private activityStartTime: number | null = null;
  private activityStepsCount = 0;

  private constructor() {
    super();
    // Default config (can be updated via configure())
    this.config = {
      heightCm: STRIDE_FACTORS.heightFallback,
      weightKg: 70,
      sex: 'other',
    };
    this.walkingStrideLength = this.calculateStrideLength('walking');
    this.runningStrideLength = this.calculateStrideLength('running');
  }

  static getInstance(): StepCounterEngine {
    if (!StepCounterEngine.instance) {
      StepCounterEngine.instance = new StepCounterEngine();
    }
    return StepCounterEngine.instance;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Configure user metrics for accurate calculations
   */
  configure(config: Partial<StepCounterConfig>): void {
    this.config = { ...this.config, ...config };
    this.walkingStrideLength = this.calculateStrideLength('walking');
    this.runningStrideLength = this.calculateStrideLength('running');
    
    if (__DEV__) {
      console.log('[StepCounter] Configured:', {
        heightCm: this.config.heightCm,
        walkingStride: this.walkingStrideLength.toFixed(2),
        runningStride: this.runningStrideLength.toFixed(2),
      });
    }
  }

  /**
   * Start a new tracking session
   */
  startSession(): void {
    this.reset();
    this.sessionStartTime = Date.now();
    if (__DEV__) console.log('[StepCounter] Session started');
  }

  /**
   * End tracking session and return final data
   */
  endSession(): StepData {
    const data = this.getData();
    if (__DEV__) console.log('[StepCounter] Session ended:', data);
    return data;
  }

  /**
   * Record steps from pedometer
   * @param stepCount - Number of new steps since last reading
   */
  recordSteps(stepCount: number): void {
    if (stepCount <= 0) return;

    const now = Date.now();
    
    // Detect activity based on step rate
    const activity = this.detectActivity(stepCount, now);
    
    // Calculate stride based on activity
    const strideLength = activity === 'RUNNING' 
      ? this.runningStrideLength 
      : this.walkingStrideLength;

    // Update totals
    this.totalSteps += stepCount;
    this.distanceMeters += stepCount * strideLength;

    // Track activity-specific steps
    if (activity === 'RUNNING') {
      this.runningSteps += stepCount;
    } else if (activity === 'WALKING') {
      this.walkingSteps += stepCount;
    }

    // Update cadence window
    this.updateCadenceWindow(stepCount, now);

    // Calculate calories
    this.updateCalories(stepCount, activity, now);

    // Update active minutes
    this.updateActiveMinutes(activity, now);

    // Update current activity
    if (this.currentActivity !== activity) {
      this.emit('activityChange', { previous: this.currentActivity, current: activity });
      this.currentActivity = activity;
    }

    this.lastStepTime = now;
    this.emit('steps', this.getData());
  }

  /**
   * Get current step data
   */
  getData(): StepData {
    return {
      steps: this.totalSteps,
      distanceMeters: Math.round(this.distanceMeters),
      cadence: this.getCurrentCadence(),
      currentActivity: this.currentActivity,
      caloriesBurned: Math.round(this.caloriesBurned),
      averageStrideLength: this.calculateAverageStride(),
      activeMinutes: Math.round(this.activeMinutes),
      walkingSteps: this.walkingSteps,
      runningSteps: this.runningSteps,
    };
  }

  /**
   * Get estimated distance without GPS
   * More accurate than simple step × constant
   */
  getEstimatedDistance(): number {
    return Math.round(this.distanceMeters);
  }

  /**
   * Get current cadence (steps per minute)
   */
  getCurrentCadence(): number {
    if (this.cadenceWindow.length < 2) return 0;

    const oldest = this.cadenceWindow[0];
    const newest = this.cadenceWindow[this.cadenceWindow.length - 1];
    const timeSpanMinutes = (newest.timestamp - oldest.timestamp) / 1000 / 60;

    if (timeSpanMinutes <= 0) return 0;

    const totalStepsInWindow = this.cadenceWindow.reduce((sum, w) => sum + w.steps, 0);
    return Math.round(totalStepsInWindow / timeSpanMinutes);
  }

  /**
   * Get stride length for user's height
   */
  getStrideLengths(): { walking: number; running: number } {
    return {
      walking: this.walkingStrideLength,
      running: this.runningStrideLength,
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private reset(): void {
    this.totalSteps = 0;
    this.walkingSteps = 0;
    this.runningSteps = 0;
    this.distanceMeters = 0;
    this.caloriesBurned = 0;
    this.activeMinutes = 0;
    this.currentActivity = 'STATIONARY';
    this.cadenceWindow = [];
    this.lastStepTime = null;
    this.sessionStartTime = null;
    this.activityStartTime = null;
    this.activityStepsCount = 0;
  }

  /**
   * Calculate stride length based on height
   * @param mode - 'walking' or 'running'
   */
  private calculateStrideLength(mode: 'walking' | 'running'): number {
    const heightM = this.config.heightCm / 100;
    const factor = STRIDE_FACTORS[mode];
    return heightM * factor;
  }

  /**
   * Calculate average stride across all steps
   */
  private calculateAverageStride(): number {
    if (this.totalSteps === 0) return this.walkingStrideLength;
    return this.distanceMeters / this.totalSteps;
  }

  /**
   * Detect activity type based on step cadence
   */
  private detectActivity(stepCount: number, now: number): ActivityMode {
    // Need at least 2 readings to detect activity
    if (this.lastStepTime === null) {
      return 'WALKING';
    }

    const timeDeltaSeconds = (now - this.lastStepTime) / 1000;
    if (timeDeltaSeconds <= 0) return this.currentActivity;

    // Extrapolate to steps per minute
    const instantCadence = (stepCount / timeDeltaSeconds) * 60;

    // Smooth with recent cadence
    const smoothedCadence = this.cadenceWindow.length > 0
      ? (instantCadence + this.getCurrentCadence()) / 2
      : instantCadence;

    // Classify activity
    if (smoothedCadence < CADENCE_THRESHOLDS.stationary) {
      return 'STATIONARY';
    } else if (smoothedCadence < CADENCE_THRESHOLDS.briskWalking) {
      return 'WALKING';
    } else if (smoothedCadence < CADENCE_THRESHOLDS.running) {
      return 'WALKING'; // Brisk walking still counts as walking
    } else {
      return 'RUNNING';
    }
  }

  /**
   * Update rolling cadence window
   */
  private updateCadenceWindow(steps: number, now: number): void {
    this.cadenceWindow.push({ timestamp: now, steps });

    // Remove entries older than window
    const cutoff = now - CADENCE_WINDOW_SECONDS * 1000;
    this.cadenceWindow = this.cadenceWindow.filter(w => w.timestamp >= cutoff);
  }

  /**
   * Update calories burned using MET calculation
   * Calories/min = MET × weight(kg) × 3.5 / 200
   */
  private updateCalories(steps: number, activity: ActivityMode, now: number): void {
    if (this.lastStepTime === null) return;

    const timeDeltaMinutes = (now - this.lastStepTime) / 1000 / 60;
    if (timeDeltaMinutes <= 0) return;

    // Get MET for activity
    let met: number;
    const cadence = this.getCurrentCadence();
    
    if (activity === 'RUNNING' || cadence >= CADENCE_THRESHOLDS.running) {
      met = cadence >= CADENCE_THRESHOLDS.sprinting 
        ? MET_VALUES.sprinting 
        : MET_VALUES.running;
    } else if (activity === 'WALKING') {
      met = cadence >= CADENCE_THRESHOLDS.briskWalking 
        ? MET_VALUES.briskWalking 
        : MET_VALUES.walking;
    } else {
      met = MET_VALUES.stationary;
    }

    // Calculate calories for this period
    const caloriesPerMinute = (met * this.config.weightKg * 3.5) / 200;
    this.caloriesBurned += caloriesPerMinute * timeDeltaMinutes;
  }

  /**
   * Update active minutes (only count when moving)
   */
  private updateActiveMinutes(activity: ActivityMode, now: number): void {
    if (activity === 'STATIONARY') {
      this.activityStartTime = null;
      return;
    }

    if (this.activityStartTime === null) {
      this.activityStartTime = now;
      return;
    }

    // Add time since last check
    if (this.lastStepTime !== null) {
      const deltaMinutes = (now - this.lastStepTime) / 1000 / 60;
      if (deltaMinutes < 1) { // Only count if gap is reasonable (< 1 min)
        this.activeMinutes += deltaMinutes;
      }
    }
  }
}

// ============================================
// SINGLETON & HOOK
// ============================================

export const stepCounterEngine = StepCounterEngine.getInstance();

/**
 * React hook for enhanced step counting
 */
import { useState, useEffect, useCallback } from 'react';

export interface UseStepCounterReturn {
  data: StepData;
  configure: (config: Partial<StepCounterConfig>) => void;
  startSession: () => void;
  endSession: () => StepData;
  recordSteps: (count: number) => void;
  cadence: number;
  activity: ActivityMode;
}

export function useStepCounter(): UseStepCounterReturn {
  const [data, setData] = useState<StepData>(stepCounterEngine.getData());

  useEffect(() => {
    const handleSteps = (newData: StepData) => {
      setData(newData);
    };

    stepCounterEngine.on('steps', handleSteps);

    return () => {
      stepCounterEngine.off('steps', handleSteps);
    };
  }, []);

  const configure = useCallback((config: Partial<StepCounterConfig>) => {
    stepCounterEngine.configure(config);
  }, []);

  const startSession = useCallback(() => {
    stepCounterEngine.startSession();
    setData(stepCounterEngine.getData());
  }, []);

  const endSession = useCallback(() => {
    return stepCounterEngine.endSession();
  }, []);

  const recordSteps = useCallback((count: number) => {
    stepCounterEngine.recordSteps(count);
  }, []);

  return {
    data,
    configure,
    startSession,
    endSession,
    recordSteps,
    cadence: data.cadence,
    activity: data.currentActivity,
  };
}

export default StepCounterEngine;
