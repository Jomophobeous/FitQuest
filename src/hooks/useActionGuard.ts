import { useRef, useCallback } from 'react';

/**
 * Prevents duplicate handler invocations from rapid taps.
 *
 * Returns a wrapper that blocks re-entry for `lockMs` after the first call.
 * Works for both sync (navigation) and async (API) handlers.
 *
 * Usage:
 *   const guard = useActionGuard();
 *   <GradientButton onPress={guard(() => router.push('/fitquest'))} />
 *   <GradientButton onPress={guard(async () => { await api.call(); })} />
 */
export function useActionGuard(lockMs = 400) {
  const lockedUntil = useRef(0);

  const guard = useCallback(
    <T extends (...args: any[]) => any>(fn: T): ((...args: Parameters<T>) => void) => {
      return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now < lockedUntil.current) return;
        lockedUntil.current = now + lockMs;
        fn(...args);
      };
    },
    [lockMs],
  );

  return guard;
}
