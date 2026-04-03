/**
 * FitQuest Onboarding Screen
 *
 * Multi-step onboarding: Welcome → Goals → Experience → Schedule → Profile → Done.
 * Saves preferences to SQLite user_profile. Figma-inspired UI with lime accent.
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  FlatList,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useToast } from '../src/context/ToastContext';
import { GlassCard, GradientButton } from '../src/components/ui/GlassUI';
import { useDatabase } from '../src/context/DatabaseContext';
import { useOnboardingViewModel, EquipmentItem, PersonalDevelopmentTopic, OnboardingData } from '../src/viewmodels/useOnboardingViewModel';
import { typography, spacing } from '../src/design/theme-system';


const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Must match SQLite CHECK constraint: ('body_control','posture','speed','mobility','focus','strength')
type Goal = 'body_control' | 'posture' | 'speed' | 'mobility' | 'focus' | 'strength';
// Must match SQLite CHECK constraint: ('beginner','intermediate','advanced')
type Experience = 'beginner' | 'intermediate' | 'advanced';

const TOTAL_STEPS = 11;

const INTEREST_OPTIONS: { id: PersonalDevelopmentTopic; icon: string; label: string }[] = [
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

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useDatabase();
  const vm = useOnboardingViewModel();
  const isDark = theme.isDark;

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

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return ageConfirmed; // Age gate — must confirm 13+
      case 1:
        return dataConsentAccepted; // Data consent — must accept
      case 2:
        return disclaimerAccepted; // Medical disclaimer — must acknowledge
      case 3:
        return true; // Welcome
      case 4:
        return true; // Personal goals & interests — optional
      case 5:
        return !!data.goal;
      case 6:
        return !!data.experience;
      case 7:
        return true; // Body profile is optional
      case 8:
        return data.trainingDays > 0;
      case 9:
        return true; // Equipment is optional
      case 10:
        return true; // Permissions are optional — user can skip
      default:
        return false;
    }
  };

  const toggleInterest = (topic: PersonalDevelopmentTopic) => {
    setData((d) => ({
      ...d,
      interests: d.interests.includes(topic) ? d.interests.filter((i) => i !== topic) : [...d.interests, topic],
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
    router.replace('/dashboard');
  };

  const toggleEquipment = (item: EquipmentItem) => {
    setData((d) => ({
      ...d,
      equipment: d.equipment.includes(item) ? d.equipment.filter((e) => e !== item) : [...d.equipment, item],
    }));
  };

  // ── Step Content ──
  const renderStep = () => {
    switch (step) {
      // ── Age Verification Gate ──
      case 0:
        return (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}
          >
            <View style={[styles.consentIconWrap, { backgroundColor: theme.colors.accent + '15' }]}>
              <MaterialCommunityIcons name="account-check" size={48} color={theme.colors.accent} />
            </View>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text, marginTop: spacing[6] }]}>
              {t('onboarding.ageGate.title')}
            </Text>
            <Text
              style={[
                styles.welcomeDesc,
                { color: theme.colors.textMuted, marginTop: spacing[3], textAlign: 'center', paddingHorizontal: spacing[5] },
              ]}
            >
              {t('onboarding.ageGate.description')}
            </Text>

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
              <Text style={[styles.consentCheckText, { color: theme.colors.text }]}>
                {t('onboarding.ageGate.confirm')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );

      // ── Data Consent Screen ──
      case 1:
        return (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContainer}>
            <View
              style={[styles.consentIconWrap, { backgroundColor: theme.colors.accent + '15', alignSelf: 'center' }]}
            >
              <MaterialCommunityIcons name="shield-lock" size={48} color={theme.colors.accent} />
            </View>
            <Text style={[styles.stepTitle, { color: theme.colors.text, textAlign: 'center', marginTop: spacing[5] }]}>
              {t('onboarding.consent.title')}
            </Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted, textAlign: 'center' }]}>
              {t('onboarding.consent.subtitle')}
            </Text>

            <View
              style={[styles.consentCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
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
                    <Text style={[styles.consentItemText, { color: theme.colors.text }]}>{item.text}</Text>
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
              <Text style={[styles.consentCheckText, { color: theme.colors.text }]}>
                {t('onboarding.consent.accept')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/privacy-policy')}
              style={{ marginTop: spacing[3], alignSelf: 'center' }}
            >
              <Text style={{ color: theme.colors.accent, fontSize: typography.sizes.label, textDecorationLine: 'underline' }}>
                {t('onboarding.consent.readPolicy')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );

      // ── Medical Disclaimer ──
      case 2:
        return (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.stepContainer}>
            <View
              style={[styles.consentIconWrap, { backgroundColor: theme.colors.warning + '15', alignSelf: 'center' }]}
            >
              <MaterialCommunityIcons name="medical-bag" size={48} color={theme.colors.warning} />
            </View>
            <Text style={[styles.stepTitle, { color: theme.colors.text, textAlign: 'center', marginTop: spacing[5] }]}>
              {t('onboarding.disclaimer.title')}
            </Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted, textAlign: 'center' }]}>
              {t('onboarding.disclaimer.subtitle')}
            </Text>

            <View
              style={[styles.consentCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
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
                    <Text style={[styles.consentItemText, { color: theme.colors.text }]}>{item.text}</Text>
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
              <Text style={[styles.consentCheckText, { color: theme.colors.text }]}>
                {t('onboarding.disclaimer.accept')}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );

      // ── Welcome ──
      case 3:
        return (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}
          >
            <View style={styles.welcomeIconWrap}>
              <LinearGradient
                colors={[theme.colors.accent + '30', theme.colors.accent + '08']}
                style={styles.welcomeGlow}
              />
              <MaterialCommunityIcons name="lightning-bolt" size={64} color={theme.colors.accent} />
            </View>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>{t('onboarding.welcome')}</Text>
            <Text style={[styles.welcomeDesc, { color: theme.colors.textMuted }]}>{t('onboarding.tagline')}</Text>

            {/* 3 Pillars */}
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
              ].map((p, i) => (
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
                  <Text style={[styles.pillarTitle, { color: theme.colors.text }]}>{p.title}</Text>
                  <Text style={[styles.pillarSub, { color: theme.colors.textMuted }]}>{p.sub}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        );

      // ── Interests & Personal Goals ──
      case 4:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{'What interests you?'}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              {"Select topics you want to explore. We'll recommend content tailored to your growth."}
            </Text>
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
                        <Text
                          style={[styles.equipLabel, { color: selected ? theme.colors.accent : theme.colors.text }]}
                        >
                          {opt.label}
                        </Text>
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
              <Text style={[styles.stepTitle, { color: theme.colors.text, fontSize: typography.sizes.h4 }]}>{'Your personal goal'}</Text>
              <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
                {'What do you want to achieve with FitQuest? Our AI coach will keep this in mind.'}
              </Text>
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

      // ── Goals ──
      case 5:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.goalTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>{t('onboarding.goalSub')}</Text>
            <View style={styles.optionsList}>
              {GOALS.map((g, i) => (
                <Animated.View key={g.id} entering={FadeInRight.delay(i * 60).duration(200)}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setData((d) => ({ ...d, goal: g.id }))}
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
                        {
                          backgroundColor:
                            data.goal === g.id ? theme.colors.accent + '20' : theme.colors.surfaceVariant,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={g.icon as any}
                        size={24}
                        color={data.goal === g.id ? theme.colors.accent : theme.colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{g.label}</Text>
                      <Text style={[styles.optionDesc, { color: theme.colors.textMuted }]}>{g.desc}</Text>
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

      // ── Experience ──
      case 6:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.experienceTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>{t('onboarding.experienceSub')}</Text>
            <View style={styles.optionsList}>
              {EXPERIENCE_LEVELS.map((e, i) => (
                <Animated.View key={e.id} entering={FadeInRight.delay(i * 80).duration(200)}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setData((d) => ({ ...d, experience: e.id }))}
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
                      <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{e.label}</Text>
                      <Text style={[styles.optionDesc, { color: theme.colors.textMuted }]}>{e.desc}</Text>
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

      // ── Body Profile ──
      case 7:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.bodyProfileTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>{t('onboarding.bodyProfileSub')}</Text>
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
                    <Text style={{ color: theme.colors.error, fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] }}>
                      {fieldErrors.weightKg}
                    </Text>
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
                    <Text style={{ color: theme.colors.error, fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] }}>
                      {fieldErrors.heightCm}
                    </Text>
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
                    <Text
                      style={[styles.sexLabel, { color: data.sex === s ? theme.colors.accent : theme.colors.text }]}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
        );

      // ── Schedule ──
      case 8:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.scheduleTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>{t('onboarding.scheduleSub')}</Text>

            <Text style={[styles.sliderLabel, { color: theme.colors.text }]}>
              {t('onboarding.daysPerWeek')}{' '}
              <Text style={{ color: theme.colors.accent, fontWeight: '900' }}>{data.trainingDays}</Text>
            </Text>
            <View style={styles.daysRow}>
              {[2, 3, 4, 5, 6, 7].map((d) => (
                <TouchableOpacity
                  key={d}
                  activeOpacity={0.8}
                  onPress={() => setData((dt) => ({ ...dt, trainingDays: d }))}
                  style={[
                    styles.dayBtn,
                    {
                      backgroundColor: data.trainingDays === d ? theme.colors.accent : theme.colors.surfaceVariant,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={`${d} days per week`}
                  accessibilityState={{ selected: data.trainingDays === d }}
                >
                  <Text
                    style={[
                      styles.dayBtnText,
                      { color: data.trainingDays === d ? theme.colors.onAccent : theme.colors.text },
                    ]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sliderLabel, { color: theme.colors.text, marginTop: spacing[7] }]}>
              {t('onboarding.minutesPerSession')}{' '}
              <Text style={{ color: theme.colors.accent, fontWeight: '900' }}>{data.sessionMinutes}</Text>
            </Text>
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
                  <Text
                    style={[
                      styles.dayBtnText,
                      { color: data.sessionMinutes === m ? theme.colors.onAccent : theme.colors.text },
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        );

      // ── Equipment ──
      case 9:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.equipmentTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>{t('onboarding.equipmentSub')}</Text>
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
                      <Text style={[styles.equipLabel, { color: selected ? theme.colors.accent : theme.colors.text }]}>
                        {eq.label}
                      </Text>
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

      // ── Permissions ──
      case 10: {
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
            desc:
              t('onboarding.perm.motionSub') || 'Track steps, detect exercises, and count reps using motion sensors',
          },
          {
            id: 'location',
            icon: 'map-marker-outline' as const,
            title: t('onboarding.perm.location') || 'Location (Jog Tracking)',
            desc: t('onboarding.perm.locationSub') || 'Map your jog routes and calculate distance accurately',
          },
          ...(Platform.OS === 'android'
            ? [
                // Health Connect is deferred (feature-flagged off) — skip permission request
                {
                  id: 'battery',
                  icon: 'battery-charging' as const,
                  title: t('onboarding.perm.battery') || 'Background Activity',
                  desc:
                    t('onboarding.perm.batterySub') || 'Allow step tracking and health monitoring in the background',
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

        // Health Connect is deferred to v3.0 — no runtime calls
        const requestHealthConnect = async () => {
          setPermissionsGranted((prev) => ({ ...prev, healthConnect: false }));
        };

        const requestBatteryOptimization = async () => {
          try {
            const IntentLauncher = await import('expo-intent-launcher');
            await IntentLauncher.startActivityAsync(
              IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
              { data: 'package:com.hugelet.fitquest' },
            );
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
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>
              {t('onboarding.permTitle') || 'Enable Permissions'}
            </Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              {t('onboarding.permSub') ||
                'These help FitQuest track your health and fitness accurately. You can change them anytime in Settings.'}
            </Text>

            {/* Allow All button */}
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
              <Text style={{ color: theme.colors.accent, fontSize: typography.sizes.bodySmall, fontWeight: '700' }}>Allow All</Text>
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
                        <Text style={[styles.permTitle, { color: granted ? theme.colors.accent : theme.colors.text }]}>
                          {perm.title}
                        </Text>
                        <Text style={[styles.permDesc, { color: theme.colors.textMuted }]} numberOfLines={2}>
                          {perm.desc}
                        </Text>
                      </View>
                      {!granted && (
                        <View style={[styles.permAction, { backgroundColor: theme.colors.accent + '15' }]}>
                          <Text style={{ color: theme.colors.accent, fontSize: typography.sizes.caption, fontWeight: '600' }}>
                            {t('onboarding.perm.allow') || 'Allow'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
            <Text style={[styles.permSkipNote, { color: theme.colors.textMuted }]}>
              {t('onboarding.perm.skipNote') || 'You can skip this — permissions can be enabled later in your profile.'}
            </Text>
          </Animated.View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <ScreenErrorBoundary screenName="Onboarding" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
          <Text style={[styles.stepIndicator, { color: theme.colors.textMuted }]}>
            {step + 1}/{TOTAL_STEPS}
          </Text>
        </View>

        {/* Content */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderStep()}
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
            <Text style={[styles.ctaBtnText, { color: canAdvance() ? theme.colors.onAccent : theme.colors.textMuted }]}>
              {step === TOTAL_STEPS - 1
                ? vm.saving
                  ? t('onboarding.saving')
                  : t('onboarding.getStarted')
                : t('onboarding.continue')}
            </Text>
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
                await vm.skipOnboarding(refreshProfile);
                router.replace('/dashboard');
              }}
              style={{ marginTop: spacing[3] }}
            >
              <Text style={[styles.skipText, { color: theme.colors.textMuted }]}>{t('onboarding.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_H * 0.3 },

  // Progress
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
    gap: spacing[2.5],
  },
  backBtn: { padding: spacing[1] },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  stepIndicator: { fontSize: typography.sizes.label, fontWeight: '700', minWidth: 30, textAlign: 'right' },

  // Content
  scrollContent: { paddingHorizontal: spacing[6], paddingBottom: spacing[10], flexGrow: 1 },
  stepContainer: { paddingTop: spacing[8] },

  // Welcome
  welcomeIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 40,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: spacing[8],
  },
  welcomeGlow: { ...StyleSheet.absoluteFillObject },
  welcomeTitle: {
    fontSize: typography.sizes.display, 
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
  },
  welcomeDesc: {
    fontSize: typography.sizes.body, 
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing[3],
    lineHeight: 24,
  },

  // Pillars
  pillarsRow: { flexDirection: 'row', gap: spacing[2.5], marginTop: spacing[8], paddingHorizontal: spacing[1] },
  pillarCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4.5],
    paddingHorizontal: spacing[2],
    borderRadius: 16,
    borderWidth: 1,
  },
  pillarIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  pillarTitle: { fontSize: typography.sizes.label, fontWeight: '800', textAlign: 'center' },
  pillarSub: { fontSize: typography.sizes.xs, fontWeight: '500', textAlign: 'center', marginTop: spacing[0.75], lineHeight: 14 },

  // Steps
  stepTitle: { fontSize: typography.sizes.h2, fontWeight: '900', letterSpacing: -0.5 },
  stepDesc: { fontSize: typography.sizes.bodySmall, fontWeight: '500', marginTop: spacing[1], marginBottom: spacing[5] },

  // Options
  optionsList: { gap: spacing[2.5] },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
    borderRadius: 16,
    gap: spacing[3],
  },
  optionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: typography.sizes.body, fontWeight: '800' },
  optionDesc: { fontSize: typography.sizes.caption, fontWeight: '500', marginTop: spacing['px'] },

  // Metrics
  inputRow: { flexDirection: 'row', gap: spacing[3] },
  metricInput: { flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: spacing[3.5], paddingVertical: spacing[3] },
  metricField: { fontSize: typography.sizes.bodyMid, fontWeight: '600' },
  sexRow: { flexDirection: 'row', gap: spacing[3] },
  sexBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3.5],
    borderRadius: 14,
  },
  sexLabel: { fontSize: typography.sizes.bodyMid, fontWeight: '700' },

  // Schedule
  sliderLabel: { fontSize: typography.sizes.body, fontWeight: '700', marginBottom: spacing[3.5] },
  daysRow: { flexDirection: 'row', gap: spacing[2.5], flexWrap: 'wrap' },
  dayBtn: { paddingVertical: spacing[3], paddingHorizontal: spacing[4.5], borderRadius: 14, minWidth: 48, alignItems: 'center' },
  dayBtnText: { fontSize: typography.sizes.body, fontWeight: '800' },

  // Equipment
  equipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2.5] },
  equipCard: {
    width: (SCREEN_W - 58) / 2,
    alignItems: 'center',
    paddingVertical: spacing[5],
    borderRadius: 16,
    position: 'relative',
  },
  equipLabel: { fontSize: typography.sizes.label, fontWeight: '700', marginTop: spacing[2] },
  equipCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // CTA
  ctaRow: { paddingHorizontal: spacing[6], paddingBottom: spacing[7], paddingTop: spacing[2], alignItems: 'center' },
  ctaBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[4],
    borderRadius: 16,
    gap: spacing[2],
  },
  ctaBtnText: { fontSize: typography.sizes.body, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  skipText: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },

  // Permissions step
  permCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3.5],
    borderRadius: 14,
    gap: spacing[3],
  },
  permAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing[2],
  },
  permIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: { fontSize: typography.sizes.bodyMid, fontWeight: '700' },
  permDesc: { fontSize: typography.sizes.caption, fontWeight: '500', marginTop: spacing[0.5] },
  permAction: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: 8,
  },
  permSkipNote: { fontSize: typography.sizes.caption, fontWeight: '500', textAlign: 'center', marginTop: spacing[6] },

  // Consent & Age Gate
  consentIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing[4],
    marginTop: spacing[4],
    gap: spacing[3.5],
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  consentItemText: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  consentCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[1],
  },
  consentCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consentCheckText: {
    fontSize: typography.sizes.bodySmall, 
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
});
