import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { logCrash } from '../services/telemetry';
import { typography } from '../design/theme-system';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

function createFallbackStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing[6],
    },
    title: {
      fontSize: typography.sizes.h3,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: theme.spacing[2],
      textAlign: 'center',
    },
    message: {
      fontSize: typography.sizes.label,
      color: theme.colors.textMuted,
      textAlign: 'center',
      marginBottom: theme.spacing[4],
    },
    button: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing[5],
      paddingVertical: theme.spacing[3],
      borderRadius: theme.borderRadius.lg,
    },
    buttonText: {
      color: theme.colors.background,
      fontSize: typography.sizes.bodySmall,
      fontWeight: '700',
    },
  });
}

function ErrorFallback({ message, onReset }: { message: string; onReset: () => void }) {
  const { theme } = useTheme();
  const styles = createFallbackStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={onReset}>
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: 'An unexpected error occurred.',
  };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logCrash(error, {
      componentStack: info.componentStack?.split('\n').slice(0, 5).join('\n'),
      boundary: 'global',
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, message: 'An unexpected error occurred.' });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback message={this.state.message} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
