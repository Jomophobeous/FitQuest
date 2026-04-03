/**
 * NavigationGuard — Safe navigation with route deduplication.
 *
 * Prevents:
 * - Duplicate route pushes (same route within 500ms)
 * - Navigation during critical actions (via InteractionManager lock check)
 * - Stack corruption from rapid taps
 *
 * Usage:
 *   const nav = useNavigationGuard();
 *   nav.push('/fitquest');
 *   nav.replace('/dashboard');
 */

import { useCallback, useRef } from 'react';
import { useRouter, type Router } from 'expo-router';
import { Interaction } from '../interactions/InteractionManager';
import { recordBackNavigation } from '../services/frictionLogger';
import { debugLogNavigation } from '../services/debugBuffer';

const DEFAULT_COOLDOWN = 500;

export interface NavigateOptions {
  /** Block navigation if this action is currently locked */
  blockIfLocked?: string;
}

/**
 * Hook that wraps expo-router with route deduplication.
 * All navigation goes through this — no direct router.push() in components.
 */
export function useNavigationGuard() {
  const router = useRouter();
  const lastRoute = useRef<string>('');
  const lastNavAt = useRef(0);

  const canNavigate = useCallback(
    (route: string, options?: NavigateOptions): boolean => {
      const now = Date.now();

      // Dedupe: same route within cooldown
      if (route === lastRoute.current && now - lastNavAt.current < DEFAULT_COOLDOWN) {
        return false;
      }

      // Block if a critical action is running
      if (options?.blockIfLocked && Interaction.isLocked(options.blockIfLocked)) {
        return false;
      }

      return true;
    },
    [],
  );

  const push = useCallback(
    (route: string, options?: NavigateOptions) => {
      if (!canNavigate(route, options)) return;
      lastRoute.current = route;
      lastNavAt.current = Date.now();
      debugLogNavigation(route, 'push');
      router.push(route as any);
    },
    [router, canNavigate],
  );

  const replace = useCallback(
    (route: string, options?: NavigateOptions) => {
      if (!canNavigate(route, options)) return;
      lastRoute.current = route;
      lastNavAt.current = Date.now();
      debugLogNavigation(route, 'replace');
      router.replace(route as any);
    },
    [router, canNavigate],
  );

  const back = useCallback(() => {
    const now = Date.now();
    if (now - lastNavAt.current < DEFAULT_COOLDOWN) return;
    lastNavAt.current = now;
    recordBackNavigation(lastRoute.current);
    debugLogNavigation(lastRoute.current || '(back)', 'back');
    lastRoute.current = '';
    router.back();
  }, [router]);

  return { push, replace, back } as const;
}
