# Phase C — Device Testing Feedback & Implementation Plan

**Created**: Phase C.2 | **Status**: Active  
**Last Device Test**: Full lifecycle on Android (Expo Go dev build)

---

## Test Results Summary

### ✅ PASSING (Phase C.1 fix confirmed)
- Database migrations v0→v21: All 21 committed cleanly
- Exercise seeding: 47 core + 863 external
- Workout generation + completion + XP award
- Sensor fusion + pedometer + distance tracking
- Encrypted data initialization (AES-GCM v3)
- Auth flow (biometric + passcode)
- Navigation + tab structure

### ❌ ISSUES FOUND (device testing)

| # | Issue | Severity | Root Cause | Status |
|---|-------|----------|-----------|--------|
| C2-01 | TTS dies after language change | P0 | Circuit breaker (`consecutiveSpeechFailures`) not reset in `setLanguage()` | ✅ Fixed |
| C2-02 | Language switch breaks UI layout | P0 | No `I18nManager.forceRTL()` for Arabic; no RTL support at all | ✅ Fixed |
| C2-03 | AI shows "Offline" when cloud is available | P1 | `cloudAvailable` reads stale pre-init state; providers all `enabled: false` until `initialize()` runs | ✅ Fixed |
| C2-04 | TTS narrator too slow | P2 | Narration rate multiplied by 0.9 (10% reduction) | ✅ Fixed (→ 0.97) |
| C2-05 | `[Authority] /verify/subscription failed: Aborted` | P3 | Render backend cold start (30s+), AbortController 5s timeout | Deferred — backend infra |
| C2-06 | `[Reanimated] Property "opacity" overwritten` | P3 | Entering animation + layout animation conflict on same element | Deferred — cosmetic |
| C2-07 | Dashboard greeting static (no animation) | P2 | Plain `ThemedText` — no animation | ✅ Fixed (typewriter effect) |

---

## Fixes Applied (Phase C.2)

### 1. TTS Circuit Breaker Reset
**File**: `src/services/audioService.ts`  
**Change**: Added `this.consecutiveSpeechFailures = 0` in `setLanguage()` method.  
**Effect**: Switching languages now resets TTS, giving it a fresh chance in the new locale.  
**Also**: Narration speed tuned from `*0.9` to `*0.97` (barely noticeable slowdown, removes "sluggish" feeling).

### 2. RTL Language Support
**File**: `src/context/LanguageContext.tsx`  
**Change**: Added `I18nManager.forceRTL()`/`allowRTL()` handling for RTL languages (ar, he, fa, ur). On RTL/LTR direction change, triggers `Updates.reloadAsync()` (React Native requires app reload for RTL to take effect). Also restores RTL state on mount from SecureStore.  
**Effect**: Arabic/Hebrew/Farsi/Urdu will render in proper RTL layout. LTR languages unaffected.

### 3. AI Cloud Status Indicator
**Files**: `src/services/aiProvider.ts`, `src/viewmodels/useCoachViewModel.ts`  
**Change**: Added `checkCloudAvailable()` async method on `AIProvider`. ViewModel now uses `useState` + `useEffect` to resolve cloud status after initialization.  
**Effect**: Coach screen shows accurate "Online"/"Offline" status after provider keys are loaded from SecureStore.

### 4. Dashboard Typewriter Greeting
**File**: `app/dashboard.tsx`  
**Change**: Replaced static greeting text with typewriter animation (45ms per char, 300ms initial delay). Cursor blinks green (`theme.colors.accent`) during typing, disappears after completion.  
**Effect**: Dashboard greeting now types out character-by-character for a tech/hacker aesthetic.

---

## Remaining Work Queue (Priority Order)

### P1 — Functional Gaps (Phase D targets)

| Item | Description | Impact |
|------|-------------|--------|
| D-01 | Authority server cold start handling | Subscription verification times out on Render free tier. Need: retry with backoff OR offline-first subscription check using cached local state |
| D-02 | TTS voice pack availability check | Android may lack voice packs for zu, xh, st (SA languages). Add pre-speech check + user-facing message to download voice packs |
| D-03 | Non-English AI response quality | Template-based DualAI fallback responds in English regardless of language setting. Cloud models honor language instruction; templates do not |
| D-04 | Exercise image pipeline | `exercise_images` table exists but no images are bundled. Need: image download service or bundled asset pipeline |

### P2 — UI Optimization (Phase D/E targets)

| Item | Description | Screen |
|------|-------------|--------|
| U-01 | Reanimated opacity conflict | Separate entering/layout animations on overlapping `Animated.View` elements | dashboard, fitquest |
| U-02 | Long text overflow in translations | Some non-English translations (de, pt, fr) produce longer strings that may overflow fixed-width elements | All screens with pills/badges |
| U-03 | Tab label truncation | German/Portuguese tab labels may be clipped in bottom nav | `_layout.tsx` ThemedTabs |
| U-04 | GlassCard border consistency | Some cards use direct border styling, others use GlassCard defaults | dashboard, health-dashboard |
| U-05 | Skeleton placeholder on slow DB | `SkeletonDashboard` renders during DB init but transitions abruptly to content | dashboard |

### P3 — Performance (Phase E targets)

| Item | Description | Impact |
|------|-------------|--------|
| P-01 | AI provider initialization latency | `loadSecureKeys()` reads 3 keys sequentially from SecureStore. Could parallelize with `Promise.all()` | Coach screen cold open |
| P-02 | Exercise catalogue query optimization | 910 exercises loaded without pagination on exercises screen | Exercises tab scroll performance |
| P-03 | Dashboard re-render on language change | Full context propagation triggers re-render of all children. Tab labels could use `React.memo` wrapper | Language switch lag |
| P-04 | SensorFusion 10Hz sampling | Continuous accelerometer/gyroscope at 10Hz during workouts. Could reduce to 5Hz for battery savings when activity is STATIONARY | Battery drain |

### P4 — Security Hardening (Phase F targets)

| Item | Description |
|------|-------------|
| S-01 | Encryption key rotation check | `shouldRotateKey()` exists but is never called on schedule |
| S-02 | BiometricAuth session expiry UI | Session expires after 30min silently — no re-auth prompt |
| S-03 | API key exposure in dev builds | Direct provider keys in env vars are shipped in dev client bundles |

---

## Phase Roadmap

| Phase | Focus | Content |
|-------|-------|---------|
| **C** (current) | Device testing + critical fixes | Migration fix, TTS, i18n RTL, AI indicator, dashboard UX |
| **D** | Functional completion | Authority resilience, TTS voice packs, exercise images, AI template i18n |
| **E** | Performance + polish | Re-render optimization, pagination, battery management, animation conflicts |
| **F** | Security + release prep | Key rotation, session management, production build hardening |

---

## Device Testing Protocol

### Pre-test checklist
- [ ] Clean build: `npx expo start -c`
- [ ] Fresh install (clear app data) OR update install
- [ ] Test languages: English, Afrikaans, Zulu, Arabic (RTL), German (long strings)
- [ ] Test flows: Onboarding → Dashboard → Workout → Coach AI → Profile → Language switch

### Regression checks after each fix cycle
- [ ] All 21 migrations pass on fresh install
- [ ] TTS speaks in selected language
- [ ] Language switch does not break layout
- [ ] AI coach shows "Online" when keys available
- [ ] Dashboard loads without flicker
- [ ] Workout generation completes
- [ ] XP awards correctly
- [ ] Navigation between all tabs smooth
