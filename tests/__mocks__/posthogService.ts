/**
 * Mock for src/services/posthogService.tsx
 * Prevents Rollup from parsing the .tsx file (JSX) in vitest.
 */
export function isPostHogConfigured(): boolean {
  return false;
}

export function getPostHogClient(): Promise<null> {
  return Promise.resolve(null);
}

export function PostHogAnalyticsProvider({ children }: { children: any }) {
  return children;
}
