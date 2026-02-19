# FitQuest App Integration Master Plan

Last updated: 2026-02-18
Scope: Entire mobile app (FitQuest + Move + FitMind + Health + Platform modules)

## 1) Current State Snapshot

### 1.1 What is integrated now
- Core Expo app architecture is in place with router screens under `app/` and domain logic under `src/`.
- SQLite-first data layer is active (`src/database/`) and schema version is 9 (`src/database/types.ts`).
- Security layer exists (`src/security/`) and encrypted storage service is available (`encryptedDB`).
- FitMind reader has meaningful progress: engine gating, PDF/EPUB fallback paths, offline web assets loader, and focused tests.
- Focused and targeted tests are passing (`tests/fitmindReaderEngine.test.ts`, `tests/readerWebAssets.test.ts`, `tests/validation.test.ts`, `tests/rateLimiter.test.ts`, `tests/dualAIEngine.test.ts`).

### 1.2 Hard blockers right now
- Expo Android bundling fails on `.txt` reader assets required from `src/fitmind/readerWebAssets.ts`.
- Root cause: Metro resolver does not include `txt` in asset extensions in `metro.config.js`.

### 1.3 Integration maturity by domain
- FitMind Reader: **Partial (70%)** — core paths and tests exist, bundler blocker and runtime smoke pending.
- Health integrations: **Planned (15%)** — no in-app adapter integration yet.
- Visualization modernization: **Planned (20%)** — baseline chart package present, no systematic rollout.
- Exercise content expansion: **Planned (10%)** — external repositories cloned, importer pipeline not implemented.
- Platform hardening (offline/sync/telemetry/legal): **Partial (55%)** — many services exist; integration consistency and validation gates still needed.

---

## 2) Repository Integration Matrix

### 2.1 Top 5 foundation repos
1. `workspace-repos/top5/react-native-pdf`
   - Status: Installed and used in FitMind reader.
   - Next: Validate in dev build, keep Expo Go fallback path.

2. `workspace-repos/top5/pdf.js`
   - Status: Package present (`pdfjs-dist`) with web reader usage path.
   - Next: Verify offline template render on real device and memory performance.

3. `workspace-repos/top5/react-native-webview`
   - Status: Installed and used.
   - Next: Keep pinned to Expo-compatible version and monitor SDK upgrades.

4. `workspace-repos/top5/react-native-file-viewer`
   - Status: Not integrated in app runtime path.
   - Next: Decide if needed vs current `Linking.openURL(file://...)` fallback.

5. `workspace-repos/top5/react-native-skia`
   - Status: Not integrated.
   - Next: Pilot one card in health dashboard only after baseline stability.

### 2.2 Health integration repos
1. `workspace-repos/health-integrations/react-native-health-connect`
2. `workspace-repos/health-integrations/react-native-health`
3. `workspace-repos/health-integrations/react-native-google-fit`
- Status: Cloned for evaluation, not integrated in app code.
- Next: Build provider-neutral adapter layer in `src/services/` and encrypted ingestion boundary.

### 2.3 Visualization repos
1. `workspace-repos/visualization/react-native-reanimated`
   - Status: Already used in app.
2. `workspace-repos/visualization/react-native-chart-kit`
   - Status: Dependency present, limited adoption.
3. `workspace-repos/visualization/victory-native`
   - Status: Not integrated.

### 2.4 Exercise content repos
1. `workspace-repos/exercise-content/exercises.json`
2. `workspace-repos/exercise-content/free-exercise-db`
- Status: Data sources available, no importer/normalizer to FitQuest schema yet.

### 2.5 EPUB alternative repos
1. `workspace-repos/epub-alternatives/epub-js-intity`
2. `workspace-repos/epub-alternatives/epub.js`
3. `workspace-repos/epub-alternatives/readium-r2-navigator-js`
- Status: Candidate sources evaluated; current app uses `@intity/epub-js` path.

---

## 3) Completion Plan (Entire App)

## Phase 0 — Immediate Stabilization (Critical)
Goal: Unblock local development and prevent regressions.

1. Add `txt` to Metro asset extensions in `metro.config.js`.
2. Re-run Expo bundling on Android and Web and validate reader assets resolve.
3. Freeze dependency compatibility baseline (`expo`, `react-native-webview`, reader deps).
4. Add a minimal startup smoke checklist for every pull request.

Exit criteria:
- Expo starts without unresolved module errors.
- FitMind reader loads without Metro resolution failures.

## Phase 1 — FitMind Completion (High Priority)
Goal: Finish reader reliability and production readiness.

1. Validate all reader engines (`native_pdf`, `web_pdfjs`, `web_epub`, `external`) across Expo Go and dev build.
2. Implement robust error telemetry around renderer boot and open-document fallback paths.
3. Improve extraction/indexing pipeline for Professor context from PDF/EPUB content.
4. Add reader smoke tests for binary docs and fallback transitions.
5. Update release note + known limitations for device-specific rendering constraints.

Exit criteria:
- No blocking reader crash path.
- Deterministic fallback for every binary document type.

## Phase 2 — Exercise Content Integration (High Priority)
Goal: Integrate external exercise datasets into canonical FitQuest schema.

1. Build `scripts/import-external-exercises.ts` with:
   - dry-run mode,
   - schema validation,
   - enum/category normalization,
   - dedupe report.
2. Map external taxonomy to canonical enums in `src/database/types.ts`.
3. Route all writes through database service layer (no raw SQL outside allowed files).
4. Add quality filters (missing instructions, invalid muscles/equipment, duplicates).
5. Run seeded-workout generation sanity checks post-import.

Exit criteria:
- Import pipeline is repeatable and idempotent.
- Imported content does not break workout generation.

## Phase 3 — Health Provider Integration (High Priority)
Goal: Connect Health Connect/HealthKit/Google Fit safely.

1. Define provider-neutral adapter interface (`src/services/healthAdapters/`).
2. Implement Android-first adapter (Health Connect), then iOS (HealthKit), then fallback (Google Fit).
3. Normalize records into internal model and write sensitive metrics only through `encryptedDB`.
4. Connect ingestion to `BackgroundHealthEngine`, `AnomalyDetector`, and daily summaries.
5. Add consent/permission UX and failure handling in settings.

Exit criteria:
- Imported health metrics flow into dashboards and anomaly alerts.
- No sensitive health metric stored unencrypted.

## Phase 4 — Visualization & UX Upgrade (Medium Priority)
Goal: Improve key dashboards without destabilizing app.

1. Prioritize `react-native-reanimated` enhancements for existing UI primitives.
2. Pilot one Skia-based card in `app/health-dashboard.tsx` under feature flag.
3. Evaluate `victory-native` vs existing chart stack for analytics screen standardization.
4. Enforce theme token compliance (no hardcoded color/spacing).

Exit criteria:
- Performance remains stable on target devices.
- Visual upgrades ship without design-system violations.

## Phase 5 — Platform Integration Consistency (Medium Priority)
Goal: Standardize architecture use across all screens.

1. Remove/avoid legacy Apollo additions for new features (SQLite-first only).
2. Audit all app screens for direct-storage anti-patterns (AsyncStorage/raw SQL).
3. Enforce secure data boundaries for health and AI conversation data.
4. Ensure i18n coverage for new user-facing strings.
5. Align all forms with centralized validation utilities.

Exit criteria:
- New work conforms to architecture rules.
- Security and theming constraints are consistently enforced.

## Phase 6 — Quality Gates & Release Readiness (Critical)
Goal: Move from targeted validations to reliable release gates.

1. Stabilize full test suite execution (`npm run test`) and remove hanging paths.
2. Add grouped smoke runs:
   - reader,
   - workout generation,
   - health dashboard,
   - onboarding/auth.
3. Add release verification script for Expo/dev-build compatibility checks.
4. Add rollback playbook for data migrations and critical reader regressions.

Exit criteria:
- CI-equivalent local gate passes with deterministic output.
- Release checklist complete with known limitations and mitigations.

---

## 4) Ownership Model (Suggested)
- Mobile Core: Phases 0, 1, 5, 6
- Data/Content: Phase 2
- Health/Engines: Phase 3
- UI/Design Systems: Phase 4

---

## 5) Priority Order (Execution Queue)
1. Phase 0 (unblock Metro asset resolution)
2. Phase 1 (finish FitMind reliability)
3. Phase 2 + 3 in parallel (content + health adapters)
4. Phase 4 (visual upgrades)
5. Phase 5 + 6 (consistency + release gates)

This order minimizes risk by fixing infrastructure blockers first, then shipping high-user-value integrations, then hardening for long-term release velocity.
