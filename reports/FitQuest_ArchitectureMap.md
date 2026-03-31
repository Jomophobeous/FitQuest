# FitQuest 2.0 — Architecture Map

> **Version**: 2.3.0 | **Schema**: v20 | **Framework**: React Native 0.83.2 + Expo SDK 55 + Expo Router v6
> **Architecture**: Fully client-side, offline-first, SQLite single source of truth
> **Generated**: 2026-03-25

---

## 1. System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│  Expo Router v6 (file-based) · 31 screens · 41 components      │
│  Tabs: Dashboard | FitQuest | Move | Coach | Profile            │
│  Glass morphism design system · Reanimated 3 animations         │
├─────────────────────────────────────────────────────────────────┤
│                        STATE LAYER                              │
│  4 Context providers · 6 hooks · Zustand (auth only)            │
│  ThemeProvider → LanguageProvider → DatabaseProvider →           │
│  AuthProvider → SubscriptionProvider → App                      │
├─────────────────────────────────────────────────────────────────┤
│                        DOMAIN LAYER                             │
│  40 engines · 10 AI/ML models · BodyCraft algorithm             │
│  Workout: generator + progression + recovery + warmup/cooldown  │
│  Health: sensor fusion + anomaly + sleep + background monitor   │
│  AI: DualAI (Coach+Professor) + IntentRouter + memory           │
├─────────────────────────────────────────────────────────────────┤
│                         DATA LAYER                              │
│  SQLite (WAL mode) · 30+ tables · schema v20                    │
│  Encrypted storage: AES-256-GCM v3 · PBKDF2-SHA256 100k iter   │
│  Caches: QueryCache (5m TTL) · TranslationRegistry (LRU 10k)   │
│  Durability: WAL → Mutation → Snapshot → Recovery               │
├─────────────────────────────────────────────────────────────────┤
│                       SECURITY LAYER                            │
│  Biometric auth (Face ID / Touch ID / Fingerprint)              │
│  PBKDF2-hardened passcode fallback · 5-attempt lockout          │
│  SecureStore for keys · Emergency wipe after 15 failures        │
├─────────────────────────────────────────────────────────────────┤
│                       PLATFORM LAYER                            │
│  RevenueCat (subscriptions) · PostHog (analytics)               │
│  Sentry (crash reporting) · AI providers (Grok→Groq→OpenRouter) │
│  HealthKit (iOS) · Health Connect (Android, disabled)           │
├─────────────────────────────────────────────────────────────────┤
│                         I18N LAYER                              │
│  15 languages · 648 UI keys · 3,312 exercises × 14 languages   │
│  Two-tier: translations.ts (UI) + SQLite exercise_translations  │
│  LRU cache: 10k entries, O(1) lookups, 14M ops/sec             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Provider Hierarchy (app/_layout.tsx)

```
ThemeProvider
  └─ LanguageProvider
       └─ DatabaseProvider
            └─ AuthProvider
                 └─ SubscriptionProvider
                      └─ Tabs (Expo Router)
                           ├─ Dashboard
                           ├─ FitQuest (PremiumGated)
                           ├─ Move
                           ├─ Coach (PremiumGated)
                           └─ Profile
```

---

## 3. Screen Map

### Tab Screens (5)

| Screen | File | Premium | Purpose |
|--------|------|---------|---------|
| Dashboard | `app/dashboard.tsx` | No | XP, recovery, streaks, fatigue, quick actions |
| FitQuest | `app/fitquest.tsx` | **Yes** | AI workout generation + execution |
| Move | `app/move.tsx` | No | Steps, jogging, GPS tracking |
| Coach | `app/coach/index.tsx` | **Yes** | Conversational AI fitness coach |
| Profile | `app/profile.tsx` | No | Settings, stats, backup, subscription |

### Hidden Screens (26)

| Category | Screens |
|----------|---------|
| Auth/Onboarding | `index.tsx`, `splash.tsx`, `login.tsx`, `register.tsx`, `onboarding.tsx` |
| Workout | `workout.tsx`, `workouts/index.tsx`, `workouts/[id].tsx`, `saved-workouts.tsx`, `create-workout.tsx` |
| Analytics | `progress.tsx`, `analytics.tsx` |
| Premium | `paywall.tsx`, `health-dashboard.tsx` (gated), `craft-my-body.tsx` (gated), `meal-prep.tsx` (gated), `nutrition-calculator.tsx` |
| Library | `exercises.tsx` |
| Legal | `legal-center.tsx`, `privacy-policy.tsx`, `terms-of-service.tsx` |
| System | `backups.tsx` |
| **Deprecated** | `fitmind-library.tsx` → redirects to /dashboard, `fitmind-reader.tsx` → redirects to /dashboard, `professor/index.tsx` → redirects to /coach |

---

## 4. Engine Architecture

### 4.1 Core Workout (src/engines/)

```
User Profile + Fatigue Map + Equipment
         │
         ▼
 ┌──────────────────┐
 │ workoutGenerator  │──── edgeCaseGuards ──── warmupCooldownGenerator
 │    (v1)           │
 └────────┬─────────┘
          │ legacyAdapter
          ▼
 ┌──────────────────┐
 │  WorkoutEngine    │ (v2 modular)
 │  ├─ FatigueAlgo   │
 │  ├─ VolumeAlgo    │
 │  ├─ ExerciseSel   │
 │  ├─ MuscleBalance │
 │  └─ Templates     │
 └────────┬─────────┘
          │
          ▼
 ┌──────────────────┐
 │ progressionEngine │──── recoveryEngine
 └──────────────────┘
```

### 4.2 Health Monitoring

```
 SensorFusionEngine (10Hz)
    ├─ Accelerometer
    ├─ Gyroscope
    └─ Pedometer
         │
         ▼
 StepCounterEngine ─── HealthMonitor ─── derivedMetricsService
                                              │
                                              ▼
                               BackgroundHealthEngine (orchestrator)
                                  ├─ 5min: data collection
                                  ├─ 30min: AnomalyDetector
                                  ├─ daily: DailyHealthSummary
                                  └─ weekly: WeeklyReport
                                              │
                                              ▼
                                    SleepAnalysisEngine
```

### 4.3 AI & Behavioral

```
 User Query
     │
     ▼
 IntentRouter (NLP classification)
     │
     ├─ COACH ──── DualAIEngine (COACH personality)
     ├─ PROFESSOR ─ DualAIEngine (PROFESSOR personality)
     ├─ HEALTH ─── RealisticHealthEngine
     ├─ WORKOUT ── workoutGenerator
     └─ GENERAL ── template response
          │
          ▼
 aiProvider (Grok → Groq → OpenRouter fallback)
          │
          ▼
 AdaptiveMemoryEngine (persistent context)
 UserStateEngine (fatigue, streak, consistency)
 BehavioralSignalEngine (timing, preferences)
 ConsistencyClassifier (workout patterns)
```

---

## 5. Data Layer

### 5.1 SQLite Tables (30+ active)

| Group | Tables |
|-------|--------|
| **Exercise Catalogue** | exercises, exercise_muscles, exercise_equipment, exercise_training_types, exercise_images, exercise_translations |
| **User State** | user_profile, user_equipment, user_injuries, muscle_fatigue, user_interests, user_personal_goals |
| **Workout Sessions** | workout_sessions, session_exercises, progress_records, workout_streaks |
| **Subscription** | subscription_state, trial_state, app_state |
| **Activity/Health** | daily_steps, jog_sessions, audio_settings, body_craft_algorithms, heart_rate_readings |
| **Encrypted** | encrypted_health_data, encrypted_ai_conversations, encrypted_notes, health_alerts |
| **FitMind** (deprecated) | fitmind_documents, fitmind_reading_sessions, fitmind_annotations, fitmind_flashcards, fitmind_reading_goals, fitmind_reading_streaks |
| **Health Monitoring** | anomaly_log, daily_health_summaries, document_content_hashes |

### 5.2 Cache Layer

| Cache | File | Type | Scope |
|-------|------|------|-------|
| QueryCache | `src/database/queryCache.ts` | TTL (5min) | DB queries |
| ComputationCache | `src/engines/ComputationCache.ts` | TTL | Engine computations |
| TranslationRegistry | `src/i18n/TranslationRegistry.ts` | LRU (10k) | i18n lookups |
| CacheStoreService | `src/services/cacheStoreService.ts` | Persistent | General |

### 5.3 Durability Pipeline

```
Write Request → WriteAheadLog → SQLite → Snapshot (periodic)
                     │                         │
                     └── On crash: WAL replay ──┘
                                   │
                              RecoveryService
                                   │
                           DatabaseLifecycle
                          (integrity validation)
```

---

## 6. Security Architecture

```
┌───────────────────────────────┐
│       Authentication          │
│  Biometric → Passcode         │
│  5 attempts → exponential     │
│  backoff → emergency wipe     │
│  30-min session expiry        │
├───────────────────────────────┤
│       Encryption              │
│  AES-256-GCM v3              │
│  PBKDF2-SHA256 100k iter     │
│  SecureStore for master key  │
│  Auto-migrate v1→v2→v3      │
├───────────────────────────────┤
│     Protected Data            │
│  encrypted_health_data        │
│  encrypted_ai_conversations   │
│  encrypted_notes              │
│  health_alerts                │
├───────────────────────────────┤
│    Access Control             │
│  PremiumGate (5 screens)      │
│  SubscriptionManager          │
│  RevenueCat entitlements      │
│  24h offline grace            │
│  Clock tamper detection       │
├───────────────────────────────┤
│  Rate Limiting                │
│  Biometric: 5/60s             │
│  Passcode: 10/5min            │
│  AI: 30/5min                  │
│  Destructive: 1/10min         │
└───────────────────────────────┘
```

---

## 7. External Service Integration

| Service | Package | Purpose | Status |
|---------|---------|---------|--------|
| RevenueCat | `react-native-purchases` | Subscriptions, receipts, entitlements | **ACTIVE** |
| PostHog | `posthog-react-native` | Analytics, session replay | **ACTIVE** |
| Sentry | `@sentry/react-native` | Crash reporting, error monitoring | **ACTIVE** |
| Grok/Groq/OpenRouter | custom (`aiProvider.ts`) | AI chat (fallback chain) | **ACTIVE** |
| HealthKit | `react-native-health` | iOS health data sync | **ACTIVE** |
| Health Connect | `react-native-health-connect` | Android health data sync | **DISABLED** |
| expo-local-authentication | native | Biometric auth | **ACTIVE** |
| expo-speech | native | TTS workout coaching | **ACTIVE** |
| expo-sensors | native | Accelerometer + Gyroscope | **ACTIVE** |
| expo-location | native | GPS for jog tracking | **ACTIVE** |

---

## 8. Data Flows

### 8.1 App Launch

1. `_layout.tsx` mounts provider hierarchy
2. `DatabaseContext`: initializeDatabase() → schema → migrations → seeding
3. `AuthContext`: restore session from SecureStore → biometric check
4. `ThemeContext`: load preference from app_state
5. `LanguageContext`: load language, preload exercise translations
6. WAL service: init, check for unfinished replays
7. SnapshotService: check snapshot schedule
8. RecoveryService: check for corruption, repair if needed
9. Route to appropriate screen (splash → onboarding/dashboard)

### 8.2 Workout Lifecycle

1. User taps "Start Workout" → `useFitQuestWorkout` hook
2. `workoutGenerator.generateWorkout()` reads profile, fatigue, exercises, equipment
3. Pipeline: fatigue filtering → goal targeting → muscle balancing → volume prescription
4. `warmupCooldownGenerator` adds warmup/cooldown
5. Session stored in `workout_sessions` + `session_exercises`
6. Timer per exercise → audio cues → sensor fusion for reps
7. Completion → XP award → streak update → snapshot → confetti

### 8.3 AI Conversation

1. User types in Coach screen → IntentRouter classifies intent
2. UserStateEngine aggregates context (fatigue, streak, goals)
3. DualAIEngine selects personality → template + API augmentation
4. Conversation encrypted → `encrypted_ai_conversations`
5. AdaptiveMemoryEngine updates coaching context

### 8.4 Subscription Check

1. SubscriptionManager checks RevenueCat entitlements
2. Offline fallback to local `trial_state` table
3. State machine: RESOLVING → TRIAL_ACTIVE / SUBSCRIBED / EXPIRED
4. PremiumGate reads `accessState` from SubscriptionContext
5. 5 screens gated: fitquest, coach, health-dashboard, craft-my-body, meal-prep

---

## 9. Dependency Graph

```
Presentation ─── depends on ───→ State, Domain, i18n
State ────────── depends on ───→ Data, Security
Domain ───────── depends on ───→ Data, Security
Data ─────────── depends on ───→ Security
Security ─────── depends on ───→ (none)
Platform ─────── depends on ───→ State, Data
i18n ─────────── depends on ───→ Data
```

---

## 10. Singleton Registry

| Singleton | File | Scope |
|-----------|------|-------|
| `encryptedDB` | `src/security/EncryptedDatabase.ts` | Data encryption |
| `bioAuth` | `src/security/BiometricAuth.ts` | Biometric auth |
| `sensorFusion` | `src/engines/SensorFusionEngine.ts` | Sensor data fusion |
| `healthMonitor` | `src/engines/HealthMonitor.ts` | Health tracking |
| `anomalyDetector` | `src/engines/AnomalyDetector.ts` | Anomaly detection |
| `sleepEngine` | `src/engines/SleepAnalysisEngine.ts` | Sleep analysis |
| `backgroundHealth` | `src/engines/BackgroundHealthEngine.ts` | Background health orchestrator |
| `dualAI` | `src/engines/DualAIEngine.ts` | AI personalities |
| `intentRouter` | `src/engines/IntentRouter.ts` | NLP intent routing |
| `userStateEngine` | `src/engines/UserStateEngine.ts` | User state aggregation |
| `timerService` | `src/services/timerService.ts` | Workout timers |
| `audioService` | `src/services/audioService.ts` | TTS coaching |
| `dataSync` | `src/services/dataSyncService.ts` | Cross-component sync |
| `walService` | `src/services/WriteAheadLogService.ts` | Write-ahead logging |
| `snapshotService` | `src/services/SnapshotService.ts` | DB snapshots |
| `recoveryService` | `src/services/RecoveryService.ts` | Crash recovery |
| `mutationQueue` | `src/services/mutationQueueService.ts` | Offline mutation queue |
| `systemGuard` | `src/services/SystemGuard.ts` | System health |
| `subscriptionManager` | `src/purchases/SubscriptionManager.ts` | Subscription state |
| `translationRegistry` | `src/i18n/TranslationRegistry.ts` | Translation cache |

---

## 11. Build & CI

| Tool | Config | Details |
|------|--------|---------|
| TypeScript | `tsconfig.json` | strict: true, noUncheckedIndexedAccess: true |
| Metro | `metro.config.js` | Standard Expo Metro config |
| Babel | `babel.config.js` | Reanimated plugin LAST |
| ESLint | `eslint.config.js` | Ratcheted at 804 warnings |
| Prettier | `.prettierrc` | Enforced in CI |
| CI | GitHub Actions | tsc → eslint → prettier → vitest |
| EAS | `eas.json` | Android primary, dev-client for native modules |

---

## 12. Translation Coverage

| Tier | Keys | Languages | Coverage |
|------|------|-----------|----------|
| UI Strings | 648 | 15 | 100% (all keys in all languages) |
| Exercise Data | 3,312 exercises | 14 (en excluded — source) | 100% (46,368 translations) |
| Runtime | TranslationRegistry LRU 10k | — | O(1) lookups, 14M ops/sec |

**Languages**: English, Afrikaans, isiZulu, isiXhosa, Sesotho, Spanish, French, German, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Swahili
