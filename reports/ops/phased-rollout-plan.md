# Phased Rollout Plan (P2)

Last updated: 2026-02-17
Owner: Mobile Engineering

## Scope
This runbook defines staged rollout for mobile releases with stop conditions and verification gates.

## Stages
1. Internal canary (team devices)
2. Closed beta cohort
3. 10% production rollout
4. 50% production rollout
5. 100% rollout

## Entry Criteria (per stage)
- CI green (`typecheck`, i18n gate, simulation gate, quality gate)
- No unresolved release-blocking bugs
- Release notes prepared
- Privacy/legal metadata verified

## Monitoring Window
- Minimum 2 hours per stage (or one business day for major releases)
- Track crash-free sessions, startup latency, and key flow completion rates

## Stop Conditions
- Crash-free sessions drop below target threshold
- Spike in auth/sync/backup failures
- Regression in workout start or completion flow
- Legal/compliance mismatch discovered in listing metadata

## Stage Exit Criteria
- Telemetry within acceptable bounds
- No new critical incidents
- Product + Engineering sign-off

## Roll-forward Actions
- Increase rollout percentage to next stage
- Re-run smoke checks for onboarding, workout, profile, meal prep, backups

## References
- `reports/ops/rollback-runbook.md`
- `DEPLOYMENT_CHECKLIST.md`
