/**
 * Health Adapters Stub
 * Apple Health / Google Fit integration — stub for core build.
 */

export interface HealthAdapterStatus {
  available: boolean;
  initialized: boolean;
  provider: 'health_connect' | 'healthkit' | 'google_fit' | 'none' | 'unknown';
}

export interface HealthAdapter {
  provider: 'health_connect' | 'healthkit' | 'google_fit' | 'none' | 'unknown';
  isAvailable: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  getStatus: () => Promise<HealthAdapterStatus>;
  getSteps: (date: string) => Promise<number>;
  getHeartRate: () => Promise<number | null>;
}

export async function isHealthIntegrationAvailable(): Promise<boolean> {
  return false;
}

export async function getHealthAdapter(): Promise<HealthAdapter | null> {
  return null;
}

export async function initializeHealthIntegration(): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Health integration not available in core build' };
}

export async function syncHealthData(_opts: Record<string, unknown>): Promise<{ synced: number; errors: number }> {
  return { synced: 0, errors: 0 };
}

export async function captureHealthError(_error: Error | string, _context: Record<string, unknown>): Promise<void> {}
