/**
 * FitQuest Register Screen
 *
 * Premium themed registration matching the login aesthetic.
 * Dark/light aware with GlassUI components.
 */

import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useAuth } from '../src/context/AuthContext';
import { useLanguage } from '../src/context/LanguageContext';
import ThemedText from '../src/components/ThemedText';
import { GradientButton } from '../src/components/ui/GlassUI';
import { validateEmail, validatePassword, validateName } from '../src/utils/validation';
import { typography, spacing, radius } from '../src/design/theme-system';
import { MOTION } from '../src/design/motion';

const { width: _width } = Dimensions.get('window');

export default function RegisterScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { signUp } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Input refs for next-field focus
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // Shake animation
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-12, { duration: MOTION.shake }),
      withTiming(12, { duration: MOTION.shake }),
      withTiming(-8, { duration: MOTION.shake }),
      withTiming(8, { duration: MOTION.shake }),
      withTiming(0, { duration: MOTION.shake }),
    );
  };

  // Validation
  const validateForm = (): boolean => {
    const nameResult = validateName(name);
    if (!nameResult.valid) {
      setErrorMsg(nameResult.error!);
      triggerShake();
      return false;
    }
    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setErrorMsg(emailResult.error!);
      triggerShake();
      return false;
    }
    const pwResult = validatePassword(password);
    if (!pwResult.valid) {
      setErrorMsg(pwResult.errors[0] ?? t('register.invalidPassword'));
      triggerShake();
      return false;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t('register.passwordsMismatch'));
      triggerShake();
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    setErrorMsg('');
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      await signUp(email, password, name);
      router.replace('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || t('register.failed'));
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (): { label: string; color: string; width: string } => {
    if (password.length === 0) return { label: '', color: 'transparent', width: '0%' };
    const pw = validatePassword(password);
    const labels = [
      t('register.strength.weak'),
      t('register.strength.fair'),
      t('register.strength.good'),
      t('register.strength.strong'),
    ];
    const colors = [theme.colors.error, theme.colors.warning, theme.colors.accent, theme.colors.success];
    const widths = ['25%', '50%', '75%', '100%'];
    const idx = Math.min(pw.score, 3);
    return { label: labels[idx] ?? '', color: colors[idx] ?? 'transparent', width: widths[idx] ?? '0%' };
  };

  const strength = getPasswordStrength();

  const inputBg = theme.colors.surfaceVariant;
  const inputBorder = theme.colors.border;

  return (
    <ScreenErrorBoundary screenName="Register" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Background gradient */}
            <LinearGradient
              colors={
                theme.isDark ? [theme.colors.accent + '10', 'transparent'] : [theme.colors.accent + '06', 'transparent']
              }
              style={styles.bgGradient}
            />

            {/* Logo + Header */}
            <Animated.View entering={ZoomIn.delay(100).duration(300)} style={styles.logoSection}>
              <LinearGradient
                colors={[theme.colors.accent + '25', theme.colors.accent + '08']}
                style={styles.logoCircle}
              >
                <MaterialCommunityIcons name="dumbbell" size={36} color={theme.colors.accent} />
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(200)}>
              <ThemedText style={[styles.title, { color: theme.colors.text }]}>{t('register.title')}</ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                {t('register.subtitle')}
              </ThemedText>
            </Animated.View>

            {/* Error message */}
            {errorMsg ? (
              <Animated.View entering={FadeIn.duration(150)}>
                <Animated.View style={shakeStyle}>
                  <View style={[styles.errorBanner, { backgroundColor: theme.colors.error + '15' }]}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
                    <ThemedText style={[styles.errorText, { color: theme.colors.error }]}>{errorMsg}</ThemedText>
                  </View>
                </Animated.View>
              </Animated.View>
            ) : null}

            {/* Form */}
            <Animated.View entering={FadeInUp.delay(300).duration(200)} style={styles.form}>
              {/* Name */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: theme.colors.textSecondary }]}>
                  {t('register.fullName')}
                </ThemedText>
                <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <MaterialCommunityIcons name="account-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder={t('register.namePlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    maxLength={100}
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: theme.colors.textSecondary }]}>
                  {t('register.email')}
                </ThemedText>
                <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <MaterialCommunityIcons name="email-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    ref={emailRef}
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder={t('register.emailPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    maxLength={254}
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: theme.colors.textSecondary }]}>
                  {t('register.password')}
                </ThemedText>
                <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <MaterialCommunityIcons name="lock-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    ref={passwordRef}
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder={t('register.passwordPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={theme.colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {/* Strength bar */}
                {password.length > 0 && (
                  <Animated.View entering={FadeIn.duration(150)} style={styles.strengthWrap}>
                    <View style={[styles.strengthTrack, { backgroundColor: theme.colors.border }]}>
                      <View
                        style={[styles.strengthFill, { backgroundColor: strength.color, width: strength.width as any }]}
                      />
                    </View>
                    <ThemedText style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</ThemedText>
                  </Animated.View>
                )}
              </View>

              {/* Confirm Password */}
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.label, { color: theme.colors.textSecondary }]}>
                  {t('register.confirmPassword')}
                </ThemedText>
                <View style={[styles.inputWrap, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <MaterialCommunityIcons name="lock-check-outline" size={18} color={theme.colors.textMuted} />
                  <TextInput
                    ref={confirmRef}
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder={t('register.confirmPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                  {confirmPassword.length > 0 && password === confirmPassword && (
                    <MaterialCommunityIcons name="check-circle" size={18} color={theme.colors.success} />
                  )}
                </View>
              </View>

              {/* Submit */}
              <View style={styles.submitWrap}>
                <GradientButton
                  title={isLoading ? t('register.creating') : t('register.signUp')}
                  onPress={handleRegister}
                  variant="primary"
                />
              </View>
            </Animated.View>

            {/* Footer */}
            <Animated.View entering={FadeInUp.delay(400).duration(200)} style={styles.footer}>
              <ThemedText style={[styles.footerText, { color: theme.colors.textMuted }]}>
                {t('register.alreadyHaveAccount')}{' '}
              </ThemedText>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <ThemedText style={[styles.footerLink, { color: theme.colors.accent }]}>
                    {t('register.signIn')}
                  </ThemedText>
                </TouchableOpacity>
              </Link>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing[6], paddingBottom: spacing[10] },
  bgGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  logoSection: { alignItems: 'center', marginTop: spacing[8], marginBottom: spacing[5] },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: typography.sizes.h1Sm, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    fontSize: typography.sizes.bodySmall,
    textAlign: 'center',
    marginTop: spacing[1.5],
    marginBottom: spacing[6],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2.5],
    borderRadius: radius.lg,
    marginBottom: spacing[4],
  },
  errorText: { fontSize: typography.sizes.label, fontWeight: '500', flex: 1 },
  form: { gap: spacing[4] },
  inputGroup: {},
  label: { fontSize: typography.sizes.label, fontWeight: '600', marginBottom: spacing[1.5], marginLeft: spacing[0.5] },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingHorizontal: spacing[3.5],
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: typography.sizes.bodyMid },
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  strengthTrack: {
    flex: 1,
    height: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: radius.sm },
  strengthLabel: { fontSize: typography.sizes.captionSm, fontWeight: '600' },
  submitWrap: { marginTop: spacing[2] },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[7],
  },
  footerText: { fontSize: typography.sizes.bodySmall },
  footerLink: { fontSize: typography.sizes.bodySmall, fontWeight: '700' },
});
