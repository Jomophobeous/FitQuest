# Ticket Backlog

## P0 - Critical (Block Release)

### TICKET-001: Fix FitMind Schema Mismatch
**Acceptance Criteria:**
- [x] Single source of truth in database/schema.ts
- [x] All queries use canonical column names
- [x] Migration handles existing user data
- [x] No SQL errors on FitMind screen launch

### TICKET-002: Encrypt Health Metrics
**Acceptance Criteria:**
- [x] Heart rate data stored via encryptedDB
- [x] No plaintext health metrics in SQLite
- [x] Read path decrypts correctly

### TICKET-003: Remove AsyncStorage Usage
**Acceptance Criteria:**
- [x] Theme and language preferences stored in SecureStore or SQLite
- [x] Apollo auth token stored outside AsyncStorage
- [x] offline-cache removed or migrated

### TICKET-004: AES-256-GCM Migration
**Acceptance Criteria:**
- [x] v3 payload format implemented
- [x] v2 payload auto-migrates on read
- [x] Encrypted DB can read/write v3

### TICKET-005: SQL Governance Cleanup
**Acceptance Criteria:**
- [x] No raw SQL outside database/schema.ts or database/service.ts
- [x] FitMind table creation removed from fitmind/schema.ts
- [x] trial_state moved into schema.ts

## P1 - High

### TICKET-006: secureDelete Table Whitelist
**Acceptance Criteria:**
- [x] Table input validated or whitelisted
- [x] No dynamic SQL injection risk

### TICKET-007: RevenueCat Production Wiring
**Acceptance Criteria:**
- [x] Real API keys loaded from Expo env
- [x] Entitlements validated
- [x] Restore purchases verified

### TICKET-008: Add Lint/Test Scripts
**Acceptance Criteria:**
- [x] package.json includes lint, test, typecheck
- [x] CI runs lint/test successfully

## P2 - Medium

### TICKET-010: Observability
**Acceptance Criteria:**
- [x] Local telemetry active (on-device)
- [x] Global error boundary wired
- [x] Crash reporting configured (external)
- [x] Performance metrics captured (external / remote)

### TICKET-011: ML Performance Benchmarks
**Acceptance Criteria:**
- [x] Benchmark harness for model inference
- [x] Reported latency for key models

## P3 - Low

### TICKET-012: RNG Cleanup
**Acceptance Criteria:**
- [x] Security-sensitive IDs use expo-random
- [x] Non-sensitive randomness documented
