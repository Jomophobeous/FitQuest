# FitQuest 2.0 — Official Testing & Verification Plan

**Created:** Session P0.H3-H4 Hardening Phase  
**Status:** Living Document — Update as features are verified  
**Purpose:** Track deferred testing, on-device verification, and feature completeness  

---

## 1. Automated Test Suite

| Metric | Value | Notes |
|--------|-------|-------|
| **Framework** | Vitest | `vitest.config.ts` in root |
| **Total Tests** | 157 | All passing |
| **Test Files** | 14 | Located in `tests/` |
| **Run Command** | `npx vitest run` | ~9s runtime |
| **TypeScript** | 0 errors | Clean compilation |

### Test Coverage Gaps (Future Work)
- [ ] No integration tests for SQLite schema migrations
- [ ] No component rendering tests (React Native Testing Library)
- [ ] No E2E tests (Detox or Maestro)
- [ ] No snapshot tests for GlassUI components
- [ ] No encryption round-trip tests for v1→v2→v3 migration
- [ ] No FitMind spaced repetition algorithm verification tests

---

## 2. On-Device Feature Verification Checklist

> **Instructions:** Test each feature on a physical Android device (API 26+).  
> Mark ✅ when verified working, ❌ when broken, ⚠️ when partially working.

### 2.1 Core Navigation & Auth

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 1 | App launches without crash | `splash.tsx` | ⬜ | |
| 2 | Splash → Onboarding (fresh install) | `index.tsx` → `onboarding.tsx` | ⬜ | |
| 3 | Splash → Dashboard (returning user) | `index.tsx` → `dashboard.tsx` | ⬜ | |
| 4 | Biometric auth prompt | `login.tsx` | ⬜ | Requires device with fingerprint/face |
| 5 | Passcode fallback auth | `login.tsx` | ⬜ | |
| 6 | Tab navigation (all 5 tabs) | `_layout.tsx` | ⬜ | Dashboard, FitQuest, Move, Library, Profile |
| 7 | Back navigation from hidden screens | Various | ⬜ | |

### 2.2 Onboarding Flow

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 8 | Goal selection | `onboarding.tsx` | ⬜ | body_control/posture/speed/mobility/focus/strength |
| 9 | Experience level selection | `onboarding.tsx` | ⬜ | beginner/intermediate/advanced |
| 10 | Training schedule setup | `onboarding.tsx` | ⬜ | days/week, mins/session |
| 11 | Profile saves to SQLite | `onboarding.tsx` | ⬜ | Verify via profile screen |
| 12 | Redirect to dashboard after complete | `onboarding.tsx` | ⬜ | |

### 2.3 Dashboard

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 13 | XP & level display | `dashboard.tsx` | ⬜ | Should show current XP, level, rank |
| 14 | Streak counter | `dashboard.tsx` | ⬜ | Current + longest streak |
| 15 | Recent workouts list | `dashboard.tsx` | ⬜ | Last 5 sessions |
| 16 | Quick action buttons | `dashboard.tsx` | ⬜ | Navigate to workout, exercises, etc. |
| 17 | Pull-to-refresh | `dashboard.tsx` | ⬜ | Refreshes all stats |
| 18 | Strength stats cards | `dashboard.tsx` | ⬜ | Category-based progress |

### 2.4 Workout Generation & Execution

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 19 | Generate AI workout | `fitquest.tsx` | ⬜ | Based on profile goals/equipment/fatigue |
| 20 | View generated exercises | `fitquest.tsx` | ⬜ | Exercise cards with details |
| 21 | Start workout session | `workout.tsx` | ⬜ | Transitions to active mode |
| 22 | Exercise-by-exercise flow | `workout.tsx` | ⬜ | Next/prev navigation |
| 23 | Rep counting display | `workout.tsx` | ⬜ | Prescribed vs completed |
| 24 | Rest timer between exercises | `workout.tsx` | ⬜ | Countdown timer |
| 25 | Skip exercise | `workout.tsx` | ⬜ | Marks as skipped, moves forward |
| 26 | Complete workout → XP award | `workout.tsx` | ⬜ | Shows XP gained, level-up if applicable |
| 27 | Workout persists to DB | `workout.tsx` | ⬜ | Appears in recent sessions |
| 28 | Fatigue map updates | `workout.tsx` | ⬜ | Muscles trained get fatigue increase |
| 29 | Streak updates | `workout.tsx` | ⬜ | Streak +1 if first workout today |

### 2.5 Exercise Library

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 30 | Exercise list loads (~1300) | `exercises.tsx` | ⬜ | Rendered via FlatList |
| 31 | Category filter | `exercises.tsx` | ⬜ | 6 categories |
| 32 | Difficulty filter | `exercises.tsx` | ⬜ | beginner/intermediate/advanced |
| 33 | Search by name | `exercises.tsx` | ⬜ | Text input search |
| 34 | Exercise detail modal | `exercises.tsx` | ⬜ | Instructions, muscles, equipment |
| 35 | Category gradient colors | `exercises.tsx` | ⬜ | Theme-centralized colors |

### 2.6 Move Module (Steps & Jogging)

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 36 | Step counter display | `move.tsx` | ⬜ | Daily steps from pedometer |
| 37 | Active minutes tracking | `move.tsx` | ⬜ | |
| 38 | Start/stop jog session | `move.tsx` | ⬜ | Distance, pace, calories |
| 39 | Jog route data saved | `move.tsx` | ⬜ | JSON in jog_sessions table |
| 40 | Step XP awards (4 XP / 1000 steps) | `move.tsx` | ⬜ | |

### 2.7 FitMind (Cognitive Fitness)

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 41 | Document library loads | `fitmind-library.tsx` | ⬜ | |
| 42 | Add document (text/file) | `fitmind-library.tsx` | ⬜ | Import pipeline |
| 43 | Open document reader | `fitmind-reader.tsx` | ⬜ | Paginated view |
| 44 | Create annotation | `fitmind-reader.tsx` | ⬜ | Highlight, note, bookmark |
| 45 | Flashcard creation | `fitmind-reader.tsx` | ⬜ | From highlighted text |
| 46 | Flashcard review (spaced repetition) | `fitmind-library.tsx` | ⬜ | FSRS algorithm |
| 47 | Reading session tracking | `fitmind-reader.tsx` | ⬜ | Duration, pages, WPM |
| 48 | Reading streak | `fitmind-library.tsx` | ⬜ | Daily streak counter |
| 49 | AI Coach chat | `coach/index.tsx` | ⬜ | Template-based responses |
| 50 | AI Professor chat | `professor/index.tsx` | ⬜ | Socratic dialogue |

### 2.8 Profile & Settings

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 51 | Profile info display | `profile.tsx` | ⬜ | Name, goal, experience |
| 52 | Edit profile fields | `profile.tsx` | ⬜ | Save to user_profile table |
| 53 | Theme toggle (dark/light/blackGold) | `profile.tsx` | ⬜ | Persists across sessions |
| 54 | Language selector (15 languages) | `profile.tsx` | ⬜ | All strings translated |
| 55 | Equipment selection | `profile.tsx` | ⬜ | Saves to user_equipment |
| 56 | Injury tracking | `profile.tsx` | ⬜ | Saves to user_injuries |
| 57 | Profile photo (camera/gallery) | `profile.tsx` | ⬜ | ImagePicker + FileSystem |

### 2.9 Health Dashboard

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 58 | Composite health score ring | `health-dashboard.tsx` | ⬜ | 0-100 score |
| 59 | Daily metric rings (steps, active min, calories) | `health-dashboard.tsx` | ⬜ | |
| 60 | Anomaly alerts display | `health-dashboard.tsx` | ⬜ | From anomaly_log |
| 61 | Dismiss/acknowledge alert | `health-dashboard.tsx` | ⬜ | |
| 62 | 7-day trend bars | `health-dashboard.tsx` | ⬜ | Steps + sleep |
| 63 | Heart rate manual entry | `health-dashboard.tsx` | ⬜ | Saves encrypted |

### 2.10 Nutrition & Body

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 64 | Nutrition calculator loads | `nutrition-calculator.tsx` | ⬜ | Food search via local DB |
| 65 | Meal prep suggestions | `meal-prep.tsx` | ⬜ | Location-aware filtering |
| 66 | Craft My Body wizard | `craft-my-body.tsx` | ⬜ | Generates BodyCraftAlgorithm |
| 67 | Training split output | `craft-my-body.tsx` | ⬜ | Macros, schedule, cardio plan |

### 2.11 Analytics & Progress

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 68 | Analytics charts load | `analytics.tsx` | ⬜ | Real SQLite data |
| 69 | Progress photos | `progress.tsx` | ⬜ | Before/after comparison |
| 70 | Workout history | `analytics.tsx` | ⬜ | Session count, XP trend |

### 2.12 Security & Encryption

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 71 | Health data encrypts (AES-256-GCM) | Runtime | ⬜ | Check encrypted_health_data table |
| 72 | AI conversations encrypt | Runtime | ⬜ | Check encrypted_ai_conversations |
| 73 | v1→v2→v3 auto-migration on read | Runtime | ⬜ | Legacy data upgrades seamlessly |
| 74 | Biometric session expires (30 min) | Runtime | ⬜ | Re-auth required after timeout |
| 75 | 5-attempt lockout with backoff | Runtime | ⬜ | Exponential delay |
| 76 | Emergency wipe (15 failures) | Runtime | ⬜ | ⚠️ Test carefully |

### 2.13 Legal & Compliance

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 77 | Terms of Service renders | `terms-of-service.tsx` | ⬜ | |
| 78 | Privacy Policy renders | `privacy-policy.tsx` | ⬜ | |
| 79 | Legal Center consent tracking | `legal-center.tsx` | ⬜ | |
| 80 | Policy acceptance persists | Runtime | ⬜ | Via legalService |

### 2.14 Enterprise/Admin Screens

| # | Feature | Screen | Status | Notes |
|---|---------|--------|--------|-------|
| 81 | Backups screen loads | `backups.tsx` | ⬜ | Export/import encrypted |
| 82 | Enterprise hardening dashboard | `enterprise-hardening.tsx` | ⬜ | Security metrics |
| 83 | Autonomous center loads | `autonomous-center.tsx` | ⬜ | Automation policies |
| 84 | Federation hub loads | `federation-hub.tsx` | ⬜ | Integration registry |
| 85 | Platform studio loads | `platform-studio.tsx` | ⬜ | Template builder |
| 86 | Style guide renders all components | `style-guide.tsx` | ⬜ | Design system preview |

---

## 3. Error Boundary Coverage

| Screen | Protected | Added In |
|--------|-----------|----------|
| `dashboard.tsx` | ✅ | P0.H3 |
| `fitquest.tsx` | ✅ | Prior |
| `exercises.tsx` | ✅ | P0.H3 |
| `workout.tsx` | ✅ | P0.H3 |
| `profile.tsx` | ✅ | P0.H3 |
| `coach/index.tsx` | ✅ | Prior |
| `professor/index.tsx` | ✅ | Prior |
| `health-dashboard.tsx` | ✅ | Prior |
| `fitmind-reader.tsx` | ✅ | Prior |
| `move.tsx` | ❌ | — |
| `fitmind-library.tsx` | ❌ | — |
| `onboarding.tsx` | ❌ | — |
| Other hidden screens | ❌ | — |

Root-level `ErrorBoundary` in `app/_layout.tsx` catches any unhandled errors for unprotected screens.

---

## 4. Database Integrity Checks

| Check | Status | Notes |
|-------|--------|-------|
| Schema v16 migrates cleanly | ⬜ | Fresh install + upgrade paths |
| All 21+ indexes created | ✅ | Verified in audit |
| Exercise seed (~1300) completes | ⬜ | On-device verification needed |
| Category values valid (v14 rename) | ✅ | body_control/posture/speed/mobility/focus/strength |
| No `last_read_at` references | ✅ | Audited — all use `updated_at` |
| Parameterized queries only | ✅ | No SQL injection vectors |
| Encrypted tables use Unix epoch | ✅ | INTEGER timestamps verified |
| Core tables use ISO 8601 text | ✅ | `datetime('now')` format |

---

## 5. Security Audit Summary

| Area | Status | Notes |
|------|--------|-------|
| AES-256-GCM v3 encryption | ✅ | Active for all new data |
| Auto-migration v1→v2→v3 | ✅ | On read via EncryptedDatabase |
| Biometric + PBKDF2 auth | ✅ | 1000 iterations, constant-time compare |
| SecureStore for keys/tokens | ✅ | No AsyncStorage usage |
| No plaintext health data | ✅ | All via encryptedDB methods |
| No `Math.random()` for security | ✅ | Uses expo-random |
| No console.log of secrets | ✅ | Verified in audit |

---

## 6. Performance Baseline (Deferred)

| Metric | Target | Actual | Notes |
|--------|--------|--------|-------|
| Cold start time | < 3s | ⬜ | Measure on physical device |
| Exercise list scroll (1300 items) | 60 FPS | ⬜ | FlatList performance |
| Workout generation time | < 500ms | ⬜ | Profile-dependent |
| DB query under load | < 100ms | ⬜ | Complex joins with filters |
| Memory usage (idle) | < 150MB | ⬜ | Monitor with Android Profiler |
| Bundle size (APK) | < 50MB | ⬜ | After ProGuard/Hermes |

---

## 7. Known Deferred Items

| Item | Reason | Priority |
|------|--------|----------|
| APK build & device install | Build deferred to Android Studio | P0 |
| RevenueCat payment integration | No external server yet (except payments) | P1 |
| Health Connect / HealthKit wiring | Native SDK integration | P1 |
| OTA updates (expo-updates) | Needs hosting decision | P2 |
| Wearable device integration | Hardware dependency | P2 |
| Push notifications | Needs notification service | P2 |
| App Store submission | Needs APK + screenshots + metadata | P1 |

---

## 8. Regression Testing Protocol

After any code change, run:

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Full test suite
npx vitest run

# 3. Lint check
npx eslint . --ext .ts,.tsx

# 4. Metro bundler (catches import errors)
npx expo start --no-dev --minify
```

All 4 must pass before considering a change verified.

---

## 9. Device Testing Matrix (Future)

| Device | Android API | Screen Size | Status |
|--------|-------------|-------------|--------|
| Budget phone | API 26 (8.0) | 5.5" 720p | ⬜ |
| Mid-range | API 30 (11) | 6.1" 1080p | ⬜ |
| Flagship | API 34 (14) | 6.7" 1440p | ⬜ |
| Tablet | API 33 (13) | 10.1" | ⬜ |
| Foldable | API 34 (14) | Variable | ⬜ |

---

*This document is the single source of truth for testing status. Update it as features are verified on-device.*
