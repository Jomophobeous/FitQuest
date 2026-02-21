/**
 * FitQuest Onboarding Screen
 *
 * Multi-step onboarding: Welcome → Goals → Experience → Schedule → Profile → Done.
 * Saves preferences to SQLite user_profile. Figma-inspired UI with lime accent.
 */

import React, { useState, useRef } from 'react';
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
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useLanguage } from '../src/context/LanguageContext';
import { createUserProfile, setUserEquipment } from '../src/database/service';
import { EquipmentItem } from '../src/database/types';
import { GlassCard, GradientButton } from '../src/components/ui/GlassUI';
import { validateNumeric, BODY_RANGES } from '../src/utils/validation';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Must match SQLite CHECK constraint: ('body_control','posture','speed','mobility','focus','strength')
type Goal = 'body_control' | 'posture' | 'speed' | 'mobility' | 'focus' | 'strength';
// Must match SQLite CHECK constraint: ('beginner','intermediate','advanced')
type Experience = 'beginner' | 'intermediate' | 'advanced';

interface OnboardingData {
  goal: Goal | null;
  experience: Experience | null;
  trainingDays: number;
  sessionMinutes: number;
  weightKg: string;
  heightCm: string;
  sex: 'male' | 'female' | null;
  equipment: EquipmentItem[];
}

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const isDark = theme.isDark;

  const GOALS: { id: Goal; label: string; icon: string; desc: string }[] = [
    { id: 'strength', label: t('onboarding.goal.buildMuscle'), icon: 'arm-flex', desc: t('onboarding.goal.buildMuscleSub') },
    { id: 'body_control', label: t('onboarding.goal.loseFat'), icon: 'fire', desc: t('onboarding.goal.loseFatSub') },
    { id: 'speed', label: t('onboarding.goal.endurance'), icon: 'run-fast', desc: t('onboarding.goal.enduranceSub') },
    { id: 'mobility', label: t('onboarding.goal.flexibility'), icon: 'human-greeting-variant', desc: t('onboarding.goal.flexibilitySub') },
    { id: 'focus', label: t('onboarding.goal.generalFitness'), icon: 'heart-pulse', desc: t('onboarding.goal.generalFitnessSub') },
  ];

  const EXPERIENCE_LEVELS: { id: Experience; label: string; desc: string; icon: string }[] = [
    { id: 'beginner', label: t('onboarding.experience.beginner'), desc: t('onboarding.experience.beginnerSub'), icon: 'sprout' },
    { id: 'intermediate', label: t('onboarding.experience.intermediate'), desc: t('onboarding.experience.intermediateSub'), icon: 'tree' },
    { id: 'advanced', label: t('onboarding.experience.advanced'), desc: t('onboarding.experience.advancedSub'), icon: 'trophy' },
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
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return true; // Welcome
      case 1: return !!data.goal;
      case 2: return !!data.experience;
      case 3: return data.trainingDays > 0;
      case 4: return true; // Equipment is optional
      default: return false;
    }
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finishOnboarding();
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
  };

  const finishOnboarding = async () => {
    // Validate optional numeric body stats
    const errors: Record<string, string> = {};
    let parsedWeight: number | undefined;
    let parsedHeight: number | undefined;

    if (data.weightKg.trim()) {
      const wv = validateNumeric(data.weightKg, BODY_RANGES.weightKg, false);
      if (!wv.valid) { errors.weightKg = wv.error!; }
      else { parsedWeight = wv.value || undefined; }
    }
    if (data.heightCm.trim()) {
      const hv = validateNumeric(data.heightCm, BODY_RANGES.heightCm, false);
      if (!hv.valid) { errors.heightCm = hv.error!; }
      else { parsedHeight = hv.value || undefined; }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      await createUserProfile({
        id: 'user_local_001',
        sex: data.sex ?? undefined,
        weight_kg: parsedWeight,
        height_cm: parsedHeight,
        goal: data.goal ?? 'body_control',
        experience: data.experience ?? 'beginner',
        training_days_per_week: data.trainingDays,
        time_per_session_minutes: data.sessionMinutes,
        locked: false,
      } as any);

      if (data.equipment.length > 0) {
        await setUserEquipment('user_local_001', data.equipment);
      }
    } catch (e) {
      console.warn('[Onboarding] Profile save error:', e);
    }
    setSaving(false);
    router.replace('/dashboard');
  };

  const toggleEquipment = (item: EquipmentItem) => {
    setData(d => ({
      ...d,
      equipment: d.equipment.includes(item)
        ? d.equipment.filter(e => e !== item)
        : [...d.equipment, item],
    }));
  };

  // ── Step Content ──
  const renderStep = () => {
    switch (step) {
      // ── Welcome ──
      case 0:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <View style={styles.welcomeIconWrap}>
              <LinearGradient colors={[theme.colors.accent + '30', theme.colors.accent + '08']} style={styles.welcomeGlow} />
              <MaterialCommunityIcons name="lightning-bolt" size={64} color={theme.colors.accent} />
            </View>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
              {t('onboarding.welcome')}
            </Text>
            <Text style={[styles.welcomeDesc, { color: theme.colors.textMuted }]}>
              {t('onboarding.tagline')}
            </Text>
          </Animated.View>
        );

      // ── Goals ──
      case 1:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.goalTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              {t('onboarding.goalSub')}
            </Text>
            <View style={styles.optionsList}>
              {GOALS.map((g, i) => (
                <Animated.View key={g.id} entering={FadeInRight.delay(i * 60).duration(200)}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setData(d => ({ ...d, goal: g.id }))}
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                        borderColor: data.goal === g.id ? theme.colors.accent : theme.colors.border,
                        borderWidth: data.goal === g.id ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: data.goal === g.id ? theme.colors.accent + '20' : theme.colors.surfaceVariant }]}>
                      <MaterialCommunityIcons name={g.icon as any} size={24} color={data.goal === g.id ? theme.colors.accent : theme.colors.textMuted} />
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
      case 2:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.experienceTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              {t('onboarding.experienceSub')}
            </Text>
            <View style={styles.optionsList}>
              {EXPERIENCE_LEVELS.map((e, i) => (
                <Animated.View key={e.id} entering={FadeInRight.delay(i * 80).duration(200)}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setData(d => ({ ...d, experience: e.id }))}
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: isDark ? theme.colors.surfaceVariant : theme.colors.surface,
                        borderColor: data.experience === e.id ? theme.colors.accent : theme.colors.border,
                        borderWidth: data.experience === e.id ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: data.experience === e.id ? theme.colors.accent + '20' : theme.colors.surfaceVariant }]}>
                      <MaterialCommunityIcons name={e.icon as any} size={24} color={data.experience === e.id ? theme.colors.accent : theme.colors.textMuted} />
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

              {/* Quick body metrics */}
              <View style={{ marginTop: 16, gap: 12 }}>
                <View style={styles.inputRow}>
                  <View style={[styles.metricInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <TextInput
                      style={[styles.metricField, { color: theme.colors.text }]}
                      placeholder={t('onboarding.weightPlaceholder')}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="numeric"
                      maxLength={6}
                      value={data.weightKg}
                      onChangeText={v => {
                        setData(d => ({ ...d, weightKg: v }));
                        if (fieldErrors.weightKg) setFieldErrors(e => ({ ...e, weightKg: '' }));
                      }}
                    />
                    {!!fieldErrors.weightKg && <Text style={{ color: theme.colors.error, fontSize: 11, marginTop: 2 }}>{fieldErrors.weightKg}</Text>}
                  </View>
                  <View style={[styles.metricInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <TextInput
                      style={[styles.metricField, { color: theme.colors.text }]}
                      placeholder={t('onboarding.heightPlaceholder')}
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="numeric"
                      maxLength={6}
                      value={data.heightCm}
                      onChangeText={v => {
                        setData(d => ({ ...d, heightCm: v }));
                        if (fieldErrors.heightCm) setFieldErrors(e => ({ ...e, heightCm: '' }));
                      }}
                    />
                  </View>
                </View>
                <View style={styles.sexRow}>
                  {(['male', 'female'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      activeOpacity={0.8}
                      onPress={() => setData(d => ({ ...d, sex: s }))}
                      style={[
                        styles.sexBtn,
                        {
                          backgroundColor: data.sex === s ? theme.colors.accent + '20' : theme.colors.surface,
                          borderColor: data.sex === s ? theme.colors.accent : theme.colors.border,
                          borderWidth: data.sex === s ? 2 : 1,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={s === 'male' ? 'gender-male' : 'gender-female'}
                        size={20}
                        color={data.sex === s ? theme.colors.accent : theme.colors.textMuted}
                      />
                      <Text style={[styles.sexLabel, { color: data.sex === s ? theme.colors.accent : theme.colors.text }]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        );

      // ── Schedule ──
      case 3:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.scheduleTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              {t('onboarding.scheduleSub')}
            </Text>

            <Text style={[styles.sliderLabel, { color: theme.colors.text }]}>
              {t('onboarding.daysPerWeek')} <Text style={{ color: theme.colors.accent, fontWeight: '900' }}>{data.trainingDays}</Text>
            </Text>
            <View style={styles.daysRow}>
              {[2, 3, 4, 5, 6, 7].map(d => (
                <TouchableOpacity
                  key={d}
                  activeOpacity={0.8}
                  onPress={() => setData(dt => ({ ...dt, trainingDays: d }))}
                  style={[
                    styles.dayBtn,
                    {
                      backgroundColor: data.trainingDays === d ? theme.colors.accent : theme.colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text style={[styles.dayBtnText, { color: data.trainingDays === d ? theme.colors.onAccent : theme.colors.text }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sliderLabel, { color: theme.colors.text, marginTop: 28 }]}>
              {t('onboarding.minutesPerSession')} <Text style={{ color: theme.colors.accent, fontWeight: '900' }}>{data.sessionMinutes}</Text>
            </Text>
            <View style={styles.daysRow}>
              {[20, 30, 45, 60, 90].map(m => (
                <TouchableOpacity
                  key={m}
                  activeOpacity={0.8}
                  onPress={() => setData(dt => ({ ...dt, sessionMinutes: m }))}
                  style={[
                    styles.dayBtn,
                    {
                      backgroundColor: data.sessionMinutes === m ? theme.colors.accent : theme.colors.surfaceVariant,
                      paddingHorizontal: 14,
                    },
                  ]}
                >
                  <Text style={[styles.dayBtnText, { color: data.sessionMinutes === m ? theme.colors.onAccent : theme.colors.text }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        );

      // ── Equipment ──
      case 4:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>{t('onboarding.equipmentTitle')}</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              {t('onboarding.equipmentSub')}
            </Text>
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

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={[theme.colors.accent + '06', 'transparent', 'transparent']}
        style={styles.bgGlow}
      />

      {/* Progress bar */}
      <View style={styles.progressRow}>
        {step > 0 && (
          <TouchableOpacity onPress={back} style={styles.backBtn}>
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStep()}
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaRow}>
        <TouchableOpacity
          style={[
            styles.ctaBtn,
            {
              backgroundColor: canAdvance() ? theme.colors.accent : theme.colors.surfaceVariant,
              opacity: canAdvance() ? 1 : 0.5,
            },
          ]}
          onPress={next}
          disabled={!canAdvance() || saving}
          activeOpacity={0.9}
        >
          <Text style={[styles.ctaBtnText, { color: canAdvance() ? theme.colors.onAccent : theme.colors.textMuted }]}>
            {step === TOTAL_STEPS - 1 ? (saving ? t('onboarding.saving') : t('onboarding.getStarted')) : t('onboarding.continue')}
          </Text>
          {step < TOTAL_STEPS - 1 && (
            <MaterialCommunityIcons name="arrow-right" size={20} color={canAdvance() ? theme.colors.onAccent : theme.colors.textMuted} />
          )}
        </TouchableOpacity>

        {step === 0 && (
          <TouchableOpacity onPress={() => router.replace('/dashboard')} style={{ marginTop: 12 }}>
            <Text style={[styles.skipText, { color: theme.colors.textMuted }]}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_H * 0.3 },

  // Progress
  progressRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 10 },
  backBtn: { padding: 4 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  stepIndicator: { fontSize: 13, fontWeight: '700', minWidth: 30, textAlign: 'right' },

  // Content
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1 },
  stepContainer: { paddingTop: 32 },

  // Welcome
  welcomeIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 40,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 32,
  },
  welcomeGlow: { ...StyleSheet.absoluteFillObject },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
  },
  welcomeDesc: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },

  // Steps
  stepTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  stepDesc: { fontSize: 14, fontWeight: '500', marginTop: 4, marginBottom: 20 },

  // Options
  optionsList: { gap: 10 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  optionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  optionLabel: { fontSize: 16, fontWeight: '800' },
  optionDesc: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  // Metrics
  inputRow: { flexDirection: 'row', gap: 12 },
  metricInput: { flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  metricField: { fontSize: 15, fontWeight: '600' },
  sexRow: { flexDirection: 'row', gap: 12 },
  sexBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  sexLabel: { fontSize: 15, fontWeight: '700' },

  // Schedule
  sliderLabel: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  daysRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  dayBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14, minWidth: 48, alignItems: 'center' },
  dayBtnText: { fontSize: 16, fontWeight: '800' },

  // Equipment
  equipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  equipCard: {
    width: (SCREEN_W - 58) / 2,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    position: 'relative',
  },
  equipLabel: { fontSize: 13, fontWeight: '700', marginTop: 8 },
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
  ctaRow: { paddingHorizontal: 24, paddingBottom: 24, alignItems: 'center' },
  ctaBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  skipText: { fontSize: 14, fontWeight: '600' },
});
