# FitQuest 2.0 — Master Plan: Current State → Internal Testing → Closed Beta

> **Generated**: Session 13 — Based on exhaustive codebase audit  
> **Git HEAD**: `85d2613` (all prior work committed + pushed)  
> **Audit Method**: Every file, directory, import chain, and runtime path verified  
> **Author**: Alfred Ω (Autonomous Execution Engine)

---

## Executive Assessment

**What exists**: A structurally sound React Native app with 30 screens, 120+ database functions, full auth API client, subscription manager, AI engine, exercise catalogue (868+ exercises with 1736 image records), workout generation/progression/recovery engines, 4 Maestro E2E flows, 425 unit tests, and a deployed backend on Render.

**What's broken**: The app is a **disconnected frontend**. Critical infrastructure paths are stubbed, missing, or not wired. The backend exists and is deployed, but the app doesn't reliably use it. Exercise images exist in the workspace but aren't bundled. 4 screens are stubs. FitMind screens don't exist. The security layer is placeholder stubs.

**Honest score**: The app is **~65% complete** for closed beta. The 96/100 readiness report measured code quality (types, tests, lint) — not feature completeness or runtime readiness.

---

## Critical Gaps Identified (Audit Evidence)

### GAP 1: Exercise Image Pipeline — BROKEN
- **Evidence**: `find . -path "*/exercises/*.jpg"` returns 0 files in the build tree
- **Root cause**: 1746 images exist in `workspace-repos/exercise-content/free-exercise-db/exercises/` but there is no `scripts/copy-exercise-assets.sh` (referenced by `npm run dev:android` but the file doesn't exist)
- **Impact**: Every exercise shows a placeholder icon. Users see zero exercise illustrations.
- **Fix**: Create the copy script, integrate into dev + release builds

### GAP 2: Authority Client — STUBBED
- **Evidence**: `src/services/authorityClient.ts` is 18 lines, returns `null` (offline mode)
- **Root cause**: Server verification was disabled during offline-first development
- **Impact**: No server-side AI access control, no subscription verification via backend
- **Fix**: Wire authority client to the deployed backend at `https://fitq-56sj.onrender.com`

### GAP 3: Security Services — ALL STUBS
- **Evidence**: `src/services/security/` contains 4 files totaling 49 lines, all no-ops:
  - `degradation.ts` — 9 lines, all no-op functions
  - `securityBridge.ts` — 4 lines, empty function
  - `sentinel.ts` — 10 lines, all no-op functions  
  - `tamperEngine.ts` — 26 lines, basic structure but no real logic
- **Impact**: No tamper detection, no runtime integrity checks, no security degradation
- **Note**: These are non-critical for closed beta but must be addressed before public release

### GAP 4: Four Stub Screens (28 lines each, "Coming Soon" placeholders)
- `app/nutrition-calculator.tsx` — Stub
- `app/meal-prep.tsx` — Stub
- `app/health-dashboard.tsx` — Stub
- `app/backups.tsx` — Stub
- **Impact**: Users navigate to these and see empty placeholder screens

### GAP 5: FitMind Screens — DON'T EXIST
- **Evidence**: `app/fitmind-library.tsx`, `app/fitmind-reader.tsx`, `app/professor/index.tsx` — files not found
- **Root cause**: FitMind backend (schema, service, engines) exists but no UI was built
- **Impact**: The entire cognitive fitness module is invisible to users
- **Decision needed**: Ship in beta or defer to v2.1?

### GAP 6: Feedback Screen — NOT IN NAVIGATION
- **Evidence**: `app/feedback.tsx` (570 LOC) exists but is not registered in `app/_layout.tsx`
- **Impact**: Users can't access the feedback form

### GAP 7: Dev Debug Panel — NOT IN NAVIGATION  
- **Evidence**: `app/dev/debug-panel.tsx` (549 LOC) exists but not in `_layout.tsx`
- **Impact**: Developers can't access diagnostics during testing

### GAP 8: Exercise Image Deploy Script — MISSING
- **Evidence**: `scripts/` directory contains only `__pycache__/`
- **Root cause**: `npm run dev:android` calls `bash scripts/copy-exercise-assets.sh` — file doesn't exist
- **Impact**: Native Android builds will fail at the exercise asset copy step

### GAP 9: Backend Health Unknown
- **Evidence**: Backend deployed to Render (`https://fitq-56sj.onrender.com`)
- **Unknown**: Is it running? Is the Supabase project active? Are the RLS policies applied?
- **Impact**: Auth, device binding, sync, and AI proxy may all fail at runtime

### GAP 10: .env Contains Hardcoded API Keys
- **Evidence**: `.env` file has live API keys for Groq, Grok, OpenRouter, PostHog, authority server
- **Risk**: Keys visible in version control or workspace sharing
- **Fix**: Rotate all keys, ensure `.env` is in `.gitignore`

---

## Phase Plan

### PHASE A: Foundation Fixes (Prerequisite for Any Testing)
**Goal**: Make the app actually launchable and functional on a real device.

| # | Task | Files | Verify |
|---|------|-------|--------|
| A1 | Create `scripts/copy-exercise-assets.sh` — copy 1746 images from `workspace-repos/exercise-content/free-exercise-db/exercises/` to `android/app/src/main/assets/exercises/` | `scripts/copy-exercise-assets.sh` | `ls android/app/src/main/assets/exercises/ \| wc -l` returns ~873 folders |
| A2 | Convert images to WebP for APK size reduction (optional but recommended) — use `cwebp` batch script | `scripts/convert-to-webp.sh` | Image sizes reduced ~60% |
| A3 | Register `feedback` screen in `_layout.tsx` navigation | `app/_layout.tsx` | Navigate to feedback from profile |
| A4 | Register `dev/debug-panel` in `_layout.tsx` (dev-only, hidden) | `app/_layout.tsx` | Access debug panel via profile menu |
| A5 | Verify `.env` is in `.gitignore` | `.gitignore` | `git status` shows `.env` as untracked |
| A6 | Build health-dashboard from stub to real screen (uses existing `BackgroundHealthEngine`, `AnomalyDetector`, `SleepAnalysisEngine`) | `app/health-dashboard.tsx` | Shows health score ring, daily metrics, alerts |
| A7 | Build backups screen (uses existing `authApi.overwriteBackupBlob()` + `exportMyUserData()`) | `app/backups.tsx` | Export/import/delete user data |
| A8 | Build nutrition-calculator screen (uses existing `RealisticHealthEngine` static methods: BMR, TDEE, macros, hydration) | `app/nutrition-calculator.tsx` | Calculate and display nutrition targets |

### PHASE B: Backend Connectivity Verification
**Goal**: Confirm the deployed backend works, then wire the app to use it.

| # | Task | Files | Verify |
|---|------|-------|--------|
| B1 | Health-check the Render deployment — `curl https://fitq-56sj.onrender.com/health` | Terminal | Response 200 OK |
| B2 | Verify Supabase project is active — check tables, RLS policies | Supabase dashboard | Tables exist with correct RLS |
| B3 | Test auth flow end-to-end: register → login → refresh → logout | `curl` or Postman | All return valid responses |
| B4 | Wire `authorityClient.ts` to real backend — implement `requestAI()` and `verifySubscription()` | `src/services/authorityClient.ts` | AI requests route through backend |
| B5 | Test device binding flow: register device → challenge-response | Backend routes | Device registered in Supabase |

### PHASE C: Manual Testing Milestone — Expo Go
**Goal**: You and I manually test every screen and flow in Expo Go on a real Android device.

**Prerequisites**: Phases A + B complete.

| Test | What to verify | Pass criteria |
|------|---------------|---------------|
| C1: Cold launch | App loads → splash → onboarding (first time) or dashboard (returning) | No crash, no white flash, under 3s |
| C2: Onboarding flow | Complete all steps: goal, experience, training days, equipment | Profile saved to SQLite, redirects to dashboard |
| C3: Dashboard | Health score, XP, streaks, quick actions all render | No "undefined" text, no layout shifts |
| C4: FitQuest workout | Generate → Start → Complete 3+ exercises → Finish | XP awarded, streak updated, fatigue recorded |
| C5: Move tab | Step counter, jog session start/stop, daily stats | Steps increment, jog distance tracks |
| C6: AI Coach | Send message → Get response (local templates) | Response renders, stored in encrypted DB |
| C7: Exercise library | Browse, filter, search exercises | Exercise cards show, detail sheet opens |
| C8: Profile | View/edit profile, view subscription state, settings | All fields editable, changes persist |
| C9: Login/Register | Email login, Google OAuth (if configured) | Auth completes, token stored in SecureStore |
| C10: Health dashboard | Composite score, metrics, anomaly alerts | All cards render with real or zero data |
| C11: Nutrition calculator | BMR/TDEE calculation, macro breakdown | Correct values for sample profile |
| C12: Paywall | View offerings, attempt purchase (mock mode) | Offerings display, mock purchase succeeds |
| C13: Analytics | Training volume, streak chart, category breakdown | Charts render without crash |
| C14: Backups | Export data, view backup list | Export completes, data downloadable |
| C15: Theme toggle | Switch dark/light mode | All screens respect theme, no white flashes |
| C16: Language switch | Change to Afrikaans, Zulu, etc. | All visible strings translate |
| C17: Offline behavior | Enable airplane mode → use app | Core features work, graceful degradation |

**Output**: Bug list with screen, description, severity. Feeds into Phase D.

### PHASE D: Bug Fix Iteration
**Goal**: Fix every bug found in Phase C.

| Priority | Category | Target |
|----------|----------|--------|
| P0 | Crashes, data loss, auth failure | Fix immediately |
| P1 | UI broken, navigation stuck, wrong data | Fix same session |
| P2 | Visual polish, alignment, animation jank | Fix within 2 sessions |
| P3 | Edge cases, rare states | Fix before Phase F |

### PHASE E: Native Build — Android Dev Client
**Goal**: Build a real Android APK with native modules (Reanimated, Sensors, Biometrics).

| # | Task | Files | Verify |
|---|------|-------|--------|
| E1 | Run `npx expo prebuild --clean --platform android` | `android/` | Generates fresh native project |
| E2 | Create `scripts/copy-exercise-assets.sh` and run it | Script + `android/app/src/main/assets/exercises/` | 873 exercise folders with images |
| E3 | Build APK: `npm run build:apk` | `android/app/build/outputs/apk/release/` | APK generated, no build errors |
| E4 | Install on physical device | `adb install` | App launches, no native crash |
| E5 | Verify exercise images load from APK assets | Exercise library | Images animate (start/end frames) |
| E6 | Verify biometric auth (fingerprint/face) | Login screen | Biometric prompt appears, auth succeeds |
| E7 | Verify sensor fusion (accelerometer + gyroscope) | Move tab | Steps count, activity detection |
| E8 | Verify Reanimated animations | All screens | Smooth 60fps, no jank |
| E9 | Run Maestro E2E flows on device | `.maestro/` | All 4 flows pass |

### PHASE F: Closed Beta Preparation
**Goal**: Polish, stability, and distribution readiness.

| # | Task | Files | Verify |
|---|------|-------|--------|
| F1 | Implement real RevenueCat (switch from mock billing) | `src/purchases/SubscriptionManager.ts`, `.env` | Real offerings load from Play Store |
| F2 | Set up Google Play internal testing track | Play Console | APK uploaded, testers invited |
| F3 | Configure Sentry DSN for production crash reporting | `.env`, `src/services/crashReporting.ts` | Crashes appear in Sentry dashboard |
| F4 | Configure PostHog for production analytics | `.env` | Events appear in PostHog |
| F5 | Rate limiting verification — test 30 req/min AI cap | AI provider | Graceful "slow down" message |
| F6 | Cold start performance audit — target < 2s on mid-range device | Profiler | Startup under 2 seconds |
| F7 | Memory leak audit — 30min stress test | Android Profiler | No unbounded growth |
| F8 | Final accessibility pass — screen reader, contrast ratios | All screens | TalkBack navigable |
| F9 | Build signed AAB for Play Store distribution | `npm run build:aab` | Signed bundle generated |
| F10 | Distribute to 5-10 internal testers | Play Console internal track | All testers can install |

---

## Deferred to v2.1 (Not Required for Closed Beta)

| Feature | Reason |
|---------|--------|
| FitMind Library + Reader screens | Cognitive fitness module needs full UI design first |
| Professor AI personality | Requires FitMind screens to host it |
| Meal Prep screen | Requires food database integration (assets/food-data.json exists but UI not designed) |
| Security services (tamper detection, sentinel, degradation) | Non-critical for trusted beta testers |
| Cloudflare AI Proxy (`server/ai-proxy/worker.ts`) | Can use direct API keys during beta |
| Data sync to backend (offline_queue) | Offline-first is sufficient for beta |
| Social layer / leaderboards | Future feature |

---

## Execution Order

```
PHASE A (Foundation Fixes)          ← WE START HERE
  └→ PHASE B (Backend Verification)
       └→ PHASE C (Manual Test — Expo Go)     ← MILESTONE: First real testing
            └→ PHASE D (Bug Fixes)
                 └→ PHASE E (Native Build)      ← MILESTONE: Real APK on device
                      └→ PHASE F (Closed Beta)  ← MILESTONE: Internal testers
```

**Estimated effort**: 6 focused sessions (A+B: 2, C+D: 2, E+F: 2)

---

## Constraint Enforcement

Every change made under this plan must satisfy:
1. **No new patterns** — use existing Context/Zustand/SQLite patterns only
2. **No Apollo** — SQLite is the only data source
3. **Theme system** — `theme.colors.*`, `theme.spacing[n]`, no hardcoded values
4. **Security** — sensitive data through `encryptedDB`, auth tokens through `SecureStore`
5. **Determinism** — no setTimeout hacks, all async guarded and cancellable
6. **Validation** — every fix verified by test, type check, or manual confirmation

---

## Current Codebase Metrics

| Metric | Value |
|--------|-------|
| Total screens | 30 (24 substantial, 4 stubs, 2 routing) |
| Database functions | 120+ exported |
| Schema version | 21 |
| Unit tests | 425 across 19 files |
| Lint warnings | ~172 (threshold 250) |
| TypeScript errors | 0 |
| Maestro E2E flows | 4 |
| Backend LOC | 3,098 |
| Frontend LOC | ~60,000+ |
| Exercise catalogue | 868+ exercises, 1736 image records |
| Exercise images on disk | 1,746 files (not bundled) |
| Supported languages | 15 |
| Git HEAD | `85d2613` |
