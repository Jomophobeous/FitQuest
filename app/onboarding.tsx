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
import { createUserProfile, setUserEquipment } from '../src/database/service';
import { EquipmentItem } from '../src/database/types';
import { GlassCard, GradientButton } from '../src/components/ui/GlassUI';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ACCENT = '#CCFF00';

type Goal = 'BUILD_MUSCLE' | 'LOSE_FAT' | 'ENDURANCE' | 'FLEXIBILITY' | 'GENERAL_FITNESS';
type Experience = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

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

const GOALS: { id: Goal; label: string; icon: string; desc: string }[] = [
  { id: 'BUILD_MUSCLE', label: 'Build Muscle', icon: 'arm-flex', desc: 'Gain strength & size' },
  { id: 'LOSE_FAT', label: 'Lose Fat', icon: 'fire', desc: 'Burn calories & lean out' },
  { id: 'ENDURANCE', label: 'Endurance', icon: 'run-fast', desc: 'Improve stamina & cardio' },
  { id: 'FLEXIBILITY', label: 'Flexibility', icon: 'human-greeting-variant', desc: 'Move better, recover faster' },
  { id: 'GENERAL_FITNESS', label: 'General Fitness', icon: 'heart-pulse', desc: 'All-around health' },
];

const EXPERIENCE_LEVELS: { id: Experience; label: string; desc: string; icon: string }[] = [
  { id: 'BEGINNER', label: 'Beginner', desc: '0–6 months training', icon: 'sprout' },
  { id: 'INTERMEDIATE', label: 'Intermediate', desc: '6 months – 2 years', icon: 'tree' },
  { id: 'ADVANCED', label: 'Advanced', desc: '2+ years consistent', icon: 'trophy' },
];

const EQUIPMENT_OPTIONS: { id: EquipmentItem; label: string; icon: string }[] = [
  { id: 'DUMBBELLS' as EquipmentItem, label: 'Dumbbells', icon: 'dumbbell' },
  { id: 'BARBELL' as EquipmentItem, label: 'Barbell', icon: 'weight-lifter' },
  { id: 'PULL_UP_BAR' as EquipmentItem, label: 'Pull-up Bar', icon: 'human-handsup' },
  { id: 'RESISTANCE_BANDS' as EquipmentItem, label: 'Bands', icon: 'yoga' },
  { id: 'BENCH' as EquipmentItem, label: 'Bench', icon: 'seat-recline-normal' },
  { id: 'KETTLEBELL' as EquipmentItem, label: 'Kettlebell', icon: 'weight' },
  { id: 'CABLE_MACHINE' as EquipmentItem, label: 'Cable Machine', icon: 'elevator' },
  { id: 'BODYWEIGHT' as EquipmentItem, label: 'Bodyweight Only', icon: 'human' },
];

const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const isDark = theme.isDark;

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
    setSaving(true);
    try {
      await createUserProfile({
        id: 'user_local_001',
        sex: data.sex ?? undefined,
        weight_kg: data.weightKg ? parseFloat(data.weightKg) : undefined,
        height_cm: data.heightCm ? parseFloat(data.heightCm) : undefined,
        goal: data.goal ?? 'GENERAL_FITNESS',
        experience: data.experience ?? 'BEGINNER',
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
              <LinearGradient colors={[ACCENT + '30', ACCENT + '08']} style={styles.welcomeGlow} />
              <MaterialCommunityIcons name="lightning-bolt" size={64} color={ACCENT} />
            </View>
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
              Welcome to{'\n'}FitQuest
            </Text>
            <Text style={[styles.welcomeDesc, { color: theme.colors.textMuted }]}>
              Your AI-powered fitness companion.{'\n'}Let's personalise your experience.
            </Text>
          </Animated.View>
        );

      // ── Goals ──
      case 1:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>What's your goal?</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              Choose your primary fitness objective
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
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        borderColor: data.goal === g.id ? ACCENT : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        borderWidth: data.goal === g.id ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: data.goal === g.id ? ACCENT + '20' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
                      <MaterialCommunityIcons name={g.icon as any} size={24} color={data.goal === g.id ? ACCENT : theme.colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{g.label}</Text>
                      <Text style={[styles.optionDesc, { color: theme.colors.textMuted }]}>{g.desc}</Text>
                    </View>
                    {data.goal === g.id && (
                      <MaterialCommunityIcons name="check-circle" size={22} color={ACCENT} />
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
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>Experience Level</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              This helps us tailor workout difficulty
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
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        borderColor: data.experience === e.id ? ACCENT : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        borderWidth: data.experience === e.id ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: data.experience === e.id ? ACCENT + '20' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
                      <MaterialCommunityIcons name={e.icon as any} size={24} color={data.experience === e.id ? ACCENT : theme.colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{e.label}</Text>
                      <Text style={[styles.optionDesc, { color: theme.colors.textMuted }]}>{e.desc}</Text>
                    </View>
                    {data.experience === e.id && (
                      <MaterialCommunityIcons name="check-circle" size={22} color={ACCENT} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))}

              {/* Quick body metrics */}
              <View style={{ marginTop: 16, gap: 12 }}>
                <View style={styles.inputRow}>
                  <View style={[styles.metricInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }]}>
                    <TextInput
                      style={[styles.metricField, { color: theme.colors.text }]}
                      placeholder="Weight (kg)"
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="numeric"
                      value={data.weightKg}
                      onChangeText={v => setData(d => ({ ...d, weightKg: v }))}
                    />
                  </View>
                  <View style={[styles.metricInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }]}>
                    <TextInput
                      style={[styles.metricField, { color: theme.colors.text }]}
                      placeholder="Height (cm)"
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="numeric"
                      value={data.heightCm}
                      onChangeText={v => setData(d => ({ ...d, heightCm: v }))}
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
                          backgroundColor: data.sex === s ? ACCENT + '20' : (isDark ? 'rgba(255,255,255,0.04)' : '#fff'),
                          borderColor: data.sex === s ? ACCENT : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                          borderWidth: data.sex === s ? 2 : 1,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={s === 'male' ? 'gender-male' : 'gender-female'}
                        size={20}
                        color={data.sex === s ? ACCENT : theme.colors.textMuted}
                      />
                      <Text style={[styles.sexLabel, { color: data.sex === s ? ACCENT : theme.colors.text }]}>
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
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>Training Schedule</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              How often do you want to train?
            </Text>

            <Text style={[styles.sliderLabel, { color: theme.colors.text }]}>
              Days per week: <Text style={{ color: ACCENT, fontWeight: '900' }}>{data.trainingDays}</Text>
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
                      backgroundColor: data.trainingDays === d ? ACCENT : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                    },
                  ]}
                >
                  <Text style={[styles.dayBtnText, { color: data.trainingDays === d ? '#000' : theme.colors.text }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sliderLabel, { color: theme.colors.text, marginTop: 28 }]}>
              Minutes per session: <Text style={{ color: ACCENT, fontWeight: '900' }}>{data.sessionMinutes}</Text>
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
                      backgroundColor: data.sessionMinutes === m ? ACCENT : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      paddingHorizontal: 14,
                    },
                  ]}
                >
                  <Text style={[styles.dayBtnText, { color: data.sessionMinutes === m ? '#000' : theme.colors.text }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        );

      // ── Equipment ──
      case 4:
        return (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: theme.colors.text }]}>Your Equipment</Text>
            <Text style={[styles.stepDesc, { color: theme.colors.textMuted }]}>
              Select what you have access to
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
                          backgroundColor: selected ? ACCENT + '15' : (isDark ? 'rgba(255,255,255,0.04)' : '#fff'),
                          borderColor: selected ? ACCENT : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                          borderWidth: selected ? 2 : 1,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={eq.icon as any}
                        size={28}
                        color={selected ? ACCENT : theme.colors.textMuted}
                      />
                      <Text style={[styles.equipLabel, { color: selected ? ACCENT : theme.colors.text }]}>
                        {eq.label}
                      </Text>
                      {selected && (
                        <View style={styles.equipCheck}>
                          <MaterialCommunityIcons name="check" size={14} color="#000" />
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
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0A0E17' : '#F4F5F7' }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={[ACCENT + '06', 'transparent', 'transparent']}
        style={styles.bgGlow}
      />

      {/* Progress bar */}
      <View style={styles.progressRow}>
        {step > 0 && (
          <TouchableOpacity onPress={back} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${((step + 1) / TOTAL_STEPS) * 100}%`, backgroundColor: ACCENT },
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
              backgroundColor: canAdvance() ? ACCENT : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'),
              opacity: canAdvance() ? 1 : 0.5,
            },
          ]}
          onPress={next}
          disabled={!canAdvance() || saving}
          activeOpacity={0.9}
        >
          <Text style={[styles.ctaBtnText, { color: canAdvance() ? '#000' : theme.colors.textMuted }]}>
            {step === TOTAL_STEPS - 1 ? (saving ? 'Saving...' : 'Get Started') : 'Continue'}
          </Text>
          {step < TOTAL_STEPS - 1 && (
            <MaterialCommunityIcons name="arrow-right" size={20} color={canAdvance() ? '#000' : theme.colors.textMuted} />
          )}
        </TouchableOpacity>

        {step === 0 && (
          <TouchableOpacity onPress={() => router.replace('/dashboard')} style={{ marginTop: 12 }}>
            <Text style={[styles.skipText, { color: theme.colors.textMuted }]}>Skip for now</Text>
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
    backgroundColor: ACCENT,
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
