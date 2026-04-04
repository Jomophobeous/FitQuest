/**
 * DatabaseRecoveryScreen — Hard failure boundary.
 *
 * Shown when SystemGuard state is FAILED. Blocks all app interaction
 * and offers retry or full database reset.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { GradientButton } from './ui/GlassUI';
import { typography, spacing } from '../design/theme-system';

interface Props {
  error: string | null;
  isRecovering: boolean;
  onRetry: () => void;
  onReset: () => void;
}

export default function DatabaseRecoveryScreen({ error, isRecovering, onRetry, onReset }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.icon]}>⚠️</Text>

        <Text style={[styles.title, { color: theme.colors.error }]}>Database Error</Text>

        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
          {error ?? 'The database could not be initialized. Your data may need repair.'}
        </Text>

        {isRecovering ? (
          <View style={styles.spinnerRow}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={[styles.spinnerText, { color: theme.colors.textMuted }]}>Attempting recovery…</Text>
          </View>
        ) : (
          <View style={styles.buttons}>
            <GradientButton
              title="Retry"
              variant="primary"
              size="lg"
              onPress={onRetry}
              style={{ marginBottom: theme.spacing[4] }}
            />
            <GradientButton title="Reset Database" variant="warning" size="md" onPress={onReset} />
            <Text style={[styles.resetWarning, { color: theme.colors.textMuted }]}>
              Reset will erase all local data and start fresh.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
  },
  icon: {
    fontSize: typography.sizes.hero,
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.sizes.h3,
    fontWeight: '700',
    marginBottom: spacing[3],
    textAlign: 'center',
  },
  message: {
    fontSize: typography.sizes.bodyMid,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing[8],
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  spinnerText: {
    fontSize: typography.sizes.bodySmall,
  },
  buttons: {
    width: '100%',
    alignItems: 'center',
  },
  resetWarning: {
    fontSize: typography.sizes.caption,
    marginTop: spacing[3],
    textAlign: 'center',
  },
});
