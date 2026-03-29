/**
 * FitQuest — Craft My Body
 *
 * AI body-transformation wizard that collects the user's current stats,
 * desired goal, muscle focus areas, and timeline, then generates a
 * personalised BodyCraftAlgorithm covering training split, macros,
 * cardio, and nutrition tips.
 */

import React, { useState, useCallback, useEffect } from 'react';

import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { ScreenErrorBoundary } from '../src/components/ScreenErrorBoundary';
import { useLanguage } from '../src/context/LanguageContext';
import { GlassCard, GradientButton, SectionHeader } from '../src/components/ui/GlassUI';
import MedicalDisclaimer from '../src/components/MedicalDisclaimer';
import {
  generateBodyCraftAlgorithm,
  type BodyCraftAlgorithm,
  type BodyCraftInputs,
  type BodyType,
  type GoalType,
  type FitnessLevel,
  type ActivityLevel,
  type MusclePriority,
  type TimelineMonths,
} from '../src/engines/bodyCraftEngine';
import { saveBodyCraftAlgorithm, applyAlgorithmToProfile } from '../src/database/bodyCraftService';
import { getUserProfile } from '../src/database/service';
import { useDatabase } from '../src/context/DatabaseContext';
import { validateNumeric, BODY_RANGES } from '../src/utils/validation';
import ScreenTutorial from '../src/components/ScreenTutorial';
import PremiumGate from '../src/components/PremiumGate';

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
  const router = useRouter();
  const { isReady: dbReady } = useDatabase();

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
  const [applied, setApplied] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Pre-fill height/weight/sex from user profile
  useEffect(() => {
    if (!dbReady) return;
    getUserProfile('user_local_001')
      .then((profile) => {
        if (!profile) return;
        if (profile.height_cm && !heightCm) setHeightCm(String(Math.round(profile.height_cm)));
        if (profile.weight_kg && !weightKg) setWeightKg(String(Math.round(profile.weight_kg)));
        if (profile.sex && (profile.sex === 'male' || profile.sex === 'female')) setSex(profile.sex);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalculate only on step change
  }, [dbReady]);

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
      const algo = generateBodyCraftAlgorithm(inputs, 'user_local_001');
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
    try {
      await saveBodyCraftAlgorithm(algorithm);
      await applyAlgorithmToProfile('user_local_001', algorithm);
      setApplied(true);
      Alert.alert(t('craftBody.appliedAlert'), t('craftBody.appliedDetail'));
    } catch (e) {
      if (__DEV__) console.error('[CraftMyBody] Failed to apply algorithm:', e);
      Alert.alert(t('craftBody.errorAlert'), t('craftBody.errorDetail'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t omitted: language dep handles re-creation
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
                {isDone && <MaterialCommunityIcons name="check" size={10} color="#fff" />}
              </View>
              <Text
                style={[
                  styles.progressLabel,
                  { color: isActive ? colors.accent : colors.textMuted, fontWeight: isActive ? '700' : '400' },
                ]}
              >
                {label}
              </Text>
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
        <Text style={[styles.label, { color: colors.text }]}>Sex</Text>
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
              <Text style={[styles.chipText, { color: sex === s ? colors.onAccent : colors.text }]}>
                {s === 'male' ? 'Male' : 'Female'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>

      {/* Height / Weight / Age */}
      <GlassCard style={styles.card}>
        <Text style={[styles.label, { color: colors.text }]}>Measurements</Text>
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('craftBody.heightLabel')}</Text>
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
              <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }}>{fieldErrors.heightCm}</Text>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('craftBody.weightLabel')}</Text>
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
              <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }}>{fieldErrors.weightKg}</Text>
            )}
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('craftBody.ageLabel')}</Text>
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
              <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }}>{fieldErrors.age}</Text>
            )}
          </View>
        </View>
      </GlassCard>

      {/* Body Type */}
      <GlassCard style={styles.card}>
        <Text style={[styles.label, { color: colors.text }]}>Body Type</Text>
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
              <Text style={[styles.optionTitle, { color: colors.text }]}>{bt.label}</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{bt.desc}</Text>
            </View>
            {bodyType === bt.key && <MaterialCommunityIcons name="check-circle" size={20} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </GlassCard>

      {/* Fitness Level */}
      <GlassCard style={styles.card}>
        <Text style={[styles.label, { color: colors.text }]}>Fitness Level</Text>
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
              <Text style={[styles.chipText, { color: fitnessLevel === fl.key ? colors.onAccent : colors.text }]}>
                {fl.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </GlassCard>

      {/* Activity Level */}
      <GlassCard style={styles.card}>
        <Text style={[styles.label, { color: colors.text }]}>Activity Level</Text>
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
              <Text style={[styles.optionTitle, { color: colors.text }]}>{al.label}</Text>
              <Text style={[styles.optionDesc, { color: colors.textMuted }]}>{al.desc}</Text>
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
              <Text style={[styles.goalTitle, { color: colors.text }]}>{g.label}</Text>
              <Text style={[styles.goalDesc, { color: colors.textMuted }]}>{g.desc}</Text>
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
      <Text style={[styles.focusHint, { color: colors.textMuted }]}>Tap to cycle: Maintain → Priority → Ignore</Text>
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
                <Text style={[styles.muscleLabel, { color: colors.text }]}>{mg.label}</Text>
                <View style={[styles.priorityBadge, { backgroundColor: cfg.color }]}>
                  <Text style={[styles.priorityText, { color: colors.text }]}>{cfg.label}</Text>
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
              <Text style={[styles.goalTitle, { color: colors.text }]}>{t.label}</Text>
              <Text style={[styles.goalDesc, { color: colors.textMuted }]}>{t.desc}</Text>
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
            <Text style={[styles.resultTitle, { color: colors.text }]}>Training Split</Text>
          </View>
          <Text style={[styles.resultValue, { color: colors.accent }]}>{algorithm.recommended_training_split}</Text>
          <Text style={[styles.resultSub, { color: colors.textMuted }]}>
            {algorithm.training_days_per_week} days/week
          </Text>

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
                  <Text style={[styles.scheduleDayLabel, { color: colors.textMuted }]}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                  </Text>
                  <Text
                    style={[
                      styles.scheduleDayText,
                      { color: isRest ? colors.textMuted : colors.accent, fontWeight: isRest ? '400' : '600' },
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Macros */}
        <GlassCard style={styles.card}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="food-apple-outline" size={22} color={colors.accent} />
            <Text style={[styles.resultTitle, { color: colors.text }]}>Daily Nutrition</Text>
          </View>
          <Text style={[styles.caloriesBig, { color: colors.text }]}>
            {algorithm.calories_target} <Text style={{ fontSize: 16, color: colors.textMuted }}>kcal/day</Text>
          </Text>

          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: colors.error }]}>{algorithm.protein_g}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textMuted }]}>Protein ({proteinPct}%)</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: colors.warning }]}>{algorithm.carbs_g}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textMuted }]}>Carbs ({carbsPct}%)</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: colors.purple }]}>{algorithm.fats_g}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textMuted }]}>Fats ({fatsPct}%)</Text>
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
            <Text style={[styles.resultTitle, { color: colors.text }]}>Daily Targets</Text>
          </View>
          <View style={styles.targetRow}>
            <View style={styles.targetItem}>
              <MaterialCommunityIcons name="water" size={24} color={colors.skyBlue} />
              <Text style={[styles.targetValue, { color: colors.text }]}>{algorithm.daily_water_liters}L</Text>
              <Text style={[styles.targetLabel, { color: colors.textMuted }]}>Water</Text>
            </View>
            <View style={styles.targetItem}>
              <MaterialCommunityIcons name="weather-night" size={24} color={colors.purpleLight} />
              <Text style={[styles.targetValue, { color: colors.text }]}>{algorithm.sleep_hours}h</Text>
              <Text style={[styles.targetLabel, { color: colors.textMuted }]}>Sleep</Text>
            </View>
            <View style={styles.targetItem}>
              <MaterialCommunityIcons name="run" size={24} color={colors.pinkLight} />
              <Text style={[styles.targetValue, { color: colors.text }]}>{algorithm.cardio_minutes_per_week}m</Text>
              <Text style={[styles.targetLabel, { color: colors.textMuted }]}>Cardio/wk</Text>
            </View>
          </View>
        </GlassCard>

        {/* Nutrition Tips */}
        <GlassCard style={styles.card}>
          <View style={styles.resultHeader}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={colors.accent} />
            <Text style={[styles.resultTitle, { color: colors.text }]}>Nutrition Tips</Text>
          </View>
          {algorithm.nutrition_tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={16}
                color={colors.accent}
                style={{ marginTop: 2 }}
              />
              <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
            </View>
          ))}
        </GlassCard>

        {/* Apply Button */}
        <View style={styles.applyContainer}>
          <GradientButton
            title={applied ? t('craftBody.applied') : t('craftBody.applyToTraining')}
            onPress={handleApply}
            icon={applied ? 'check-circle' : 'rocket-launch'}
            disabled={applied}
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
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
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
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                  },
                ]}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color={colors.textMuted} />
                <Text style={[styles.navBtnText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>

              <Text style={[styles.stepIndicator, { color: colors.textMuted }]}>
                {stepIndex + 1} / {STEPS.length}
              </Text>

              <TouchableOpacity
                onPress={goNext}
                disabled={!canGoNext()}
                accessibilityRole="button"
                accessibilityLabel={stepIndex === 3 ? 'Generate plan' : 'Next step'}
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: canGoNext() ? colors.accent + '20' : colors.surfaceVariant,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: canGoNext() ? colors.accent : colors.border,
                    opacity: canGoNext() ? 1 : 0.6,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.navBtnText,
                    { color: canGoNext() ? colors.accent : colors.textMuted, fontWeight: '700' },
                  ]}
                >
                  {stepIndex === 3 ? 'Generate' : 'Next'}
                </Text>
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
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                  },
                ]}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color={colors.text} />
                <Text style={[styles.navBtnText, { color: colors.text }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))}
                style={[
                  styles.navBtn,
                  {
                    backgroundColor: colors.accent + '20',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Text style={[styles.navBtnText, { color: colors.accent, fontWeight: '700' }]}>Done</Text>
                <MaterialCommunityIcons name="check" size={20} color={colors.accent} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </SafeAreaView>
      </PremiumGate>
    </ScreenErrorBoundary>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  // Progress bar
  progressContainer: { marginBottom: 24 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressStep: { alignItems: 'center', flex: 1 },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressLabel: { fontSize: 10, textAlign: 'center' },
  progressLine: { height: 3, borderRadius: 2, marginHorizontal: 32 },
  progressLineFill: { height: 3, borderRadius: 2 },

  // Cards
  card: { marginBottom: 16, padding: 16 },

  // Labels
  label: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  inputLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },

  // Inputs
  inputRow: { flexDirection: 'row', gap: 8 },
  inputGroup: { flex: 1 },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
  },

  // Chips
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '500' },

  // Option rows
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600' },
  optionDesc: { fontSize: 12, marginTop: 2 },

  // Goal rows
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 8, borderWidth: 1, padding: 8 },
  goalIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  goalTitle: { fontSize: 16, fontWeight: '700' },
  goalDesc: { fontSize: 12, marginTop: 2 },

  // Focus areas
  focusHint: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  muscleCard: { width: '47%' as any, alignItems: 'center', padding: 16, borderRadius: 12, minWidth: 150 },
  muscleLabel: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  priorityText: { fontSize: 10, fontWeight: '700' },

  // Results
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  resultTitle: { fontSize: 16, fontWeight: '700' },
  resultValue: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  resultSub: { fontSize: 13, marginBottom: 16 },

  // Schedule
  scheduleRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  scheduleDay: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  scheduleDayLabel: { fontSize: 9, fontWeight: '500', marginBottom: 2 },
  scheduleDayText: { fontSize: 10, fontWeight: '600' },

  // Macros
  caloriesBig: { fontSize: 32, fontWeight: '700', marginBottom: 16 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  macroItem: { alignItems: 'center', flex: 1 },
  macroValue: { fontSize: 20, fontWeight: '700' },
  macroLabel: { fontSize: 11, marginTop: 2 },
  macroBar: { height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden' },

  // Targets
  targetRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 },
  targetItem: { alignItems: 'center', gap: 4 },
  targetValue: { fontSize: 18, fontWeight: '700' },
  targetLabel: { fontSize: 11 },

  // Tips
  tipRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Apply
  applyContainer: { marginTop: 8, marginBottom: 32 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtnText: { fontSize: 15, fontWeight: '600' },
  stepIndicator: { fontSize: 13, fontWeight: '500' },
});
