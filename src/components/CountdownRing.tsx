/**
 * CountdownRing — Smooth SVG countdown ring for rest timers.
 * Uses react-native-svg for pixel-perfect circular progress.
 * Progress depletes from full → empty as time passes.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface CountdownRingProps {
  /** 0 → 1: fraction of time elapsed (0 = just started, 1 = done) */
  progress: number;
  /** Outer diameter in px */
  size?: number;
  /** Ring thickness */
  strokeWidth?: number;
  /** Ring colour (default: theme.colors.warning) */
  color?: string;
  /** Track colour (default: subtle white/black) */
  trackColor?: string;
  /** Content rendered inside the ring */
  children?: React.ReactNode;
}

export default function CountdownRing({
  progress,
  size = 200,
  strokeWidth = 10,
  color,
  trackColor,
  children,
}: CountdownRingProps) {
  const { theme } = useTheme();

  const ringColor = color ?? theme.colors.warning;
  const bgColor = trackColor ?? (theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)');

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Ring depletes as progress grows (0 = full ring, 1 = empty ring)
  const clampedProgress = Math.max(0, Math.min(progress, 1));
  const strokeDashoffset = circumference * clampedProgress;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <Circle cx={center} cy={center} r={radius} stroke={bgColor} strokeWidth={strokeWidth} fill="none" />
        {/* Countdown arc — starts at 12 o'clock, depletes clockwise */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      {/* Centre content (timer digits, etc.) */}
      <View style={[styles.content, { width: size, height: size }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
