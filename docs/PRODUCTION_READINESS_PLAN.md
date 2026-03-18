# FitQuest 2.0 — Production Readiness Plan

> Created: 18 March 2026  
> Goal: Move from alpha (6.5/10) to beta-ready (8/10) in actionable phases  
> Principle: Fix what we can NOW, defer what needs external keys/services

---

## Current Score: 6.5/10

| Area | Score | Blocker? |
|------|-------|----------|
| Core workout loop | 9/10 | No |
| Data layer (SQLite + encryption) | 9/10 | No |
| Theme system adoption | 5/10 | No — fixable now |
| Accessibility | 1/10 | **YES** — Play Store risk |
| ProgressRing accuracy | 2/10 | **YES** — lies to users |
| Asset automation | 3/10 | No — fixable now |
| Crash reporting | 0/10 | Needs Sentry DSN |
| RevenueCat / IAP | 0/10 | Needs API keys (deferred) |
| Analytics | 0/10 | Needs backend (deferred) |
| APK size | 3/10 | Needs image optimization strategy |
| Test coverage | 2/10 | Important but not blocking alpha |

---

## Phase A: "Fix the Lies" (DO NOW — no external deps)

These are things we can fix right now with zero external services.

### A1. ProgressRing → SVG-based (CRITICAL)
- **Problem**: CSS border-color hack renders only at 0/25/50/75/100% 
- **Fix**: Replace with `react-native-svg` Circle + strokeDasharray/strokeDashoffset
- **Impact**: Every screen that shows progress becomes accurate
- **Files**: `src/components/ui/GlassUI.tsx` (ProgressRing component)
- **Effort**: ~30 min

### A2. Accessibility Labels on 3 Main Tabs (CRITICAL)
- **Problem**: exercises, move, profile have zero a11y — Play Store rejection risk
- **Fix**: Add `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` to:
  - Exercise cards, filter pills, search bar, FAB
  - Move step counter, jog buttons, activity toggle, history items
  - Profile menu items, avatar picker, all setting rows
- **Files**: `app/exercises.tsx`, `app/move.tsx`, `app/profile.tsx`
- **Effort**: ~45 min

### A3. Automate Exercise Image Copy (HIGH)
- **Problem**: `prebuild --clean` wipes images, manual re-copy needed
- **Fix**: Add a `postInstall` or `expo-prebuild-config` plugin that copies images automatically
- **Approach**: Create `scripts/copy-exercise-images.sh` and wire into `app.config.ts` as a config plugin
- **Files**: `scripts/copy-exercise-images.sh`, `app.config.ts`
- **Effort**: ~15 min

### A4. Hardcoded Colors → Theme Tokens (HIGH)
- **Problem**: 11 hardcoded `#3B82F6` in fitquest.tsx, 6 in profile.tsx, exercises/move use raw `<Text>`
- **Fix**: Replace with `theme.colors.*` tokens
- **Priority files**: `app/fitquest.tsx`, `app/profile.tsx`
- **Effort**: ~30 min

### A5. GlassCard accessibilityRole Fix (LOW)
- **Problem**: `accessibilityRole="summary"` is invalid in React Native
- **Fix**: Remove or change to `accessibilityRole="none"`
- **Files**: `src/components/ui/GlassUI.tsx`
- **Effort**: ~2 min

---

## Phase B: "Friends & Family Ready" (DO NEXT — may need minor setup)

### B1. Crash Reporting (Sentry)
- **Status**: `@sentry/react-native` may need install; DSN placeholder exists
- **Action**: Install package, add DSN to `.env`, wrap app in Sentry.init()
- **Blocked by**: Sentry account creation (free tier available)
- **Effort**: ~30 min once DSN is available

### B2. APK Size Optimization
- **Current**: ~200MB+ (873 exercise image directories bundled as raw assets)
- **Options**:
  1. **WebP conversion** — convert all PNGs to WebP (50-80% size reduction)
  2. **AAB instead of APK** — Google Play serves only the device's density
  3. **On-demand download** — ship app without images, download on first run
- **Recommended**: WebP conversion first (biggest bang, no architecture change)
- **Effort**: WebP script ~30 min, AAB switch ~5 min

### B3. Image Compression Script
- **Action**: Create `scripts/optimize-images.sh` that:
  1. Converts all exercise PNGs → WebP (quality 80)
  2. Resizes to max 512px width (phone screens don't need 1024px images)
  3. Reports before/after sizes
- **Effort**: ~20 min

---

## Phase C: "Play Store Ready" (REQUIRES external services)

### C1. RevenueCat Integration
- **Status**: `react-native-purchases` + `react-native-purchases-ui` already in package.json
- **Blocked by**: RevenueCat API key + product setup in Play Console
- **Action**: Wire `Purchases.configure()` in app init, connect paywall screen
- **Effort**: ~2 hours once keys available

### C2. Analytics Backend
- **Status**: Telemetry functions exist (`logEvent`, `logPerf`) but log to console
- **Options**: PostHog (free tier), Amplitude, or custom Supabase
- **Effort**: ~1 hour for basic event tracking

### C3. CI/CD Pipeline
- **Options**: GitHub Actions + EAS Build (free tier: 30 builds/month)
- **Action**: `.github/workflows/build.yml` with lint, type-check, test, build
- **Effort**: ~2 hours

### C4. Integration Tests for Critical Flows
- **Priority flows**:
  1. Workout generation → completion → XP award → level up
  2. Exercise filter → detail view → add to workout
  3. Onboarding → profile creation → first workout
- **Framework**: Already have vitest.config.ts — extend with integration tests
- **Effort**: ~4 hours for top 3 flows

---

## Implementation Order (Today)

```
A1 (ProgressRing SVG)     ← FIRST — most visible lie
  ↓
A2 (Accessibility)        ← SECOND — Play Store requirement
  ↓
A3 (Image automation)     ← THIRD — prevents future pain
  ↓
A4 (Hardcoded colors)     ← FOURTH — visual consistency
  ↓
A5 (GlassCard a11y role)  ← FIFTH — 2 min fix
  ↓
B2+B3 (APK size)          ← SIXTH — if time permits
  ↓
BUILD                     ← Final APK with all fixes
```

---

## Target Score After Phase A+B

| Area | Before | After |
|------|--------|-------|
| Theme adoption | 5/10 | 8/10 |
| Accessibility | 1/10 | 6/10 |
| ProgressRing | 2/10 | 9/10 |
| Asset automation | 3/10 | 8/10 |
| APK size | 3/10 | 6/10 |
| **Overall** | **6.5/10** | **8/10** |

RevenueCat, Sentry, analytics, and CI/CD remain gated on external service setup but have clear paths.
