# Rollback Runbook (P2)

Last updated: 2026-02-17
Owner: Mobile Engineering

## Trigger Conditions
- Critical production crash
- Data corruption risk
- Security/privacy regression
- Severe auth/sync outage affecting user continuity

## Immediate Actions (0-15 min)
1. Freeze rollout progression
2. Notify incident channel and assign incident owner
3. Capture failing version, platform, and first-seen timestamp

## Rollback Procedure
1. Pause release in store rollout controls
2. Revert to last known good release percentage or binary
3. Disable risky feature flags (if applicable)
4. Confirm app launch + workout + profile + backup sanity checks

## Verification Checklist
- App launches without blocking errors
- Workout generation/completion works
- Profile and legal center accessible
- Sync/backups do not hard-fail app flow
- Crash rate stabilizes to baseline

## Communication
- Post incident update with root symptom, impact, and mitigation status
- Publish user-facing status message if required
- Provide ETA for hotfix or resumed rollout

## Post-Incident Requirements
- Root cause analysis document
- Preventive action items with owners
- CI/quality gate update if needed

## References
- `reports/ops/phased-rollout-plan.md`
- `.github/workflows/ci.yml`
