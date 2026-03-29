# Phase 16 — Trust Calibration Report

## Paradigm Shift

**Before (Phases 12–15)**: Continuous suspicion model. Signal absence = suspicious.
**After (Phase 16)**: Verification-driven adaptive defense. Offline = uncertainty. Online mismatch = contradiction.

**Core Principle**: Do not punish uncertainty. Only punish contradiction.

---

## Architecture Changes

### 1. Verification Confidence State (`tamperEngine.ts`)

New state: `verificationConfidence: 'low' | 'medium' | 'high'`

| Level  | Meaning                        | Entry Condition                             | Exit Condition           |
|--------|--------------------------------|---------------------------------------------|--------------------------|
| LOW    | Offline / no recent verification | Default on launch, >24h without verification | Network detected → MEDIUM |
| MEDIUM | Network present, partial verification | Connectivity signal, entitlement check     | AI round-trip → HIGH     |
| HIGH   | Full online verification        | Successful AI request+response cycle         | >24h offline → LOW       |

**Transitions are upgrade-only** within a single event. Demotion happens passively via 24h timeout.

### 2. Rule Gating by Confidence

| Rule                      | Confidence=LOW | Confidence=MEDIUM | Confidence=HIGH |
|---------------------------|:--------------:|:------------------:|:---------------:|
| PREMIUM_BYPASS            | ✅ Full (contradiction) | ✅ Full | ✅ Full |
| AI_WITHOUT_NETWORK        | ✅ Full (contradiction) | ✅ Full | ✅ Full |
| AI_RESPONSE_NO_TELEMETRY  | ❌ Disabled    | ✅ Full | ✅ Full |
| TELEMETRY_SILENCE         | ❌ Disabled    | ✅ Full | ✅ Full |
| DEAD_SIGNALS              | ❌ Disabled    | ✅ Full | ✅ Full |
| TELEMETRY_GAPS            | ❌ Disabled    | ✅ Full | ✅ Full |
| IMPOSSIBLE_CLEAN          | 🔸 30% weight | ✅ Full | ✅ Full |
| BEHAVIORAL_ANOMALY        | 🔸 30% weight | ✅ Full | ✅ Full |
| INTEGRITY_VIOLATION       | ✅ Full (code tampering) | ✅ Full | ✅ Full |

**Rules disabled at LOW**: All telemetry-dependent rules (4 rules).
**Rules weakened at LOW**: Behavioral rules at 30% additive weight (2 rules).
**Rules always active**: Contradiction rules + integrity checks (3 rules).

### 3. Risk Caps by Confidence

| Confidence | Max Risk Score | Can Reach HIGH? |
|------------|:-------------:|:---------------:|
| LOW        | 59 (HIGH-1)   | ❌ (unless contradiction rule fires with multiplier > 1.0) |
| MEDIUM     | 100           | ✅ |
| HIGH       | 100           | ✅ |

### 4. Degradation Gating (`degradation.ts`)

ALL degradation methods gated through `effectiveRisk()`:

| Check               | Requirement                                          |
|---------------------|------------------------------------------------------|
| Confidence gate     | `verificationConfidence >= 'medium'` required         |
| Stability window    | Score at threshold for ≥ 2 minutes                    |
| MEDIUM confidence   | Caps effective risk at 'medium' (no HIGH degradation) |
| HIGH confidence     | Full escalation allowed (sentinel can bump to HIGH)    |

**Result**: Offline users (confidence=LOW) experience **ZERO degradation**.

### 5. Accelerated Decay

When `confidence='low'` AND no sticky shadow flags triggered:
- Decay rate × 2 (10 pts / 5 min instead of 5 pts / 5 min)
- Legitimate users recover from transient false positives quickly

### 6. Stability Window

Score must persist at ≥ MEDIUM threshold (30) for 2 minutes before degradation engine applies any effects. Prevents transient score spikes from causing degradation.

Window resets when score drops below threshold.

### 7. Integration Triggers

| Integration Point | Confidence Trigger | Signal |
|-------------------|--------------------|--------|
| `aiProvider.ts` → successful cloud response | → HIGH | Proves online + functional pipeline |
| `PremiumGate.tsx` → TRIAL_ACTIVE/SUBSCRIBED | → MEDIUM | Entitlement check suggests verification |
| `sentinel.ts` → `sentinelRecordConnectivity(true)` | (feeds tamperEngine) | Network presence detected |

### 8. Persistence

- `verificationConfidence` and `lastVerificationTimestamp` persisted in SQLite `app_state` (key `__tds_v3`)
- On restore: if session gap > 24h → degrade to LOW
- On restore: if gap ≤ 24h → restore previous confidence level

---

## Validation Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Legit user, fully offline, 30min session | confidence=LOW, 4 telemetry rules disabled, risk ≤ 59, ZERO degradation |
| Legit user, opens app, uses AI chat | 1st request: confidence→HIGH, full rules enabled, degradation gated until stability window |
| Legit user, premium access offline | confidence=LOW, premium contradiction rule active, telemetry rules disabled |
| Attacker, patches telemetry, uses AI | AI succeeds → confidence=HIGH → telemetry rules now fire → TELEMETRY_SILENCE + DEAD_SIGNALS escalate score |
| Attacker, spoofs premium offline | PREMIUM_BYPASS fires (contradiction) at confidence=LOW, multiplier bypasses risk cap |
| Attacker, patches engine entirely | INTEGRITY_VIOLATION fires (always active), multiplier bypasses risk cap |
| Legit user after long offline → comes online | confidence starts LOW → AI call → HIGH, full evaluation resumes cleanly |
| Restart after 25h offline | Confidence decays to LOW regardless of previous state |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/services/security/tamperEngine.ts` | +`VerificationConfidence` type, +confidence state fields, +`updateVerificationConfidence()`, +`recordConnectivitySignal()`, +`getVerificationConfidence()`, +`isStabilityWindowSatisfied()`, +`applyConfidenceDecay()`, gated evaluate() rules by confidence, risk caps, stability window tracking, accelerated decay, persistence updates |
| `src/services/security/sentinel.ts` | +`sentinelRecordConnectivity()`, +`sentinelIsOnline()`, +connectivity fields in QualityMetrics |
| `src/services/security/degradation.ts` | Gated `effectiveRisk()` behind confidence + stability window, MEDIUM confidence caps at 'medium' risk |
| `src/services/security/index.ts` | Export `VerificationConfidence`, `sentinelRecordConnectivity`, `sentinelIsOnline` |
| `src/services/aiProvider.ts` | Trigger confidence→HIGH + connectivity signal after successful AI round-trip |
| `src/components/PremiumGate.tsx` | Trigger confidence→MEDIUM after entitlement check |

---

## Success Criteria

- [x] Zero false-positive degradation for offline users (confidence=LOW → effectiveRisk returns 'low')
- [x] Telemetry-absence rules disabled when offline (4 rules gated behind confidence != 'low')
- [x] Behavioral rules weakened to 30% offline (IMPOSSIBLE_CLEAN, BEHAVIORAL_ANOMALY)
- [x] Contradiction rules always active regardless of confidence (PREMIUM_BYPASS, AI_WITHOUT_NETWORK, INTEGRITY_VIOLATION)
- [x] Risk capped at 59 for confidence=LOW (cannot reach HIGH threshold)
- [x] Contradiction multiplier bypasses risk cap (multiplier > 1.0 escapes cap)
- [x] Stability window (2min) prevents transient degradation
- [x] Accelerated decay (×2) for LOW confidence + no sticky flags
- [x] Confidence persists across sessions, decays after 24h
- [x] Successful AI call → HIGH confidence (verification window)
- [x] Entitlement check → MEDIUM confidence
- [x] TypeScript: 0 errors

## System Classification

**Client-Side Tier 3 — Verification-Driven Adaptive Defense**

- 9 rules (4 confidence-gated, 2 confidence-weakened, 3 always-active)
- 10 shadow flags
- 3 verification confidence levels
- 2-minute stability window
- ×2 accelerated decay for legitimate users
- 24h confidence decay timeout
- ×3.85 max shadow amplification (unchanged)
- Hard ceilings on degradation (unchanged)
- Zero false-positive degradation for offline users
