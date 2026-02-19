# FitQuest — Multi-Phase Execution Plan

Last updated: 2026-02-18

## Phase Dependency Map

Phase 1 → Phase 2 → Phase 3
          ↓
        Phase 4 → Phase 5
                      ↓
                   Phase 6
                      ↓
                   Phase 7-10
                      ↓
     Workspace Repo Sync (NEW)

---

## Phase 1 — Local Dominance ✅ COMPLETE / LOCKED

Delivered:
- Deterministic workout generator + 788 exercises (6 categories)
- SQLite schema v9 with auto-migration chain (v0→v9)
- Sensor fusion (accelerometer + gyroscope + pedometer) at 10Hz
- Activity classification (STATIONARY/WALKING/RUNNING/CYCLING/EXERCISE)
- Health engines: anomaly detection, sleep analysis, recovery scoring, background monitoring
- AES-256-GCM encryption for health/AI data, biometric auth, PBKDF2 passcode
- FitMind cognitive fitness module (documents, reader, dual AI, flashcards, SM-2 spaced repetition)
- IntentRouter NLP for intent classification + entity extraction
- 15-language i18n, legal center, consent versioning
- Meal prep with GPS-based food filtering + manual region override
- RevenueCat subscription enforcement with offline grace

---

## Phase 2 — State Persistence 🔁 FOUNDATIONS BUILT

Client-side ready:
- Cloud backup/restore service, replay orchestrator, deferred mutation queue
- Auth scaffolding (biometric + passcode + Google OAuth stub)
- Cache store service (in-memory + SQLite persistent layers)

Still needed:
- [ ] Deploy minimal backend CRUD API (Supabase recommended)
- [ ] Real Google OAuth verification on physical device
- [ ] End-to-end backup/restore test pass

---

## Phase 3 — Cross-Device Continuity ⏳ SCAFFOLDED

Built: sync-on-demand queue, replay handlers, conflict policy design
Needed: multi-device sync, server reconciliation, real-time option

---

## Phase 4 — Aggregated Intelligence ✅ COMPLETE

Built:
- Feature flags system (src/services/featureFlags.ts) with SQLite persistence
- Analytics data service layer (src/services/analyticsDataService.ts)
- Smoke test utilities (src/services/smokeTestUtils.ts)
- Release verification script (scripts/verify-release.mjs)
- Migration rollback playbook (docs/MIGRATION_ROLLBACK_PLAYBOOK.md)

---

## Phase 5 — Adaptive Systems 🔁 IN PROGRESS

Built: adaptive training profiles, fatigue-aware generation, anomaly detection, sleep scoring
Needed: personalized progression curves, per-user calibration, user-facing "why" explanations

---

## Phases 6-10 — ⏳ SCAFFOLDED

Phase 6 (Social): opt-in toggle built, needs leaderboard/guild implementation
Phase 7 (Platform): Studio screen exists, needs SDK/API
Phase 8 (Autonomous): Center screen exists, needs policy engine
Phase 9 (Federation): Hub screen exists, needs contracts
Phase 10 (Hardening): CI gates exist (ops readiness, perf budget, quality), needs SLO/monitoring

---

## NEW: Workspace Repository Sync Plan 🔁 PLANNED

Reference: [docs/WORKSPACE_REPO_SYNC_PLAN.md](docs/WORKSPACE_REPO_SYNC_PLAN.md)

### Sync Phase 1: Exercise Database Enhancement (HIGH PRIORITY)
- [ ] Import 870+ exercises from free-exercise-db
- [ ] Schema migration v10 (force_type, mechanic, exercise_images)
- [ ] Category mapping (strength→building_muscle, etc.)
- [ ] Exercise images to assets/exercises/

### Sync Phase 2: Workout Generator Restructure (HIGH PRIORITY)
- [ ] Extract selectors from monolith
- [ ] New modular architecture (src/engines/workout/)
- [ ] Enhanced fatigue model (exponential decay)
- [ ] Volume landmarks tracking (MV/MEV/MAV/MRV)
- [ ] A/B testing via feature flags

### Sync Phase 3: Native Health Platform Integration (MEDIUM PRIORITY)
- [ ] Android Health Connect adapter
- [ ] iOS HealthKit adapter
- [ ] Unified HealthDataSource interface
- [ ] Wearable sync (Fitbit, Garmin, Apple Watch)

### Sync Phase 4: Analytics Visualization (MEDIUM PRIORITY)
- [ ] Victory Native charts integration
- [ ] Workout duration trend chart
- [ ] Muscle group distribution pie
- [ ] Interactive date range selector

### Sync Phase 5: Enhanced Move Module (MEDIUM PRIORITY)
- [ ] GPS-based distance tracking (Haversine)
- [ ] Live pace display (current/average/best)
- [ ] Elevation gain tracking
- [ ] Step stride estimation

### Sync Phase 6: Document Reader Overhaul ✅ COMPLETE
- [x] Native PDF viewer (react-native-pdf) — PDFReader.tsx with WebView fallback
- [x] EPUB support (epub.js) — EPUBReader.tsx with CFI persistence  
- [x] Unified reader architecture — ReaderFactory pattern at src/fitmind/readers/
- [x] ArticleReader + TextReader components

---

## AI Bot Enhancement Initiative — REVISED (2026-02-18) 🔁 IN PROGRESS

**Reference**: [docs/AI_BOT_ENHANCEMENT_STRATEGY.md](docs/AI_BOT_ENHANCEMENT_STRATEGY.md)

**Direction**: Enhance template-based bot WITHOUT local LLM — keep it lightweight, universally accessible

### Key Discovery ✅
FitQuest already has sophisticated neural models bundled (~143MB):
| Model | Location | Purpose |
|-------|----------|---------|
| NeuralSummarizer | `src/ai/professor/` | Extractive document summarization |
| SemanticSearch | `src/ai/professor/` | Dense retrieval + HNSW index |
| KnowledgeGraph | `src/ai/professor/` | Entity extraction & relationships |
| TransformerFitCoach | `src/ai/coach/` | Neural workout generation |
| NeuralIntentRouter | `src/ai/intent/` | 8-layer transformer intent classification |

**The opportunity is INTEGRATION, not new models.**

### AI Phase 1: FSRS Flashcard Algorithm ✅ COMPLETE (2026-02-18)
- [x] Install `ts-fsrs` package v5.2.3 (MIT)
- [x] Create `FSRSService.ts` wrapper service with scheduleReview, previewReview, getRetrievability, forgetCard APIs
- [x] Schema v11 migration: Add FSRS fields (stability, state, due, scheduled_days, last_review, lapses, learning_steps)
- [x] Auto-migrate existing SM-2 flashcards to FSRS format
- [x] Update FitMindService with new FSRS methods
- **Impact**: 40% better retention vs SM-2 | **Completed**: 2026-02-18

### AI Phase 2: Wire Neural Models into DualAIEngine (HIGH)
- [ ] Wire NeuralSummarizer → real extractive summaries
- [ ] Wire SemanticSearch → document Q&A with citations
- [ ] Wire KnowledgeGraph → entity-aware responses
- **Impact**: Unlock existing bundled models | **Est**: 2 weeks

### AI Phase 3: Conversation Memory (MED)
- [ ] Load last N conversations on chat open
- [ ] Build conversation summary for context injection
- [ ] Track user preferences + entity memory
- **Impact**: Bot remembers context across sessions | **Est**: 1 week

### AI Phase 4: Expanded Template Library (MED)
- [ ] Add 100+ new COACH templates (sport-specific, time-aware, streak milestones)
- [ ] Add 50+ new PROFESSOR templates (reading level, document type aware)
- [ ] Dynamic template selection (avoid repeats, weight by context)
- **Impact**: Richer, more varied personality | **Est**: 1 week

### AI Phase 5: Smart Suggestions (MED)
- [ ] Context-aware quick reply buttons
- [ ] Fatigue-aware, streak-aware, progress-aware suggestions
- **Impact**: Quick replies feel intelligent | **Est**: 1 week

### Deferred (Future — When Technology Benefits Everyone)
| Item | Reason for Deferral |
|------|---------------------|
| react-native-executorch | Too heavy, limits device compatibility |
| llama.cpp | Requires significant storage/RAM |
| Cloud AI | Breaks offline-first philosophy |

---

## Current Sprint — Active Objectives (2026-02-18)

### P0 — Blocking bugs ✅ COMPLETE
- [x] Fix expo-auth-session Metro crash (expo-application resolution via metro.config.js extraNodeModules)
- [x] Fix FitMind Library "Coming Soon" placeholder (replaced with real functional library)
- [x] Fix pdf.viewer.tsx getConstants error (removed broken import)
- [x] Fix FitMind route unmatched error (added fitmind-reader route export)
- [x] Fix Google OAuth compliance (offline-first flow for first-time users)

### P1 — Critical wiring ✅ COMPLETE
- [x] Wire FitMind Library to real FitMindService CRUD
- [x] Wire FitMind Reader navigation from Library
- [x] Start BackgroundHealthEngine at app launch
- [x] Wire IntentRouter + DualAI into Coach screen
- [x] Add Dashboard quick-access tiles (Health, Analytics, Coach, Meal Prep, Exercises, My Workouts)
- [x] Add biometric settings to Profile
- [x] Add health sync error telemetry viewer to Profile

### P1.5 — Security hardening ✅ COMPLETE
- [x] Replace Math.random() with expo-crypto in differential privacy noise (CRITICAL — FederatedLearning.ts)
- [x] Replace Math.random() with Crypto.randomUUID() for device/bundle IDs (EncryptedCloudSync.ts, FederatedLearning.ts)
- [x] Replace Math.random() with Crypto.randomUUID() for session/entity IDs (SleepAnalysisEngine.ts, bodyCraftEngine.ts)
- [x] Guard security console.logs with __DEV__ (AESEncryption.ts, BiometricAuth.ts, EncryptedDatabase.ts)
- [x] Remove dead Apollo wrapper hooks (useGraphQL.ts)

### P2 — Feature & Quality Sprint ✅ COMPLETE
- [x] Medical disclaimer system — MedicalDisclaimer on health-dashboard, nutrition-calculator, craft-my-body
- [x] Battery-aware background tasks — expo-battery 4-tier throttling (NORMAL/LOW/CRITICAL/CHARGING)
- [x] Hardcoded color cleanup — ~130+ replacements across 7 files, 5 new theme tokens
- [x] Analytics screen wired to real SQLite data (workout_sessions, daily_steps, jog_sessions, XP, streaks, muscle heatmap)
- [x] Input validation module (src/utils/validation.ts) — numeric ranges, email regex, password strength, name validation, sanitizers
- [x] Input validation wired into: onboarding, craft-my-body, register, create-workout, fitmind-library, fitmind-reader
- [x] Rate limiting module (src/utils/rateLimiter.ts) — sliding-window with lockout, 6 predefined profiles
- [x] Rate limiting wired into: login (email sign-in), fitmind-reader (AI queries)
- [x] Test coverage — 95 tests across 9 files (RealisticHealthEngine 36, validation 31, rateLimiter 11, plus 6 prior suites)
- [x] Vitest config with Expo native module mocks

### P3 — Polish & Release Gate
- [ ] Wire SensorFusion into Move screen (replace basic pedometer)
- [ ] Physical device notification delivery verification
- [ ] Google OAuth live verification on Android device
- [ ] Staged rollout execution + real-device sweep sign-offs
- [ ] External legal counsel review before production release
- [ ] Store console policy URL entry (App Store Connect + Google Play)
