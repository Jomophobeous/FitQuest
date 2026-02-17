# Older Device Sweep (P2)

Last updated: 2026-02-17
Owner: QA + Mobile Engineering

## Device Matrix
| Device Class | Platform | Target | Status |
| --- | --- | --- | --- |
| Low-end Android | Android | 2-3 GB RAM | BLOCKED |
| Mid-tier Android | Android | 4 GB RAM | BLOCKED |
| Previous major Android | Android | N-1 OS major | BLOCKED |
| Older supported iPhone | iOS | Oldest supported model | BLOCKED |
| Previous major iOS | iOS | N-1 OS major | BLOCKED |

## Execution Evidence
| Date | Device | OS | Build | Scenario | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-02-17 | Android test device (Expo Go) | See Metro runtime log | Dev | Meal Prep navigation + list render | FAIL | Repeated RN text rendering error observed; patch applied and awaiting rerun on physical low-end device. |

## Required Scenarios
- App launch to dashboard under acceptable startup time
- Workout generation and completion
- Meal Prep render and scroll stability
- Profile actions (consent/export/delete trigger paths)
- Backup list/create/upload interactions

## Exit Criteria
- No blocking runtime errors across target matrix
- No repeated red screen loops
- No crash during 15-minute foreground session under memory pressure

## Notes
- Record device model, OS, and measurable startup/render timings.
- Attach reproduction steps and links to issue IDs for all FAIL results.
- Before new evidence rows, run clean restart (`npx expo start -c`) and force reload on device to avoid stale Metro traces.
- Confirm Metro log contains `[MealPrep] Bundle signature: MEAL_PREP_SAFE_RENDER_2026_02_17` before evaluating Meal Prep pass/fail.
