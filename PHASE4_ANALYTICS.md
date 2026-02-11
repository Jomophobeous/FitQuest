# Phase 4 — Aggregated Analytics Plan

Purpose
- Collect anonymized aggregate metrics to improve defaults and detect algorithm blind spots without per-user personalization.

What to Collect (anonymized)
- Completion rates by goal/experience
- Failure points per exercise
- Volume tolerance ranges (sets/reps achieved)
- Session durations and adherence

Privacy Constraints
- Only collect anonymized, aggregated metrics; never send user-identifying state.
- Use differential privacy or k-anonymity thresholds before exposing any aggregated result.
- Require explicit user consent before any telemetry is transmitted.

Data Pipeline (high level)
1. Client collects lightweight event objects (exercise ID, success flag, sets completed, timestamp)
2. Client batches and uploads anonymized events to ingestion endpoint
3. Backend aggregates into daily/weekly buckets and computes metrics
4. Aggregates drive tuning suggestions pushed as config (not personalized models)

Aggregation Rules
- Minimum group size before including dataset (e.g., min 100 events)
- No retention of raw event logs beyond short window (e.g., 30 days)
- Only expose aggregated trends, not per-user sequences

Use Cases
- Adjust default base_sets or rep ranges when aggregated completion rates indicate under/overload
- Detect exercises with high failure rates and flag variants
- Identify populations (by goal/experience) where progression stalls

Developer Checklist
1. Design event schema for anonymized uploads
2. Add user consent flow and settings toggle
3. Build ingestion pipeline (server-side) to aggregate metrics
4. Implement reporting dashboard (internal) for product/ops review
5. Add privacy-preserving aggregation (thresholding/differential privacy)

Exit Criteria
- Evidence that aggregated tuning materially improves retention or success rates in A/B tests

Created: 2026-02-05
