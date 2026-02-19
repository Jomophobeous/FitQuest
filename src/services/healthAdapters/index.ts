/**
 * Health Adapters Module
 * 
 * Unified health data integration for FitQuest.
 * Supports Health Connect (Android), HealthKit (iOS), and future providers.
 */

import { Platform } from 'react-native';
import type { 
  IHealthAdapter, 
  HealthProvider, 
  HealthAdapterFactory,
} from './types';

// Re-export types
export * from './types';

// Lazy adapter imports — avoid loading native modules at startup in Expo Go
let _healthConnectAdapter: IHealthAdapter | null = null;
let _healthKitAdapter: IHealthAdapter | null = null;

async function getHealthConnectAdapter(): Promise<IHealthAdapter> {
  if (!_healthConnectAdapter) {
    const mod = await import('./HealthConnectAdapter');
    _healthConnectAdapter = mod.healthConnectAdapter;
  }
  return _healthConnectAdapter;
}

async function getHealthKitAdapter(): Promise<IHealthAdapter> {
  if (!_healthKitAdapter) {
    const mod = await import('./HealthKitAdapter');
    _healthKitAdapter = mod.healthKitAdapter;
  }
  return _healthKitAdapter;
}

// Re-export adapters as lazy getters
export { getHealthConnectAdapter, getHealthKitAdapter };

// ============================================
// ADAPTER FACTORY IMPLEMENTATION
// ============================================

class HealthAdapterFactoryImpl implements HealthAdapterFactory {
  private cachedAdapter: IHealthAdapter | null = null;
  private cacheChecked = false;

  /**
   * Get the best available adapter for the current platform
   */
  async getAdapter(): Promise<IHealthAdapter | null> {
    if (this.cacheChecked && this.cachedAdapter) {
      return this.cachedAdapter;
    }

    this.cacheChecked = true;

    try {
      // Platform-specific preference order
      if (Platform.OS === 'android') {
        const adapter = await getHealthConnectAdapter();
        if (await adapter.isAvailable()) {
          this.cachedAdapter = adapter;
          return this.cachedAdapter;
        }
      } else if (Platform.OS === 'ios') {
        const adapter = await getHealthKitAdapter();
        if (await adapter.isAvailable()) {
          this.cachedAdapter = adapter;
          return this.cachedAdapter;
        }
      }
    } catch {
      // Native health modules unavailable (e.g. Expo Go) — gracefully degrade
    }

    return null;
  }

  /**
   * Get a specific adapter by provider type
   */
  async getAdapterByProvider(provider: HealthProvider): Promise<IHealthAdapter | null> {
    try {
      if (provider === 'health_connect') return await getHealthConnectAdapter();
      if (provider === 'healthkit') return await getHealthKitAdapter();
    } catch {
      // Native module unavailable
    }
    return null;
  }

  /**
   * Get all available adapters on this platform
   */
  async getAvailableAdapters(): Promise<IHealthAdapter[]> {
    const available: IHealthAdapter[] = [];

    try {
      if (Platform.OS === 'android') {
        const adapter = await getHealthConnectAdapter();
        if (await adapter.isAvailable()) available.push(adapter);
      } else if (Platform.OS === 'ios') {
        const adapter = await getHealthKitAdapter();
        if (await adapter.isAvailable()) available.push(adapter);
      }
    } catch {
      // Native module unavailable
    }

    return available;
  }

  /**
   * Register a custom adapter (no-op in current lazy architecture)
   */
  registerAdapter(_provider: HealthProvider, _adapter: IHealthAdapter): void {
    // Clear cache when new adapter is registered
    this.cachedAdapter = null;
    this.cacheChecked = false;
  }
}

// Singleton factory export
export const healthAdapterFactory = new HealthAdapterFactoryImpl();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Get health adapter for the current platform
 * Returns null if no health provider is available
 */
export async function getHealthAdapter(): Promise<IHealthAdapter | null> {
  return healthAdapterFactory.getAdapter();
}

/**
 * Check if any health provider is available
 */
export async function isHealthIntegrationAvailable(): Promise<boolean> {
  const adapter = await healthAdapterFactory.getAdapter();
  return adapter !== null;
}

/**
 * Initialize health integration with default permissions
 */
export async function initializeHealthIntegration(): Promise<{
  success: boolean;
  provider: HealthProvider | null;
  error?: string;
}> {
  try {
    const adapter = await healthAdapterFactory.getAdapter();
    
    if (!adapter) {
      return {
        success: false,
        provider: null,
        error: 'No health provider available on this device',
      };
    }

    const initialized = await adapter.initialize();
    
    if (!initialized) {
      return {
        success: false,
        provider: adapter.provider,
        error: 'Failed to initialize health provider',
      };
    }

    // Request default permissions
    const permissions = await adapter.requestPermissions([
      'steps',
      'calories',
      'heart_rate',
      'sleep',
      'workout',
      'active_minutes',
    ]);

    const hasReadPerms = permissions.some(p => p.read);

    return {
      success: hasReadPerms,
      provider: adapter.provider,
      error: hasReadPerms ? undefined : 'No permissions granted',
    };
  } catch (error) {
    return {
      success: false,
      provider: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync health data to local encrypted storage
 */
export async function syncHealthData(options?: {
  since?: Date;
  categories?: ('steps' | 'calories' | 'heart_rate' | 'sleep' | 'workout')[];
}): Promise<{ synced: number; errors: number; provider: HealthProvider | null }> {
  const adapter = await healthAdapterFactory.getAdapter();
  
  if (!adapter) {
    return { synced: 0, errors: 0, provider: null };
  }

  const result = await adapter.syncToLocal(options?.categories, options?.since);
  return { ...result, provider: adapter.provider };
}
