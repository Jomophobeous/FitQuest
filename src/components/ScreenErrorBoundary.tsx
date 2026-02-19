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
import { logError } from '../services/telemetry';

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
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      accessibilityRole="alert"
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.error + '15' }]}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={40}
          color={theme.colors.error}
        />
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>
        {screenName} crashed
      </Text>
      <Text style={[styles.message, { color: theme.colors.textMuted }]}>
        {message}
      </Text>

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
          <Text style={[styles.secondaryBtnText, { color: theme.colors.textSecondary }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export class ScreenErrorBoundary extends React.Component<
  ScreenErrorBoundaryProps,
  ScreenErrorBoundaryState
> {
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
    logError(error, {
      screen: this.props.screenName,
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
    padding: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    width: '100%',
    maxWidth: 240,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
