# Architecture Decision Records

## ADR-001: AES-256-GCM Migration Strategy
Status: Implemented
**Context:** Current CTR+HMAC crypto violates security policy.
**Decision:** Introduce v3 payload using AES-256-GCM with auto-migration on read from v2.
**Consequences:**
- Positive: Compliance with security requirements.
- Risk: Migration overhead on first read of legacy data.
- Migration: Transparent to users, no data loss with dual-read.

## ADR-002: AsyncStorage Elimination
Status: Implemented
**Context:** Policy violation and data leakage risk.
**Decision:** Migrate persistent preferences and tokens to SecureStore or SQLite app_state.
**Mapping:**
- Theme prefs → SecureStore or app_state
- Language prefs → SecureStore or app_state
- Auth tokens → SecureStore
- Offline cache → SQLite table (network_cache) or removal

## ADR-003: Single Source of Truth for Schema
Status: Implemented
**Context:** FitMind schema defined in multiple locations causing drift.
**Decision:** All table creation lives in database/schema.ts; FitMind service only contains CRUD.
**Consequences:**
- Positive: Eliminates schema mismatch and runtime SQL errors.
- Risk: Requires migration for existing installs.

