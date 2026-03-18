# FitQuest Initiation Plan — March 11, 2026

## Scope Reviewed

Research and roadmap documents reviewed:
- `RESEARCH_SUMMARY.md`
- `docs/ENHANCEMENT_RESEARCH_COMPREHENSIVE_2026.md`
- `docs/ENHANCEMENT_RESEARCH.md`
- `docs/AI_ENHANCEMENT_RESEARCH.md`
- `docs/AI_BOT_ENHANCEMENT_STRATEGY.md`
- `docs/APP_INTEGRATION_MASTER_PLAN.md`
- `docs/FITQUEST_BOOTSTRAP_ROADMAP.md`

Codebase areas reviewed:
- `app/`
- `src/purchases/`
- `src/services/healthAdapters/`
- `src/fitmind/`
- `src/engines/`
- `src/database/`
- `src/security/`
- `scripts/`
- `package.json`
- `metro.config.js`

## Reality Check

The research set is directionally useful, but parts of it are stale relative to the current repo.

Already present in code:
- Health adapter layer exists for Health Connect and HealthKit.
- Dual AI enhancements are largely implemented, including FSRS, neural summarization, semantic search, and conversation memory.
- Metro `.txt` asset support is already fixed.
- Release and quality verification scripts already exist.

Still blocking or incomplete:
- RevenueCat is scaffolded in code, but `react-native-purchases` is not installed in `package.json`.
- RevenueCat runtime depends on a real `EXPO_PUBLIC_REVENUECAT_API_KEY`; placeholder values will silently drop the app to local-only trial mode.
- Native health integrations exist in code, but still need dev-build validation, permission UX verification, and end-to-end sync confirmation.
- Cloud backup and some enterprise/platform modules are present but not strong launch drivers.

## Recommendation

Initiate with a launch-first sequence, not a broad enhancement sprint.

Do this now:
1. Monetization completion
2. Native health validation
3. Release hardening
4. Beta launch instrumentation

Defer for later:
1. Backend migration
2. New on-device LLM work
3. Enterprise/platform expansion
4. Broad UI experimentation outside launch-critical flows

## Step-by-Step Initiation Plan

### Phase 0: Freeze The Baseline

Goal: establish what is already working before changing anything.

Steps:
1. Run the existing verification commands and store the output as the baseline:
   - `npm run typecheck`
   - `npm run test`
   - `npm run verify:release`
   - `npm run verify:monetization:lite`
   - `npm run verify:ops:readiness`
   - `npm run verify:quality:110`
2. Record failures by category: monetization, health integration, reader, performance, release metadata.
3. Confirm current schema version and migration status before touching any persistence code.
4. Validate that the current app boots on web and at least one native dev build.

Exit criteria:
- You have a single baseline list of failing checks.
- No work starts from assumptions in old docs.

### Phase 1: Finish Monetization First

Goal: remove the primary revenue blocker and make the paywall real.

Steps:
1. Install `react-native-purchases` and align it with the current Expo and native setup.
2. Verify `SubscriptionManager` assumptions against the RevenueCat dashboard:
   - entitlement id: `full_access`
   - monthly product id: `fitquest_monthly`
   - annual product id: `fitquest_annual`
3. Add real environment values for RevenueCat and confirm the app no longer falls back to local-only trial mode.
4. Test monthly purchase, annual purchase, restore purchases, expired trial, and offline grace behavior.
5. Audit all premium entry points and make sure they consistently route to the paywall.
6. Confirm the paywall copy, pricing display, and annual savings logic match the chosen commercial model.

Files and modules to validate first:
- `src/purchases/SubscriptionManager.ts`
- `src/purchases/SubscriptionContext.tsx`
- `app/paywall.tsx`
- `app/_layout.tsx`

Exit criteria:
- Real sandbox purchases work on iOS and Android.
- Restore works.
- Trial and expiry states are deterministic.

### Phase 2: Activate Health Integrations End To End

Goal: turn the existing adapter code into a verified user-facing feature.

Steps:
1. Validate native package linking and runtime behavior for:
   - `react-native-health-connect`
   - `react-native-health`
2. Review permission declarations in Expo/native config for both platforms.
3. Confirm adapter selection logic works correctly in Expo Go, Android dev build, and iOS dev build.
4. Verify that imported sensitive health data flows only through encrypted storage.
5. Add or refine explicit permission and failure states in the UI so users can understand whether sync is active, unavailable, denied, or stale.
6. Verify background sync feeds the health dashboard, anomaly detection, and summary generation with real records.
7. Add telemetry for provider initialization, permission denial, partial sync, and record normalization failures.

Files and modules to validate first:
- `src/services/healthAdapters/index.ts`
- `src/services/healthAdapters/HealthConnectAdapter.ts`
- `src/services/healthAdapters/HealthKitAdapter.ts`
- `src/engines/BackgroundHealthEngine.ts`
- `src/security/EncryptedDatabase.ts`
- `app/health-dashboard.tsx`
- `app/profile.tsx`

Exit criteria:
- Health sync works on at least one Android dev build and one iOS dev build.
- Dashboard metrics reflect imported platform data.
- No sensitive metric is stored outside encrypted paths.

### Phase 3: Harden The Critical User Flows

Goal: make the core product reliable enough for external users.

Priority flows:
1. Onboarding
2. Generate workout
3. Complete workout and award XP
4. Open FitMind library and reader
5. Chat with Coach and Professor
6. Open paywall and complete purchase flow
7. Open health dashboard after sync

Steps:
1. Run manual smoke tests across the above flows on low-risk seed data.
2. Fix null-state and empty-state crashes before doing feature expansion.
3. Remove or reduce noisy dev-only logging from critical screens and engines.
4. Re-run bundling validation for Android and web after any dependency or native config change.
5. Use the existing release verification scripts after each significant fix batch.

Exit criteria:
- All seven critical flows complete without blocker-level failures.
- Release verification passes or only contains explicitly accepted non-launch issues.

### Phase 4: Instrument The Beta

Goal: make the first external rollout measurable.

Steps:
1. Ensure crash reporting is initialized and environment-specific.
2. Decide the minimum launch metrics set:
   - installs
   - onboarding completion
   - first workout completion
   - paywall views
   - trial starts
   - purchase conversions
   - restore success rate
   - health sync activation rate
3. Audit event names and confirm they map to real product questions.
4. Prepare screenshots, metadata, privacy text, and subscription disclosures based on the actual implemented feature set, not aspirational features.
5. Create a beta feedback loop: crash triage, issue intake, and a fixed daily review cadence.

Exit criteria:
- Every launch-critical flow is observable.
- You can answer where users drop off within 24 hours of beta launch.

### Phase 5: Launch A Focused Beta

Goal: validate retention and conversion before taking on bigger enhancement work.

Steps:
1. Launch to a small cohort first.
2. Watch only four primary signals for the first week:
   - crash-free sessions
   - onboarding completion
   - first workout completion
   - trial-to-paid conversion
3. Triage bugs daily and classify them as revenue blocker, retention blocker, or cosmetic.
4. Do not add new surface-area features during the first feedback week unless they unblock revenue or retention.

Exit criteria:
- Purchase flow is stable.
- Core retention loop is measurable.
- You have evidence for what Phase 2 product investment should be.

## Recommended Four-Week Execution Order

### Week 1
1. Phase 0 baseline
2. RevenueCat install and environment setup
3. Sandbox purchase validation

### Week 2
1. Health adapter validation on native builds
2. Health sync UI and telemetry hardening
3. Dashboard verification with real imported data

### Week 3
1. End-to-end smoke testing
2. Release verification cleanup
3. Beta instrumentation and store materials

### Week 4
1. Small beta rollout
2. Daily bug triage
3. Conversion and retention review

## What Not To Start Yet

Do not initiate these before the beta proves the core loop:
- Supabase or backend migration
- More AI model work
- Enterprise federation expansion
- Broad exercise-content import programs
- Widget and live activity work

Those items remain good Phase 2 candidates, but they should come after monetization and health sync are proven with real users.

## Success Definition For Initiation

This initiation plan is successful when all of the following are true:
- The app has a verified baseline.
- RevenueCat works in real sandbox flows.
- Native health sync works on-device.
- Core flows are smoke-tested.
- Beta telemetry is trustworthy.
- The next roadmap is driven by live usage instead of speculative research.