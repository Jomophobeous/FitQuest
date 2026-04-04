/**
 * Tests: Runtime Safety — CrashReporting Service
 *
 * Target: src/services/crashReporting.ts
 * Strategy: crashReporting.ts uses `import('@sentry/react-native')` dynamically.
 *           vitest alias resolves it to tests/__mocks__/sentry-react-native.ts (vi.fn() exports).
 *           After vi.resetModules(), we dynamically import both the mock and crashReporting
 *           so they share the same fresh module instance.
 * Coverage zones:
 *   1. CrashReporting initialization (idempotent, no-DSN fallback)
 *   2. captureException (calls Sentry, increments counter)
 *   3. captureFatalCrash (fatal level, scope tags)
 *   4. Session error count tracking
 *   5. User context updates
 *   6. Performance metrics (breadcrumbs)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CrashReporting Service', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  async function loadModules() {
    const sentry = await import('@sentry/react-native');
    const cr = await import('../../src/services/crashReporting');
    return { sentry, ...cr };
  }

  describe('Initialization', () => {
    it('skips Sentry init when no DSN configured', async () => {
      const { sentry, initializeCrashReporting } = await loadModules();
      await initializeCrashReporting();
      expect(sentry.init).not.toHaveBeenCalled();
    });

    it('initializes Sentry when DSN is present', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { sentry, initializeCrashReporting } = await loadModules();
      await initializeCrashReporting();
      expect(sentry.init).toHaveBeenCalledTimes(1);
      expect(sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
        })
      );
    });

    it('double-init is idempotent', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { sentry, initializeCrashReporting } = await loadModules();
      await initializeCrashReporting();
      await initializeCrashReporting();
      expect(sentry.init).toHaveBeenCalledTimes(1);
    });

    it('sets default user context on init', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { sentry, initializeCrashReporting } = await loadModules();
      await initializeCrashReporting();
      expect(sentry.setUser).toHaveBeenCalledWith({ id: 'user_local_001' });
    });
  });

  describe('Exception Capture', () => {
    it('captureException calls Sentry and increments counter', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { sentry, initializeCrashReporting, captureException, getSessionErrorCount } =
        await loadModules();
      await initializeCrashReporting();

      expect(getSessionErrorCount()).toBe(0);
      captureException(new Error('Test error'), { screen: 'dashboard' });

      expect(sentry.captureException).toHaveBeenCalled();
      expect(getSessionErrorCount()).toBe(1);
    });

    it('session error count increments per capture', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { initializeCrashReporting, captureException, getSessionErrorCount } =
        await loadModules();
      await initializeCrashReporting();

      captureException(new Error('e1'));
      captureException(new Error('e2'));
      captureException(new Error('e3'));
      expect(getSessionErrorCount()).toBe(3);
    });
  });

  describe('Fatal Crash Capture', () => {
    it('captureFatalCrash uses withScope for fatal-level tagging', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { sentry, initializeCrashReporting, captureFatalCrash } =
        await loadModules();
      await initializeCrashReporting();

      captureFatalCrash(new Error('FATAL'), { boundary: 'global' });
      expect(sentry.withScope).toHaveBeenCalledTimes(1);
    });

    it('captureFatalCrash increments session error count', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { initializeCrashReporting, captureFatalCrash, getSessionErrorCount } =
        await loadModules();
      await initializeCrashReporting();

      captureFatalCrash(new Error('FATAL'));
      expect(getSessionErrorCount()).toBe(1);
    });
  });

  describe('User Context', () => {
    it('setSentryUserContext updates Sentry user after init', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { sentry, initializeCrashReporting, setSentryUserContext } = await loadModules();
      await initializeCrashReporting();
      (sentry.setUser as ReturnType<typeof vi.fn>).mockClear();

      setSentryUserContext('user-42', { tier: 'premium' });
      expect(sentry.setUser).toHaveBeenCalledWith({ id: 'user-42', tier: 'premium' });
    });
  });

  describe('Performance Metrics', () => {
    it('capturePerformanceMetric adds a Sentry breadcrumb after init', async () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@sentry.io/123';
      const { sentry, initializeCrashReporting, capturePerformanceMetric } = await loadModules();
      await initializeCrashReporting();

      capturePerformanceMetric('db_init', 450);
      expect(sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'performance',
        message: 'db_init:450',
        level: 'info',
      });
    });
  });
});
