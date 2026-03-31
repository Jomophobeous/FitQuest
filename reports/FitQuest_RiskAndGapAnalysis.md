# FitQuest 2.0 — Risk & Gap Analysis

> **Version**: 2.3.0 | **Schema**: v20 | **Composite Health Score**: 72/100
> **Production Verdict**: CONDITIONAL YES
> **Generated**: 2026-03-25

---

## 1. Risk Summary

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 1 | OPEN |
| **HIGH** | 5 | 4 OPEN, 1 BY DESIGN |
| **MEDIUM** | 6 | 3 OPEN, 2 TECH DEBT, 1 RATCHETED |
| **LOW** | 3 | 3 OPEN |
| **Total** | 15 | |

---

## 2. CRITICAL Risks

### R-001: AI API Keys Exposed in Client Bundle

**Severity**: CRITICAL | **Status**: OPEN

EXPO_PUBLIC_GROK_API_KEY, EXPO_PUBLIC_GROQ_API_KEY, and EXPO_PUBLIC_OPENROUTER_API_KEY are embedded in the JavaScript bundle. Any user can extract keys from APK/IPA.

**Impact**: API key theft → unlimited billing → data exfiltration via attacker prompts.

**Affected**: [src/ai/aiProvider.ts](../src/ai/aiProvider.ts), [app.config.ts](../app.config.ts)

**Mitigation**: Move AI calls to a backend proxy. Rate-limit per user on server side. Use short-lived tokens.

---

## 3. HIGH Risks

### R-002: Health Connect Disabled on Android

Package installed, adapters written, feature flag `ff_health_sync` = false. Android users have zero health data integration while iOS HealthKit works fine.

**Mitigation**: Enable flag → test permissions flow → data consent UI.

---

### R-003: 20+ Silent .catch(() => {}) Blocks

At least 20 empty catch blocks silently swallow errors. Production failures become invisible.

**Mitigation**: Replace with `.catch(e => logger.warn(...))`. Add Sentry breadcrumbs for critical paths.

---

### R-004: No Push Notification System

No notifications infrastructure. No workout reminders, streak alerts, trial expiry warnings, or re-engagement.

**Impact**: 30-day retention drops substantially. Trial conversion suffers.

**Mitigation**: expo-notifications with local scheduling for workout reminders + streak preservation.

---

### R-005: No Backend Server

Entire app is client-only. Cannot: protect AI keys, sync cross-device, validate receipts server-side, send push, aggregate analytics.

**Status**: BY DESIGN (shipping v1 client-only). Phase 10+ roadmap.

---

### R-006: Deprecated Modules Still Imported

5 deprecated modules still imported by active code:

| Deprecated Module | Imported By | Bundle Impact |
|-------------------|-------------|---------------|
| `socialLayerService.ts` | `app/profile.tsx` | Dead import |
| `aiWorkoutService.ts` | `app/coach/index.tsx` | Dead import |
| `TransformerRuntime.ts` | `app/professor/index.tsx` | 48MB dead weight |
| `MindSessionEngine.ts` | `MindExerciseView.tsx` | Dead import |
| `DistanceEngine.ts` | `JogMap.tsx` | Dead import |

**Mitigation**: Remove all deprecated imports. Delete unused files.

---

## 4. MEDIUM Risks

### R-007: 58 react-hooks/exhaustive-deps Violations
ESLint reports 58 missing dependencies. Stale closures and missed re-renders. Ratcheted at 804 total warnings.

### R-008: FitMind Tables Still in Schema
6 FitMind tables in schema v20 but module deprecated. Wasted storage + migration overhead.

### R-009: schema.ts Monolith (1700 lines)
All 20 migration versions in one file. Hard to review, merge conflict magnet.

### R-010: No E2E Test Suite
807 unit/integration tests but no Detox/Maestro/Appium. UI regressions caught only manually.

### R-011: Dual Workout Engine (v1 + v2)
workoutGenerator.ts (v1) coexists with v2 modular engine via legacyAdapter. Two code paths, double maintenance.

### R-012: Cloud Backup Service Placeholder
cloudBackupService.ts references non-existent EXPO_PUBLIC_API_BASE_URL. Cloud backup non-functional.

---

## 5. LOW Risks

### R-013: Platform Stub Files
3 empty stub files in `src/platform/` (phase8, phase9, phase10). Code clutter only.

### R-014: Legal Text English-Only
Privacy policy and terms are English-only despite 15-language UI. Compliance risk in non-English markets.

### R-015: AI Template Responses English-Only
Offline AI coaching templates only in English. Non-English users get English fallbacks when API unavailable.

---

## 6. Feature Gaps

### Missing Features

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Push Notifications | HIGH | Medium | No reminders, streak alerts, trial expiry. Critical for retention. |
| Backend Server / API Proxy | HIGH | Large | AI key protection, sync, webhooks, push tokens. |
| Health Connect (Android) | HIGH | Small | Installed but disabled. Enable flag + test. |
| E2E Testing | MEDIUM | Medium | No UI automation. 5-10 Maestro flows needed. |
| Cross-Device Sync | MEDIUM | Large | All data local. Device loss = data loss. |
| Offline AI Localization | LOW | Small | 20 templates × 14 languages. |
| Social Features | LOW | Large | Leaderboards, sharing, challenges — requires backend. |

### Partial Implementations

| Module | Completion | Status |
|--------|------------|--------|
| Health Connect | 90% code, 10% testing | DISABLED (flag off) |
| Cloud Backup | 20% (client shell) | PLACEHOLDER |
| Workout Engine v2 | 85% (runs via adapter) | ACTIVE via bridge |
| FitMind | Stripped | DEPRECATED — needs deletion |
| Professor AI | Merged into Coach | DEPRECATED — screen/imports need cleanup |

---

## 7. Redundancies

| Pair | Recommendation |
|------|---------------|
| workoutGenerator.ts (v1) ↔ engines/workout/ (v2) | Complete v2 migration, remove v1 + adapter |
| syncService.ts ↔ dataSyncService.ts | Delete syncService.ts |
| Card.tsx ↔ GlassCard (GlassUI) | Delete Card.tsx |
| DatabaseRecoveryScreen ↔ RecoveryService + SystemGuard | Delete DatabaseRecoveryScreen.tsx |

---

## 8. Outdated Documentation

| File | Issue | Action |
|------|-------|--------|
| `.github/copilot-instructions.md` | Schema says v16, actual is v20. Missing exercise_translations, user_interests, user_personal_goals tables. | Update embedded schema |
| `docs/ARCHITECTURE_MAP.md` | Pre-Phase 9, may miss subscription hardening, v2 engine | Replace with this report |
| `FITQUEST_ALGORITHM.md` | Documents v1 only, no v2 modular engine | Update |
| `OBJECTIVES.md` | May contain completed items not marked done | Audit |

---

## 9. Action Plan

### Immediate (Before Production)

1. **R-001**: Move AI API calls behind backend proxy ← BLOCKS production safety
2. **R-006**: Remove all deprecated imports (saves up to 48MB bundle)
3. **R-003**: Replace silent catch blocks with error logging

### Next Sprint

4. **R-002**: Enable Health Connect on Android
5. **R-004**: Implement push notifications
6. **R-007**: Fix exhaustive-deps violations (target 0)
7. **R-008**: Drop FitMind tables in schema v21

### Backlog

8. **R-005**: Build backend API
9. **R-010**: Add E2E tests (Maestro)
10. **R-011**: Complete v2 workout engine migration
11. **R-012**: Implement cloud backup
12. **R-009**: Split schema.ts
13. **R-014**: Translate legal text
14. **R-015**: Localize AI templates

---

## 10. Production Gate Assessment

| Criterion | Status | Gate |
|-----------|--------|------|
| Core fitness features work | ✅ | PASS |
| Subscription enforcement active | ✅ | PASS |
| Security (encryption, auth, biometric) | ✅ | PASS |
| AI keys protected | ❌ | **FAIL** — needs proxy |
| Crash reporting active | ✅ | PASS |
| Translation coverage | ✅ | PASS |
| Test suite passing | ✅ 807/807 | PASS |
| Type safety | ✅ tsc 0 errors | PASS |
| E2E tests | ❌ | CONDITIONAL |
| Performance benchmarks | ⚠️ Not measured | CONDITIONAL |

**Verdict**: CONDITIONAL YES — ship-ready **if** R-001 (AI keys) is mitigated before public launch. All other risks are manageable post-launch.
