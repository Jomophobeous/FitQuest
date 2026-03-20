import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { BackHandler, InteractionManager } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext';
import { DatabaseProvider } from '../src/context/DatabaseContext';
import { SubscriptionProvider } from '../src/purchases/SubscriptionContext';
import { AuthProvider } from '../src/context/AuthContext';
import { PostHogAnalyticsProvider } from '../src/services/posthogService';

import { DropdownMenu } from '../src/components/DropdownMenu';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { logEvent, logPerf } from '../src/services/telemetry';
import { initializeCrashReporting } from '../src/services/crashReporting';
import { maybeAutoCloudBackupOncePerDay } from '../src/services/cloudBackupService';
import { flushAnalyticsQueue } from '../src/services/analyticsIngestionService';
import { runReplayIfDue } from '../src/services/replayOrchestrator';
import { reconcileNotificationReliability } from '../src/services/notificationReliabilityService';
import { errorTelemetry } from '../src/services/errorTelemetry';
import { featureFlags } from '../src/services/featureFlags';
import { backgroundHealth } from '../src/engines/BackgroundHealthEngine';
import { audioService } from '../src/services/audioService';

/** Keeps audioService TTS language in sync with the current app language */
function AudioLanguageSyncer() {
  const { language, t } = useLanguage();
  useEffect(() => {
    audioService.setLanguage(language);
    audioService.setTranslator(t);
  }, [language, t]);
  return null;
}


function ThemedTabs() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Memoize tab bar style to avoid re-creating the style object on every render
  // (prevents layout recalculation that causes visible twitching)
  const tabBarStyle = useMemo(() => ({
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    position: 'absolute' as const,
    left: 12,
    right: 12,
    bottom: Math.max(8, insets.bottom + 2),
    borderRadius: 16,
    paddingTop: 6,
    paddingBottom: Math.max(8, insets.bottom - 2),
    height: 64 + Math.max(0, insets.bottom - 4),
  }), [theme.colors.surface, theme.colors.border, insets.bottom]);

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

  useEffect(() => {
    if (__DEV__) {
      console.log('[Tabs] Layout config', {
        bottomInset: insets.bottom,
        theme: theme.isDark ? 'dark' : 'light',
      });
    }
  }, [insets.bottom, theme.isDark]);

  // Stable headerRight callback to prevent DropdownMenu from re-mounting every render
  const headerRight = useCallback(() => <DropdownMenu />, []);

  // Memoize screenOptions to prevent the entire tab navigator from recalculating
  // its config on every render (theme/insets changes are the only valid triggers)
  const screenOptions = useMemo(() => ({
    headerStyle: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.border,
      borderBottomWidth: 1,
    },
    headerTintColor: theme.colors.text,
    headerTitleStyle: {
      fontWeight: '600' as const,
      fontSize: 18,
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
      fontSize: 11,
      fontWeight: '500' as const,
      marginTop: 2,
      marginBottom: 4,
    },
  }), [theme.colors.surface, theme.colors.border, theme.colors.text, theme.colors.accent, theme.colors.textMuted, tabBarStyle, headerRight]);

  return (
    <Tabs
      screenOptions={screenOptions}
    >
      {/* Dashboard Tab */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('tab.home'),
          tabBarAccessibilityLabel: 'Dashboard tab',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-dashboard" size={22} color={color} />
          ),
        }}
      />

      {/* FitQuest Tab - AI Workout Generator */}
      <Tabs.Screen
        name="fitquest"
        options={{
          title: t('tab.train'),
          tabBarAccessibilityLabel: 'Workout tab',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="lightning-bolt" size={22} color={color} />
          ),
        }}
      />

      {/* Move Tab - Steps & Jog */}
      <Tabs.Screen
        name="move"
        options={{
          title: t('tab.move'),
          tabBarAccessibilityLabel: 'Move tab',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="shoe-print" size={22} color={color} />
          ),
        }}
      />

      {/* AI Coach Tab */}
      <Tabs.Screen
        name="coach/index"
        options={{
          title: t('nav.aiCoach'),
          tabBarAccessibilityLabel: 'AI Coach tab',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="robot-happy" size={22} color={color} />
          ),
        }}
      />

      {/* Profile Tab */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarAccessibilityLabel: 'Profile tab',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={22} color={color} />
          ),
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
        name="fitmind-library"
        options={{
          href: null,
          lazy: true,
          title: t('tab.library'),
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
        name="fitmind-reader"
        options={{
          href: null,
          lazy: true,
          title: t('nav.reader'),
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
    </Tabs>
  );
}

export default function RootLayout() {
  const appStartRef = useRef(Date.now());

  useEffect(() => {
    // Critical — must run immediately
    initializeCrashReporting();

    const durationMs = Date.now() - appStartRef.current;
    logPerf('app_launch', durationMs);
    logEvent('app_launch');

    // Defer non-critical startup work until after first interaction/animation completes
    // InteractionManager is load-aware — waits for animations, unlike fixed setTimeout
    const deferStartup = () => {
      void errorTelemetry.initialize().catch(() => {});
      void featureFlags.initialize().catch(() => {});

      // Phase 2: silent periodic backup (no-op unless EXPO_PUBLIC_BACKUP_API_BASE_URL is configured)
      void maybeAutoCloudBackupOncePerDay().catch(() => {});

      // Phase 3: deferred mutations, notifications, analytics — after interactions settle
      InteractionManager.runAfterInteractions(() => {
        // P1: centralized deferred mutation replay
        void runReplayIfDue({ reason: 'app_start', cooldownMs: 45 * 1000 }).catch(() => {});

        // P1: keep local reminder schedule in sync with persisted reliability settings
        void reconcileNotificationReliability('app_start').catch(() => {});

        // Phase 4: best-effort anonymized analytics flush (server enforces consent before ingest)
        void flushAnalyticsQueue().catch(() => {});

        // Start background health engine last — heaviest service (timers, DB queries, sensors)
        InteractionManager.runAfterInteractions(() => {
          backgroundHealth.start({
            collectionIntervalMs: 1 * 60 * 1000,    // every 1 minute
            anomalyCheckIntervalMs: 30 * 60 * 1000, // every 30 minutes
            enableAlerts: true,
          }).catch((e) => {
            if (__DEV__) console.warn('[BackgroundHealth] Failed to start:', e);
          });
        });
      });

      // HealthConnect permissions are requested ONLY from Profile screen
      // when user taps "Connect Health Provider" — the Activity must have
      // a registered permission launcher, which isn't available in deferred startup.
    };

    // Use requestIdleCallback where available, fall back to setTimeout
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(deferStartup);
    } else {
      setTimeout(deferStartup, 300);
    }
  }, []);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <PostHogAnalyticsProvider>
        <LanguageProvider>
          <AudioLanguageSyncer />
          <DatabaseProvider>
            <AuthProvider>
              <SubscriptionProvider>
                  <ThemedTabs />
              </SubscriptionProvider>
            </AuthProvider>
          </DatabaseProvider>
        </LanguageProvider>
        </PostHogAnalyticsProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
