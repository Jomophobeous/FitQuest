/**
 * P7 — Lightweight Confetti Celebration
 *
 * Renders a burst of emoji particles when a workout is completed.
 * Uses react-native-reanimated for smooth 60fps animation.
 * Self-cleaning: hides automatically after the animation.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { typography } from '../design/theme-system';

const EMOJIS = ['🎉', '⭐', '💪', '🔥', '✨', '🏆', '🥇', '💥'];
const PARTICLE_COUNT = 18;
const DURATION_MS = 2200;

interface ConfettiProps {
  /** Show confetti burst */
  active: boolean;
  /** Called when the animation completes */
  onComplete?: () => void;
}

interface Particle {
  id: number;
  emoji: string;
  startX: number; // % of screen width
  startY: number; // % of screen height (top)
  endX: number; // lateral drift
  endY: number; // fall distance
  rotation: number; // degrees
  delay: number; // ms
  scale: number;
}

function generateParticles(_width: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    emoji: EMOJIS[i % EMOJIS.length]!,
    startX: 20 + Math.random() * 60, // 20-80% width // non-security
    startY: -5 - Math.random() * 15, // above screen // non-security
    endX: (Math.random() - 0.5) * 40, // ±20% drift // non-security
    endY: 80 + Math.random() * 40, // fall 80-120% // non-security
    rotation: Math.random() * 720 - 360, // ±360° // non-security
    delay: Math.random() * 400, // stagger 0-400ms // non-security
    scale: 0.6 + Math.random() * 0.8, // 0.6-1.4× // non-security
  }));
}

function ConfettiParticle({ particle }: { particle: Particle }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      particle.delay,
      withTiming(particle.scale, { duration: 200, easing: Easing.out(Easing.back(2)) }),
    );
    translateY.value = withDelay(
      particle.delay,
      withTiming(particle.endY, { duration: DURATION_MS, easing: Easing.in(Easing.quad) }),
    );
    translateX.value = withDelay(
      particle.delay,
      withTiming(particle.endX, { duration: DURATION_MS, easing: Easing.inOut(Easing.sin) }),
    );
    rotate.value = withDelay(particle.delay, withTiming(particle.rotation, { duration: DURATION_MS }));
    opacity.value = withDelay(particle.delay + DURATION_MS * 0.6, withTiming(0, { duration: DURATION_MS * 0.4 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated SharedValues + particle props are stable on mount
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${particle.startX}%`,
          top: `${particle.startY}%`,
        },
        animStyle,
      ]}
    >
      <Text style={{ fontSize: typography.sizes.h2 }}>{particle.emoji}</Text>
    </Animated.View>
  );
}

function ConfettiBurst({ active, onComplete }: ConfettiProps) {
  const { width } = useWindowDimensions();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setParticles(generateParticles(width));
      setVisible(true);

      const timer = setTimeout(() => {
        // debounce
        setVisible(false);
        setParticles([]);
        onComplete?.();
      }, DURATION_MS + 600);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onComplete is an optional callback prop; width used only for particle generation on activation
  }, [active]);

  if (!visible || particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} particle={p} />
      ))}
    </View>
  );
}

export default React.memo(ConfettiBurst);
