import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ProgressBarProps {
  progress: number; // 0..1
  height?: number;
  variant?: 'progress' | 'energy'; // Different colors
  showGlow?: boolean; // Glow effect in dark mode
}

export default function ProgressBar({
  progress,
  height = 6,
  variant = 'progress',
  showGlow = true,
}: ProgressBarProps) {
  const { theme } = useTheme();
  const animated = useRef(new Animated.Value(0)).current;

  const accentColor = variant === 'energy' ? theme.colors.accent2 : theme.colors.accent;
  const backgroundColor = theme.isDark ? theme.colors.surfaceVariant : theme.colors.border;

  useEffect(() => {
    const clamped = Math.max(0, Math.min(progress, 1));
    Animated.timing(animated, {
      toValue: clamped,
      duration: theme.isDark ? 500 : 200,
      useNativeDriver: false,
    }).start();
  }, [progress, animated, theme.isDark]);

  const width = animated.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const shadowOpacity = theme.isDark && showGlow ? 0.3 : 0;

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor,
          borderRadius: height / 2,
          overflow: 'hidden',
        },
      ]}
    >
      <Animated.View
        style={[
          styles.bar,
          {
            width,
            height: '100%',
            backgroundColor: accentColor,
            borderRadius: height / 2,
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: shadowOpacity,
            shadowRadius: 4,
            elevation: 3,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
  },
});
