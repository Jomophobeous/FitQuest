/**
 * Tests: Navigation Safety & Route Consistency
 *
 * Validates that all registered routes have corresponding screen files,
 * no route collisions exist, and tab/hidden screen config is correct.
 * Does NOT require React rendering — pure structural analysis.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const APP_DIR = path.resolve(__dirname, '../../app');

// ============================================
// Route inventory (mirrors _layout.tsx)
// ============================================

/** Tab screens — visible in bottom navigation */
const TAB_SCREENS = ['dashboard', 'fitquest', 'move', 'coach/index', 'profile'] as const;

/** Hidden screens — not in tab bar (href: null) */
const HIDDEN_SCREENS = [
  'index',
  'login',
  'register',
  'splash',
  'onboarding',
  'workout',
  'workouts/index',
  'workouts/[id]',
  'progress',
  'create-workout',
  'analytics',
  'saved-workouts',
  'exercises',
  'legal-center',
  'privacy-policy',
  'terms-of-service',
  'feedback',
  'craft-my-body',
  'paywall',
  'dev/debug-panel',
  'meal-prep',
  'backups',
  'health-dashboard',
  'nutrition-calculator',
] as const;

/**
 * Routes registered in _layout.tsx but missing screen files.
 * These are REAL navigation defects — tracked as tech debt.
 * App will crash if user navigates to these routes.
 */
const ORPHANED_ROUTES = [
  // All previously orphaned routes have been resolved:
  // - meal-prep, backups, health-dashboard, nutrition-calculator: stub screens created
  // - professor/index, fitmind-library, fitmind-reader, dev/ui-preview: removed from layout
] as const;

const ALL_ROUTES = [...TAB_SCREENS, ...HIDDEN_SCREENS];

// ============================================
// Screen file existence
// ============================================

describe('Route → Screen file mapping', () => {
  for (const route of ALL_ROUTES) {
    it(`route "${route}" has a corresponding screen file`, () => {
      const tsxPath = path.join(APP_DIR, route + '.tsx');
      const dirIndexPath = path.join(APP_DIR, route, 'index.tsx');

      // Route can be a file (route.tsx) or a directory index (route/index.tsx)
      const exists = fs.existsSync(tsxPath) || fs.existsSync(dirIndexPath);
      expect(exists).toBe(true);
    });
  }
});

// ============================================
// No route collisions
// ============================================

describe('Route collision prevention', () => {
  it('no duplicate route names in ALL_ROUTES', () => {
    const seen = new Set<string>();
    for (const route of ALL_ROUTES) {
      expect(seen.has(route)).toBe(false);
      seen.add(route);
    }
  });

  it('tab screens do not appear in hidden screens', () => {
    const tabSet = new Set(TAB_SCREENS as readonly string[]);
    for (const hidden of HIDDEN_SCREENS) {
      expect(tabSet.has(hidden)).toBe(false);
    }
  });
});

// ============================================
// Tab configuration invariants
// ============================================

describe('Tab configuration', () => {
  it('exactly 5 tab screens registered', () => {
    expect(TAB_SCREENS).toHaveLength(5);
  });

  it('tab screen names are valid alphanumeric or path segments', () => {
    for (const tab of TAB_SCREENS) {
      expect(tab).toMatch(/^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)*$/);
    }
  });

  it('hidden screens use valid naming patterns', () => {
    for (const route of HIDDEN_SCREENS) {
      // Allow: alpha-dash, path segments, dynamic [param]
      expect(route).toMatch(/^[a-z\[][a-z0-9\[\]-]*(\/[a-z\[][a-z0-9\[\]-]*)*$/);
    }
  });
});

// ============================================
// Screen files export defaults (structural check)
// ============================================

describe('Screen file structure', () => {
  const screenFiles = ALL_ROUTES
    .map((r) => {
      const tsxPath = path.join(APP_DIR, r + '.tsx');
      if (fs.existsSync(tsxPath)) return tsxPath;
      const dirPath = path.join(APP_DIR, r, 'index.tsx');
      if (fs.existsSync(dirPath)) return dirPath;
      return null;
    })
    .filter(Boolean) as string[];

  it('all screen files contain export default', () => {
    const missingDefault: string[] = [];
    for (const file of screenFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('export default')) {
        missingDefault.push(path.relative(APP_DIR, file));
      }
    }
    expect(missingDefault).toEqual([]);
  });
});

// ============================================
// Auth-gated screen identification
// ============================================

describe('Auth flow screens', () => {
  const AUTH_SCREENS = ['login', 'register', 'splash', 'onboarding'];

  it('all auth screens are registered as hidden screens', () => {
    for (const screen of AUTH_SCREENS) {
      expect((HIDDEN_SCREENS as readonly string[]).includes(screen)).toBe(true);
    }
  });

  it('auth screens are not tab-visible', () => {
    for (const screen of AUTH_SCREENS) {
      expect((TAB_SCREENS as readonly string[]).includes(screen)).toBe(false);
    }
  });
});

// ============================================
// Dynamic route safety
// ============================================

describe('Dynamic route segments', () => {
  it('workouts/[id] uses bracket syntax for dynamic param', () => {
    const route = 'workouts/[id]';
    expect(route).toMatch(/\[.+\]/);
    expect((ALL_ROUTES as readonly string[]).includes(route)).toBe(true);
  });
});

// ============================================
// Orphaned route detection (tech debt tracker)
// ============================================

describe('Orphaned routes (registered in _layout.tsx but missing screen files)', () => {
  it('identifies all known orphaned routes', () => {
    const confirmed: string[] = [];
    for (const route of ORPHANED_ROUTES) {
      const tsxPath = path.join(APP_DIR, route + '.tsx');
      const dirIndexPath = path.join(APP_DIR, route, 'index.tsx');
      if (!fs.existsSync(tsxPath) && !fs.existsSync(dirIndexPath)) {
        confirmed.push(route);
      }
    }
    // All orphaned routes have been resolved
    expect(confirmed.length).toBe(0);
  });

  it('counts exactly the expected number of orphaned routes', () => {
    let missing = 0;
    for (const route of ORPHANED_ROUTES) {
      const tsxPath = path.join(APP_DIR, route + '.tsx');
      const dirIndexPath = path.join(APP_DIR, route, 'index.tsx');
      if (!fs.existsSync(tsxPath) && !fs.existsSync(dirIndexPath)) {
        missing++;
      }
    }
    // All orphaned routes resolved — none should be missing
    expect(missing).toBe(0);
  });
});
