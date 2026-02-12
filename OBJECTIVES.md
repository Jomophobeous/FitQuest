# FitQuest — Multi-Phase Execution Plan

This document captures the strategic roadmap for FitQuest as a system (not an app). Each phase unlocks the next — do not skip phases.

## Phase Dependency Map

Phase 1 → Phase 2 → Phase 3
          ↓
        Phase 4 → Phase 5
                      ↓
                   Phase 6
                      ↓
                   Phase 7
                      ↓
                   Phase 8
                      ↓
                   Phase 9
                      ↓
                   Phase 10

Skipping Phase 2 (persistence) or Phase 4 (aggregation) will break later phases.

---

## Phase 1 — Local Dominance (DONE / LOCKED)

Objective
- Prove the core loop works entirely client-side.

Stack / Guarantees
- Client-only, deterministic generator
- SQLite (local) for state/history
- Subscription enforcement local with offline grace

Success Signals / Exit Condition
- Users return without reminders
- Streaks survive breaks
- Algorithm feels “personal”
- Users explicitly request: Backup, Sync, Sharing, Competition

---

## Phase 2 — State Persistence (Minimal Backend)

Objective
- Prevent data loss; enable device migration.

Added Capabilities
- Cloud backup and restore
- Encrypted user-state storage
- Minimal auth (email / Apple / Google)

What You Must NOT Add
- Business logic on server
- Workout generation on server
- Social features (leaderboards, messaging)

Backend Scope
- CRUD only (store encrypted user state)
- Tech options: Supabase, Firebase, or minimal custom API
- DB: PostgreSQL (user state only)

Exit Condition
- Users trust the app for long-term history
- Multi-device usage becomes common

---

## Phase 3 — Cross-Device Continuity

Objective
- Make FitQuest a persistent identity across devices.

New Capabilities
- Near-real-time or sync-on-demand
- Seamless device switching

Important Changes
- Conflict resolution policy
- Versioned state updates & session reconciliation
- Server stores outcomes only (no generation)

Exit Condition
- Users expect continuity everywhere; power users emerge

---

## Phase 4 — Aggregated Intelligence

Objective
- Learn from anonymized patterns to tune defaults.

What to Collect (anonymized)
- Completion rates, failure points, volume tolerances

Use Cases
- Tune defaults and progression curves
- Detect algorithm blind spots

Constraints
- No per-user model training
- No black-box personalization
- Backend role: analytics & aggregation only

Exit Condition
- Demonstrable evidence some paths outperform others

---

## Phase 5 — Adaptive Systems

Objective
- Make FitQuest feel intelligent while staying interpretable.

New Capabilities
- Adaptive deload timing
- Personalized progression curves
- Per-user fatigue sensitivity (lightweight, interpretable models)

Key Constraint
- User can understand why changes occur (no opaque AI)

Exit Condition
- Users describe the app as “knowing me”

---

## Phase 6 — Social Layer (Optional, Dangerous)

Objective
- Add opt-in social features for network effects only after retention is strong.

Possible Features
- Opt-in leaderboards, guilds, asynchronous competition

Rules
- Solo experience remains intact
- Social features never block progression

Risk
- Toxic comparison, motivation collapse for average users

---

## Phase 7 — Platformization

Objective
- Offer FitQuest as a system other creators build on.

Capabilities
- Coach tools, custom program builders, SDK/API

Note
- This is a company / product-stage change, not a build-stage change.

---

## Phase 8 — Autonomous Operations

Objective
- Add policy-driven automation loops for adaptation, rollout, and guardrails.

Capabilities
- Safety-mode policies for auto-adjustments
- Decision audit trails with rationale
- Human-review gates for risky changes

Constraint
- Never allow opaque fully autonomous progression changes without interpretable policy checks.

---

## Phase 9 — Ecosystem Federation

Objective
- Open FitQuest to partner integrations while preserving privacy and local-first guarantees.

Capabilities
- Scoped import/export contracts
- Integration registry with certification tiers
- Federation policy enforcement

Constraint
- Integrations cannot bypass consent, encryption, or schema governance.

---

## Phase 10 — Enterprise Hardening

Objective
- Reach enterprise-grade reliability, governance, and compliance posture.

Capabilities
- SLO/SLA targets and risk scoring
- Control automation for key rotation, backup drills, privacy audits
- Multi-tenant and operational governance foundations

Constraint
- Hardening must not degrade on-device usability or offline-first behavior.

---

## Strategic Truths (Why this roadmap)
- Most fitness apps fail by adding social too early, adding AI without data, or centralizing logic prematurely.
- Maintain client-driven generation; add server roles only for storage, aggregation, and non-personalized analytics.

---

## Tactical Next Steps (short-term)
1. Integrate this file into the repo root as authoritative objectives.
2. Implement Phase 2 checklist: auth, encrypted backups, manual restore UI, minimal CRUD endpoints or Supabase project.
3. Add CI checks and privacy review for Phase 4 data pipeline before any telemetry is collected.

---

## Ownership
- Product: defines phase exit criteria
- Engineering: enforces the technical boundaries by phase
- Privacy & Legal: signs off on any anonymized collection in Phase 4

---

Created: 2026-02-05

