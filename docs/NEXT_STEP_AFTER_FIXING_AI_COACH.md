# Next Step After Fixing AI Coach

Created: 2026-03-12
Status: Planning + Handoff for next session
Owner: AI Coach / Workout Intelligence track

## 1) Session Handoff (What Was Being Done)

### Goal in the interrupted session
- Diagnose why app was closing in Expo Go with the message: "Expo go closed because the app has a bug".
- Audit startup/runtime path end-to-end (app config, providers, native modules, bundle/runtime behavior).
- Keep AI Coach UI upgrades intact (send/stop toggle + alive thinking bubble) while stabilizing launch mode.

### Actions completed
- Confirmed Metro can bundle Android successfully (runtime issue, not syntax/bundle blocker).
- Verified app startup logs show successful DB init, auth init, workout generation, sensor engines loading.
- Verified Health Connect fallback behavior in Expo Go:
  - "[HealthConnect] Not linked — expected in Expo Go, use dev-client build"
- Verified many AI provider failures are upstream/provider/account constraints (400/402/404/429), not app boot crash.
- Confirmed list performance warning exists in chat (VirtualizedList slow update warning).

### Work that was incomplete when paused
- Finalize permanent mode strategy for development:
  - Option A: pure Expo Go profile (strict managed compatibility)
  - Option B: dev-client profile (native modules enabled)
- Add dual-profile config toggles so mode switching is one command and never ambiguous.
- Implement next-phase product features requested below (timestamped workout recall + Profession scheduler + passive status feedback).
- Update legal/terms language and permission UX for background operation requirement.

## 2) Critical Product Note from User (Do Not Lose)

User request summary:
- Add robust timestamps/active workout recall so algorithm can determine exactly when user last worked out.
- Use this for dynamic fatigue calculation through the day (not static fatigue snapshots).
- App surfaces "current status" passively (not only "last worked out").
- New feature concept: "Profession".
  - Use work schedule windows (before work / during / after work) in workout generation + dashboard + AI.
  - Blend with live sensor data to adjust fatigue/recovery and recommendations.
- Alternative path:
  - Pipe these readings to AI Coach for automatic first-message status feedback.
- App may need background operation for accurate passive stats.
- Update Terms/Legal docs to reflect this requirement and user consent expectations.

## 3) Named Next Initiative

Initiative name:
- NEXT STEP AFTER FIXING AI COACH: Passive Status Intelligence + Profession-Aware Planning

## 4) Proposed Architecture (Improved Workflow)

### A) Timestamped active workout recall (foundation)
- Source of truth:
  - workout_sessions.started_at, workout_sessions.completed_at
  - progress_records.date
  - muscle_fatigue.last_trained_at, muscle_fatigue.updated_at
  - health data timestamps from encrypted tables
- Add derived metrics service (no UI coupling):
  - timeSinceLastWorkoutMinutes
  - timeSinceLastSessionByMuscle
  - intradayFatigueDecayCurve per muscle and global fatigue score
  - readinessNow (0-100)
- Cache and update cadence:
  - lightweight recalculation on app foreground + periodic background tick
  - immediate recompute on workout completion

### B) Dynamic fatigue through the day
- Replace static fatigue-only reads with time-aware model:
  - fatigueNow = f(lastTrainedAt, volumeLoad, sleep, hr/recovery proxies, circadian window)
- Keep deterministic fast path in app logic (for speed/reliability).
- Reserve AI for explanation/feedback, not core calculation path.

### C) Profession feature (schedule-aware planning)
- New profile inputs:
  - profession_type (or category)
  - work_start_time, work_end_time
  - commute_minutes
  - preferred_training_windows
  - shift_type (day/night/rotating)
- Planner behavior:
  - chooses workout intensity by available window + current readiness
  - before-work: shorter activation/mobility/low decision burden
  - after-work: adaptive intensity based on accumulated fatigue and sensor signals
  - rotating shift support via schedule template rules

### D) Passive current-status UX
- Dashboard card:
  - "Current Status" (ready / moderate fatigue / high fatigue)
  - "Last trained" plus live readiness trend
- AI Coach first response behavior:
  - if recent metrics present, first response begins with concise status feedback
  - include recommendation + caution + best workout window suggestion

### E) Background operation strategy (accuracy + battery)
- Keep heavy AI processing out of continuous background loops.
- Background loop only collects lightweight metrics and computes readiness deltas.
- AI summary is generated on open/resume or on-demand, using stored snapshots.
- Respect battery tiers already in BackgroundHealthEngine.

### F) Legal + consent updates
- Add explicit disclosure:
  - why background operation improves recommendations
  - what data is read, cadence, retention, encryption
  - user controls to disable/limit background updates
- Add in-app permission rationale screen with plain language.

## 5) Performance and Accuracy Guardrails

- Accuracy:
  - deterministic fatigue/readiness calculation in-engine first
  - AI used as interpretation layer, not primary scoring source
- Speed:
  - avoid expensive recomputation every render
  - precompute status snapshots and invalidate only on relevant events
- Reliability:
  - graceful degradation when sensors/providers unavailable
  - keep app functional offline with SQLite-first path

## 6) Next Session Implementation Plan (Ordered)

1. Define readiness/fatigue domain model + formulas in engine layer.
2. Add timestamp-driven derived-metrics service (read-only first).
3. Add Profession fields to profile flow and persistence.
4. Update workout generator inputs to include profession schedule + readinessNow.
5. Add Dashboard "Current Status" card and intraday trend indicator.
6. Add AI Coach "first-message status feedback" hook.
7. Add background snapshot cadence + throttling controls.
8. Update legal center/terms/privacy copy + consent UX.
9. Add telemetry for feature quality and latency.

## 7) Raw Logs Preserved (User-Provided)

```text
LOG  [FitQuest] Workout generated: session_1773334795299_281adf28ca99716b
LOG  [DeepActivityClassifier] v3.0.0: CNN-LSTM, window=128, classes=9, LSTM hidden=64
LOG  [SensorFusion] v2.0 CNN-LSTM classifier loaded
LOG  [TrainedActivityClassifier] Model loaded: 6 activities, 57 features
LOG  [SensorFusion] v1.0 ML activity classifier loaded
LOG  [HealthConnect] Not linked — expected in Expo Go, use dev-client build
LOG  [Dashboard] loadProgress:start
LOG  [Dashboard] loadProgress:complete
LOG  [Dashboard] loadProgress:start
LOG  [Dashboard] loadProgress:complete
LOG  [AI] Route: "Alright man I'm ready!..." → simple → fast tier → trying Gemma 3 12B
WARN  [AI] Gemma 3 12B failed: ... 400 ...
WARN  [AI] Qwen 3 4B failed: ... 429 ...
WARN  [AI] Llama 3.2 3B failed: ... 402 ...
WARN  [AI] Gemma 3 4B failed: ... 400 ...
WARN  [AI] GLM 4.5 Air failed: [AbortError: Aborted]
WARN  [AI] Mistral Small 3.1 failed: ... 429 ...
WARN  [AI] GPT-OSS 20B failed: ... 404 ...
WARN  [AI] Step 3.5 Flash failed: [Error: Empty response ...]
WARN  [AI] Gemma 3 27B failed: ... 429 ...
WARN  [AI] GPT-OSS 120B failed: ... 404 ...
WARN  [AI] Llama 3.3 70B failed: ... 429 ...
WARN  [AI] Hermes 3 405B failed: ... 402 ...
LOG  [AI] Route: "What is a CNS?..." → moderate → strong tier → trying GLM 4.5 Air
WARN  [AI] GLM 4.5 Air failed: ... 429 ...
WARN  [AI] Mistral Small 3.1 failed: ... 429 ...
LOG  VirtualizedList: You have a large list that is slow to update ...
```

## 8) Notes for Next Session Kickoff

- Start with this file and immediately scaffold:
  - readiness/fatigue derived metrics service
  - Profession schema additions
  - Dashboard current-status UI block
- Keep current AI Coach UI improvements from this session.
- Maintain SQLite-first + encrypted sensitive data path.
- Ensure no heavy background AI loops; keep background compute lightweight.
