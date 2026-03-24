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
    padding: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spinnerText: {
    fontSize: 14,
  },
  buttons: {
    width: '100%',
    alignItems: 'center',
  },
  resetWarning: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
});
