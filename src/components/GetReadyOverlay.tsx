/**
 * GetReadyOverlay — "Get Ready!" countdown between exercises.
 *
 * Shown after rest ends and before the next exercise starts.
 * Features:
 *  • 5-4-3-2-1 central countdown number (large, animated)
 *  • Exercise name & setup cue
 *  • Equipment change alert when needed
 *  • Haptic pulse on every tick
 *  • Auto-dismisses after countdown reaches 0
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Modal, StyleSheet, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { ZoomIn, FadeIn, FadeInUp, FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import ExerciseImage from './ExerciseImage';
import { audioService } from '../services/audioService';
import { typography, spacing, radius } from '../design/theme-system';

// ─── Types ────────────────────────────────────────────
export interface GetReadyExercise {
  exerciseId: string;
  name: string;
  category: string;
  sets: number;
  reps: string;
  /** First instruction line used as a setup cue */
  setupCue?: string;
  /** Audio setup narration */
  audioSetup?: string;
}

interface GetReadyOverlayProps {
  visible: boolean;
  exercise: GetReadyExercise | null;
  /** Show an equipment-change banner */
  equipmentChanged?: boolean;
  /** Countdown duration in seconds (default 5) */
  countdownFrom?: number;
  /** Called when countdown reaches 0 */
  onReady: () => void;
}

// ─── Component ────────────────────────────────────────
function GetReadyOverlay({
  visible,
  exercise,
  equipmentChanged = false,
  countdownFrom = 5,
  onReady,
}: GetReadyOverlayProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [count, setCount] = useState(countdownFrom);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenSetup = useRef(false);

  // ── Colour per countdown tick ──
  const countColor = count <= 2 ? theme.colors.error : count <= 3 ? theme.colors.warning : theme.colors.accent;

  // ── Start countdown when visible ──
  useEffect(() => {
    if (!visible || !exercise) return;

    // Reset
    setCount(countdownFrom);
    hasSpokenSetup.current = false;

    // Speak setup cue once
    if (exercise.audioSetup) {
      audioService.playSetup({
        intro: '',
        setup: exercise.audioSetup,
        execution: '',
        transition: '',
      });
      hasSpokenSetup.current = true;
    }

    // Haptic on first tick
    Vibration.vibrate(40);

    intervalRef.current = setInterval(() => {
      setCount((prev) => {
        const next = prev - 1;
        if (next > 0) {
          // Haptic + audio countdown for <=3
          Vibration.vibrate(next <= 3 ? 50 : 20);
          if (next <= 3) audioService.playCountdown(next);
        }
        if (next <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          // Final haptic burst
          Vibration.vibrate([0, 60, 40, 60]);
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible, exercise, countdownFrom]);

  // ── Fire onReady when count hits 0 ──
  useEffect(() => {
    if (visible && count <= 0) {
      // Small delay so the "GO!" text renders briefly
      const t = setTimeout(onReady, 400); // animation
      return () => clearTimeout(t);
    }
  }, [visible, count, onReady]);

  if (!visible || !exercise) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <View style={[styles.bg, { backgroundColor: theme.colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          {/* Equipment change banner */}
          {equipmentChanged && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              style={[styles.equipBanner, { backgroundColor: theme.colors.warning + '18' }]}
            >
              <MaterialCommunityIcons name="swap-horizontal" size={20} color={theme.colors.warning} />
              <Text style={[styles.equipText, { color: theme.colors.warning }]}>
                {t('fitquest.equipmentChange') ?? 'Equipment change — get set up!'}
              </Text>
            </Animated.View>
          )}

          {/* "GET READY" label */}
          <Animated.View entering={FadeIn.duration(200)}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>
              {t('fitquest.getReady') ?? 'GET READY'}
            </Text>
          </Animated.View>

          {/* Big countdown number / GO! */}
          <Animated.View entering={ZoomIn.duration(200)} key={count} style={styles.countWrap}>
            <Text style={[styles.countDigit, { color: countColor }]}>
              {count > 0 ? count : (t('fitquest.go') ?? 'GO!')}
            </Text>
          </Animated.View>

          {/* Exercise preview */}
          <Animated.View entering={FadeInUp.delay(150).duration(200)} style={styles.previewWrap}>
            <ExerciseImage exerciseId={exercise.exerciseId} category={exercise.category} variant="detail" />
            <Text style={[styles.exName, { color: theme.colors.text }]} numberOfLines={2}>
              {exercise.name}
            </Text>
            <Text style={[styles.exMeta, { color: theme.colors.textMuted }]}>
              {exercise.sets}× ({exercise.reps})
            </Text>

            {/* Setup cue */}
            {exercise.setupCue ? (
              <View
                style={[styles.cueBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <MaterialCommunityIcons name="lightbulb-outline" size={16} color={theme.colors.accent} />
                <Text style={[styles.cueText, { color: theme.colors.textSecondary }]} numberOfLines={3}>
                  {exercise.setupCue}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────
const styles = StyleSheet.create({
  bg: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing[6] },

  // Equipment banner
  equipBanner: {
    position: 'absolute',
    top: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
  },
  equipText: { fontSize: typography.sizes.bodySmall, fontWeight: '600' },

  // Label
  label: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },

  // Countdown digit
  countWrap: { marginBottom: spacing[8] },
  countDigit: {
    fontSize: typography.sizes.mega,
    fontWeight: '900',
    fontVariant: ['tabular-nums'] as any,
    textAlign: 'center',
  },

  // Preview
  previewWrap: { alignItems: 'center', maxWidth: 300 },
  exName: { fontSize: typography.sizes.h3, fontWeight: '700', textAlign: 'center', marginTop: spacing[4] },
  exMeta: { fontSize: typography.sizes.bodySmall, marginTop: spacing[1.5] },
  cueBubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    marginTop: spacing[4],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  cueText: { flex: 1, fontSize: typography.sizes.label, lineHeight: 19 },
});

export default React.memo(GetReadyOverlay);
