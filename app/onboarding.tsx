/**
 * FitQuest Onboarding Screen
 *
 * Multi-step onboarding: Welcome → Goals → Experience → Schedule → Profile → Done.
 * Saves preferences to SQLite user_profile. Figma-inspired UI with lime accent.
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import Animated, { FadeOutLeft } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useToast } from '../src/context/ToastContext';
import { useDatabase } from '../src/context/DatabaseContext';
import ThemedText from '../src/components/ThemedText';
import {
  useOnboardingViewModel,
  EquipmentItem,
  PersonalDevelopmentTopic,
  OnboardingData,
} from '../src/viewmodels/useOnboardingViewModel';
import { spacing } from '../src/design/theme-system';
import { onboardingStyles as styles } from '../src/components/onboarding/styles';
import {
  TOTAL_STEPS,
  canAdvanceStep,
  renderOnboardingStep,
  type OnboardingStepContext,
} from '../src/components/onboarding/OnboardingSteps';

// Must match SQLite CHECK constraint: ('body_control','posture','speed','mobility','focus','strength')
type Goal = 'body_control' | 'posture' | 'speed' | 'mobility' | 'focus' | 'strength';
// Must match SQLite CHECK constraint: ('beginner','intermediate','advanced')
type Experience = 'beginner' | 'intermediate' | 'advanced';

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useDatabase();
  const vm = useOnboardingViewModel();
  const isDark = theme.isDark;

  // ── Translated data arrays ──

  const GOALS: { id: Goal; label: string; icon: string; desc: string }[] = [
    {
      id: 'strength',
      label: t('onboarding.goal.buildMuscle'),
      icon: 'arm-flex',
      desc: t('onboarding.goal.buildMuscleSub'),
    },
    { id: 'body_control', label: t('onboarding.goal.loseFat'), icon: 'fire', desc: t('onboarding.goal.loseFatSub') },
    { id: 'speed', label: t('onboarding.goal.endurance'), icon: 'run-fast', desc: t('onboarding.goal.enduranceSub') },
    {
      id: 'mobility',
      label: t('onboarding.goal.flexibility'),
      icon: 'human-greeting-variant',
      desc: t('onboarding.goal.flexibilitySub'),
    },
    { id: 'posture', label: t('onboarding.goal.posture'), icon: 'human-male', desc: t('onboarding.goal.postureSub') },
    {
      id: 'focus',
      label: t('onboarding.goal.mind'),
      icon: 'head-lightbulb-outline',
      desc: t('onboarding.goal.mindSub'),
    },
  ];

  const EXPERIENCE_LEVELS: { id: Experience; label: string; desc: string; icon: string }[] = [
    {
      id: 'beginner',
      label: t('onboarding.experience.beginner'),
      desc: t('onboarding.experience.beginnerSub'),
      icon: 'sprout',
    },
    {
      id: 'intermediate',
      label: t('onboarding.experience.intermediate'),
      desc: t('onboarding.experience.intermediateSub'),
      icon: 'tree',
    },
    {
      id: 'advanced',
      label: t('onboarding.experience.advanced'),
      desc: t('onboarding.experience.advancedSub'),
      icon: 'trophy',
    },
  ];

  const EQUIPMENT_OPTIONS: { id: EquipmentItem; label: string; icon: string }[] = [
    { id: 'DUMBBELLS' as EquipmentItem, label: t('onboarding.equipment.dumbbells'), icon: 'dumbbell' },
    { id: 'BARBELL' as EquipmentItem, label: t('onboarding.equipment.barbell'), icon: 'weight-lifter' },
    { id: 'PULL_UP_BAR' as EquipmentItem, label: t('onboarding.equipment.pullupBar'), icon: 'human-handsup' },
    { id: 'RESISTANCE_BANDS' as EquipmentItem, label: t('onboarding.equipment.resistanceBands'), icon: 'yoga' },
    { id: 'BENCH' as EquipmentItem, label: t('onboarding.equipment.bench'), icon: 'seat-recline-normal' },
    { id: 'KETTLEBELL' as EquipmentItem, label: t('onboarding.equipment.kettlebell'), icon: 'weight' },
    { id: 'CABLE_MACHINE' as EquipmentItem, label: t('onboarding.equipment.cableMachine'), icon: 'elevator' },
    { id: 'BODYWEIGHT' as EquipmentItem, label: t('onboarding.equipment.bodyweight'), icon: 'human' },
  ];

  // ── State ──

  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    goal: null,
    experience: null,
    trainingDays: 4,
    sessionMinutes: 45,
    weightKg: '',
    heightCm: '',
    sex: null,
    equipment: [],
    interests: [],
    personalGoal: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [permissionsGranted, setPermissionsGranted] = useState<Record<string, boolean>>({});
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [dataConsentAccepted, setDataConsentAccepted] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // ── Analytics ──
  const _onboardingStartRef = useRef(Date.now());
  const onboardingCompletedRef = useRef(false);

  useEffect(() => {
    return () => {
      /* cleanup ref for unmount tracking */
    };
  }, []);

  // ── Callbacks ──

  const toggleInterest = (topic: PersonalDevelopmentTopic) => {
    setData((d) => ({
      ...d,
      interests: d.interests.includes(topic) ? d.interests.filter((i) => i !== topic) : [...d.interests, topic],
    }));
  };

  const toggleEquipment = (item: EquipmentItem) => {
    setData((d) => ({
      ...d,
      equipment: d.equipment.includes(item) ? d.equipment.filter((e) => e !== item) : [...d.equipment, item],
    }));
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finishOnboarding();
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const finishOnboarding = async () => {
    const result = await vm.saveProfile(data, refreshProfile);
    if (result.errors) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    if (!result.success) {
      showToast({
        message: t('onboarding.saveError') || 'Failed to save your profile. Please try again.',
        type: 'error',
      });
      return;
    }
    onboardingCompletedRef.current = true;
    router.replace('/dashboard');
  };

  // ── Step context for extracted renderers ──

  const stepCtx: OnboardingStepContext = {
    theme,
    isDark,
    t,
    data,
    setData,
    fieldErrors,
    setFieldErrors,
    ageConfirmed,
    setAgeConfirmed,
    dataConsentAccepted,
    setDataConsentAccepted,
    disclaimerAccepted,
    setDisclaimerAccepted,
    permissionsGranted,
    setPermissionsGranted,
    toggleInterest,
    toggleEquipment,
    pushRoute: (route: string) => router.push(route as any),
    GOALS,
    EXPERIENCE_LEVELS,
    EQUIPMENT_OPTIONS,
  };

  const canAdvance = () => canAdvanceStep(step, stepCtx);

  // ── Render ──

  return (
    <ScreenErrorBoundary screenName="Onboarding" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <ScreenContainer>
        {/* Background gradient */}
        <LinearGradient colors={[theme.colors.accent + '06', 'transparent', 'transparent']} style={styles.bgGlow} />

        {/* Progress bar */}
        <View style={styles.progressRow}>
          {step > 0 && (
            <TouchableOpacity
              onPress={back}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.text} />
            </TouchableOpacity>
          )}
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${((step + 1) / TOTAL_STEPS) * 100}%`, backgroundColor: theme.colors.accent },
              ]}
            />
          </View>
          <ThemedText style={[styles.stepIndicator, { color: theme.colors.textMuted }]}>
            {step + 1}/{TOTAL_STEPS}
          </ThemedText>
        </View>

        {/* Content */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View key={step} exiting={FadeOutLeft.duration(150)}>
              {renderOnboardingStep(step, stepCtx)}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* CTA */}
        <View style={[styles.ctaRow, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <TouchableOpacity
            style={[
              styles.ctaBtn,
              {
                backgroundColor: canAdvance() ? theme.colors.accent : theme.colors.surfaceVariant,
                opacity: canAdvance() ? 1 : 0.5,
              },
            ]}
            onPress={next}
            disabled={!canAdvance() || vm.saving}
            activeOpacity={0.9}
          >
            <ThemedText
              style={[styles.ctaBtnText, { color: canAdvance() ? theme.colors.onAccent : theme.colors.textMuted }]}
            >
              {step === TOTAL_STEPS - 1
                ? vm.saving
                  ? t('onboarding.saving')
                  : t('onboarding.getStarted')
                : t('onboarding.continue')}
            </ThemedText>
            {step < TOTAL_STEPS - 1 && (
              <MaterialCommunityIcons
                name="arrow-right"
                size={20}
                color={canAdvance() ? theme.colors.onAccent : theme.colors.textMuted}
              />
            )}
          </TouchableOpacity>

          {step === 3 && (
            <TouchableOpacity
              onPress={async () => {
                onboardingCompletedRef.current = true;
                await vm.skipOnboarding(refreshProfile);
                router.replace('/dashboard');
              }}
              style={{ marginTop: spacing[3] }}
            >
              <ThemedText style={[styles.skipText, { color: theme.colors.textMuted }]}>
                {t('onboarding.skip')}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </ScreenContainer>
    </ScreenErrorBoundary>
  );
}
