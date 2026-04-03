# Phase 33 — LINT_ERADICATION_PLAN

**Mode**: `full_autonomous` | **Generated**: 2026-04-02

Batch-driven lint eradication across all 31 screens. Each batch targets a single rule type, is pattern-driven, and avoids breaking layout.

---

## Current Violation Summary

| Rule ID | Severity | Count | Batch |
|---------|----------|------:|-------|
| `no-inline-fontsize` | warning | 610 | B (Typography) |
| `no-hardcoded-colors` | error | 194 | A (Colors) |
| `no-settimeout-fix` | error | 52 | D (Stability) |
| `no-math-random-security` | error | 28 | D (Stability) |
| `no-bg-white` | error | 2 | A (Colors) |
| `no-async-storage` | error | 1 | D (Stability) |
| **TOTAL** | | **887** | 4 Batches |

**Error total**: 225 | **Warning total**: 662

---

## Batch A — Colors (196 violations)

**Rules**: `no-hardcoded-colors` (194) + `no-bg-white` (2)
**Priority**: 1 (highest — errors block prod)
**Method**: Pattern-driven find-replace

### Color Replacement Map

| Hardcoded Pattern | Replacement Token | Frequency |
|------------------|-------------------|-----------|
| `#FFFFFF` / `#ffffff` / `#fff` | `theme.colors.text` (on dark bg) or `theme.colors.surface` (as bg) | ~35 |
| `#000000` / `#000` | `theme.colors.background` (dark mode value) | ~8 |
| `#0A0E17` | `theme.colors.background` | ~5 |
| `#10B981` | `theme.colors.accent` | ~20 |
| `#059669` | `theme.colors.accentDark` (if exists) or extract as token | ~5 |
| `#EF4444` | `theme.colors.error` | ~8 |
| `#F4A427` | `theme.colors.warning` | ~5 |
| `#8B5CF6` | `theme.colors.categoryPurple` (or add to theme) | ~4 |
| `#6366F1` | `theme.colors.categoryIndigo` (or add to theme) | ~4 |
| `#3B82F6` | `theme.colors.info` | ~6 |
| `#F59E0B` / `#F97316` | `theme.colors.categoryOrange` + `theme.colors.categoryYellow` | ~8 |
| `#EC4899` | `theme.colors.categoryPink` | ~3 |
| `gray-50` / `bg-white` | `theme.colors.surface` | 2 |
| Other hex values | Context-dependent — map individually | ~83 |

### Execution Order (Screens)

| Phase | Screens | Est. Violations | Notes |
|-------|---------|----------------:|-------|
| A.1 | Tier 3 (splash, backups, legal, paywall, register, etc.) | ~25 | Quick wins. Validate dark/light mode. |
| A.2 | Tier 2 (exercises, workout, analytics, create-workout, etc.) | ~75 | Batch per common hex value. |
| A.3 | Tier 1 (profile, fitquest, dashboard, coach, move, onboarding) | ~96 | Largest screens. Careful with conditional gradients. |

### Safety Checks

- [ ] After each screen fix: verify dark mode appearance
- [ ] After each screen fix: verify light mode appearance
- [ ] Category-colored elements must use `categoryThemes[cat].colors.*` not hardcoded hex
- [ ] Gradient arrays (`LinearGradient colors=[]`) — map to theme tokens or extract as constants
- [ ] Icon `color="#fff"` props → `theme.colors.text` or `theme.colors.onAccent`

### Blocked Until

- Verify `theme.colors.onAccent` exists in theme-system.ts (used for white-on-green text)
- Verify `theme.colors.categoryPurple` etc. exist or must be added
- If tokens are missing: add to theme-system.ts FIRST, then proceed with replacement

---

## Batch B — Typography (610 violations)

**Rule**: `no-inline-fontsize`
**Priority**: 2 (warnings — largest volume, highest visual impact)
**Method**: Replace `<Text style={{fontSize: N}}>` → `<ThemedText variant="X">`

### fontSize → Variant Mapping

| fontSize Range | ThemedText Variant | Font Size | Font Weight |
|---------------|-------------------|-----------|-------------|
| 32–36 | `h1` | 32 | 700 (bold) |
| 24–28 | `h2` | 24 | 600 (semibold) |
| 20–22 | `h3` | 20 | 600 |
| 17–19 | `h4` | 18 | 500 (medium) |
| 15–16 | `body` | 16 | 400 (normal) |
| 13–14 | `bodySmall` | 14 | 400 |
| 10–12 | `caption` | 12 | 400 |

### Screen Priority (by violation count)

| Phase | Screen | fontSize Violations | Approach |
|-------|--------|--------------------:|----------|
| B.1 | profile.tsx | 60 | Extract sections to sub-components using ThemedText. Cannot batch-fix — needs component extraction. |
| B.2 | fitquest.tsx | 43 | Map card titles → h3, card body → bodySmall, labels → caption |
| B.3 | move.tsx | 39 | Stats displays → h2/h3, labels → caption, descriptions → body |
| B.4 | analytics.tsx | 37 | Chart labels → caption, stat values → h2, section titles → h3 |
| B.5 | craft-my-body.tsx | 29 | Form labels → body, values → h3, descriptions → bodySmall |
| B.6 | onboarding.tsx | 27 | Step titles → h2, descriptions → body, labels → bodySmall |
| B.7 | workout.tsx | 24 | Timer display → h1, exercise name → h2, instructions → body |
| B.8 | dashboard.tsx | 22 | Widget titles → h4, values → h2, labels → caption |
| B.9 | coach/index.tsx | 19 | Message text → body, timestamps → caption, headers → h3 |
| B.10 | exercises.tsx | 17 | List item names → body, categories → caption, details → bodySmall |
| B.11 | create-workout.tsx | 17 | Same as exercises pattern |
| B.12 | nutrition-calculator.tsx | 16 | Form labels → body, results → h2, units → caption |
| B.13 | meal-prep.tsx | 16 | List items → body, headers → h3, details → bodySmall |
| B.14 | saved-workouts.tsx | 15 | Card titles → h4, metadata → caption, descriptions → bodySmall |
| B.15 | login.tsx | 15 | Form labels → body, title → h2, links → bodySmall |
| B.16 | feedback.tsx | 15 | Form labels → body, title → h2 |
| B.17 | paywall.tsx | 14 | Feature titles → h3, prices → h2, descriptions → body |
| B.18 | health-dashboard.tsx | 11 | Ring labels → caption, scores → h1, section headers → h3 |
| B.19 | register.tsx | 8 | Same pattern as login |
| B.20 | splash.tsx | 5 | App title → h1, subtitle → body |
| B.21 | Remaining Tier 3 | ~8 | Direct fix |

### Pattern Rules

1. **Raw `<Text>` → `<ThemedText>`**: Every `<Text>` import should be reviewed. If it's displaying user-visible text, replace with ThemedText.
2. **Style consolidation**: Remove `fontSize`, `fontWeight`, `color` from inline styles when ThemedText variant covers them.
3. **Preserve non-text-styling**: `padding`, `margin`, `textAlign`, `lineHeight` may remain on ThemedText's `style` prop.
4. **Color prop**: Use ThemedText `color` prop instead of inline `color: theme.colors.X` where possible. Map: `theme.colors.text` → `color="primary"`, `theme.colors.textSecondary` → `color="secondary"`, `theme.colors.textMuted` → `color="muted"`, `theme.colors.accent` → `color="accent"`.

### Cannot Auto-Fix (Manual Review Required)

- Dynamic fontSize (e.g., `fontSize: isLarge ? 24 : 16`) — need conditional variant selection
- Text inside `Animated.View` with animated font size — keep as-is, not ThemedText territory
- Text in SVG/chart overlays — not React Native Text components

---

## Batch C — Spacing Normalization (~66 violations)

**Rule**: Not currently in lint.js (implicit — tracked via UI_DIFF_MAP)
**Priority**: 3 (lower severity, improves consistency)
**Method**: Find hardcoded padding/margin → replace with `theme.spacing[N]`

### Spacing Replacement Map

| Hardcoded Value | Token | Usage |
|----------------|-------|-------|
| `padding: 4` / `margin: 4` | `theme.spacing[1]` | Icon gaps |
| `padding: 8` / `margin: 8` | `theme.spacing[2]` | Small gaps |
| `padding: 12` / `margin: 12` | `theme.spacing[3]` | Medium gaps |
| `padding: 16` / `margin: 16` | `theme.spacing[4]` | Standard padding |
| `padding: 20` / `margin: 20` | `theme.spacing[5]` | Card padding |
| `padding: 24` / `margin: 24` | `theme.spacing[6]` | Section spacing |
| `padding: 32` / `margin: 32` | `theme.spacing[8]` | Large gaps |
| `padding: 40` / `margin: 40` | `theme.spacing[10]` | Extra-large gaps |
| `padding: 48` / `margin: 48` | `theme.spacing[12]` | Page margins |

### Execution: Same tier order as Batch A (Tier 3 → Tier 2 → Tier 1)

### Cannot Auto-Fix

- Non-standard values (e.g., `padding: 14`, `margin: 18`) — round to nearest token
- `paddingTop: StatusBar.currentHeight` — platform utility, not a token

---

## Batch D — Stability & Security (81 violations)

**Rules**: `no-settimeout-fix` (52) + `no-math-random-security` (28) + `no-async-storage` (1)
**Priority**: 4 (security errors — must fix for prod, but lower volume)

### setTimeout Fixes (52)

| Pattern | Fix |
|---------|-----|
| `setTimeout(() => setState(...), N)` | Replace with explicit state gate or `useLayoutEffect` |
| `setTimeout(() => ref.current?.scrollTo(...), N)` | Use `InteractionManager.runAfterInteractions()` |
| `setTimeout(() => navigation(), N)` | Use `requestAnimationFrame` or state machine |
| `setTimeout` for debounce | Replace with `useDebouncedCallback` or `lodash.debounce` |
| `setTimeout` for animation delay | Replace with `Animated.delay()` or Reanimated `withDelay()` |

**Cannot Auto-Fix**: Each setTimeout needs individual context review to determine the correct replacement.

### Math.random Fixes (28)

| Pattern | Fix |
|---------|-----|
| `Math.random()` for IDs | Replace with `expo-crypto` `randomUUID()` |
| `Math.random()` for shuffling | Replace with `expo-crypto` `getRandomBytes()` + Fisher-Yates |
| `Math.random()` for visual jitter | KEEP — non-security context, but add `// eslint-disable-next-line` to suppress lint |

### AsyncStorage Fix (1)

| Pattern | Fix |
|---------|-----|
| Any `AsyncStorage` import | Replace with `SecureStore` from `expo-secure-store` or SQLite `app_state` table |

---

## Execution Timeline

| Batch | Rule(s) | Violations | Approach | When |
|-------|---------|-----------|----------|------|
| **A** | Colors + bg-white | 196 | Pattern-driven replacement map | FIRST |
| **B** | Typography | 610 | Text → ThemedText migration per screen | SECOND |
| **C** | Spacing | ~66 | Numeric → token replacement | THIRD |
| **D** | setTimeout + Math.random + AsyncStorage | 81 | Individual review per instance | FOURTH |

**Total target**: 887 → 0 violations

### Validation After Each Batch

1. Re-run `node ui-system/rules/lint.js` → verify violation count decreased
2. Visual check: dark mode on 3 representative screens per tier
3. Visual check: light mode on same screens
4. Smoke test: navigate all Tier 1 screens without crash

---

*Alfred Ω — Phase 33 System Convergence*
