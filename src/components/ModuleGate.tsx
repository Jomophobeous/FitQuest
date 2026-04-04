/**
 * ModuleGate — Feature-flag guard for non-core modules.
 *
 * Wraps a screen component. If the module's feature flag is OFF,
 * shows a "Coming Soon" card and navigates back. No crash, no blank screen.
 *
 * Usage:
 *   import ModuleGate from '../src/components/ModuleGate';
 *   export default function MealPrepScreen() {
 *     return (
 *       <ModuleGate flag="MEAL_PREP_MODULE">
 *         <ActualScreenContent />
 *       </ModuleGate>
 *     );
 *   }
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import ThemedText from './ThemedText';
import { GradientButton } from './ui/GlassUI';
import { featureFlags, type FeatureFlagKey } from '../services/featureFlags';

interface ModuleGateProps {
  flag: FeatureFlagKey;
  children: React.ReactNode;
  moduleName?: string;
}

export default function ModuleGate({ flag, children, moduleName }: ModuleGateProps) {
  const { theme } = useTheme();
  const router = useRouter();

  if (featureFlags.isEnabled(flag)) {
    return <>{children}</>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ThemedText variant="h2" color="primary" style={styles.title}>
        {moduleName ?? 'Module'} — Coming Soon
      </ThemedText>
      <ThemedText variant="body" color="muted" style={styles.desc}>
        This feature is currently disabled. It will be available in a future update.
      </ThemedText>
      <GradientButton
        title="Go Back"
        variant="primary"
        size="md"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  desc: {
    textAlign: 'center',
    marginBottom: 24,
  },
});
