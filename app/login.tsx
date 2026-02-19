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
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import {
  GlassCard,
  GradientButton,
} from '../src/components/ui/GlassUI';
import { rateLimiter, RATE_LIMITS, formatRetryAfter } from '../src/utils/rateLimiter';
import { getApiBaseUrl } from '../src/services/apiBaseUrl';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type AuthMode = 'biometric' | 'passcode' | 'email';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const {
    signIn,
    signInWithGoogleToken,
    signInWithAppleToken,
    isLoading,
    isSignedIn,
    biometricCapability,
    biometricEnabled,
    authenticateWithBiometrics,
    verifyPasscode,
    hasPasscode,
    resumeSession,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('biometric');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState(false);
  const [hasExistingPasscode, setHasExistingPasscode] = useState(false);
  const [appleSignInAvailable, setAppleSignInAvailable] = useState<boolean>(false);

  const androidOnlyMode = String(process.env.EXPO_PUBLIC_OAUTH_ANDROID_ONLY || '').toLowerCase() === 'true';

  const googleClientConfigReady = !!(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  );

  const [, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  const isDark = theme.isDark;
  const accentColor = theme.colors.accent;
  const backendConfigured = !!getApiBaseUrl();

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

      // If no backend configured and no existing auth, go directly to onboarding
      const backendExists = !!getApiBaseUrl();
      if (!backendExists && !hasPc && !(biometricCapability?.isAvailable && biometricEnabled)) {
        // First-time offline user - skip login entirely
        router.replace('/onboarding');
        return;
      }

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

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (googleResponse?.type !== 'success') return;
      const idToken = (googleResponse as any)?.authentication?.idToken
        || (googleResponse as any)?.params?.id_token;
      if (!idToken || typeof idToken !== 'string') {
        setError(t('login.error.googleNoToken'));
        return;
      }

      setError('');
      setSocialSubmitting(true);
      try {
        await signInWithGoogleToken(idToken);
        router.replace('/dashboard');
      } catch (err: any) {
        setError(err.message || t('login.error.googleFailed'));
        triggerShake();
      } finally {
        setSocialSubmitting(false);
      }
    };

    handleGoogleResponse();
  }, [googleResponse]);

  useEffect(() => {
    const detectAppleAvailability = async () => {
      if (Platform.OS !== 'ios') {
        setAppleSignInAvailable(false);
        return;
      }
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        setAppleSignInAvailable(available);
      } catch {
        setAppleSignInAvailable(false);
      }
    };

    detectAppleAvailability();
  }, []);

  // ── Biometric Prompt ──
  const promptBiometric = async () => {
    setError('');
    pulseScale.value = withSequence(
      withTiming(1.1, { duration: 200 }),
      withTiming(1, { duration: 200 })
    );

    const result = await authenticateWithBiometrics(t('login.unlockPrompt'));
    if (result.success) {
      if (backendConfigured) {
        try {
          await resumeSession();
        } catch {
          // Server session expired but local auth succeeded — continue offline
        }
      }
      router.replace('/dashboard');
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      triggerShake();

      if (newAttempts >= 5) {
        setMode(hasExistingPasscode ? 'passcode' : 'email');
        setError(t('login.error.tooManyAttempts'));
      }
    }
  };

  // ── Passcode Verification ──
  const handlePasscode = async (passcodeOverride?: string) => {
    const code = passcodeOverride ?? passcode;
    if (code.length < 4) return;
    setError('');
    setSubmitting(true);

    const result = await verifyPasscode(code);
    if (result.success) {
      if (backendConfigured) {
        try {
          await resumeSession();
        } catch {
          // Server session expired but local auth succeeded — continue offline
        }
      }
      router.replace('/dashboard');
    } else {
      triggerShake();
      setError(t('login.error.incorrectPasscode'));
      setPasscode('');
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 10) {
        setMode('email');
        setError(t('login.error.accountLocked'));
      }
    }
    setSubmitting(false);
  };

  // ── Email Sign In ──
  const handleEmailSignIn = async () => {
    if (!email || !password) {
      setError(t('login.error.fillAllFields'));
      return;
    }

    if (!backendConfigured) {
      setError(t('login.error.noBackend'));
      triggerShake();
      return;
    }

    const rl = rateLimiter.attempt('email_signin', RATE_LIMITS.PASSCODE_AUTH);
    if (!rl.allowed) {
      setError(`Too many sign-in attempts. Retry in ${formatRetryAfter(rl.retryAfterMs)}`);
      triggerShake();
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      rateLimiter.reset('email_signin');
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || t('login.error.signInFailed'));
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!backendConfigured) {
      setError(t('login.error.noBackend'));
      return;
    }
    if (!googleClientConfigReady) {
      setError(t('login.error.googleNotConfigured'));
      return;
    }

    setError('');
    setSocialSubmitting(true);
    try {
      const result = await promptGoogleSignIn();
      if (result?.type !== 'success') {
        setSocialSubmitting(false);
      }
    } catch (err: any) {
      setError(err?.message || t('login.error.googleFailed'));
      setSocialSubmitting(false);
    }
  };

  const handleContinueOffline = async () => {
    // For offline mode, just start a biometric/passcode session without server auth
    try {
      const hasPc = await hasPasscode();
      if (hasPc) {
        setMode('passcode');
        return;
      }
      if (biometricCapability?.isAvailable && biometricEnabled) {
        await promptBiometric();
        return;
      }
      // No auth method set up - allow direct access for first-time offline users
      router.replace('/onboarding');
    } catch (err: any) {
      setError(err?.message || 'Failed to start offline mode');
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setSocialSubmitting(true);
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) throw new Error(t('login.error.appleUnavailable'));

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });

      const idToken = credential.identityToken;
      if (!idToken) throw new Error(t('login.error.appleNoToken'));

      await signInWithAppleToken(idToken);
      router.replace('/dashboard');
    } catch (err: any) {
      const cancelled = err?.code === 'ERR_REQUEST_CANCELED';
      if (!cancelled) {
        setError(err.message || t('login.error.appleFailed'));
        triggerShake();
      }
    } finally {
      setSocialSubmitting(false);
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

  const oauthChecks = [
    {
      label: t('login.oauth.backendServer'),
      ok: backendConfigured,
    },
    {
      label: t('login.oauth.googleAndroidClientId'),
      ok: !!process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    },
    {
      label: t('login.oauth.googleFallbackClientId'),
      ok: androidOnlyMode || !!(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    },
    {
      label: t('login.oauth.appleAvailability'),
      ok: Platform.OS === 'ios' ? appleSignInAvailable : true,
    },
  ];
  const hasOAuthConfigIssue = oauthChecks.some((item) => !item.ok);
  const oauthDisabled = !backendConfigured;

  // ──────────────────────────────────
  // RENDER
  // ──────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
              {t('login.tagline')}
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
                {Platform.OS === 'ios' ? t('login.tapToUnlockFaceId') : t('login.tapToUnlockFingerprint')}
              </Text>

              {failedAttempts > 0 && failedAttempts < 5 && (
                <Animated.View entering={FadeIn.duration(150)}>
                  <Text style={[styles.attemptsText, { color: theme.colors.warning }]}>
                    {5 - failedAttempts} {t('login.attemptsRemaining')}
                  </Text>
                </Animated.View>
              )}

              <View style={styles.altAuthRow}>
                {!!hasExistingPasscode && (
                  <TouchableOpacity
                    onPress={() => { setMode('passcode'); setError(''); }}
                    style={[styles.altBtn, { borderColor: theme.colors.border }]}
                  >
                    <MaterialCommunityIcons name="dialpad" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>{t('login.usePasscode')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { setMode('email'); setError(''); }}
                  style={[styles.altBtn, { borderColor: theme.colors.border }]}
                >
                  <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.textMuted} />
                  <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>{t('login.useEmail')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* ── Passcode Mode ── */}
          {mode === 'passcode' && (
            <Animated.View entering={FadeInUp.delay(200).duration(150)} style={styles.authSection}>
              <Text style={[styles.modeTitle, { color: theme.colors.text }]}>{t('login.enterPasscode')}</Text>
              
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
                            backgroundColor: theme.colors.surfaceVariant,
                          }]}
                          onPress={() => {
                            const next = passcode + String(digit);
                            setPasscode(next);
                            if (next.length === 4) {
                              setTimeout(() => {
                                handlePasscode(next);
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
                    style={[styles.altBtn, { borderColor: theme.colors.border }]}
                  >
                    <MaterialCommunityIcons name="fingerprint" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>{t('login.biometric')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { setMode('email'); setError(''); }}
                  style={[styles.altBtn, { borderColor: theme.colors.border }]}
                >
                  <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.textMuted} />
                  <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>{t('login.email')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* ── Email Mode ── */}
          {mode === 'email' && (
            <Animated.View entering={FadeInUp.delay(200).duration(150)} style={styles.authSection}>
              <Text style={[styles.modeTitle, { color: theme.colors.text }]}>{t('login.welcomeBack')}</Text>

              <Animated.View style={shakeStyle}>
                <View style={[styles.inputWrap, {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }]}>
                  <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder={t('login.email')}
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
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }]}>
                  <MaterialCommunityIcons name="lock-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder={t('login.password')}
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
                  <Text style={[styles.emailBtnText, { color: theme.isDark ? theme.colors.background : '#000' }]}>{t('login.signIn')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.socialWrap}>
                {/* Continue Offline button - shown prominently when no backend */}
                {oauthDisabled && (
                  <TouchableOpacity
                    style={[
                      styles.socialBtn,
                      {
                        backgroundColor: theme.colors.accent + '20',
                        borderColor: theme.colors.accent,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={handleContinueOffline}
                    activeOpacity={0.9}
                  >
                    <MaterialCommunityIcons name="account-check" size={18} color={theme.colors.accent} />
                    <Text style={[styles.socialBtnText, { color: theme.colors.accent }]}>{t('login.continueOffline')}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.socialBtn,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      opacity: (socialSubmitting || oauthDisabled) ? 0.4 : 1,
                    },
                  ]}
                  onPress={handleGoogleSignIn}
                  disabled={socialSubmitting || oauthDisabled}
                  activeOpacity={0.9}
                >
                  <MaterialCommunityIcons name="google" size={18} color={theme.colors.text} />
                  <Text style={[styles.socialBtnText, { color: theme.colors.text }]}>{t('login.continueGoogle')}</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[
                      styles.socialBtn,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        opacity: (socialSubmitting || oauthDisabled) ? 0.4 : 1,
                      },
                    ]}
                    onPress={handleAppleSignIn}
                    disabled={socialSubmitting || oauthDisabled}
                    activeOpacity={0.9}
                  >
                    <MaterialCommunityIcons name="apple" size={18} color={theme.colors.text} />
                    <Text style={[styles.socialBtnText, { color: theme.colors.text }]}>{t('login.continueApple')}</Text>
                  </TouchableOpacity>
                )}

                <View
                  style={[
                    styles.oauthDiag,
                    {
                      borderColor: hasOAuthConfigIssue ? theme.colors.warning : theme.colors.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : theme.colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.oauthDiagTitle, { color: theme.colors.textSecondary }]}>{t('login.oauth.readiness')}</Text>
                  {oauthChecks.map((item) => (
                    <Text
                      key={item.label}
                      style={[
                        styles.oauthDiagLine,
                        {
                          color: item.ok ? theme.colors.success : theme.colors.warning,
                        },
                      ]}
                    >
                      {item.ok ? '✓' : '•'} {item.label}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.registerRow}>
                <Text style={[styles.registerText, { color: theme.colors.textMuted }]}>
                  {t('login.noAccount')}{' '}
                </Text>
                <TouchableOpacity onPress={() => router.push('/register')}>
                  <Text style={[styles.registerLink, { color: accentColor }]}>{t('login.register')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.altAuthRow}>
                {biometricCapability?.isAvailable && (
                  <TouchableOpacity
                    onPress={() => { setMode('biometric'); setError(''); }}
                    style={[styles.altBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                  >
                    <MaterialCommunityIcons name="fingerprint" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>{t('login.biometric')}</Text>
                  </TouchableOpacity>
                )}
                {!!hasExistingPasscode && (
                  <TouchableOpacity
                    onPress={() => { setMode('passcode'); setError(''); }}
                    style={[styles.altBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                  >
                    <MaterialCommunityIcons name="dialpad" size={18} color={theme.colors.textMuted} />
                    <Text style={[styles.altBtnText, { color: theme.colors.textMuted }]}>{t('login.passcode')}</Text>
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
  emailBtnText: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },

  socialWrap: { width: '100%', gap: 10, marginTop: 8 },
  socialBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  socialBtnText: { fontSize: 14, fontWeight: '700' },

  oauthDiag: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
    gap: 4,
  },
  oauthDiagTitle: { fontSize: 12, fontWeight: '700' },
  oauthDiagLine: { fontSize: 12, fontWeight: '600' },

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
