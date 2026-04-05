/**
 * NavigationGuard — Enforces auth on protected routes.
 *
 * ENFORCEMENT RULE: If user is not signed in AND not on a public route,
 * redirect to login. No exceptions. No silent failures.
 *
 * Public routes (no auth required):
 *   - /login
 *   - /register
 *   - /splash
 *   - /onboarding
 *   - /privacy-policy
 *   - /terms-of-service
 *   - /legal-center
 *
 * All other routes require isSignedIn === true.
 */

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const PUBLIC_ROUTES = new Set([
  '/login',
  '/register',
  '/splash',
  '/onboarding',
  '/privacy-policy',
  '/terms-of-service',
  '/legal-center',
]);

/**
 * Returns true if the given pathname is a public (no-auth) route.
 */
function isPublicRoute(pathname: string): boolean {
  // Normalize: strip trailing slash
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_ROUTES.has(normalized);
}

/**
 * Hook that enforces navigation guards.
 * Must be called inside a component that has access to AuthProvider AND router.
 *
 * When auth state changes to signed-out and user is on a protected route,
 * immediately redirects to /login.
 */
export function useNavigationGuard(): void {
  const { isSignedIn, isAuthenticated, isLoading, isServerConfigured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Don't guard during loading — auth state is indeterminate
    if (isLoading) {
      hasRedirected.current = false;
      return;
    }

    // If no server configured, auth is local-only (AuthGate handles it)
    if (!isServerConfigured) return;

    // If authenticated (local OR server token), allow access everywhere
    // isAuthenticated = !!token || isLocallyAuthenticated
    if (isAuthenticated) {
      hasRedirected.current = false;
      return;
    }

    // Not signed in — check if current route is public
    if (isPublicRoute(pathname)) return;

    // ENFORCEMENT: Not authenticated + on protected route = redirect to login
    // Prevent redirect loops
    if (!hasRedirected.current) {
      hasRedirected.current = true;
      if (__DEV__) console.warn(`[NavigationGuard] Unauthorized access to ${pathname} — redirecting to /login`);
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, isServerConfigured, pathname, router]);
}
