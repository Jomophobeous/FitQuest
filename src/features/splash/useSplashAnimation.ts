/**
 * Splash Animation Hook — Reanimated shared values + timeline orchestration.
 *
 * Timeline (2.77s total):
 *  [0.0–0.4]  Black → faint radial gradient
 *  [0.4–1.2]  Circle arc stroke draw (800ms — energetic)
 *  [1.2–2.04] FQ letterforms stroke-animate in (540ms — deliberate)
 *  [2.0–2.5]  Glow stabilize + subtle scale pulse
 *  [2.5–2.65] Hold (150ms — formation rests)
 *  [2.65–2.77] Exit fade (120ms — opacity 1→0, scale 1→0.98)
 */
import { useEffect, useRef, useCallback } from 'react';
import {
  useSharedValue,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const TOTAL_DURATION_MS = 2500;
const HOLD_MS = 150;
const EXIT_FADE_MS = 120;
const SKIP_LOCK_MS = 800;
const FALLBACK_MS = 3400;

export function useSplashAnimation(onComplete: () => void) {
  const completedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Shared values ──
  const bgGradientOpacity = useSharedValue(0);
  const circleProgress = useSharedValue(0);   // 0→1 stroke draw
  const fProgress = useSharedValue(0);         // 0→1 stroke draw for F
  const qProgress = useSharedValue(0);         // 0→1 stroke draw for Q
  const qTailProgress = useSharedValue(0);     // 0→1 Q tail
  const glowIntensity = useSharedValue(0);     // 0→1 glow opacity
  const logoScale = useSharedValue(1);         // pulse: 1→1.02→1
  const overallOpacity = useSharedValue(1);    // fade-out on exit

  const playExitAndComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    // Exit fade: opacity 1→0, scale 1→0.98 over 120ms
    overallOpacity.value = withTiming(0, {
      duration: EXIT_FADE_MS,
      easing: Easing.in(Easing.quad),
    });
    logoScale.value = withTiming(0.98, {
      duration: EXIT_FADE_MS,
      easing: Easing.in(Easing.quad),
    });
    // Navigate after fade completes
    exitTimerRef.current = setTimeout(() => onComplete(), EXIT_FADE_MS);
  }, [onComplete, overallOpacity, logoScale]);

  useEffect(() => {
    // Phase 1: Background gradient fade-in [0–400ms]
    bgGradientOpacity.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });

    // Phase 2: Circle arc draw [400–1200ms]
    circleProgress.value = withDelay(
      400,
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
    );

    // Phase 3a: F letterform draw [1200–1740ms] — 540ms deliberate (8% slower than circle)
    fProgress.value = withDelay(
      1200,
      withTiming(1, { duration: 540, easing: Easing.out(Easing.cubic) }),
    );

    // Phase 3b: Q letterform draw [1350–1890ms] — staggered 150ms, 540ms deliberate
    qProgress.value = withDelay(
      1350,
      withTiming(1, { duration: 540, easing: Easing.out(Easing.cubic) }),
    );

    // Phase 3c: Q tail [1600–2040ms]
    qTailProgress.value = withDelay(
      1600,
      withTiming(1, { duration: 440, easing: Easing.out(Easing.cubic) }),
    );

    // Phase 4: Glow stabilize [2000–2300ms]
    glowIntensity.value = withDelay(
      2000,
      withTiming(0.35, { duration: 300, easing: Easing.inOut(Easing.quad) }),
    );

    // Phase 4b: Subtle pulse [2000–2500ms]
    logoScale.value = withDelay(
      2000,
      withSequence(
        withTiming(1.02, { duration: 250, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.0, { duration: 250, easing: Easing.inOut(Easing.quad) }),
      ),
    );

    // Animation complete + 150ms hold → exit fade → navigate
    const animTimer = setTimeout(() => {
      runOnJS(playExitAndComplete)();
    }, TOTAL_DURATION_MS + HOLD_MS);

    // Hard fallback — never stuck (bypasses fade)
    const fallbackTimer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        runOnJS(onComplete)();
      }
    }, FALLBACK_MS);

    return () => {
      clearTimeout(animTimer);
      clearTimeout(fallbackTimer);
      clearTimeout(exitTimerRef.current);
    };
  }, []);

  const skip = useCallback(() => {
    if (completedRef.current) return;
    // Snap all values to end state
    circleProgress.value = 1;
    fProgress.value = 1;
    qProgress.value = 1;
    qTailProgress.value = 1;
    glowIntensity.value = 0.35;
    logoScale.value = 1;
    // Play exit fade even on skip (polished exit)
    playExitAndComplete();
  }, [playExitAndComplete]);

  return {
    bgGradientOpacity,
    circleProgress,
    fProgress,
    qProgress,
    qTailProgress,
    glowIntensity,
    logoScale,
    overallOpacity,
    skip,
    SKIP_LOCK_MS,
  };
}
