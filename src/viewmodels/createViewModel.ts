/**
 * createViewModel — ViewModel factory for UI isolation.
 *
 * Wraps a custom hook's logic to enforce the ViewModel pattern:
 *   UI → ViewModel (hook) → Services → DB
 *
 * The factory itself is minimal — it returns the hook function as-is
 * but provides a standardized contract and type safety.
 * The real enforcement is architectural: screens MUST get all data
 * and actions through the returned ViewModel hook, never through
 * direct service/DB imports.
 *
 * Usage:
 *   // In src/viewmodels/useDashboardViewModel.ts
 *   export const useDashboardViewModel = createViewModel(() => {
 *     const [data, setData] = useState<DashboardData | null>(null);
 *     useEffect(() => { loadDashboard().then(setData); }, []);
 *     return { data };
 *   });
 *
 *   // In app/dashboard.tsx
 *   const vm = useDashboardViewModel();
 *   if (!vm.data) return <Loading />;
 *   return <DashboardView {...vm} />;
 */

/**
 * Creates a typed ViewModel hook.
 * The logic function is a standard React hook — it may use useState,
 * useEffect, useCallback, etc. It encapsulates ALL service/DB access
 * for a given screen.
 */
export function createViewModel<T>(logic: () => T): () => T {
  return logic;
}
