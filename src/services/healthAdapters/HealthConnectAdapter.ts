/**
 * Health Connect Adapter (Android)
 * 
 * Implements IHealthAdapter for Android Health Connect.
 * Uses react-native-health-connect under the hood.
 * All sensitive data is written to encryptedDB.
 */

import { Platform } from 'react-native';
import type {
  IHealthAdapter,
  HealthProvider,
  HealthDataCategory,
  HealthPermission,
  ProviderStatus,
  DateRange,
  DailyAggregate,
  HealthRecord,
  StepRecord,
  HeartRateRecord,
  SleepRecord,
  CaloriesRecord,
  WorkoutRecord,
  SENSITIVE_CATEGORIES,
} from './types';
import { encryptedDB } from '../../security/EncryptedDatabase';
import { captureHealthError } from '../errorTelemetry';
import { setAppState, getAppState } from '../../database/service';

// Note: react-native-health-connect is installed at runtime for Android only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HealthConnectModule = any;

// ============================================
// HEALTH CONNECT CATEGORY MAPPING
// ============================================

const CATEGORY_TO_RECORD_TYPE: Record<HealthDataCategory, string> = {
  steps: 'Steps',
  distance: 'Distance',
  calories: 'TotalCaloriesBurned',
  heart_rate: 'HeartRate',
  sleep: 'SleepSession',
  weight: 'Weight',
  height: 'Height',
  blood_pressure: 'BloodPressure',
  blood_glucose: 'BloodGlucose',
  body_fat: 'BodyFat',
  workout: 'ExerciseSession',
  active_minutes: 'ActiveCaloriesBurned', // Proxy via active calories
};

const SENSITIVE_CATEGORIES_SET = new Set<HealthDataCategory>([
  'heart_rate',
  'sleep',
  'weight',
  'blood_pressure',
  'blood_glucose',
  'body_fat',
]);

// ============================================
// HEALTH CONNECT ADAPTER
// ============================================

class HealthConnectAdapter implements IHealthAdapter {
  readonly provider: HealthProvider = 'health_connect';
  private initialized = false;
  private healthConnect: HealthConnectModule | null = null;

  // ============================================
  // LIFECYCLE
  // ============================================

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const hc = await this.getHealthConnect();
      if (!hc) return false;

      const status = await hc.getSdkStatus();
      // SdkAvailabilityStatus.SDK_AVAILABLE = 3
      return status === 3;
    } catch (error) {
      // Only log as warning in dev — this is expected in Expo Go
      if (__DEV__) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('doesn\'t seem to be linked') || msg.includes('not linked')) {
          if (__DEV__) console.log('[HealthConnect] Not linked — expected in Expo Go, use dev-client build');
        } else {
          await captureHealthError(error instanceof Error ? error : String(error), {
            provider: 'health_connect',
            action: 'auth',
          });
        }
      }
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      const hc = await this.getHealthConnect();
      if (!hc) return false;

      const result = await hc.initialize();
      this.initialized = result;
      return result;
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'health_connect',
        action: 'auth',
      });
      return false;
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const isAvail = await this.isAvailable();
    if (!isAvail) {
      return {
        provider: 'health_connect',
        available: false,
        initialized: false,
        permissions: [],
        error: Platform.OS !== 'android' ? 'Health Connect is only available on Android' : 'Health Connect SDK not available',
      };
    }

    return {
      provider: 'health_connect',
      available: true,
      initialized: this.initialized,
      permissions: await this.checkPermissions([
        'steps', 'calories', 'heart_rate', 'sleep', 'workout', 'active_minutes'
      ]),
      lastSyncTime: await this.getLastSyncTime() || undefined,
    };
  }

  // ============================================
  // PERMISSIONS
  // ============================================

  async requestPermissions(
    categories: HealthDataCategory[],
    readOnly = false
  ): Promise<HealthPermission[]> {
    try {
      const hc = await this.getHealthConnect();
      if (!hc) return [];

      await this.initialize();

      const permissions = categories.map(cat => {
        const recordType = CATEGORY_TO_RECORD_TYPE[cat];
        const perms: Array<{ accessType: 'read' | 'write'; recordType: string }> = [
          { accessType: 'read', recordType }
        ];
        if (!readOnly) {
          perms.push({ accessType: 'write', recordType });
        }
        return perms;
      }).flat();

      let granted: Array<{ accessType: string; recordType: string }> = [];
      try {
        granted = await hc.requestPermission(permissions);
      } catch (permError: any) {
        // Native requestPermission delegate may not be initialized (requires Activity setup)
        const msg = permError?.message || String(permError);
        if (msg.includes('UninitializedPropertyAccessException') || msg.includes('requestPermission has not been initialized')) {
          if (__DEV__) console.log('[HealthConnect] Permission dialog unavailable — Activity delegate not initialized. Skipping.');
          return [];
        }
        throw permError;
      }

      // Convert to HealthPermission format
      const result: HealthPermission[] = categories.map(cat => {
        const recordType = CATEGORY_TO_RECORD_TYPE[cat];
        const readGranted = granted.some(
          (p: { accessType: string; recordType: string }) => 
            p.accessType === 'read' && p.recordType === recordType
        );
        const writeGranted = granted.some(
          (p: { accessType: string; recordType: string }) => 
            p.accessType === 'write' && p.recordType === recordType
        );
        return {
          category: cat,
          read: readGranted,
          write: writeGranted,
        };
      });

      return result;
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'health_connect',
        action: 'auth',
      });
      return [];
    }
  }

  async checkPermissions(categories: HealthDataCategory[]): Promise<HealthPermission[]> {
    try {
      const hc = await this.getHealthConnect();
      if (!hc) return categories.map(cat => ({ category: cat, read: false, write: false }));

      const granted = await hc.getGrantedPermissions();

      return categories.map(cat => {
        const recordType = CATEGORY_TO_RECORD_TYPE[cat];
        const readGranted = granted.some(
          (p: { accessType?: string; recordType?: string }) => 
            p.accessType === 'read' && p.recordType === recordType
        );
        const writeGranted = granted.some(
          (p: { accessType?: string; recordType?: string }) => 
            p.accessType === 'write' && p.recordType === recordType
        );
        return {
          category: cat,
          read: readGranted,
          write: writeGranted,
        };
      });
    } catch {
      return categories.map(cat => ({ category: cat, read: false, write: false }));
    }
  }

  openSettings(): void {
    this.getHealthConnect().then(hc => {
      if (hc) {
        hc.openHealthConnectSettings();
      }
    });
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  async readRecords<T extends HealthRecord>(
    category: HealthDataCategory,
    dateRange: DateRange
  ): Promise<T[]> {
    try {
      const hc = await this.getHealthConnect();
      if (!hc) return [];

      await this.initialize();

      // Check permission before reading — avoids SecurityException spam
      const perms = await this.checkPermissions([category]);
      if (!perms[0]?.read) {
        if (__DEV__) {
          console.log(`[HealthConnect] Skipping ${category} — read permission not granted`);
        }
        return [];
      }

      const recordType = CATEGORY_TO_RECORD_TYPE[category];
      const result = await hc.readRecords(recordType, {
        timeRangeFilter: {
          operator: 'between',
          startTime: dateRange.start.toISOString(),
          endTime: dateRange.end.toISOString(),
        },
      });

      const records = this.normalizeRecords(category, result.records || []);
      return records as T[];
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      // SecurityException = permissions not granted — expected, not a real error
      if (errMsg.includes('SecurityException')) {
        if (__DEV__) {
          console.log(`[HealthConnect] ${category}: permission not granted yet`);
        }
        return [];
      }
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'health_connect',
        action: 'read',
        dataType: category,
      });
      return [];
    }
  }

  async getDailyAggregates(dateRange: DateRange): Promise<DailyAggregate[]> {
    try {
      const hc = await this.getHealthConnect();
      if (!hc) return [];

      await this.initialize();

      // Check permissions before reading — avoids SecurityException on startup
      const perms = await this.checkPermissions(['steps', 'calories']);
      const canReadSteps = perms.find(p => p.category === 'steps')?.read;
      const canReadCalories = perms.find(p => p.category === 'calories')?.read;

      const dailyMap = new Map<string, DailyAggregate>();

      // Read steps (only if permitted)
      if (canReadSteps) {
        try {
          const stepsResult = await hc.readRecords('Steps', {
            timeRangeFilter: {
              operator: 'between',
              startTime: dateRange.start.toISOString(),
              endTime: dateRange.end.toISOString(),
            },
          });
          for (const record of (stepsResult.records || [])) {
            const date = new Date(record.startTime).toISOString().split('T')[0]!;
            const existing = dailyMap.get(date) || { date, steps: 0, caloriesBurned: 0 };
            existing.steps = (existing.steps || 0) + (record.count || 0);
            dailyMap.set(date, existing);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('SecurityException') && __DEV__) {
            console.warn('[HealthConnect] Steps aggregate error:', msg);
          }
        }
      }

      // Read calories (only if permitted)
      if (canReadCalories) {
        try {
          const caloriesResult = await hc.readRecords('TotalCaloriesBurned', {
            timeRangeFilter: {
              operator: 'between',
              startTime: dateRange.start.toISOString(),
              endTime: dateRange.end.toISOString(),
            },
          });
          for (const record of (caloriesResult.records || [])) {
            const date = new Date(record.startTime).toISOString().split('T')[0]!;
            const existing = dailyMap.get(date) || { date, steps: 0, caloriesBurned: 0 };
            existing.caloriesBurned = (existing.caloriesBurned || 0) + (record.energy?.inKilocalories || 0);
            dailyMap.set(date, existing);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes('SecurityException') && __DEV__) {
            console.warn('[HealthConnect] Calories aggregate error:', msg);
          }
        }
      }

      return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'health_connect',
        action: 'read',
        dataType: 'aggregate',
      });
      return [];
    }
  }

  async getLatestRecord<T extends HealthRecord>(
    category: HealthDataCategory
  ): Promise<T | null> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const records = await this.readRecords<T>(category, { start: weekAgo, end: now });
    if (records.length === 0) return null;

    // Return most recent
    return records.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0] ?? null;
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  async writeRecord(record: HealthRecord): Promise<string | null> {
    const results = await this.writeRecords([record]);
    return results[0] || null;
  }

  async writeRecords(records: HealthRecord[]): Promise<string[]> {
    try {
      const hc = await this.getHealthConnect();
      if (!hc) return [];

      await this.initialize();

      // Group by category
      const byCategory = new Map<HealthDataCategory, HealthRecord[]>();
      for (const record of records) {
        const existing = byCategory.get(record.category) || [];
        existing.push(record);
        byCategory.set(record.category, existing);
      }

      const allIds: string[] = [];

      for (const [category, categoryRecords] of byCategory) {
        const hcRecords = this.toHealthConnectRecords(category, categoryRecords);
        if (hcRecords.length > 0) {
          const ids = await hc.insertRecords(hcRecords);
          allIds.push(...ids);

          // Store sensitive data in encrypted storage
          if (SENSITIVE_CATEGORIES_SET.has(category)) {
            for (const record of categoryRecords) {
              await encryptedDB.storeHealthData(category, record);
            }
          }
        }
      }

      return allIds;
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'health_connect',
        action: 'write',
      });
      return [];
    }
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  async syncToLocal(
    categories?: HealthDataCategory[],
    since?: Date
  ): Promise<{ synced: number; errors: number }> {
    const categoriesToSync = categories || ['steps', 'calories', 'heart_rate', 'sleep', 'workout'];
    const startDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = new Date();

    let synced = 0;
    let errors = 0;

    for (const category of categoriesToSync) {
      try {
        const records = await this.readRecords(category as HealthDataCategory, {
          start: startDate,
          end: endDate,
        });

        // Store all health records encrypted; sensitive categories must never be plaintext.
        // Keeping all categories in encrypted DB also provides a unified ingestion source.
        for (const record of records) {
          await encryptedDB.storeHealthData(category, record);
          synced++;
        }
      } catch (error) {
        errors++;
        await captureHealthError(error instanceof Error ? error : String(error), {
          provider: 'health_connect',
          action: 'sync',
          dataType: category,
        });
      }
    }

    // Update last sync time
    await setAppState('health_connect_last_sync', new Date().toISOString());

    return { synced, errors };
  }

  async getLastSyncTime(): Promise<Date | null> {
    const value = await getAppState('health_connect_last_sync');
    return value ? new Date(value) : null;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async getHealthConnect() {
    if (Platform.OS !== 'android') return null;

    if (!this.healthConnect) {
      try {
        // Dynamic import to avoid loading on non-Android platforms
        // @ts-ignore - Package is dynamically imported on Android only
        const hcModule = await import('react-native-health-connect');
        // Verify the native module is actually linked (fails in Expo Go)
        if (!hcModule || typeof hcModule.getSdkStatus !== 'function') {
          if (__DEV__) console.warn('[HealthConnect] Native module not available (Expo Go?)');
          return null;
        }
        this.healthConnect = hcModule;
      } catch (e) {
        // Silently handle — native module not linked (expected in Expo Go)
        if (__DEV__) {
          console.log('[HealthConnect] Not available — native module not linked (use dev-client build)');
        }
        return null;
      }
    }
    return this.healthConnect;
  }

  private normalizeRecords(
    category: HealthDataCategory,
    rawRecords: unknown[]
  ): HealthRecord[] {
    const records: HealthRecord[] = [];

    for (const raw of rawRecords) {
      const r = raw as Record<string, unknown>;
      const baseRecord: HealthRecord = {
        sourceId: (r.metadata as Record<string, string>)?.id || '',
        provider: 'health_connect',
        category,
        startTime: new Date(r.startTime as string),
        endTime: new Date(r.endTime as string),
        value: 0,
        unit: '',
      };

      switch (category) {
        case 'steps':
          baseRecord.value = (r.count as number) || 0;
          baseRecord.unit = 'count';
          break;
        case 'heart_rate':
          baseRecord.value = ((r.samples as Array<{ beatsPerMinute: number }>)?.[0]?.beatsPerMinute) || 0;
          baseRecord.unit = 'bpm';
          break;
        case 'calories':
          baseRecord.value = ((r.energy as { inKilocalories: number })?.inKilocalories) || 0;
          baseRecord.unit = 'kcal';
          break;
        case 'sleep':
          baseRecord.value = 
            (new Date(r.endTime as string).getTime() - new Date(r.startTime as string).getTime()) / 60000;
          baseRecord.unit = 'minutes';
          break;
        case 'weight':
          baseRecord.value = ((r.weight as { inKilograms: number })?.inKilograms) || 0;
          baseRecord.unit = 'kg';
          break;
        case 'workout':
          baseRecord.value = 
            (new Date(r.endTime as string).getTime() - new Date(r.startTime as string).getTime()) / 60000;
          baseRecord.unit = 'minutes';
          (baseRecord as WorkoutRecord).workoutType = (r.exerciseType as string) || 'unknown';
          break;
        default:
          continue;
      }

      records.push(baseRecord);
    }

    return records;
  }

  private toHealthConnectRecords(
    category: HealthDataCategory,
    records: HealthRecord[]
  ): Array<Record<string, unknown>> {
    const hcRecords: Array<Record<string, unknown>> = [];
    const recordType = CATEGORY_TO_RECORD_TYPE[category];

    for (const record of records) {
      const base = {
        recordType,
        startTime: record.startTime.toISOString(),
        endTime: record.endTime.toISOString(),
      };

      switch (category) {
        case 'steps':
          hcRecords.push({ ...base, count: record.value });
          break;
        case 'weight':
          hcRecords.push({ 
            ...base, 
            weight: { value: record.value, unit: 'kilograms' } 
          });
          break;
        case 'heart_rate':
          hcRecords.push({
            ...base,
            samples: [{ 
              time: record.startTime.toISOString(), 
              beatsPerMinute: record.value 
            }],
          });
          break;
        // Add more as needed
      }
    }

    return hcRecords;
  }
}

// Singleton export
export const healthConnectAdapter = new HealthConnectAdapter();
