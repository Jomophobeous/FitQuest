# Phase 33 — UI_DIFF_MAP

**Mode**: `full_autonomous` | **Generated**: 2026-04-02

Maps ALL UI patterns in production against clean-room tokens and base components.

---

## 1. BUTTONS

### Production Usage

| Pattern | Instances | Screens Using |
|---------|-----------|---------------|
| `<TouchableOpacity>` (freestyle) | ~350 | ALL screens |
| `<Pressable>` | ~30 | coach, dashboard, profile |
| `<GradientButton>` (system) | 32 | dashboard, fitquest, workout, paywall, craft-my-body, exercises, saved-workouts, create-workout |
| Inline styled `<TouchableOpacity>` with gradient | ~30 | login, register, onboarding |

### Clean-Room Equivalent

| Component | API | Status |
|-----------|-----|--------|
| `GradientButton` | `title`, `variant` (primary/success/warning), `size` (sm/md/lg), `onPress`, `style?` | ✅ Exists in both repos |

### Action Required

| Issue | Count | Fix |
|-------|-------|-----|
| Freestyle TouchableOpacity for CTA actions | ~80 | Replace with GradientButton where semantically a CTA |
| TouchableOpacity for list items / cards | ~270 | KEEP — these are tap targets, not buttons |
| Inline gradient buttons (login/register) | ~10 | Replace with GradientButton |

**Rule**: GradientButton for CTAs. TouchableOpacity for navigation/tap targets. No other button patterns.

---

## 2. CARDS

### Production Usage

| Pattern | Instances | Screens Using |
|---------|-----------|---------------|
| `<GlassCard>` (system) | 162 | dashboard, fitquest, workout, coach, analytics, move, health-dashboard, exercises, profile, saved-workouts, craft-my-body, workouts |
| `<Animated.View>` with card styling | ~40 | onboarding, analytics, profile |
| `<View>` with `borderRadius + backgroundColor` | ~60 | scattered — inline card patterns |

### Clean-Room Equivalent

| Component | API | Status |
|-----------|-----|--------|
| `GlassCard` | `children`, `style?`, `onPress?`, `animated?` | ✅ Exists in both repos |

### Action Required

| Issue | Count | Fix |
|-------|-------|-----|
| GlassCard already dominant | 162 | ✅ No action |
| Animated.View pseudo-cards | ~40 | Evaluate — some are animation containers, not cards |
| Inline View cards | ~60 | Replace with GlassCard where visually a card |

**Rule**: GlassCard for all card containers. Plain View only for non-visual layout wrappers.

---

## 3. TYPOGRAPHY

### Production Usage

| Pattern | Instances | Screens Using |
|---------|-----------|---------------|
| `<ThemedText>` (system) | 374 | scattered across most screens |
| `<Text>` (raw, unstyled) | 570 | ALL screens |
| Inline `fontSize: N` in StyleSheet | 385 | ALL screens (highest in profile:60, fitquest:43, move:39) |

### Clean-Room Equivalent

| Component | API | Variants |
|-----------|-----|----------|
| `ThemedText` | `variant` (h1/h2/h3/h4/body/bodySmall/caption), `color` (primary/secondary/muted/accent) | ✅ Exists in both repos |

### Font Size Mapping (Production → Token)

| Hardcoded fontSize | Occurrences | ThemedText Variant |
|-------------------|-------------|-------------------|
| 32-36 | ~15 | `h1` (32px) |
| 24-28 | ~25 | `h2` (24px) |
| 20-22 | ~30 | `h3` (20px) |
| 18 | ~35 | `h4` (18px) |
| 15-16 | ~120 | `body` (16px) |
| 13-14 | ~80 | `bodySmall` (14px) |
| 10-12 | ~80 | `caption` (12px) |

### Per-Screen Typography Violations

| Screen | Inline fontSize Count | Raw `<Text>` Count |
|--------|----------------------|-------------------|
| profile.tsx | 60 | ~80 |
| fitquest.tsx | 43 | ~50 |
| move.tsx | 39 | ~40 |
| analytics.tsx | 37 | ~35 |
| craft-my-body.tsx | 29 | ~30 |
| onboarding.tsx | 27 | ~35 |
| workout.tsx | 24 | ~25 |
| dashboard.tsx | 22 | ~30 |
| coach/index.tsx | 19 | ~30 |
| exercises.tsx | 17 | ~20 |
| create-workout.tsx | 17 | ~20 |
| nutrition-calculator.tsx | 16 | ~15 |
| meal-prep.tsx | 16 | ~20 |
| saved-workouts.tsx | 15 | ~15 |
| login.tsx | 15 | ~15 |
| feedback.tsx | 15 | ~15 |
| paywall.tsx | 14 | ~15 |
| health-dashboard.tsx | 11 | ~15 |
| register.tsx | 8 | ~10 |
| splash.tsx | 5 | ~5 |
| backups.tsx | ~4 | ~10 |
| legal-center.tsx | ~2 | ~10 |
| privacy-policy.tsx | ~1 | ~5 |
| terms-of-service.tsx | ~1 | ~5 |

### Action Required

| Issue | Count | Fix |
|-------|-------|-----|
| Raw `<Text>` with inline fontSize | 385 | Replace with `<ThemedText variant="...">` |
| Raw `<Text>` without fontSize (uses default) | ~185 | Replace with `<ThemedText variant="body">` |
| ThemedText already adopted | 374 | ✅ No action |

**Rule**: ALL text must use ThemedText. Zero raw `<Text>` in screens.

---

## 4. COLORS

### Production Usage

| Pattern | Instances |
|---------|-----------|
| `theme.colors.*` (system) | 1,605 |
| Hardcoded hex `#` in styles | 194 (lint errors) |
| Hardcoded `#fff` / `#000` in JSX (icon colors, etc.) | ~26 |
| `bg-white` / light backgrounds | 2 (lint errors) |

### Hardcoded Color Mapping (Production → Token)

| Hardcoded Color | Occurrences | Token Replacement |
|----------------|-------------|-------------------|
| `#fff` / `#FFFFFF` | ~18 | `theme.colors.text` (dark mode) or `theme.colors.onAccent` |
| `#000` / `#000000` | ~3 | `theme.colors.background` or `theme.colors.text` (light mode) |
| `#0A0E17` | 3 (splash) | `theme.colors.background` |
| `#10B981` | 8 (splash, saved-workouts) | `theme.colors.accent` |
| `#059669` | 2 (splash) | Token: category.body_control gradient end |
| `#B91C1C` | 1 (move) | `theme.colors.error` variant (dark) |
| `#7C3AED` | 1 (saved-workouts) | `theme.colors.categoryPurple` |
| `#4338CA` | 1 (saved-workouts) | Token: indigo variant |
| `#FFFFFF` bg | 2 | `theme.colors.surface` |

### Clean-Room Token Coverage

| Token Type | Production Defined | Clean-Room Token | Gap |
|-----------|-------------------|-----------------|-----|
| Background | `theme.colors.background` | `colors.dark.background` / `colors.light.background` | ✅ Aligned |
| Surface | `theme.colors.surface` | `colors.dark.surface` / `colors.light.surface` | ✅ Aligned |
| Text | `theme.colors.text` | `colors.dark.text` / `colors.light.text` | ✅ Aligned |
| Accent | `theme.colors.accent` | `colors.semantic.primary` | ✅ Aligned (#10B981) |
| Error | `theme.colors.error` | `colors.dark.error` | ✅ Aligned |
| Warning | `theme.colors.warning` | `colors.dark.warning` | ✅ Aligned |
| textMuted | `theme.colors.textMuted` | `colors.dark.textMuted` | ✅ Aligned |
| textSecondary | `theme.colors.textSecondary` | `colors.dark.textSecondary` | ✅ Aligned |
| onAccent | *(missing in some screens)* | `colors.dark.onAccent` | ⚠️ Screens use `#fff` instead |
| Category colors | `categoryThemes[cat].colors` | `colors.category.*` | ⚠️ Production has gradients, tokens have flat |

### Action Required

| Issue | Count | Fix |
|-------|-------|-----|
| Hardcoded hex in StyleSheet | 194 | Replace with `theme.colors.*` references |
| `#fff` icon color props | ~18 | Replace with `theme.colors.onAccent` or `theme.colors.text` |
| `bg-white` patterns | 2 | Replace with `theme.colors.surface` |
| Splash hardcoded colors | 6 | Replace with theme tokens |

**Rule**: Zero hardcoded hex values. All color references through `theme.colors.*`.

---

## 5. SPACING

### Production Usage

| Pattern | Instances |
|---------|-----------|
| `theme.spacing[N]` (system) | 105 |
| Hardcoded numeric padding/margin | ~66 |
| Total spacing declarations | ~171 |

### Spacing Token Map

| Numeric Value | Token Key | Common Usage |
|--------------|-----------|-------------|
| 4 | `theme.spacing[1]` | Icon gaps, tiny padding |
| 8 | `theme.spacing[2]` | Small gaps, compact spacing |
| 12 | `theme.spacing[3]` | Medium-small gaps |
| 16 | `theme.spacing[4]` | Standard padding, section gaps |
| 20 | `theme.spacing[5]` | Card padding, larger gaps |
| 24 | `theme.spacing[6]` | Section spacing |
| 32 | `theme.spacing[8]` | Large section gaps |
| 40 | `theme.spacing[10]` | Extra-large gaps |

### Action Required

| Issue | Count | Fix |
|-------|-------|-----|
| Hardcoded padding/margin | ~66 | Replace with `theme.spacing[N]` |
| Theme spacing already dominant | 105 | ✅ No action |

**Adoption rate**: 61% themed. Target: 100%.

---

## 6. BORDER RADIUS

### Production Usage

| Pattern | Instances |
|---------|-----------|
| `theme.borderRadius.*` (system) | ~40 |
| Hardcoded `borderRadius: N` | ~80 |
| `borderRadius: 9999` / `999` (pill) | ~15 |

### Token Map

| Hardcoded Value | Token Key |
|----------------|-----------|
| 4 | `theme.borderRadius.sm` |
| 8 | `theme.borderRadius.md` |
| 12-16 | `theme.borderRadius.lg` |
| 20-24 | `theme.borderRadius.xl` |
| 9999 | `theme.borderRadius.full` |

### Action Required

| Issue | Count | Fix |
|-------|-------|-----|
| Hardcoded borderRadius | ~80 | Replace with `theme.borderRadius.*` |
| Already themed | ~40 | ✅ No action |

---

## 7. COMPONENT ADOPTION SUMMARY

| Component | System Instances | Freestyle Instances | Adoption Rate | Target |
|-----------|-----------------|--------------------|--------------:|-------:|
| GradientButton | 32 | ~80 CTA-worthy | 29% | 100% |
| GlassCard | 162 | ~60 inline cards | 73% | 100% |
| ThemedText | 374 | 570 raw Text | 40% | 100% |
| theme.colors | 1,605 | ~220 hardcoded | 88% | 100% |
| theme.spacing | 105 | ~66 hardcoded | 61% | 100% |
| theme.borderRadius | 40 | ~80 hardcoded | 33% | 100% |

### Clean-Room Components NOT in Production (Portable)

| Component | Purpose | Value If Ported |
|-----------|---------|----------------|
| ExerciseCard | Extracted exercise list item | Replaces inline exercise rendering in exercises.tsx, create-workout.tsx |
| TimerDisplay | Countdown timer component | Could replace inline timer in workout.tsx |
| WorkoutHeader | Workout screen top bar | Could replace inline header in workout.tsx |
| ScreenStates | Loading/Empty/Error states | Centralize scattered loading patterns |
| SectionBlock | Padded content section | Standardize section wrappers |
| SettingsItem | Settings row with icon | Extract from profile.tsx MenuItem |

---

*Alfred Ω — Phase 33 System Convergence*
