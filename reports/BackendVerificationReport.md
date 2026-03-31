# Phase 18: Backend-Assisted Verification — Execution Report

**Date**: 2025-07-27  
**Mode**: `full_autonomous`  
**Phase**: 18 of Tamper Detection Engine hardening  
**Status**: ✅ COMPLETE — 0 TS errors  

---

## Objective

Integrate optional server-side validation to strengthen offline-first security without affecting UX. Backend is advisory: only strengthens confidence, never blocks or degrades users offline.

## Architecture Decision

**Offline autonomy guarantee**: The system remains fully functional with zero server connectivity. Bridge verification is opportunistic, throttled, and timeout-protected. A null response from `dispatchBridgeVerification()` is treated as a no-op — no state changes, no degradation, no UX impact.

**Advisory-only server authority**: Server responses can only:
- Confirm contradictions (set shadow flags, amplify risk)
- Clear false-positive flags (reduce risk)
- Provide entitlement ground truth (RevenueCat server-side verification)
- Boost confidence (never lower below current level)
- Apply reconciliation directives (correct offline activity)

Server CANNOT: block users, force degradation without client evidence, lower confidence, or override the offline risk cap.

## Files Modified (6)

### 1. `src/services/security/securityBridge.ts` — Major Overhaul

**New types**:
| Type | Purpose |
|------|---------|
| `BridgeVerificationRequest` | Client → server snapshot (metrics, signals, flags, reconciliation batches) |
| `BridgeVerificationResponse` | Server → client (confirmed contradictions, entitlement truth, confidence boost, flag overrides) |
| `BridgeMetrics` | Verification tracking (attempts, successes, failures, corrections, response times) |

**New functions**:
| Function | Purpose |
|----------|---------|
| `shouldAttemptVerification()` | Throttle + in-flight guard (max 1 per 2 min) |
| `isBridgeAvailable()` | Server reachability check (10 min window) |
| `dispatchBridgeVerification(request)` | Async dispatch with timeout protection (5s). **Stub: returns null** |
| `recordVerificationSuccess(response)` | Metrics update + reconciliation batch cleanup |
| `getLastVerificationResponse()` | Accessor for last server response |
| `getBridgeMetrics()` | Monitoring/debugging accessor |

**State additions**: `lastVerificationResponse`, `lastVerificationAttempt`, `metrics`, `verificationInFlight`.

**Constants**: `BRIDGE_VERIFICATION_THROTTLE_MS` (2 min), `BRIDGE_TIMEOUT_MS` (5s), `BRIDGE_AVAILABILITY_WINDOW_MS` (10 min).

### 2. `src/services/security/tamperEngine.ts` — Bridge Integration

**New methods**:
| Method | Purpose |
|--------|---------|
| `getStateSnapshot()` | Packages full engine state into `BridgeVerificationRequest` |
| `applyBridgeVerification(response)` | Applies server response: flag overrides, risk adjustment, confidence boost, entitlement truth, reconciliation |
| `requestBridgeVerification()` | Fire-and-forget dispatch with throttle + confidence gate (≥ medium) |

**evaluate() modification**: After existing bridge consultation block, opportunistically triggers `requestBridgeVerification()` when confidence ≥ medium and throttle allows.

**applyBridgeVerification constraints**:
- Contradiction confirmation: only accepts known rules (`PREMIUM_BYPASS`, `AI_WITHOUT_NETWORK`, `INTEGRITY_VIOLATION`)
- Risk adjustment: capped at ±`RECONCILIATION_MAX_CORRECTION` (25 pts)
- Confidence: only boosted, never lowered below current
- Flag clearing: only boolean flags, not numeric counters
- Entitlement truth: applied through existing `updateEntitlementState()`

### 3. `src/services/aiProvider.ts` — Opportunistic Trigger

- **Success path** (line ~798): After AI round-trip + confidence → HIGH, triggers `requestBridgeVerification()` (fire-and-forget)
- **Failure path** (catch block): Calls `recordConnectivityFailure()` for network reliability tracking

### 4. `src/components/PremiumGate.tsx` — Opportunistic Trigger

- **TRIAL_ACTIVE/SUBSCRIBED path**: After confidence → medium, triggers `requestBridgeVerification()` (fire-and-forget)

### 5. `src/services/security/index.ts` — Barrel Exports

Added exports: `shouldAttemptVerification`, `isBridgeAvailable`, `dispatchBridgeVerification`, `recordVerificationSuccess`, `getLastVerificationResponse`, `getBridgeMetrics`, `BridgeVerificationRequest`, `BridgeVerificationResponse`, `BridgeMetrics`.

## Verification Flow

```
AI Success / Entitlement Check
  ↓
tamperEngine.requestBridgeVerification()
  ↓  [confidence gate: ≥ medium]
  ↓  [throttle gate: ≥ 2 min since last]
  ↓  [in-flight guard: no duplicate]
  ↓
dispatchBridgeVerification(snapshot)
  ↓  [STUB: returns null → no-op]
  ↓  [FUTURE: fetch → server → response]
  ↓
response !== null?
  → applyBridgeVerification(response)
    → confirm contradictions → set shadow flags
    → clear false positives → reduce risk
    → entitlement truth → update state
    → confidence boost (only up, never down)
    → reconciliation directive → correct offline activity
    → recordVerificationSuccess() → metrics
  
response === null?
  → silent no-op → system unchanged
```

## Guard Summary

| Guard | Mechanism | Purpose |
|-------|-----------|---------|
| Throttle | 2 min minimum interval | Prevent excessive network usage |
| In-flight dedup | Boolean flag | No concurrent dispatches |
| Timeout | 5s hard limit | No hanging requests |
| Confidence gate | ≥ medium to dispatch | Don't waste offline network attempts |
| Risk cap | ±25 pts server adjustment | Server cannot wildly swing client score |
| Confidence floor | Never lower below current | Server advisory only, cannot weaken |
| Flag type check | Only boolean flags cleared | Numeric counters preserved |
| Rule whitelist | Only known contradiction rules | Server cannot inject arbitrary flags |
| Null safety | null response = no-op | Complete offline autonomy |

## Metrics Tracked

| Metric | Purpose |
|--------|---------|
| `verificationAttempts` | Total dispatch attempts |
| `successes` | Successful server responses processed |
| `failures` | Network/timeout/parse failures |
| `lastSuccessTimestamp` | Recency of server contact |
| `offlineToOnlineCorrections` | Reconciliation directives applied |
| `contradictionConfirmations` | Server-confirmed contradiction count |
| `avgResponseTimeMs` | Rolling average (last 10 samples) |

## Constraint Compliance

| Constraint | Status |
|------------|--------|
| Execution determinism | ✅ No duplicate dispatches (in-flight guard + throttle) |
| State integrity | ✅ Single source: tamperEngine state. Server is advisory only |
| Render stability | ✅ Fire-and-forget async — no render triggers |
| Timing independence | ✅ Throttle-based, not setTimeout-based |
| Validation enforcement | ✅ tsc --noEmit passes with 0 errors |
| Offline autonomy | ✅ null response = no-op, zero UX impact |
| Security | ✅ Server cannot lower confidence, cannot force degradation without evidence |

## Server Activation Path

When backend is deployed, replace the stub block in `dispatchBridgeVerification()` (marked with `SERVER STUB` comment) with:
1. `fetch(BRIDGE_ENDPOINT, { method: 'POST', body: JSON.stringify(request), signal: controller.signal })`
2. Parse response as `BridgeVerificationResponse`
3. Everything else works automatically — tamperEngine applies response, metrics track, flags update

## TypeScript Validation

```
npx tsc --noEmit --pretty → 0 errors
```

## Next Phase Candidates

1. **Phase 19: Telemetry Correlation Engine** — Cross-reference PostHog telemetry with tamper signals for statistical anomaly detection
2. **Phase 19: Server-Side Reconciliation Worker** — Backend service that processes ReconciliationBatch queues and returns authoritative directives
3. **Phase 19: Multi-Device Trust Propagation** — Share trust scores across user's devices via server bridge
