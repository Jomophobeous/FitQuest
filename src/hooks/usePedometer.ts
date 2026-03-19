/**
 * FitQuest Pedometer Hook
 * Step counting and activity tracking with GPS distance during jogs
 * 
 * Uses native sensors:
 * - Android: Step Sensor / Activity Recognition + GPS
 * - iOS: Core Motion (CMPedometer) + GPS
 * 
 * Characteristics:
 * - Low battery (steps)
 * - GPS accuracy for jogs
 * - Offline
 * - OS-validated
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
import { DEFAULT_USER_ID } from '../context/DatabaseContext';
import { SensorFusionEngine } from '../engines/SensorFusionEngine';
import { distanceEngine, type DistanceStats, type KilometerSplit } from '../engines/DistanceEngine';
import { stepCounterEngine, type StepData, type ActivityMode } from '../engines/StepCounterEngine';
import {
  createJogSession,
  endJogSession,
  getDailyStepsForDate,
  getJogHistory as fetchJogHistory,
  getStepHistory as fetchStepHistory,
  upsertDailySteps,
} from '../database/service';
import { generateSecureId } from '../security/randomId';

// ============================================
// TYPES
// ============================================

export interface DailySteps {
  date: string;
  steps: number;
  activeMinutes: number;
}

export interface JogSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  distanceMeters: number;
  avgPacePerKm?: number;
  caloriesEstimate?: number;
  // Enhanced GPS data
  elevationGainMeters?: number;
  splits?: KilometerSplit[];
  routePoints?: [number, number][];
  useGPS?: boolean;
}

export interface UsePedometerReturn {
  // Step data
  todaySteps: number;
  isAvailable: boolean;
  isTracking: boolean;
  
  // Enhanced step data
  stepData: StepData | null;
  cadence: number;
  activity: ActivityMode;
  estimatedDistance: number;
  
  // Jog session
  currentJog: JogSession | null;
  isJogging: boolean;
  jogStats: DistanceStats | null;
  
  // Actions
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  startJog: (useGPS?: boolean) => Promise<void>;
  stopJog: () => Promise<JogSession | null>;
  
  // History
  getStepHistory: (days: number) => Promise<DailySteps[]>;
  getJogHistory: (limit: number) => Promise<JogSession[]>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]!;
}

async function generateId(): Promise<string> {
  return generateSecureId('jog');
}

// ============================================
// HOOK
// ============================================

export function usePedometer(): UsePedometerReturn {
  const [todaySteps, setTodaySteps] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [currentJog, setCurrentJog] = useState<JogSession | null>(null);
  
  // Enhanced step counter state
  const [stepData, setStepData] = useState<StepData | null>(null);
  const [cadence, setCadence] = useState(0);
  const [activity, setActivity] = useState<ActivityMode>('STATIONARY');
  const [estimatedDistance, setEstimatedDistance] = useState(0);
  
  // GPS jog state
  const [jogStats, setJogStats] = useState<DistanceStats | null>(null);
  const jogUsingGPSRef = useRef(false);
  const jogStatsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const subscriptionRef = useRef<ReturnType<typeof Pedometer.watchStepCount> | null>(null);
  const baseStepsRef = useRef(0);
  const sensorFallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usingFallbackRef = useRef(false);
  const pedometerFiredRef = useRef(false);

  // Check availability on mount
  useEffect(() => {
    Pedometer.isAvailableAsync().then(setIsAvailable);
  }, []);

  // Load today's steps from database
  useEffect(() => {
    loadTodaySteps();
  }, []);

  const loadTodaySteps = async () => {
    try {
      const today = getTodayDateString();
      const result = await getDailyStepsForDate(DEFAULT_USER_ID, today);
      if (result) {
        setTodaySteps(result.steps);
        baseStepsRef.current = result.steps;
      }
    } catch (error) {
      if (__DEV__) console.error('[Pedometer] Failed to load today steps:', error);
    }
  };

  const saveTodaySteps = async (steps: number) => {
    try {
      const today = getTodayDateString();
      await upsertDailySteps(DEFAULT_USER_ID, today, steps, 0);
    } catch (error) {
      if (__DEV__) console.error('[Pedometer] Failed to save steps:', error);
    }
  };

  const startTracking = useCallback(async () => {
    if (isTracking) return;

    try {
      // Set base steps from current state
      baseStepsRef.current = todaySteps;
      pedometerFiredRef.current = false;
      usingFallbackRef.current = false;

      // On iOS, try to get steps since midnight for baseline
      if (Platform.OS === 'ios') {
        try {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const end = new Date();
          const result = await Pedometer.getStepCountAsync(start, end);
          baseStepsRef.current = result.steps;
          setTodaySteps(result.steps);
          await saveTodaySteps(result.steps);
        } catch (e) {
          if (__DEV__) console.log('[Pedometer] getStepCountAsync not available, starting from loaded value');
        }
      }

      // Try native pedometer subscription (may silently fail on some devices)
      let nativePedometerStarted = false;
      try {
        subscriptionRef.current = Pedometer.watchStepCount((result: { steps: number }) => {
          pedometerFiredRef.current = true;
          const newTotal = baseStepsRef.current + result.steps;
          setTodaySteps(newTotal);
          saveTodaySteps(newTotal);
        });
        nativePedometerStarted = true;
        if (__DEV__) console.log('[Pedometer] Native pedometer subscription started');
      } catch (e) {
        if (__DEV__) console.log('[Pedometer] Native pedometer subscription failed:', e);
      }

      // Start SensorFusion as fallback step counter
      // If native pedometer fires, we'll prefer it; otherwise SensorFusion fills in
      const engine = SensorFusionEngine.getInstance();
      if (!engine.isRunning()) {
        try {
          await engine.start();
          if (__DEV__) console.log('[Pedometer] SensorFusion fallback started');
        } catch (e) {
          if (__DEV__) console.log('[Pedometer] SensorFusion start failed:', e);
        }
      }

      // Poll SensorFusion steps periodically as fallback
      sensorFallbackRef.current = setInterval(() => {
        // Only use SensorFusion if native pedometer hasn't fired
        if (!pedometerFiredRef.current && engine.isRunning()) {
          const stepData = engine.getStepData();
          if (stepData.steps > 0) {
            usingFallbackRef.current = true;
            const newTotal = baseStepsRef.current + stepData.steps;
            setTodaySteps(newTotal);
            saveTodaySteps(newTotal);
          }
        }
      }, 2000); // Check every 2 seconds

      setIsTracking(true);
      if (__DEV__) console.log('[Pedometer] Tracking started (native:', nativePedometerStarted, ', fallback: active)');
    } catch (error) {
      if (__DEV__) console.error('[Pedometer] Failed to start tracking:', error);
    }
  }, [isTracking, todaySteps]);

  const stopTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (sensorFallbackRef.current) {
      clearInterval(sensorFallbackRef.current);
      sensorFallbackRef.current = null;
    }
    // Stop SensorFusion if we started it as fallback
    if (usingFallbackRef.current) {
      const engine = SensorFusionEngine.getInstance();
      if (engine.isRunning()) {
        engine.stop();
      }
    }
    pedometerFiredRef.current = false;
    usingFallbackRef.current = false;
    setIsTracking(false);
  }, []);

  const startJog = useCallback(async (useGPS: boolean = true) => {
    // Generate ID and create DB session — if either fails, propagate to caller
    const id = await generateId();
    const startTime = new Date();

    await createJogSession({
      id,
      userId: DEFAULT_USER_ID,
      startTime: startTime.getTime(),
      distanceMeters: 0,
    });

    const session: JogSession = { id, startTime, distanceMeters: 0, useGPS };

    // Initialize empty jog stats before showing UI
    const emptyStats: DistanceStats = {
      totalDistanceMeters: 0,
      currentPaceSecondsPerKm: null,
      averagePaceSecondsPerKm: null,
      bestPaceSecondsPerKm: null,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
      currentAltitude: null,
      elapsedSeconds: 0,
      splits: [],
      currentSpeedMps: null,
      routePoints: [],
    };

    // Show jog UI immediately — don't wait for GPS
    setJogStats(emptyStats);
    setCurrentJog(session);

    // Start step counter session (synchronous, safe)
    try {
      stepCounterEngine.startSession();
    } catch (e) {
      if (__DEV__) console.warn('[Pedometer] StepCounter session start failed:', e);
    }

    // Start GPS tracking in the background — never block or crash the jog start
    jogUsingGPSRef.current = false;
    if (useGPS) {
      // Use setTimeout(0) to let the UI settle before requesting GPS permission
      setTimeout(async () => {
        try {
          const gpsStarted = await distanceEngine.startTracking();
          if (gpsStarted) {
            jogUsingGPSRef.current = true;
            if (__DEV__) console.log('[Pedometer] GPS tracking started for jog');
            const updateStats = () => {
              try {
                setJogStats(distanceEngine.getStats());
              } catch (e) {
                if (__DEV__) console.warn('[Pedometer] GPS stats update failed:', e);
              }
            };
            distanceEngine.on('distance', updateStats);
            distanceEngine.on('location', updateStats);
          } else {
            if (__DEV__) console.log('[Pedometer] GPS not available, using step-based distance');
            startStepFallbackInterval();
          }
        } catch (error) {
          if (__DEV__) console.error('[Pedometer] GPS tracking failed:', error);
          startStepFallbackInterval();
        }
      }, 0);
    }

    // If no GPS requested, start step-only fallback immediately
    if (!useGPS) {
      startStepFallbackInterval();
    }
  }, []);

  // Step-based distance fallback interval (used when GPS is unavailable)
  const startStepFallbackInterval = useCallback(() => {
    if (jogStatsIntervalRef.current) return;
    jogStatsIntervalRef.current = setInterval(() => {
      try {
        const data = stepCounterEngine.getData();
        setJogStats({
          totalDistanceMeters: data.distanceMeters,
          currentPaceSecondsPerKm: null,
          averagePaceSecondsPerKm: null,
          bestPaceSecondsPerKm: null,
          elevationGainMeters: 0,
          elevationLossMeters: 0,
          currentAltitude: null,
          elapsedSeconds: 0,
          splits: [],
          currentSpeedMps: null,
          routePoints: [],
        });
      } catch (e) {
        if (__DEV__) console.warn('[Pedometer] Step fallback update failed:', e);
      }
    }, 1000);
  }, []);

  const stopJog = useCallback(async (): Promise<JogSession | null> => {
    if (!currentJog) return null;

    const endTime = new Date();
    const durationSeconds = (endTime.getTime() - currentJog.startTime.getTime()) / 1000;

    let distanceMeters: number;
    let avgPacePerKm: number | undefined;
    let caloriesEstimate: number;
    let elevationGainMeters: number | undefined;
    let splits: KilometerSplit[] | undefined;
    let routePoints: [number, number][] | undefined;

    // End step counter session
    const stepSessionData = stepCounterEngine.endSession();
    
    // Get GPS data if available
    if (jogUsingGPSRef.current && distanceEngine.isTracking()) {
      const gpsStats = await distanceEngine.stopTracking();
      
      // Use GPS distance (more accurate than step-based)
      distanceMeters = gpsStats.totalDistanceMeters;
      avgPacePerKm = gpsStats.averagePaceSecondsPerKm ?? undefined;
      elevationGainMeters = gpsStats.elevationGainMeters;
      splits = gpsStats.splits;
      routePoints = gpsStats.routePoints.map(p => [p.lat, p.lng] as [number, number]);
      
      // Use enhanced calorie estimate from step counter
      caloriesEstimate = stepSessionData.caloriesBurned;
      
      // Remove GPS listeners
      distanceEngine.removeAllListeners('distance');
      distanceEngine.removeAllListeners('location');
      
      if (__DEV__) {
        console.log('[Pedometer] Jog stopped with GPS data:', {
        distance: distanceMeters,
        pace: avgPacePerKm,
        elevation: elevationGainMeters,
        splits: splits?.length,
        });
      }
    } else {
      // Fallback to step-based estimation using StepCounterEngine
      distanceMeters = stepSessionData.distanceMeters || Math.max(stepSessionData.steps * 0.8, 1);
      avgPacePerKm = distanceMeters > 10 ? (durationSeconds / (distanceMeters / 1000)) : undefined;
      caloriesEstimate = stepSessionData.caloriesBurned;
      
      if (__DEV__) {
        console.log('[Pedometer] Jog stopped with step-based data:', {
        distance: distanceMeters,
        steps: stepSessionData.steps,
        });
      }
    }

    const completedSession: JogSession = {
      ...currentJog,
      endTime,
      distanceMeters,
      avgPacePerKm,
      caloriesEstimate,
      elevationGainMeters,
      splits,
      routePoints,
      useGPS: jogUsingGPSRef.current,
    };

    try {
      await endJogSession({
        id: currentJog.id,
        endTime: endTime.getTime(),
        distanceMeters,
        avgPacePerKm: avgPacePerKm || null,
        caloriesEstimate,
        routeData: routePoints ? JSON.stringify(routePoints) : null,
      });
    } catch (error) {
      if (__DEV__) console.error('[Pedometer] Failed to save jog session:', error);
    }

    jogUsingGPSRef.current = false;
    setJogStats(null);
    setCurrentJog(null);

    if (jogStatsIntervalRef.current) {
      clearInterval(jogStatsIntervalRef.current);
      jogStatsIntervalRef.current = null;
    }

    return completedSession;
  }, [currentJog, todaySteps]);

  const getStepHistory = useCallback(async (days: number): Promise<DailySteps[]> => {
    try {
      const results = await fetchStepHistory(DEFAULT_USER_ID, days);

      return results.map(r => ({
        date: r.date,
        steps: r.steps,
        activeMinutes: r.active_minutes,
      }));
    } catch (error) {
      if (__DEV__) console.error('[Pedometer] Failed to get step history:', error);
      return [];
    }
  }, []);

  const getJogHistory = useCallback(async (limit: number): Promise<JogSession[]> => {
    try {
      const results = (await fetchJogHistory(DEFAULT_USER_ID, limit)).filter(
        (r) => r.end_time !== null
      );

      return results.map(r => ({
        id: r.id,
        startTime: new Date(r.start_time),
        endTime: r.end_time ? new Date(r.end_time) : undefined,
        distanceMeters: r.distance_meters,
        avgPacePerKm: r.avg_pace_per_km || undefined,
        caloriesEstimate: r.calories_estimate || undefined,
      }));
    } catch (error) {
      if (__DEV__) console.error('[Pedometer] Failed to get jog history:', error);
      return [];
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
      // Stop GPS tracking if active
      if (distanceEngine.isTracking()) {
        distanceEngine.stopTracking();
      }
    };
  }, []);

  // Update step counter data on step events
  useEffect(() => {
    const handleStepData = (data: StepData) => {
      setStepData(data);
      setCadence(data.cadence);
      setActivity(data.currentActivity);
      setEstimatedDistance(data.distanceMeters);
    };

    stepCounterEngine.on('steps', handleStepData);

    return () => {
      stepCounterEngine.off('steps', handleStepData);
    };
  }, []);

  return {
    todaySteps,
    isAvailable,
    isTracking,
    
    // Enhanced step data
    stepData,
    cadence,
    activity,
    estimatedDistance,
    
    // Jog data
    currentJog,
    isJogging: currentJog !== null,
    jogStats,
    
    // Actions
    startTracking,
    stopTracking,
    startJog,
    stopJog,
    getStepHistory,
    getJogHistory,
  };
}
