/**
 * FitQuest Splash Screen
 *
 * Premium branded loading screen with cinematic animation sequence.
 * Handles auth token check + routing to login or dashboard.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions, PixelRatio } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  withRepeat,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import FQLogoMark from '../src/components/FQLogoMark';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useDatabase } from '../src/context/DatabaseContext';
import { BiometricAuthService } from '../src/security/BiometricAuth';
import { darkTheme as theme, typography, spacing } from '../src/design/theme-system';

const { width, height } = Dimensions.get('window');
const scale = PixelRatio.getFontScale();
const MIN_SPLASH_MS = 1800;

export default function Splash() {
  const router = useRouter();
  const hasNavigated = useRef(false);
  const animDone = useRef(false);
  const { isReady, onboardingComplete, userProfile } = useDatabase();

  // Animation values — cinematic sequence
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoRotateY = useSharedValue(-90);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const taglineOpacity = useSharedValue(0);
  const taglineScale = useSharedValue(0.8);
  const progressWidth = useSharedValue(0);
  const progressGlow = useSharedValue(0);
  const ringRotation = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const orb1Opacity = useSharedValue(0);
  const orb2Opacity = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const versionOpacity = useSharedValue(0);

  useEffect(() => {
    // Phase 1: Background orbs fade in (0ms)
    orb1Opacity.value = withTiming(0.06, { duration: 800 });
    orb2Opacity.value = withDelay(200, withTiming(0.06, { duration: 800 }));

    // Phase 2: Ring appears with scale-up (200ms)
    ringOpacity.value = withDelay(200, withTiming(0.8, { duration: 400 }));
    ringScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
    ringRotation.value = withDelay(
      200,
      withRepeat(withTiming(360, { duration: 3000, easing: Easing.linear }), -1, false),
    );

    // Phase 3: Logo 3D flip entrance (400ms)
    logoOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));
    logoRotateY.value = withDelay(400, withSpring(0, { damping: 14, stiffness: 100 }));
    logoScale.value = withDelay(
      400,
      withSequence(withSpring(1.1, { damping: 8, stiffness: 120 }), withSpring(1, { damping: 12, stiffness: 100 })),
    );

    // Phase 3b: Gentle pulse on logo
    pulseScale.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );

    // Phase 4: Brand text rises in (700ms)
    textOpacity.value = withDelay(700, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
    textTranslateY.value = withDelay(700, withSpring(0, { damping: 14, stiffness: 90 }));

    // Phase 5: Tagline appears with scale (900ms)
    taglineOpacity.value = withDelay(900, withTiming(1, { duration: 300 }));
    taglineScale.value = withDelay(900, withSpring(1, { damping: 12, stiffness: 100 }));

    // Phase 6: Progress bar with shimmer (1000ms)
    progressWidth.value = withDelay(
      500,
      withTiming(100, { duration: 2000, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
    );
    progressGlow.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );

    // Shimmer across progress bar
    shimmer.value = withDelay(800, withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false));

    // Version text
    versionOpacity.value = withDelay(1200, withTiming(1, { duration: 400 }));

    // Auth check + navigate
    let mounted = true;
    const DB_TIMEOUT_MS = 5000; // Max wait for DB before fallback navigation
    const checkAuth = async () => {
      try {
        // Wait for minimum animation duration
        await new Promise((res) => setTimeout(res, MIN_SPLASH_MS)); // animation
        animDone.current = true;

        if (!mounted || hasNavigated.current) return;

        // DB not ready yet — wait with a hard timeout to prevent stuck splash
        if (!isReady) {
          // Set a safety timeout: if DB still not ready after DB_TIMEOUT_MS, navigate anyway
          const safetyTimer = setTimeout(() => { // animation
            if (mounted && !hasNavigated.current) {
              hasNavigated.current = true;
              router.replace('/onboarding');
            }
          }, DB_TIMEOUT_MS);
          // The effect will re-run when isReady changes, clearing this timeout
          return () => clearTimeout(safetyTimer);
        }

        hasNavigated.current = true;

        // First-time user: no onboarding completed → show onboarding
        if (!onboardingComplete) {
          if (mounted) router.replace('/onboarding');
          return;
        }

        // Returning user: check biometric/passcode auth
        const bioAuth = BiometricAuthService.getInstance();
        const hasLocalAuth = await bioAuth.hasPasscode();
        const bioCapability = await bioAuth.initialize();
        const bioEnabled = bioCapability.isAvailable && (await bioAuth.isBiometricEnabled());

        if (!mounted) return;

        if (hasLocalAuth || bioEnabled) {
          router.replace('/login');
        } else {
          router.replace('/dashboard');
        }
      } catch (authErr) {
        // Auth check failed — route to login (safe default) rather than bypassing auth
        if (mounted && !hasNavigated.current) {
          hasNavigated.current = true;
          if (onboardingComplete) {
            router.replace('/login');
          } else {
            router.replace('/onboarding');
          }
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [isReady, onboardingComplete]);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value * pulseScale.value },
      { perspective: 800 },
      { rotateY: `${logoRotateY.value}deg` },
    ],
    opacity: logoOpacity.value,
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const taglineAnimStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ scale: taglineScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }, { scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as any,
  }));

  const progressGlowStyle = useAnimatedStyle(() => ({
    opacity: progressGlow.value,
  }));

  const orb1Style = useAnimatedStyle(() => ({
    opacity: orb1Opacity.value,
  }));

  const orb2Style = useAnimatedStyle(() => ({
    opacity: orb2Opacity.value,
  }));

  const versionStyle = useAnimatedStyle(() => ({
    opacity: versionOpacity.value,
  }));

  return (
    <ScreenErrorBoundary screenName="Splash" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <View style={styles.container}>
        <LinearGradient
          colors={[theme.colors.background, theme.colors.background, theme.colors.background]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Decorative background orbs with animation */}
        <Animated.View style={[styles.orb, styles.orbTopRight, orb1Style]} />
        <Animated.View style={[styles.orb, styles.orbBottomLeft, orb2Style]} />
        <Animated.View style={[styles.orb, styles.orbCenter, orb2Style]} />

        {/* Logo section */}
        <View style={styles.centerContent}>
          {/* Outer ring — rotating gradient */}
          <Animated.View style={[styles.ringOuter, ringStyle]}>
            <LinearGradient
              colors={[theme.colors.accent, '#10B98100', theme.colors.accentDark, '#10B98100']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ringGradient}
            />
          </Animated.View>

          {/* Second ring — counter subtle */}
          <Animated.View style={[styles.ringInner, ringStyle, { transform: [{ rotate: '-120deg' }] }]}>
            <LinearGradient
              colors={['#10B98140', '#10B98100', '#10B98120', '#10B98100']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.ringGradientInner}
            />
          </Animated.View>

          {/* FQ Logo Mark with 3D flip */}
          <Animated.View style={[styles.logoWrap, logoAnimStyle]}>
            <FQLogoMark size={120} showGlow={false} />
          </Animated.View>

          {/* Brand name with rise-up */}
          <Animated.View style={textAnimStyle}>
            <Text style={styles.brandName}>FITQUEST</Text>
            <Text style={styles.brandVersion}>2.0</Text>
          </Animated.View>
          <Animated.View style={taglineAnimStyle}>
            <Text style={styles.tagline}>Upgrade Your System</Text>
          </Animated.View>
        </View>

        {/* Progress bar with glow effect */}
        <View style={styles.progressSection}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]}>
              <LinearGradient
                colors={[theme.colors.accent, theme.colors.accentDark, theme.colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            {/* Glow dot at progress tip */}
            <Animated.View style={[styles.progressDot, progressStyle, progressGlowStyle]} />
          </View>
          <Animated.View style={textAnimStyle}>
            <Text style={styles.loadingText}>Preparing your journey</Text>
          </Animated.View>
        </View>

        {/* Powered by — subtle footer */}
        <Animated.View style={[styles.versionWrap, versionStyle]}>
          <Text style={styles.versionText}>Powered by AI</Text>
        </Animated.View>
      </View>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E17',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringGradient: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: '#10B98120',
  },
  ringInner: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringGradientInner: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: '#10B98110',
  },
  logoWrap: {
    marginBottom: spacing[7],
  },
  brandName: {
    fontSize: Math.min(42, 42 / scale),
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 3,
  },
  brandVersion: {
    fontSize: Math.min(12, 12 / scale),
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
    letterSpacing: 6,
    marginTop: spacing[0.5],
  },
  tagline: {
    fontSize: Math.min(13, 13 / scale),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: spacing[2.5],
    letterSpacing: 5,
    textTransform: 'uppercase',
  },
  orb: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: '#10B981',
  },
  orbTopRight: {
    top: -60,
    right: -60,
    width: 200,
    height: 200,
  },
  orbBottomLeft: {
    bottom: -40,
    left: -80,
    width: 200,
    height: 200,
  },
  orbCenter: {
    top: height * 0.35,
    left: width * 0.3,
    width: 120,
    height: 120,
  },
  progressSection: {
    paddingHorizontal: spacing[12],
    paddingBottom: spacing[15],
    alignItems: 'center',
    gap: spacing[3.5],
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressDot: {
    position: 'absolute',
    right: -3,
    top: -2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  loadingText: {
    fontSize: Math.min(12, 12 / scale),
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  versionWrap: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
  versionText: {
    fontSize: typography.sizes.captionSm, 
    color: 'rgba(255,255,255,0.15)',
    fontWeight: '500',
  },
});
