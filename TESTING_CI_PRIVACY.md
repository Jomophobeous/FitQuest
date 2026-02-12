# Testing, CI, and Privacy Review Checklist

Purpose
- Ensure FitQuest code quality, maintainability, and privacy compliance before collecting any telemetry.

Testing
- Unit tests: pipeline steps, fatigue updates, subscription gating
- Integration tests: end-to-end generate → record → update fatigue
- E2E tests: backup/restore, sync flows (Phase 2/3)

Minimal Test Scripts (package.json)

```json
"scripts": {
  "lint": "npm run typecheck",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --pool forks --maxWorkers 1 --no-file-parallelism --reporter basic"
}
```

CI (GitHub Actions)
- Run on `push` and `pull_request`
- Steps: checkout, setup node, install, lint, typecheck, test

Privacy Review
- Document exactly what is uploaded in Phase 4 and obtain legal sign-off
- Maintain a privacy whitelist of event fields allowed to upload
- Provide in-app consent toggle and a clear explanation

Acceptance Criteria
- All unit tests pass on CI
- Typecheck success on CI
- Privacy checklist signed off before telemetry toggled on

Created: 2026-02-05
