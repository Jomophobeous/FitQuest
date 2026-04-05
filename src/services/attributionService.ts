/**
 * Attribution Service — Client-side install attribution capture.
 *
 * Best-effort: failures are silent, never block UX.
 * Stores attribution locally in SecureStore for retry.
 * Reports to server POST /subscriptions/attribute.
 */

import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';

const ATTRIBUTION_KEY = 'attribution_data';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://fitq-56sj.onrender.com';

interface AttributionData {
  source?: string;
  campaign?: string;
  install_referrer?: string;
  first_open_at?: string;
}

/**
 * Capture attribution from deep link params on first open.
 * Call once during app initialization.
 */
export async function captureAttribution(): Promise<AttributionData | null> {
  try {
    // Check if already captured
    const existing = await SecureStore.getItemAsync(ATTRIBUTION_KEY);
    if (existing) {
      return JSON.parse(existing);
    }

    // Try to get initial URL (deep link)
    const url = await Linking.getInitialURL();
    const data: AttributionData = {
      first_open_at: new Date().toISOString(),
    };

    if (url) {
      const parsed = Linking.parse(url);
      if (parsed.queryParams) {
        data.source = (parsed.queryParams.utm_source as string) || undefined;
        data.campaign = (parsed.queryParams.utm_campaign as string) || undefined;
        data.install_referrer = (parsed.queryParams.referrer as string) || undefined;
      }
    }

    await SecureStore.setItemAsync(ATTRIBUTION_KEY, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

/**
 * Report trial start to server.
 */
export async function reportTrialStart(
  userId: string,
  token: string,
  attributionData?: AttributionData | null,
): Promise<void> {
  try {
    const data = attributionData || (await getStoredAttribution());
    await sendAttribution(token, {
      ...data,
      event_type: 'trial_started',
    });
  } catch {
    // Silent — best effort
  }
}

/**
 * Report conversion (purchase) to server.
 */
export async function reportConversion(userId: string, token: string): Promise<void> {
  try {
    await sendAttribution(token, { event_type: 'converted' });
  } catch {
    // Silent — best effort
  }
}

/**
 * Get locally stored attribution data.
 */
export async function getStoredAttribution(): Promise<AttributionData | null> {
  try {
    const raw = await SecureStore.getItemAsync(ATTRIBUTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Send attribution data to server (best-effort).
 */
async function sendAttribution(token: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 5000);

    await fetch(`${API_BASE}/subscriptions/attribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch {
    // Silent — best effort, never block UX
  }
}
