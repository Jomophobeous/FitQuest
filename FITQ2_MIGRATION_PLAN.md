# FitQ2 Migration Plan — Codebase Reset

**Status**: AWAITING REVIEW  
**Date**: 2026-04-03  
**Author**: Alfred Ω

---

## Executive Summary

**Current state**: ~117K lines of actual code (src/) + ~726K lines of exercise translations + ~22K lines of screens (app/) = ~865K total lines. 51 docs, 51 reports, 108 scripts, 56 tests, 33 legacy screens, 108 screenshots.

**Target state**: A lean FitQ2 repo containing ONLY the core features, estimated ~15-25K lines of actual code + translations as needed.

**Core features (per user directive)**: AI Coach, Workout screen, Move screen, Progress screen, Analytics, Dashboard, Servers, Database (images + logic + instructions), Profile screen with settings, Configs, and all infrastructure necessary to keep the app running.

---

## Phase 1 — Codebase Autopsy Results

### Module Categorization

#### CORE — Ships to FitQ2 main branch (directly required)

| Module | Path | Lines | Purpose |
|--------|------|-------|---------|
| **Database schema** | `src/database/schema.ts` | 1,790 | Table definitions, migrations |
| **Database service** | `src/database/service.ts` | 2,919 | All CRUD operations |
| **Database types** | `src/database/types.ts` | 459 | Enums, type definitions |
| **Database seed** | `src/database/seed.ts` | 1,520 | Exercise catalogue seed |
| **Database index** | `src/database/index.ts` | 127 | Init orchestrator |
| **Database lifecycle** | `src/database/DatabaseLifecycle.ts` | 335 | DB lifecycle management |
| **Exercise generator** | `src/database/exerciseGenerator.ts` | 1,987 | Core exercise generation |
| **External exercises data** | `src/database/external-exercises-data.ts` | 28,796 | Exercise catalogue (DATA) |
| **External seed** | `src/database/external-seed.ts` | 136 | External exercise seeding |
| **Workout generator** | `src/engines/workoutGenerator.ts` | 909 | Core workout creation |
| **Workout engine** | `src/engines/workout/` | ~1,494 | Modular workout system |
| **Recovery engine** | `src/engines/recoveryEngine.ts` | 480 | Fatigue/recovery tracking |
| **Progression engine** | `src/engines/progressionEngine.ts` | 312 | Difficulty progression |
| **Progression parsing** | `src/engines/progressionParsing.ts` | 19 | Rep parsing utility |
| **Warmup/cooldown** | `src/engines/warmupCooldownGenerator.ts` | 209 | Warmup/cooldown generation |
| **Realistic health** | `src/engines/RealisticHealthEngine.ts` | 579 | BMR, TDEE, calorie calculations |
| **Readiness engine** | `src/engines/ReadinessEngine.ts` | 505 | Workout readiness scoring |
| **Dual AI engine** | `src/engines/DualAIEngine.ts` | 2,734 | AI Coach + Professor |
| **Step counter** | `src/engines/StepCounterEngine.ts` | 505 | Step counting for Move |
| **Distance engine** | `src/engines/DistanceEngine.ts` | 505 | Distance calculation for Move |
| **Sensor fusion** | `src/engines/SensorFusionEngine.ts` | 737 | Accelerometer/gyro fusion |
| **Health monitor** | `src/engines/HealthMonitor.ts` | 453 | Daily health tracking |
| **AES encryption** | `src/security/AESEncryption.ts` | 463 | AES-256-GCM crypto |
| **Encrypted database** | `src/security/EncryptedDatabase.ts` | 487 | Encrypted data storage |
| **Biometric auth** | `src/security/BiometricAuth.ts` | 555 | Biometric authentication |
| **Auth service** | `src/security/AuthService.ts` | 478 | Auth flows |
| **Storage migration** | `src/security/StorageMigration.ts` | 145 | SecureStore migration |
| **Security index** | `src/security/index.ts` | 26 | Security barrel |
| **Random ID** | `src/security/randomId.ts` | 12 | Secure ID generation |
| **Theme system** | `src/design/theme-system.ts` | 371 | Design tokens |
| **Motion system** | `src/design/motion.ts` | 77 | Animation constants |
| **Design index** | `src/design/index.ts` | 39 | Design barrel |
| **Theme context** | `src/context/ThemeContext.tsx` | Context | Theme provider |
| **Language context** | `src/context/LanguageContext.tsx` | Context | i18n provider |
| **Database context** | `src/context/DatabaseContext.tsx` | Context | DB provider |
| **Auth context** | `src/context/AuthContext.tsx` | Context | Auth provider |
| **Toast context** | `src/context/ToastContext.tsx` | Context | Toast notifications |
| **Connectivity context** | `src/context/ConnectivityContext.tsx` | Context | Online/offline |
| **XP service** | `src/services/xpService.ts` | 408 | XP tracking |
| **Audio service** | `src/services/audioService.ts` | 865 | Workout audio cues |
| **Timer service** | `src/services/timerService.ts` | 413 | Workout timers |
| **Telemetry** | `src/services/telemetry.ts` | 132 | Basic event logging |
| **Error telemetry** | `src/services/errorTelemetry.ts` | 266 | Error reporting |
| **Crash reporting** | `src/services/crashReporting.ts` | 167 | Sentry integration |
| **Logger** | `src/services/logger.ts` | 84 | App logger |
| **Session tracker** | `src/services/sessionTracker.ts` | 109 | Session lifecycle |
| **Feature flags** | `src/services/featureFlags.ts` | 222 | Module gating |
| **AI provider** | `src/services/aiProvider.ts` | 1,073 | AI API integration |
| **AI workout service** | `src/services/aiWorkoutService.ts` | 479 | AI-based workouts |
| **Auth API** | `src/services/authApi.ts` | 261 | Server auth calls |
| **API base URL** | `src/services/apiBaseUrl.ts` | 42 | API configuration |
| **Data sync service** | `src/services/dataSyncService.ts` | 270 | Data sync events |
| **Exercise image service** | `src/services/exerciseImageService.ts` | 238 | Exercise images |
| **Exercise image map** | `src/services/exerciseImageMap.ts` | 1,443 | Image path mapping (DATA) |
| **Adaptive training** | `src/services/adaptiveTrainingService.ts` | 51 | Training adaptation |
| **Adaptive training math** | `src/services/adaptiveTrainingMath.ts` | 109 | Training math |
| **PostHog service** | `src/services/posthogService.tsx` | 119 | Analytics provider |
| **Smart defaults** | `src/services/smartDefaults.ts` | 100 | Default values |
| **useFitQuestWorkout** | `src/hooks/useFitQuestWorkout.ts` | ~1,050 | Workout lifecycle hook |
| **usePedometer** | `src/hooks/usePedometer.ts` | Hook | Step/jog tracking |
| **useTimer** | `src/hooks/useTimer.ts` | Hook | Timer hook |
| **useAudio** | `src/hooks/useAudio.ts` | Hook | Audio playback |
| **useActionGuard** | `src/hooks/useActionGuard.ts` | Hook | Debounce/mutex |
| **useMountedGuard** | `src/hooks/useMountedGuard.ts` | Hook | Mounted check |
| **useStableCallback** | `src/hooks/useStableCallback.ts` | Hook | Stable ref |
| **usePrefetch** | `src/hooks/usePrefetch.ts` | Hook | Data prefetch |
| **useSystemState** | `src/hooks/useSystemState.ts` | Hook | System state |
| **usePressAnimation** | `src/hooks/usePressAnimation.ts` | Hook | Press animation |
| **useFeedback** | `src/hooks/useFeedback.ts` | Hook | Haptic feedback |
| **useAppReady** | `src/hooks/useAppReady.ts` | Hook | App readiness gate |
| **Subscription manager** | `src/purchases/SubscriptionManager.ts` | 699 | IAP management |
| **Subscription context** | `src/purchases/SubscriptionContext.tsx` | 254 | Subscription provider |
| **Trial onboarding** | `src/purchases/TrialOnboarding.ts` | 199 | Trial flow |
| **i18n translations** | `src/i18n/translations.ts` | 20,120 | All UI strings |
| **Validation utils** | `src/utils/validation.ts` | 205 | Input validation |
| **Responsive utils** | `src/utils/responsive.ts` | 81 | Screen sizing |
| **Haptics** | `src/utils/haptics.ts` | 73 | Haptic feedback |
| **Format muscle** | `src/utils/formatMuscle.ts` | 39 | Muscle name formatting |
| **Assert** | `src/utils/assert.ts` | 35 | Runtime assertions |

#### CORE Screens (app/)

| Screen | Path | Lines | Status |
|--------|------|-------|--------|
| **Root layout** | `app/_layout.tsx` | 628 | CORE — needs cleanup |
| **Index (redirect)** | `app/index.tsx` | 7 | CORE |
| **Splash** | `app/splash.tsx` | 11 | CORE |
| **Dashboard** | `app/dashboard.tsx` | 1,176 | CORE |
| **FitQuest (workout)** | `app/fitquest.tsx` | 1,763 | CORE |
| **Workout** | `app/workout.tsx` | 854 | CORE |
| **Workouts list** | `app/workouts/` | 300 | CORE |
| **Exercises** | `app/exercises.tsx` | 760 | CORE |
| **Move** | `app/move.tsx` | 1,137 | CORE |
| **Progress** | `app/progress.tsx` | 542 | CORE |
| **Analytics** | `app/analytics.tsx` | 929 | CORE |
| **Profile** | `app/profile.tsx` | 1,875 | CORE — needs trim |
| **AI Coach** | `app/coach/index.tsx` | 1,150 | CORE |
| **Create workout** | `app/create-workout.tsx` | 1,022 | CORE |
| **Saved workouts** | `app/saved-workouts.tsx` | 806 | CORE |
| **Onboarding** | `app/onboarding.tsx` | 1,400 | CORE |
| **Login** | `app/login.tsx` | 926 | CORE |
| **Register** | `app/register.tsx` | 393 | CORE |
| **Paywall** | `app/paywall.tsx` | 492 | CORE |
| **Feedback** | `app/feedback.tsx` | 544 | SUPPORT |
| **Legal center** | `app/legal-center.tsx` | 266 | CORE (compliance) |
| **Privacy policy** | `app/privacy-policy.tsx` | 263 | CORE (compliance) |
| **Terms of service** | `app/terms-of-service.tsx` | 153 | CORE (compliance) |

#### CORE ViewModels

| ViewModel | Lines | Maps to |
|-----------|-------|---------|
| `useDashboardViewModel.ts` | 403 | Dashboard |
| `useFitquestViewModel.ts` | 202 | FitQuest screen |
| `useCoachViewModel.ts` | 839 | AI Coach |
| `useMoveViewModel.ts` | 275 | Move screen |
| `useProgressViewModel.ts` | 141 | Progress screen |
| `useAnalyticsViewModel.ts` | 169 | Analytics screen |
| `useProfileViewModel.ts` | 1,096 | Profile (needs trim) |
| `useExercisesViewModel.ts` | 55 | Exercises |
| `useCreateWorkoutViewModel.ts` | 103 | Create workout |
| `useSavedWorkoutsViewModel.ts` | 92 | Saved workouts |
| `useOnboardingViewModel.ts` | 165 | Onboarding |
| `usePaywallViewModel.ts` | 21 | Paywall |
| `useLegalCenterViewModel.ts` | 58 | Legal |
| `createViewModel.ts` | 35 | Base factory |
| `index.ts` | 19 | Barrel |

#### CORE Components

| Component | Lines | Purpose |
|-----------|-------|---------|
| `ThemedText.tsx` | 78 | Themed typography |
| `Card.tsx` | 43 | Card container |
| `ui/GlassUI.tsx` | 705 | Glass-morphism UI kit |
| `ui/Skeleton.tsx` | 206 | Loading skeletons |
| `ui/FeedbackStates.tsx` | 170 | Empty/error states |
| `ui/ScreenContainer.tsx` | 80 | Screen wrapper |
| `ui/primitives.ts` | 8 | Primitive exports |
| `ui/SafeImage.tsx` | 72 | Safe image loading |
| `ui/SafeText.tsx` | 47 | Safe text rendering |
| `ui/Section.tsx` | 45 | Section layout |
| `ui/BodyText.tsx` | 35 | Body text |
| `ui/Title.tsx` | 34 | Title text |
| `ui/Spacer.tsx` | 30 | Spacer |
| `ExerciseImage.tsx` | 399 | Exercise images |
| `ExerciseDetailSheet.tsx` | 731 | Exercise detail modal |
| `ExerciseCompleteBadge.tsx` | 82 | Completion badge |
| `WorkoutSummaryView.tsx` | 449 | Post-workout summary |
| `GetReadyOverlay.tsx` | 237 | Get-ready countdown |
| `RestTimerOverlay.tsx` | 326 | Rest timer |
| `CountdownRing.tsx` | 83 | Countdown ring |
| `ConfettiBurst.tsx` | 132 | Celebration effect |
| `ProgressBar.tsx` | 75 | Progress bar |
| `RankDisplay.tsx` | 498 | Rank/XP display |
| `DropdownMenu.tsx` | 443 | Dropdown menus |
| `LanguageSelector.tsx` | 211 | Language picker |
| `FitQuestLogo.tsx` | 88 | App logo |
| `FQLogoMark.tsx` | 148 | Logo mark |
| `ErrorBoundary.tsx` | 96 | Error boundary |
| `ScreenErrorBoundary.tsx` | 169 | Screen-level error |
| `AuthGate.tsx` | 380 | Auth gate |
| `AppGate.tsx` | 82 | App readiness gate |
| `OfflineBanner.tsx` | 65 | Offline indicator |
| `SimpleMarkdown.tsx` | 263 | Markdown renderer (AI coach) |
| `ScreenTutorial.tsx` | 137 | Tutorial overlays |
| `ThemeToggle.tsx` | 55 | Theme switcher |
| `DatabaseRecoveryScreen.tsx` | 105 | DB recovery UI |
| `ModuleGate.tsx` | 73 | Feature gate |
| `PremiumGate.tsx` | 120 | Premium gate |
| `JogMap.tsx` | 664 | Jog route map (Move) |
| `MedicalDisclaimer.tsx` | 168 | Medical disclaimer |
| `charts/` | ~1,471 | Chart components |

---

#### SUPPORT — Ships later as feature branches

| Module | Path | Lines | Branch |
|--------|------|-------|--------|
| Exercise translations | `src/i18n/translations/exercises-*.ts` | ~726K | `feature/i18n-extended` |
| i18n engines | `src/i18n/BatchedTranslationEngine.ts` etc. | ~1,531 | `feature/i18n-extended` |
| Exercise gen expanded | `src/database/exerciseGeneratorExpanded.ts` | 9,842 | `feature/exercise-expansion` |
| Health dashboard screen | `app/health-dashboard.tsx` | 716 | `feature/health-monitoring` |
| Health dashboard VM | `src/viewmodels/useHealthDashboardViewModel.ts` | 368 | `feature/health-monitoring` |
| Background health | `src/engines/BackgroundHealthEngine.ts` | 973 | `feature/health-monitoring` |
| Anomaly detector | `src/engines/AnomalyDetector.ts` | 628 | `feature/health-monitoring` |
| Sleep analysis | `src/engines/SleepAnalysisEngine.ts` | 704 | `feature/health-monitoring` |
| Health adapters | `src/services/healthAdapters/` | ~1,827 | `feature/health-monitoring` |
| Health widgets | `src/components/health/` | 238 | `feature/health-monitoring` |
| FitMind module | `src/fitmind/` | 14 (stubs) | `feature/fitmind` |
| FitMind screens | `app/fitmind-*.tsx` | 11 (stubs) | `feature/fitmind` |
| Craft my body | `app/craft-my-body.tsx` | 1,085 | `feature/craft-my-body` |
| Craft VM | `src/viewmodels/useCraftMyBodyViewModel.ts` | 71 | `feature/craft-my-body` |
| Body craft engine | `src/engines/bodyCraftEngine.ts` | 365 | `feature/craft-my-body` |
| Body craft service | `src/database/bodyCraftService.ts` | 45 | `feature/craft-my-body` |
| Meal prep screen | `app/meal-prep.tsx` | 537 | `feature/nutrition` |
| Meal prep VM | `src/viewmodels/useMealPrepViewModel.ts` | 127 | `feature/nutrition` |
| Nutrition calc screen | `app/nutrition-calculator.tsx` | 850 | `feature/nutrition` |
| Nutrition calc VM | `src/viewmodels/useNutritionCalculatorViewModel.ts` | 55 | `feature/nutrition` |
| Food database | `src/services/foodDatabase.ts` | 51 | `feature/nutrition` |
| Backup screen | `app/backups.tsx` | 440 | `feature/backups` |
| Backup VM | `src/viewmodels/useBackupsViewModel.ts` | 161 | `feature/backups` |
| Backup service | `src/services/backupService.ts` | 222 | `feature/backups` |
| Cloud backup | `src/services/cloudBackupService.ts` | 124 | `feature/backups` |
| Professor AI | `app/professor/` | 5 (stub) | `feature/professor-ai` |
| AI models (TF) | `src/ai/` | ~4,171 | `feature/on-device-ai` |
| Training data | `training/` | ~32 files | `feature/on-device-ai` |
| Location service | `src/services/locationService.ts` | 625 | `feature/location` |
| Regional pricing | `src/utils/regionalPricing.ts` | 236 | `feature/pricing` |
| Rate limiter | `src/utils/rateLimiter.ts` | 157 | `feature/rate-limiting` |

---

#### DEAD WEIGHT — Do NOT ship (delete from FitQ2, clean from FitQuest before push)

##### Engines (DELETE)
| File | Lines | Reason |
|------|-------|--------|
| `BehavioralSignalEngine.ts` | 249 | Anti-piracy surveillance. No user value. |
| `ConsistencyClassifier.ts` | 189 | Anti-piracy behavioral profiling. |
| `FailureAnalysisEngine.ts` | 363 | Anti-piracy failure analysis. |
| `StateSimulationEngine.ts` | 317 | Anti-piracy state simulation. |
| `AdaptiveMemoryEngine.ts` | 349 | Anti-piracy adaptive memory. |
| `LongTermProgressionEngine.ts` | 393 | Anti-piracy long-term tracking. |
| `stateResetDoctrine.ts` | 400 | Anti-piracy state reset. |
| `transparencyLayer.ts` | 395 | Anti-piracy transparency overlay. |
| `edgeCaseGuards.ts` | 286 | Anti-piracy edge case handling. |
| `triggerEngine.ts` | 122 | Anti-piracy trigger system. |
| `UserStateEngine.ts` | 291 | Anti-piracy user state tracking. |
| `MindSessionEngine.ts` | 555 | FitMind session engine (module is stubbed). |
| `TrialProgressionEngine.ts` | 447 | Over-engineered trial progression. |
| `ComputationCache.ts` | 109 | Premature optimization cache. |
| **Total** | **4,465** | |

##### Services (DELETE)
| File | Lines | Reason |
|------|-------|--------|
| `security/tamperEngine.ts` | 1,882 | Anti-piracy tamper detection. |
| `security/securityBridge.ts` | 464 | Anti-piracy security bridge. |
| `security/degradation.ts` | 369 | Anti-piracy degradation system. |
| `security/sentinel.ts` | 275 | Anti-piracy sentinel. |
| `security/index.ts` | 47 | Security barrel (for anti-piracy). |
| `authorityClient.ts` | 546 | Server-side anti-piracy authority. |
| `deviceSignature.ts` | 77 | Device fingerprinting (anti-piracy). |
| `deviceTokenService.ts` | 246 | Device token for anti-piracy. |
| `replayOrchestrator.ts` | 45 | Replay for testing. |
| `p1ReplayRunner.ts` | 44 | Replay runner. |
| `engagementNotificationService.ts` | 333 | Engagement push (no users). |
| `socialLayerService.ts` | 67 | Social features (non-existent). |
| `rankingService.ts` | 531 | Ranking system (no users). |
| `microRewards.ts` | 105 | Micro-rewards (over-engineering). |
| `WriteAheadLogService.ts` | 1,242 | WAL (premature optimization). |
| `SnapshotService.ts` | 409 | State snapshots (over-engineering). |
| `RecoveryService.ts` | 254 | App recovery (over-engineering). |
| `SystemGuard.ts` | 130 | System guard (anti-piracy adj). |
| `syncEngine.ts` | 317 | Sync engine (no backend sync). |
| `syncFailureHandler.ts` | 133 | Sync failure handler. |
| `mutationQueueService.ts` | 153 | Mutation queue (no backend). |
| `offlineQueue.ts` | 217 | Offline queue (no backend sync). |
| `cacheStoreService.ts` | 111 | Cache store. |
| `cachePolicy.ts` | 21 | Cache policy. |
| `experimentService.ts` | 145 | A/B testing (no users). |
| `growthAnalytics.ts` | 161 | Growth analytics (no users). |
| `frictionLogger.ts` | 109 | UX friction logging. |
| `debugBuffer.ts` | 109 | Debug buffer. |
| `goalTracker.ts` | 144 | Goal tracking (over-engineering). |
| `subscriptionEnforcer.ts` | 181 | Subscription enforcement. |
| `metricsAggregator.ts` | 171 | Metrics aggregation. |
| `notificationReliabilityService.ts` | 274 | Notification reliability. |
| `analyticsDataService.ts` | 452 | Heavy analytics data service. |
| `analyticsIngestionService.ts` | 127 | Analytics ingestion. |
| `analyticsOptOut.ts` | 71 | Analytics opt-out. |
| **Total** | **9,607** | |

##### Database (DELETE)
| File | Lines | Reason |
|------|-------|--------|
| `WriteFirewall.ts` | 115 | Over-engineered write protection. |
| `queryCache.ts` | 66 | Premature optimization. |
| **Total** | **181** | |

##### Other (DELETE)
| Path | Lines/Files | Reason |
|------|-------------|--------|
| `src/interactions/InteractionManager.ts` | 171 | Anti-piracy interaction tracking. |
| `src/navigation/NavigationGuard.ts` | 89 | Over-engineered nav guard. |
| `src/theme/theme.ts` | 51 | Duplicate theme (canonical is design/theme-system.ts). |
| `src/features/splash/` | ? | Redundant splash feature. |

---

### Directories to DELETE entirely

| Directory | Files | Reason |
|-----------|-------|--------|
| `docs/` | 51 MD files | Outdated planning documents. No code value. |
| `reports/` | 51 files | Auto-generated reports. No ship value. |
| `scripts/` | 108 files | Build/test/migration scripts. Not needed for FitQ2. |
| `tests/` | 56 files | Tests for systems being deleted. Will rebuild. |
| `training/` | 32 files | ML training data. Deferred to `feature/on-device-ai`. |
| `legacy-screens/` | 33 files | Old screen copies. Dead. |
| `App screenshots/` | 108 files | Screenshots. Not code. |
| `logo_drafts/` | 2 files | Design drafts. |
| `ui-intelligence/` | 14 files | Figma/Pinterest automation. Not needed. |
| `ui-system/` | 15 files | UI rebuild plan (not implemented). |
| `design-intelligence/` | 10 files | Design extraction tooling. |
| `workspace-repos/` | 6 dirs | Satellite repos. Not needed. |
| `agents/` | 37 files | Alfred runtime. Operates externally. |
| `.maestro/` | ? | E2E test flows. No tests exist. |
| `.idea/` | ? | IDE config. |
| `dist/` | ? | Build output. |

### Top-level files to DELETE

| File | Reason |
|------|--------|
| `ARCHITECTURE_DECISION_RECORD.md` | Outdated |
| `DEPLOYMENT_CHECKLIST.md` | Outdated |
| `DEPLOYMENT_READINESS_ASSESSMENT.md` | Outdated |
| `DEVELOPMENT_LOG.md` | Historical noise |
| `EXECUTION_PLAN.md` | Superseded by this plan |
| `FITQUEST_ALGORITHM.md` | Algorithm docs (code is source of truth) |
| `Food_base_info.txt` | Raw data file, not needed |
| `MONETIZATION_PLAYBOOK.md` | Business doc, not code |
| `OBJECTIVES.md` | Outdated objectives |
| `PERSONAL_PROFILE.md` | Personal doc, not code |
| `RNG_USAGE.md` | Audit doc, not needed |
| `SECURITY_REMEDIATION.md` | Audit doc, not needed |
| `SIMULATION_MATRIX.md` | Anti-piracy simulation doc |
| `TECH_DEBT_REGISTER.md` | Outdated register |
| `TESTING_CI_PRIVACY.md` | No CI exists |
| `THEME_SYSTEM.md` | Docs (code is source of truth) |
| `TODO.md` | Stale todos |

### Files to KEEP at top-level

| File | Reason |
|------|--------|
| `README.md` | Needs rewrite for FitQ2 |
| `app.config.ts` | Expo config |
| `app.json` | App metadata |
| `App.tsx` | Root component |
| `babel.config.js` | Babel config |
| `eas.json` | EAS Build config |
| `eslint.config.js` | Linting |
| `index.ts` | Entry point |
| `metro.config.js` | Metro bundler config |
| `package.json` | Dependencies |
| `tailwind.config.js` | Tailwind (if used) |
| `tsconfig.json` | TypeScript config |
| `vitest.config.ts` | Test config (rebuild later) |
| `jest.config.js` | Test config (rebuild later) |
| `render.yaml` | Server deployment config |
| `CNAME` | Domain config |

---

## Phase 2 — Server Preservation

**CRITICAL**: Server code is preserved in `server/` directory. It contains:
- Authentication routes (`routes/auth.js`, `routes/user.js`)
- AI proxy (`ai-proxy/worker.ts`)
- Device binding (`routes/deviceBinding.js`, `routes/device.js`)
- Subscription management (`routes/subscription.js`)
- Data sync (`routes/sync.js`)
- Admin panel (`routes/admin.js`)
- Supabase integration (`utils/supabaseClient.js`)
- Migrations (`migrations/`)

**Action**: The entire `server/` directory ships as-is. Anti-piracy server engines (reputationEngine, enforcementEngine, trustDecayEngine, anomalyEngine, responseEngine) and their test files will be moved to `server/_deprecated/` rather than deleted, in case auth/trust logic needs reference.

The `supabase/` directory also ships as-is (config + snippets).

---

## Phase 3 — Execution Plan

### Step 1: Clean FitQuest repo (current)
1. Delete all dead weight files listed above
2. Move anti-piracy server engines to `server/_deprecated/`
3. Delete all unnecessary top-level MD files
4. Delete all peripheral directories (docs, reports, scripts, tests, legacy-screens, etc.)
5. Commit and push to FitQuest main branch

### Step 2: Create FitQ2 repo
1. Create `Jomophobeous/FitQ2` on GitHub
2. Initialize with clean README
3. Copy ONLY core files from cleaned FitQuest
4. Verify `tsc --noEmit` passes
5. Verify app builds and runs

### Step 3: Structure FitQ2
```
FitQ2/
├── app/                    # Screens (CORE only)
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── splash.tsx
│   ├── dashboard.tsx
│   ├── fitquest.tsx
│   ├── workout.tsx
│   ├── workouts/
│   ├── exercises.tsx
│   ├── move.tsx
│   ├── progress.tsx
│   ├── analytics.tsx
│   ├── profile.tsx
│   ├── coach/
│   ├── create-workout.tsx
│   ├── saved-workouts.tsx
│   ├── onboarding.tsx
│   ├── login.tsx
│   ├── register.tsx
│   ├── paywall.tsx
│   ├── feedback.tsx
│   ├── legal-center.tsx
│   ├── privacy-policy.tsx
│   └── terms-of-service.tsx
├── src/
│   ├── components/         # CORE components only
│   ├── context/            # All 6 contexts
│   ├── database/           # SQLite layer (no queryCache, no WriteFirewall)
│   ├── design/             # Theme system
│   ├── engines/            # CORE engines only (12 vs current 35)
│   ├── hooks/              # All hooks
│   ├── i18n/               # translations.ts only (extended translations later)
│   ├── purchases/          # Subscription management
│   ├── security/           # Crypto + auth (no anti-piracy security/)
│   ├── services/           # CORE services only (~20 vs current 52)
│   ├── utils/              # Utility functions
│   └── viewmodels/         # CORE viewmodels only
├── server/                 # Full server (preserved)
├── supabase/               # Supabase config
├── android/                # Android native
├── ios/                    # iOS native
├── assets/                 # Static assets
├── plugins/                # Expo plugins
├── website/                # Marketing site
└── [config files]
```

### Step 4: Feature branches (POST core perfection)
Each deferred system gets its own branch:

| Branch | Content |
|--------|---------|
| `feature/i18n-extended` | Exercise translations (14 languages), translation engines |
| `feature/health-monitoring` | Health dashboard, background health, anomaly detection, sleep |
| `feature/craft-my-body` | Body craft screen + engine |
| `feature/nutrition` | Meal prep + nutrition calculator + food database |
| `feature/backups` | Backup/restore + cloud backup |
| `feature/on-device-ai` | TF.js models, training data, activity classifier |
| `feature/professor-ai` | Professor AI personality |
| `feature/fitmind` | Document reader, flashcards, reading tracker |
| `feature/location` | GPS/location services |

---

## Phase 4 — Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Broken imports after deletion | Run `tsc --noEmit` after each batch delete |
| Missing dependencies in FitQ2 | Cherry-pick, don't clone — verify each file |
| Server code accidentally deleted | Server preserved as-is, anti-piracy moved to `_deprecated` |
| Lost exercise data | `external-exercises-data.ts` explicitly included in CORE |
| Translation regression | `translations.ts` (main) included; exercise translations deferred |
| Auth flow broken | Full security/ + AuthContext + AuthGate included |

---

## Quantitative Impact

| Metric | Current | FitQ2 Target | Reduction |
|--------|---------|-------------|-----------|
| Source files (src/) | ~285 | ~100 | ~65% |
| Code lines (src/, no translations) | ~117K | ~25-30K | ~75% |
| Engine files | 35 | 12 | ~66% |
| Service files | 52 | ~20 | ~62% |
| Top-level docs | 17 | 1 (README) | ~94% |
| Peripheral directories | 12 | 0 | 100% |
| Total lines (with translations) | ~865K | ~50K | ~94% |

---

## Approval Required

**Before execution, confirm:**
1. ✅ Core feature list is correct (Dashboard, FitQuest, Workout, Exercises, Move, Progress, Analytics, Profile, AI Coach, Create Workout, Saved Workouts, Onboarding, Login/Register, Paywall, Legal)
2. ✅ Server preservation approach is acceptable (keep all, move anti-piracy to `_deprecated`)
3. ✅ Dead weight deletion list is approved
4. ✅ Feature branch structure is acceptable
5. ✅ Push to FitQuest first, then create FitQ2

**Awaiting your review. Say "execute" to proceed.**
