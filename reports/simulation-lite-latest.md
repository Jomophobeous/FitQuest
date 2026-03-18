# Simulation Lite Report

- Generated at: 2026-03-11T15:26:57.141Z
- Overall: PASS
- Static contract checks: 8/8 passed

## Contract Checks
| Check | Result |
|---|---|
| route.platform-studio | PASS |
| route.autonomous-center | PASS |
| route.federation-hub | PASS |
| route.enterprise-hardening | PASS |
| menu.platform-studio | PASS |
| menu.autonomous-center | PASS |
| menu.federation-hub | PASS |
| menu.enterprise-hardening | PASS |

## Automated Flow
- `npm run verify:phase10:lite`
- `npx vitest run tests/adaptiveTrainingService.test.ts tests/phaseFoundation.test.ts tests/phase710Foundations.test.ts --reporter basic`