/**
 * UI Preview Mode — Dev-only screen switcher
 *
 * Navigate all major screens without auth or data dependencies.
 * Access via: router.push('/dev/ui-preview') or URL: /dev/ui-preview
 *
 * Only available in __DEV__ mode.
 */

import React, { useCallback } from 'react';
import { View, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/context/ThemeContext';
import ThemedText from '../../src/components/ThemedText';
import { GradientButton, GlassCard } from '../../src/components/ui/GlassUI';
import { typography, spacing } from '../../src/design/theme-system';

interface ScreenEntry {
  route: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  section: 'core' | 'fitness' | 'intelligence' | 'settings';
}

const SCREENS: ScreenEntry[] = [
  // Core
  { route: '/dashboard', label: 'Dashboard', icon: 'view-dashboard', section: 'core' },
  { route: '/fitquest', label: 'FitQuest', icon: 'sword-cross', section: 'core' },
  { route: '/move', label: 'Move', icon: 'walk', section: 'core' },
  { route: '/exercises', label: 'Exercises', icon: 'dumbbell', section: 'core' },
  { route: '/profile', label: 'Profile', icon: 'account', section: 'core' },

  // Fitness
  { route: '/workout', label: 'Workout (Active)', icon: 'play-circle', section: 'fitness' },
  { route: '/create-workout', label: 'Create Workout', icon: 'playlist-plus', section: 'fitness' },
  { route: '/saved-workouts', label: 'Saved Workouts', icon: 'content-save-all', section: 'fitness' },
  { route: '/craft-my-body', label: 'Craft My Body', icon: 'human-handsup', section: 'fitness' },
  { route: '/health-dashboard', label: 'Health Dashboard', icon: 'heart-pulse', section: 'fitness' },
  { route: '/progress', label: 'Progress', icon: 'chart-line', section: 'fitness' },

  // Intelligence
  { route: '/coach', label: 'AI Coach', icon: 'robot', section: 'intelligence' },
  { route: '/professor', label: 'AI Professor', icon: 'school', section: 'intelligence' },
  { route: '/fitmind-library', label: 'FitMind Library', icon: 'book-open-variant', section: 'intelligence' },
  { route: '/meal-prep', label: 'Meal Prep', icon: 'food-apple', section: 'intelligence' },
  { route: '/nutrition-calculator', label: 'Nutrition Calculator', icon: 'calculator', section: 'intelligence' },

  // Settings / Legal
  { route: '/paywall', label: 'Paywall', icon: 'credit-card', section: 'settings' },
  { route: '/analytics', label: 'Analytics', icon: 'chart-bar', section: 'settings' },
  { route: '/feedback', label: 'Feedback', icon: 'message-text', section: 'settings' },
  { route: '/legal-center', label: 'Legal Center', icon: 'shield-check', section: 'settings' },
  { route: '/onboarding', label: 'Onboarding', icon: 'rocket-launch', section: 'settings' },
];

const SECTION_LABELS: Record<string, string> = {
  core: 'Core Tabs',
  fitness: 'Fitness Screens',
  intelligence: 'Intelligence Layer',
  settings: 'Settings & System',
};

export default function UIPreview() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const navigate = useCallback(
    (route: string) => {
      router.push(route as any);
    },
    [router],
  );

  const sections = ['core', 'fitness', 'intelligence', 'settings'] as const;

  if (!__DEV__) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
        <ThemedText variant="h2" color="primary" style={styles.title}>
          Not Available
        </ThemedText>
        <ThemedText variant="body" color="muted">
          UI Preview is only available in development mode.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[8] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons name="palette" size={28} color={theme.colors.accent} />
          <ThemedText variant="h2" color="primary" style={styles.title}>
            UI Preview
          </ThemedText>
        </View>
        <ThemedText variant="bodySmall" color="muted" style={styles.subtitle}>
          Navigate all screens without auth or data dependencies
        </ThemedText>

        {sections.map((section) => {
          const items = SCREENS.filter((s) => s.section === section);
          return (
            <View key={section} style={styles.section}>
              <ThemedText variant="h4" color="secondary" style={styles.sectionTitle}>
                {SECTION_LABELS[section]}
              </ThemedText>
              <View style={styles.grid}>
                {items.map((screen) => (
                  <GlassCard
                    key={screen.route}
                    style={styles.card}
                    onPress={() => navigate(screen.route)}
                  >
                    <MaterialCommunityIcons
                      name={screen.icon}
                      size={24}
                      color={theme.colors.accent}
                    />
                    <ThemedText variant="label" color="primary" style={styles.cardLabel}>
                      {screen.label}
                    </ThemedText>
                    <ThemedText variant="caption" color="muted" numberOfLines={1}>
                      {screen.route}
                    </ThemedText>
                  </GlassCard>
                ))}
              </View>
            </View>
          );
        })}

        <View style={styles.section}>
          <ThemedText variant="h4" color="secondary" style={styles.sectionTitle}>
            Billing Simulation
          </ThemedText>
          <ThemedText variant="bodySmall" color="muted" style={styles.billingNote}>
            Set EXPO_PUBLIC_BILLING_MODE=mock and EXPO_PUBLIC_MOCK_BILLING_STATE to test:
          </ThemedText>
          <View style={styles.billingStates}>
            <GradientButton title="Premium" variant="success" size="sm" style={styles.billingBtn} onPress={() => {}} />
            <GradientButton title="Trial" variant="primary" size="sm" style={styles.billingBtn} onPress={() => {}} />
            <GradientButton title="Expired" variant="warning" size="sm" style={styles.billingBtn} onPress={() => {}} />
          </View>
          <ThemedText variant="caption" color="muted" style={styles.billingNote}>
            Runtime switching requires SubscriptionManager.setMockState() — see docs
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[1],
  },
  title: {
    flex: 1,
  },
  subtitle: {
    marginBottom: spacing[6],
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    marginBottom: spacing[3],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  card: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
    gap: spacing[1],
  },
  cardLabel: {
    textAlign: 'center',
    fontSize: typography.sizes.label,
  },
  billingNote: {
    marginBottom: spacing[2],
  },
  billingStates: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  billingBtn: {
    flex: 1,
  },
});
