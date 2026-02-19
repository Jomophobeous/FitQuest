# Screen Audit Report — Full App Review

**Date**: 2026-02-18  
**Scope**: All 30+ screens in `app/` directory  
**TypeScript**: Compiles clean after all fixes (`npx tsc --noEmit --skipLibCheck` → 0 errors)

---

## Bugs Fixed In This Audit (15 fixes)

### FIX 1 — Onboarding goal/experience enum mismatch (CRITICAL)
**File**: `app/onboarding.tsx`  
**Bug**: Goal values `BUILD_MUSCLE`, `LOSE_FAT`, `ENDURANCE`, `FLEXIBILITY`, `GENERAL_FITNESS` don't match SQLite CHECK constraint which expects `calisthenics`, `getting_taller`, `faster`, `flexible`, `mental_clarity`, `building_muscle`. Experience values `BEGINNER`/`INTERMEDIATE`/`ADVANCED` are uppercase but schema requires lowercase. Every new user's profile creation crashes with a CHECK constraint violation.  
**Fix**: Changed type definitions and all goal/experience constants to match schema values exactly.

### FIX 2 — Login passcode stale closure (CRITICAL)
**File**: `app/login.tsx`  
**Bug**: When the 4th digit is pressed, `handlePasscode()` is called via `setTimeout` but captures `passcode` from the render where it was still 3 characters. The function checks `passcode.length < 4` and returns early — passcode authentication silently never works.  
**Fix**: Added `passcodeOverride` parameter to `handlePasscode()` and passed the complete `next` string directly from the numpad handler.

### FIX 3 — CraftMyBody wrong user ID (CRITICAL)
**File**: `app/craft-my-body.tsx`  
**Bug**: Uses `'local_user'` instead of canonical `'user_local_001'` in both `generateBodyCraftAlgorithm()` and `applyAlgorithmToProfile()`. Algorithm data gets saved to a nonexistent user, creating orphan rows invisible to all other screens.  
**Fix**: Changed both calls to `'user_local_001'`.

### FIX 4 — Profile division by zero on XP bar (HIGH)
**File**: `app/profile.tsx`  
**Bug**: `stats.currentLevelXP / stats.xpForNext` produces `Infinity` when `xpForNext` is 0. XP bar width becomes `NaN%` or `Infinity%`, corrupting layout. Also, `GOAL_LABELS[profile?.goal]` crashes with `TypeError` if goal value isn't in the map.  
**Fix**: Added `stats.xpForNext > 0` guard, and `?? GOAL_LABELS.calisthenics` fallback for missing goal.

### FIX 5 — Paywall empty useEffect (CRITICAL)
**File**: `app/paywall.tsx`  
**Bug**: `if (hasAccess && !subLoading)` block was empty — subscribed users see the paywall and can re-purchase, risking duplicate charges.  
**Fix**: Added `router.back()` to redirect subscribed users away from the paywall.

### FIX 6 — FitMind reader null file_path crash (HIGH)
**File**: `app/fitmind-reader.tsx`  
**Bug**: `doc.file_path!` non-null assertion crashes for NOTE documents that store content inline (file_path is null). `DocumentProcessor.readDocumentPage(null, ...)` throws.  
**Fix**: Added null check — falls back to paginating `doc.content` for documents without a file_path.

### FIX 7 — Coach null dereference crash (HIGH)
**File**: `app/coach/index.tsx`  
**Bug**: `generateCoachResponse(text, coachCtx!)` crashes if user taps a suggestion before `loadCoachContext()` finishes (async DB calls). `coachCtx` is still null.  
**Fix**: Replaced `coachCtx!` with `coachCtx ?? { ...safeDefaults }`.

### FIX 8 — Move calorie unit mismatch (MEDIUM)
**File**: `app/move.tsx`  
**Bug**: `(todaySteps - (currentJog.distanceMeters || 0)) * 0.06` subtracts meters from steps (different units), producing meaningless calorie values.  
**Fix**: Changed to `(currentJog.distanceMeters ?? 0) * 0.06` — calories estimated from jog distance only.

### FIX 9 — Move double XP award (MEDIUM)
**File**: `app/move.tsx`  
**Bug**: `awardStepXP(todaySteps)` called on tracking START (with 0 or stale steps) AND on tracking stop — double-dipping XP.  
**Fix**: Removed the premature XP award from `handleStartTracking`.

### FIX 10 — Fitquest hardcoded user ID (MEDIUM)
**File**: `app/fitquest.tsx`  
**Bug**: `audioService.initialize('default_user')` and `audioService.updateSettings('default_user', ...)` use wrong user ID. Audio settings won't associate with the actual user.  
**Fix**: Changed both to `'user_local_001'`.

### FIX 11 — Fitquest showAllInstructions state leak (LOW)
**File**: `app/fitquest.tsx`  
**Bug**: `advanceAfterRest()` doesn't reset `showAllInstructions` to false. When rest timer auto-advances to the next exercise, expanded instructions from the previous exercise carry over.  
**Fix**: Added `setShowAllInstructions(false)` in `advanceAfterRest`.

### FIX 12 — Health dashboard scoreColor duplicate (LOW)
**File**: `app/health-dashboard.tsx`  
**Bug**: Both the 40-60 and 60-80 health score ranges returned `theme.colors.warning`. The 40-60 range should be `theme.colors.error` to differentiate poor health.  
**Fix**: Changed 40-60 range to `theme.colors.error`.

### FIX 13 — Health dashboard null snapshot properties (MEDIUM)
**File**: `app/health-dashboard.tsx`  
**Bug**: `snapshot.steps`, `snapshot.activeMinutes`, `snapshot.calories`, `snapshot.recoveryScore` accessed without null checks. Partial `getSnapshot()` data causes `NaN` in the UI.  
**Fix**: Added `?? 0` / `?? null` fallbacks on all snapshot fields.

### FIX 14 — FitMind library double-submit (MEDIUM)
**File**: `app/fitmind-library.tsx`  
**Bug**: GradientButton not disabled during document import. User can double-tap and create duplicate documents.  
**Fix**: Set `onPress` to `undefined` and opacity to 0.6 when `addingDoc` is true.

### FIX 15 — Workouts index full rewrite (CRITICAL)
**File**: `app/workouts/index.tsx`  
**Bug**: Imported `lightColors` from legacy theme (bypasses theme system entirely), used mock data instead of SQLite, raw `Text` instead of `ThemedText`, no `useLanguage()`, broken `Link href="/workout"` ignoring item ID.  
**Fix**: Complete rewrite — uses `useTheme()`, `useLanguage()`, `getRecentSessions()` from SQLite, `ThemedText`, `GlassCard`, proper navigation with item ID.

---

## Known Issues NOT Fixed (Require Broader Refactoring)

These are systemic patterns found across most screens. They're not runtime crashes but violate project conventions:

### Pattern A — Raw `<Text>` Instead of `<ThemedText>` (19 screens)
| Screens Using Raw `Text` |
|--------------------------|
| dashboard, fitquest, workout, move, exercises, profile, onboarding, login, register, splash, analytics, coach/index, nutrition-calculator, progress, saved-workouts, craft-my-body, backups, health-dashboard (partial), fitmind-reader (partial) |

**Impact**: Text rendering works but doesn't use centralized typography variants. Makes theme refactoring brittle.  
**Fix strategy**: Create a codemod script that replaces `<Text style={[..., { color: theme.colors.text }]}>` with `<ThemedText variant="body" color="primary">`.

### Pattern B — Hardcoded Colors in Constants/StyleSheets (~100+ instances across all screens)
Most common violations:
- `'#fff'` / `'#000'` for icon/button text colors (~30 instances)
- `'rgba(0,0,0,0.7)'` for modal overlays (~8 instances)
- `'#B91C1C'` for error gradient stops (~3 instances)
- Difficulty/goal/status color maps defined outside theme (~4 files)

**Fix strategy**: Add `theme.colors.onAccent`, `theme.colors.overlay`, `theme.colors.errorDark` tokens to the design system. Then migrate constants.

### Pattern C — Missing i18n in 8 Screens
| Screen | Hardcoded String Count |
|--------|----------------------|
| workout.tsx | ~25 |
| analytics.tsx | ~30 |
| craft-my-body.tsx | ~40 |
| saved-workouts.tsx | ~25 |
| progress.tsx | ~30 |
| backups.tsx | ~20 |
| coach/index.tsx | ~60 (all coaching content) |
| workouts/[id].tsx | ~5 |

**Fix strategy**: Add translation keys to `src/i18n/translations.ts` for each screen, then wrap every string in `t()`.

### Pattern D — Hardcoded Spacing in Static StyleSheets
Every screen that uses `StyleSheet.create` at module scope has hardcoded pixel values instead of `theme.spacing[n]`. This is a structural limitation — `StyleSheet.create` runs before `ThemeProvider` mounting.

**Fix strategy**: Convert to dynamic style factories: `const useStyles = () => { const { theme } = useTheme(); return useMemo(() => StyleSheet.create({...}), [theme]); }`.

### Pattern E — Missing useEffect Dependency Arrays (~15 instances across all screens)
Most common: `loadData`/`loadExercises`/`filterExercises` functions defined inside component body but not in useEffect deps arrays, creating stale closure risk.

**Fix strategy**: Either wrap functions in `useCallback` and add to deps, or move function body inside the effect.

---

## Prevention Strategies

### Strategy 1: Enum Validation Layer
Create a `src/utils/schemaValidation.ts` that exports validated type maps:
```typescript
const VALID_GOALS = ['calisthenics', 'getting_taller', 'faster', 'flexible', 'mental_clarity', 'building_muscle'] as const;
type Goal = typeof VALID_GOALS[number];
export function assertGoal(v: string): Goal { ... }
```
All screens creating/updating profiles must use these assertions.

### Strategy 2: Canonical User ID Constant
Create `src/constants.ts` with `export const LOCAL_USER_ID = 'user_local_001'` and grep-replace all hardcoded user ID strings across the codebase.

### Strategy 3: Null-Safe Data Accessors
All database service functions that return optional fields should use `?? defaultValue` patterns. Create a `safePick` utility for snapshot objects.

### Strategy 4: GradientButton Busy State
Add a `disabled` prop to `GradientButton` that prevents `onPress` when true. All form submissions should pass `disabled={isBusy}`.

### Strategy 5: Screen Linting Checklist
Before merging any screen file, verify:
- [ ] Uses `useTheme()` — no `lightColors` import
- [ ] Uses `useLanguage()` + `t()` for all user-facing strings
- [ ] Uses `ThemedText` for all text rendering
- [ ] No hardcoded hex colors
- [ ] User ID is `'user_local_001'` or from context
- [ ] No division without zero-check
- [ ] All `useEffect` deps arrays are complete

---

## Files Modified In This Audit

| File | Changes |
|------|---------|
| `app/onboarding.tsx` | Goal enum values → schema-compliant lowercase |
| `app/login.tsx` | Passcode stale closure → pass code directly |
| `app/craft-my-body.tsx` | `'local_user'` → `'user_local_001'` (2 locations) |
| `app/profile.tsx` | Division-by-zero guard + goalInfo fallback |
| `app/paywall.tsx` | Empty useEffect → `router.back()` |
| `app/fitmind-reader.tsx` | Null file_path → inline content fallback |
| `app/coach/index.tsx` | `coachCtx!` → safe default object |
| `app/move.tsx` | Calorie unit mismatch + double XP removal |
| `app/fitquest.tsx` | User ID fix + showAllInstructions reset |
| `app/health-dashboard.tsx` | scoreColor fix + snapshot null safety |
| `app/fitmind-library.tsx` | Double-submit prevention |
| `app/workouts/index.tsx` | Full rewrite (legacy theme → useTheme + real data) |
