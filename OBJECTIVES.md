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

## Current State Snapshot (2026-02-17)
- Phase 1 core loop is done and locked — client-only deterministic workout generation works.
- Phase 2-6 core capabilities are implemented with verification pipelines.
- Phase 7-10 screens exist as runtime scaffolds — **not user-facing features**. These screens (Platform Studio, Autonomous Center, Federation Hub, Enterprise Hardening) are registered but intentionally have no navigation paths. They remain hidden and will not ship to end-users.
- Language switching exists via `LanguageContext`, but localization coverage is partial and inconsistent across screens.
- Meal Prep has GPS/location filtering with manual region override in Profile → Preferences.
- Privacy/Legal controls exist in Profile → Privacy & Legal section (consent, export, delete, legal center).
- Health Dashboard is accessible via the dropdown menu.
- Profile screen is organized into: Training Profile, Adaptive Training, Preferences, Privacy & Legal, App Info.

---

## 2026-Q1 Priority Objectives (Execution Plan)

### Progress Snapshot (2026-02-17)
- Objective 1 — App-Wide Responsive Language System: **95%**
   - Complete: critical routes localized + regression gate (`verify:i18n:p0`) added.
   - Remaining: full non-critical route sweep + locale formatting consistency pass.
- Objective 2 — Regional Meal Prep Controls (Auto + Manual): **100%**
   - Complete: manual override in Profile → Preferences, precedence logic, persistent active-region indication.
- Objective 3 — Legal & Data-Protection Readiness: **99%**
   - Complete: in-app Legal Center (dedicated screen) + Privacy/Terms screens + consent version/timestamp storage + legal draft documents. Legal items grouped under Profile → Privacy & Legal section.
   - Remaining: store-console legal URL alignment + counsel final review.
- Objective 4 — Cache/State/Offline Reliability: **82%**
   - Complete: foundational local-first persistence/sync scaffolding, cache policy/store baseline, replay handlers for legal consent + backup upload + sync-on-demand, centralized replay orchestrator with cooldown, sync queue fallback on failures, notification reliability reconciliation at app startup, and automated notification reliability wiring verification.
   - Remaining: full domain-wide TTL/invalidation rollout + additional mutation handlers and retry/backoff tuning.
- Objective 5 — Notifications/Performance/CI-CD/Delivery Ops: **87%**
   - Complete: CI baseline, telemetry groundwork, core quality scripts, CI gate hardening (`verify:quality:110`, `verify:phase10:lite`, `verify:mealprep:text-safety`, `verify:notifications:reliability`, `verify:performance:budget`, `verify:ops:readiness`), native notification permission/scheduling wiring, rollout/rollback runbooks, older-device execution evidence tracking, and rollout stage execution logging.
   - Remaining: real-device reminder delivery verification and staged rollout sign-off.
- **Objective 6 — Navigation & UX Architecture: 100%** *(NEW — completed 2026-02-17)*
   - Registered missing screens in layout (legal-center, privacy-policy, terms-of-service).
   - Added Health Dashboard and Craft My Body to dropdown menu for discoverability.
   - Reorganized Profile screen: Preferences (UI settings) | Privacy & Legal (consent, data rights) | App Info (backup, help, about).
   - Fixed About FitQuest action (was no-op, now shows app info dialog).
   - Phase 7-10 ghost screens remain registered but intentionally hidden (no navigation paths).

### 1) App-Wide Responsive Language System
Objective
- Make language changes immediate and consistent across all user-facing UI.

Deliverables
- 100% UI string audit with all user-visible text routed through `t()` keys.
- Language readiness gate for new screens (no hardcoded literals in production routes).
- Locale-aware formatting for date/time/numbers where relevant.

Exit Criteria
- Language switch reflects across all tabs/screens without stale text.
- No untranslated hardcoded strings in `app/` critical routes.

### 2) Regional Meal Prep Controls (Auto + Manual)
Objective
- Let users control food-region mapping even when GPS is unavailable or undesired.

Deliverables
- Settings option for manual region override (stored in SecureStore or SQLite `app_state`).
- Priority logic: manual override > auto-detected location > global fallback.
- Clear Meal Prep banner indicating active region with one-tap change entry.

Exit Criteria
- User can switch region explicitly and see food list update immediately.

### 3) Legal & Data-Protection Readiness
Objective
- Ship minimum required legal/compliance surfaces for health/fitness distribution.

Deliverables
- In-app Legal Center with Privacy Policy + Terms of Service links/content.
- Consent versioning: store accepted policy version + timestamp per user.
- User rights flows consolidated: export, deletion request, consent withdrawal path.

Exit Criteria
- Legal docs are reachable in-app and store metadata is aligned.
- Consent and data-rights actions are auditable.

### 4) Cache/State/Offline Reliability
Objective
- Standardize caching and state persistence to improve performance and resilience.

Deliverables
- 3-layer cache policy documented and implemented: in-memory UI state, SQLite/app_state persistence, server sync queue.
- TTL/invalidation rules per data domain (workouts, analytics, meal prep, profile).
- Offline mutation queue with replay + dedupe strategy for sync-safe writes.

Exit Criteria
- Predictable offline behavior and reduced redundant reads.

### 5) Notifications, Performance, CI/CD, and Delivery Ops
Objective
- Improve runtime reliability and release velocity.

Deliverables
- Push reliability baseline (permission UX, local reminders, delivery/error instrumentation).
- Performance budget and profiling pass for startup/list rendering/sensor workloads.
- CI/CD hardening for regression checks and deterministic release flow.
- Feature request intake workflow (in-app capture → triage queue → roadmap link).

Exit Criteria
- Reproducible release pipeline and measurable runtime improvements.

### 6) Navigation & UX Architecture *(COMPLETED)*
Objective
- Ensure every feature is discoverable through intuitive, well-organized navigation and that the profile screen follows standard mobile UX patterns.

Deliverables
- All screens registered in the Expo Router layout file.
- Health Dashboard and Craft My Body accessible from the dropdown menu.
- Profile screen organized into logical subsections: Training Profile, Adaptive Training, Preferences, Privacy & Legal, App Info.
- Legal/privacy items grouped under a dedicated section — not mixed into general preferences.
- About FitQuest action displays real app information.
- Phase 7-10 scaffold screens remain hidden (no user-facing navigation paths).

Exit Criteria
- Every user-facing feature can be reached within 2 taps from a main screen.
- No orphaned/inaccessible screens (except intentionally hidden scaffolds).
- Profile settings are logically grouped by domain.

---

## Jurisdictional/Store Compliance Baseline
- Apple App Store: in-app and store-linked privacy policy, health-data handling disclosures, account deletion support, explicit consent UX where required.
- Google Play: Data safety accuracy, in-app prominent disclosure/consent for sensitive data, privacy policy in-console + in-app, account deletion pathway.
- GDPR (health data as special category): explicit consent basis and clear purpose boundaries for health processing.
- CCPA/CPRA: rights handling for know/delete/correct/limit as applicable, with required notices and non-discrimination handling.
- Final legal text must be reviewed and approved by qualified counsel before release.

---

## Ownership (Updated)
- Product: phase exit criteria, roadmap prioritization, and feature request triage.
- Engineering: technical implementation, verification pipelines, and operational reliability.
- Privacy & Legal: policy text ownership, jurisdiction review, and consent/data-rights governance.

---

Created: 2026-02-05
Updated: 2026-02-17

