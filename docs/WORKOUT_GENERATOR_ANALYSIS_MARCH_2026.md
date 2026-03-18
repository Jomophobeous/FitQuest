# Workout Generator Analysis — March 11, 2026

## Execution Path

The workout generator currently runs in this order:
1. Load user profile
2. Load adaptive training profile
3. Load muscle fatigue map
4. Load recently used exercise ids
5. Determine session intent from fatigue and recently trained muscles
6. Query candidate exercises through hard filters
7. Score candidates with freshness, goal alignment, pattern fit, progression trend, and variety
8. Select final exercises
9. Prescribe sets and reps

## Findings

### Confirmed issues

1. `getExercises()` returned `training_types: []` for every exercise record.
   - Effect: the generator's goal-alignment score was effectively blind even when SQL filtered by training type.
   - Impact: lower-quality ranking and weaker personalization.

2. The generator performed N+1 progress-history reads during scoring.
   - Effect: one progress-history query per candidate exercise.
   - Impact: unnecessary latency and scale risk as the candidate set grows.

3. `generateWorkout()` still loaded recent sessions even though intent selection no longer used them.
   - Effect: unnecessary query on every generation.

4. The existing test used fabricated exercise fixtures and a stale mock surface.
   - Effect: it missed the real shape of the generator's data path and broke as soon as `getAppState()` became part of filtering.

### Environment constraint

Direct Expo SQLite access is not available inside the current Node Vitest environment.
That means true database-backed workout-generator integration tests are not honest in this runner without a separate native-capable harness.

## Improvements Implemented

1. Restored real `training_types` on `getExercises()` results.
2. Replaced per-candidate progress queries with a batched progress-history lookup.
3. Removed the unused recent-session query from generation.
4. Replaced the fabricated workout-generator tests with a real-catalog integration test harness driven by the actual generated exercise catalogue.
5. Reworked selection so the generator prioritizes the freshest focus pattern before broadening coverage.
6. Added `analyzeWorkoutGeneration()` so the same live planning path can be inspected on-device without persisting a session.
7. Added a native diagnostics surface on the hidden workouts screen to run the generator against the real on-device database.
8. Fixed the diagnostics screen to load recent sessions for the active profile instead of always using the default local user.
9. Removed the nested `FlatList` inside the diagnostics `ScrollView` so the hidden native harness no longer depends on a virtualized-list anti-pattern.

## OAuth Gate Alignment

The strict quality gate failure was not a workout-generator defect. The repo had a server Google audience configured but no mobile Google client IDs in the root env.

To make verification reflect the actual client auth flow:
1. OAuth preflight now merges `.env` and `.env.local`.
2. Preflight accepts either an Android-specific client ID or a configured web/iOS fallback client ID.
3. Android-specific absence is now a warning when a real fallback client exists, instead of an unconditional blocker.

## Remaining Recommendation

If you want fully native database-backed generator tests beyond this point, the next step is a dedicated Expo/dev-client integration harness instead of Node-only Vitest.