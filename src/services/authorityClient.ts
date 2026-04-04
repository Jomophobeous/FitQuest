/**
 * Authority Client Stub — server verification disabled in offline-only mode
 */

export interface AIAccessResult {
  authorized: boolean;
  reason?: string;
  retryAfterMs?: number;
}

export async function requestAI(_userId: string, _deviceId: string, _input: string): Promise<AIAccessResult | null> {
  // Offline mode — return null to fall through to local templates
  return null;
}

export async function verifySubscription(_userId: string, _deviceId: string, _deviceToken: string): Promise<void> {
  // no-op in offline mode
}
