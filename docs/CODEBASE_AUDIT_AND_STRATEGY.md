# FitQuest 2.0 — Full Codebase Audit & Improvement Strategy

**Date**: 2026-02-18  
**Scope**: Complete app — frontend, backend, data, security, AI, engines, infrastructure  
**TypeScript Status**: ✅ Clean (0 errors)  
**Test Status**: 116/116 pass, 1 test file fails to load (missing vitest mock)

---

## Part 1: What Exists (Facts)

### Scale
| Layer | Lines of Code | Files |
|-------|--------------|-------|
| Screens (`app/`) | 19,067 | 35 |
| Engines (`src/engines/`) | 11,053 | 11 |
| Services (`src/services/`) | 9,077 | ~20 |
| AI Module (`src/ai/`) | 8,501 | ~15 |
| FitMind (`src/fitmind/`) | 5,985 | ~15 |
| Database (`src/database/`) | 5,041 | 6 |
| Components (`src/components/`) | 4,688 | 23 |
| Security (`src/security/`) | 1,722 | 5 |
| **Total** | **~101,000** | **~160** |

### Architecture
- **Expo SDK 54**, New Architecture enabled, React 19.1, RN 0.81.5
- **Offline-first**: SQLite single source of truth, 35 tables, schema v11, auto-migration chain v0→v11
- **Encryption**: AES-256-GCM (v3) via `@noble/ciphers`, auto-migrates v1/v2 on read
- **Auth**: Biometric + PBKDF2 passcode, 30-min sessions, 5-attempt lockout, 15-attempt emergency wipe
- **AI**: 5 bundled neural models (~81MB JSON), 3-tier cascade (neural→statistical→rule-based)
- **Server**: Optional Express.js, flat JSON file storage, 23 endpoints, not required for core app

### What's Working Well
1. **Workout engine pipeline** — Deterministic 5-step generator with fatigue-aware scoring, progression tracking, deload detection. All three engines (generator, progression, recovery) are production-quality.
2. **Sensor fusion** — 10Hz accelerometer+gyroscope fusion with 3-tier activity classification (CNN-LSTM → RandomForest → threshold). Battery-aware background handling.
3. **Health monitoring stack** — Anomaly detection (Z-score, IQR, rate-of-change, correlation), sleep analysis (quality scoring, stage estimation, debt calculation), background health orchestrator with battery-aware scheduling.
4. **FitMind cognitive module** — Complete document library with import pipeline (XSS sanitization, SHA-256 dedup, magic-byte verification, 50MB limit), FSRS spaced repetition, reading session tracking with focus scoring.
5. **DualAI engine** — 180+ templates with repeat avoidance, neural integration (summarizer, semantic search, knowledge graph), conversation memory, context-aware suggestions, OpenAI fallback.
6. **Security layer** — AES-256-GCM with per-message key derivation, encrypted health/AI storage, biometric auth with constant-time comparison, secure delete (overwrite-then-delete).
7. **Theme system** — Complete dark/light mode with 16+ color tokens, numeric spacing scale, typography variants, motion presets.
8. **CI pipeline** — 13 automated gates: typecheck, i18n, tests, quality, performance, ops readiness, notifications, meal-prep text safety.

### What's Complete (Per Project Tracking)
- ✅ P0 Critical Fixes (6/6)
- ✅ P1 Critical Wiring (6/6)
- ✅ P1.5 Security Hardening (3/3)
- ✅ P2 Feature & Quality Sprint (10/10)
- ✅ P2.5 Phase 4-6 Integration (6/6)
- ✅ AI Bot Enhancement — all 5 phases (FSRS, neural wiring, memory, templates, suggestions)
- ✅ Tech Debt Register — all 12 items closed
- ✅ Security Remediation — all 7 items complete
- ✅ Workspace Repo Sync Phase 6 (Document Reader Overhaul)

---

## Part 2: Gaps & Weaknesses (Ranked by Impact)

### CRITICAL — Must Fix Before Release

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | **`server/.env` has real secrets committed** | `server/.env` — JWT secret + refresh pepper in plaintext | If repo is public, all server auth is compromised |
| C2 | **Android package is `com.anonymous.mobile`** | `app.json`, `android/app/build.gradle` | Will be rejected by Google Play Store |
| C3 | **`@sentry/react-native` in `package.json` but NOT installed** | `node_modules/@sentry` missing | Any code importing Sentry will crash at runtime in production |
| C4 | **`dualAIEngine.test.ts` fails** — missing `expo-file-system/legacy` mock | `tests/dualAIEngine.test.ts` → `src/ai/ModelLoader.ts` | CI test suite has 1 failing file; the only AI module test doesn't run |

### HIGH — Significant Quality/UX Risk

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| H1 | **Zero accessibility** — only 1 component has `accessibilityRole` | Entire `app/` and `src/components/` | App is unusable for screen reader users. May fail App Store accessibility review |
| H2 | **No screen-level error boundaries** — only 1 global boundary | `app/_layout.tsx` | Any screen crash shows generic fallback; user loses all in-progress work (active workout, reading session) |
| H3 | **Only 9/32 screens use `ThemedText`** | `app/` screens | Raw `Text` bypasses typography consistency, line-height normalization, weight adaptation between modes |
| H4 | **30+ hardcoded hex colors remain** | `craft-my-body.tsx`, `create-workout.tsx`, `exercises.tsx`, `fitmind-library.tsx`, `nutrition-calculator.tsx`, `onboarding.tsx`, `login.tsx`, `splash.tsx` | Theme changes won't propagate; dark/light mode may have contrast issues |
| H5 | **`expo-location` used but not in app.json permissions** | `app.json` plugins missing location | Location permission may fail silently or crash on Android 14+ |
| H6 | **Duplicate UI components** — 3 ring implementations, 2 button implementations, 2 card implementations | `StatRing` vs `ProgressRing` vs inline `MetricRing`; `Button` vs `GradientButton`; `Card` vs `GlassCard` | Inconsistent UI, larger bundle, maintenance confusion |
| H7 | **ScrollView used for long lists** — 27 screens use ScrollView vs 6 FlatList | `exercises.tsx`, `saved-workouts.tsx`, `analytics.tsx` | All items render at once — janky on large datasets or low-end devices |

### MEDIUM — Should Fix for Quality

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | **Transformer code duplicated across 4 AI files** | `TransformerFitCoach.ts`, `NeuralSummarizer.ts`, `SemanticSearch.ts`, `NeuralIntentRouter.ts` | Bug fix requires 4 edits; ~2000 lines of identical forward-pass code |
| M2 | **81MB of JSON model files in app bundle** | `assets/models/` | App download size is ~100MB+ before content; cold start parses large JSON |
| M3 | **i18n: non-English languages have partial coverage** | `src/i18n/translations.ts` | Users selecting non-English languages see English fallbacks for many strings |
| M4 | **Server uses flat JSON files** — no database, no concurrency control | `server/src/storage.js` | Single corrupt write loses all users; no transactions |
| M5 | **Exercise seed only has ~50 hand-crafted exercises** — generator creates 722+ programmatically | `src/database/seed.ts`, `exerciseGenerator.ts` | Generated exercises have formulaic names; real exercise library from workspace-repos/exercise-content isn't imported yet |
| M6 | **`getExercisesByMuscle` loads ALL exercises then filters in JS** | `src/database/service.ts` | O(n) for 788 exercises; should be SQL WHERE clause |
| M7 | **No loading skeletons** — screens jump from spinner to content | All screens | Perceived performance suffers |
| M8 | **Dashboard defines own `SPACING` constant** bypassing theme | `app/dashboard.tsx` | Pattern violation; if theme spacing changes, dashboard won't update |

### LOW — Nice to Have

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| L1 | PBKDF2 is simulated SHA-256 chain (not standards-compliant) | `src/security/AESEncryption.ts` | v2 crypto is legacy; new data uses v3 GCM so risk is limited |
| L2 | `ProgressBar` uses `useNativeDriver: false` | `src/components/ProgressBar.tsx` | Width animation can't use native driver; minor jank |
| L3 | `ErrorBoundary` fallback can't use translations (inside ThemeProvider but outside LanguageProvider) | `app/_layout.tsx` | Crash screen is English-only |
| L4 | No haptic feedback on most interactive elements | Only `fitquest.tsx` uses `Vibration` | Tactile feedback is missing app-wide |
| L5 | `Math.random()` for error event IDs in `errorTelemetry.ts` | `src/services/errorTelemetry.ts` | Not security-critical but inconsistent with crypto-random policy |

---

## Part 3: Improvement Strategy

### Tier 0 — Blockers (Fix Immediately)

**Goal**: Remove release-blocking issues. **Effort**: 1-2 hours.

| Task | Action |
|------|--------|
| **C1: Remove committed secrets** | Regenerate `server/.env` secrets. Add `server/.env` to `.gitignore`. If repo was ever public, consider all server JWT tokens compromised and rotate EVERYTHING |
| **C2: Fix Android package name** | Change `com.anonymous.mobile` → `com.hugelet.fitquest` in `app.json` (android.package) and regenerate Android project folder (`npx expo prebuild --clean`) |
| **C3: Fix Sentry dependency** | Either `npx expo install @sentry/react-native` to install properly, OR remove from `package.json` if not needed yet and make `errorTelemetry.ts` work without it (optional dynamic import) |
| **C4: Fix failing test** | Add `expo-file-system/legacy` mock to `vitest.config.ts` |

### Tier 1 — Accessibility & Error Resilience (1-2 weeks)

**Goal**: Make app usable for everyone and resilient to crashes.

| Task | Effort | Impact |
|------|--------|--------|
| Add `accessibilityRole`, `accessibilityLabel` to all interactive components in GlassUI.tsx (GradientButton, GlassCard, AnimatedListItem) | 2 hours | Every screen inherits accessibility |
| Add screen-level error boundaries to critical flows: workout (`fitquest.tsx`), reader (`fitmind-reader.tsx`), health dashboard, coach | 3 hours | Crash in one section won't kill the app |
| Add `accessibilityLabel` to Tab navigator icons in `_layout.tsx` | 30 min | Screen readers can navigate tabs |
| Replace `ScrollView` with `FlatList`/`SectionList` in long-list screens: exercises, saved-workouts, analytics | 4 hours | Virtualization for large datasets |

### Tier 2 — UI Consistency (1 week)

**Goal**: Eliminate legacy patterns; one way to do things.

| Task | Effort | Impact |
|------|--------|--------|
| Migrate all 23 screens from raw `Text` to `ThemedText` | 6 hours | Consistent typography everywhere |
| Replace all hardcoded hex colors with `theme.colors.*` tokens | 3 hours | Theme changes propagate everywhere |
| Remove duplicate components: deprecate `Button.tsx` (use `GradientButton`), `Card.tsx` (use `GlassCard`), `StatRing` (use `ProgressRing` from GlassUI) | 2 hours | Eliminate confusion, reduce bundle |
| Extract inline `MetricRing` and `TrendBar` from health-dashboard into GlassUI | 2 hours | Reusable, testable components |
| Remove dashboard's custom `SPACING` constant; use `theme.spacing[n]` | 30 min | Pattern consistency |
| Add loading skeletons for data-heavy screens (dashboard, analytics, exercises) | 4 hours | Better perceived performance |

### Tier 3 — DX & Testing (1-2 weeks)

**Goal**: Reliable test coverage and developer confidence.

| Task | Effort | Impact |
|------|--------|--------|
| Extract shared `TransformerRuntime.ts` from 4 duplicated AI files | 4 hours | Single source for forward-pass code; bug fix in 1 place |
| Fix `dualAIEngine.test.ts` mock and add integration tests for DualAI query flow | 4 hours | AI module gets test coverage |
| Add vitest mocks for remaining native modules (`expo-file-system/legacy`, etc.) | 2 hours | Test suite runs clean |
| Add engine unit tests: workoutGenerator, recoveryEngine (currently 0 tests) | 8 hours | Core domain logic gets safety net |
| Add screen component tests with `@testing-library/react-native` for 3-4 key screens | 8 hours | UI regression detection |
| Consider binary model format (MessagePack/FlatBuffers) to replace JSON models | Research task | Faster model loading, smaller bundle |

### Tier 4 — Workspace Sync Priorities (3-6 weeks)

These are already planned in `docs/WORKSPACE_REPO_SYNC_PLAN.md`:

| Phase | Priority | Status | Notes |
|-------|----------|--------|-------|
| 1. Exercise DB Enhancement (870+ exercises) | HIGH | ⏳ | Schema v10 ready for `force_type`, `mechanic`, `exercise_images` |
| 2. Workout Generator Restructure | HIGH | ⏳ | Modular selectors, volume landmarks, A/B testing |
| 3. Native Health Integration (HealthKit/HealthConnect) | MEDIUM | ⏳ | Packages installed; need adapters + permission UI |
| 4. Analytics Visualization (Victory Native) | MEDIUM | ⏳ | Feature-flagged; replace basic views with charts |
| 5. Enhanced Move Module (GPS, pace, elevation) | MEDIUM | ⏳ | Haversine distance, stride estimation |

### Tier 5 — Server & Deployment (When Ready for Multi-Device)

| Task | Effort | Impact |
|------|--------|--------|
| Replace JSON file storage with SQLite or PostgreSQL | 4 hours | Concurrency safety, transactions |
| Add rate limiting to auth endpoints (express-rate-limit) | 1 hour | Brute force protection |
| Add TLS configuration guide / reverse proxy setup | 2 hours | Data in transit security |
| Declare `expo-location` in `app.json` plugins | 10 min | Android 14+ permission compliance |
| Set up Sentry DSN in `.env` and verify crash reporting E2E | 2 hours | Production observability |
| Physical device verification: notifications, OAuth, HealthKit | Manual testing | Release gate |

---

## Part 4: Recommended Execution Order

```
Week 1:  Tier 0 (blockers)  →  Tier 1 (accessibility + error boundaries)
Week 2:  Tier 2 (UI consistency — ThemedText migration, color cleanup)
Week 3:  Tier 3 (testing infrastructure, TransformerRuntime extraction)
Week 4+: Tier 4 (exercise DB import, health integration)
Future:  Tier 5 (server hardening, deployment)
```

### Guiding Principles
1. **Don't add features before fixing foundations** — accessibility, consistency, and resilience come first
2. **One way to do things** — eliminate duplicate components and patterns
3. **Test the core** — workout/progression/recovery engines are the product's value; they need test coverage
4. **Bundle size awareness** — 81MB of JSON models is significant; track app size

---

## Part 5: Current Project Status Summary

### What's Done
- AI Bot Enhancement: **5/5 phases complete** ✅
- Sprint P0-P2.5: **All complete** ✅  
- Security Remediation: **7/7 items** ✅
- Tech Debt Register: **12/12 items** ✅

### What's In Progress
- P3 Release Gate: **1/6 items** (SensorFusion wired, rest need physical device)
- Workspace Repo Sync: **1/6 phases** (Phase 6 complete)

### What's Next (Per This Strategy)
- Tier 0 blockers → Tier 1 accessibility → Tier 2 UI consistency
