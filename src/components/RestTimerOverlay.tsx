/**
 * RestTimerOverlay — Full-screen rest period UI.
 *
 * Features:
 *  • SVG countdown ring with remaining time
 *  • "+30 s" extend-rest button
 *  • Breathing guide (pulsing circle with in/hold/out cues)
 *  • "Up Next" exercise preview with ExerciseImage
 *  • Skip-rest button
 *  • Haptic feedback at rest start & 3-2-1 countdown
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  ZoomIn,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import CountdownRing from './CountdownRing';
import ExerciseImage from './ExerciseImage';

// ─── Types ────────────────────────────────────────────
export interface NextExerciseInfo {
  exerciseId: string;
  name: string;
  category: string;
  sets: number;
  reps: string;
}

interface RestTimerOverlayProps {
  visible: boolean;
  /** 0→1 fraction elapsed */
  progress: number;
  /** Formatted MM:SS string */
  formattedRemaining: string;
  /** Raw remaining seconds */
  remaining: number;
  /** Next exercise (undefined when last) */
  nextExercise?: NextExerciseInfo;
  /** Current workout phase — drives colour & messaging */
  phase?: 'warmup' | 'main' | 'cooldown';
  onSkip: () => void;
  onExtend: (seconds: number) => void;
}

// ─── Breathing guide config ───────────────────────────
const BREATHE_IN_MS = 4000;
const HOLD_MS = 2000;
const BREATHE_OUT_MS = 4000;
const CYCLE_MS = BREATHE_IN_MS + HOLD_MS + BREATHE_OUT_MS; // 10 s

// ─── Component ────────────────────────────────────────
export default function RestTimerOverlay({
  visible,
  progress,
  formattedRemaining,
  remaining,
  nextExercise,
  phase = 'main',
  onSkip,
  onExtend,
}: RestTimerOverlayProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const lastCountdownRef = useRef<number>(0);

  // ── Breathing animation ──
  const breatheScale = useSharedValue(0.6);
  const breatheOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (!visible) return;
    // Start a repeating breathe cycle: grow → hold → shrink
    breatheScale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BREATHE_IN_MS, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: HOLD_MS }),
        withTiming(0.6, { duration: BREATHE_OUT_MS, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // infinite
      false,
    );
    breatheOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: BREATHE_IN_MS }),
        withTiming(0.55, { duration: HOLD_MS }),
        withTiming(0.3, { duration: BREATHE_OUT_MS }),
      ),
      -1,
      false,
    );
  }, [visible]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
    opacity: breatheOpacity.value,
  }));

  // Breathing label cycles between in / hold / out
  const breatheLabel = useMemo(() => {
    if (!visible) return '';
    // Approximate which phase based on remaining seconds mod cycle length
    const cyclePos = (Date.now() / 1000) % (CYCLE_MS / 1000);
    if (cyclePos < BREATHE_IN_MS / 1000) return t('fitquest.breatheIn') ?? 'Breathe In';
    if (cyclePos < (BREATHE_IN_MS + HOLD_MS) / 1000) return t('fitquest.hold') ?? 'Hold';
    return t('fitquest.breatheOut') ?? 'Breathe Out';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, remaining]); // recalc every second (remaining changes every s)

  // ── Haptic on 3-2-1 ──
  useEffect(() => {
    if (!visible) {
      lastCountdownRef.current = 0;
      return;
    }
    if (remaining <= 3 && remaining > 0 && remaining !== lastCountdownRef.current) {
      lastCountdownRef.current = remaining;
      Vibration.vibrate(remaining === 1 ? [0, 80, 60, 80] : 30);
    }
  }, [visible, remaining]);

  // ── Ring colour: phase-aware with urgency shift in last 5 s ──
  const phaseColor =
    phase === 'warmup' ? theme.colors.success : phase === 'cooldown' ? theme.colors.blue : theme.colors.accent;
  const ringColor = remaining <= 5 ? theme.colors.error : phaseColor;

  // Phase-specific rest label
  const restLabelText =
    phase === 'warmup'
      ? (t('fitquest.getReady') ?? 'GET READY')
      : phase === 'cooldown'
        ? (t('fitquest.recover') ?? 'RECOVER')
        : (t('fitquest.restTime') ?? 'REST');

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={[styles.bg, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          {/* ── Breathing glow circle (behind ring) ── */}
          <Animated.View
            style={[
              styles.breatheCircle,
              {
                backgroundColor: ringColor + '15',
                width: 260,
                height: 260,
                borderRadius: 130,
              },
              breatheStyle,
            ]}
          />

          {/* ── Countdown Ring ── */}
          <Animated.View entering={ZoomIn.duration(250)} style={styles.ringWrap}>
            <CountdownRing progress={progress} size={220} strokeWidth={12} color={ringColor}>
              <Text style={[styles.timerDigits, { color: theme.colors.text }]}>{formattedRemaining}</Text>
              <Text style={[styles.restLabel, { color: theme.colors.textMuted }]}>{restLabelText}</Text>
            </CountdownRing>
          </Animated.View>

          {/* ── Breathing label ── */}
          <Animated.View entering={FadeIn.delay(300).duration(200)}>
            <Text style={[styles.breatheLabel, { color: theme.colors.textSecondary }]}>{breatheLabel}</Text>
          </Animated.View>

          {/* ── Extend Rest +30 s ── */}
          <Animated.View entering={FadeInUp.delay(200).duration(200)} style={styles.extendRow}>
            <TouchableOpacity
              style={[styles.extendBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              onPress={() => onExtend(30)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="timer-plus-outline" size={18} color={theme.colors.accent} />
              <Text style={[styles.extendText, { color: theme.colors.accent }]}>+30 s</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Up-Next preview ── */}
          {nextExercise && (
            <Animated.View
              entering={FadeInUp.delay(250).duration(200)}
              style={[styles.nextCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
              <Text style={[styles.nextLabel, { color: theme.colors.textMuted }]}>
                {t('fitquest.nextUp') ?? 'UP NEXT'}
              </Text>
              <View style={styles.nextRow}>
                <ExerciseImage
                  exerciseId={nextExercise.exerciseId}
                  category={nextExercise.category}
                  variant="thumbnail"
                />
                <View style={styles.nextInfo}>
                  <Text style={[styles.nextName, { color: theme.colors.text }]} numberOfLines={2}>
                    {nextExercise.name}
                  </Text>
                  <Text style={[styles.nextMeta, { color: theme.colors.textMuted }]}>
                    {nextExercise.sets}× ({nextExercise.reps})
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Skip Rest ── */}
          <Animated.View entering={FadeInUp.delay(350).duration(200)}>
            <TouchableOpacity
              style={[
                styles.skipBtn,
                { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent + '12' },
              ]}
              onPress={onSkip}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="skip-next" size={20} color={theme.colors.accent} />
              <Text style={[styles.skipText, { color: theme.colors.accent }]}>
                {t('fitquest.skipRest') ?? 'Skip Rest'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────
const styles = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },

  // Breathing glow behind ring
  breatheCircle: {
    position: 'absolute',
  },

  // Ring
  ringWrap: { marginBottom: 12 },
  timerDigits: {
    fontSize: 56,
    fontWeight: '800',
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: 2,
  },
  restLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // Breathe
  breatheLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 20,
  },

  // Extend
  extendRow: { marginBottom: 24 },
  extendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    gap: 6,
  },
  extendText: { fontSize: 14, fontWeight: '700' },

  // Next card
  nextCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 28,
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nextInfo: { flex: 1 },
  nextName: { fontSize: 16, fontWeight: '700' },
  nextMeta: { fontSize: 13, marginTop: 4 },

  // Skip
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  skipText: { fontSize: 15, fontWeight: '700' },
});
