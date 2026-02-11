/**
 * FitQuest Login Screen
 * 
 * Biometric-first authentication with passcode fallback.
 * Premium dark UI inspired by Figma design system.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import {
  GlassCard,
  GradientButton,
} from '../src/components/ui/GlassUI';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type AuthMode = 'biometric' | 'passcode' | 'email';

export default function LoginScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const {
    signIn,
    isLoading,
    isSignedIn,
    biometricCapability,
    biometricEnabled,
    authenticateWithBiometrics,
    verifyPasscode,
    hasPasscode,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('biometric');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [hasExistingPasscode, setHasExistingPasscode] = useState(false);

  const isDark = theme.isDark;
  const accentColor = '#CCFF00';

  // Animation values
  const pulseScale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // ── Init: Check biometric availability ──
  useEffect(() => {
    const init = async () => {
      const hasPc = await hasPasscode();
      setHasExistingPasscode(hasPc);

      if (biometricCapability?.isAvailable && biometricEnabled) {
        setMode('biometric');
        // Auto-prompt biometric on mount
        setTimeout(() => promptBiometric(), 500);
      } else if (hasPc) {
        setMode('passcode');
      } else {
        setMode('email');
      }
    };
    init();
  }, []);

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn) {
      router.replace('/dashboard');
    }
  }, [isSignedIn]);

  // ── Biometric Prompt ──
  const promptBiometric = async () => {
    setError('');
    pulseScale.value = withSequence(
      withTiming(1.1, { duration: 200 }),
      withTiming(1, { duration: 200 })
    );

    const result = await authenticateWithBiometrics('Unlock FitQuest');
    if (result.success) {
      // Auto sign-in with local credentials
      try {
        await signIn('user@fitquest.local', 'biometric-auth');
        router.replace('/dashboard');
      } catch {
        setError('Session expired. Please sign in again.');
        setMode('email');
      }
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      triggerShake();

      if (newAttempts >= 5) {
        setMode(hasExistingPasscode ? 'passcode' : 'email');
        setError('Too many failed attempts');
      }
    }
  };

  // ── Passcode Verification ──
  const handlePasscode = async () => {
    if (passcode.length < 4) return;
    setError('');
    setSubmitting(true);

    const result = await verifyPasscode(passcode);
    if (result.success) {
      try {
        await signIn('user@fitquest.local', 'passcode-auth');
        router.replace('/dashboard');
      } catch {
        setError('Authentication failed');
      }
    } else {
      triggerShake();
      setError('Incorrect passcode');
      setPasscode('');
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 10) {
        setMode('email');
        setError('Account locked. Sign in with email.');
      }
    }
    setSubmitting(false);
  };

  // ── Email Sign In ──
  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  // ──────────────────────────────────
  // RENDER
  // ──────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0A0E17' : '#F4F5F7' }]}>
      {/* Background glow */}
      <LinearGradient
        colors={[accentColor + '08', 'transparent', 'transparent']}
        style={styles.bgGlow}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Logo & Branding ── */}
          <Animated.View entering={FadeInDown.delay(100).duration(150)} style={styles.brandSection}>
            <View style={[styles.logoBg, { backgroundColor: accentColor + '12' }]}>
              <MaterialCommunityIcons name="lightning-bolt" size={48} color={accentColor} />
            </View>
            <Text style={[styles.appName, { color: theme.colors.text }]}>FitQuest</Text>
            <Text style={[styles.tagline, { color: theme.colors.textMuted }]}>
              Your Personal Fitness AI
            </Text>
          </Animated.View>

          {/* ── Biometric Mode ── */}
          {mode === 'biometric' && (
            <Animated.View entering={FadeInUp.delay(200).duration(150)} style={styles.authSection}>
              <TouchableOpacity onPress={promptBiometric} activeOpacity={0.8}>
                <Animated.View style={[styles.biometricBtn, pulseStyle]}>
                  <LinearGradient
                    colors={[accentColor + '20', accentColor + '08']}
                    style={styles.biometricGlow}
                  />
                  <MaterialCommunityIcons
                    name={Platform.OS === 'ios' ? 'face-recognition' : 'fingerprint'}
                    size={64}
                    color={accentColor}
                  />
                </Animated.View>
              </TouchableOpacity>
              <Text style={[styles.biometricLabel, { color: theme.colors.text }]}>
                Tap to unlock with {Platform.OS === 'ios' ? 'Face ID' : 'fingerprint'}
              </Text>

              {failedAttempts > 0 && failedAttempts < 5 && (
                <Animated.View entering={FadeIn.duration(150)}>
                  <Text style={[styles.attemptsText, { color: theme.colors.warning }]}>
                    {5 - failedAttempts} attempts remaining
                  </Text>
                </Animated.View>
              )}

              <View style={styles.altAuthRow}>
                {hasExistingPasscode && (
                  <TouchableOpacity
                    onPress={() => { setMode('passcode'); setError(''); }}
                    style={[styles.altBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                  >
                    <MaterialCommunityIcons name="dialpad" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>Use Passcode</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { setMode('email'); setError(''); }}
                  style={[styles.altBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                >
                  <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.textMuted} />
                  <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>Use Email</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* ── Passcode Mode ── */}
          {mode === 'passcode' && (
            <Animated.View entering={FadeInUp.delay(200).duration(150)} style={styles.authSection}>
              <Text style={[styles.modeTitle, { color: theme.colors.text }]}>Enter Passcode</Text>
              
              {/* Passcode dots */}
              <Animated.View style={[styles.dotsRow, shakeStyle]}>
                {[0, 1, 2, 3].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: passcode.length > i ? accentColor : 'transparent',
                        borderColor: passcode.length > i ? accentColor : theme.colors.textMuted,
                      },
                    ]}
                  />
                ))}
              </Animated.View>

              {/* Numpad */}
              <View style={styles.numpad}>
                {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ['', 0, 'del']].map((row, ri) => (
                  <View key={ri} style={styles.numpadRow}>
                    {row.map((digit, ci) => {
                      if (digit === '') return <View key={ci} style={styles.numpadBtn} />;
                      if (digit === 'del') {
                        return (
                          <TouchableOpacity
                            key={ci}
                            style={styles.numpadBtn}
                            onPress={() => setPasscode(p => p.slice(0, -1))}
                          >
                            <MaterialCommunityIcons name="backspace-outline" size={24} color={theme.colors.textMuted} />
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={ci}
                          style={[styles.numpadBtn, {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                          }]}
                          onPress={() => {
                            const next = passcode + String(digit);
                            setPasscode(next);
                            if (next.length === 4) {
                              setPasscode(next);
                              setTimeout(() => {
                                handlePasscode();
                              }, 100);
                            }
                          }}
                        >
                          <Text style={[styles.numpadDigit, { color: theme.colors.text }]}>{digit}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.altAuthRow}>
                {biometricCapability?.isAvailable && (
                  <TouchableOpacity
                    onPress={() => { setMode('biometric'); setError(''); }}
                    style={[styles.altBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                  >
                    <MaterialCommunityIcons name="fingerprint" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>Biometric</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { setMode('email'); setError(''); }}
                  style={[styles.altBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                >
                  <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.textMuted} />
                  <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>Email</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* ── Email Mode ── */}
          {mode === 'email' && (
            <Animated.View entering={FadeInUp.delay(200).duration(150)} style={styles.authSection}>
              <Text style={[styles.modeTitle, { color: theme.colors.text }]}>Welcome Back</Text>

              <Animated.View style={shakeStyle}>
                <View style={[styles.inputWrap, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
                }]}>
                  <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Email"
                    placeholderTextColor={theme.colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!submitting}
                  />
                </View>

                <View style={[styles.inputWrap, {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
                }]}>
                  <MaterialCommunityIcons name="lock-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Password"
                    placeholderTextColor={theme.colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!submitting}
                  />
                </View>
              </Animated.View>

              <TouchableOpacity
                style={[styles.emailBtn, { backgroundColor: accentColor, opacity: submitting ? 0.6 : 1 }]}
                onPress={handleEmailSignIn}
                disabled={submitting}
                activeOpacity={0.9}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.emailBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <View style={styles.registerRow}>
                <Text style={[styles.registerText, { color: theme.colors.textMuted }]}>
                  Don't have an account?{' '}
                </Text>
                <TouchableOpacity onPress={() => router.push('/register')}>
                  <Text style={[styles.registerLink, { color: accentColor }]}>Register</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.altAuthRow}>
                {biometricCapability?.isAvailable && (
                  <TouchableOpacity
                    onPress={() => { setMode('biometric'); setError(''); }}
                    style={[styles.altBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                  >
                    <MaterialCommunityIcons name="fingerprint" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>Biometric</Text>
                  </TouchableOpacity>
                )}
                {hasExistingPasscode && (
                  <TouchableOpacity
                    onPress={() => { setMode('passcode'); setError(''); }}
                    style={[styles.altBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                  >
                    <MaterialCommunityIcons name="dialpad" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>Passcode</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          )}

          {/* ── Error Display ── */}
          {error !== '' && (
            <Animated.View entering={FadeIn.duration(150)} style={styles.errorWrap}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_H * 0.4 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },

  // Brand
  brandSection: { alignItems: 'center', marginBottom: 40 },
  logoBg: { width: 88, height: 88, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appName: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  tagline: { fontSize: 14, fontWeight: '500', marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 },

  // Auth section
  authSection: { alignItems: 'center', gap: 16 },
  modeTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },

  // Biometric
  biometricBtn: {
    width: 120,
    height: 120,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  biometricGlow: { ...StyleSheet.absoluteFillObject },
  biometricLabel: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  attemptsText: { fontSize: 13, fontWeight: '600', marginTop: 8 },

  // Passcode dots
  dotsRow: { flexDirection: 'row', gap: 16, marginVertical: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },

  // Numpad
  numpad: { gap: 10, marginTop: 8 },
  numpadRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  numpadBtn: {
    width: 72,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numpadDigit: { fontSize: 24, fontWeight: '700' },

  // Email inputs
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    gap: 10,
    width: '100%',
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
  emailBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  emailBtnText: { color: '#000', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },

  registerRow: { flexDirection: 'row', marginTop: 16 },
  registerText: { fontSize: 14 },
  registerLink: { fontSize: 14, fontWeight: '700' },

  // Alt auth
  altAuthRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  altBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  altBtnText: { fontSize: 13, fontWeight: '600' },

  // Error
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginTop: 16,
  },
  errorText: { fontSize: 13, fontWeight: '600' },
});
