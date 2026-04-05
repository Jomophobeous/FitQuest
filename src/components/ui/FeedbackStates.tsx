/**
 * Feedback State Components — Empty, Error, and Loading micro-states.
 *
 * Usage:
 *   <EmptyState icon="dumbbell" message="No workouts yet" action="Start First Session" onAction={...} />
 *   <InlineError message="Failed to load data" onRetry={...} />
 */

import React, { memo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../design/theme-system';
import { MOTION } from '../../design/motion';
import ThemedText from '../ThemedText';
import { GradientButton } from './GlassUI';

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  message: string;
  action?: string;
  onAction?: () => void;
}

export const EmptyState = memo(function EmptyState({ icon, message, action, onAction }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(MOTION.base)}
      style={[styles.emptyContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      accessibilityRole="text"
      accessibilityLabel={message}
    >
      <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.textMuted + '12' }]}>
        <MaterialCommunityIcons name={icon} size={32} color={theme.colors.textMuted} />
      </View>
      <ThemedText variant="body" color="muted" style={styles.emptyMessage}>
        {message}
      </ThemedText>
      {action && onAction && <GradientButton title={action} onPress={onAction} size="sm" style={styles.emptyAction} />}
    </Animated.View>
  );
});

// ============================================
// INLINE ERROR
// ============================================

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
}

export const InlineError = memo(function InlineError({ message, onRetry }: InlineErrorProps) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(MOTION.fast)}
      style={[
        styles.errorContainer,
        { backgroundColor: theme.colors.error + '10', borderColor: theme.colors.error + '30' },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.errorInner}>
        <MaterialCommunityIcons name="alert-circle-outline" size={20} color={theme.colors.error} />
        <ThemedText variant="bodySmall" color="primary" style={styles.errorMessage}>
          {message}
        </ThemedText>
      </View>
      {onRetry && (
        <GradientButton title="Retry" onPress={onRetry} size="sm" variant="warning" style={styles.errorRetry} />
      )}
    </Animated.View>
  );
});

// ============================================
// LOADING PLACEHOLDER (Inline micro-state)
// ============================================

interface LoadingPlaceholderProps {
  message?: string;
}

export const LoadingPlaceholder = memo(function LoadingPlaceholder({ message }: LoadingPlaceholderProps) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeIn.duration(MOTION.fast)} style={styles.loadingContainer}>
      <ActivityIndicator size="small" color={theme.colors.accent} />
      {message && (
        <ThemedText variant="caption" color="muted" style={styles.loadingMessage}>
          {message}
        </ThemedText>
      )}
    </Animated.View>
  );
});

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
    borderRadius: radius.xl,
    borderWidth: 1,
    marginHorizontal: spacing[4],
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  emptyMessage: {
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  emptyAction: {
    marginTop: spacing[4],
    minWidth: 160,
  },

  // Inline error
  errorContainer: {
    marginHorizontal: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  errorInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  errorMessage: {
    flex: 1,
  },
  errorRetry: {
    marginTop: spacing[2],
    alignSelf: 'flex-start',
  },

  // Loading placeholder
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
  },
  loadingMessage: {
    marginLeft: spacing[1],
  },
});
