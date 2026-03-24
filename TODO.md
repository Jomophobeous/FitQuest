# FitQuest Mobile — TODO / Progress

Last updated: 2026-02-18

## Status legend
- ✅ completed
- 🔁 in-progress
- ⏳ planned / backlog

---

## Active Sprint (2026-02-18)

### P0 — Critical Fixes (DONE)
- ✅ Fix expo-auth-session Metro crash (missing expo-application) — added metro.config.js extraNodeModules resolver
- ✅ Fix FitMind Library "Coming Soon" placeholder — replaced with functional library wired to FitMindService
- ✅ Fix Dashboard discoverability — added quick-access tiles for Health, Analytics, Coach, Meal Prep, Exercises, My Workouts
- ✅ Fix pdf.viewer.tsx getConstants error — removed broken import causing null reference
- ✅ Fix FitMind route unmatched error — added fitmind-reader route export
- ✅ Fix Google OAuth compliance — offline-first flow skips OAuth for new users without backend

### P1 — Critical Wiring (DONE)
- ✅ Wire FitMind Library → FitMindService CRUD (documents, streaks, flashcards)
- ✅ Wire FitMind Library → Reader navigation (router.push with document ID)
- ✅ Start BackgroundHealthEngine at app launch (periodic health collection, anomaly detection)
- ✅ Wire IntentRouter + DualAI into Coach (PROFESSOR queries route to DualAIEngine)
- ✅ Add biometric settings to Profile (fingerprint icon, availability check, auth test)
- ✅ Add health sync error telemetry viewer to Profile (compact error display with dismiss)

### P1.5 — Security Hardening (DONE)
- ✅ Replace all Math.random() with expo-crypto for cryptographic randomness
- ✅ Dead code removal across engines and services
- ✅ CI gate validation (typecheck + ops + perf + notifications + meal-prep)

### P2 — Feature & Quality Sprint (DONE)
- ✅ Medical disclaimer system — MedicalDisclaimer component on health-dashboard, nutrition-calculator, craft-my-body
- ✅ Battery-aware background tasks — expo-battery integration, NORMAL/LOW/CRITICAL/CHARGING tiers with dynamic interval throttling
- ✅ Hardcoded color cleanup — ~130+ replacements across 7 major screen files, 5 new theme tokens (purple, indigo, pink, blue, overlay)
- ✅ Analytics screen wired to real SQLite data (workout_sessions, daily_steps, jog_sessions, streaks, XP, muscle heatmap, PRs, calendar)
- ✅ Input validation module (src/utils/validation.ts) — numeric range checks, email regex, password strength, name validation, sanitizers
- ✅ Input validation wired into: onboarding (weight/height), craft-my-body (height/weight/age), register (email/password/name), create-workout (reps/name maxLength), fitmind-library (content maxLength), fitmind-reader (chat maxLength)
- ✅ Rate limiting module (src/utils/rateLimiter.ts) — sliding-window rate limiter with lockout, 6 predefined profiles
- ✅ Rate limiting wired into: login (email sign-in), fitmind-reader (AI queries)
- ✅ Test coverage — 95 tests across 9 files, all passing:
  - RealisticHealthEngine (36 tests: BMR, TDEE, metabolic profile, BMI, macros, HR zones, calories, hydration, recovery, 1RM, working weights, activity types)
  - Validation utilities (31 tests: numeric, email, password, name, sanitizers)
  - Rate limiter (11 tests: sliding window, lockout, reset, peek, format)
  - Prior test suites maintained (loggerRedaction, securityPolicy, phaseFoundation, progressionEngine, etc.)
- ✅ Vitest config with Expo native module mocks (expo-crypto, expo-sqlite, expo-battery, expo-sensors, expo-secure-store, etc.)

### P2.5 — Phase 4-6 Integration Master Plan (DONE)
- ✅ Feature flags system (src/services/featureFlags.ts) — SQLite-persisted flags with app boot initialization
- ✅ Analytics data service (src/services/analyticsDataService.ts) — 8 fetch functions extracted from UI
- ✅ Smoke test utilities (src/services/smokeTestUtils.ts) — grouped tests for database, workout, health, auth, reader, navigation
- ✅ Release verification script (scripts/verify-release.mjs) — pre-release checklist runner
- ✅ Migration rollback playbook (docs/MIGRATION_ROLLBACK_PLAYBOOK.md) — disaster recovery procedures
- ✅ Theme compliance fixes — hardcoded colors in workout.tsx, analytics.tsx converted to theme system

### P3 — Polish & Release Gate
- ✅ Wire SensorFusion into Move screen (already wired — useSensorFusion + activity display + confidence + start/stop toggle)
- ⏳ Physical device notification delivery verification
- ⏳ Google OAuth live verification on Android device
- ⏳ Staged rollout execution + real-device sweep sign-offs
- ⏳ External legal counsel review
- ⏳ Store console policy URL entry (App Store Connect + Google Play)

---

## Workspace Repository Sync — NEW INITIATIVE

**Reference**: [docs/WORKSPACE_REPO_SYNC_PLAN.md](docs/WORKSPACE_REPO_SYNC_PLAN.md)

### Sync Phase 1: Exercise Database Enhancement (HIGH)
- ⏳ Import 870+ exercises from workspace-repos/exercise-content/free-exercise-db
- ⏳ Schema migration v10 (force_type, mechanic, exercise_images table)
- ⏳ Category mapping script (strength→building_muscle, etc.)
- ⏳ Copy exercise images to assets/exercises/
- **Estimated**: 2 weeks

### Sync Phase 2: Workout Generator Restructure (HIGH)
- ⏳ Extract selectors from monolithic workoutGenerator.ts (602 lines)
- ⏳ New modular architecture (ExerciseSelector, MuscleBalancer, ProgressionSelector)
- ⏳ Enhanced fatigue model (exponential decay with muscle-specific λ)
- ⏳ Volume landmarks (MV/MEV/MAV/MRV tracking)
- ⏳ A/B testing via feature flags
- **Estimated**: 3 weeks

### Sync Phase 3: Native Health Integration (DEFERRED → v3.0)
- ⏸️ Android Health Connect adapter — **built but disabled** (`HEALTH_SYNC` flag = false)
- ⏳ iOS HealthKit adapter (react-native-health)
- ✅ Unified HealthDataSource interface — built
- ✅ Permission request UI flow — built (removed from onboarding, available when flag re-enabled)
- **Status**: Adapter code complete, gated by feature flag. Native `lateinit` crash blocks production use.
- **Estimated**: Re-enable after react-native-health-connect stable fix

### Sync Phase 4: Analytics Visualization (MEDIUM)
- ⏳ Victory Native integration
- ⏳ Workout trend line charts
- ⏳ Muscle distribution pie charts
- ⏳ Interactive date range selectors
- **Estimated**: 1 week

### Sync Phase 5: Enhanced Move Module (MEDIUM)
- ⏳ GPS-based Haversine distance calculation
- ⏳ Live pace display (current/average/best)
- ⏳ Elevation gain tracking
- ⏳ Step stride estimation from height
- **Estimated**: 2 weeks

### Sync Phase 6: Document Reader Overhaul ✅ COMPLETE
- ✅ Native PDF viewer (react-native-pdf) — PDFReader.tsx with WebView fallback
- ✅ EPUB support (epub.js) — EPUBReader.tsx with CFI persistence
- ✅ Unified reader architecture — ReaderFactory pattern
- ✅ ArticleReader + TextReader components
- **Completed**: 2026-02-18

---

## AI Bot Enhancement Initiative — REVISED (2026-02-18)

**Reference**: [docs/AI_BOT_ENHANCEMENT_STRATEGY.md](docs/AI_BOT_ENHANCEMENT_STRATEGY.md)

**Direction**: Enhance template-based bot WITHOUT local LLM — keep it lightweight, available to ALL users

### Key Discovery ✅
FitQuest already has sophisticated neural models bundled (~143MB):
- NeuralSummarizer, SemanticSearch, KnowledgeGraph (Professor)
- TransformerFitCoach (Coach)
- NeuralIntentRouter (Intent classification)

**The opportunity is INTEGRATION, not new models.**

### AI Phase 1: FSRS Flashcard Integration ✅ COMPLETE (2026-02-18)
- ✅ Install ts-fsrs package v5.2.3 (MIT, ~50KB)
- ✅ Create `src/fitmind/FSRSService.ts` wrapper
- ✅ Schema v11 migration: fitmind_flashcards → FSRS fields (stability, state, due, lapses, learning_steps)
- ✅ Auto-migrate existing SM-2 cards to FSRS on schema upgrade
- ✅ Update FitMindService API: reviewFlashcardFSRS(), previewFlashcardReview(), getFlashcardRetrievability()
- **Impact**: 40% better retention vs SM-2

### AI Phase 2: Wire Neural Models into DualAIEngine ✅ COMPLETE (2026-02-18)
- ✅ Wire NeuralSummarizer → real extractive summaries (neural or TF-IDF fallback)
- ✅ Wire SemanticSearch → document Q&A via HNSW vector index
- ✅ Wire KnowledgeGraph → related topics via BFS traversal
- ✅ Add `dualAI.indexDocument()` for on-demand indexing
- ✅ Add `FitMindService.indexDocumentForSearch()` for reader integration
- ✅ Extend AIContext.readingContext with documentId, documentContent fields
- **Impact**: Professor now uses bundled neural models for smarter responses

### AI Phase 3: Conversation Memory ✅ COMPLETE (2026-02-18)
- ✅ Auto-load conversation memory in query() if not provided
- ✅ New `ConversationMemory` interface: recentTopics, userPreferences, mentionedExercises, mentionedBooks
- ✅ `loadConversationMemory()` extracts patterns from encrypted conversation history
- ✅ `buildMemoryContextSummary()` generates context for injection
- ✅ Coach: References past sessions, favorite exercises, remembered injuries
- ✅ Professor: Cross-references previous books, revisit suggestions
- ✅ Greeting adapts to days since last interaction
- **Impact**: Bot remembers context across sessions, feels personalized

### AI Phase 4: Expanded Template Library (MED) — 1 week
- ⏳ Add 100+ new COACH templates (sport-specific, time-aware, streak milestones)
- ⏳ Add 50+ new PROFESSOR templates (reading level, document type aware)
- ⏳ Dynamic template selection (avoid repeats, weight by context)
- **Unlock**: Richer, more varied personality

### AI Phase 5: Smart Suggestions (MED) — 1 week
- ⏳ Context-aware quick reply buttons
- ⏳ Fatigue-aware, streak-aware, progress-aware suggestions
- **Unlock**: Quick replies feel intelligent

### Deferred (Future)
| Item | Reason |
|------|--------|
| react-native-executorch | Too heavy, limits device compatibility |
| llama.cpp | Requires significant storage/RAM |
| Cloud AI | Breaks offline-first philosophy |

---

## ⏸️ Deferred Features (v3.0 — Next Major Version)

Features disabled via feature flags. Code remains intact, gated at runtime.

| Feature | Flag | Reason for Deferral | Re-enable When |
|---------|------|---------------------|----------------|
| **Health Connect / Health Sync** | `HEALTH_SYNC = false` | Native `lateinit` crash on permission request. Postinstall Kotlin patch is band-aid. Quarantine system masks but doesn't fix. Adds Google Play compliance burden (Health Connect disclosure). | react-native-health-connect releases stable fix for permission delegate lifecycle; OR replace with direct Health Connect SDK integration |
| **Victory Native Charts** | `VICTORY_CHARTS = false` | Dependency size, not needed for MVP analytics | Analytics Phase 4 visualization sprint |
| **Skia Health Card** | `SKIA_HEALTH_CARD = false` | Experimental visualization, not stable | After Victory charts are validated |
| **AI Phase 4: Expanded Templates** | N/A (not started) | 100+ COACH + 50+ PROFESSOR templates. Quality over quantity — current templates work | Post-launch content sprint |
| **AI Phase 5: Smart Suggestions** | N/A (not started) | Context-aware quick replies. Nice-to-have, not blocking | Post-launch UX iteration |
| **Cloud AI** | N/A | Breaks offline-first philosophy | If/when backend is built |
| **react-native-executorch** | N/A | Too heavy, limits device compatibility | Hardware catches up |
| **llama.cpp** | N/A | Requires significant storage/RAM | If user demand justifies |

### What's NOT Deferred (Fully Functional)
- ✅ **FitMind** (Library + Reader + AI + Flashcards) — fully wired, working
- ✅ **AI Coach / Professor** — template-based + neural models, working
- ✅ **Health Dashboard** — local data (steps, sleep, workouts), working without HC sync
- ✅ **Workout Engine** — generation, progression, recovery, all working
- ✅ **Encrypted DB** — v3 AES-256-GCM, working
- ✅ **Biometric Auth** — working

---

## CI/Verification Gates

All passing as of 2026-02-17:
- ✅ `npm run typecheck` — TypeScript strict mode
- ✅ `npm run verify:ops:readiness` — ops readiness gate
- ✅ `npm run verify:performance:budget` — micro-budget checks
- ✅ `npm run verify:notifications:reliability` — notification wiring
- ✅ `npm run verify:mealprep:text-safety` — meal prep text render safety

---

## Architecture Status

### Wired & Active
| Module | Status | Notes |
|--------|--------|-------|
| Workout Generator | ✅ Active | 788 exercises, fatigue-aware, goal-based |
| Recovery Engine | ✅ Active | Daily tick, deload detection |
| Sensor Fusion | ✅ Active | 10Hz, CNN-LSTM classifier |
| Health Monitor | ✅ Active | Steps, calories, goals |
| Background Health | ✅ Active | 5min collection, 30min anomaly check |
| Anomaly Detector | ✅ Active | Z-score, IQR, multi-metric |
| Sleep Analysis | ✅ Active | Quality scoring, circadian |
| Intent Router | ✅ Active | NLP classification in Coach |
| Dual AI Engine | ✅ Active | COACH + PROFESSOR personalities |
| FitMind Library | ✅ Active | CRUD, import, streaks, flashcards |
| FitMind Reader | ✅ Active | Paginated, annotations, AI chat |
| Encrypted DB | ✅ Active | v3 AES-256-GCM, auto-migration |
| Biometric Auth | ✅ Active | Login + Profile settings |

### Scaffolded (client facades, no backend)
| Module | Status | Notes |
|--------|--------|-------|
| Cloud Backup | ⏳ Facade | Needs backend API |
| OAuth (Google) | ⏳ Facade | Needs device verification |
| Analytics Ingest | ⏳ Facade | Needs server pipeline |
| Social Layer | ⏳ Facade | Toggle only |
| Platform Studio | ⏳ Placeholder | Needs SDK |
| Federation Hub | ⏳ Placeholder | Needs contracts |

---

## Completed Feature Log

### 2026-02-18 — P2 Quality & Security Sprint
- Created `src/utils/validation.ts` — centralised input validation (numeric ranges, email, password strength, name, text sanitizers)
- Created `src/utils/rateLimiter.ts` — sliding-window rate limiter with lockout/cooldown profiles
- Wired input validation into 6 screens: onboarding, craft-my-body, register, create-workout, fitmind-library, fitmind-reader
- Wired rate limiting into login (10 attempts/5min) and fitmind-reader AI queries (30/5min)
- Battery-aware BackgroundHealthEngine: expo-battery integration, 4 tiers (NORMAL/LOW/CRITICAL/CHARGING), dynamic interval throttling, auto-pause on critical battery
- Hardcoded color cleanup: ~130+ replacements across profile, coach, health-dashboard, nutrition-calculator, exercises, dashboard, move screens; 5 new theme tokens (purple, indigo, pink, blue, overlay)
- MedicalDisclaimer component added to health-dashboard, nutrition-calculator, craft-my-body
- Test coverage: 95 tests across 9 test files, all green
  - New: RealisticHealthEngine (36 tests), validation (31 tests), rateLimiter (11 tests)
  - Created vitest.config.ts with Expo native module mocks (9 mock stubs)
- Math.random() → expo-crypto cryptographic randomness (P1.5 security)
- Dead code removal and CI gate validation

### 2026-02-17 — Audit & Wiring Sprint
- Replaced FitMind Library placeholder with real functional CRUD screen
- Added Dashboard quick-access tiles (6 tiles: Health, Analytics, Coach, Meal Prep, Exercises, My Workouts)
- Wired BackgroundHealthEngine startup in app layout
- Integrated IntentRouter + DualAI into Coach screen
- Added biometric settings section to Profile
- Fixed expo-auth-session Metro crash via metro.config.js resolver
- Rewrote OBJECTIVES.md and TODO.md to match actual implementation state

### 2026-02-17 — Earlier
- Notification reliability service + CI gate
- Meal Prep text-safety CI gate
- Performance budget CI gate
- Ops readiness CI gate
- Legal Center with consent versioning
- i18n hardening across core routes
- Meal prep region override in profile
- Replay orchestrator with cooldown

### 2026-02-08
- Schema v8 (heart_rate_readings, anomaly_log, daily_health_summaries)
- AnomalyDetector, SleepAnalysisEngine, BackgroundHealthEngine, IntentRouter
- EncryptedDatabase v3 (AES-256-GCM, auto v1/v2 migration)
- BiometricAuth (5-attempt lockout, 30-min session, emergency wipe)
- DocumentImportPipeline (validation, dedup, quota enforcement)
- ReadingSessionTracker (state machine, focus scoring, idle detection)
- Health Dashboard screen

### 2026-02-07
- SensorFusionEngine (accelerometer + gyroscope + pedometer fusion)
- HealthMonitor (daily tracking, goals, summaries)
- FitMind module (schema, DocumentProcessor, DualAIEngine, FitMindService)
- Security layer (AESEncryption, StorageMigration, AuthContext rewire)

### 2026-02-06
- AI Coach screen glass UI + exercise/meal recommendations
- Profile screen glass UI + XP progress
- Analytics page, Saved Workouts, Meal Prep, Location service
- TTS voice instructions, jog completion modal, XP formula fixes
- 70 new exercise templates, dropdown menu expansion

### Earlier (2025-07 through 2026-01)
- Full glass-morphism UI system (GlassUI.tsx)
- Dashboard, Exercises, Move, FitQuest screen rewrites
- Expo Go readiness, navigation scaffold
- Design tokens, shared components
- Workout loop + XP wiring
