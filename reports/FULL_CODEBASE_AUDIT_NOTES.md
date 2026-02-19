# FitQuest 2.0 — Full Codebase Audit Notes
**Date**: 18 February 2026  
**Scope**: Every screen, engine, service, database file, security module, and dependency  
**TypeScript Status**: Compiles clean (`npx tsc --noEmit --skipLibCheck` → 0 errors)

---

## Table of Contents
1. [Frontend Architecture](#1-frontend-architecture)
2. [Backend / Server Layer](#2-backend--server-layer)
3. [Engines](#3-engines)
4. [Services](#4-services)
5. [Database Layer](#5-database-layer)
6. [Security Layer](#6-security-layer)
7. [FitMind Module](#7-fitmind-module)
8. [Performance Audit](#8-performance-audit)
9. [All Bugs by Severity](#9-all-bugs-by-severity)
10. [Implementation Strategy](#10-implementation-strategy)

---

## 1. Frontend Architecture

### 1.1 Root Layout (`app/_layout.tsx` — 389 lines)

**Provider hierarchy** (lines 371-387):
```
ThemeProvider → ErrorBoundary → LanguageProvider → DatabaseProvider
  → SubscriptionProvider → ApolloProvider → ThemedTabs
```

**Navigation**: 5 visible tabs (dashboard, fitquest, move, fitmind-library, profile) + ~25 hidden routes registered with `href: null`.

**BUGS**:
- **P0 — AuthProvider NOT in the hierarchy.** `AuthContext.tsx` exports an `AuthProvider` but it is never mounted. Every screen calling `useAuth()` gets the default stub context where `signIn` is a no-op, `isSignedIn` is always `false`, biometric functions always return `{ success: false }`.
- **P0 — Dual auth systems.** `splash.tsx` uses Zustand `useAuthStore` + `SecureStore.getItemAsync('jwt')`. Login/register use React Context `useAuth()`. These are completely disconnected — splash sets the Zustand token but nothing reads it for routing.
- **P0 — `index.tsx` unconditional redirect.** `<Redirect href="/dashboard" />` runs without any auth check. Splash/login are never reached on cold start.
- Tab bar uses `position: 'absolute'` — every screen must add manual bottom padding (fragile).
- 8 async operations fire simultaneously on mount (startup contention — see Performance section).
- 33 hidden `Tabs.Screen` entries — could be simplified with Stack navigator inside tabs.
- Admin screens (style-guide, platform-studio, autonomous-center, federation-hub, enterprise-hardening) registered in production — should be gated.

### 1.2 Screen Inventory (30+ screens)

| Screen | File | Lines | Key Issues |
|--------|------|-------|------------|
| Dashboard | `app/dashboard.tsx` | 745 | Local `SPACING` object shadows theme; hardcoded `rgba(255,255,255,0.95)` |
| FitQuest | `app/fitquest.tsx` | 934 | ✅ Fixed: user ID + showAllInstructions. Remaining: workoutRating never persisted |
| Move | `app/move.tsx` | 802 | ✅ Fixed: calorie unit mismatch + double XP |
| Exercises | `app/exercises.tsx` | 391 | No seed status check; hardcoded DIFFICULTY_COLORS; stale useEffect deps |
| Profile | `app/profile.tsx` | **1547** | ✅ Fixed: div/zero + goalInfo null. Still: fake calorie calc, 16+ imports, no decomposition |
| Workout | `app/workout.tsx` | 576 | No i18n, raw Text, unused useTimer(), hardcoded rating=4 |
| Coach | `app/coach/index.tsx` | 1060 | ✅ Fixed: null coachCtx. Still: all responses hardcoded English |
| Health Dashboard | `app/health-dashboard.tsx` | 914 | ✅ Fixed: scoreColor + null safety. Still: stale `t` closure, hardcoded goals |
| FitMind Library | `app/fitmind-library.tsx` | 532 | ✅ Fixed: double-submit. Still: hardcoded STATUS_COLORS, non-singleton pipeline |
| FitMind Reader | `app/fitmind-reader.tsx` | 1230 | ✅ Fixed: null file_path. Still: hardcoded English, borderTopColor white |
| Onboarding | `app/onboarding.tsx` | 622 | ✅ Fixed: enum mismatch with schema CHECK constraints |
| Login | `app/login.tsx` | 850 | ✅ Fixed: passcode stale closure |
| Register | `app/register.tsx` | 387 | Skips onboarding → no user_profile; server-based signUp in offline app |
| Splash | `app/splash.tsx` | 272 | JWT token accepted without validation; all colors hardcoded |
| Craft My Body | `app/craft-my-body.tsx` | 686 | ✅ Fixed: wrong user ID. Still: no i18n, hardcoded ACCENT_PURPLE |
| Create Workout | `app/create-workout.tsx` | 774 | No i18n |
| Saved Workouts | `app/saved-workouts.tsx` | 875 | No i18n, ScrollView+.map() (no virtualization) |
| Progress | `app/progress.tsx` | 509 | No i18n, bare `<Image>` without caching |
| Analytics | `app/analytics.tsx` | 668 | No i18n, variable `t` shadows translation function |
| Nutrition Calc | `app/nutrition-calculator.tsx` | 772 | Well-optimized FlatList |
| Meal Prep | `app/meal-prep.tsx` | 537 | Clean |
| Paywall | `app/paywall.tsx` | 482 | ✅ Fixed: empty useEffect for subscribed users |
| Workouts List | `app/workouts/index.tsx` | 139 | ✅ Fully rewritten: was legacy lightColors + mock data |
| Workout Detail | `app/workouts/[id].tsx` | ~80 | `prescribed_reps` typed as number but schema is TEXT |
| Backups | `app/backups.tsx` | 506 | No i18n, server-side mutation queue call |
| Legal Center | `app/legal-center.tsx` | — | Clean |
| Privacy Policy | `app/privacy-policy.tsx` | — | Clean |
| Terms | `app/terms-of-service.tsx` | — | Clean |

**Dead files**: `analytics.tsx.bak`, `login.tsx.bak`, `onboarding.tsx.bak`, `register.tsx.bak`, `splash.tsx.bak`, `workout.tsx.bak`

### 1.3 Component Library

| Component File | Status | Issues |
|---------------|--------|--------|
| `src/components/ui/GlassUI.tsx` | **Active** (10 components) | AnimatedCounter doesn't animate (snaps); ProgressRing jumpy at 25% thresholds; GradientButton text color unconventional in light mode; unused LinearGradient import |
| `src/components/ui/FitnessComponents.tsx` | **BROKEN** | Imports `lightColors` from legacy theme — dark mode completely broken |
| `src/components/ui/UIComponents.tsx` | **BROKEN** | Same — imports `lightColors`, dark mode broken. Also duplicates `SectionHeader` from GlassUI |
| `src/components/ThemedText.tsx` | Active | `variantSizes`, `colorMap`, `variantWeights` recreated every render — no `useMemo` |
| `src/components/ProgressBar.tsx` | Active | Uses RN `Animated` with `useNativeDriver: false` — JS-thread animation |
| `src/components/StatRing.tsx` | Active | Same — RN `Animated` on JS thread |
| Others (Button, Card, DropdownMenu, ErrorBoundary, etc.) | Active | No major issues |

### 1.4 Theme System

**THREE conflicting files**:

| File | Primary Color | Background | Spacing | Status |
|------|--------------|------------|---------|--------|
| `src/design/theme-system.ts` | `#10B981` green | `#0A0E17` / `#F4F5F7` | Numeric: `[1]=4, [2]=8...` | **Canonical** |
| `src/design/tokens.ts` | `#4F46E5` indigo | `#F6F7FB` | Named: `xs=4, sm=8, md=16` | **Wrong — delete** |
| `src/theme/theme.ts` | `#10B981` green | `#FAFAFA` | N/A | **Legacy Paper — migrate consumers** |

**Spacing**: Numeric keys `{px:1, 0:0, 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 10:40, 12:48}`. No keys 7, 9, 11.  
**Border radius**: Named keys `{none:0, sm:4, md:8, lg:12, xl:16, full:9999}`.

### 1.5 Context Providers — ALL Have Same Anti-Pattern

All 4 contexts create **new value objects every render**, causing cascade re-renders:
- `ThemeContext.tsx` — value `{ mode, theme, toggleTheme, setMode }` not memoized
- `LanguageContext.tsx` — value not memoized  
- `DatabaseContext.tsx` — value not memoized; `userProfile` changes trigger all consumers
- `AuthContext.tsx` — value has **20+ properties**; never mounted anyway

**Fix**: Wrap each in `useMemo(() => ({...}), [deps])`.

### 1.6 i18n System

- 2091 lines in `src/i18n/translations.ts`, 15 languages
- No interpolation (`t('greeting', { name })` not supported)
- No pluralization
- All 15 language bundles loaded at import time (could lazy-load)
- 8 screens completely bypass `t()` with hardcoded English

---

## 2. Backend / Server Layer

### 2.1 Server (`server/`)

A **fully functional Express.js backend** despite copilot-instructions claiming "no backend":
- Auth: email+password (bcrypt), Google/Apple OAuth, JWT access tokens (15 min), refresh token rotation (30 days)
- Encrypted backups: CRUD for opaque blobs, auto-prune
- Sync: state metadata with version/conflict detection
- Analytics: bucketed workout analytics, consent-gated
- GDPR: consent, full data export, cascade wipe
- Storage: flat JSON files (`JsonStorage`) — no database

### 2.2 Apollo Client — Dead Weight

| File | Status |
|------|--------|
| `src/services/apollo-client.ts` | Creates client with **no HTTP link** — queries hang/error |
| `src/services/mock-apollo-client.ts` | 300ms artificial delay, mock data |
| `src/services/exercise-queries.ts` | GraphQL queries — **never imported anywhere** |
| `src/services/offline-cache.ts` | Calls `require('./apollo-client').GET_EXERCISES` — **doesn't exist**, crashes at runtime |
| `app/_layout.tsx` | Wraps entire app in `ApolloProvider` — zero screens use `useQuery`/`useMutation` |

**Action**: Remove `@apollo/client`, `graphql` from deps. Delete all 4 files. Remove `ApolloProvider` wrapper.

### 2.3 Network-Calling Services

| Service | Network? | Offline Guard? |
|---------|----------|---------------|
| `authApi.ts` | `fetch()` to `/auth/*`, `/users/*`, `/backups/*` | **No** — throws if `API_BASE_URL` missing |
| `cloudBackupService.ts` | `fetchWithAuth()` to `/backups` | Yes — `isCloudBackupConfigured()` gate |
| `syncService.ts` | `fetchWithAuth()` to `/sync/*` | Yes — `isSyncConfigured()` gate |
| `analyticsIngestionService.ts` | `fetchWithAuth()` to `/analytics/events` | Yes — `isConfigured()` gate |
| `legalService.ts` | `recordConsentTimestamp()` via authApi | Falls back to local |

### 2.4 Zustand Store — Dead Code

`store/useAuthStore.ts` — 13 lines, holds only `{ token, setToken }`. Not connected to `AuthContext`. Splash reads it but nothing writes to it via login flow. **Delete**.

---

## 3. Engines

### 3.1 workoutGenerator.ts (602 lines)
- **N+1 query**: `getProgressHistory(userId, exercise.id, 6)` called inside loop for every candidate (50 sequential DB queries). Should batch.
- Pattern coverage may consume all `targetCount` slots when targetCount=4, leaving no room for highest-scoring exercises.
- `SCORE_WEIGHTS` correctly normalized to sum 1.0.

### 3.2 progressionEngine.ts (330 lines)
- **BUG**: `difficulty_rating === undefined` → `undefined <= 7` is `false` → counts as failure. Every unrated exercise regresses.
- Trend calculation with exactly 3 records compares same 3 records to themselves → always `'stagnant'`.
- `successesToProgress` with max aggressiveness (2.0) → only 1 success needed → overly aggressive.
- On regression, `newMax - 2` could produce negative reps.

### 3.3 recoveryEngine.ts (437 lines)
- **Race condition**: `accumulateFatigue` reads+writes per muscle serially — concurrent calls for shared muscles lose updates.
- **BUG**: `endDeload()` resets ALL muscles to fatigue=30, even those at 0-10 → counterproductive.
- `checkDeloadStatus`: `weeksUntilScheduled = 4 - (weekNumber % 4)` when `weekNumber % 4 === 0` gives 4, not 0. Only the `===` check works.
- 16 sequential queries for 8 muscles in `accumulateFatigue`. Should batch.

### 3.4 SensorFusionEngine.ts (681 lines)
- **BUG**: Gyroscope X/Y discarded — only magnitude stored in Z axis, feeding incorrect data to ML classifier.
- Calorie calculation uses last activity's MET for entire session — should accumulate per-segment.
- Step detection threshold (1.2g) may under-count slow walking.
- `Array.shift()` on accelBuffer is O(n) at 10Hz — use circular buffer.
- `rawSensorBuffer` slicing at 200 creates GC pressure every 20 seconds.

### 3.5 HealthMonitor.ts (433 lines)
- **BUG**: Goal-reached alerts created every 5 minutes without deduplication.
- `handleSensorUpdate` replaces `todayCalories` with session calories using `Math.max` — resets on sensor restart.
- Division by zero if goals set to 0.
- `avgIntensity` hardcoded to 0, never computed.
- No midnight reset for daily metrics.

### 3.6 RealisticHealthEngine.ts (587 lines)
- `estimateBodyFatNavy`: `log10(waist - neck)` → NaN if waist ≤ neck. No input validation.
- Female body fat uses `||` instead of `??` for hip fallback — fails for `hip = 0`.
- `sleepQuality = 0` makes recovery score 0 (disproportionately harsh).
- Brzycki formula at reps=36 gives 36× weight — unreliable beyond ~10 reps.
- All methods are static and pure — good for testing.

### 3.7 AnomalyDetector.ts (617 lines)
- **BUG**: 4 detection methods run on same data, each creating alerts → **4 duplicate alerts** per anomaly.
- Z-score with exactly `minDataPoints` entries: stdDev=0, z-score=0, detection never fires.
- `prev.value === 0` guard skips valid anomaly detection for 0→spike transitions.
- Sorting happens twice for same data. Multi-metric correlation is well implemented.

### 3.8 SleepAnalysisEngine.ts (711 lines)
- **BUG**: Sleep debt counts missing days as 0-sleep → massively inflated debt. Should only count days with data.
- Default awakenings formula estimates 4 for 8h sleep — biased high.
- `getRecentSessions` parameter name misleading (returns N entries, not entries from N days).

### 3.9 BackgroundHealthEngine.ts (886 lines)
- **BUG**: Health score catch blocks use `/100` instead of `*1` for defaults → score always 12+ points too low when recovery/sleep data unavailable.
- `recoveryScore: 0` hardcoded in `getSnapshot()` — dead field.
- Decrypts 800 AES-GCM blobs on startup via 4 parallel calls with limit=200.
- `estimateActiveCalories` uses `0.04 cal/step` hardcoded for 70kg — should use actual user weight.
- No midnight date change detection.

### 3.10 IntentRouter.ts (795 lines)
- Neural model always 1 query behind (async prediction returns null on first call).
- `includes` matches partial words ("understand" matches "rest" and "stand").
- Context boost of `count * 0.3` can override clear keyword-based intent.
- Confidence normalization gives 100% for single weak match.

### 3.11 engines/index.ts (185 lines)
- `completeSession` passes `performances.filter(p => p.success).length` as `completedCount` — should be total attempted, not just successes.
- No error handling if `accumulateFatigue` fails mid-loop — partial fatigue updates.

---

## 4. Services

### 4.1 xpService.ts (145 lines)
- Race condition in `awardStepXP` from concurrent sensor callbacks — double XP possible.
- No validation on negative XP — `addXP(-100)` could cause infinite loop in `calculateLevel`.
- No daily XP cap.

### 4.2 audioService.ts (396 lines)
- `speak()` silently swallows errors.
- `processQueue` uses recursion — 100-item queue = 100 levels deep. Should iterate.
- `pause()` discards entire speech queue — should preserve.
- TTS hardcoded to `'en-US'` but app supports 15 languages.

### 4.3 timerService.ts (398 lines)
- `start()` and `resume()` have copy-pasted interval logic — will desync if one is updated.
- `start()` while paused resets elapsed to 0 silently.
- `stop()` doesn't emit any event — listeners unaware.

### 4.4 foodDatabase.ts (7,769 lines)
- **MASSIVE**: Static array of food items loaded at startup regardless of whether user accesses nutrition.
- Many items miscategorized (Weet-Bix as "fat").
- `calories_per_serving` undefined for most items.
- Missing: carbs_g, fat_g, fiber_g fields.
- **Action**: Migrate to SQLite with FTS.

### 4.5 telemetry.ts (75 lines)
- Full JSON parse+stringify on every log call (hot path contention).
- `sequence` counter resets on restart — ID collisions possible.
- MAX_ENTRIES=50 — insufficient for crash investigation.

### 4.6 crashReporting.ts (57 lines)
- Dynamic `require('sentry-expo')` x3 — should cache.
- Uses breadcrumbs instead of Sentry transactions for perf metrics.
- Missing: `Sentry.setUser()`, release/dist tagging.

### 4.7 cachePolicy.ts (23 lines)
- Defines TTL policies but **no actual cache implementation exists**. Dead code.

### 4.8 mutationQueueService.ts (137 lines)
- `saveQueue` drops **oldest** entries via `slice(-MAX)`, but flush processes from front → most urgent items dropped.
- No lock — concurrent flush can process same job twice.
- O(n²) for n pending jobs due to `findIndex` lookups.

### 4.9 p1ReplayRunner.ts (46 lines)
- Legal consent sync permanently dropped after 5 offline attempts.
- No priority ordering between consent and backups.

### 4.10 notificationReliabilityService.ts (283 lines)
- `trigger: { hour, minute, repeats: true } as any` — Expo Notifications v18+ changed API. May silently fail.
- `existingId` from `app_state` could be `"undefined"` string → cancel fails, duplicate notifications.

---

## 5. Database Layer

### 5.1 schema.ts
- **BUG**: Migration version checks use `===` not `<`. Users jumping v7→v11 miss v8-v10 ALTER TABLE columns (`force_type`, `mechanic`, `external_id`).
- FSRS migration not wrapped in transaction — partial failure leaves inconsistent state.
- `PRAGMA foreign_keys = ON` never explicitly enabled (SQLite default is OFF).
- Missing index on `fitmind_flashcards.due` (FSRS queries).
- Missing composite index on `session_exercises(session_id, exercise_id)`.

### 5.2 service.ts
- **BUG**: `getExercisesByMuscle()` queries `exercise_muscles` for matching IDs, then calls `getExercises({ categories: undefined })` which returns ALL exercises — filtered IDs never used.
- `getExerciseById()` fires 4 sequential queries — should be 1 JOIN.
- `setUserEquipment()` delete+insert loop not in transaction — crash = data loss.
- `getExercises()` loads ALL exercises with 3 LEFT JOINs + GROUP_CONCAT — heavy for 868+ exercises.
- `receipt_data` stored in plaintext in `subscription_state`.

### 5.3 types.ts
- Clean. `SCHEMA_VERSION = 11`. Flashcard interface has both FSRS and SM-2 fields (migration compat).

### 5.4 seed.ts
- 1523 lines, 52+ exercises inserted one-by-one. Wrapped in transaction (good).

### 5.5 index.ts
- Diagnostic queries (3 COUNTs + 2 GROUP BYs) run on every production startup — gate behind `__DEV__`.
- Re-seed race condition if `initializeDatabase()` called concurrently.

---

## 6. Security Layer

### 6.1 AESEncryption.ts
- **Non-standard HMAC** (v2): Uses `H("hmac:inner:" || key || msg)` instead of RFC HMAC with ipad/opad XOR. Security weakness for v2 payloads.
- **Non-standard PBKDF2** (v2): Iterated SHA-256 without XOR-accumulation. Reduced effective entropy.
- CTR mode uses SHA-256 as block cipher instead of AES — non-standard (v2 only).
- v3 uses proper `@noble/ciphers/aes` GCM — correct and secure.
- **BUG**: `bytesToBase64` uses spread on Uint8Array → crashes on >64KB payloads (V8 max argument limit).
- `constantTimeEqual` leaks length information (fine for fixed-length HMAC tags).

### 6.2 EncryptedDatabase.ts
- `getRecentHealthData` performs v1→v3 migration during read loop — no transaction wrapping on writes.
- `migrateAllToV3` — no batch transaction, loads ALL rows into memory.
- **Key rotation check exists (`shouldRotateKey()` returns true after 90 days) but rotation is never implemented.**
- `secureDelete` overwrites+deletes but SQLite WAL may retain original data. Needs `PRAGMA secure_delete = ON`.

### 6.3 BiometricAuth.ts
- **BUG**: PBKDF2 runs 1,000 iterations (`for i < 1000`) despite `PASSCODE_PBKDF2_ITERATIONS = 100_000` constant defined at line 73. The constant is never used.
- Emergency wipe deletes encryption keys but leaves plaintext SQLite data (exercises, workouts, profile) accessible.
- Lockout duration escalates based on total historical failures, never resets.

### 6.4 StorageMigration.ts
- Migration function marks complete without actually reading data from any source — it's a stub that only checks if keys exist in SecureStore.

---

## 7. FitMind Module

### 7.1 schema.ts — Clean facade over service.ts

### 7.2 DocumentProcessor.ts
- URL import has no timeout — slow server blocks indefinitely.
- **PDF/EPUB text extraction returns empty string** — formats accepted but non-functional.
- No SSRF protection on URL downloads (low risk on real devices).

### 7.3 DocumentImportPipeline.ts
- `document_content_hashes` table exists but `checkDuplicate` re-hashes every file instead of using it.
- Good XSS sanitization and magic byte verification.
- Batch import is sequential — could parallelize.

### 7.4 ReadingSessionTracker.ts
- **Claims crash recovery but never persists session to disk** — app kill loses in-memory session.
- `updateActiveTime` includes paused time as active when currently paused.

### 7.5 DualAIEngine.ts
- `Math.random()` for template selection (style issue, not security).
- `loadConversationMemory` decrypts up to 15 conversations on every AI query — should cache.
- All conversations properly encrypted via `encryptedDB.storeAIConversation()`.

---

## 8. Performance Audit

### 8.1 Bundle Size — 67MB Removable

| Package | Size | Status |
|---------|------|--------|
| `pdfjs-dist` | 38MB | Lazy-load (only FitMind reader) |
| `@apollo/client` + `graphql` | 12.4MB | **Delete** — zero usage |
| `@intity/epub-js` | 9MB | Lazy-load |
| `react-native-paper` | 6.6MB | **Delete** — single `MD3LightTheme` import |
| `react-native-chart-kit` | 520KB | **Delete** — zero imports |

Total `node_modules`: 655MB. Removable: ~67MB.

### 8.2 Startup Speed

- 8 async operations fire simultaneously on mount (competing for JS thread)
- `DatabaseProvider` blocks rendering until schema + seed completes
- No code splitting — all 30+ screens eagerly loaded (no `React.lazy()`, no `lazy: true` in screen options)
- `updates.fallbackToCacheTimeout: 30000` — 30s blank screen on bad network
- No `console.log` stripping in production
- No inline requires in Metro config
- Diagnostic queries run on every startup

### 8.3 Rendering Speed

- **Zero `React.memo()`** across entire codebase
- All 4 context providers create new value objects every render → cascade
- `ThemedText` recreates style maps every render (used hundreds of times per screen)
- `coach/index.tsx` and `saved-workouts.tsx` use `ScrollView`+`.map()` for unbounded data
- `ProgressBar` and `StatRing` use JS-driven RN Animated (`useNativeDriver: false`)
- `exercises.tsx` FlatList missing optimization props

### 8.4 Database Speed

- `getExerciseById()`: 4 sequential queries (should be 1 JOIN)
- `workoutGenerator`: N+1 — `getProgressHistory()` per candidate (50 queries)
- `setUserEquipment`: N INSERTs without transaction
- Missing composite index on `workout_sessions(user_id, started_at)`
- `foodDatabase.ts`: 7,769 lines loaded at startup into memory

### 8.5 Animations — Mixed

**Good**: Reanimated 4.x layout animations (`FadeIn`, `FadeInDown`, `ZoomIn`, `SlideInDown`) run on UI thread.

**Bad**: `ProgressBar.tsx` and `StatRing.tsx` use old RN `Animated` with `useNativeDriver: false` — JS thread.

---

## 9. All Bugs by Severity

### P0 — App-Breaking (4)
| # | File | Bug |
|---|------|-----|
| 1 | `app/_layout.tsx` | AuthProvider not mounted — auth is completely non-functional |
| 2 | `app/index.tsx` | Unconditional redirect bypasses auth — anyone reaches dashboard |
| 3 | `src/database/schema.ts` | Migration `===` checks — users jumping versions miss columns |
| 4 | `src/database/service.ts` | `getExercisesByMuscle()` returns ALL exercises (filter ignored) |

### P1 — Data Corruption / Wrong Results (8)
| # | File | Bug |
|---|------|-----|
| 5 | `BackgroundHealthEngine.ts` | Health score defaults `/100` instead of `*1` — always 12pts low |
| 6 | `progressionEngine.ts` | Undefined `difficulty_rating` treated as failure |
| 7 | `HealthMonitor.ts` | Goal-reached alerts every 5 minutes (infinite duplicates) |
| 8 | `SensorFusionEngine.ts` | Gyroscope X/Y data lost — ML classifier gets wrong input |
| 9 | `recoveryEngine.ts` | `endDeload()` raises fresh muscles to fatigue=30 |
| 10 | `BiometricAuth.ts` | PBKDF2 runs 1K iterations, not 100K |
| 11 | `AnomalyDetector.ts` | 4 duplicate alerts per anomaly (no dedup) |
| 12 | `SleepAnalysisEngine.ts` | Sleep debt counts missing days as 0-sleep |

### P2 — Functional Gaps (6)
| # | File | Bug |
|---|------|-----|
| 13 | `EncryptedDatabase.ts` | Key rotation checked but never executed |
| 14 | `AESEncryption.ts` | `bytesToBase64` crashes on >64KB payloads |
| 15 | `offline-cache.ts` | Imports nonexistent export — crashes at runtime |
| 16 | `FitnessComponents.tsx` + `UIComponents.tsx` | Hardcoded lightColors — dark mode broken |
| 17 | `ReadingSessionTracker.ts` | Claims crash recovery but never persists to disk |
| 18 | `DocumentProcessor.ts` | PDF/EPUB text extraction returns empty string |

### Previously Fixed Bugs (16)
| # | File | Fix Applied |
|---|------|-------------|
| F1 | `app/onboarding.tsx` | Goal enum values → schema-compliant lowercase |
| F2 | `app/login.tsx` | Passcode stale closure → pass code directly |
| F3 | `app/craft-my-body.tsx` | `'local_user'` → `'user_local_001'` |
| F4 | `app/profile.tsx` | Division-by-zero guard + goalInfo fallback |
| F5 | `app/paywall.tsx` | Empty useEffect → `router.back()` |
| F6 | `app/fitmind-reader.tsx` | Null file_path → inline content fallback |
| F7 | `app/coach/index.tsx` | `coachCtx!` → safe default object |
| F8 | `app/move.tsx` | Calorie unit mismatch (steps-meters) fixed |
| F9 | `app/move.tsx` | Double XP award on tracking start removed |
| F10 | `app/fitquest.tsx` | User ID 'default_user' → 'user_local_001' |
| F11 | `app/fitquest.tsx` | showAllInstructions reset in advanceAfterRest |
| F12 | `app/health-dashboard.tsx` | scoreColor duplicate warning ranges |
| F13 | `app/health-dashboard.tsx` | Snapshot null safety (`?? 0` fallbacks) |
| F14 | `app/fitmind-library.tsx` | GradientButton disabled during import |
| F15 | `app/workouts/index.tsx` | Full rewrite (legacy theme → useTheme + real data) |
| F16 | `app/coach/index.tsx` | TypeScript type fix for fallback CoachContext |

---

## 10. Implementation Strategy

### Phase 1: Critical Bugs (Days 1-3) — ✅ COMPLETED
Mount AuthProvider, fix index.tsx redirect, fix schema migration fall-through, fix getExercisesByMuscle, fix health score defaults, fix undefined difficulty_rating, add alert deduplication, fix PBKDF2 iterations, fix bytesToBase64. (endDeload verified correct — removed from list.)

**Files modified**: `app/_layout.tsx`, `app/index.tsx`, `src/database/schema.ts`, `src/database/service.ts`, `src/engines/BackgroundHealthEngine.ts`, `src/engines/progressionEngine.ts`, `src/engines/HealthMonitor.ts`, `src/security/BiometricAuth.ts`, `src/security/AESEncryption.ts`

### Phase 2: Bundle Diet (Day 4) — ✅ COMPLETED
**Removed packages** (npm uninstall): `@apollo/client`, `graphql`, `react-native-chart-kit`, `zustand`, `react-native-paper`  
**Deleted files**: `src/services/apollo-client.ts`, `src/services/mock-apollo-client.ts`, `src/services/exercise-queries.ts`, `src/services/offline-cache.ts`, `src/components/ui/FitnessComponents.tsx`, `src/components/ui/UIComponents.tsx`, `store/useAuthStore.ts`, `src/design/tokens.ts`, 7 `.bak` files  
**Modified files**: `app/_layout.tsx` (removed ApolloProvider wrapper + imports), `app/splash.tsx` (removed useAuthStore usage), `src/theme/theme.ts` (inlined MD3LightTheme colors, removed Paper import)  
**Build optimizations**: `babel-plugin-transform-remove-console` (production), inline requires in `metro.config.js`, `fallbackToCacheTimeout` 30s→5s in `app.json`

### Phase 3: Rendering Performance (Days 5-7) — ✅ COMPLETED
Memoized all 4 context providers (ThemeContext, LanguageContext, DatabaseContext, AuthContext) with useMemo/useCallback. Wrapped ThemedText in React.memo. Wrapped 5 key GlassUI components (GlassCard, StatChip, AnimatedCounter, GradientButton, SectionHeader) in React.memo. Converted coach chat (app/coach/index.tsx) from ScrollView+map to FlatList with virtualisation. Converted saved-workouts from ScrollView+map to FlatList. Fixed AnimatedCounter — removed dead useSharedValue/useEffect/useAnimatedStyle code that was never actually used.

**Files modified**: `src/context/ThemeContext.tsx`, `src/context/LanguageContext.tsx`, `src/context/DatabaseContext.tsx`, `src/context/AuthContext.tsx`, `src/components/ThemedText.tsx`, `src/components/ui/GlassUI.tsx`, `app/coach/index.tsx`, `app/saved-workouts.tsx`

### Phase 4: Database & Engine Fixes (Days 8-10) — ✅ COMPLETED
Consolidated getExerciseById with Promise.all (3 sub-queries in parallel). Wrapped setUserEquipment in db.withTransactionAsync for atomic DELETE+INSERT. Added PRAGMA foreign_keys = ON to database init. Added 2 composite indexes (idx_progress_user_exercise_date, idx_fitmind_flashcards_due). Fixed accumulateFatigue race condition with atomic INSERT...ON CONFLICT UPDATE in transaction. Added anomaly deduplication (4-hour cooldown per type+metric). Improved sleep debt calculation (surplus payoff, 3-day cap). Added SensorFusionEngine AppState auto-pause (pauses accelerometer/gyroscope on background, resumes on foreground).

**Files modified**: `src/database/service.ts`, `src/database/schema.ts`, `src/engines/recoveryEngine.ts`, `src/engines/AnomalyDetector.ts`, `src/engines/SleepAnalysisEngine.ts`, `src/engines/SensorFusionEngine.ts`

### Phase 5: Startup Speed (Day 11) — 5 tasks ✅ COMPLETED
- Deferred 5 non-critical startup calls via `InteractionManager.runAfterInteractions()` in `_layout.tsx`
- Gated 30+ `console.log` calls across 8 engine files behind `__DEV__` (DistanceEngine, StepCounterEngine, SleepAnalysisEngine, workoutGenerator, HealthMonitor, SensorFusionEngine, IntentRouter, BackgroundHealthEngine)
- Added `lazy: true` to all 24 hidden `Tabs.Screen` entries in `_layout.tsx`
- Moved `foodDatabase.ts` from 7,769-line static array (192KB) to lazy-loaded Proxy pattern — data extracted to `assets/food-data.json`
- Removed unused `pdfjs-dist` (38MB from node_modules)
- Bonus: gated `console.log` in nutrition-calculator.tsx behind `__DEV__`

**Files modified**: `app/_layout.tsx`, `src/engines/DistanceEngine.ts`, `src/engines/StepCounterEngine.ts`, `src/engines/SleepAnalysisEngine.ts`, `src/engines/workoutGenerator.ts`, `src/engines/HealthMonitor.ts`, `src/engines/SensorFusionEngine.ts`, `src/engines/IntentRouter.ts`, `src/engines/BackgroundHealthEngine.ts`, `src/services/foodDatabase.ts`, `app/nutrition-calculator.tsx`, `package.json`
**Files created**: `assets/food-data.json`

### Phase 6: Dark Mode & Theme (Days 12-13) — 4 tasks ✅ COMPLETED
- Deleted legacy `src/theme/theme.ts` (zero imports, dead code) and removed empty `src/theme/` directory
- Fixed ~28 hardcoded color patterns across 11 files, replacing with `theme.colors.*` tokens
- Files fixed: `login.tsx`, `onboarding.tsx`, `fitquest.tsx`, `craft-my-body.tsx`, `analytics.tsx`, `dashboard.tsx`, `fitmind-library.tsx`, `Button.tsx`, `LanguageSelector.tsx`, `GlassUI.tsx`
- Removed redundant `?? '#EF4444'` fallbacks from craft-my-body.tsx error text (colors.error always defined)
- Minor remaining tech debt (low risk, does not break dark mode):
  - `fitmind-reader.tsx`: 2 `borderTopColor` in static `StyleSheet.create` — needs refactor to inline styles
  - `craft-my-body.tsx`: Module-level constants (PRIORITY_CONFIG, ACCENT_PURPLE) — needs restructuring to move inside component
  - `fitmind-library.tsx`: Module-level STATUS_COLORS — same pattern
  - Decorative domain colors (#38BDF8 water, #A78BFA sleep, #F472B6 cardio) intentionally kept

**Files modified**: `app/login.tsx`, `app/onboarding.tsx`, `app/fitquest.tsx`, `app/craft-my-body.tsx`, `app/analytics.tsx`, `app/dashboard.tsx`, `app/fitmind-library.tsx`, `src/components/Button.tsx`, `src/components/LanguageSelector.tsx`, `src/components/ui/GlassUI.tsx`
**Files deleted**: `src/theme/theme.ts`

### Phase 7: Auth Architecture (Days 14-16) — 5 tasks ✅ COMPLETED
Decide local vs server auth, remove/gate server calls, remove Zustand refs from splash, add isConfigured guards, wire splash→auth→dashboard routing.

**Files modified**:
- `app/splash.tsx` — Replaced orphaned SecureStore JWT check with useDatabase() + BiometricAuthService routing
- `src/context/AuthContext.tsx` — Added `isAuthenticated`, `isServerConfigured`, `isLocallyAuthenticated`; gated server calls behind `isServerConfigured`
- `app/login.tsx` — Guarded email signIn behind `backendConfigured`, fixed biometric/passcode to navigate directly without `resumeSession()`

### Phase 8: i18n & Polish (Days 17-20) — 4 tasks ✅ COMPLETED
Add translation keys for 8 screens, replace hardcoded strings, add interpolation support, match TTS language to app language.

**Files modified**:
- `src/context/LanguageContext.tsx` — Added `{{var}}` interpolation support to `t()`
- `src/i18n/translations.ts` — Added ~90 new English translation keys (analytics, day/month labels, craft-body, nav titles)
- `app/analytics.tsx` — Replaced ~15 hardcoded strings with `t()` calls
- `app/craft-my-body.tsx` — Replaced Alert strings, SectionHeaders, input labels, button title
- `app/health-dashboard.tsx` — Replaced hardcoded day names, 'Day' label, 'Health alert' fallback
- `app/_layout.tsx` — Replaced 20 hardcoded screen titles with `t()` calls
- `src/services/audioService.ts` — Added `language` field, BCP-47 mapping, `setLanguage()` method
- `src/hooks/useAudio.ts` — Syncs TTS language to app language via `useLanguage()`

**Remaining tech debt (non-blocking)**:
- Non-English languages only have ~80 of ~440 keys translated
- Module-level constants (GOAL_OPTIONS, MUSCLE_GROUPS, etc.) can't use `t()` without restructuring
- Exercise audio seed data is English-only
- No RTL support for Arabic

**Total: 56 tasks, ~20 working days.**
