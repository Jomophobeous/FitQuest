import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

// Animated wrapper for react-native-svg's Circle
const AnimatedCircle = Animated.createAnimatedComponent(Circle as any);

interface Props {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0..1
  label?: string;
  sub?: string;
  variant?: 'progress' | 'energy'; // Different accent colors
}

export default function StatRing({ 
  size = 84, 
  strokeWidth = 8, 
  progress, 
  label, 
  sub,
  variant = 'progress',
}: Props) {
  const { theme } = useTheme();
  const isDark = theme.isDark;
  
  // Select accent color based on variant
  const accentColor = variant === 'energy' ? theme.colors.accent2 : theme.colors.accent;
  const backTrackColor = isDark ? theme.colors.surfaceVariant : theme.colors.border;
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const clamped = Math.max(0, Math.min(progress, 1));
    Animated.timing(animated, { 
      toValue: clamped, 
      duration: isDark ? 700 : 250, // Shorter animation in light mode
      useNativeDriver: false 
    }).start();
  }, [progress, animated, isDark]);

  const strokeDashoffset = animated.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {!!isDark && (
          <Defs>
            <RadialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={accentColor} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </RadialGradient>
          </Defs>
        )}
        
        {/* Background track */}
        <Circle
          stroke={backTrackColor}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Glow effect in dark mode only */}
        {!!isDark && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius + 4}
            fill="url(#glowGradient)"
          />
        )}
        
        {/* Progress track */}
        <AnimatedCircle
          stroke={accentColor}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset as any}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      
      {!!label && (
        <Text style={[styles.label, { color: theme.colors.text, fontWeight: isDark ? '700' : '600' }]}>
          {label}
        </Text>
      )}
      
      {!!sub && (
        <Text style={[styles.sub, { color: theme.colors.textMuted }]}>
          {sub}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { 
    marginTop: 8, 
    fontSize: 16, 
    fontWeight: '700', 
    textAlign: 'center' 
  },
  sub: { 
    fontSize: 13, 
    marginTop: 2 
  },
});
