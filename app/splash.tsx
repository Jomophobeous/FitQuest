/**
 * FitQuest Splash Screen
 * 
 * Premium branded loading screen with animated logo and progress.
 * Handles auth token check + routing to login or dashboard.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
  FadeInUp,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store/useAuthStore';

const { width, height } = Dimensions.get('window');

export default function Splash() {
  const router = useRouter();
  const setToken = useAuthStore(s => s.setToken);
  const hasNavigated = useRef(false);

  // Animations
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const ringRotation = useSharedValue(0);

  useEffect(() => {
    // Logo entrance
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withSequence(
      withTiming(1.15, { duration: 500, easing: Easing.out(Easing.back(1.5)) }),
      withSpring(1, { damping: 8, stiffness: 120 })
    );

    // Rotating ring
    ringRotation.value = withTiming(360, { duration: 2000, easing: Easing.linear });

    // Text
    textOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));

    // Progress bar
    progressWidth.value = withDelay(300, withTiming(100, { duration: 1500, easing: Easing.inOut(Easing.ease) }));

    // Auth check + navigate
    const checkAuth = async () => {
      try {
        // Give animations time to play
        await new Promise(res => setTimeout(res, 1800));

        const token = await SecureStore.getItemAsync('jwt');
        if (hasNavigated.current) return;
        hasNavigated.current = true;

        if (token) {
          setToken(token);
          router.replace('/');
        } else {
          router.replace('/login');
        }
      } catch {
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.replace('/login');
        }
      }
    };

    checkAuth();
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const textAnimStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
    opacity: logoOpacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as any,
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A0E17', '#111827', '#0A0E17']}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative background orbs */}
      <View style={[styles.orb, styles.orbTopRight]} />
      <View style={[styles.orb, styles.orbBottomLeft]} />

      {/* Logo section */}
      <View style={styles.centerContent}>
        {/* Animated ring behind logo */}
        <Animated.View style={[styles.ringOuter, ringStyle]}>
          <LinearGradient
            colors={['#10B981', '#10B98100', '#10B98140', '#10B98100']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ringGradient}
          />
        </Animated.View>

        {/* Logo icon */}
        <Animated.View style={[styles.logoWrap, logoAnimStyle]}>
          <LinearGradient
            colors={['#10B98130', '#10B98108']}
            style={styles.logoCircle}
          >
            <MaterialCommunityIcons name="dumbbell" size={48} color="#10B981" />
          </LinearGradient>
        </Animated.View>

        {/* Brand name */}
        <Animated.View style={textAnimStyle}>
          <Text style={styles.brandName}>FitQuest</Text>
          <Text style={styles.tagline}>Body & Mind</Text>
        </Animated.View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <Animated.View style={textAnimStyle}>
          <Text style={styles.loadingText}>Loading your fitness journey...</Text>
        </Animated.View>
      </View>

      {/* Version */}
      <Animated.View style={[styles.versionWrap, textAnimStyle]}>
        <Text style={styles.versionText}>v2.0</Text>
      </Animated.View>
    </View>
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
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#10B98125',
  },
  logoWrap: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B98120',
  },
  brandName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  orb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#10B981',
    opacity: 0.04,
  },
  orbTopRight: {
    top: -60,
    right: -60,
  },
  orbBottomLeft: {
    bottom: -40,
    left: -80,
  },
  progressSection: {
    paddingHorizontal: 48,
    paddingBottom: 60,
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  versionWrap: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
  versionText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    fontWeight: '500',
  },
});
