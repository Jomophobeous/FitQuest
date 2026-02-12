/**
 * FitQuest Pedometer Hook
 * Step counting and activity tracking
 * 
 * Uses native sensors:
 * - Android: Step Sensor / Activity Recognition
 * - iOS: Core Motion (CMPedometer)
 * 
 * Characteristics:
 * - Low battery
 * - Offline
 * - OS-validated
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
import { DEFAULT_USER_ID } from '../context/DatabaseContext';
import { SensorFusionEngine } from '../engines/SensorFusionEngine';
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
}

export interface UsePedometerReturn {
  // Step data
  todaySteps: number;
  isAvailable: boolean;
  isTracking: boolean;
  
  // Jog session
  currentJog: JogSession | null;
  isJogging: boolean;
  
  // Actions
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  startJog: () => Promise<void>;
  stopJog: () => Promise<JogSession | null>;
  
  // History
  getStepHistory: (days: number) => Promise<DailySteps[]>;
  getJogHistory: (limit: number) => Promise<JogSession[]>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
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
      console.error('[Pedometer] Failed to load today steps:', error);
    }
  };

  const saveTodaySteps = async (steps: number) => {
    try {
      const today = getTodayDateString();
      await upsertDailySteps(DEFAULT_USER_ID, today, steps, 0);
    } catch (error) {
      console.error('[Pedometer] Failed to save steps:', error);
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
          console.log('[Pedometer] getStepCountAsync not available, starting from loaded value');
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
        console.log('[Pedometer] Native pedometer subscription started');
      } catch (e) {
        console.log('[Pedometer] Native pedometer subscription failed:', e);
      }

      // Start SensorFusion as fallback step counter
      // If native pedometer fires, we'll prefer it; otherwise SensorFusion fills in
      const engine = SensorFusionEngine.getInstance();
      if (!engine.isRunning()) {
        try {
          await engine.start();
          console.log('[Pedometer] SensorFusion fallback started');
        } catch (e) {
          console.log('[Pedometer] SensorFusion start failed:', e);
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
      console.log('[Pedometer] Tracking started (native:', nativePedometerStarted, ', fallback: active)');
    } catch (error) {
      console.error('[Pedometer] Failed to start tracking:', error);
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

  const startJog = useCallback(async () => {
    const session: JogSession = {
      id: await generateId(),
      startTime: new Date(),
      distanceMeters: 0,
    };

    try {
      await createJogSession({
        id: session.id,
        userId: DEFAULT_USER_ID,
        startTime: session.startTime.getTime(),
        distanceMeters: 0,
      });
    } catch (error) {
      console.error('[Pedometer] Failed to start jog session:', error);
    }

    setCurrentJog(session);
  }, []);

  const stopJog = useCallback(async (): Promise<JogSession | null> => {
    if (!currentJog) return null;

    const endTime = new Date();
    const durationSeconds = (endTime.getTime() - currentJog.startTime.getTime()) / 1000;
    
    // Estimate distance based on steps
    // Jogging stride ≈ 0.8m per step (longer than walking 0.7m)
    const stepsDuringJog = Math.max(0, todaySteps - (baseStepsRef.current || 0));
    const distanceMeters = Math.max(stepsDuringJog * 0.8, 1);
    
    // Calculate pace (seconds per km)
    const avgPacePerKm = distanceMeters > 10 ? (durationSeconds / (distanceMeters / 1000)) : undefined;
    
    // Estimate calories (jogging burns ~0.06 cal per step vs walking 0.04)
    const caloriesEstimate = Math.round(stepsDuringJog * 0.06);

    const completedSession: JogSession = {
      ...currentJog,
      endTime,
      distanceMeters,
      avgPacePerKm,
      caloriesEstimate,
    };

    try {
      await endJogSession({
        id: currentJog.id,
        endTime: endTime.getTime(),
        distanceMeters,
        avgPacePerKm: avgPacePerKm || null,
        caloriesEstimate,
      });
    } catch (error) {
      console.error('[Pedometer] Failed to save jog session:', error);
    }

    setCurrentJog(null);
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
      console.error('[Pedometer] Failed to get step history:', error);
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
      console.error('[Pedometer] Failed to get jog history:', error);
      return [];
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  return {
    todaySteps,
    isAvailable,
    isTracking,
    currentJog,
    isJogging: currentJog !== null,
    startTracking,
    stopTracking,
    startJog,
    stopJog,
    getStepHistory,
    getJogHistory,
  };
}
