/**
 * GPS Distance Engine
 * 
 * Real-time GPS tracking for jog sessions with distance, pace, and elevation.
 * Uses expo-location for high-accuracy positioning.
 * 
 * Features:
 * - Haversine distance calculation
 * - GPS jitter filtering
 * - Live pace tracking (current, average, best)
 * - Elevation gain tracking
 * - Split times per kilometer
 * - Route point collection for mapping
 * 
 * Usage:
 * ```tsx
 * import { distanceEngine } from '../engines/DistanceEngine';
 * await distanceEngine.startTracking();
 * const stats = distanceEngine.getStats();
 * await distanceEngine.stopTracking();
 * ```
 */

import * as Location from 'expo-location';

// Lightweight EventEmitter replacement (Node 'events' module is unavailable in React Native)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventListener = (...args: any[]) => void;
class EventEmitter {
  private _listeners: Record<string, EventListener[]> = {};
  on(event: string, fn: EventListener): this { (this._listeners[event] ??= []).push(fn); return this; }
  off(event: string, fn: EventListener): this { const l = this._listeners[event]; if (l) this._listeners[event] = l.filter(f => f !== fn); return this; }
  emit(event: string, ...args: unknown[]): boolean { const l = this._listeners[event]; if (!l?.length) return false; for (const f of l) f(...args); return true; }
  removeAllListeners(event?: string): this { if (event) delete this._listeners[event]; else this._listeners = {}; return this; }
}

// ============================================
// TYPES
// ============================================

export interface GeoPoint {
  lat: number;
  lng: number;
  altitude: number | null;
  timestamp: number;
  accuracy: number;
  speed: number | null;
}

export interface KilometerSplit {
  kilometer: number;
  timeSeconds: number;
  paceSecondsPerKm: number;
  elevationGain: number;
}

export interface DistanceStats {
  totalDistanceMeters: number;
  currentPaceSecondsPerKm: number | null;
  averagePaceSecondsPerKm: number | null;
  bestPaceSecondsPerKm: number | null;
  elevationGainMeters: number;
  elevationLossMeters: number;
  currentAltitude: number | null;
  elapsedSeconds: number;
  splits: KilometerSplit[];
  currentSpeedMps: number | null;
  routePoints: GeoPoint[];
}

export interface DistanceEngineConfig {
  accuracyThreshold: number;    // Ignore points with accuracy worse than this (meters)
  minDistanceInterval: number;  // Minimum distance between updates (meters)
  timeInterval: number;         // Time between updates (ms)
  paceWindowSize: number;       // Number of points for current pace calculation
}

type DistanceEventType = 'distance' | 'pace' | 'split' | 'location' | 'error';

// ============================================
// DEFAULT CONFIG
// ============================================

const DEFAULT_CONFIG: DistanceEngineConfig = {
  accuracyThreshold: 20,      // 20 meters max GPS error
  minDistanceInterval: 5,     // Update every 5 meters
  timeInterval: 1000,         // Or every second
  paceWindowSize: 10,         // Last 10 points for pace calc
};

// ============================================
// DISTANCE ENGINE
// ============================================

class DistanceEngine extends EventEmitter {
  private static instance: DistanceEngine;
  
  private config: DistanceEngineConfig;
  private points: GeoPoint[] = [];
  private totalDistance = 0;
  private elevationGain = 0;
  private elevationLoss = 0;
  private splits: KilometerSplit[] = [];
  private lastSplitDistance = 0;
  private lastSplitTime = 0;
  private bestPace: number | null = null;
  private startTime: number | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private isRunning = false;

  private constructor() {
    super();
    this.config = { ...DEFAULT_CONFIG };
  }

  static getInstance(): DistanceEngine {
    if (!DistanceEngine.instance) {
      DistanceEngine.instance = new DistanceEngine();
    }
    return DistanceEngine.instance;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Start GPS tracking
   * Requests foreground location permission if needed
   */
  async startTracking(config?: Partial<DistanceEngineConfig>): Promise<boolean> {
    if (this.isRunning) {
      if (__DEV__) console.log('[DistanceEngine] Already tracking');
      return true;
    }

    // Apply config
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      if (__DEV__) console.error('[DistanceEngine] Location permission denied');
      this.emit('error', { type: 'permission', message: 'Location permission denied' });
      return false;
    }

    // Reset state
    this.reset();
    this.startTime = Date.now();
    this.isRunning = true;

    try {
      // Start watching position
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: this.config.minDistanceInterval,
          timeInterval: this.config.timeInterval,
        },
        (location) => this.handleLocationUpdate(location)
      );

      if (__DEV__) console.log('[DistanceEngine] Tracking started');
      return true;
    } catch (error) {
      if (__DEV__) console.error('[DistanceEngine] Failed to start tracking:', error);
      this.isRunning = false;
      this.emit('error', { type: 'start', message: String(error) });
      return false;
    }
  }

  /**
   * Stop GPS tracking and return final stats
   */
  async stopTracking(): Promise<DistanceStats> {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    this.isRunning = false;
    if (__DEV__) console.log('[DistanceEngine] Tracking stopped');

    return this.getStats();
  }

  /**
   * Get current tracking statistics
   */
  getStats(): DistanceStats {
    const elapsedSeconds = this.startTime 
      ? (Date.now() - this.startTime) / 1000 
      : 0;

    return {
      totalDistanceMeters: this.totalDistance,
      currentPaceSecondsPerKm: this.calculateCurrentPace(),
      averagePaceSecondsPerKm: this.calculateAveragePace(elapsedSeconds),
      bestPaceSecondsPerKm: this.bestPace,
      elevationGainMeters: this.elevationGain,
      elevationLossMeters: this.elevationLoss,
      currentAltitude: this.points.length > 0 
        ? this.points[this.points.length - 1]!.altitude 
        : null,
      elapsedSeconds,
      splits: [...this.splits],
      currentSpeedMps: this.points.length > 0 
        ? this.points[this.points.length - 1]!.speed 
        : null,
      routePoints: [...this.points],
    };
  }

  /**
   * Check if currently tracking
   */
  isTracking(): boolean {
    return this.isRunning;
  }

  /**
   * Get route as array of [lat, lng] pairs for mapping
   */
  getRoute(): [number, number][] {
    return this.points.map(p => [p.lat, p.lng]);
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private reset(): void {
    this.points = [];
    this.totalDistance = 0;
    this.elevationGain = 0;
    this.elevationLoss = 0;
    this.splits = [];
    this.lastSplitDistance = 0;
    this.lastSplitTime = 0;
    this.bestPace = null;
    this.startTime = null;
  }

  private handleLocationUpdate(location: Location.LocationObject): void {
    const point: GeoPoint = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      altitude: location.coords.altitude,
      timestamp: location.timestamp,
      accuracy: location.coords.accuracy ?? 999,
      speed: location.coords.speed,
    };

    // Filter poor accuracy readings
    if (point.accuracy > this.config.accuracyThreshold) {
      if (__DEV__) console.log(`[DistanceEngine] Ignoring point with accuracy ${point.accuracy}m`);
      return;
    }

    if (this.points.length > 0) {
      const prev = this.points[this.points.length - 1]!;
      const distance = this.haversineDistance(prev, point);

      // GPS jitter filter: require minimum 2m movement
      if (distance < 2) {
        return;
      }

      // Update total distance
      this.totalDistance += distance;
      this.emit('distance', this.totalDistance);

      // Track elevation changes
      if (prev.altitude !== null && point.altitude !== null) {
        const elevationDelta = point.altitude - prev.altitude;
        if (elevationDelta > 0) {
          this.elevationGain += elevationDelta;
        } else {
          this.elevationLoss += Math.abs(elevationDelta);
        }
      }

      // Check for kilometer split
      this.checkSplit(point.timestamp);

      // Update best pace
      const currentPace = this.calculateCurrentPace();
      if (currentPace !== null && (this.bestPace === null || currentPace < this.bestPace)) {
        // Only update best pace if we've been moving for a bit
        if (this.totalDistance > 100) {
          this.bestPace = currentPace;
        }
      }
    }

    this.points.push(point);
    this.emit('location', point);
    this.emit('pace', this.calculateCurrentPace());
  }

  private checkSplit(timestamp: number): void {
    const currentKm = Math.floor(this.totalDistance / 1000);
    const lastKm = Math.floor(this.lastSplitDistance / 1000);

    if (currentKm > lastKm && this.startTime !== null) {
      // We crossed a kilometer boundary
      const splitTime = (timestamp - (this.lastSplitTime || this.startTime)) / 1000;
      const splitElevation = this.calculateSplitElevation(lastKm);

      const split: KilometerSplit = {
        kilometer: currentKm,
        timeSeconds: splitTime,
        paceSecondsPerKm: splitTime,
        elevationGain: splitElevation,
      };

      this.splits.push(split);
      this.lastSplitDistance = currentKm * 1000;
      this.lastSplitTime = timestamp;

      this.emit('split', split);
      if (__DEV__) console.log(`[DistanceEngine] Split ${currentKm}km: ${this.formatPace(splitTime)}`);
    }
  }

  private calculateSplitElevation(lastKm: number): number {
    // Calculate elevation gain for the last kilometer of points
    const splitStartIdx = this.points.findIndex(
      (_, idx) => this.calculateDistanceToPoint(idx) >= lastKm * 1000
    );
    
    if (splitStartIdx < 0) return 0;

    let gain = 0;
    for (let i = splitStartIdx + 1; i < this.points.length; i++) {
      const prev = this.points[i - 1]!;
      const curr = this.points[i]!;
      if (prev.altitude !== null && curr.altitude !== null) {
        const delta = curr.altitude - prev.altitude;
        if (delta > 0) gain += delta;
      }
    }

    return gain;
  }

  private calculateDistanceToPoint(idx: number): number {
    let dist = 0;
    for (let i = 1; i <= idx; i++) {
      dist += this.haversineDistance(this.points[i - 1]!, this.points[i]!);
    }
    return dist;
  }

  /**
   * Calculate current pace based on recent points
   * Returns pace in seconds per kilometer
   */
  private calculateCurrentPace(): number | null {
    if (this.points.length < 2) return null;

    const windowSize = Math.min(this.config.paceWindowSize, this.points.length);
    const recentPoints = this.points.slice(-windowSize);

    const timeSpan = (recentPoints[recentPoints.length - 1]!.timestamp - recentPoints[0]!.timestamp) / 1000;
    const distance = this.calculateSegmentDistance(recentPoints);

    if (distance < 10) return null; // Need at least 10m to calculate pace

    const distanceKm = distance / 1000;
    const timeMinutes = timeSpan / 60;

    return (timeMinutes / distanceKm) * 60; // seconds per km
  }

  /**
   * Calculate average pace for entire session
   */
  private calculateAveragePace(elapsedSeconds: number): number | null {
    if (this.totalDistance < 100) return null; // Need at least 100m

    const distanceKm = this.totalDistance / 1000;
    return elapsedSeconds / distanceKm;
  }

  /**
   * Calculate distance for a segment of points
   */
  private calculateSegmentDistance(points: GeoPoint[]): number {
    let distance = 0;
    for (let i = 1; i < points.length; i++) {
      distance += this.haversineDistance(points[i - 1]!, points[i]!);
    }
    return distance;
  }

  /**
   * Haversine formula for distance between two GPS coordinates
   * Returns distance in meters
   */
  private haversineDistance(p1: GeoPoint, p2: GeoPoint): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (p1.lat * Math.PI) / 180;
    const φ2 = (p2.lat * Math.PI) / 180;
    const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
    const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Format pace as "M:SS /km" string
   */
  private formatPace(secondsPerKm: number): string {
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.floor(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')} /km`;
  }
}

// ============================================
// SINGLETON & HOOK
// ============================================

export const distanceEngine = DistanceEngine.getInstance();

/**
 * React hook for GPS distance tracking
 */
import { useState, useEffect, useCallback } from 'react';

export interface UseGPSTrackingReturn {
  isTracking: boolean;
  stats: DistanceStats | null;
  start: (config?: Partial<DistanceEngineConfig>) => Promise<boolean>;
  stop: () => Promise<DistanceStats>;
  route: [number, number][];
}

export function useGPSTracking(): UseGPSTrackingReturn {
  const [isTracking, setIsTracking] = useState(distanceEngine.isTracking());
  const [stats, setStats] = useState<DistanceStats | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    const handleDistance = () => {
      setStats(distanceEngine.getStats());
      setRoute(distanceEngine.getRoute());
    };

    const handleLocation = () => {
      setStats(distanceEngine.getStats());
      setRoute(distanceEngine.getRoute());
    };

    distanceEngine.on('distance', handleDistance);
    distanceEngine.on('location', handleLocation);

    return () => {
      distanceEngine.off('distance', handleDistance);
      distanceEngine.off('location', handleLocation);
    };
  }, []);

  const start = useCallback(async (config?: Partial<DistanceEngineConfig>) => {
    const success = await distanceEngine.startTracking(config);
    setIsTracking(success);
    if (success) {
      setStats(distanceEngine.getStats());
    }
    return success;
  }, []);

  const stop = useCallback(async () => {
    const finalStats = await distanceEngine.stopTracking();
    setIsTracking(false);
    setStats(finalStats);
    return finalStats;
  }, []);

  return {
    isTracking,
    stats,
    start,
    stop,
    route,
  };
}

export default DistanceEngine;
