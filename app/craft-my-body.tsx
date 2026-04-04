/**
 * FitQuest — Craft My Body
 *
 * AI body-transformation wizard that collects the user's current stats,
 * desired goal, muscle focus areas, and timeline, then generates a
 * personalised BodyCraftAlgorithm covering training split, macros,
 * cardio, and nutrition tips.
 */

import React, { useState, useCallback, useEffect } from 'react';

import { View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ScreenContainer } from '../src/components/ui/primitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { useToast } from '../src/context/ToastContext';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import MedicalDisclaimer from '../src/components/MedicalDisclaimer';
import {
  useCraftMyBodyViewModel,
  type BodyCraftAlgorithm,
  type BodyCraftInputs,
  type BodyType,
  type GoalType,
  type FitnessLevel,
  type ActivityLevel,
  type MusclePriority,
  type TimelineMonths,
} from '../src/viewmodels/useCraftMyBodyViewModel';
import { useDatabase } from '../src/context/DatabaseContext';
import ThemedText from '../src/components/ThemedText';
import { validateNumeric, BODY_RANGES } from '../src/utils/validation';
import ScreenTutorial from '../src/components/ScreenTutorial';
import PremiumGate from '../src/components/PremiumGate';
import { typography, spacing, radius } from '../src/design/theme-system';
import { craftMyBodyStyles as styles } from '../src/components/craft-my-body/styles';

// ============================================
// CONSTANTS
// ============================================

const STEPS = ['Assessment', 'Goal', 'Focus', 'Timeline', 'Results'] as const;
type _Step = (typeof STEPS)[number];

const BODY_TYPES: { key: BodyType; label: string; icon: string; desc: string }[] = [
  { key: 'ectomorph', label: 'Ectomorph', icon: 'human-male', desc: 'Slim build, fast metabolism, lean frame' },
  { key: 'mesomorph', label: 'Mesomorph', icon: 'human-male-board', desc: 'Athletic build, gains muscle easily' },
  {
    key: 'endomorph',
    label: 'Endomorph',
    icon: 'human-greeting-variant',
    desc: 'Stocky build, stores fat more easily',
  },
  {
    key: 'ecto_mesomorph',
    label: 'Ecto-Mesomorph',
    icon: 'run-fast',
    desc: 'Lean & athletic, builds muscle while staying slim',
  },
  {
    key: 'meso_endomorph',
    label: 'Meso-Endomorph',
    icon: 'weight-lifter',
    desc: 'Strong & powerful, gains muscle and fat easily',
  },
  {
    key: 'endo_ectomorph',
    label: 'Endo-Ectomorph',
    icon: 'human-male-height-variant',
    desc: 'Slim upper body, stores fat around lower body',
  },
];

const FITNESS_LEVELS: { key: FitnessLevel; label: string }[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
];

const ACTIVITY_LEVELS: { key: ActivityLevel; label: string; desc: string }[] = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
  { key: 'light', label: 'Light', desc: '1–3 days/week' },
  { key: 'moderate', label: 'Moderate', desc: '3–5 days/week' },
  { key: 'very_active', label: 'Very Active', desc: '6–7 days/week' },
];

const GOAL_OPTIONS: { key: GoalType; label: string; icon: string; desc: string }[] = [
  {
    key: 'lean_athletic',
    label: 'Lean & Athletic',
    icon: 'run-fast',
    desc: 'Low body fat, visible abs, functional strength',
  },
  {
    key: 'muscular_powerful',
    label: 'Muscular & Powerful',
    icon: 'arm-flex',
    desc: 'Max hypertrophy, broad shoulders, big legs',
  },
  {
    key: 'tall_flexible',
    label: 'Tall & Flexible',
    icon: 'yoga',
    desc: 'Posture correction, decompression, elongated muscles',
  },
  {
    key: 'balanced_toned',
    label: 'Balanced & Toned',
    icon: 'meditation',
    desc: 'Moderate muscle, low fat, overall aesthetics',
  },
  { key: 'custom', label: 'Custom', icon: 'tune-vertical', desc: 'Select specific focus areas' },
];

const MUSCLE_GROUPS: { key: string; label: string; icon: string }[] = [
  { key: 'chest', label: 'Chest', icon: 'human-male' },
  { key: 'shoulders', label: 'Shoulders', icon: 'arrow-expand-up' },
  { key: 'arms', label: 'Arms', icon: 'arm-flex' },
  { key: 'back', label: 'Back', icon: 'human-handsup' },
  { key: 'core', label: 'Core / Abs', icon: 'shield-outline' },
  { key: 'glutes', label: 'Glutes', icon: 'seat' },
  { key: 'legs', label: 'Legs', icon: 'walk' },
  { key: 'calves', label: 'Calves', icon: 'shoe-print' },
];

const TIMELINE_OPTIONS: { months: TimelineMonths; label: string; desc: string; icon: string }[] = [
  { months: 3, label: '3 Months', desc: 'Aggressive', icon: 'lightning-bolt' },
  { months: 6, label: '6 Months', desc: 'Balanced', icon: 'scale-balance' },
  { months: 12, label: '12 Months', desc: 'Sustainable', icon: 'leaf' },
];

const PRIORITY_CYCLE: MusclePriority[] = ['maintain', 'priority', 'ignore'];

const getPriorityConfig = (
  colors: typeof import('../src/design/theme-system').colorSystem.dark,
): Record<MusclePriority, { label: string; color: string }> => ({
  priority: { label: 'Priority', color: colors.accent },
  maintain: { label: 'Maintain', color: colors.warning },
  ignore: { label: 'Ignore', color: colors.textMuted },
});

// ============================================
// SCREEN
// ============================================

export default function CraftMyBodyScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const router = useRouter();
  const { isReady: dbReady } = useDatabase();
  const vm = useCraftMyBodyViewModel();

  // Wizard state
  const [stepIndex, setStepIndex] = useState(0);

  // Step 1: Assessment
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [bodyType, setBodyType] = useState<BodyType>('mesomorph');
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('beginner');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');

  // Step 2: Goal
  const [goalType, setGoalType] = useState<GoalType>('balanced_toned');

  // Step 3: Focus areas
  const [musclePriorities, setMusclePriorities] = useState<Record<string, MusclePriority>>(() =>
    Object.fromEntries(MUSCLE_GROUPS.map((m) => [m.key, 'maintain' as MusclePriority])),
  );

  // Step 4: Timeline
  const [timeline, setTimeline] = useState<TimelineMonths>(6);

  // Step 5: Result
  const [algorithm, setAlgorithm] = useState<BodyCraftAlgorithm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Pre-fill height/weight/sex from user profile
  useEffect(() => {
    if (!dbReady) return;
    vm.loadProfilePrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady]);

  // Apply prefill values when available
  useEffect(() => {
    if (!vm.profilePrefill) return;
    if (vm.profilePrefill.heightCm && !heightCm) setHeightCm(vm.profilePrefill.heightCm);
    if (vm.profilePrefill.weightKg && !weightKg) setWeightKg(vm.profilePrefill.weightKg);
    if (vm.profilePrefill.sex) setSex(vm.profilePrefill.sex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.profilePrefill]);

  // ========== Navigation ==========

  const canGoNext = useCallback((): boolean => {
    if (stepIndex === 0) {
      const hv = validateNumeric(heightCm, BODY_RANGES.heightCm);
      const wv = validateNumeric(weightKg, BODY_RANGES.weightKg);
      const av = validateNumeric(age, BODY_RANGES.age);
      return hv.valid && wv.valid && av.valid;
    }
    return true;
  }, [stepIndex, heightCm, weightKg, age]);

  const goNext = useCallback(() => {
    if (stepIndex === 0) {
      // Validate measurements before advancing
      const errs: Record<string, string> = {};
      const hv = validateNumeric(heightCm, BODY_RANGES.heightCm);
      const wv = validateNumeric(weightKg, BODY_RANGES.weightKg);
      const av = validateNumeric(age, BODY_RANGES.age);
      if (!hv.valid) errs.heightCm = hv.error!;
      if (!wv.valid) errs.weightKg = wv.error!;
      if (!av.valid) errs.age = av.error!;
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        return;
      }
      setFieldErrors({});
    }

    if (stepIndex === 3) {
      // Generate algorithm
      const inputs: BodyCraftInputs = {
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        age: Number(age),
        sex,
        body_type: bodyType,
        fitness_level: fitnessLevel,
        activity_level: activityLevel,
        goal_type: goalType,
        muscle_priorities: musclePriorities,
        timeline_months: timeline,
      };
      const algo = vm.generate(inputs);
      setAlgorithm(algo);
      setStepIndex(4);
      return;
    }
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
  }, [
    stepIndex,
    heightCm,
    weightKg,
    age,
    sex,
    bodyType,
    fitnessLevel,
    activityLevel,
    goalType,
    musclePriorities,
    timeline,
  ]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else router.canGoBack() ? router.back() : router.replace('/dashboard');
  }, [stepIndex, router]);

  const toggleMusclePriority = useCallback((key: string) => {
    setMusclePriorities((prev) => {
      const current = prev[key] ?? ('maintain' as MusclePriority);
      const idx = PRIORITY_CYCLE.indexOf(current);
      const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length] ?? ('maintain' as MusclePriority);
      return { ...prev, [key]: next };
    });
  }, []);

  const handleApply = useCallback(async () => {
    if (!algorithm) return;
    const success = await vm.applyAlgorithm(algorithm);
    if (success) {
      showToast({ message: t('craftBody.appliedAlert') || 'Algorithm applied!', type: 'success' });
    } else {
      showToast({ message: t('craftBody.errorDetail') || 'Failed to apply algorithm', type: 'error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algorithm]);

  // ========== Styles ==========

  const colors = theme.colors;
  const isDark = theme.isDark;

  const inputStyle = [
    styles.textInput,
    {
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      color: colors.text,
    },
  ];

  // ========== STEP RENDERERS ==========

  const renderProgressBar = () => (
    <Animated.View entering={FadeIn.duration(150)} style={styles.progressContainer}>
      <View style={styles.progressRow}>
        {STEPS.map((label, i) => {
          const isActive = i === stepIndex;
          const isDone = i < stepIndex;
          return (
            <View key={label} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: isDone
                      ? colors.accent
                      : isActive
                        ? colors.accent
                        : isDark
                          ? 'rgba(255,255,255,0.15)'
                          : 'rgba(0,0,0,0.1)',
                    transform: [{ scale: isActive ? 1.3 : 1 }],
                  },
                ]}
              >
                {isDone && <MaterialCommunityIcons name="check" size={10} color={theme.colors.onAccent} />}
              </View>
              <ThemedText
                style={[
                  styles.progressLabel,
                  { color: isActive ? colors.accent : colors.textMuted, fontWeight: isActive ? '700' : '400' },
                ]}
              >
                {label}
              </ThemedText>
            </View>
          );
        })}
      </View>
      {/* Connecting line */}
      <View style={[styles.progressLine, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressLineFill,
            { backgroundColor: colors.accent, width: `${(stepIndex / (STEPS.length - 1)) * 100}%` },
          ]}
        />
      </View>
    </Animated.View>
  );

  // ---- Step 1: Assessment ----
  const renderAssessment = () => (
    <Animated.View entering={FadeInDown.duration(150)} key="step-assessment">
      <SectionHeader title={t('craftBody.bodyAssessment')} />

      {/* Sex */}
      <GlassCard style={styles.card}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Sex</ThemedText>
        <View style={styles.chipRow}>
          {(['male', 'female'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSex(s)}
              accessibilityRole="radio"
              accessibilityLabel={s === 'male' ? 'Male' : 'Female'}
              accessibilityState={{ selected: sex === s }}
              style={[
                styles.chip,
                {
                  backgroundColor: sex === s ? colors.accent : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: sex === s ? colors.accent : 'transparent',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={s === 'male' ? 'gender-male' : 'gender-female'}
                size={18}
                color={sex === s ? colors.onAccent : colors.textMuted}
              />
              <ThemedText style={[styles.chipText, { color: sex === s ? colors.onAccent : colors.text }]}>
                {s === 'male' ? 'Male' : 'Female'}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>

      {/* Height / Weight / Age */}
      <GlassCard style={styles.card}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Measurements</ThemedText>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: colors.textMuted }]}>
              {t('craftBody.heightLabel')}
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={heightCm}
              onChangeText={(v) => {
                setHeightCm(v);
                if (fieldErrors.heightCm) setFieldErrors((e) => ({ ...e, heightCm: '' }));
              }}
              keyboardType="numeric"
              maxLength={6}
              placeholder="175"
              placeholderTextColor={colors.textMuted}
            />
            {!!fieldErrors.heightCm && (
              <ThemedText
                style={{ color: colors.error, fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] }}
              >
                {fieldErrors.heightCm}
              </ThemedText>
            )}
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: colors.textMuted }]}>
              {t('craftBody.weightLabel')}
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={weightKg}
              onChangeText={(v) => {
                setWeightKg(v);
                if (fieldErrors.weightKg) setFieldErrors((e) => ({ ...e, weightKg: '' }));
              }}
              keyboardType="numeric"
              maxLength={6}
              placeholder="70"
              placeholderTextColor={colors.textMuted}
            />
            {!!fieldErrors.weightKg && (
              <ThemedText
                style={{ color: colors.error, fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] }}
              >
                {fieldErrors.weightKg}
              </ThemedText>
            )}
          </View>
          <View style={styles.inputGroup}>
            <ThemedText style={[styles.inputLabel, { color: colors.textMuted }]}>{t('craftBody.ageLabel')}</ThemedText>
            <TextInput
              style={inputStyle}
              value={age}
              onChangeText={(v) => {
                setAge(v);
                if (fieldErrors.age) setFieldErrors((e) => ({ ...e, age: '' }));
              }}
              keyboardType="numeric"
              maxLength={3}
              placeholder="25"
              placeholderTextColor={colors.textMuted}
            />
            {!!fieldErrors.age && (
              <ThemedText
                style={{ color: colors.error, fontSize: typography.sizes.captionSm, marginTop: spacing[0.5] }}
              >
                {fieldErrors.age}
              </ThemedText>
            )}
          </View>
        </View>
      </GlassCard>

      {/* Body Type */}
      <GlassCard style={styles.card}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Body Type</ThemedText>
        {BODY_TYPES.map((bt) => (
          <TouchableOpacity
            key={bt.key}
            onPress={() => setBodyType(bt.key)}
            accessibilityRole="radio"
            accessibilityLabel={`${bt.label}: ${bt.desc}`}
            accessibilityState={{ selected: bodyType === bt.key }}
            style={[
              styles.optionRow,
              {
                backgroundColor: bodyType === bt.key ? `${colors.accent}18` : 'transparent',
                borderColor:
                  bodyType === bt.key ? colors.accent : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <MaterialCommunityIcons
              name={bt.icon as any}
              size={24}
              color={bodyType === bt.key ? colors.accent : colors.textMuted}
            />
            <View style={styles.optionText}>
              <ThemedText style={[styles.optionTitle, { color: colors.text }]}>{bt.label}</ThemedText>
              <ThemedText style={[styles.optionDesc, { color: colors.textMuted }]}>{bt.desc}</ThemedText>
            </View>
            {bodyType === bt.key && <MaterialCommunityIcons name="check-circle" size={20} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </GlassCard>

      {/* Fitness Level */}
      <GlassCard style={styles.card}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Fitness Level</ThemedText>
        <View style={styles.chipRow}>
          {FITNESS_LEVELS.map((fl) => (
            <TouchableOpacity
              key={fl.key}
              onPress={() => setFitnessLevel(fl.key)}
              accessibilityRole="radio"
              accessibilityLabel={fl.label}
              accessibilityState={{ selected: fitnessLevel === fl.key }}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    fitnessLevel === fl.key ? colors.accent : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: fitnessLevel === fl.key ? colors.accent : 'transparent',
                },
              ]}
            >
              <ThemedText style={[styles.chipText, { color: fitnessLevel === fl.key ? colors.onAccent : colors.text }]}>
                {fl.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>

      {/* Activity Level */}
      <GlassCard style={styles.card}>
        <ThemedText style={[styles.label, { color: colors.text }]}>Activity Level</ThemedText>
        {ACTIVITY_LEVELS.map((al) => (
          <TouchableOpacity
            key={al.key}
            onPress={() => setActivityLevel(al.key)}
            style={[
              styles.optionRow,
              {
                backgroundColor: activityLevel === al.key ? `${colors.accent}18` : 'transparent',
                borderColor:
                  activityLevel === al.key ? colors.accent : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <View style={styles.optionText}>
              <ThemedText style={[styles.optionTitle, { color: colors.text }]}>{al.label}</ThemedText>
              <ThemedText style={[styles.optionDesc, { color: colors.textMuted }]}>{al.desc}</ThemedText>
            </View>
            {activityLevel === al.key && <MaterialCommunityIcons name="check-circle" size={20} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </GlassCard>
    </Animated.View>
  );

  // ---- Step 2: Goal Selection ----
  const renderGoalSelection = () => (
    <Animated.View entering={FadeInDown.duration(150)} key="step-goal">
      <SectionHeader title={t('craftBody.chooseGoal')} />
      {GOAL_OPTIONS.map((g) => (
        <GlassCard key={g.key} style={styles.card} onPress={() => setGoalType(g.key)}>
          <View
            style={[
              styles.goalRow,
              {
                borderColor: goalType === g.key ? colors.accent : 'transparent',
                backgroundColor: goalType === g.key ? `${colors.accent}12` : 'transparent',
              },
            ]}
          >
            <View
              style={[styles.goalIcon, { backgroundColor: goalType === g.key ? colors.accent : colors.surfaceVariant }]}
            >
              <MaterialCommunityIcons
                name={g.icon as any}
                size={28}
                color={goalType === g.key ? colors.onAccent : colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.goalTitle, { color: colors.text }]}>{g.label}</ThemedText>
              <ThemedText style={[styles.goalDesc, { color: colors.textMuted }]}>{g.desc}</ThemedText>
            </View>
            {goalType === g.key && <MaterialCommunityIcons name="check-circle" size={22} color={colors.accent} />}
          </View>
        </GlassCard>
      ))}
    </Animated.View>
  );

  // ---- Step 3: Focus Areas ----
  const renderFocusAreas = () => (
    <Animated.View entering={FadeInDown.duration(150)} key="step-focus">
      <SectionHeader title={t('craftBody.focusAreas')} />
      <ThemedText style={[styles.focusHint, { color: colors.textMuted }]}>
        Tap to cycle: Maintain → Priority → Ignore
      </ThemedText>
      <View style={styles.muscleGrid}>
        {MUSCLE_GROUPS.map((mg) => {
          const priority: MusclePriority = musclePriorities[mg.key] ?? 'maintain';
          const cfg = getPriorityConfig(colors)[priority];
          return (
            <TouchableOpacity
              key={mg.key}
              onPress={() => toggleMusclePriority(mg.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${mg.label}: ${cfg.label}. Tap to cycle priority`}
            >
              <GlassCard
                style={{ ...styles.muscleCard, borderColor: cfg.color, borderWidth: priority === 'priority' ? 2 : 1 }}
              >
                <MaterialCommunityIcons name={mg.icon as any} size={28} color={cfg.color} />
                <ThemedText style={[styles.muscleLabel, { color: colors.text }]}>{mg.label}</ThemedText>
                <View style={[styles.priorityBadge, { backgroundColor: cfg.color }]}>
                  <ThemedText style={[styles.priorityText, { color: colors.text }]}>{cfg.label}</ThemedText>
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );

  // ---- Step 4: Timeline ----
  const renderTimeline = () => (
    <Animated.View entering={FadeInDown.duration(150)} key="step-timeline">
      <SectionHeader title={t('craftBody.yourTimeline')} />
      {TIMELINE_OPTIONS.map((t) => (
        <GlassCard key={t.months} style={styles.card} onPress={() => setTimeline(t.months)}>
          <View
            style={[
              styles.goalRow,
              {
                borderColor: timeline === t.months ? colors.accent : 'transparent',
                backgroundColor: timeline === t.months ? `${colors.accent}12` : 'transparent',
              },
            ]}
          >
            <View
              style={[
                styles.goalIcon,
                { backgroundColor: timeline === t.months ? colors.accent : colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name={t.icon as any}
                size={28}
                color={timeline === t.months ? colors.onAccent : colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.goalTitle, { color: colors.text }]}>{t.label}</ThemedText>
              <ThemedText style={[styles.goalDesc, { color: colors.textMuted }]}>{t.desc}</ThemedText>
            </View>
            {timeline === t.months && <MaterialCommunityIcons name="check-circle" size={22} color={colors.accent} />}
          </View>
        </GlassCard>
      ))}
    </Animated.View>
  );

  // ---- Step 5: Results ----
  const renderResults = () => {
    if (!algorithm) return null;

    const macroTotal = algorithm.protein_g * 4 + algorithm.carbs_g * 4 + algorithm.fats_g * 9;
    const proteinPct = macroTotal > 0 ? Math.round(((algorithm.protein_g * 4) / macroTotal) * 100) : 0;
    const carbsPct = macroTotal > 0 ? Math.round(((algorithm.carbs_g * 4) / macroTotal) * 100) : 0;
    const fatsPct = macroTotal > 0 ? Math.round(((algorithm.fats_g * 9) / macroTotal) * 100) : 0;

    return (
      <Animated.View entering={FadeInDown.duration(150)} key="step-results">
        <SectionHeader title={t('craftBody.yourPlan')} />

        {/* Training Split */}
        <GlassCard style={styles.card}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="calendar-week" size={22} color={colors.accent} />
            <ThemedText style={[styles.resultTitle, { color: colors.text }]}>Training Split</ThemedText>
          </View>
          <ThemedText style={[styles.resultValue, { color: colors.accent }]}>
            {algorithm.recommended_training_split}
          </ThemedText>
          <ThemedText style={[styles.resultSub, { color: colors.textMuted }]}>
            {algorithm.training_days_per_week} days/week
          </ThemedText>

          <View style={styles.scheduleRow}>
            {algorithm.weekly_schedule.map((day, i) => {
              const isRest = day === 'Rest';
              return (
                <View
                  key={i}
                  style={[
                    styles.scheduleDay,
                    {
                      backgroundColor: isRest
                        ? isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)'
                        : `${colors.accent}20`,
                    },
                  ]}
                >
                  <ThemedText style={[styles.scheduleDayLabel, { color: colors.textMuted }]}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.scheduleDayText,
                      { color: isRest ? colors.textMuted : colors.accent, fontWeight: isRest ? '400' : '600' },
                    ]}
                  >
                    {day}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Macros */}
        <GlassCard style={styles.card}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="food-apple-outline" size={22} color={colors.accent} />
            <ThemedText style={[styles.resultTitle, { color: colors.text }]}>Daily Nutrition</ThemedText>
          </View>
          <ThemedText style={[styles.caloriesBig, { color: colors.text }]}>
            {algorithm.calories_target}{' '}
            <ThemedText style={{ fontSize: typography.sizes.body, color: colors.textMuted }}>kcal/day</ThemedText>
          </ThemedText>

          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <ThemedText style={[styles.macroValue, { color: colors.error }]}>{algorithm.protein_g}g</ThemedText>
              <ThemedText style={[styles.macroLabel, { color: colors.textMuted }]}>Protein ({proteinPct}%)</ThemedText>
            </View>
            <View style={styles.macroItem}>
              <ThemedText style={[styles.macroValue, { color: colors.warning }]}>{algorithm.carbs_g}g</ThemedText>
              <ThemedText style={[styles.macroLabel, { color: colors.textMuted }]}>Carbs ({carbsPct}%)</ThemedText>
            </View>
            <View style={styles.macroItem}>
              <ThemedText style={[styles.macroValue, { color: colors.purple }]}>{algorithm.fats_g}g</ThemedText>
              <ThemedText style={[styles.macroLabel, { color: colors.textMuted }]}>Fats ({fatsPct}%)</ThemedText>
            </View>
          </View>

          {/* Macro bar */}
          <View style={[styles.macroBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
            <View
              style={{
                flex: proteinPct,
                backgroundColor: colors.error,
                borderTopLeftRadius: 4,
                borderBottomLeftRadius: 4,
              }}
            />
            <View style={{ flex: carbsPct, backgroundColor: colors.warning }} />
            <View
              style={{
                flex: fatsPct,
                backgroundColor: colors.purple,
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
              }}
            />
          </View>
        </GlassCard>

        {/* Daily Targets */}
        <GlassCard style={styles.card}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="target" size={22} color={colors.accent} />
            <ThemedText style={[styles.resultTitle, { color: colors.text }]}>Daily Targets</ThemedText>
          </View>
          <View style={styles.targetRow}>
            <View style={styles.targetItem}>
              <MaterialCommunityIcons name="water" size={24} color={colors.skyBlue} />
              <ThemedText style={[styles.targetValue, { color: colors.text }]}>
                {algorithm.daily_water_liters}L
              </ThemedText>
              <ThemedText style={[styles.targetLabel, { color: colors.textMuted }]}>Water</ThemedText>
            </View>
            <View style={styles.targetItem}>
              <MaterialCommunityIcons name="weather-night" size={24} color={colors.purpleLight} />
              <ThemedText style={[styles.targetValue, { color: colors.text }]}>{algorithm.sleep_hours}h</ThemedText>
              <ThemedText style={[styles.targetLabel, { color: colors.textMuted }]}>Sleep</ThemedText>
            </View>
            <View style={styles.targetItem}>
              <MaterialCommunityIcons name="run" size={24} color={colors.pinkLight} />
              <ThemedText style={[styles.targetValue, { color: colors.text }]}>
                {algorithm.cardio_minutes_per_week}m
              </ThemedText>
              <ThemedText style={[styles.targetLabel, { color: colors.textMuted }]}>Cardio/wk</ThemedText>
            </View>
          </View>
        </GlassCard>

        {/* Nutrition Tips */}
        <GlassCard style={styles.card}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={colors.accent} />
            <ThemedText style={[styles.resultTitle, { color: colors.text }]}>Nutrition Tips</ThemedText>
          </View>
          {algorithm.nutrition_tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={16}
                color={colors.accent}
                style={{ marginTop: spacing[0.5] }}
              />
              <ThemedText style={[styles.tipText, { color: colors.text }]}>{tip}</ThemedText>
            </View>
          ))}
        </GlassCard>

        {/* Apply Button */}
        <View style={styles.applyContainer}>
          <GradientButton
            title={vm.applied ? t('craftBody.applied') : t('craftBody.applyToTraining')}
            onPress={handleApply}
            icon={vm.applied ? 'check-circle' : 'rocket-launch'}
            disabled={vm.applied}
          />
        </View>
      </Animated.View>
    );
  };

  // ========== MAIN RENDER ==========

  const stepContent = [renderAssessment, renderGoalSelection, renderFocusAreas, renderTimeline, renderResults];

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScreenErrorBoundary screenName="CraftMyBody" onGoBack={() => (router.canGoBack() ? router.back() : undefined)}>
      <PremiumGate featureName="Body Craft Algorithm">
        <ScreenContainer edges={['bottom']}>
          <ScreenTutorial
            screenKey="craft-my-body"
            icon="human-male-board"
            title="Craft My Body"
            description="Build your ideal physique with our AI body-transformation wizard. Enter your stats, choose your goal, select focus areas, and get a personalized plan."
          />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {stepIndex === 0 && <MedicalDisclaimer screen="craft-my-body" compact />}
            {renderProgressBar()}
            {stepContent[stepIndex]?.()}
          </ScrollView>

          {/* Bottom Nav Bar */}
          {stepIndex < 4 && (
            <Animated.View
              entering={FadeIn.duration(150)}
              style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
            >
              <TouchableOpacity
                onPress={goBack}
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: colors.surfaceVariant,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2.5],
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textMuted} />
                <ThemedText style={[styles.navBtnText, { color: colors.text }]}>Back</ThemedText>
              </TouchableOpacity>

              <ThemedText style={[styles.stepIndicator, { color: colors.textMuted }]}>
                {stepIndex + 1} / {STEPS.length}
              </ThemedText>

              <TouchableOpacity
                onPress={goNext}
                disabled={!canGoNext()}
                accessibilityRole="button"
                accessibilityLabel={stepIndex === 3 ? 'Generate plan' : 'Next step'}
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: canGoNext() ? colors.accent + '20' : colors.surfaceVariant,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2.5],
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: canGoNext() ? colors.accent : colors.border,
                    opacity: canGoNext() ? 1 : 0.6,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.navBtnText,
                    { color: canGoNext() ? colors.accent : colors.textMuted, fontWeight: '700' },
                  ]}
                >
                  {stepIndex === 3 ? 'Generate' : 'Next'}
                </ThemedText>
                <MaterialCommunityIcons
                  name={stepIndex === 3 ? 'creation' : 'arrow-right'}
                  size={20}
                  color={canGoNext() ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>
            </Animated.View>
          )}

          {stepIndex === 4 && (
            <Animated.View
              entering={FadeIn.duration(150)}
              style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
            >
              <TouchableOpacity
                onPress={goBack}
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: colors.surfaceVariant,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2.5],
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color={colors.text} />
                <ThemedText style={[styles.navBtnText, { color: colors.text }]}>Edit</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: colors.accent + '20',
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2.5],
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <ThemedText style={[styles.navBtnText, { color: colors.accent, fontWeight: '700' }]}>Done</ThemedText>
                <MaterialCommunityIcons name="check" size={20} color={colors.accent} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScreenContainer>
      </PremiumGate>
    </ScreenErrorBoundary>
  );
}
