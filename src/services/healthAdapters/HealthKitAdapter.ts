/**
 * HealthKit Adapter (iOS)
 *
 * Implements IHealthAdapter for iOS HealthKit.
 * Uses react-native-health under the hood.
 * All sensitive data is written to encryptedDB.
 */

import { Platform } from 'react-native';
import { generateSecureId } from '../../security/randomId';
import type {
  IHealthAdapter,
  HealthProvider,
  HealthDataCategory,
  HealthPermission,
  ProviderStatus,
  DateRange,
  DailyAggregate,
  HealthRecord,
  WorkoutRecord,
} from './types';
import { encryptedDB } from '../../security/EncryptedDatabase';
import { captureHealthError } from '../errorTelemetry';
import { setAppState, getAppState } from '../../database/service';

// Note: react-native-health is installed at runtime for iOS only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppleHealthKitType = any;

// ============================================
// HEALTHKIT PERMISSION MAPPING
// ============================================

const CATEGORY_TO_HK_PERMISSION: Record<HealthDataCategory, string> = {
  steps: 'StepCount',
  distance: 'DistanceWalkingRunning',
  calories: 'ActiveEnergyBurned',
  heart_rate: 'HeartRate',
  sleep: 'SleepAnalysis',
  weight: 'Weight',
  height: 'Height',
  blood_pressure: 'BloodPressureSystolic',
  blood_glucose: 'BloodGlucose',
  body_fat: 'BodyFatPercentage',
  workout: 'Workout',
  active_minutes: 'AppleExerciseTime',
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
// HEALTHKIT ADAPTER
// ============================================

class HealthKitAdapter implements IHealthAdapter {
  readonly provider: HealthProvider = 'healthkit';
  private initialized = false;
  private appleHealthKit: AppleHealthKitType = null;

  // ============================================
  // LIFECYCLE
  // ============================================

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      const hk = await this.getHealthKit();
      if (!hk) return false;

      return new Promise((resolve) => {
        hk.isAvailable((error: Error | null, available: boolean) => {
          resolve(!error && available);
        });
      });
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'healthkit',
        action: 'auth',
      });
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      const hk = await this.getHealthKit();
      if (!hk) return false;

      return new Promise((resolve) => {
        hk.initHealthKit(
          {
            permissions: {
              read: [
                'StepCount',
                'ActiveEnergyBurned',
                'HeartRate',
                'SleepAnalysis',
                'Weight',
                'Workout',
                'AppleExerciseTime',
                'DistanceWalkingRunning',
              ],
              write: ['StepCount', 'ActiveEnergyBurned', 'Weight', 'Workout'],
            },
          },
          (error: Error | null) => {
            if (error) {
              captureHealthError(error, {
                provider: 'healthkit',
                action: 'auth',
              });
              resolve(false);
            } else {
              this.initialized = true;
              resolve(true);
            }
          },
        );
      });
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'healthkit',
        action: 'auth',
      });
      return false;
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const isAvail = await this.isAvailable();
    if (!isAvail) {
      return {
        provider: 'healthkit',
        available: false,
        initialized: false,
        permissions: [],
        error: Platform.OS !== 'ios' ? 'HealthKit is only available on iOS' : 'HealthKit not available',
      };
    }

    return {
      provider: 'healthkit',
      available: true,
      initialized: this.initialized,
      permissions: await this.checkPermissions([
        'steps',
        'calories',
        'heart_rate',
        'sleep',
        'workout',
        'active_minutes',
      ]),
      lastSyncTime: (await this.getLastSyncTime()) || undefined,
    };
  }

  // ============================================
  // PERMISSIONS
  // ============================================

  async requestPermissions(categories: HealthDataCategory[], readOnly = false): Promise<HealthPermission[]> {
    try {
      const hk = await this.getHealthKit();
      if (!hk) return [];

      const readPerms = categories.map((cat) => CATEGORY_TO_HK_PERMISSION[cat]).filter(Boolean);
      const writePerms = readOnly ? [] : readPerms;

      return new Promise((resolve) => {
        hk.initHealthKit(
          {
            permissions: {
              read: readPerms,
              write: writePerms,
            },
          },
          (error: Error | null) => {
            if (error) {
              captureHealthError(error, {
                provider: 'healthkit',
                action: 'auth',
              });
              resolve(categories.map((cat) => ({ category: cat, read: false, write: false })));
            } else {
              this.initialized = true;
              // HealthKit doesn't tell us exactly what was granted, assume all
              resolve(
                categories.map((cat) => ({
                  category: cat,
                  read: true,
                  write: !readOnly,
                })),
              );
            }
          },
        );
      });
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'healthkit',
        action: 'auth',
      });
      return [];
    }
  }

  async checkPermissions(categories: HealthDataCategory[]): Promise<HealthPermission[]> {
    // HealthKit doesn't provide a way to check individual permissions
    // Return optimistic permissions if initialized
    return categories.map((cat) => ({
      category: cat,
      read: this.initialized,
      write: this.initialized,
    }));
  }

  openSettings(): void {
    // On iOS, we can only direct to the Health app, not specific settings
    import('react-native').then(({ Linking }) => {
      Linking.openURL('x-apple-health://');
    });
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  async readRecords<T extends HealthRecord>(category: HealthDataCategory, dateRange: DateRange): Promise<T[]> {
    try {
      const hk = await this.getHealthKit();
      if (!hk) return [];

      await this.initialize();

      const options = {
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
      };

      const records: HealthRecord[] = [];

      switch (category) {
        case 'steps':
          records.push(...(await this.readSteps(hk, options)));
          break;
        case 'heart_rate':
          records.push(...(await this.readHeartRate(hk, options)));
          break;
        case 'calories':
          records.push(...(await this.readCalories(hk, options)));
          break;
        case 'sleep':
          records.push(...(await this.readSleep(hk, options)));
          break;
        case 'weight':
          records.push(...(await this.readWeight(hk, options)));
          break;
        case 'workout':
          records.push(...(await this.readWorkouts(hk, options)));
          break;
      }

      return records as T[];
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'healthkit',
        action: 'read',
        dataType: category,
      });
      return [];
    }
  }

  async getDailyAggregates(dateRange: DateRange): Promise<DailyAggregate[]> {
    const steps = await this.readRecords<HealthRecord>('steps', dateRange);
    const calories = await this.readRecords<HealthRecord>('calories', dateRange);

    const dailyMap = new Map<string, DailyAggregate>();

    for (const record of steps) {
      const date = record.startTime.toISOString().split('T')[0]!;
      const existing = dailyMap.get(date) || { date, steps: 0, caloriesBurned: 0 };
      existing.steps = (existing.steps || 0) + record.value;
      dailyMap.set(date, existing);
    }

    for (const record of calories) {
      const date = record.startTime.toISOString().split('T')[0]!;
      const existing = dailyMap.get(date) || { date, steps: 0, caloriesBurned: 0 };
      existing.caloriesBurned = (existing.caloriesBurned || 0) + record.value;
      dailyMap.set(date, existing);
    }

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getLatestRecord<T extends HealthRecord>(category: HealthDataCategory): Promise<T | null> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const records = await this.readRecords<T>(category, { start: weekAgo, end: now });
    if (records.length === 0) return null;

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
      const hk = await this.getHealthKit();
      if (!hk) return [];

      await this.initialize();

      const ids: string[] = [];

      for (const record of records) {
        const success = await this.writeRecordToHealthKit(hk, record);
        if (success) {
          ids.push(await generateSecureId('hk'));

          // Store sensitive data in encrypted storage
          if (SENSITIVE_CATEGORIES_SET.has(record.category)) {
            await encryptedDB.storeHealthData(record.category, record);
          }
        }
      }

      return ids;
    } catch (error) {
      await captureHealthError(error instanceof Error ? error : String(error), {
        provider: 'healthkit',
        action: 'write',
      });
      return [];
    }
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  async syncToLocal(categories?: HealthDataCategory[], since?: Date): Promise<{ synced: number; errors: number }> {
    const categoriesToSync = categories || ['steps', 'calories', 'heart_rate', 'sleep', 'workout'];
    const startDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
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
          provider: 'healthkit',
          action: 'sync',
          dataType: category,
        });
      }
    }

    await setAppState('healthkit_last_sync', new Date().toISOString());
    return { synced, errors };
  }

  async getLastSyncTime(): Promise<Date | null> {
    const value = await getAppState('healthkit_last_sync');
    return value ? new Date(value) : null;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async getHealthKit(): Promise<AppleHealthKitType> {
    if (Platform.OS !== 'ios') return null;

    if (!this.appleHealthKit) {
      try {
        const module = await import('react-native-health');
        this.appleHealthKit = module.default;
      } catch {
        return null;
      }
    }
    return this.appleHealthKit;
  }

  private readSteps(hk: AppleHealthKitType, options: { startDate: string; endDate: string }): Promise<HealthRecord[]> {
    return new Promise((resolve) => {
      hk.getStepCount(
        options,
        (
          err: Error | null,
          results:
            | { startDate: string; endDate: string; value: number }
            | { startDate: string; endDate: string; value: number }[],
        ) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          const samples = Array.isArray(results) ? results : [results];
          resolve(
            samples.map((s: { startDate: string; endDate: string; value: number }) => ({
              sourceId: `hk_steps_${s.startDate}`,
              provider: 'healthkit' as HealthProvider,
              category: 'steps' as HealthDataCategory,
              startTime: new Date(s.startDate),
              endTime: new Date(s.endDate),
              value: s.value,
              unit: 'count',
            })),
          );
        },
      );
    });
  }

  private readHeartRate(
    hk: AppleHealthKitType,
    options: { startDate: string; endDate: string },
  ): Promise<HealthRecord[]> {
    return new Promise((resolve) => {
      hk.getHeartRateSamples(
        options,
        (err: Error | null, results: { startDate: string; endDate: string; value: number }[]) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          resolve(
            results.map((s: { startDate: string; endDate: string; value: number }) => ({
              sourceId: `hk_hr_${s.startDate}`,
              provider: 'healthkit' as HealthProvider,
              category: 'heart_rate' as HealthDataCategory,
              startTime: new Date(s.startDate),
              endTime: new Date(s.endDate),
              value: s.value,
              unit: 'bpm',
            })),
          );
        },
      );
    });
  }

  private readCalories(
    hk: AppleHealthKitType,
    options: { startDate: string; endDate: string },
  ): Promise<HealthRecord[]> {
    return new Promise((resolve) => {
      hk.getActiveEnergyBurned(
        options,
        (err: Error | null, results: { startDate: string; endDate: string; value: number }[]) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          resolve(
            results.map((s: { startDate: string; endDate: string; value: number }) => ({
              sourceId: `hk_cal_${s.startDate}`,
              provider: 'healthkit' as HealthProvider,
              category: 'calories' as HealthDataCategory,
              startTime: new Date(s.startDate),
              endTime: new Date(s.endDate),
              value: s.value,
              unit: 'kcal',
            })),
          );
        },
      );
    });
  }

  private readSleep(hk: AppleHealthKitType, options: { startDate: string; endDate: string }): Promise<HealthRecord[]> {
    return new Promise((resolve) => {
      hk.getSleepSamples(options, (err: Error | null, results: { startDate: string; endDate: string }[]) => {
        if (err || !results) {
          resolve([]);
          return;
        }
        resolve(
          results.map((s: { startDate: string; endDate: string }) => ({
            sourceId: `hk_sleep_${s.startDate}`,
            provider: 'healthkit' as HealthProvider,
            category: 'sleep' as HealthDataCategory,
            startTime: new Date(s.startDate),
            endTime: new Date(s.endDate),
            value: (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000,
            unit: 'minutes',
          })),
        );
      });
    });
  }

  private readWeight(hk: AppleHealthKitType, options: { startDate: string; endDate: string }): Promise<HealthRecord[]> {
    return new Promise((resolve) => {
      hk.getWeightSamples(
        { ...options, unit: 'kilogram' },
        (err: Error | null, results: { startDate: string; endDate: string; value: number }[]) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          resolve(
            results.map((s: { startDate: string; endDate: string; value: number }) => ({
              sourceId: `hk_weight_${s.startDate}`,
              provider: 'healthkit' as HealthProvider,
              category: 'weight' as HealthDataCategory,
              startTime: new Date(s.startDate),
              endTime: new Date(s.endDate),
              value: s.value,
              unit: 'kg',
            })),
          );
        },
      );
    });
  }

  private readWorkouts(
    hk: AppleHealthKitType,
    options: { startDate: string; endDate: string },
  ): Promise<HealthRecord[]> {
    return new Promise((resolve) => {
      hk.getSamples(
        {
          ...options,
          type: 'Workout',
        },
        (err: Error | null, results: { startDate: string; endDate: string; activityName?: string }[]) => {
          if (err || !results) {
            resolve([]);
            return;
          }
          resolve(
            results.map(
              (s: { startDate: string; endDate: string; activityName?: string }) =>
                ({
                  sourceId: `hk_workout_${s.startDate}`,
                  provider: 'healthkit' as HealthProvider,
                  category: 'workout' as HealthDataCategory,
                  startTime: new Date(s.startDate),
                  endTime: new Date(s.endDate),
                  value: (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000,
                  unit: 'minutes',
                  workoutType: s.activityName || 'workout',
                }) as WorkoutRecord,
            ),
          );
        },
      );
    });
  }

  private writeRecordToHealthKit(hk: AppleHealthKitType, record: HealthRecord): Promise<boolean> {
    return new Promise((resolve) => {
      switch (record.category) {
        case 'steps':
          hk.saveSteps({ value: record.value, startDate: record.startTime.toISOString() }, (err: Error | null) =>
            resolve(!err),
          );
          break;
        case 'weight':
          hk.saveWeight({ value: record.value, unit: 'kilogram' }, (err: Error | null) => resolve(!err));
          break;
        default:
          resolve(false);
      }
    });
  }
}

// Singleton export
export const healthKitAdapter = new HealthKitAdapter();
