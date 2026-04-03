/**
 * Signature Splash Screen — Lightweight fallback (no Skia dependency).
 *
 * Visual: Black/dark-blue gradient → animated "FQ" text mark → nothing else.
 *
 * State machine: ANIMATING → animComplete + dbReady → EXIT
 * Exit: both conditions true OR hard timeout (5s). No dual triggers.
 *
 * Note: Skia Canvas was removed to support Expo Go / dev-client workflows.
 * Re-introduce Skia GPU rendering via dev-client build when ready.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useDatabase } from '../../context/DatabaseContext';
import { BiometricAuthService } from '../../security/BiometricAuth';
import { useSplashAnimation } from './useSplashAnimation';

// Accent color
const ACCENT = '#00FFC6';
const BG_TOP = '#0B0B0F';

const DB_TIMEOUT_MS = 5000;

export default function SplashScreen() {
  const router = useRouter();
  const hasNavigated = useRef(false);
  const { isReady, onboardingComplete } = useDatabase();

  // ── State machine: two conditions gate exit ──
  const [animComplete, setAnimComplete] = useState(false);

  const doNavigate = useCallback(async () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    try {
      if (!isReady || !onboardingComplete) {
        router.replace('/onboarding');
        return;
      }

      const bioAuth = BiometricAuthService.getInstance();
      const hasPasscode = await bioAuth.hasPasscode();
      const bioCapability = await bioAuth.initialize();
      const bioEnabled = bioCapability.isAvailable && (await bioAuth.isBiometricEnabled());

      if (hasPasscode || bioEnabled) {
        router.replace('/login');
      } else {
        router.replace('/dashboard');
      }
    } catch {
      router.replace(onboardingComplete ? '/login' : '/onboarding');
    }
  }, [isReady, onboardingComplete, router]);

  // Animation callback — only sets state, no navigation logic
  const onAnimationComplete = useCallback(() => {
    setAnimComplete(true);
  }, []);

  // ── Single exit gate: requires BOTH animComplete AND isReady ──
  useEffect(() => {
    if (animComplete && isReady && !hasNavigated.current) {
      doNavigate();
    }
  }, [animComplete, isReady, doNavigate]);

  // Hard fallback: if DB never becomes ready, force to onboarding
  useEffect(() => {
    const t = setTimeout(() => {
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace('/onboarding');
      }
    }, DB_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [router]);

  const {
    glowIntensity,
    logoScale,
    overallOpacity,
    skip,
    SKIP_LOCK_MS,
  } = useSplashAnimation(onAnimationComplete);

  // Enable skip after lock window (0.8s)
  const skipLocked = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => { skipLocked.current = false; }, SKIP_LOCK_MS);
    return () => clearTimeout(t);
  }, [SKIP_LOCK_MS]);

  const handlePress = useCallback(() => {
    if (!skipLocked.current) skip();
  }, [skip]);

  // Animated wrapper: exit fade (opacity 1→0) + scale pulse/exit
  const scaleStyle = useAnimatedStyle(() => ({
    opacity: overallOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    textShadowRadius: glowIntensity.value * 20,
  }));

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      {/* Background */}
      <View style={StyleSheet.absoluteFill} />

      {/* FQ mark — simple text fallback */}
      <Animated.View style={[styles.markWrap, scaleStyle]}>
        <Animated.Text style={[styles.mark, glowStyle]}>
          FQ
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_TOP,
  },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontSize: 72,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 8,
    textShadowColor: ACCENT,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
});
