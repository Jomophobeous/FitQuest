# FitQuest 2.0 - Production Recovery Plan
Generated: 2026-02-11
Target Readiness: 85/100
Timeline: 8 Weeks

## Runtime Sequence

Use this sequence for every major phase going forward.

1. Define or activate a named hardening mini-phase before doing substantial hardening or validation work.
2. Record that mini-phase in `docs/HARDENING_MINI_PHASES.md` with status, objective, verification commands, and exit criteria.
3. Execute the work and capture verification evidence before moving the mini-phase to complete.
4. Update `DEVELOPMENT_LOG.md` with what changed, what was validated, and what remains open.
5. Keep at most one active hardening mini-phase per major phase unless parallel work is explicitly intended.

Current active mini-phase: `P0.H2 - Native Validation Stabilization`

## Current State Analysis

Production readiness is blocked by schema drift (FitMind), security policy violations (health data plaintext, AsyncStorage usage, non-AES-GCM crypto), and governance gaps (raw SQL outside approved modules). CI exists but lint/test scripts are missing. Monetization scaffolding is present but not production-ready.

### File Inventory (Phase 1)

- criticalConfig: app.json, package.json, tsconfig.json, babel.config.js, metro.config.js, eas.json, tailwind.config.js
- securityModules: src/security/AESEncryption.ts, src/security/EncryptedDatabase.ts, src/security/BiometricAuth.ts, src/security/StorageMigration.ts, src/security/index.ts
- databaseLayer: src/database/schema.ts, src/database/service.ts, src/database/types.ts, src/database/seed.ts, src/database/index.ts, src/database/exerciseGenerator.ts, src/database/exerciseGeneratorExpanded.ts, src/database/bodyCraftService.ts
- fitmindSuite: src/fitmind/schema.ts, src/fitmind/DocumentProcessor.ts, src/fitmind/DocumentImportPipeline.ts, src/fitmind/ReadingSessionTracker.ts, src/fitmind/DualAIEngine.ts, app/fitmind-library.tsx, app/fitmind-reader.tsx
- aiModules: src/ai/intent/NeuralIntentRouter.ts, src/ai/TrainedIntentRouter.ts, src/ai/coach/TransformerFitCoach.ts, src/ai/TrainedFitCoach.ts, src/ai/sensors/DeepActivityClassifier.ts, src/ai/TrainedActivityClassifier.ts, src/ai/professor/SemanticSearch.ts, src/ai/professor/NeuralSummarizer.ts, src/ai/professor/KnowledgeGraph.ts, src/ai/voice/VoiceInterface.ts, src/ai/infrastructure/ModelDownloadManager.ts, src/ai/federated/FederatedLearning.ts, src/ai/ar/ARFormChecker.ts
- uiScreens: app/*.tsx, app/coach/index.tsx, app/workouts/*.tsx
- monetization: src/purchases/SubscriptionManager.ts, src/purchases/SubscriptionContext.tsx, src/purchases/TrialOnboarding.ts, app/paywall.tsx
- services: src/services/*, src/engines/*, src/hooks/*, src/context/*
- docs: README.md, OBJECTIVES.md, TODO.md, PHASE2_CHECKLIST.md, PHASE3_SYNC_GUIDE.md, PHASE4_ANALYTICS.md, SECURITY_REMEDIATION.md, TECH_DEBT_REGISTER.md, DEPLOYMENT_CHECKLIST.md, MONETIZATION_PLAYBOOK.md, FITQUEST_AUDIT_REPORT.md

## Critical Path (Week 1)

### Day 1-2: Schema Stabilization
- [x] Fix TD-001: remove unsupported FitMind columns and align queries to canonical schema
- [x] Consolidate FitMind schema into database/schema.ts as single source of truth
- [x] Add migration for existing users

### Day 3-4: Security Emergency
- [x] Encrypt health metrics (TD-002)
- [x] Begin AsyncStorage audit and migration plan (TD-003)

### Day 5-7: Validation
- [ ] Integration tests for FitMind + encryptedDB
- [ ] Security scan verification
- [x] `npm run typecheck` (passed)
- [ ] `npm test` (needs rerun)

## Phase 2-4 (Weeks 2-8)

### Week 2: Storage and Crypto
- [x] Replace AsyncStorage with SecureStore or SQLite
- [x] Implement AES-256-GCM payload v3 and auto-migration from v2 (requires dev client install)

### Week 3: Governance and Reliability
- [x] Move raw SQL into schema/service only (TD-005)
- [x] Whitelist secureDelete tables (TD-006)
- [x] Theme token compliance for paywall and meal-prep (TD-009)

### Week 4: Monetization Hardening
- [x] Wire RevenueCat via env key; entitlement/restore verification pending
- [ ] Add offline license validation strategy

### Weeks 5-6: Observability + Testing
- [x] Add lint/test scripts and minimum unit tests (TD-008)
- [x] Add local telemetry + global error boundary
- [ ] Add crash reporting and performance metrics (TD-010) — external reporting pending

### Weeks 7-8: Performance + Cleanup
- [ ] ML inference benchmarks (TD-011)
- [ ] RNG cleanups for security-sensitive IDs (TD-012)

## Phase 7-10 Foundations (Roadmap Extension)

### Phase 7 — Platformization Foundation
- [x] Added platform template/workspace contracts and validators (`src/platform/phase7Platformization.ts`)
- [x] Added verification chain (`verify:phase7:lite`)

### Phase 8 — Autonomous Operations Foundation
- [x] Added safety-mode automation policy + decision scaffolding (`src/platform/phase8AutonomousOperations.ts`)
- [x] Added verification chain (`verify:phase8:lite`)

### Phase 9 — Ecosystem Federation Foundation
- [x] Added integration policy + scope-gate contracts (`src/platform/phase9EcosystemFederation.ts`)
- [x] Added verification chain (`verify:phase9:lite`)

### Phase 10 — Enterprise Hardening Foundation
- [x] Added SLO/compliance hardening snapshot model and risk scoring (`src/platform/phase10EnterpriseHardening.ts`)
- [x] Added verification chain (`verify:phase10:lite`)

## Risk Register

| Risk | Mitigation | Owner | Status |
| --- | --- | --- | --- |
| Schema drift causes runtime crashes | Single source of truth and migration | Engineering | Resolved |
| Crypto migration data loss | Dual-read and auto-migrate on read | Security | Resolved |
| AsyncStorage removal breaks prefs | Staged migration with fallbacks | Engineering | Resolved |
| Monetization regressions | Gate via feature flags and manual QA | Product | Open |

## Success Metrics

- Security Score: 35 → 85
- Crash-free rate: Current → 99.5%
- Test coverage: 0% → 80%
