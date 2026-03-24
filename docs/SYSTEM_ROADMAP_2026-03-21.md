# FitQuest 2.0 — System Optimization, Security Audit & Feature Planning

**Generated:** 2026-03-21  
**Engine:** Alfred Ω (architecture_map → validation)  
**Schema:** v19  
**Basis:** Verified system extraction (10-section, 45 routes, 30+ tables, 975 exercises)

---

## EXECUTIVE SUMMARY

Three parallel streams assessed against the verified system extraction. Findings:

| Stream | Critical | High | Medium | Low |
|--------|----------|------|--------|-----|
| **Optimization** | 2 | 3 | 4 | 2 |
| **Security** | 2 | 1 | 2 | 1 |
| **Feature Planning** | 0 | 2 | 3 | 2 |

**Immediate blockers:** Clock manipulation vulnerability (subscription bypass), 81MB ML models bundled in APK, 2,618 lines of verified dead code.

---

## STREAM 1 — SYSTEM OPTIMIZATION

### 1.1 Performance Bottlenecks

#### OPT-1: External Exercise Seeding Blocks Startup [CRITICAL]
- **File:** `src/database/external-seed.ts`
- **Problem:** 868 exercises seeded in a single synchronous `db.execAsync()` call during `initializeDatabase()`. Blocks splash→dashboard transition by 3-5s on low-end devices.
- **Evidence:** Cold start timeline shows DB init at ~300ms, but seed extends to ~1500ms. External seed is the single largest contributor.
- **Fix:** Chunk into 100-exercise batches with `requestIdleCallback` yield between batches. Seed in background after first render. Gate exercises screen with "loading catalogue" if seed incomplete.
- **Validation:** Measure `initializeDatabase()` time before/after on Android emulator (API 31, 2GB RAM).

#### OPT-2: ML Models Bundled in APK — 81MB [CRITICAL]
- **Directory:** `assets/models/` (81MB total)
- **Breakdown:**
  - `intent_transformer.model` — 32.9MB
  - `intent_v3.model` — 18.4MB
  - `fitcoach_v3.model` — 13.3MB
  - Remaining 16 files — 16.4MB total
- **Problem:** Every APK download includes 81MB of ML models most users never trigger. Google Play penalizes APK size >150MB (AAB limit).
- **Fix:** Move ML models to Android App Bundle asset packs (on-demand delivery). Load on first use of sensor fusion or AI features. Fallback to template-based responses if not downloaded.
- **Validation:** Check final AAB size with `bundletool build-apks`.

#### OPT-3: Coach FlatList Missing getItemLayout [HIGH]
- **File:** `app/coach/index.tsx` (message list FlatList)
- **Problem:** FlatList has `windowSize={5}`, `removeClippedSubviews={true}`, but no `getItemLayout`. Forces React Native to measure every item dynamically → scroll jank with 50+ messages.
- **Fix:** Add estimated `getItemLayout` based on average message bubble height (~80px user, ~120px AI).
- **Effort:** 15 minutes.

#### OPT-4: StreamingBubble Not Memoized [HIGH]
- **File:** `app/coach/index.tsx` (StreamingBubble component)
- **Problem:** During AI text streaming, StreamingBubble re-renders character-by-character. Not wrapped in `React.memo` → parent Coach component re-renders on each character.
- **Fix:** Wrap in `React.memo`. Streaming text should be stored in a ref and rendered via `useAnimatedProps` or throttled state updates (every 3 chars).
- **Effort:** 30 minutes.

#### OPT-5: Saved Workouts FlatList Unoptimized [HIGH]
- **File:** `app/saved-workouts.tsx`
- **Problem:** Missing `removeClippedSubviews`, `getItemLayout`, and `scrollEventThrottle`.
- **Fix:** Add standard FlatList optimization props.
- **Effort:** 10 minutes.

#### OPT-6: Nutrition Calculator Missing scrollEventThrottle [MEDIUM]
- **File:** `app/nutrition-calculator.tsx`
- **Problem:** FlatList missing `scrollEventThrottle`.
- **Fix:** Add `scrollEventThrottle={16}`.
- **Effort:** 5 minutes.

#### OPT-7: react-native-pdf Bundled but FitMind Quarantined [MEDIUM]
- **Package:** `react-native-pdf` (~2MB) + `react-native-blob-util` (peer dep)
- **Problem:** Only used by quarantined FitMind reader screen. Zero users can reach it. Dead bundle weight.
- **Fix:** If FitMind stays quarantined: remove `react-native-pdf` from dependencies. If FitMind ships: keep.
- **Decision dependency:** FitMind ship/no-ship decision (see Feature Planning).

#### OPT-8: PostHog Session Replay Sample Rate [MEDIUM]
- **File:** `src/services/posthogService.tsx`
- **Config:** `sampleRate: 0.5` (50% of sessions recorded)
- **Problem:** Session replay with network telemetry on 50% of sessions generates significant upload traffic + battery drain.
- **Fix:** Reduce to 0.1 (10%) for production. Keep 0.5 for dev builds only.
- **Effort:** 5 minutes.

#### OPT-9: Background Health Collection Interval [MEDIUM]
- **File:** `src/engines/BackgroundHealthEngine.ts`
- **Config:** `collectionIntervalMs: 1 * 60 * 1000` (1 minute)
- **Problem:** Health data collection every 60s is aggressive for a fitness app (not a medical device). Most data (steps, calories) changes slowly.
- **Fix:** Increase to 5 minutes for NORMAL battery, 15 minutes for LOW. Keep 1 minute only during active workout sessions.
- **Effort:** 30 minutes.

### 1.2 Dead Code Removal

| Target | Lines | Files | Status | Safe to Remove |
|--------|-------|-------|--------|---------------|
| `app/professor/index.tsx` body | 617 | 1 | Dead (redirect at bottom) | ✅ Replace with 4-line stub |
| `src/services/workoutGenerator/` | 1,857 | 5 | Zero imports | ✅ Delete directory |
| `src/services/derivedMetricsService.ts` | 136 | 1 | Zero imports | ✅ Delete file |
| `ModelPickerSheet` in coach | ~80 | 1 (partial) | Zero trigger points | ✅ Remove component + state |
| **TOTAL** | **2,690** | **8** | | |

### 1.3 Documentation Stale References
- `docs/COMPREHENSIVE_RESEARCH_2026.md` — references Apollo provider (removed)
- `docs/ARCHITECTURE_MAP.md` — references `derivedMetricsService.ts` (importless)
- `FITQUEST_ALGORITHM.md` — references old `workoutGenerator/` path

---

## STREAM 2 — SECURITY AUDIT

### 2.1 Critical Findings

#### SEC-1: Clock Manipulation Bypasses Trial + Offline Grace [CRITICAL]
- **Files:**
  - `src/purchases/SubscriptionManager.ts` line 207: `if (now < trial.ends_at)` — trial check
  - `src/purchases/SubscriptionManager.ts` line 295: `if (Date.now() - lastVerifiedAt > OFFLINE_GRACE_MS)` — grace check
- **Attack vector 1 — Trial extension:** User sets device clock backward → `Date.now() < trial.ends_at` remains true → trial never expires.
- **Attack vector 2 — Grace period extension:** User sets clock backward after subscription lapses → `Date.now() - lastVerifiedAt` becomes negative → grace period appears valid indefinitely.
- **Impact:** Complete subscription bypass. Users get permanent free access.
- **Mitigation (layered):**
  1. **Monotonic checkpoint:** On every app launch, store `Date.now()` in SecureStore. On next launch, if `Date.now() < storedTime`, flag clock manipulation. Force RevenueCat re-verification or expire.
  2. **Forward-only guard:** In `getOfflineGraceState()`, add: `if (Date.now() < lastVerifiedAt) return null;` — clock went backward = invalid.
  3. **Trial forward-only:** Store `lastSeenTimestamp` on each trial check. If `Date.now() < lastSeenTimestamp`, treat trial as expired.
- **Effort:** 2-4 hours.

#### SEC-2: PostHog captureNetworkTelemetry Leaks API Traffic [CRITICAL]
- **File:** `src/services/posthogService.tsx` line 47 and line 82
- **Config:** `captureNetworkTelemetry: true` (set twice — Android + iOS config)
- **Problem:** PostHog captures HTTP request/response metadata including:
  - Auth headers (potential token leakage to PostHog servers)
  - Request bodies to Groq/OpenRouter (user AI conversations)
  - Response bodies (AI-generated content, health data)
- **Classification:** Data processor receiving health-adjacent data without explicit user consent for analytics data sharing.
- **Fix:** Set `captureNetworkTelemetry: false`. If network debugging is needed, whitelist only non-sensitive endpoints.
- **Effort:** 5 minutes.

### 2.2 High Findings

#### SEC-3: No Programmatic Navigation Guard on Gated Screens [HIGH]
- **File:** `app/_layout.tsx` (AccessGate component)
- **Problem:** AccessGate redirects EXPIRED users to `/paywall` at layout level. But individual screens (dashboard, fitquest, coach, etc.) have no local guard. If a timing gap exists between AccessGate evaluation and screen render, one frame of gated content could flash.
- **Evidence:** AccessGate uses `useEffect` for redirect → redirect is async → first render could show gated content briefly.
- **Fix:** Add `if (accessState === 'EXPIRED') return null;` as first line in each tab screen component.
- **Effort:** 30 minutes (5 screens × 2 lines each + test).

### 2.3 Medium Findings

#### SEC-4: AI Conversations Sent to External Providers [MEDIUM]
- **Files:** `src/services/aiProvider.ts` (Groq/OpenRouter fetch calls)
- **Problem:** User chat messages sent to Groq and OpenRouter APIs. Conversations are encrypted at-rest but sent in plaintext over HTTPS to third-party servers.
- **Status:** This is expected behavior for LLM-based AI. HTTPS provides transport encryption.
- **Recommendation:** Add prominent in-app disclosure that AI conversations are processed by third-party services. Consider: privacy policy audit for POPIA (South African data protection) compliance given SA language support.

#### SEC-5: RevenueCat API Key Dev/Prod Split [MEDIUM]
- **File:** `src/purchases/SubscriptionManager.ts` line 46
- **Config:** `process.env.EXPO_PUBLIC_REVENUECAT_API_KEY` — single env var for both dev and prod.
- **Problem:** If dev key leaks into production build, sandbox purchases bypass real payment.
- **Fix:** Use `Constants.expoConfig?.extra?.revenueCatKey` with separate EAS build profiles for dev vs prod. Add build-time assertion that production builds use production key.
- **Effort:** 1 hour.

### 2.4 Low Findings

#### SEC-6: Emergency Wipe Threshold Hardcoded [LOW]
- **File:** `src/security/BiometricAuth.ts`
- **Config:** Emergency wipe after 15 failed biometric + passcode attempts.
- **Status:** Secure implementation, but 15 is aggressive. Consider: configurable threshold, or require network verification before wipe (prevent data loss from toddler-with-phone scenarios).
- **Recommendation:** No change needed for v1. Revisit if user complaints arise.

### 2.5 Verified Secure

| Domain | Finding |
|--------|---------|
| Health data encryption | ✅ All via `encryptedDB` (AES-256-GCM v3) |
| Encryption write version | ✅ Only v3 for new writes; v1/v2 read+migrate only |
| Console log leakage | ✅ All sensitive logs guarded by `__DEV__` |
| AsyncStorage | ✅ Zero imports (enforced by test policy) |
| Cryptographic randomness | ✅ `crypto.randomUUID()` for all security paths |
| API key storage | ✅ All via `process.env.EXPO_PUBLIC_*` (not hardcoded) |
| Clipboard/Share leakage | ✅ No misuse detected |
| Biometric session | ✅ 30-min expiry, 5-attempt lockout, exponential backoff |
| Paywall close button | ✅ Hidden when EXPIRED |
| Access gate routes | ✅ Whitelisted routes limited to auth/legal screens |

---

## STREAM 3 — FEATURE PLANNING & RISK ASSESSMENT

### 3.1 High-Impact Feature Recommendations

#### FEAT-1: Sleep Input UI [HIGH IMPACT]
- **Current state:** `SleepAnalysisEngine` exists with scoring, debt tracking, circadian analysis, recovery multiplier. But no user-facing input screen.
- **Gap:** Health score weights sleep at 25% — currently zero data → score artificially depressed.
- **Implementation:** Add sleep logging modal (bedtime, wake time, quality rating) to health dashboard. Auto-calculate from inputs. Store via `encryptedDB.storeHealthData('sleep', ...)`.
- **Complexity:** MEDIUM (new modal component + existing engine integration)
- **Risk:** LOW (additive, no existing system disruption)

#### FEAT-2: Workout History / Calendar View [HIGH IMPACT]
- **Current state:** `workout_sessions` table stores all completed sessions. `progress_records` tracks per-exercise performance. Analytics screen exists but is basic.
- **Gap:** Users cannot see their workout history on a calendar. No visual reinforcement of consistency.
- **Implementation:** Calendar component on analytics or profile screen. Dot indicators for workout days. Tap → session detail. Uses existing `DatabaseService.getWorkoutSessions()`.
- **Complexity:** MEDIUM (new component, existing data)
- **Risk:** LOW

### 3.2 Medium-Impact Recommendations

#### FEAT-3: Offline AI Response Quality Improvement [MEDIUM]
- **Current state:** DualAIEngine has 100+ COACH templates. When offline, responses are template-based with context injection.
- **Gap:** Template responses feel generic. No personalization beyond variable substitution.
- **Implementation:** Add rule-based response selection that considers: user's goal, recent workout history, current fatigue level, streak length, time of day. Select from categorized template pools.
- **Complexity:** MEDIUM (logic enhancement, no new UI)
- **Risk:** LOW

#### FEAT-4: Exercise Demo Video Integration [MEDIUM]
- **Current state:** 2-frame animation (start/end position) per exercise.
- **Gap:** Static images insufficient for complex movements.
- **Implementation:** Record 5-10s GIF/WebP animations for top 50 exercises. Lazy-load on exercise detail view. Store in `documentDirectory`, not APK.
- **Complexity:** HIGH (content production + lazy loading infrastructure)
- **Risk:** MEDIUM (storage, bandwidth)

#### FEAT-5: Workout Sharing / Export [MEDIUM]
- **Current state:** Workout sessions stored locally. No share/export capability.
- **Gap:** Social reinforcement is a proven retention mechanism.
- **Implementation:** Generate shareable workout summary image (React Native ViewShot). Share via system share sheet. No server dependency.
- **Complexity:** LOW (existing data, new UI + share API)
- **Risk:** LOW

### 3.3 Low-Impact / Deferred

#### FEAT-6: FitMind Ship or Kill Decision
- **Current state:** Fully built (6 tables, 4 services, 2 screens, SM-2 spaced repetition). Quarantined — no user path reaches it.
- **Bundle cost:** `react-native-pdf` (~2MB), 6 DB tables created on every install, `src/fitmind/` module (~2,500 lines).
- **Recommendation:** DEFER to post-v1. If shipping, add tab or profile menu entry. If killing, remove: `react-native-pdf`, `react-native-blob-util`, `src/fitmind/` directory, `app/fitmind-library.tsx`, `app/fitmind-reader.tsx`, FitMind table creation from schema.ts.
- **Decision criteria:** Does "Body + Mind" dual-intelligence differentiate enough to justify the bundle and maintenance cost?

#### FEAT-7: Wearable Integration (Health Connect / Apple Health)
- **Current state:** HealthConnectAdapter and HealthKitAdapter exist with 5-min permission caching.
- **Gap:** Currently reads steps only. Could read sleep, heart rate, workout sessions from external wearables.
- **Implementation:** Expand adapter read permissions. Map external data to existing encrypted health tables.
- **Complexity:** HIGH (platform-specific, permission-heavy)
- **Risk:** MEDIUM (permission UX, data format inconsistencies)

---

## ROADMAP TABLE

### Immediate — Do Now (≤3 days)

| Stream | Task ID | Task | Priority | Complexity | Effort | Dependencies | Risk |
|--------|---------|------|----------|------------|--------|-------------|------|
| Security | SEC-1 | Clock manipulation fix (trial + grace) | P0 | Medium | 4h | None | CRITICAL |
| Security | SEC-2 | Disable PostHog network telemetry | P0 | Trivial | 5min | None | CRITICAL |
| Optimization | OPT-3 | Coach FlatList getItemLayout | P1 | Low | 15min | None | LOW |
| Optimization | OPT-4 | Memoize StreamingBubble | P1 | Low | 30min | None | LOW |
| Optimization | OPT-6 | Nutrition FlatList scrollEventThrottle | P2 | Trivial | 5min | None | LOW |
| Optimization | OPT-8 | PostHog sample rate → 0.1 | P2 | Trivial | 5min | None | LOW |

### Short-Term — ≤2 Weeks

| Stream | Task ID | Task | Priority | Complexity | Effort | Dependencies | Risk |
|--------|---------|------|----------|------------|--------|-------------|------|
| Security | SEC-3 | Add local access guards to tab screens | P1 | Low | 30min | None | LOW |
| Security | SEC-5 | RevenueCat dev/prod key separation | P1 | Low | 1h | EAS config | LOW |
| Optimization | Dead Code | Strip professor body (617 LOC) | P1 | Trivial | 10min | None | LOW |
| Optimization | Dead Code | Delete `src/services/workoutGenerator/` (1,857 LOC) | P1 | Trivial | 5min | None | LOW |
| Optimization | Dead Code | Delete `derivedMetricsService.ts` (136 LOC) | P2 | Trivial | 2min | None | LOW |
| Optimization | Dead Code | Remove ModelPickerSheet (~80 LOC) | P2 | Low | 15min | None | LOW |
| Optimization | OPT-5 | Saved workouts FlatList optimization | P2 | Low | 10min | None | LOW |
| Optimization | OPT-1 | Chunk external exercise seeding | P1 | Medium | 3h | None | MEDIUM |
| Feature | FEAT-5 | Workout sharing / export | P2 | Low | 1d | None | LOW |

### Medium-Term — ≤3 Months

| Stream | Task ID | Task | Priority | Complexity | Effort | Dependencies | Risk |
|--------|---------|------|----------|------------|--------|-------------|------|
| Optimization | OPT-2 | ML models → on-demand asset packs | P1 | High | 1w | AAB config | MEDIUM |
| Optimization | OPT-7 | FitMind bundle decision (keep/remove pdf) | P2 | Low | 1h | FEAT-6 decision | LOW |
| Optimization | OPT-9 | Adaptive health collection intervals | P2 | Medium | 4h | None | LOW |
| Security | SEC-4 | AI privacy disclosure + POPIA audit | P2 | Low | 2d | Legal review | LOW |
| Feature | FEAT-1 | Sleep input UI | P1 | Medium | 3d | None | LOW |
| Feature | FEAT-2 | Workout history calendar | P1 | Medium | 3d | None | LOW |
| Feature | FEAT-3 | Offline AI response quality | P2 | Medium | 2d | None | LOW |
| Feature | FEAT-4 | Exercise demo videos (top 50) | P3 | High | 2w | Content production | MEDIUM |
| Feature | FEAT-6 | FitMind ship/kill decision | P2 | Decision | 1d | Product strategy | LOW |
| Feature | FEAT-7 | Wearable data expansion | P3 | High | 2w | Platform testing | MEDIUM |

---

## DEPRECATED / SAFE REMOVAL LIST

| Component | Location | Lines | Reason | Removal Risk |
|-----------|----------|-------|--------|-------------|
| Professor screen body | `app/professor/index.tsx` L1-617 | 617 | Redirect stub at L618 replaces all | NONE |
| Old workout generator | `src/services/workoutGenerator/` | 1,857 | Replaced by `src/engines/workoutGenerator.ts` | NONE |
| derivedMetricsService | `src/services/derivedMetricsService.ts` | 136 | Zero imports anywhere | NONE |
| ModelPickerSheet | `app/coach/index.tsx` (partial) | ~80 | Zero trigger points (`setShowModelPicker(true)` removed) | NONE |
| react-native-pdf | `package.json` dep | - | Only used by quarantined FitMind reader | CONDITIONAL (FitMind decision) |
| react-native-blob-util | `package.json` dep | - | Peer dep of react-native-pdf | CONDITIONAL (FitMind decision) |

**Total confirmed removable:** 2,690 lines + 2 npm packages (conditional).

---

## TACTICAL RECOMMENDATION

### Priority Execution Order

1. **SEC-1 + SEC-2** — Fix clock manipulation + kill PostHog network telemetry. These are the only two findings that could cause real-world damage (subscription bypass, data leakage to analytics provider).

2. **Dead code strip** — Remove 2,690 lines across 8 files. Zero risk, immediate codebase clarity.

3. **FlatList optimizations** (OPT-3, 4, 5, 6) — 4 surgical fixes, combined effort <1 hour. Immediate scroll performance improvement on the two most-used screens (coach + exercises).

4. **Chunk exercise seeding** (OPT-1) — Unblock startup performance on low-end devices. This is the single biggest user-perceived performance issue.

5. **Sleep input UI** (FEAT-1) + **Workout calendar** (FEAT-2) — Highest-value features that use existing infrastructure. Sleep input immediately improves health score accuracy (25% weight currently zero).

6. **ML model asset packs** (OPT-2) — Reduce APK size from ~150MB+ to ~70MB. Critical for Play Store listing and download conversion.

### Strategic Focus

**Maximize offline, AI-driven core value.** The workout pipeline, health monitoring, and sensor fusion are production-grade. The two weakest links are: (1) sleep data input (engine exists, UI doesn't), and (2) offline AI quality (templates are generic).

**Eliminate dead weight.** 2,690 lines of confirmed dead code, 81MB of bundled ML models, and a quarantined module with 2 npm dependencies. Every line removed is a line that can't break.

**Enforce production-grade reliability.** Clock manipulation fix is non-negotiable. PostHog telemetry fix is 5 minutes. Local access guards add defense in depth. These are the difference between "works in demo" and "survives in the wild."
