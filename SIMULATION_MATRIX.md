# FitQuest Simulation Matrix (Phase 10)

## Automated Baseline

- Command: `npm run verify:simulation:lite`
- Gate: must pass end-to-end with no errors
- Artifact: `reports/simulation-lite-latest.md`

## Manual Simulation Sweep

1. Auth and Session
   - Launch app, authenticate, verify session survives app restart.
2. Workout Lifecycle
   - Generate workout, complete at least one session, verify summary and persistence.
3. Backup and Restore
   - Create backup, list backups, restore latest snapshot.
4. Adaptive Progression
   - Complete repeated sessions and confirm adaptive profile updates are visible.
5. Platform Studio (Phase 7)
   - Create template/workspace, publish template, verify state persistence.
6. Autonomous Center (Phase 8)
   - Adjust policy thresholds, run simulation action, verify decision log entries.
7. Federation Hub (Phase 9)
   - Register integration policy entry and verify status/state update.
8. Enterprise Hardening (Phase 10)
   - Update controls/snapshot inputs and verify computed risk/slo outputs.

## Exit Criteria

- No crashes across the above flow
- No TypeScript errors (`npm run typecheck`)
- `verify:simulation:lite` passes
- All newly added phase 7–10 screens are reachable from menu or route
