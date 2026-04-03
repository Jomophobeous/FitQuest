import { useRef, useEffect, useCallback } from 'react';

/**
 * Unified async-safety hook. Returns:
 * - `isMounted()` — check before setState in async callbacks
 * - `guardedSetState(setter)` — only calls setter if still mounted
 *
 * Replaces ad-hoc `mountedRef` patterns across ViewModels.
 */
export function useMountedGuard() {
  const ref = useRef(true);

  useEffect(() => {
    ref.current = true;
    return () => { ref.current = false; };
  }, []);

  const isMounted = useCallback(() => ref.current, []);

  const guardedSetState = useCallback(
    <T>(setter: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>) => {
      if (ref.current) setter(value);
    },
    [],
  );

  return { isMounted, guardedSetState, mountedRef: ref } as const;
}
