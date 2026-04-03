import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { AppState, BackHandler, View, ActivityIndicator } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext';
import { DatabaseProvider } from '../src/context/DatabaseContext';
import { SubscriptionProvider, useSubscription } from '../src/purchases/SubscriptionContext';
import { AuthProvider } from '../src/context/AuthContext';
import { AuthGate } from '../src/components/AuthGate';
import { PostHogAnalyticsProvider } from '../src/services/posthogService';
import { ConnectivityProvider } from '../src/context/ConnectivityContext';
import OfflineBanner from '../src/components/OfflineBanner';
import { ToastProvider } from '../src/context/ToastContext';

import { DropdownMenu } from '../src/components/DropdownMenu';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { AppGate } from '../src/components/AppGate';
import { logEvent, logPerf } from '../src/services/telemetry';
import { initializeCrashReporting } from '../src/services/crashReporting';
import { startSession, endSession } from '../src/services/sessionTracker';
import { resetFrictionState } from '../src/services/frictionLogger';
import { logDailyReturn } from '../src/services/growthAnalytics';
import { initAnalyticsOptOut } from '../src/services/analyticsOptOut';
import { systemGuard } from '../src/services/SystemGuard';
import { typography, spacing, radius } from '../src/design/theme-system';


/**
 * Global access gate — resolves subscription state before rendering.
 * RESOLVING shows nothing (avoids flash).
 * All other states render children normally.
 * Intelligence-layer gating is handled per-panel, not at the root.
 * Core features (workouts, exercises, steps) are always accessible.
 */
function AccessGate({ children }: { children: React.ReactNode }) {
  const { accessState } = useSubscription();
  const { theme } = useTheme();

  // While subscription state is resolving, show themed loading instead of blank flash
  if (accessState === 'RESOLVING') {
    return (
      <View
        style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

function ThemedTabs() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Memoize tab bar style to avoid re-creating the style object on every render
  // (prevents layout recalculation that causes visible twitching)
  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
      position: 'absolute' as const,
      left: 12,
      right: 12,
      bottom: Math.max(8, insets.bottom + 2),
      borderRadius: radius.xl,
      paddingTop: spacing[1.5],
      paddingBottom: Math.max(8, insets.bottom - 2),
      height: 64 + Math.max(0, insets.bottom - 4),
    }),
    [theme.colors.surface, theme.colors.border, insets.bottom],
  );

  // Handle hardware back button — prevent GO_BACK crashes on root screens
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      // On root tab, don't crash — just let system handle (minimize app)
      return false;
    });
    return () => backHandler.remove();
  }, [router]);

  // Stable headerRight callback to prevent DropdownMenu from re-mounting every render
  const headerRight = useCallback(() => <DropdownMenu />, []);

  // Memoize screenOptions to prevent the entire tab navigator from recalculating
  // its config on every render (theme/insets changes are the only valid triggers)
  const screenOptions = useMemo(
    () => ({
      headerStyle: {
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        borderBottomWidth: 1,
      },
      headerTintColor: theme.colors.text,
      headerTitleStyle: {
        fontWeight: '600' as const,
        fontSize: typography.sizes.h4, 
      },
      headerRight,
      // Smooth tab switch — 'shift' keeps screens mounted to avoid re-triggering
      // Reanimated entering animations (which causes visible twitching with 'fade')
      animation: 'shift' as const,
      tabBarStyle,
      tabBarHideOnKeyboard: true,
      tabBarActiveTintColor: theme.colors.accent,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarLabelStyle: {
        fontSize: typography.sizes.captionSm, 
        fontWeight: '500' as const,
        marginTop: spacing[0.5],
        marginBottom: spacing[1],
      },
    }),
    [
      theme.colors.surface,
      theme.colors.border,
      theme.colors.text,
      theme.colors.accent,
      theme.colors.textMuted,
      tabBarStyle,
      headerRight,
    ],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      {/* Dashboard Tab */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tab.home'),
          tabBarAccessibilityLabel: 'Dashboard tab',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="view-dashboard" size={22} color={color} />,
        }}
      />

      {/* FitQuest Tab - AI Workout Generator */}
      <Tabs.Screen
        name="fitquest"
        options={{
          title: t('tab.train'),
          tabBarAccessibilityLabel: 'Workout tab',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="lightning-bolt" size={22} color={color} />,
        }}
      />

      {/* Move Tab - Steps & Jog */}
      <Tabs.Screen
        name="move"
        options={{
          title: t('tab.move'),
          tabBarAccessibilityLabel: 'Move tab',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="shoe-print" size={22} color={color} />,
        }}
      />

      {/* AI Coach Tab */}
      <Tabs.Screen
        name="coach/index"
        options={{
          title: t('nav.aiCoach'),
          tabBarAccessibilityLabel: 'AI Coach tab',
          headerShown: false,
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="robot-happy" size={22} color={color} />,
        }}
      />

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarAccessibilityLabel: 'Profile tab',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="account" size={22} color={color} />,
        }}
      />

      {/* Hidden Screens (not in tab bar) */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
          lazy: true,
        }}
      />
      <Tabs.Screen
        name="login"
        options={{
          href: null,
          lazy: true,
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="register"
        options={{
          href: null,
          lazy: true,
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="splash"
        options={{
          href: null,
          lazy: true,
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{
          href: null,
          lazy: true,
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          href: null,
          lazy: true,
        }}
      />
      <Tabs.Screen
        name="workouts/index"
        options={{
          href: null,
          lazy: true,
        }}
      />
      <Tabs.Screen
        name="workouts/[id]"
        options={{
          href: null,
          lazy: true,
        }}
      />

      <Tabs.Screen
        name="progress"
        options={{
          href: null,
          lazy: true,
          title: t('nav.progress'),
        }}
      />
      <Tabs.Screen
        name="create-workout"
        options={{
          href: null,
          lazy: true,
          title: t('nav.createWorkout'),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: null,
          lazy: true,
          title: t('nav.analytics'),
        }}
      />
      <Tabs.Screen
        name="saved-workouts"
        options={{
          href: null,
          lazy: true,
          title: t('nav.myWorkouts'),
        }}
      />
      <Tabs.Screen
        name="meal-prep"
        options={{
          href: null,
          lazy: true,
          title: t('nav.mealPrep'),
        }}
      />
      <Tabs.Screen
        name="craft-my-body"
        options={{
          href: null,
          lazy: true,
          title: t('nav.craftMyBody'),
        }}
      />
      <Tabs.Screen
        name="backups"
        options={{
          href: null,
          lazy: true,
          title: t('nav.backupRestore'),
        }}
      />
      <Tabs.Screen
        name="paywall"
        options={{
          href: null,
          lazy: true,
          title: t('nav.premium'),
        }}
      />
      <Tabs.Screen
        name="health-dashboard"
        options={{
          href: null,
          lazy: true,
          title: t('nav.health'),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          href: null,
          lazy: true,
          title: t('nav.exercises'),
        }}
      />
      <Tabs.Screen
        name="nutrition-calculator"
        options={{
          href: null,
          lazy: true,
          title: t('nav.nutritionCalculator'),
        }}
      />
      <Tabs.Screen
        name="legal-center"
        options={{
          href: null,
          lazy: true,
          title: t('nav.legalCenter'),
        }}
      />
      <Tabs.Screen
        name="privacy-policy"
        options={{
          href: null,
          lazy: true,
          title: t('nav.privacyPolicy'),
        }}
      />
      <Tabs.Screen
        name="terms-of-service"
        options={{
          href: null,
          lazy: true,
          title: t('nav.termsOfService'),
        }}
      />

      <Tabs.Screen
        name="professor/index"
        options={{
          href: null,
          lazy: true,
          title: t('nav.professor'),
        }}
      />
      <Tabs.Screen
        name="fitmind-library"
        options={{
          href: null,
          lazy: true,
          title: 'FitMind Library',
        }}
      />
      <Tabs.Screen
        name="fitmind-reader"
        options={{
          href: null,
          lazy: true,
          title: 'FitMind Reader',
        }}
      />
      <Tabs.Screen
        name="dev/ui-preview"
        options={{
          href: null,
          lazy: true,
          title: 'UI Preview',
        }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  const appStartRef = useRef(Date.now());
  const initializedRef = useRef(false);

  useEffect(() => {
    // Guard: prevent duplicate init on Fast Refresh re-mount
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Critical — must run immediately
    initializeCrashReporting();
    void initAnalyticsOptOut();

    const durationMs = Date.now() - appStartRef.current;
    logPerf('app_launch', durationMs);
    logEvent('app_launch');

    // ── Session + retention tracking (Block Y/W) ──
    startSession();
    resetFrictionState();
    void logDailyReturn();
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startSession();
        resetFrictionState();
      } else if (state === 'background' || state === 'inactive') {
        void endSession();
      }
    });

    // Defer non-critical startup work — sequenced to avoid CPU spikes.
    // All deferred services are dynamically imported to keep the critical parse path lean.
    // Phase 1: lightweight telemetry + flags (sequential to avoid burst)
    // Phase 2: deferred mutations, notifications, analytics
    // Phase 3: background health engine (heaviest — starts last)
    let cancelled = false;
    let bgHealthRef: { stop: () => void } | null = null;
    const cleanupFns: Array<() => void> = [];

    const deferStartup = async () => {
      // Phase 1: sequential lightweight inits
      try {
        const { errorTelemetry } = await import('../src/services/errorTelemetry');
        await errorTelemetry.initialize();
      } catch {}
      if (cancelled) return;

      // Feature flags MUST init before anything else — all Phase 2/3 depend on them
      let flags: { isEnabled: (f: string) => boolean } | null = null;
      try {
        const { featureFlags } = await import('../src/services/featureFlags');
        await featureFlags.initialize();
        flags = featureFlags;
      } catch {}
      if (cancelled) return;

      // Cloud backup — gated
      if (flags?.isEnabled('CLOUD_BACKUP')) {
        try {
          const { maybeAutoCloudBackupOncePerDay } = await import('../src/services/cloudBackupService');
          void maybeAutoCloudBackupOncePerDay().catch((e) => {
            if (__DEV__) console.warn('[Layout] cloud backup failed', e);
          });
        } catch {}
      }

      if (cancelled) return;

      // Phase 2: deferred mutations, notifications, analytics — after a frame yield
      await new Promise((resolve) => setTimeout(resolve, 100)); // debounce
      if (cancelled) return;

      // Replay orchestrator — gated
      if (flags?.isEnabled('REPLAY_ORCHESTRATOR')) {
        try {
          const { runReplayIfDue } = await import('../src/services/replayOrchestrator');
          void runReplayIfDue({ reason: 'app_start', cooldownMs: 45 * 1000 }).catch((e) => {
            if (__DEV__) console.warn('[Layout] replay failed', e);
          });
        } catch {}
      }

      // Notification reliability — always (lightweight, core UX)
      try {
        const { reconcileNotificationReliability } = await import('../src/services/notificationReliabilityService');
        void reconcileNotificationReliability('app_start').catch((e) => {
          if (__DEV__) console.warn('[Layout] notification reconcile failed', e);
        });
      } catch {}

      // Engagement notifications — gated
      if (flags?.isEnabled('ENGAGEMENT_NOTIFICATIONS')) {
        try {
          const { reconcileEngagementNotifications } = await import('../src/services/engagementNotificationService');
          void reconcileEngagementNotifications().catch((e) => {
            if (__DEV__) console.warn('[Layout] engagement notifications failed', e);
          });
        } catch {}
      }

      // Anti-piracy — gated
      if (flags?.isEnabled('ANTI_PIRACY')) {
        try {
          const { tamperEngine } = await import('../src/services/security/tamperEngine');
          tamperEngine.initialize();
        } catch {}
        try {
          const { verifyDevice } = await import('../src/services/authorityClient');
          void verifyDevice('user_local_001').catch(() => {});
        } catch {}
      }

      // Analytics flush — always (lightweight, ensures queued events land)
      try {
        const { flushAnalyticsQueue } = await import('../src/services/analyticsIngestionService');
        void flushAnalyticsQueue().catch((e) => {
          if (__DEV__) console.warn('[Layout] analytics flush failed', e);
        });
      } catch {}

      // Metrics aggregator — gated
      if (flags?.isEnabled('METRICS_AGGREGATOR')) {
        try {
          const { getMetricsSummary } = await import('../src/services/metricsAggregator');
          void getMetricsSummary('user_local_001').then((metrics) => {
            void logEvent('metrics_snapshot', metrics);
          }).catch(() => {});
        } catch {}
      }

      // Phase 3: background health engine last — heaviest service (timers, DB queries, sensors)
      // Only starts if BACKGROUND_HEALTH flag is enabled
      if (cancelled) return;
      if (!flags?.isEnabled('BACKGROUND_HEALTH')) {
        if (__DEV__) console.warn('[Layout] BackgroundHealthEngine skipped (ff_background_health disabled)');
        return;
      }
      const startBgHealth = async (attempt = 0) => {
        if (cancelled) return;
        try {
          const { backgroundHealth } = await import('../src/engines/BackgroundHealthEngine');
          bgHealthRef = backgroundHealth;
          await backgroundHealth.start({
            collectionIntervalMs: 1 * 60 * 1000,
            anomalyCheckIntervalMs: 30 * 60 * 1000,
            enableAlerts: true,
          });
        } catch (e) {
          if (__DEV__) console.warn('[BackgroundHealth] Failed to start (attempt', attempt + 1, '):', e);
          // Retry with exponential backoff: 2s, 4s, 8s — max 3 retries
          if (attempt < 3 && !cancelled) {
            const delay = Math.pow(2, attempt + 1) * 1000;
            await new Promise((r) => setTimeout(r, delay));
            return startBgHealth(attempt + 1);
          }
          if (__DEV__) console.error('[BackgroundHealth] All retry attempts exhausted — health monitoring disabled');
        }
      };
      if (systemGuard.isReady) {
        await startBgHealth();
      } else {
        // Subscribe and start when system becomes READY
        const unsub = systemGuard.subscribe((state) => {
          if (state === 'READY') {
            unsub();
            startBgHealth();
          }
        });
        // Store unsubscribe for cleanup
        cleanupFns.push(unsub);
      }
    };

    // Use requestIdleCallback where available, fall back to setTimeout
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        deferStartup();
      });
    } else {
      timeoutHandle = setTimeout(() => { // debounce
        deferStartup();
      }, 300);
    }

    // Cleanup: cancel deferred chain + stop backgroundHealth (Fast Refresh safety)
    return () => {
      cancelled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      bgHealthRef?.stop();
      cleanupFns.forEach((fn) => fn());
      appStateSub.remove();
      void endSession();
    };
  }, []);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <PostHogAnalyticsProvider>
          <LanguageProvider>
            <AuthGate>
              <DatabaseProvider>
                <AppGate>
                  <AuthProvider>
                    <SubscriptionProvider>
                      <ConnectivityProvider>
                        <ToastProvider>
                          <AccessGate>
                            <OfflineBanner />
                            <ThemedTabs />
                          </AccessGate>
                        </ToastProvider>
                      </ConnectivityProvider>
                    </SubscriptionProvider>
                  </AuthProvider>
                </AppGate>
              </DatabaseProvider>
            </AuthGate>
          </LanguageProvider>
        </PostHogAnalyticsProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
