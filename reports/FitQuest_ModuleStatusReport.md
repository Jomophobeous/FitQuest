# FitQuest 2.0 — Module Status Report

> **Version**: 2.3.0 | **Schema**: v20 | **Generated**: 2026-03-25
> **Total Modules**: 178 | **Active**: 156 | **Deprecated**: 16 | **Stubs**: 6

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Total modules/files catalogued | 178 |
| Active (production code) | 156 (87.6%) |
| Deprecated (dead code) | 16 (9.0%) |
| Stubs (placeholder) | 6 (3.4%) |
| UI translation coverage | 100% (648 keys × 15 languages) |
| Exercise translation coverage | 100% (3,312 × 14 = 46,368) |
| AI response translation | Partial — English templates, provider-dependent API |
| Test files | 43 |
| Modules with strong test coverage | 5 areas (security, core workout, health, purchases, i18n) |
| Modules with zero test coverage | 7 areas (context, components, observability, persistence, AI, platform, screens) |

---

## 2. Active Modules

### 2.1 Data Layer

| Module | Path | Files | Tests | Notes |
|--------|------|-------|-------|-------|
| Database | `src/database/` | 13 | 2 | Schema v20, 1700-line migration file, WAL mode |
| Security | `src/security/` | 7 | 5 | AES-256-GCM v3, PBKDF2, biometric. Best-tested module. |
| Persistence | `src/services/` (WAL/Snapshot/Recovery) | 6 | 1 (partial) | WAL + Snapshot + Recovery pipeline. cloudBackup placeholder. |

### 2.2 Domain Engines

| Module | Path | Files | Tests | Notes |
|--------|------|-------|-------|-------|
| Core Workout (v1) | `src/engines/` | 6 | 4 | workoutGenerator, progression, recovery. Well-tested. |
| Workout (v2) | `src/engines/workout/` | 9 | Indirect | Modular rewrite. Used via legacyAdapter. |
| Health Monitoring | `src/engines/` | 7 | 5 | SensorFusion, Anomaly, Sleep, Background. Well-tested. |
| AI & Behavioral | `src/engines/` | 12 | 3 | DualAI, IntentRouter, 10 behavioral engines. Test gap. |
| Supporting | `src/engines/` | 4 | 0 | ComputationCache, transparencyLayer, stateReset |

### 2.3 Services

| Module | Path | Files | Tests | Notes |
|--------|------|-------|-------|-------|
| Core (XP, Timer, Audio) | `src/services/` | 5 | 2 | timerService and audioService untested |
| Observability | `src/services/` | 7 | 1 | Logger redaction tested. Telemetry/crash untested. |
| Health/Fitness | `src/services/` | 10 | 2 | Health Connect disabled. HealthKit active. |
| Exercise Content | `src/services/` | 3 | 0 | exerciseImageService, exerciseInstructionService |
| Data/Cache | `src/services/` | 4 | 0 | QueryCache, MutationQueue, CacheStore |
| Workout Generator | `src/services/workoutGenerator/` | 5 | Indirect | Pipeline + subscription gating |
| System | `src/services/` | 4 | 0 | SystemGuard, LifecycleManager |

### 2.4 Presentation

| Module | Path | Files | Tests | Notes |
|--------|------|-------|-------|-------|
| Screens | `app/` | 31 | Smoke only | 5 tab + 26 hidden/deprecated |
| Components | `src/components/` | 41 | Smoke only | GlassUI, Charts (9), ThemedText |
| Hooks | `src/hooks/` | 6 | 1 | useFitQuestWorkout tested via integration |
| Context Providers | `src/context/` | 4 | 0 | ThemeCtx, LangCtx, DbCtx, AuthCtx |

### 2.5 Platform & Infrastructure

| Module | Path | Files | Tests | Notes |
|--------|------|-------|-------|-------|
| Purchases | `src/purchases/` | 4 | 2 | RevenueCat + PremiumGate hardened |
| i18n | `src/i18n/` | 20 | 1 | Completeness test. LRU 14M ops/sec. |
| AI/ML | `src/ai/` | 10 | 1 | On-device models. TransformerRuntime deprecated. |
| Design | `src/design/` | 1 | 0 | theme-system.ts canonical tokens |
| Utils | `src/utils/` | 6 | 2 | rateLimiter, regionalPricing tested |

---

## 3. Deprecated Modules (Dead Code)

### Screens (3 files)
| File | Status | Reason |
|------|--------|--------|
| `app/fitmind-library.tsx` | Redirects to /dashboard | FitMind cognitive module stripped |
| `app/fitmind-reader.tsx` | Redirects to /dashboard | FitMind reader stripped |
| `app/professor/index.tsx` | Redirects to /coach | Professor merged into Coach |

### Engines (2 files)
| File | Status | Reason |
|------|--------|--------|
| `src/engines/MindSessionEngine.ts` | Still imported | FitMind meditation sessions removed |
| `src/engines/DistanceEngine.ts` | Still imported | GPS distance — replaced by locationService |

### Services (4 files)
| File | Status | Reason |
|------|--------|--------|
| `src/services/autonomousPolicyRuntime.ts` | Unused | Alfred agent concept, never used |
| `src/services/socialLayerService.ts` | Still imported by profile.tsx | Social features unimplemented |
| `src/services/aiWorkoutService.ts` | Still imported by coach/ | Legacy AI workout API |
| `src/services/syncService.ts` | Test-only imports | Overlaps dataSyncService |

### AI (1 file)
| File | Status | Reason |
|------|--------|--------|
| `src/ai/TransformerRuntime.ts` | Still imported by professor/* | 48MB, too heavy for mobile |

### Components (2 files)
| File | Status | Reason |
|------|--------|--------|
| `src/components/Card.tsx` | Replaced | Use GlassCard from GlassUI |
| `src/components/DatabaseRecoveryScreen.tsx` | Replaced | Auto-recovery via RecoveryService |

### FitMind (11+ files)
| Path | Status | Reason |
|------|--------|--------|
| `src/fitmind/` (entire directory) | Deprecated | 11 files: schema, reader engine, FSRS, web assets, 6 reader components |

### Platform Stubs (3 files)
| File | Status | Reason |
|------|--------|--------|
| `src/platform/phase8AutonomousOperations.ts` | Stub | Empty implementation |
| `src/platform/phase9EcosystemFederation.ts` | Stub | Empty implementation |
| `src/platform/phase10EnterpriseHardening.ts` | Stub | Empty implementation |

---

## 4. Test Coverage Map

### Strong Coverage (5+ tests, critical paths covered)
- **Security** — 5 test files covering all crypto, biometric, and auth paths
- **Core Workout** — 4 test files covering generator, progression, recovery, edge cases
- **Health Monitoring** — 5 test files covering anomaly, sleep, health monitor, background
- **Purchases** — 2 test files covering subscription manager and premium gate
- **i18n** — 1 comprehensive completeness test (all keys × all languages)

### Partial Coverage (some paths tested)
- **AI/State Engines** — 3 tests for 12 engines
- **Core Services** — 2 tests for 5 services (XP only)
- **Health/Fitness Services** — 2 tests for 10 services
- **Hooks** — 1 test for 6 hooks
- **Database** — 2 tests for 13 files

### Zero Coverage (no tests)
- **Context Providers** — 0 tests for 4 critical providers
- **Components** — Smoke tests only (no unit tests)
- **Observability** — 1 logger test for 7 services
- **Persistence** — 1 partial test for 6 services
- **AI Module** — 1 test for 10 files
- **Platform** — 0 tests
- **Screens** — 0 unit tests

---

## 5. Translation Coverage

| Area | Languages | Keys/Items | Coverage | Gap |
|------|-----------|------------|----------|-----|
| UI Strings | 15 | 648 | 100% | None |
| Exercise Data | 14 (+en source) | 3,312 × 14 = 46,368 | 100% | None |
| AI Templates | 1 (en) | ~100 templates | English only | AI responses not localized |
| Error Messages | 15 | via t() | 100% | None |
| Legal Text | 1 (en) | privacy-policy, terms | English only | Not localized |
| Onboarding | 15 | via t() | 100% | None |

---

## 6. Import Hygiene Issues

Deprecated modules that are still imported by active code (creates dead weight in bundle):

| Deprecated | Imported By | Impact |
|------------|-------------|--------|
| `socialLayerService.ts` | `app/profile.tsx` | Dead import |
| `aiWorkoutService.ts` | `app/coach/index.tsx` | Dead import |
| `TransformerRuntime.ts` | `app/professor/index.tsx` | 48MB dead weight (tree-shaking may help) |
| `MindSessionEngine.ts` | `src/components/MindExerciseView.tsx` | Dead import |
| `DistanceEngine.ts` | `src/components/JogMap.tsx` | Dead import |
