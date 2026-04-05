/**
 * PostHog Analytics Service
 *
 * Central wrapper for PostHog React Native SDK.
 * Provides: product analytics, session replay, user identification.
 *
 * Usage:
 *   - Wrap app in <PostHogAnalyticsProvider> in _layout.tsx
 *   - Use getPostHogClient() for imperative access from non-React code
 */

import React from 'react';
import PostHog, { PostHogProvider } from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let _client: PostHog | null = null;

/**
 * Whether PostHog is configured (has a real API key).
 */
export function isPostHogConfigured(): boolean {
  return POSTHOG_API_KEY.length > 0 && POSTHOG_API_KEY !== 'phc_your_key_here';
}

/**
 * Lazily initialise and return the shared PostHog client.
 * Returns null when the API key is missing / placeholder.
 * Safe to call from non-React code (services, engines).
 */
let _initPromise: Promise<PostHog | null> | null = null;

export function getPostHogClient(): Promise<PostHog | null> {
  if (!isPostHogConfigured()) return Promise.resolve(null);
  if (_client) return Promise.resolve(_client);

  if (!_initPromise) {
    _initPromise = (async () => {
      const client = new PostHog(POSTHOG_API_KEY, {
        host: POSTHOG_HOST,
        enableSessionReplay: true,
        sessionReplayConfig: {
          maskAllTextInputs: true,
          maskAllImages: true,
          captureLog: false,
          captureNetworkTelemetry: false,
          sampleRate: 0.1,
          throttleDelayMs: 1000,
        },
        flushInterval: 30,
        flushAt: 20,
      });
      await client.ready();
      _client = client;
      return _client;
    })();
  }

  return _initPromise;
}

/**
 * PostHog provider wrapper with session replay enabled.
 * Place this high in your component tree (inside ThemeProvider, above screens).
 */
export function PostHogAnalyticsProvider({ children }: { children: React.ReactNode }) {
  if (!isPostHogConfigured()) {
    return <>{children}</>;
  }

  // Session replay requires native build — disabled in Expo Go (__DEV__) to prevent crash
  const isNativeBuild = !__DEV__;

  return (
    <PostHogProvider
      apiKey={POSTHOG_API_KEY}
      options={{
        host: POSTHOG_HOST,
        enableSessionReplay: isNativeBuild,
        sessionReplayConfig: isNativeBuild
          ? {
              maskAllTextInputs: true,
              maskAllImages: true,
              captureLog: false,
              captureNetworkTelemetry: false,
              sampleRate: 0.1,
              throttleDelayMs: 1000,
            }
          : undefined,
        flushInterval: 30,
        flushAt: 20,
      }}
      autocapture={{
        captureScreens: true,
        captureTouches: false,
      }}
    >
      {children}
    </PostHogProvider>
  );
}

/**
 * Opt out of PostHog analytics.
 * Called when user withdraws consent in Legal Center.
 */
export async function optOutPostHog(): Promise<void> {
  const client = await getPostHogClient();
  if (client) {
    client.optOut();
  }
}

/**
 * Opt back in to PostHog analytics.
 * Called when user re-accepts consent in Legal Center.
 */
export async function optInPostHog(): Promise<void> {
  const client = await getPostHogClient();
  if (client) {
    client.optIn();
  }
}
