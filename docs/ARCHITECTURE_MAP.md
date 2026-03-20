# FitQuest 2.0 — Complete Architecture Map

**Generated**: March 20, 2026  
**Technology Stack**: Expo SDK 55, React Native 0.83.2, React 19.2.0, TypeScript 5.9, SQLite (offline-first)

---

## 1. COMPLETE DIRECTORY TREE

### `/app/` — Expo Router File-Based Screens (31 files)

**Primary Tabs (shown in tab bar):**
- `dashboard.tsx` — Home screen: health status, recent workouts, progress rings, daily goals
- `fitquest.tsx` — AI Workout Generator: create and execute workouts 
- `move.tsx` — Steps & movement tracking: daily steps, jog sessions, activity charts
- `coach/index.tsx` — AI Coach: workout tips, form guidance, motivation
- `profile.tsx` — User profile: settings, preferences, connected services

**Secondary Screens (hidden, href: null):**
- `index.tsx` — Splash/entry point
- `login.tsx`, `register.tsx` — Authentication
- `splash.tsx` — App boot screen
- `onboarding.tsx` — First-run tutorial
- `workout.tsx` — Active workout playback (modal overlay)
- `workouts/[id].tsx`, `workouts/index.tsx` — Saved workouts library
- `progress.tsx` — Progress analytics & history
- `create-workout.tsx` — Manual workout builder
- `fitmind-library.tsx` — Document library (PDF/EPUB reader)
- `fitmind-reader.tsx` — Reading session interface
- `analytics.tsx` — Detailed analytics dashboard
- `saved-workouts.tsx` — Workout templates/favorites
- `meal-prep.tsx` — Nutrition planning (BodyCraft integration)
- `craft-my-body.tsx` — Body goal algorithms (BodyCraft)
- `health-dashboard.tsx` — Unified health metrics
- `backups.tsx` — Cloud backup, import/export
- `paywall.tsx` — Subscription/trial information
- `exercises.tsx` — Browse exercise catalogue
- `nutrition-calculator.tsx` — TDEE, macro, hydration calculator
- `legal-center.tsx` — Legal documents hub
- `privacy-policy.tsx`, `terms-of-service.tsx` — Legal pages
- `professor/index.tsx` — AI Tutor (reading comprehension, flashcards)
- `_layout.tsx` — **CRITICAL**: Provider nesting, tab navigation, app startup hooks

### `/src/` — Core Application Logic (16 modules, ~250+ files)

#### `src/components/` — Reusable UI (27 files)
- `ThemedText.tsx` — DEFAULT export for all text (adapts per theme)
- `GlassUI.tsx` — Premium glass-morphism components (`GradientButton`, `GlassCard`, `SectionHeader`, etc.)
- `PremiumGate.tsx` — Paywall gate (uses AccessState machine)
- `ExerciseDetailSheet.tsx`, `ExerciseImage.tsx` — Exercise display
- `DropdownMenu.tsx` — Tab bar dropdown
- `ErrorBoundary.tsx`, `ScreenErrorBoundary.tsx` — Error containment
- `ProgressBar.tsx`, `ConfettiBurst.tsx`, `CountdownRing.tsx` — Animations
- `RestTimerOverlay.tsx`, `GetReadyOverlay.tsx` — Workout overlays
- `WorkoutSummaryView.tsx` — Post-workout recap
- `ui/` — GlassUI system, Skeleton loading
- `health/` — Health analytics widgets
- `charts/` — Progress chart components

#### `src/context/` — React Context Providers (4 files)
- `ThemeContext.tsx` — Dark/light/blackGold theme switching (SecureStore-persisted)
- `LanguageContext.tsx` — i18n translation (15 languages, SecureStore-persisted)
- `DatabaseContext.tsx` — SQLite init, profile loading, onboarding state
- `AuthContext.tsx` — Biometric/passcode auth, session management

#### `src/database/` — SQLite Data Layer (12 files)
- `schema.ts` — DB initialization, schema versioning (v16), table creation
- `types.ts` — TypeScript enums (Category, Difficulty, TargetMuscle, etc.), `SCHEMA_VERSION = 16`
- `service.ts` — CRUD operations (100+ functions)
- `index.ts` — Public API (`initializeDatabase`, `resetDatabase`, seed orchestration)
- `seed.ts` — Built-in exercise catalogue (300+ exercises)
- `external-seed.ts` — External exercise import (868 exercises)
- `exerciseGenerator.ts` — Dynamic exercise generation
- `bodyCraftService.ts` — Body goal algorithm integration
- `queryCache.ts` — Query result caching

#### `src/engines/` — Workout & Health Logic (20+ files)

**Core Engines:**
1. `workoutGenerator.ts` — Deterministic workout generation (fatigue map, goal alignment, pattern balance)
2. `progressionEngine.ts` — Performance tracking, difficulty scaling
3. `recoveryEngine.ts` — Fatigue accumulation, deload detection (every 8 weeks)
4. `warmupCooldownGenerator.ts` — Dynamic warm-up/cool-down

**Health & Sensor Engines:**
5. `BackgroundHealthEngine.ts` — Orchestrates health subsystems (data collection, anomaly detection)
6. `HealthMonitor.ts` — Daily goals, step counting, active minutes, calories
7. `SensorFusionEngine.ts` — Accelerometer+Gyroscope fusion, activity classification, rep counting
8. `SleepAnalysisEngine.ts` — Sleep quality score, stage estimation, sleep debt
9. `AnomalyDetector.ts` — Statistical anomaly detection (Z-score, IQR, moving average)
10. `RealisticHealthEngine.ts` — Evidence-based calculations (BMR, TDEE, 1RM, body fat %)
11. `ReadinessEngine.ts` — Daily readiness snapshot (recovery, fatigue, mood)

**Specialized:**
12. `IntentRouter.ts` — NL intent classification (8 intents: COACH, PROFESSOR, HEALTH, etc.)
13. `MindSessionEngine.ts` — Focus/mindfulness exercise timelines
14. `DistanceEngine.ts` — Jog/run distance tracking
15. `StepCounterEngine.ts` — Step detection
16. `bodyCraftEngine.ts` — Body composition goal algorithms
17. `edgeCaseGuards.ts` — Fallback workout generation
18. `transparencyLayer.ts` — Algo decision explanations
19. `stateResetDoctrine.ts` — Profile change handling

#### `src/security/` — Encryption & Auth (5 files)
- `EncryptedDatabase.ts` — v3 AES-256-GCM encrypted storage, auto-migrates v1/v2→v3
- `AESEncryption.ts` — Encryption primitives, master key derivation (PBKDF2)
- `BiometricAuth.ts` — Biometric auth, 5-attempt lockout, passcode fallback
- `StorageMigration.ts` — SecureStore-backed credential helpers
- `randomId.ts` — Cryptographically secure ID generation

#### `src/services/` — Singleton Services (29 files)

**Analytics:** `posthogService.tsx`, `telemetry.ts`, `errorTelemetry.ts`, `logger.ts`, `analyticsIngestionService.ts`, `crashReporting.ts`

**Game:** `xpService.ts` (100 base + 20/exercise + streak bonus), `rankingService.ts`

**Workout:** `adaptiveTrainingService.ts`, `aiWorkoutService.ts`, `workoutGenerator/` submodule

**Data:** `dataSyncService.ts`, `syncService.ts`, `cloudBackupService.ts`, `cacheStoreService.ts`, `cachePolicy.ts`

**User:** `audioService.ts` (TTS, 15 languages), `timerService.ts`, `featureFlags.ts`, `mutationQueueService.ts`, `notificationReliabilityService.ts`

**Health:** `exerciseImageService.ts`, `exerciseTaxonomyMapper.ts`, `healthAdapters/`, `foodDatabase.ts`, `derivedMetricsService.ts`

**Auth:** `authApi.ts`, `locationService.ts`, `aiProvider.ts`

**Monitoring:** `autonomousPolicyRuntime.ts`, `replayOrchestrator.ts`, `smokeTestUtils.ts`

#### `src/purchases/` — Subscription System (5 files)
- `SubscriptionContext.tsx` — React context + `AccessState` machine
- `SubscriptionManager.ts` — RevenueCat integration, trial state, expiration logic
- `TrialOnboarding.ts` — Trial welcome screen
- `index.ts` — Public API

#### `src/ai/` — ML Models (8+ files)
- `TrainedIntentRouter.ts` — v1.0 SVC intent classifier (8 intents)
- `TrainedActivityClassifier.ts` — v1.0 activity classifier (9 activities)
- `ModelLoader.ts` — Async expo-asset pipeline
- `TransformerRuntime.ts` — ONNX model runner
- `professor/` — NeuralSummarizer, SemanticSearch, KnowledgeGraph
- `sensors/` — DeepActivityClassifier

#### `src/fitmind/` — Cognitive Fitness Module (9 files)
- `schema.ts` — 6 tables + `FitMindService` CRUD class (SM-2 spaced repetition)
- `DocumentProcessor.ts` — Text analysis, Flesch-Kincaid readability scoring
- `DocumentImportPipeline.ts` — Import with SHA-256 deduplication, quota enforcement
- `ReadingSessionTracker.ts` — Session state machine (IDLE→ACTIVE→PAUSED→COMPLETED)
- `DualAIEngine.ts` — COACH & PROFESSOR personalities
- `FSRSService.ts` — Spaced repetition algorithm

#### `src/hooks/` — Custom React Hooks (5 files)
- `useFitQuestWorkout.ts` — **PRIMARY**: Full workout lifecycle (generate→start→exercise→complete→XP)
- `useTimer.ts`, `useAudio.ts`, `usePedometer.ts`, `useCustom.ts`

#### `src/design/` — Theme System (2 files)
- `theme-system.ts` — **CANONICAL**: Colors (dark/light/blackGold), spacing (numeric keys), radius, typography

#### `src/i18n/` — Internationalization (1 file)
- `translations.ts` — 15 languages (en, af, zu, xh, st, es, fr, de, pt, zh, ja, ko, ar, hi, sw)

### `/tests/` — Test Suite (41 files, vitest)
- Core engines, security, database, health, services, features, integration tests
- Estimated coverage: < 40% (integration layer especially weak)

### `/scripts/` — Build & Verification (29+ files)
- Phase verification scripts (`phase*-verify-lite.mjs`)
- Quality gates, release verification, i18n checks
- Exercise/food data import scripts
- Screenshot analysis, translation helpers

---

## 2. BOOT SEQUENCE

### Entry Point Chain
```
index.ts → registerRootComponent(App)
  ↓
App.tsx → ExpoRoot (loads app/_layout.tsx)
  ↓
app/_layout.tsx → Provider hierarchy + deferred services
```

### Provider Nesting (CRITICAL ordering)
```
<ThemeProvider>                          ← Theme tokens
  <ErrorBoundary>                        ← Error containment
    <PostHogAnalyticsProvider>           ← Analytics
      <LanguageProvider>                 ← i18n
        <AudioLanguageSyncer />          ← Sync TTS language
        <DatabaseProvider>               ← SQLite init
          <AuthProvider>                 ← Biometric/passcode auth
            <SubscriptionProvider>       ← Trial/paid access
              <ThemedTabs />             ← Tab navigation + screens
```

### Deferred Startup Phases

**Phase 1** (immediate, blocking):
- Crash reporting initialization
- App launch telemetry

**Phase 2** (requestIdleCallback/300ms fallback):
- Error telemetry, feature flags (async, non-blocking)
- Cloud backup check (no-op unless backend configured)

**Phase 3** (InteractionManager.runAfterInteractions):
- Replay orchestrator — catch up on deferred mutations
- Notification reliability reconciliation
- Analytics queue flush

**Phase 4** (nested InteractionManager — after Phase 3 settles):
- Background health engine — **HEAVIEST SERVICE**
  - Collection: 1 minute intervals
  - Anomaly checks: 30 minute intervals

### Database Initialization (in DatabaseProvider)
```
initializeDatabase()
  ├─ getDatabase() → Open SQLite with WAL + PRAGMAs
  ├─ seedExercises() → Core exercises (300+)
  ├─ seedExternalExercises() → External DB (868)
  ├─ encryptedDB.initialize() → Encrypted tables
  └─ initializeExerciseImages() → Image manifests
```

---

## 3. DATA FLOW MAP

```
SQLite (offline source of truth)
├─ Core fitness tables (exercises, profiles, sessions)
├─ Encrypted tables (health_data, ai_conversations)
└─ FitMind tables (documents, flashcards)
   ↓
Context Providers (gateway layer)
├─ DatabaseContext — isReady, userProfile, onboardingComplete
├─ ThemeContext — Color/spacing tokens
├─ LanguageContext — Translations
├─ AuthContext — User session, biometric state
└─ SubscriptionContext — AccessState machine (RESOLVING→TRIAL/FULL/LOCKED)
   ↓
Hooks (reactive binding)
├─ useFitQuestWorkout — Workout lifecycle
├─ useDatabase — DB access gate
├─ useTimer — Rest timer state
└─ useLanguage — Translations
   ↓
Engines (business logic)
├─ workoutGenerator — Deterministic, stateless
├─ progressionEngine — Performance tracking
├─ recoveryEngine — Fatigue management
├─ backgroundHealth — Health orchestration
└─ sensorFusion — Activity detection
   ↓
Services (singletons, effects)
├─ xpService — Persist XP to app_state
├─ audioService — TTS synthesis
├─ encryptedDB — AES-256-GCM health/AI storage
└─ posthogService — Analytics
   ↓
SQLite (persistence)
└─ workout_sessions, session_exercises, progress_records, app_state, encrypted_*
```

### Key Flows

**Workout Generation:**
```
User taps "Generate Workout"
  → useFitQuestWorkout.generateNewWorkout()
  → getUserProfile() + getMuscleFatigue() + getCachedReadiness()
  → workoutGenerator.generateWorkout() (35% freshness, 25% goal, 20% pattern)
  → generateWarmupCooldown()
  → createWorkout() → persist to SQLite
  → Screen renders exercise cards
```

**Health Data:**
```
BackgroundHealthEngine.start()
  → Every 1 min: collect (steps, calories, activity classification)
  → Every 30 min: anomalyDetector.checkForAnomalies()
     → encryptedDB.createHealthAlert() if anomaly detected
  → Dashboard reads via encryptedDB.getActiveAlerts()
```

**XP Persistence:**
```
User completes workout
  → useFitQuestWorkout.finishWorkout()
  → recordSessionPerformance() + awardWorkoutXP()
  → getAppState('user_total_xp') → increment → setAppState() → SQLite
```

---

## 4. STATE MANAGEMENT INVENTORY

### React Contexts

| Context | File | Hook | State Managed |
|---------|------|------|---------------|
| Theme | `ThemeContext.tsx` | `useTheme()` | mode, theme object |
| Language | `LanguageContext.tsx` | `useLanguage()` | language code, `t()` |
| Database | `DatabaseContext.tsx` | `useDatabase()` | isReady, userProfile, onboardingComplete |
| Auth | `AuthContext.tsx` | `useAuth()` | user, token, biometricCapability |
| Subscription | `SubscriptionContext.tsx` | `useSubscription()` | state, accessState, offerings |

### Singletons

| Service | File | Pattern |
|---------|------|---------|
| backgroundHealth | `BackgroundHealthEngine.ts` | const singleton |
| sensorFusion | `SensorFusionEngine.ts` | const singleton |
| healthMonitor | `HealthMonitor.ts` | const singleton |
| sleepEngine | `SleepAnalysisEngine.ts` | const singleton |
| anomalyDetector | `AnomalyDetector.ts` | const singleton |
| encryptedDB | `EncryptedDatabase.ts` | const singleton |
| audioService | `audioService.ts` | const singleton |
| timerService | `timerService.ts` | const singleton |
| xpService | `xpService.ts` | module-level functions |
| posthogService | `posthogService.tsx` | lazy promise |
| SubscriptionManager | `SubscriptionManager.ts` | async getInstance() |

### SQLite `app_state` Keys

| Key | Purpose |
|-----|---------|
| `user_total_xp` | Total XP earned |
| `onboarding_complete` | Onboarding flag |
| `*_goal` | User goals (steps, minutes) |
| `daily_step_xp_date` | Last step XP date |

### SecureStore Keys
- `fitquest.theme.mode` — Theme preference
- `fitquest.language` — Language preference
- Auth tokens, encryption master key, biometric preferences

---

## 5. SECURITY BOUNDARY

### Plain SQLite (Unencrypted)
Exercises, user profile, workout history, progress records, XP/levels, app state, subscriptions, FitMind documents/flashcards, daily health summaries

### Encrypted Database (AES-256-GCM v3)
- `encrypted_health_data` — Health metrics (heart rate, sleep, weight)
- `encrypted_ai_conversations` — COACH/PROFESSOR conversations
- `encrypted_notes` — User notes with sensitive content
- `health_alerts` — Health anomaly alerts

**Pattern**: JSON → serialize → AES-256-GCM encrypt → store as blob  
**Migration**: v1/v2 payloads auto-upgraded to v3 on read

### SecureStore (OS-Level Encryption)
Auth tokens, encryption master key, biometric preferences, PBKDF2-hardened passcodes

---

## 6. SCREEN INVENTORY

### Primary Tabs

| Screen | File | Contexts | Key Components |
|--------|------|----------|----------------|
| Dashboard | `dashboard.tsx` | Database, Theme, Language | ProgressRing, GlassCard, AnimatedListItem |
| FitQuest | `fitquest.tsx` | Database, Theme, Language, Subscription | GradientButton, ProgressRing |
| Move | `move.tsx` | Database, Theme, Language | JogMap, WeekCalendar |
| AI Coach | `coach/index.tsx` | Theme, Language | Chat interface |
| Profile | `profile.tsx` | Database, Auth, Theme, Language, Subscription | ToggleButtons, GradientButton |

### Secondary Screens (26)

| Screen | File | Navigation | Purpose |
|--------|------|-----------|---------|
| Splash | `index.tsx`, `splash.tsx` | Auto | Boot/branding |
| Login/Register | `login.tsx`, `register.tsx` | Push | Auth |
| Onboarding | `onboarding.tsx` | Conditional | First-run |
| Workout Player | `workout.tsx` | Push | Active workout |
| Progress | `progress.tsx` | Push | Analytics |
| Create Workout | `create-workout.tsx` | Push | Manual builder |
| FitMind Library | `fitmind-library.tsx` | Push | Document list |
| FitMind Reader | `fitmind-reader.tsx` | Push + params | Reading session |
| AI Professor | `professor/index.tsx` | Push | Reading tutor |
| Health Dashboard | `health-dashboard.tsx` | Push | Unified health |
| Analytics | `analytics.tsx` | Push | Data deep-dive |
| Saved Workouts | `saved-workouts.tsx` | Push | Templates |
| Meal Prep | `meal-prep.tsx` | Push | Nutrition |
| BodyCraft | `craft-my-body.tsx` | Push | Goal programs |
| Exercises | `exercises.tsx` | Push | Catalogue |
| Nutrition Calc | `nutrition-calculator.tsx` | Push | TDEE/macros |
| Legal Center | `legal-center.tsx` | Push | Legal hub |
| Privacy/Terms | `privacy-policy.tsx`, `terms-of-service.tsx` | Push | Legal text |
| Paywall | `paywall.tsx` | Push | Subscription |
| Backups | `backups.tsx` | Push | Export/import |
| Workout Detail | `workouts/[id].tsx` | Push + params | Template view |

---

## 7. EXTERNAL DEPENDENCIES

### Core Framework
- **expo** (^55.0.6), **react** (19.2.0), **react-native** (0.83.2), **expo-router** (~55.0.5), **typescript** (^5.9.3)

### State & Forms
- **react-hook-form** (^7.48.0), **zod** (^3.22.4)

### UI & Animation
- **react-native-reanimated** (4.2.1), **expo-linear-gradient**, **react-native-svg**, **expo-blur**

### Data & Storage
- **expo-sqlite** (~55.0.10), **expo-secure-store** (~55.0.8), **expo-file-system** (~55.0.11)

### Security
- **@noble/ciphers** (^1.3.0), **expo-crypto**, **expo-local-authentication**, **@sentry/react-native**

### Health & Sensors
- **react-native-health** (HealthKit), **react-native-health-connect** (HealthConnect), **expo-sensors**, **expo-location**

### Audio & Media
- **expo-speech** (TTS), **react-native-pdf**, **react-native-webview**

### Analytics
- **posthog-react-native** (^4.37.3), **posthog-react-native-session-replay**

### Monetization
- **react-native-purchases** (^9.12.0) — RevenueCat

---

## 8. BUILD & CONFIG

### Multi-Profile Expo Config (`app.config.ts`)

**Profile 1: Expo Go** (default) — No native plugins, fast iteration  
**Profile 2: Dev Client** (`FITQUEST_DEV_CLIENT=1`) — Native plugins (Health Connect, Sentry)

### Key Config
- Min Android SDK: 26
- Orientation: portrait
- Splash: #0A0E17 (matte black)

### Babel (`babel.config.js`)
- `transform-remove-console` (prod only)
- `react-native-reanimated/plugin` (**MUST be last**)

### Metro (`metro.config.js`)
- BlockList: `workspace-repos/`, `server/`, build artifacts
- Extra asset extensions: `['model', 'txt']` (ML models + reader assets)
- Inline requires: enabled

---

## 9. RISK AREAS & TECH DEBT

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| RevenueCat test key in prod | Fatal crash | Env check, skip if production |
| No encryption key rotation | Permanent master key | Planned: key rotation strategy |
| Sensor fusion without hardware validation | Crash if accel unavailable | try-catch wrap |
| SQLite contention (sensor 10Hz + health engine) | Lock/slowdown | WAL mode, but no read replicas |
| Test coverage < 40% | Regression risk | Integration layer especially weak |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| No CRDTs for multi-device sync | Data loss on device switch | Cloud backup optional |
| Singletons lack lifecycle cleanup | Resource leaks on app close | Planned refactor |
| Exercise seeding bloat (868 exercises) | 3-5 sec boot delay | Idempotent, cached |
| QueryCache no smart invalidation | Stale data | Manual cache.clear() calls |
| Theme/Language context full tree re-render | Performance | useMemo on most screens |

### Missing Features
1. Social/leaderboards (infrastructure exists, no UI)
2. Cloud workout sharing (mentioned, not implemented)
3. Video exercise library (images only)
4. Workout scheduling/calendar
5. Background health tasks (needs expo-task-manager)
6. Offline mode indicator
7. Advanced analytics export

### Tech Debt Matrix

| Module | Debt | Priority |
|--------|------|----------|
| Security | No key rotation strategy | High |
| Tests | No E2E framework | High |
| Database | No query result streaming | Medium |
| Services | No singleton lifecycle hooks | Medium |
| AI | Bundled models not versioned | Medium |
| Purchases | RevenueCat hard-coupled | Medium |
| FitMind | Document content not indexed | Low |
| UI | Glass morphism dark-only | Low |

---

## Summary

| Category | Count |
|----------|-------|
| Screens | 31 (5 tabs + 26 hidden) |
| React Contexts | 5 |
| Singleton Services | 10+ |
| Database Tables | 30+ |
| Tests | 41 (vitest) |
| npm Packages | 50+ |
| Supported Languages | 15 |
| External Exercises | 868 |
| Built-In Exercises | 300+ |
