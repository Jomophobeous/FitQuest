/**
 * AnimatedFQLogoMark — Skia-powered animated FitQuest logo.
 *
 * Features:
 * - 60fps Skia Canvas rendering
 * - Pulse glow animation (2.5s cycle)
 * - Tap to rotate 360° + 1.1x scale bounce
 * - Theme-aware accent color
 * - Fallback to static FQLogoMark on Skia error
 */
import React, { useCallback } from 'react';
import { TouchableWithoutFeedback, View } from 'react-native';
import { Canvas, Circle, Group, Line as SkiaLine, Path, useCanvasRef, vec } from '@shopify/react-native-skia';
import {
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  useDerivedValue,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import FQLogoMark from './FQLogoMark';

/** Error boundary for Skia fallback */
class SkiaErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface Props {
  size?: 56 | 80 | 96 | 120;
  showGlow?: boolean;
}

export default function AnimatedFQLogoMark({ size = 80, showGlow = true }: Props) {
  const { theme } = useTheme();
  // Animation values
  const pulseOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  // Start pulse on mount
  React.useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1250, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
      false,
    );
  }, [pulseOpacity]);

  // Tap handler: 360° rotation + scale bounce
  const handleTap = useCallback(() => {
    rotation.value = withTiming(rotation.value + 2 * Math.PI, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withSequence(
      withSpring(1.1, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 10, stiffness: 150 }),
    );
  }, [rotation, scale]);

  // Derived transform for the logo group
  const transform = useDerivedValue(() => [
    { translateX: size / 2 },
    { translateY: size / 2 },
    { rotate: rotation.value },
    { scale: scale.value },
    { translateX: -size / 2 },
    { translateY: -size / 2 },
  ]);

  // Scale factor from 512 viewBox to actual size
  const s = size / 512;
  const accent = theme.colors.accent;

  return (
    <SkiaErrorBoundary fallback={<FQLogoMark size={size} showGlow={showGlow} />}>
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={{ width: size, height: size }}>
          <Canvas style={{ width: size, height: size }}>
            {/* Pulse glow */}
            {showGlow && <Circle cx={size / 2} cy={size / 2} r={size * 0.42} color={accent} opacity={pulseOpacity} />}

            {/* Logo group with rotation/scale transform */}
            <Group transform={transform}>
              {/* Shared vertical spine */}
              <SkiaLine
                p1={vec(160 * s, 120 * s)}
                p2={vec(160 * s, 392 * s)}
                color={accent}
                strokeWidth={10 * s}
                style="stroke"
                strokeCap="round"
              />

              {/* F — top horizontal arm */}
              <SkiaLine
                p1={vec(160 * s, 120 * s)}
                p2={vec(280 * s, 120 * s)}
                color={accent}
                strokeWidth={10 * s}
                style="stroke"
                strokeCap="round"
              />

              {/* F — middle horizontal arm */}
              <SkiaLine
                p1={vec(160 * s, 240 * s)}
                p2={vec(260 * s, 240 * s)}
                color={accent}
                strokeWidth={10 * s}
                style="stroke"
                strokeCap="round"
              />

              {/* Linkage: F-arm → Q-arc */}
              <SkiaLine
                p1={vec(260 * s, 240 * s)}
                p2={vec(290 * s, 200 * s)}
                color={accent}
                strokeWidth={8 * s}
                style="stroke"
                strokeCap="round"
              />

              {/* Q — circular arc */}
              <Path
                path={`M ${290 * s} ${160 * s} C ${370 * s} ${160 * s}, ${400 * s} ${210 * s}, ${400 * s} ${270 * s} C ${400 * s} ${340 * s}, ${360 * s} ${380 * s}, ${290 * s} ${380 * s} L ${160 * s} ${392 * s}`}
                color={accent}
                strokeWidth={10 * s}
                style="stroke"
                strokeCap="round"
                strokeJoin="round"
              />

              {/* Q — top connection to F arm */}
              <SkiaLine
                p1={vec(280 * s, 120 * s)}
                p2={vec(290 * s, 160 * s)}
                color={accent}
                strokeWidth={8 * s}
                style="stroke"
                strokeCap="round"
              />

              {/* Q — tail */}
              <SkiaLine
                p1={vec(360 * s, 340 * s)}
                p2={vec(420 * s, 410 * s)}
                color={accent}
                strokeWidth={10 * s}
                style="stroke"
                strokeCap="round"
              />

              {/* Accent nodes */}
              <Circle cx={160 * s} cy={120 * s} r={6 * s} color={accent} />
              <Circle cx={280 * s} cy={120 * s} r={5 * s} color={accent} opacity={0.8} />
              <Circle cx={160 * s} cy={240 * s} r={5 * s} color={accent} opacity={0.7} />
              <Circle cx={260 * s} cy={240 * s} r={5 * s} color={accent} opacity={0.7} />
              <Circle cx={160 * s} cy={392 * s} r={6 * s} color={accent} />
              <Circle cx={420 * s} cy={410 * s} r={6 * s} color={accent} />
            </Group>
          </Canvas>
        </View>
      </TouchableWithoutFeedback>
    </SkiaErrorBoundary>
  );
}
