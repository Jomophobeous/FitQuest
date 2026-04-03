# E2E Validation Checklist — FitQuest 2.0

**Phase 19 — Validation & Compliance**  
**Date**: 2026-XX-XX  
**Executor**: Manual (on-device)  
**Tool**: Debug Panel (`/dev/debug-panel`) for real-time observability

---

## Group A — Workout Completion Flow

| # | Test | Pass? | Notes |
|---|------|-------|-------|
| A1 | Open FitQuest tab → generate workout → start → complete all exercises → confirm XP awarded | | |
| A2 | Mid-workout: kill app → reopen → verify workout resumes or gracefully resets | | |
| A3 | Generate workout with fatigue data → verify fatigued muscles excluded/deprioritized | | |
| A4 | Complete workout → check `workout_sessions` has row with `completed_at` set | | |
| A5 | Complete workout → check `session_exercises` rows match exercise count | | |
| A6 | Complete workout → check `workout_streaks` incremented if new calendar day | | |
| A7 | Skip all exercises → verify session completes with `success = 0` | | |
| A8 | Check Debug Panel → Event Stream shows `workout_completed` event with correct payload | | |

## Group B — Restart Consistency & Boot

| # | Test | Pass? | Notes |
|---|------|-------|-------|
| B1 | Fresh install → onboarding completes → profile exists in `user_profile` | | |
| B2 | Force-close + reopen → no duplicate initialization logs (check Debug Panel) | | |
| B3 | Force-close during DB migration → reopen → migration completes without crash | | |
| B4 | Fast Refresh (dev) → no duplicate `useEffect` side effects in Debug Panel Event Stream | | |
| B5 | Cold start → Dashboard loads within 3 seconds (check `perf_app_launch` telemetry) | | |
| B6 | Auth session expired → biometric re-auth → app resumes without data loss | | |
| B7 | Switch themes 5x rapidly → no render crash, no layout shift | | |
| B8 | Navigate all 5 tabs rapidly → no white flash or missing content | | |

## Group C — Online/Offline Behavior

| # | Test | Pass? | Notes |
|---|------|-------|-------|
| C1 | Airplane mode ON → complete workout → data saves to SQLite | | |
| C2 | Airplane mode ON → navigate all screens → no crash or infinite spinner | | |
| C3 | Airplane mode OFF → check Debug Panel → Sync Engine shows pending count | | |
| C4 | Re-enable network → verify sync engine processes queue (check Debug Panel Sync section) | | |
| C5 | Debug Panel → Network section shows correct ONLINE/OFFLINE state | | |
| C6 | AI Coach/Professor → offline → shows appropriate offline message, no crash | | |

## Group D — Edge Cases & Abuse

| # | Test | Pass? | Notes |
|---|------|-------|-------|
| D1 | Tap "Generate Workout" 10x rapidly → only 1 workout generated (no duplicates) | | |
| D2 | Tap paywall CTA 5x fast → only 1 purchase flow initiated | | |
| D3 | Open 3 modals in rapid succession → no overlay stack or broken dismiss | | |
| D4 | Input empty name in profile → appropriate validation, no crash | | |
| D5 | Navigate to `/workout` with no active session → graceful empty state | | |
| D6 | Keyboard open → navigate away → no layout stuck with keyboard padding | | |
| D7 | Background app for 10 min → foreground → state refreshes, no stale data | | |
| D8 | Delete cloud data → confirm → no orphaned references in local DB | | |

## Group E — Analytics & Compliance

| # | Test | Pass? | Notes |
|---|------|-------|-------|
| E1 | Profile → Privacy & Legal → Usage Analytics toggle OFF → complete workout → check Debug Panel → events show but PostHog does NOT receive them | | |
| E2 | Analytics OFF → app crash → verify crash event still logged (critical event bypass) | | |
| E3 | Analytics ON → complete workout → verify `workout_completed` appears in PostHog (if testable) | | |
| E4 | Privacy Policy screen → verify "Analytics & Usage Data" section visible | | |
| E5 | Privacy Policy screen → verify "Behavioral Personalization" section visible | | |
| E6 | Terms of Service → verify "Disclaimer of Warranties" section visible | | |
| E7 | Terms of Service → verify "No Fitness or Medical Guarantees" section visible | | |
| E8 | Terms of Service → verify "Analytics & Data Processing" section visible | | |
| E9 | Debug Panel → verify only accessible in `__DEV__` mode | | |
| E10 | Debug Panel → Event Stream → verify events appear in real-time as you navigate | | |
| E11 | Debug Panel → Navigation Trace → verify route changes appear | | |
| E12 | Debug Panel → User State → verify consistency score / engagement level shown | | |
| E13 | Debug Panel → pull-to-refresh → data reloads | | |

---

## How to Run

1. Start dev server: `npm start`
2. Open on device/emulator
3. Navigate to **Profile → (scroll to bottom) → About → triple-tap** OR go to `/dev/ui-preview` → Debug Panel
4. Use Debug Panel's Event Stream + Navigation Trace for real-time verification
5. Mark each test pass/fail above
6. Report any failures as bugs

## Pass Criteria

- **All Group A tests pass** — workout flow is deterministic
- **All Group B tests pass** — boot and restart are stable
- **All Group C tests pass** — offline-first behavior works
- **Group D: 7/8 pass** — edge case resilience (1 known-issue acceptable if documented)
- **All Group E tests pass** — legal and analytics compliance verified
