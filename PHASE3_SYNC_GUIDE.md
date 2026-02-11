# Phase 3 — Sync & Conflict-Resolution Guide

Purpose
- Enable cross-device continuity while keeping generation local and server-side logic minimal.

Principles
- Server stores outcome events and opaque state versions; client remains the source of truth for generation.
- Keep conflicts explicit and resolvable — prefer last-writer-wins for metadata, but provide merge UI for user-state.

Key Concepts
- Versioned State: Every client state blob includes a `version` (monotonic int) and `base_hash`.
- Operation Log: Client optionally sends small outcome events (completed_session references) rather than large blobs.
- Reconciliation: On sign-in, client fetches server-side latest version; if local `version` > server, upload; if server > local, prompt restore/merge.

Conflict Resolution Strategies
1. Simple: Timestamp-based last-write-wins (safe for metadata)
2. Merge-by-intent: For session/event logs, merge by unique event IDs (dedupe by UUID)
3. User-Driven: If state divergent (multiple profile changes), show a merge UI showing diffs and letting user pick

Versioning Schema
- `state_v1` includes: user_profile, muscle_fatigue_map, last_7_sessions (array of session IDs), created_at
- On each commit: increment `version`, set `base_hash` = sha256(serialized_state)

Sync Flow
1. Authenticate
2. Fetch `latest_state_meta` (version, hash, last_updated)
3. Compare local version
   - If local == server: no-op
   - If local > server: push full encrypted blob as backup (client wins)
   - If server > local: fetch server blob, attempt auto-merge by event dedupe
   - If merge ambiguous: surface UI to user

Event-Based vs Blob-Based
- Prefer event-based (append-only) for session outcomes: server stores events with UUIDs and timestamps; dedupe on sync
- Store full encrypted blob for authoritative restore points (daily backup)

Conflict Detection Heuristics
- Divergent profile (different goal/experience) → high-risk conflict → require user confirmation
- Simple session divergence (extra session events) → auto-merge
- Fatigue_map divergence → merge by taking max per-muscle fatigue and flag for review

Testing & Acceptance
- Simulate dual-device edits: Device A records 2 sessions offline, Device B records 3 sessions; both push when online → verify deduplication and correct order
- Test rollback: corrupt server blob → client ignores and forces re-upload after user confirmation

Privacy & Bandwidth
- Send lightweight event objects (exercise IDs, duration, success flag) instead of full prescriptions
- Backups remain encrypted blobs; server never decrypts

Developer Checklist
1. Implement event API for session outcomes (append-only)
2. Implement metadata endpoint for latest state meta
3. Implement client-side merge logic with event dedupe
4. Implement user merge UI for profile conflicts
5. Add E2E tests for sync, merge, and restore flows

Created: 2026-02-05
