# Phase 24B — Stress & Break Test Report

**Date**: 2026-03-31  
**Target**: Local server (`localhost:3002`) — Express v5.2.1 + Supabase  
**Server**: FitQuest Authority v2.7.0 (Phase 23 Hardened)  
**Test harness**: `scripts/test-stress.mjs`

## Summary

| Metric | Value |
|--------|-------|
| Total tests | 21 |
| Passed | **21** |
| Failed | **0** |
| Server crashes | 0 |
| Data corruption | 0 |

## Results

### S1: Burst Sequential Requests (20 rapid verifications)
- **Result**: ✅ PASS
- All 200 OK, avg latency 2157ms (Supabase round-trip)
- Min 1417ms, Max 4568ms

### S2: Rate Limit Trigger (65 concurrent requests)
- **Result**: ✅ PASS
- 39 accepted (200), 26 rejected (429)
- Rate limiter correctly enforces 60 req/min window
- **Note**: Initial test used sequential requests (1.7s each), which couldn't saturate the 60s window. Fixed to concurrent burst.

### S3: Parallel Concurrent Requests (10 simultaneous)
- **Result**: ✅ PASS
- All 200 OK, max latency 6282ms
- No race conditions, no duplicates

### S4: Invalid Payload Shapes (5 tests)
- **Result**: ✅ PASS (all 5)
- `user_id` as number → 400
- Empty `user_id` → 400
- Extra fields (including `__proto__`) → ignored, 200
- `timestamp` as string → 403
- Null fields → 400

### S5: Rapid Device Switching (5 unique devices)
- **Result**: ✅ PASS
- All 200 OK, all flagged `untrusted: true`
- Anomaly detection working correctly

### S6: Timestamp Boundary (3 tests)
- **Result**: ✅ PASS (all 3)
- 4m55s ago → 200 (within 5min window)
- 5m10s ago → 403 (outside window)
- 5min future → 200 (server allows reasonable clock skew)

### S7: Large Payload Rejection (150KB)
- **Result**: ✅ PASS
- Returns 413 (Payload Too Large)
- **Fix applied**: Added `entity.too.large` handler to global error middleware in `server/index.js`

### S8: Injection Resistance (2 tests)
- **Result**: ✅ PASS
- SQL injection (`'; DROP TABLE users; --`) → handled safely (Supabase parameterized)
- XSS (`<script>alert(1)</script>`) → 400 (missing fields)
- No server crashes, no data corruption

### S9: Concurrent Duplicate User Creation (3 simultaneous)
- **Result**: ✅ PASS
- 1 created (201), 2 rejected (409)
- Zero 500s — Supabase unique constraint works correctly under concurrency

### S10: Signature Tampering (5 variants)
- **Result**: ✅ PASS (all 5)
- Flipped byte → 403
- Truncated signature → 403
- Empty signature → 400
- Wrong `user_id` → 403
- Swapped `device_id` → 403

## Server-Side Fix Applied

**`server/index.js` — Global error handler enhancement**:
- Added `entity.too.large` → 413 response
- Added `entity.parse.failed` → 400 response (malformed JSON)
- Preserved generic 500 fallback for unknown errors
- Uses `err.status` propagation for Express-native errors

## Findings

### Rate Limiter Behavior
The in-memory rate limiter (60 req/min per IP) works correctly under concurrent load. Sequential requests at 1.5s+ intervals can never saturate the window — this is by design, not a bug.

### Anomaly Detection
Device switching correctly flags `untrusted: true` for every new device after the first. The server logs anomalies without blocking the request.

### Concurrent Safety
- Duplicate user creation handled by Supabase's unique constraint (409 Conflict)
- Parallel device verifications safe — no race conditions observed
- No data corruption under any tested scenario

### Attack Surface
- SQL injection: neutralized by Supabase's parameterized queries
- XSS: rejected at validation layer (missing required fields)
- Signature tampering: all 5 variants correctly rejected with 403
- Oversized payloads: now properly rejected with 413

## Render Deployment Note

All tests ran against **local server** (localhost:3002). Render deployment (`fitq-oxp9.onrender.com`) has mismatched Supabase credentials — all Supabase operations return 500. **Action required**: Update Render environment variables with correct `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Phase 24 Cumulative Results

| Test Suite | Result |
|------------|--------|
| Integration (11 tests) | 11/11 PASS (local) |
| Kill chain (6 tests) | 6/6 PASS (local) |
| Stress & break (21 tests) | 21/21 PASS (local) |
| **Total** | **38/38 PASS** |
