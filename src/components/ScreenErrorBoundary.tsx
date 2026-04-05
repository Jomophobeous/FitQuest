/**
 * ScreenErrorBoundary — Per-screen error boundary
 *
 * Wraps individual screens so a crash in one doesn't take down
 * the entire app. Shows the screen name, error message, and
 * offers both "Try Again" and "Go Back" actions.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { logCrash } from '../services/telemetry';
import { typography, spacing, radius } from '../design/theme-system';

interface ScreenErrorBoundaryProps {
  children: React.ReactNode;
  screenName: string;
  onGoBack?: () => void;
}

interface ScreenErrorBoundaryState {
  hasError: boolean;
  message: string;
}

function ScreenFallback({
  screenName,
  message,
  onReset,
  onGoBack,
}: {
  screenName: string;
  message: string;
  onReset: () => void;
  onGoBack?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]} accessibilityRole="alert">
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.error + '15' }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={40} color={theme.colors.error} />
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>{screenName} crashed</Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>{message}</Text>

      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: theme.colors.accent }]}
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Try Again</Text>
      </TouchableOpacity>

      {onGoBack && (
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.colors.border }]}
          onPress={onGoBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.secondaryBtnText, { color: theme.colors.textSecondary }]}>Go Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export class ScreenErrorBoundary extends React.Component<ScreenErrorBoundaryProps, ScreenErrorBoundaryState> {
  state: ScreenErrorBoundaryState = {
    hasError: false,
    message: 'An unexpected error occurred.',
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logCrash(error, {
      screen: this.props.screenName,
      boundary: 'screen',
      componentStack: info.componentStack?.split('\n').slice(0, 5).join('\n'),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, message: 'An unexpected error occurred.' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ScreenFallback
          screenName={this.props.screenName}
          message={this.state.message}
          onReset={this.handleReset}
          onGoBack={this.props.onGoBack}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.sizes.h3,
    fontWeight: '800',
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  message: {
    fontSize: typography.sizes.label,
    textAlign: 'center',
    marginBottom: spacing[6],
    lineHeight: 18,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3.5],
    borderRadius: radius.lg,
    gap: spacing[2],
    width: '100%',
    maxWidth: 240,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: typography.sizes.bodyMid,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: spacing[3],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
  },
});
