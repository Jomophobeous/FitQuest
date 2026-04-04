/**
 * Onboarding Step Renderers — extracted from onboarding.tsx
 * Each step is a pure JSX block driven by shared context.
 */
import React from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import ThemedText from '../ThemedText';
import { onboardingStyles as styles } from './styles';
import { typography, spacing } from '../../design/theme-system';
import type { OnboardingData, EquipmentItem, PersonalDevelopmentTopic } from '../../viewmodels/useOnboardingViewModel';

// ── Shared context passed from orchestrator ──

export interface OnboardingStepContext {
  theme: any;
  isDark: boolean;
  t: (key: string) => string;
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  ageConfirmed: boolean;
  setAgeConfirmed: (v: boolean) => void;
  dataConsentAccepted: boolean;
  setDataConsentAccepted: (v: boolean) => void;
  disclaimerAccepted: boolean;
  setDisclaimerAccepted: (v: boolean) => void;
  permissionsGranted: Record<string, boolean>;
  setPermissionsGranted: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleInterest: (topic: PersonalDevelopmentTopic) => void;
  toggleEquipment: (item: EquipmentItem) => void;
  pushRoute: (route: string) => void;
  GOALS: { id: string; label: string; icon: string; desc: string }[];
  EXPERIENCE_LEVELS: { id: string; label: string; desc: string; icon: string }[];
  EQUIPMENT_OPTIONS: { id: EquipmentItem; label: string; icon: string }[];
}

// ── Static constants ──

export const INTEREST_OPTIONS: { id: PersonalDevelopmentTopic; icon: string; label: string }[] = [
  { id: 'fitness', icon: 'dumbbell', label: 'Fitness & Training' },
  { id: 'nutrition', icon: 'food-apple', label: 'Nutrition & Diet' },
  { id: 'mental_health', icon: 'head-heart', label: 'Mental Health' },
  { id: 'productivity', icon: 'rocket-launch', label: 'Productivity' },
  { id: 'leadership', icon: 'account-group', label: 'Leadership' },
  { id: 'financial_literacy', icon: 'currency-usd', label: 'Financial Literacy' },
  { id: 'self_discipline', icon: 'shield-check', label: 'Self Discipline' },
  { id: 'mindfulness', icon: 'meditation', label: 'Mindfulness' },
  { id: 'creativity', icon: 'palette', label: 'Creativity' },
  { id: 'emotional_intelligence', icon: 'emoticon-happy', label: 'Emotional Intelligence' },
  { id: 'communication', icon: 'message-text', label: 'Communication' },
  { id: 'career_growth', icon: 'chart-line', label: 'Career Growth' },
];

export const TOTAL_STEPS = 11;

// ── Validation logic ──

export function canAdvanceStep(step: number, ctx: OnboardingStepContext): boolean {
  const { data, ageConfirmed, dataConsentAccepted, disclaimerAccepted } = ctx;
  switch (step) {
    case 0:
      return ageConfirmed;
    case 1:
      return dataConsentAccepted;
    case 2:
      return disclaimerAccepted;
    case 3:
      return true;
    case 4:
      return true;
    case 5:
      return !!data.goal;
    case 6:
      return !!data.experience;
    case 7:
      return true;
    case 8:
      return true;
    case 9:
      return true;
    case 10:
      return true;
    default:
      return false;
  }
}

// ── Step renderers ──

export function renderOnboardingStep(step: number, ctx: OnboardingStepContext): React.ReactNode {
  switch (step) {
    // ── Age Verification Gate ──
    case 0:
      return <AgeVerificationStep ctx={ctx} />;
    case 1:
      return <DataConsentStep ctx={ctx} />;
    case 2:
      return <MedicalDisclaimerStep ctx={ctx} />;
    case 3:
      return <WelcomeStep ctx={ctx} />;
    case 4:
      return <InterestsStep ctx={ctx} />;
    case 5:
      return <GoalStep ctx={ctx} />;
    case 6:
      return <ExperienceStep ctx={ctx} />;
    case 7:
      return <BodyProfileStep ctx={ctx} />;
    case 8:
      return <ScheduleStep ctx={ctx} />;
    case 9:
      return <EquipmentStep ctx={ctx} />;
    case 10:
      return <PermissionsStep ctx={ctx} />;
    default:
      return null;
  }
}

// ── Individual Step Components ──

function AgeVerificationStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, t, ageConfirmed, setAgeConfirmed } = ctx;
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}
    >
      <View style={[styles.consentIconWrap, { backgroundColor: theme.colors.accent + '15' }]}>
        <MaterialCommunityIcons name="account-check" size={48} color={theme.colors.accent} />
      </View>
      <ThemedText style={[styles.welcomeTitle, { color: theme.colors.text, marginTop: spacing[6] }]}>
        {t('onboarding.ageGate.title')}
      </ThemedText>
      <ThemedText
        style={[
          styles.welcomeDesc,
          { color: theme.colors.textMuted, marginTop: spacing[3], textAlign: 'center', paddingHorizontal: spacing[5] },
        ]}
      >
        {t('onboarding.ageGate.description')}
      </ThemedText>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setAgeConfirmed(!ageConfirmed)}
        style={[styles.consentCheckRow, { marginTop: spacing[8] }]}
        accessibilityRole="checkbox"
        accessibilityLabel={t('onboarding.ageGate.confirm')}
        accessibilityState={{ checked: ageConfirmed }}
      >
        <View
          style={[
            styles.consentCheckbox,
            {
              borderColor: ageConfirmed ? theme.colors.accent : theme.colors.border,
              backgroundColor: ageConfirmed ? theme.colors.accent : 'transparent',
            },
          ]}
        >
          {ageConfirmed && <MaterialCommunityIcons name="check" size={16} color={theme.colors.onAccent} />}
        </View>
        <ThemedText style={[styles.consentCheckText, { color: theme.colors.text }]}>
          {t('onboarding.ageGate.confirm')}
        </ThemedText>
      </TouchableOpacity>
    </Animated.View>
  );
}

function DataConsentStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, t, dataConsentAccepted, setDataConsentAccepted, pushRoute } = ctx;
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContainer}>
      <View style={[styles.consentIconWrap, { backgroundColor: theme.colors.accent + '15', alignSelf: 'center' }]}>
        <MaterialCommunityIcons name="shield-lock" size={48} color={theme.colors.accent} />
      </View>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text, textAlign: 'center', marginTop: spacing[5] }]}>
        {t('onboarding.consent.title')}
      </ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted, textAlign: 'center' }]}>
        {t('onboarding.consent.subtitle')}
      </ThemedText>
      <View style={[styles.consentCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {[
          { icon: 'dumbbell' as const, text: t('onboarding.consent.item.workout') },
          { icon: 'heart-pulse' as const, text: t('onboarding.consent.item.health') },
          { icon: 'map-marker' as const, text: t('onboarding.consent.item.location') },
          { icon: 'shield-check' as const, text: t('onboarding.consent.item.storage') },
          { icon: 'eye-off' as const, text: t('onboarding.consent.item.noShare') },
        ].map((item, i) => (
          <Animated.View key={i} entering={FadeInRight.delay(i * 60).duration(200)}>
            <View style={styles.consentItem}>
              <MaterialCommunityIcons name={item.icon} size={20} color={theme.colors.accent} />
              <ThemedText style={[styles.consentItemText, { color: theme.colors.text }]}>{item.text}</ThemedText>
            </View>
          </Animated.View>
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setDataConsentAccepted(!dataConsentAccepted)}
        style={[styles.consentCheckRow, { marginTop: spacing[5] }]}
        accessibilityRole="checkbox"
        accessibilityLabel={t('onboarding.consent.accept')}
        accessibilityState={{ checked: dataConsentAccepted }}
      >
        <View
          style={[
            styles.consentCheckbox,
            {
              borderColor: dataConsentAccepted ? theme.colors.accent : theme.colors.border,
              backgroundColor: dataConsentAccepted ? theme.colors.accent : 'transparent',
            },
          ]}
        >
          {dataConsentAccepted && <MaterialCommunityIcons name="check" size={16} color={theme.colors.onAccent} />}
        </View>
        <ThemedText style={[styles.consentCheckText, { color: theme.colors.text }]}>
          {t('onboarding.consent.accept')}
        </ThemedText>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => pushRoute('/privacy-policy')}
        style={{ marginTop: spacing[3], alignSelf: 'center' }}
      >
        <ThemedText
          style={{ color: theme.colors.accent, fontSize: typography.sizes.label, textDecorationLine: 'underline' }}
        >
          {t('onboarding.consent.readPolicy')}
        </ThemedText>
      </TouchableOpacity>
    </Animated.View>
  );
}

function MedicalDisclaimerStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, t, disclaimerAccepted, setDisclaimerAccepted } = ctx;
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContainer}>
      <View style={[styles.consentIconWrap, { backgroundColor: theme.colors.warning + '15', alignSelf: 'center' }]}>
        <MaterialCommunityIcons name="medical-bag" size={48} color={theme.colors.warning} />
      </View>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text, textAlign: 'center', marginTop: spacing[5] }]}>
        {t('onboarding.disclaimer.title')}
      </ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted, textAlign: 'center' }]}>
        {t('onboarding.disclaimer.subtitle')}
      </ThemedText>
      <View style={[styles.consentCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {[
          { icon: 'stethoscope' as const, text: t('onboarding.disclaimer.item.notMedical') },
          { icon: 'doctor' as const, text: t('onboarding.disclaimer.item.consultDoctor') },
          { icon: 'heart-pulse' as const, text: t('onboarding.disclaimer.item.healthData') },
          { icon: 'alert-circle-outline' as const, text: t('onboarding.disclaimer.item.stopIfPain') },
          { icon: 'account-check' as const, text: t('onboarding.disclaimer.item.responsibility') },
        ].map((item, i) => (
          <Animated.View key={i} entering={FadeInRight.delay(i * 60).duration(200)}>
            <View style={styles.consentItem}>
              <MaterialCommunityIcons name={item.icon} size={20} color={theme.colors.warning} />
              <ThemedText style={[styles.consentItemText, { color: theme.colors.text }]}>{item.text}</ThemedText>
            </View>
          </Animated.View>
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setDisclaimerAccepted(!disclaimerAccepted)}
        style={[styles.consentCheckRow, { marginTop: spacing[5] }]}
        accessibilityRole="checkbox"
        accessibilityLabel={t('onboarding.disclaimer.accept')}
        accessibilityState={{ checked: disclaimerAccepted }}
      >
        <View
          style={[
            styles.consentCheckbox,
            {
              borderColor: disclaimerAccepted ? theme.colors.accent : theme.colors.border,
              backgroundColor: disclaimerAccepted ? theme.colors.accent : 'transparent',
            },
          ]}
        >
          {disclaimerAccepted && <MaterialCommunityIcons name="check" size={16} color={theme.colors.onAccent} />}
        </View>
        <ThemedText style={[styles.consentCheckText, { color: theme.colors.text }]}>
          {t('onboarding.disclaimer.accept')}
        </ThemedText>
      </TouchableOpacity>
    </Animated.View>
  );
}

function WelcomeStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, isDark, t } = ctx;
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}
    >
      <View style={styles.welcomeIconWrap}>
        <LinearGradient colors={[theme.colors.accent + '30', theme.colors.accent + '08']} style={styles.welcomeGlow} />
        <MaterialCommunityIcons name="lightning-bolt" size={64} color={theme.colors.accent} />
      </View>
      <ThemedText style={[styles.welcomeTitle, { color: theme.colors.text }]}>{t('onboarding.welcome')}</ThemedText>
      <ThemedText style={[styles.welcomeDesc, { color: theme.colors.textMuted }]}>{t('onboarding.tagline')}</ThemedText>
      <View style={styles.pillarsRow}>
        {[
          {
            icon: 'dumbbell' as const,
            title: t('onboarding.heroBody'),
            sub: t('onboarding.heroBodySub'),
            color: theme.colors.accent,
          },
          {
            icon: 'head-lightbulb-outline' as const,
            title: t('onboarding.heroMind'),
            sub: t('onboarding.heroMindSub'),
            color: theme.colors.purple,
          },
          {
            icon: 'walk' as const,
            title: t('onboarding.heroMove'),
            sub: t('onboarding.heroMoveSub'),
            color: theme.colors.blue,
          },
        ].map((p) => (
          <View
            key={p.title}
            style={[
              styles.pillarCard,
              {
                backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                borderColor: p.color + '30',
              },
            ]}
          >
            <View style={[styles.pillarIconWrap, { backgroundColor: p.color + '18' }]}>
              <MaterialCommunityIcons name={p.icon} size={22} color={p.color} />
            </View>
            <ThemedText style={[styles.pillarTitle, { color: theme.colors.text }]}>{p.title}</ThemedText>
            <ThemedText style={[styles.pillarSub, { color: theme.colors.textMuted }]}>{p.sub}</ThemedText>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function InterestsStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, isDark, data, setData, toggleInterest } = ctx;
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text }]}>{'What interests you?'}</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
        {"Select topics you want to explore. We'll recommend content tailored to your growth."}
      </ThemedText>
      <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
        <View style={styles.equipGrid}>
          {INTEREST_OPTIONS.map((opt, i) => {
            const selected = data.interests.includes(opt.id);
            return (
              <Animated.View key={opt.id} entering={FadeInRight.delay(i * 40).duration(200)}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => toggleInterest(opt.id)}
                  style={[
                    styles.equipCard,
                    {
                      backgroundColor: selected ? theme.colors.accent + '15' : theme.colors.surface,
                      borderColor: selected ? theme.colors.accent : theme.colors.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ checked: selected }}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={28}
                    color={selected ? theme.colors.accent : theme.colors.textMuted}
                  />
                  <ThemedText
                    style={[styles.equipLabel, { color: selected ? theme.colors.accent : theme.colors.text }]}
                  >
                    {opt.label}
                  </ThemedText>
                  {selected && (
                    <View style={[styles.equipCheck, { backgroundColor: theme.colors.accent }]}>
                      <MaterialCommunityIcons name="check" size={14} color={theme.colors.onAccent} />
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ marginTop: spacing[5] }}>
        <ThemedText style={[styles.stepTitle, { color: theme.colors.text, fontSize: typography.sizes.h4 }]}>
          {'Your personal goal'}
        </ThemedText>
        <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
          {'What do you want to achieve with FitQuest? Our AI coach will keep this in mind.'}
        </ThemedText>
        <View
          style={[
            styles.metricInput,
            {
              backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surface,
              borderColor: theme.colors.border,
              marginTop: spacing[2],
            },
          ]}
        >
          <TextInput
            style={[styles.metricField, { color: theme.colors.text, minHeight: 60, textAlignVertical: 'top' }]}
            placeholder={'e.g. I want to run a marathon, improve my posture, build discipline...'}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={500}
            value={data.personalGoal}
            onChangeText={(v) => setData((d) => ({ ...d, personalGoal: v }))}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function GoalStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, isDark, t, data, setData, GOALS } = ctx;
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.goalTitle')}</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted }]}>{t('onboarding.goalSub')}</ThemedText>
      <View style={styles.optionsList}>
        {GOALS.map((g, i) => (
          <Animated.View key={g.id} entering={FadeInRight.delay(i * 60).duration(200)}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setData((d) => ({ ...d, goal: g.id as OnboardingData['goal'] }))}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                  borderColor: data.goal === g.id ? theme.colors.accent : theme.colors.border,
                  borderWidth: data.goal === g.id ? 2 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={g.label}
              accessibilityState={{ selected: data.goal === g.id }}
            >
              <View
                style={[
                  styles.optionIcon,
                  { backgroundColor: data.goal === g.id ? theme.colors.accent + '20' : theme.colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name={g.icon as any}
                  size={24}
                  color={data.goal === g.id ? theme.colors.accent : theme.colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.optionLabel, { color: theme.colors.text }]}>{g.label}</ThemedText>
                <ThemedText style={[styles.optionDesc, { color: theme.colors.textMuted }]}>{g.desc}</ThemedText>
              </View>
              {data.goal === g.id && (
                <MaterialCommunityIcons name="check-circle" size={22} color={theme.colors.accent} />
              )}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

function ExperienceStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, isDark, t, data, setData, EXPERIENCE_LEVELS } = ctx;
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text }]}>
        {t('onboarding.experienceTitle')}
      </ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
        {t('onboarding.experienceSub')}
      </ThemedText>
      <View style={styles.optionsList}>
        {EXPERIENCE_LEVELS.map((e, i) => (
          <Animated.View key={e.id} entering={FadeInRight.delay(i * 80).duration(200)}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setData((d) => ({ ...d, experience: e.id as OnboardingData['experience'] }))}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                  borderColor: data.experience === e.id ? theme.colors.accent : theme.colors.border,
                  borderWidth: data.experience === e.id ? 2 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={e.label}
              accessibilityState={{ selected: data.experience === e.id }}
            >
              <View
                style={[
                  styles.optionIcon,
                  {
                    backgroundColor:
                      data.experience === e.id ? theme.colors.accent + '20' : theme.colors.surfaceVariant,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={e.icon as any}
                  size={24}
                  color={data.experience === e.id ? theme.colors.accent : theme.colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.optionLabel, { color: theme.colors.text }]}>{e.label}</ThemedText>
                <ThemedText style={[styles.optionDesc, { color: theme.colors.textMuted }]}>{e.desc}</ThemedText>
              </View>
              {data.experience === e.id && (
                <MaterialCommunityIcons name="check-circle" size={22} color={theme.colors.accent} />
              )}
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

function BodyProfileStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, isDark, t, data, setData, fieldErrors, setFieldErrors } = ctx;
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text }]}>
        {t('onboarding.bodyProfileTitle')}
      </ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
        {t('onboarding.bodyProfileSub')}
      </ThemedText>
      <View style={styles.optionsList}>
        <View style={styles.inputRow}>
          <View
            style={[
              styles.metricInput,
              {
                backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <TextInput
              style={[styles.metricField, { color: theme.colors.text }]}
              placeholder={t('onboarding.weightPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              maxLength={6}
              value={data.weightKg}
              onChangeText={(v) => {
                setData((d) => ({ ...d, weightKg: v }));
                if (fieldErrors.weightKg) setFieldErrors((e) => ({ ...e, weightKg: '' }));
              }}
            />
            {!!fieldErrors.weightKg && (
              <ThemedText
                style={{ color: theme.colors.error, fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] }}
              >
                {fieldErrors.weightKg}
              </ThemedText>
            )}
          </View>
          <View
            style={[
              styles.metricInput,
              {
                backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <TextInput
              style={[styles.metricField, { color: theme.colors.text }]}
              placeholder={t('onboarding.heightPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              maxLength={6}
              value={data.heightCm}
              onChangeText={(v) => {
                setData((d) => ({ ...d, heightCm: v }));
                if (fieldErrors.heightCm) setFieldErrors((e) => ({ ...e, heightCm: '' }));
              }}
            />
            {!!fieldErrors.heightCm && (
              <ThemedText
                style={{ color: theme.colors.error, fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] }}
              >
                {fieldErrors.heightCm}
              </ThemedText>
            )}
          </View>
        </View>
        <View style={styles.sexRow}>
          {(['male', 'female'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              activeOpacity={0.8}
              onPress={() => setData((d) => ({ ...d, sex: s }))}
              style={[
                styles.sexBtn,
                {
                  backgroundColor:
                    data.sex === s
                      ? theme.colors.accent + '20'
                      : isDark
                        ? theme.colors.surfaceVariant
                        : theme.colors.surface,
                  borderColor: data.sex === s ? theme.colors.accent : theme.colors.border,
                  borderWidth: data.sex === s ? 2 : 1,
                },
              ]}
              accessibilityRole="radio"
              accessibilityLabel={s.charAt(0).toUpperCase() + s.slice(1)}
              accessibilityState={{ selected: data.sex === s }}
            >
              <MaterialCommunityIcons
                name={s === 'male' ? 'gender-male' : 'gender-female'}
                size={22}
                color={data.sex === s ? theme.colors.accent : theme.colors.textMuted}
              />
              <ThemedText
                style={[styles.sexLabel, { color: data.sex === s ? theme.colors.accent : theme.colors.text }]}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function ScheduleStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, t, data, setData } = ctx;
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.scheduleTitle')}</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
        {t('onboarding.scheduleSub')}
      </ThemedText>

      <ThemedText style={[styles.sliderLabel, { color: theme.colors.text }]}>
        {t('onboarding.daysPerWeek')}{' '}
        <ThemedText style={{ color: theme.colors.accent, fontWeight: '900' }}>{data.trainingDays}</ThemedText>
      </ThemedText>
      <View style={styles.daysRow}>
        {[2, 3, 4, 5, 6, 7].map((d) => (
          <TouchableOpacity
            key={d}
            activeOpacity={0.8}
            onPress={() => setData((dt) => ({ ...dt, trainingDays: d }))}
            style={[
              styles.dayBtn,
              { backgroundColor: data.trainingDays === d ? theme.colors.accent : theme.colors.surfaceVariant },
            ]}
            accessibilityRole="radio"
            accessibilityLabel={`${d} days per week`}
            accessibilityState={{ selected: data.trainingDays === d }}
          >
            <ThemedText
              style={[
                styles.dayBtnText,
                { color: data.trainingDays === d ? theme.colors.onAccent : theme.colors.text },
              ]}
            >
              {d}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <ThemedText style={[styles.sliderLabel, { color: theme.colors.text, marginTop: spacing[7] }]}>
        {t('onboarding.minutesPerSession')}{' '}
        <ThemedText style={{ color: theme.colors.accent, fontWeight: '900' }}>{data.sessionMinutes}</ThemedText>
      </ThemedText>
      <View style={styles.daysRow}>
        {[20, 30, 45, 60, 90].map((m) => (
          <TouchableOpacity
            key={m}
            activeOpacity={0.8}
            onPress={() => setData((dt) => ({ ...dt, sessionMinutes: m }))}
            style={[
              styles.dayBtn,
              {
                backgroundColor: data.sessionMinutes === m ? theme.colors.accent : theme.colors.surfaceVariant,
                paddingHorizontal: spacing[3.5],
              },
            ]}
            accessibilityRole="radio"
            accessibilityLabel={`${m} minutes per session`}
            accessibilityState={{ selected: data.sessionMinutes === m }}
          >
            <ThemedText
              style={[
                styles.dayBtnText,
                { color: data.sessionMinutes === m ? theme.colors.onAccent : theme.colors.text },
              ]}
            >
              {m}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

function EquipmentStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, t, data, toggleEquipment, EQUIPMENT_OPTIONS } = ctx;
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.equipmentTitle')}</ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
        {t('onboarding.equipmentSub')}
      </ThemedText>
      <View style={styles.equipGrid}>
        {EQUIPMENT_OPTIONS.map((eq, i) => {
          const selected = data.equipment.includes(eq.id);
          return (
            <Animated.View key={eq.id} entering={FadeInRight.delay(i * 50).duration(200)}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleEquipment(eq.id)}
                style={[
                  styles.equipCard,
                  {
                    backgroundColor: selected ? theme.colors.accent + '15' : theme.colors.surface,
                    borderColor: selected ? theme.colors.accent : theme.colors.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityLabel={eq.label}
                accessibilityState={{ checked: selected }}
              >
                <MaterialCommunityIcons
                  name={eq.icon as any}
                  size={28}
                  color={selected ? theme.colors.accent : theme.colors.textMuted}
                />
                <ThemedText style={[styles.equipLabel, { color: selected ? theme.colors.accent : theme.colors.text }]}>
                  {eq.label}
                </ThemedText>
                {!!selected && (
                  <View style={[styles.equipCheck, { backgroundColor: theme.colors.accent }]}>
                    <MaterialCommunityIcons name="check" size={14} color={theme.colors.onAccent} />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

function PermissionsStep({ ctx }: { ctx: OnboardingStepContext }) {
  const { theme, t, permissionsGranted, setPermissionsGranted } = ctx;

  const PERMISSION_ITEMS = [
    {
      id: 'notifications',
      icon: 'bell-outline' as const,
      title: t('onboarding.perm.notifications') || 'Workout Reminders',
      desc: t('onboarding.perm.notificationsSub') || 'Get reminded to stay on track with your training schedule',
    },
    {
      id: 'motion',
      icon: 'run-fast' as const,
      title: t('onboarding.perm.motion') || 'Motion & Activity',
      desc: t('onboarding.perm.motionSub') || 'Track steps, detect exercises, and count reps using motion sensors',
    },
    {
      id: 'location',
      icon: 'map-marker-outline' as const,
      title: t('onboarding.perm.location') || 'Location (Jog Tracking)',
      desc: t('onboarding.perm.locationSub') || 'Map your jog routes and calculate distance accurately',
    },
    ...(Platform.OS === 'android'
      ? [
          {
            id: 'battery',
            icon: 'battery-charging' as const,
            title: t('onboarding.perm.battery') || 'Background Activity',
            desc: t('onboarding.perm.batterySub') || 'Allow step tracking and health monitoring in the background',
          },
        ]
      : []),
  ];

  const requestNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionsGranted((prev) => ({ ...prev, notifications: status === 'granted' }));
    } catch {
      setPermissionsGranted((prev) => ({ ...prev, notifications: false }));
    }
  };

  const requestMotionPermission = async () => {
    try {
      const { Pedometer } = await import('expo-sensors');
      const available = await Pedometer.isAvailableAsync();
      setPermissionsGranted((prev) => ({ ...prev, motion: available }));
    } catch {
      setPermissionsGranted((prev) => ({ ...prev, motion: false }));
    }
  };

  const requestLocationPermission = async () => {
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionsGranted((prev) => ({ ...prev, location: status === 'granted' }));
    } catch {
      setPermissionsGranted((prev) => ({ ...prev, location: false }));
    }
  };

  const requestHealthConnect = async () => {
    setPermissionsGranted((prev) => ({ ...prev, healthConnect: false }));
  };

  const requestBatteryOptimization = async () => {
    try {
      const IntentLauncher = await import('expo-intent-launcher');
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, {
        data: 'package:com.hugelet.fitquest',
      });
      setPermissionsGranted((prev) => ({ ...prev, battery: true }));
    } catch {
      setPermissionsGranted((prev) => ({ ...prev, battery: false }));
    }
  };

  const permHandlers: Record<string, () => Promise<void>> = {
    notifications: requestNotifications,
    motion: requestMotionPermission,
    location: requestLocationPermission,
    healthConnect: requestHealthConnect,
    battery: requestBatteryOptimization,
  };

  const requestAllPermissions = async () => {
    for (const perm of PERMISSION_ITEMS) {
      if (!permissionsGranted[perm.id]) {
        await permHandlers[perm.id]?.();
      }
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
      <ThemedText style={[styles.stepTitle, { color: theme.colors.text }]}>
        {t('onboarding.permTitle') || 'Enable Permissions'}
      </ThemedText>
      <ThemedText style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
        {t('onboarding.permSub') ||
          'These help FitQuest track your health and fitness accurately. You can change them anytime in Settings.'}
      </ThemedText>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={requestAllPermissions}
        style={[
          styles.permAllBtn,
          { backgroundColor: theme.colors.accent + '15', borderColor: theme.colors.accent + '40' },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Allow all permissions"
      >
        <MaterialCommunityIcons name="shield-check" size={18} color={theme.colors.accent} />
        <ThemedText style={{ color: theme.colors.accent, fontSize: typography.sizes.bodySmall, fontWeight: '700' }}>
          Allow All
        </ThemedText>
      </TouchableOpacity>
      <View style={{ gap: spacing[2.5], marginTop: spacing[3] }}>
        {PERMISSION_ITEMS.map((perm, i) => {
          const granted = permissionsGranted[perm.id];
          return (
            <Animated.View key={perm.id} entering={FadeInRight.delay(i * 60).duration(200)}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={permHandlers[perm.id]}
                style={[
                  styles.permCard,
                  {
                    backgroundColor: granted ? theme.colors.accent + '12' : theme.colors.surface,
                    borderColor: granted ? theme.colors.accent : theme.colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.permIcon,
                    { backgroundColor: (granted ? theme.colors.accent : theme.colors.textMuted) + '18' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={granted ? 'check-circle' : perm.icon}
                    size={24}
                    color={granted ? theme.colors.accent : theme.colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.permTitle, { color: granted ? theme.colors.accent : theme.colors.text }]}>
                    {perm.title}
                  </ThemedText>
                  <ThemedText style={[styles.permDesc, { color: theme.colors.textMuted }]} numberOfLines={2}>
                    {perm.desc}
                  </ThemedText>
                </View>
                {!granted && (
                  <View style={[styles.permAction, { backgroundColor: theme.colors.accent + '15' }]}>
                    <ThemedText
                      style={{ color: theme.colors.accent, fontSize: typography.sizes.caption, fontWeight: '600' }}
                    >
                      {t('onboarding.perm.allow') || 'Allow'}
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      <ThemedText style={[styles.permSkipNote, { color: theme.colors.textMuted }]}>
        {t('onboarding.perm.skipNote') || 'You can skip this — permissions can be enabled later in your profile.'}
      </ThemedText>
    </Animated.View>
  );
}
