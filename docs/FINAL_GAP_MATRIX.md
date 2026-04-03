# Phase 33 — FINAL_GAP_MATRIX

**Mode**: `full_autonomous` | **Generated**: 2026-04-02

Consolidated gap matrix across all Phase 33 audit outputs. Every gap, risk, and required fix in one view.

---

## Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Blocks production deployment |
| **P1** | Degrades user experience or security |
| **P2** | Technical debt — schedule for post-launch |
| **P3** | Nice-to-have, cosmetic |

| Status | Meaning |
|--------|---------|
| ⛔ BLOCKED | Cannot ship without fix |
| ⚠️ DEGRADED | Works but suboptimal |
| ✅ CLEAR | No action needed |
| 🔲 TODO | Planned fix, not started |

---

## 1. ENVIRONMENT & CONFIGURATION

| # | Area | Status | Gap | Risk | Fix Required | Priority |
|---|------|--------|-----|------|-------------|----------|
| 1.1 | RevenueCat API key | ⛔ BLOCKED | Test key `test_DY...` — SubscriptionManager skips init in prod | Subscriptions non-functional | Replace with production RevenueCat key | **P0** |
| 1.2 | Mock API flag | ⛔ BLOCKED | `EXPO_PUBLIC_USE_MOCK_API="true"` | Some API calls may be mocked in prod | Set to `"false"` | **P0** |
| 1.3 | Environment flag | ⚠️ DEGRADED | `EXPO_PUBLIC_ENV="development"` | Dev-only features may leak | Set to `"production"` | **P1** |
| 1.4 | Authority server tier | ⚠️ DEGRADED | Render free tier — 30s cold start | First device verification delayed | Upgrade to paid Render or accept latency | **P2** |
| 1.5 | AI API keys billing | ⚠️ DEGRADED | Dev/personal keys — rate limits unknown | AI Coach may hit rate limits | Verify billing on Groq/Grok/OpenRouter | **P1** |

---

## 2. UI SYSTEM — LINT VIOLATIONS

| # | Area | Status | Gap | Count | Fix Required | Priority |
|---|------|--------|-----|------:|-------------|----------|
| 2.1 | Hardcoded colors | ⚠️ DEGRADED | `no-hardcoded-colors` lint errors | 194 | Replace with `theme.colors.*` tokens (Batch A) | **P1** |
| 2.2 | Inline fontSize | ⚠️ DEGRADED | `no-inline-fontsize` lint warnings | 610 | Replace `<Text>` with `<ThemedText variant>` (Batch B) | **P2** |
| 2.3 | setTimeout hacks | ⚠️ DEGRADED | `no-settimeout-fix` lint errors | 52 | Replace with state gates / InteractionManager (Batch D) | **P1** |
| 2.4 | Math.random security | ⚠️ DEGRADED | `no-math-random-security` lint errors | 28 | Replace with `expo-crypto` where security-relevant (Batch D) | **P1** |
| 2.5 | bg-white patterns | ⚠️ DEGRADED | Light backgrounds in dark theme | 2 | Replace with `theme.colors.surface` (Batch A) | **P2** |
| 2.6 | AsyncStorage usage | ⚠️ DEGRADED | Violates SecureStore policy | 1 | Replace with SecureStore or SQLite | **P1** |

**Total lint violations**: 887 (225 errors + 662 warnings)

---

## 3. UI COMPONENT ADOPTION

| # | Area | Status | Gap | Adoption | Fix Required | Priority |
|---|------|--------|-----|------:|-------------|----------|
| 3.1 | ThemedText | ⚠️ DEGRADED | 570 raw `<Text>` vs 374 ThemedText | 40% | Migrate all raw Text to ThemedText | **P2** |
| 3.2 | GradientButton | ⚠️ DEGRADED | ~80 freestyle CTAs vs 32 GradientButton | 29% | Replace CTA-worthy TouchableOpacity with GradientButton | **P2** |
| 3.3 | theme.spacing | ⚠️ DEGRADED | 66 hardcoded vs 105 themed | 61% | Replace hardcoded padding/margin with tokens | **P3** |
| 3.4 | theme.borderRadius | ⚠️ DEGRADED | ~80 hardcoded vs ~40 themed | 33% | Replace hardcoded borderRadius with tokens | **P3** |
| 3.5 | theme.colors | ✅ CLEAR | 1,605 themed, ~220 hardcoded | 88% | Fix remaining 194 in Batch A | **P1** |

---

## 4. NAVIGATION

| # | Area | Status | Gap | Fix Required | Priority |
|---|------|--------|-----|-------------|----------|
| 4.1 | Dead routes | ⚠️ DEGRADED | 3 placeholder screens (fitmind-library, fitmind-reader, professor) + `/sitemap` dead link | Remove dead links or implement screens | **P3** |
| 4.2 | Login.tsx routing | ⚠️ DEGRADED | 8 separate `router.replace('/dashboard')` calls | Consolidate into single success handler | **P3** |
| 4.3 | Splash.tsx branching | ⚠️ DEGRADED | 6 conditional replace calls | Simplify routing function | **P3** |
| 4.4 | e2eFlows alignment | ⚠️ DEGRADED | ExerciseSelectionScreen + WorkoutSummaryScreen don't exist in production | Update e2eFlows.ts to match production's dual workout flow | **P2** |
| 4.5 | Fallback consistency | ✅ CLEAR | All screens use `canGoBack() ? back() : replace(fallback)` | None | — |
| 4.6 | ScreenErrorBoundary | ✅ CLEAR | All 24+ screens wrapped | None | — |

---

## 5. OFFLINE INTEGRITY

| # | Area | Status | Gap | Fix Required | Priority |
|---|------|--------|-----|-------------|----------|
| 5.1 | Core domains offline | ✅ CLEAR | All 13 core domains fully offline | None | — |
| 5.2 | AI offline fallback | ✅ CLEAR | DualAIEngine template responses | None | — |
| 5.3 | Backup offline handling | ✅ CLEAR | `.catch()` on cloud backup | None | — |
| 5.4 | RevenueCat offline | ✅ CLEAR | Local trial_state/subscription_state tables | None | — |

---

## 6. SECURITY

| # | Area | Status | Gap | Fix Required | Priority |
|---|------|--------|-----|-------------|----------|
| 6.1 | Math.random in crypto | ⚠️ DEGRADED | 28 instances (some may be security context) | Audit each — replace security uses with expo-crypto | **P1** |
| 6.2 | AsyncStorage usage | ⚠️ DEGRADED | 1 instance — violates SecureStore policy | Replace | **P1** |
| 6.3 | API keys in .env | ⚠️ DEGRADED | Keys in plain .env (standard practice but exposed in source) | Ensure .env is in .gitignore, use EAS secrets for builds | **P1** |
| 6.4 | Encryption layer | ✅ CLEAR | AES-256-GCM v3, auto-migration v1→v3 | None | — |
| 6.5 | Biometric auth | ✅ CLEAR | Lockout, backoff, session expiry, emergency wipe | None | — |

---

## 7. STABILITY

| # | Area | Status | Gap | Fix Required | Priority |
|---|------|--------|-----|-------------|----------|
| 7.1 | setTimeout patterns | ⚠️ DEGRADED | 52 instances — timing hacks | Replace with deterministic state gates | **P1** |
| 7.2 | Timer overflow | ⚠️ DEGRADED | No 24h overflow guard on workout timer | Add max duration guard | **P3** |
| 7.3 | In-workout logout | ⚠️ DEGRADED | No logout during active workout | Acceptable — low risk | **P3** |
| 7.4 | Double-tap guards | ⚠️ DEGRADED | Fitquest workout generation has no visible debounce | Add debounce guard to workout generation CTA | **P2** |

---

## 8. SCREEN COMPLEXITY (Tier 1 Debt)

| # | Screen | LOC | Violation Density | Fix Required | Priority |
|---|--------|-----|------------------:|-------------|----------|
| 8.1 | profile.tsx | 2,756 | 7.8/100 LOC | Split into sub-screens (Settings sections) | **P2** |
| 8.2 | coach/index.tsx | 2,025 | 3.5/100 LOC | Extract message renderer + input bar components | **P2** |
| 8.3 | fitquest.tsx | 1,819 | 6.7/100 LOC | Extract category cards + workout CTA section | **P2** |
| 8.4 | onboarding.tsx | 1,493 | 5.3/100 LOC | Extract step components | **P2** |
| 8.5 | move.tsx | 1,320 | 8.0/100 LOC | Extract step tracker + jog tracker sections | **P2** |

---

## DEPLOYMENT RISK SUMMARY

| Risk Level | Count | Items |
|:----------:|------:|-------|
| **P0 (Blocker)** | 2 | RevenueCat test key, Mock API flag |
| **P1 (High)** | 9 | Colors (194), setTimeout (52), Math.random (28), AsyncStorage (1), env flag, AI keys billing, .env security |
| **P2 (Medium)** | 10 | Typography (610), ThemedText migration, GradientButton, e2eFlows alignment, screen splits, double-tap guards |
| **P3 (Low)** | 7 | Spacing, borderRadius, dead routes, timer overflow, login consolidation, splash simplification |

### Critical Path to Deployment

```
P0 FIX (2 items) → P1 BATCH A colors (194) → P1 BATCH D stability (81)
→ P2 BATCH B typography (610) → P2 component adoption → P3 polish
```

**Minimum viable deployment**: Fix P0 (2 env vars) + P1 security items (Math.random, AsyncStorage, .env). This gives a deployable app with cosmetic debt.

**Full convergence**: All P0 + P1 + P2 = 887 lint violations + component migration + screen splits.

---

*Alfred Ω — Phase 33 System Convergence — FINAL*
