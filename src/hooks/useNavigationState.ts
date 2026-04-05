/**
 * useNavigationState — Persistent navigation context.
 *
 * Preserves across navigation:
 * - Scroll position (via scrollRef)
 * - Form input values
 * - Active selections/filters
 *
 * Uses in-memory storage keyed by screenKey.
 * Data survives tab switches and back/forward navigation.
 * Cleared only on explicit logout or app restart.
 *
 * Phase 8 implementation.
 *
 * Usage:
 *   const {
 *     scrollRef,
 *     getValue,
 *     setValue,
 *     getSelection,
 *     setSelection,
 *   } = useNavigationState('profile');
 *
 *   // In component:
 *   <ScrollView ref={scrollRef} ...>
 *
 *   // Persist an input:
 *   <TextInput
 *     value={getValue('name', '')}
 *     onChangeText={(v) => setValue('name', v)}
 *   />
 *
 *   // Persist a filter/selection:
 *   const activeFilter = getSelection('exerciseFilter', 'all');
 */

import { useRef, useCallback } from 'react';
import type { ScrollView } from 'react-native';

// In-memory state store keyed by screenKey
const stateStore = new Map<string, Record<string, unknown>>();
const scrollPositions = new Map<string, number>();

function getOrCreate(screenKey: string): Record<string, unknown> {
  if (!stateStore.has(screenKey)) {
    stateStore.set(screenKey, {});
  }
  return stateStore.get(screenKey)!;
}

export interface NavigationStateHandle {
  /** Ref to attach to a ScrollView — auto-restores scroll position on mount */
  scrollRef: React.MutableRefObject<ScrollView | null>;
  /** Save current scroll position — call in onScroll */
  saveScrollPosition: (y: number) => void;
  /** Restore scroll position — call after content renders */
  restoreScrollPosition: () => void;
  /** Get a persisted form value */
  getValue: <T>(key: string, defaultValue: T) => T;
  /** Set a persisted form value */
  setValue: <T>(key: string, value: T) => void;
  /** Get a persisted selection/filter */
  getSelection: <T>(key: string, defaultValue: T) => T;
  /** Set a persisted selection/filter */
  setSelection: <T>(key: string, value: T) => void;
  /** Clear all state for this screen */
  clearState: () => void;
}

export function useNavigationState(screenKey: string): NavigationStateHandle {
  const scrollRef = useRef<ScrollView>(null);

  const saveScrollPosition = useCallback(
    (y: number) => {
      scrollPositions.set(screenKey, y);
    },
    [screenKey],
  );

  const restoreScrollPosition = useCallback(() => {
    const y = scrollPositions.get(screenKey) ?? 0;
    if (y > 0 && scrollRef.current) {
      // Small delay to ensure layout is complete
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
      }, 50);
    }
  }, [screenKey]);

  const getValue = useCallback(
    <T>(key: string, defaultValue: T): T => {
      const store = getOrCreate(screenKey);
      return key in store ? (store[key] as T) : defaultValue;
    },
    [screenKey],
  );

  const setValue = useCallback(
    <T>(key: string, value: T): void => {
      const store = getOrCreate(screenKey);
      store[key] = value;
    },
    [screenKey],
  );

  const getSelection = useCallback(
    <T>(key: string, defaultValue: T): T => {
      const store = getOrCreate(screenKey);
      const selKey = `sel__${key}`;
      return selKey in store ? (store[selKey] as T) : defaultValue;
    },
    [screenKey],
  );

  const setSelection = useCallback(
    <T>(key: string, value: T): void => {
      const store = getOrCreate(screenKey);
      store[`sel__${key}`] = value;
    },
    [screenKey],
  );

  const clearState = useCallback(() => {
    stateStore.delete(screenKey);
    scrollPositions.delete(screenKey);
  }, [screenKey]);

  return {
    scrollRef,
    saveScrollPosition,
    restoreScrollPosition,
    getValue,
    setValue,
    getSelection,
    setSelection,
    clearState,
  };
}

/** Clear all navigation state (e.g. on logout) */
export function clearAllNavigationState(): void {
  stateStore.clear();
  scrollPositions.clear();
}
