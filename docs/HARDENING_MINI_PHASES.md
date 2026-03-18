# Hardening Mini-Phases

Purpose: track the smaller hardening slices that sit inside larger major phases so verification work is named, bounded, and logged consistently.

## Naming Convention

- Format: `P<major>.H<mini> - <title>`
- Example: `P0.H1 - Verification Gate Hardening`

## Working Rules

1. Start a mini-phase before substantial hardening, validation, or release-readiness work.
2. Keep the mini-phase status current: `planned`, `in_progress`, `blocked`, or `completed`.
3. Do not mark a mini-phase completed without recording the verification evidence.
4. Mirror every completed or materially updated mini-phase in `DEVELOPMENT_LOG.md`.
5. Keep the active mini-phase aligned with the runtime sequence in `EXECUTION_PLAN.md`.

## Tracker

| Mini-Phase | Major Phase | Status | Objective | Verification Evidence | Exit Criteria |
|---|---|---|---|---|---|
| P0.H1 - Verification Gate Hardening | Phase 0 - Freeze The Baseline | completed | Make the repo's aggregate quality gate trustworthy and artifact-backed so verification no longer depends on fragile terminal output. | `npm run verify:quality:110` PASS at `110/110`; `npm run verify:quality:110:self-test` PASS; stale-run recovery validated; `npm run verify:release:strict` PASS; `npm test` PASS; `npm run verify:ops:readiness` PASS. | Quality and release gates are reproducible from disk artifacts and no repo-owned verification blocker remains. |
| P0.H2 - Native Validation Stabilization | Phase 0 - Freeze The Baseline | deferred | Validate the native Android and health-integration path without repeatedly restarting builds after shell/editor interruptions. | minSdkVersion 26 set; AndroidManifest.xml generated via `npx expo prebuild`; build deferred to Android Studio due to VS Code memory crashes. | Deferred: user will build APK via Android Studio. |
| P0.H3 - Database & UI Hardening | Phase 0 - Freeze The Baseline | completed | Harden UI consistency, accessibility, error resilience, and theme centralization. | ScreenErrorBoundary added to 9 critical screens (dashboard, fitquest, exercises, workout, profile, coach, professor, health-dashboard, fitmind-reader); GlassUI accessibility improved (GlassCard, GradientHeader, ProgressRing); exercise category colors centralized in theme-system.ts; ExerciseImage.tsx migrated to theme colors; TypeScript 0 errors; tests 157/157 pass. | All critical screens protected by error boundaries; theme system is single source of truth for colors; accessibility roles on key components. |
| P0.H4 - Feature Quality Hardening | Phase 0 - Freeze The Baseline | completed | Validate engine singletons, FitMind query correctness, XP persistence, and security patterns. | AnomalyDetector converted to proper getInstance() singleton; all FitMind queries use correct columns (no last_read_at refs); parameterized SQL only (no injection); XP service persists to app_state SQLite immediately (no memory-only state); FSRS flashcard queries correct with COALESCE fallback. | All engines use singleton or stateless function patterns; FitMind has no schema violations; XP cannot be lost. |

## Current Mini-Phase

`P0.H3` and `P0.H4` are completed. `P0.H2` (Native Validation) is deferred to Android Studio.

Next: On-device feature verification using [TESTING_VERIFICATION_PLAN.md](TESTING_VERIFICATION_PLAN.md).