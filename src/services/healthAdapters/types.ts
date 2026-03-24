/**
 * Health Provider Adapter Interface
 *
 * Provider-neutral interface for health data integration.
 * Supports Health Connect (Android), HealthKit (iOS), and Google Fit (fallback).
 *
 * All sensitive health data flows through encryptedDB for secure storage.
 */

// ============================================
// PROVIDER TYPES
// ============================================

export type HealthProvider = 'health_connect' | 'healthkit' | 'google_fit' | 'none';

export type HealthPermissionStatus = 'granted' | 'denied' | 'not_determined' | 'unavailable';

export type HealthDataCategory =
  | 'steps'
  | 'distance'
  | 'calories'
  | 'heart_rate'
  | 'sleep'
  | 'weight'
  | 'height'
  | 'blood_pressure'
  | 'blood_glucose'
  | 'body_fat'
  | 'workout'
  | 'active_minutes';

// ============================================
// DATA MODELS (Normalized)
// ============================================

export interface HealthRecord {
  /** Unique ID from the source provider */
  sourceId: string;
  /** Provider that supplied this record */
  provider: HealthProvider;
  /** Category of health data */
  category: HealthDataCategory;
  /** Start of measurement period */
  startTime: Date;
  /** End of measurement period (same as startTime for point-in-time measurements) */
  endTime: Date;
  /** Primary value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

export interface StepRecord extends HealthRecord {
  category: 'steps';
  unit: 'count';
}

export interface HeartRateRecord extends HealthRecord {
  category: 'heart_rate';
  unit: 'bpm';
}

export interface SleepRecord extends HealthRecord {
  category: 'sleep';
  unit: 'minutes';
  /** Sleep stage: awake, light, deep, rem */
  stage?: 'awake' | 'light' | 'deep' | 'rem' | 'unknown';
}

export interface CaloriesRecord extends HealthRecord {
  category: 'calories';
  unit: 'kcal';
  /** Type: active (burned through activity) or basal (BMR) */
  calorieType?: 'active' | 'basal' | 'total';
}

export interface WeightRecord extends HealthRecord {
  category: 'weight';
  unit: 'kg';
}

export interface WorkoutRecord extends HealthRecord {
  category: 'workout';
  unit: 'minutes';
  /** Workout type name */
  workoutType: string;
  /** Calories burned during workout */
  caloriesBurned?: number;
  /** Distance covered (meters) */
  distance?: number;
  /** Average heart rate during workout */
  avgHeartRate?: number;
}

// ============================================
// AGGREGATION TYPES
// ============================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DailyAggregate {
  date: string; // YYYY-MM-DD
  steps?: number;
  activeMinutes?: number;
  caloriesBurned?: number;
  avgHeartRate?: number;
  sleepMinutes?: number;
  workoutMinutes?: number;
}

// ============================================
// PERMISSION & STATUS TYPES
// ============================================

export interface HealthPermission {
  category: HealthDataCategory;
  read: boolean;
  write: boolean;
}

export interface ProviderStatus {
  provider: HealthProvider;
  available: boolean;
  initialized: boolean;
  permissions: HealthPermission[];
  lastSyncTime?: Date;
  error?: string;
}

// ============================================
// ADAPTER INTERFACE
// ============================================

/**
 * Health Provider Adapter
 *
 * Implement this interface for each health provider (Health Connect, HealthKit, etc.)
 * All implementations must:
 * - Normalize data to FitQuest internal models
 * - Use encryptedDB for storing sensitive health metrics
 * - Handle permission requests gracefully
 * - Support offline operation
 */
export interface IHealthAdapter {
  /** Provider identifier */
  readonly provider: HealthProvider;

  // ============================================
  // LIFECYCLE
  // ============================================

  /**
   * Check if the health provider is available on this device
   */
  isAvailable(): Promise<boolean>;

  /**
   * Initialize the adapter and SDK
   * @returns true if initialization succeeded
   */
  initialize(): Promise<boolean>;

  /**
   * Get current provider status including permissions
   */
  getStatus(): Promise<ProviderStatus>;

  // ============================================
  // PERMISSIONS
  // ============================================

  /**
   * Request permissions for specified health data categories
   * @param categories Data categories to request access for
   * @param readOnly If true, only request read permissions
   * @returns List of granted permissions
   */
  requestPermissions(categories: HealthDataCategory[], readOnly?: boolean): Promise<HealthPermission[]>;

  /**
   * Check if specific permissions are granted
   */
  checkPermissions(categories: HealthDataCategory[]): Promise<HealthPermission[]>;

  /**
   * Open the provider's settings/permissions screen
   */
  openSettings(): void;

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Read records for a specific category within a date range
   */
  readRecords<T extends HealthRecord>(category: HealthDataCategory, dateRange: DateRange): Promise<T[]>;

  /**
   * Get daily aggregates for a date range
   * Useful for dashboard/trend displays
   */
  getDailyAggregates(dateRange: DateRange): Promise<DailyAggregate[]>;

  /**
   * Get the most recent record for a category
   */
  getLatestRecord<T extends HealthRecord>(category: HealthDataCategory): Promise<T | null>;

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Write a health record to the provider
   * Note: Writes should also update local encrypted storage
   */
  writeRecord(record: HealthRecord): Promise<string | null>;

  /**
   * Write multiple records in batch
   */
  writeRecords(records: HealthRecord[]): Promise<string[]>;

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Perform a full sync from the provider to local encrypted storage
   * @param categories Categories to sync (all if not specified)
   * @param since Only sync data modified since this time
   */
  syncToLocal(categories?: HealthDataCategory[], since?: Date): Promise<{ synced: number; errors: number }>;

  /**
   * Get the timestamp of the last successful sync
   */
  getLastSyncTime(): Promise<Date | null>;
}

// ============================================
// ADAPTER FACTORY
// ============================================

export interface HealthAdapterFactory {
  /**
   * Get the best available adapter for the current platform
   */
  getAdapter(): Promise<IHealthAdapter | null>;

  /**
   * Get a specific adapter by provider type
   */
  getAdapterByProvider(provider: HealthProvider): IHealthAdapter | null | Promise<IHealthAdapter | null>;

  /**
   * Get all available adapters on this platform
   */
  getAvailableAdapters(): Promise<IHealthAdapter[]>;
}

// ============================================
// CONSTANTS
// ============================================

/** Categories that contain sensitive health data requiring encryption */
export const SENSITIVE_CATEGORIES: HealthDataCategory[] = [
  'heart_rate',
  'sleep',
  'weight',
  'blood_pressure',
  'blood_glucose',
  'body_fat',
];

/** Categories that are considered activity data (less sensitive) */
export const ACTIVITY_CATEGORIES: HealthDataCategory[] = ['steps', 'distance', 'calories', 'active_minutes', 'workout'];

/** Default permissions to request */
export const DEFAULT_PERMISSIONS: HealthDataCategory[] = [
  'steps',
  'calories',
  'heart_rate',
  'sleep',
  'workout',
  'active_minutes',
];
