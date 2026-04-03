/**
 * AppGate — Root lifecycle barrier.
 *
 * Blocks ALL child rendering until the app is fully ready:
 *   - Database initialized
 *   - SystemGuard → READY
 *   - User profile loaded
 *
 * Placement: Inside DatabaseProvider (needs DB context), wrapping
 * all content-rendering children in _layout.tsx.
 *
 * This replaces ad-hoc loading checks scattered across screens.
 * After AppGate passes, every child component can assume:
 *   - DB is operational
 *   - User profile exists
 *   - SystemGuard state is READY
 */
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAppReady } from '../hooks/useAppReady';
import { useTheme } from '../context/ThemeContext';

interface AppGateProps {
  children: React.ReactNode;
}

export function AppGate({ children }: AppGateProps) {
  const { ready, loading, error, systemState } = useAppReady();
  const { theme } = useTheme();

  // Critical failure — show error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorTitle, { color: theme.colors.error }]}>
          System Error
        </Text>
        <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>
          {error}
        </Text>
        <Text style={[styles.stateText, { color: theme.colors.textMuted }]}>
          State: {systemState}
        </Text>
      </View>
    );
  }

  // Still initializing — show loading indicator
  if (loading || !ready) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // All systems operational — render children
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  stateText: {
    fontSize: 12,
    opacity: 0.6,
  },
});
