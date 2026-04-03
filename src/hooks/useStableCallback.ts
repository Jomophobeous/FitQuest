/**
 * useStableCallback — Stable callback reference that always calls the latest function.
 *
 * Unlike useCallback, this returns a STABLE reference that never changes,
 * while always invoking the latest version of the callback.
 *
 * Use for:
 * - Event handlers passed to memoized children
 * - Callbacks in dependency arrays that shouldn't trigger re-renders
 *
 * Usage:
 *   const handlePress = useStableCallback((id: string) => {
 *     doSomething(id, currentState);
 *   });
 *   // handlePress reference never changes, but always uses latest closure
 */

import { useRef, useCallback } from 'react';

export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    ((...args: any[]) => callbackRef.current(...args)) as T,
    [],
  );
}
