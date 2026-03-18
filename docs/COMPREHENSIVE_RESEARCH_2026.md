# FitQuest 2.0 — Comprehensive Research & Technical Assessment

> **Date**: February 2026  
> **Replaces**: All prior research/enhancement/audit documents  
> **Scope**: Full technical audit, upgrade pathways, feature gaps, security posture, and monetization readiness  
> **Architecture**: Fully client-side React Native (Expo SDK 54) — no backend except payment processing via RevenueCat

---

## Table of Contents

1. [Current Technical Inventory](#1-current-technical-inventory)
2. [Dependency Upgrade Analysis](#2-dependency-upgrade-analysis)
3. [Security Assessment](#3-security-assessment)
4. [Database & Data Layer](#4-database--data-layer)
5. [Monetization & Revenue Readiness](#5-monetization--revenue-readiness)
6. [Health Integration](#6-health-integration)
7. [AI & Cognitive Fitness](#7-ai--cognitive-fitness)
8. [Performance & Quality](#8-performance--quality)
9. [Feature Completeness Matrix](#9-feature-completeness-matrix)
10. [Competitive Landscape](#10-competitive-landscape)
11. [Upgrade Recommendations](#11-upgrade-recommendations)

---

## 1. Current Technical Inventory

### Core Framework Versions

| Component | Current | Latest Available | Gap |
|-----------|---------|-----------------|-----|
| Expo SDK | 54.0.0 | **55.0.0** (Feb 2026) | 1 major |
| React Native | 0.81.5 | 0.84 (Feb 2026) | 3 minor (SDK 55 targets 0.83) |
| React | 19.1.0 | 19.2 | 1 minor |
| TypeScript | 5.9.3 | Current | ✅ |
| Node.js | 25.5.0 | 25.x | ✅ (SDK 55 supports ^24.3.0, ^25.0.0) |
| Hermes | Default (SDK 54) | V1 available (opt-in SDK 55) | Optional upgrade |

### Codebase Metrics

| Metric | Value |
|--------|-------|
| Total dependencies | 61 production + 9 dev |
| Screens | 34 (5 tab + 29 hidden) |
| Engines | 20 files |
| Services | 34 files |
| Components | 24+ (plus GlassUI library) |
| Custom hooks | 5 |
| SQLite tables | 31+ across 4 domains |
| Schema version | 16 (auto-migrating) |
| Exercises seeded | ~1,300 |
| Tests | 157/157 passing (Vitest) |
| TypeScript errors | 0 |
| Languages (i18n) | 15 |

### Architecture Summary

```
ThemeProvider → LanguageProvider → DatabaseProvider → ApolloProvider (legacy) → ThemedTabs
```

- **Data**: SQLite (`expo-sqlite`) is the single source of truth
- **Security**: AES-256-GCM v3 encryption, biometric auth, PBKDF2 passcode
- **State**: React Context (primary) + Zustand (auth only)  
- **Routing**: Expo Router v6 (file-based)
- **New Architecture**: Enabled (`newArchEnabled: true`)

---

## 2. Dependency Upgrade Analysis

### Expo SDK 54 → 55: Recommended Upgrade

**SDK 55 ships React Native 0.83 + React 19.2.** This is the recommended upgrade path — not RN 0.84, which requires building from source.

#### Key SDK 55 Features Relevant to FitQuest

| Feature | Impact on FitQuest | Priority |
|---------|-------------------|----------|
| **Legacy Architecture dropped** | Already on New Arch — no impact. Remove `newArchEnabled` from app.json. | LOW |
| **Hermes V1 opt-in** | Better ES6+ performance, async/await. Increases build times. | MEDIUM |
| **Bytecode diffing for expo-updates** | ~75% smaller OTA updates. Add `enableBsdiffPatchSupport: true`. | HIGH |
| **expo-crypto AES-GCM support** | Could replace `@noble/ciphers` for native AES-GCM. Evaluate migration. | MEDIUM |
| **expo-sqlite Inspector DevTools** | Real-time DB browsing during development. Free productivity gain. | HIGH |
| **expo-sqlite tagged template literals** | Type-safe parameterized SQL: `` db.sql`SELECT * FROM users WHERE age > ${age}` `` | MEDIUM |
| **expo-blur stable on Android** | Better glass-morphism UI without performance cost (RenderNode API). | HIGH |
| **expo-audio playlist + lock screen** | Background audio for workout timer cues and FitMind reading. | MEDIUM |
| **expo-widgets (iOS alpha)** | Home screen widgets for workout streaks/daily goals. | LOW (alpha) |
| **expo-sharing receive support** | Users can share articles into FitMind from other apps. | MEDIUM |
| **Edge-to-edge mandatory (Android 16+)** | Already enabled. `edgeToEdgeEnabled` config removed. | LOW |
| **New package versioning** | All Expo packages use SDK major version (e.g., expo-camera ^55.0.0). | INFO |

#### Breaking Changes Affecting FitQuest

| Change | Impact | Action |
|--------|--------|--------|
| `newArchEnabled` removed from app.json | Config key no longer needed | Remove from app.json |
| `edgeToEdgeEnabled` removed | Already enabled, config key removed | Remove from app.json |
| expo-av removed from Expo Go | App uses expo-speech, not expo-av | No impact |
| `eas update` requires `--environment` flag | CI scripts need updating | Update deploy scripts |
| expo-notifications: push in Expo Go throws | Already using dev builds for native features | No impact |
| Minimum Xcode: 26 | iOS builds need Xcode 26.2 | Update CI build images |

#### Upgrade Command

```bash
npx expo install expo@^55.0.0 --fix
npx expo-doctor@latest
# Then: remove newArchEnabled and edgeToEdgeEnabled from app.json
```

### Node.js Compatibility

| SDK | Supported Node Versions |
|-----|------------------------|
| SDK 54 | >=20.19.4 <21 (current constraint in package.json) |
| SDK 55 | ^20.19.4, ^22.13.0, ^24.3.0, ^25.0.0 |

**Current Node v25.5.0 is fully compatible with SDK 55.** The `engines` field in package.json has been updated to `>=20.19.4`.

### React Native 0.83 Changes (via SDK 55)

- **React 19.2** with two major new APIs:
  - `<Activity>` component — hidden/visible modes for state preservation. Keeps off-screen UI mounted but invisible, preserving state without rendering cost. Ideal for tab navigation (keep workout state alive when switching to FitMind).
  - `useEffectEvent` hook — splits event logic from Effect dependencies, reducing stale closure bugs.
- **IntersectionObserver API** (canary) — async layout intersection detection for lazy loading and viewport-based triggers.
- **Web Performance APIs** (stable) — `performance.now()`, `PerformanceObserver`, `performance.mark()/measure()`, Event Timing, Long Tasks. Works in production builds for real-world perf monitoring.
- **New DevTools**: Network inspection panel (view requests/timings/headers), Performance tracing (JS execution + React tracks in single timeline), standalone desktop app.
- **RCT_REMOVE_LEGACY_ARCH flag** — on iOS: ~20% build time reduction, ~6% app size reduction.
- **ZERO user-facing breaking changes** — first RN release with no breaks. 594 commits from 56 contributors.

### Expo SDK 55 Additional Features

| Feature | Relevance to FitQuest |
|---------|----------------------|
| **Expo Router: Native Tabs API** | Platform-native tab experience for iOS/Android with responsive web layout |
| **Expo Router: Colors API** | Dynamic Material 3 styles on Android, adaptive colors on iOS |
| **Expo Router: Zoom transitions** | Interactive shared element transitions on iOS (Apple-only) |
| **Expo Router: Stack.Toolbar** | UIToolbar API for iOS — useful for workout action buttons |
| **Expo Router: SplitView (experimental)** | Tablet layout support for iPad |
| **expo-blur stable on Android** | Glass-morphism without performance cost (RenderNode API on Android 12+) |
| **expo-audio playlists + lock screen** | Background audio for workout timer cues, FitMind reading |
| **expo-widgets (iOS alpha)** | Home screen widgets for streak/goals at a glance |
| **expo-sharing receive (experimental)** | Share articles into FitMind from other apps |
| **expo-image: HDR + SF Symbols** | Richer exercise/UI imagery |
| **expo-camera: video stabilization** | Future exercise form analysis (smooth video capture) |
| **Expo Modules Core: Swift 6 + ArrayBuffer** | Thread-safe native modules, efficient binary data transfer |
| **expo-brownfield** | Isolated/integrated native app embedding (future partner integrations) |
| **Expo UI (beta)** | Jetpack Compose + SwiftUI native components from JS |
| **New package versioning** | All Expo packages match SDK major version (e.g., expo-camera ^55.0.0) |

### Expo SDK 55 Breaking Changes Affecting FitQuest

| Change | Impact | Action |
|--------|--------|--------|
| `newArchEnabled` removed | Config key must be deleted | Remove from app.json |
| `edgeToEdgeEnabled` removed | Config key must be deleted | Remove from app.json |
| expo-av removed from Expo Go | App uses expo-speech, not expo-av | No impact |
| `eas update` requires `--environment` | CI scripts need flag | Update deploy scripts |
| `notification` config removed from app.json | We use expo-notifications plugin instead | No impact |
| Minimum Xcode: 26 | iOS builds need Xcode 26.2 | Update CI build images |
| `expo-navigation-bar` methods deprecated | Edge-to-edge mandatory on Android 16+ | Remove nav bar calls if any |

### React Native 0.84 (NOT recommended yet)

- Requires building React Native from source (massive build time increase)
- Hermes V1 as default
- Node.js 22 minimum
- Legacy architecture fully removed
- **Verdict**: Wait for SDK 56 (Q2 2026, May/June) which will include RN 0.85

---

## 3. Security Assessment

### Current Security Posture: STRONG (with 1 blocker)

| Layer | Status | Details |
|-------|--------|---------|
| **Encryption at rest** | ✅ SOLID | AES-256-GCM v3, auto-migration from v1/v2 |
| **Key management** | ✅ SOLID | Master key in SecureStore, PBKDF2 derivation |
| **Biometric auth** | ✅ SOLID | 5-attempt lockout, exponential backoff, 30-min sessions |
| **Emergency wipe** | ✅ SOLID | 15-failure threshold, secure deletion |
| **Health data protection** | ✅ SOLID | All health metrics encrypted before SQLite storage |
| **AI conversation privacy** | ✅ SOLID | Encrypted storage in `encrypted_ai_conversations` |
| **Crash reporting** | 🟡 BROKEN IMPORT | Sentry @7.2.0 installed, but `crashReporting.ts` imports `sentry-expo` instead of `@sentry/react-native` |
| **Secrets in repo** | ✅ RESOLVED | `server/` directory deleted (was containing JWT secret + refresh pepper) |
| **Storage security** | ✅ SOLID | SecureStore for tokens/keys, no AsyncStorage usage |

### � FIX NEEDED: Sentry Import Mismatch

The file `src/services/crashReporting.ts` imports `sentry-expo` but the installed package is `@sentry/react-native ~7.2.0`. All references to `sentryExpo.Sentry` must be changed to use the `@sentry/react-native` API.

**Action**: Rewrite `crashReporting.ts` to import from `@sentry/react-native`.

### ✅ RESOLVED: Secrets in `server/`

The `server/` directory (containing committed JWT secret + refresh pepper in `.env`) has been deleted.

### SDK 55 Security Opportunity

Expo SDK 55 adds native `expo-crypto` AES-GCM support. Currently FitQuest uses `@noble/ciphers` (JS-level AES-GCM). Migrating to `expo-crypto` would:
- Move encryption to native layer (faster, tamper-resistant)
- Remove a JS dependency
- Maintain same AES-256-GCM algorithm

**expo-crypto AES-GCM API (SDK 55):**
```typescript
import { AESEncryptionKey, aesEncryptAsync, aesDecryptAsync, AESSealedData } from 'expo-crypto';

// Generate key (store in SecureStore)
const key = await AESEncryptionKey.generate(); // 256-bit default
const keyHex = await key.encoded('hex');

// Encrypt
const sealedData = await aesEncryptAsync(plaintextBase64, key);
const combined = await sealedData.combined('base64'); // IV + ciphertext + tag

// Decrypt
const sealed = AESSealedData.fromCombined(combinedBase64);
const plaintext = await aesDecryptAsync(sealed, key, { output: 'base64' });
```

**Key details**: Supports AES-128/192/256, GCM tag lengths (4-16 bytes, default 16), AAD (additional authenticated data), custom nonce, key import/export (hex/base64). Works on Android, iOS, tvOS, Web.

**Migration strategy**: After SDK 55 upgrade, create `encryptV4()` / `decryptV4()` using `expo-crypto` APIs. Add v4 payload detection to auto-migrate v3 → v4 on read. Current `@noble/ciphers` v3 is sound — this is an optimization.

**Recommendation**: Evaluate after SDK 55 upgrade. The current `@noble/ciphers` implementation is cryptographically sound — this is an optimization, not a fix.

---

## 4. Database & Data Layer

### Schema Status: v16 (Mature)

| Domain | Tables | Status |
|--------|--------|--------|
| Core Fitness | 13 (exercises, profiles, sessions, progress, equipment) | ✅ Stable |
| App State | 5 (app_state, subscription, trial, streaks, audio) | ✅ Stable |
| Encrypted Health | 5 (health_data, ai_conversations, notes, alerts) | ✅ Stable |
| Health Monitoring | 4 (heart_rate, anomaly_log, daily_summaries, content_hashes) | ✅ Stable |
| FitMind | 6 (documents, sessions, annotations, flashcards, goals, streaks) | ✅ Stable |
| Body Craft | 1 (body_craft_algorithms) | ✅ Stable |

**Key Facts:**
- Auto-migration chain v0→v16 complete
- v16 was a nuclear fix (dropped exercise tables, re-seeded with correct category names)
- Categories: `body_control`, `posture`, `speed`, `mobility`, `focus`, `strength`
- ~1,300 exercises seeded (was 364 variations stripped in v12)
- Timestamp convention: Core tables use TEXT ISO 8601, encrypted/FitMind tables use INTEGER Unix epoch

### Data Access Patterns

| Access Type | Mechanism | Used By |
|-------------|-----------|---------|
| Core fitness CRUD | `DatabaseService` (src/database/service.ts) | All workout/profile screens |
| Sensitive data | `EncryptedDatabase` (src/security/EncryptedDatabase.ts) | Health, AI, notes |
| FitMind data | `FitMindService` (src/fitmind/schema.ts) | Library, reader, flashcards |
| App state (XP, settings) | `app_state` table via `xpService` | Dashboard, profile |
| Subscriptions | `subscription_state` + `trial_state` tables | Paywall, feature gates |

### SDK 55 SQLite Improvements

- **SQLite Inspector DevTools**: Browse on-device DB in real time during development. Visual data browser + SQL query tab for debugging schema/data issues.
- **Tagged template literals**: Type-safe parameterized SQL with auto-bound parameters (prevents SQL injection): 
  ```typescript
  await db.sql`SELECT * FROM exercises WHERE category = ${cat}`;
  ```
- Both are additive — no migration needed. Existing `DatabaseService` code continues to work.

---

## 5. Monetization & Revenue Readiness

### Current State: BLUEPRINTED, NOT OPERATIONAL

| Component | Status | Location |
|-----------|--------|----------|
| Subscription types/state machine | ✅ Built | src/purchases/SubscriptionManager.ts |
| React Context provider | ✅ Built | src/purchases/SubscriptionContext.tsx |
| Trial onboarding flow | ✅ Built | src/purchases/TrialOnboarding.ts |
| Paywall UI | ✅ Built | app/paywall.tsx |
| SQLite subscription tables | ✅ Built | subscription_state + trial_state |
| **RevenueCat SDK** | � IN PACKAGE.JSON | Added to deps, needs `npm install` |
| RevenueCat Dashboard | 🔴 NOT CONFIGURED | No project/products/offerings set up |
| App Store Connect | 🔴 NOT CONFIGURED | No IAP products or subscription groups |
| Google Play Console | 🔴 NOT CONFIGURED | No subscription products |

### Revenue Model (Designed)

- **Trial**: 14-day free, no credit card required
- **Pricing tiers**: Monthly vs. Annual (region-specific)
- **Feature gating**: Single premium tier, no artificial limits during trial
- **Grace period**: 7-day offline grace for expired subscriptions
- **Lifetime option**: Planned but not implemented

### RevenueCat Installation Plan

```bash
# Install SDK + UI components (for remote paywalls)
npx expo install react-native-purchases react-native-purchases-ui

# Add BILLING permission to app.json android.permissions
# Requires: development build (not Expo Go) for testing
```

### RevenueCat SDK Configuration

```typescript
import Purchases from 'react-native-purchases';

// SDK initialization (call once in app startup)
Purchases.logLevel = Purchases.LOG_LEVEL.DEBUG; // development only
await Purchases.configure({
  apiKey: Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY,
  appUserID: userId, // or null for anonymous
});
```

**Test Store**: RevenueCat provides a built-in Test Store that works immediately — no App Store Connect or Play Console setup required for development testing. Use the Test Store API key during development and platform-specific keys for production.

**CRITICAL**: Never ship with the Test Store API key. Use environment variables to switch keys per build type.

### RevenueCat Paywall Display Patterns

RevenueCat's `react-native-purchases-ui` provides three paywall display methods:

```typescript
import RevenueCatUI from 'react-native-purchases-ui';

// 1. MODAL PAYWALL — shows on invocation
await RevenueCatUI.presentPaywall();

// 2. SMART PAYWALL — only shows if user lacks the entitlement
await RevenueCatUI.presentPaywallIfNeeded({
  requiredEntitlementIdentifier: 'premium',
});

// 3. COMPONENT PAYWALL — manual placement for custom UX
<RevenueCatUI.Paywall
  onPurchaseCompleted={({ customerInfo }) => { /* update local state */ }}
  onPurchaseError={({ error }) => { /* handle */ }}
  onRestoreCompleted={({ customerInfo }) => { /* verify premium */ }}
  onDismiss={() => { /* user closed */ }}
/>
```

**Recommended for FitQuest**: Use `presentPaywallIfNeeded` for feature gates (simplifies logic — auto-checks entitlement). Use `<RevenueCatUI.Paywall>` component for the dedicated paywall screen.

### RevenueCat Advanced Features

| Feature | Impact on FitQuest | How to Use |
|---------|-------------------|------------|
| **Exit Offers** | Secondary paywall auto-shown when user dismisses without purchasing. Boosts conversion. | Configure in RevenueCat dashboard (no code changes). Requires RN SDK ≥9.6.15. |
| **Custom Variables** | Pass dynamic values (user name, workout count, streak) into paywall text for personalization. | `CustomVariableValue.string('value')` in paywall config. |
| **Locale Override** | Force paywall language to match app's i18n setting (15 languages supported). | `Purchases.overridePreferredUILocale("de-DE")` |
| **Custom Fonts** | Upload brand fonts via dashboard for paywall text consistency. | Dashboard: Paywall Editor → Fonts. |
| **CustomerInfo Listener** | React to subscription changes in real-time (purchase, renewal, expiry). | `Purchases.addCustomerInfoUpdateListener(info => { ... })` |
| **Default Paywall Fallback** | Auto-shows a basic paywall if no paywall template is configured for an offering. | Automatic — no code needed. |

### RevenueCat Integration Strategy

Wire into existing FitQuest subscription scaffolding:
1. `SubscriptionManager.ts` → call `Purchases.configure()` on init, `Purchases.getCustomerInfo()` for status
2. `SubscriptionContext.tsx` → expose `customerInfo` state, add `CustomerInfo` update listener
3. `app/paywall.tsx` → replace manual UI with `<RevenueCatUI.Paywall>` or keep custom UI with `purchasePackage()` calls
4. `TrialOnboarding.ts` → configure 14-day trial via RevenueCat offering (server-managed)
5. Feature gates → `presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'premium' })` at gate points

**app.json changes needed:**
```json
{
  "android": {
    "permissions": [
      "com.android.vending.BILLING"  // ADD THIS
    ]
  }
}
```

**Post-install steps:**
1. Create RevenueCat project at app.revenuecat.com
2. Connect Apple App Store + Google Play Store
3. Create products → entitlements → offerings → paywall
4. Configure SDK with platform API keys
5. Wire `SubscriptionManager` to RevenueCat API calls
6. Test with sandbox accounts

### Revenue Projections (From Research)

| Timeframe | Monthly Revenue | Assumptions |
|-----------|----------------|-------------|
| Month 1 | $2,000-5,000 | 500-1,000 installs, 2-4% conversion |
| Month 3 | $10,000-20,000 | Organic growth + ASO |
| Month 6 | $30,000-66,000 | Retention improvements + annual plans |
| Year 1 | $100,000-220,000 | Compounding annual subscriptions |

---

## 6. Health Integration

### Current State: ENGINE-COMPLETE, ADAPTER-INCOMPLETE

| Component | Status | Details |
|-----------|--------|---------|
| Health monitoring engine | ✅ Complete | HealthMonitor.ts — daily tracking, goals, summaries |
| Anomaly detection | ✅ Complete | AnomalyDetector.ts — z-score, IQR, multi-metric |
| Sleep analysis | ✅ Complete | SleepAnalysisEngine.ts — scoring, debt, circadian |
| Background health | ✅ Complete | BackgroundHealthEngine.ts — orchestrates all subsystems |
| Sensor fusion | ✅ Complete | SensorFusionEngine.ts — accelerometer + gyro + pedometer |
| Step counting | ✅ Complete | StepCounterEngine.ts |
| Distance estimation | ✅ Complete | DistanceEngine.ts |
| Health dashboard UI | ✅ Complete | app/health-dashboard.tsx |
| **Apple HealthKit adapter** | 🟡 Scaffolded | react-native-health installed, not wired to engines |
| **Google Health Connect adapter** | 🟡 Scaffolded | react-native-health-connect installed, not wired |
| **Wearable sync** | 🔴 Not started | No Apple Watch / Wear OS integration |

### Health Platform Integration Gap

The engines are fully built and tested. What's missing is the **adapter layer** that reads from HealthKit/Health Connect and feeds data into the existing engines.

**Required work:**
1. Create `src/adapters/HealthKitAdapter.ts` — reads HealthKit data, converts to engine format
2. Create `src/adapters/HealthConnectAdapter.ts` — same for Android  
3. Wire adapters to `BackgroundHealthEngine.collectData()` 
4. Add health data permissions to app.json
5. Test with real device data

**Dependencies already installed:** `react-native-health` (iOS), `react-native-health-connect` (Android)

---

## 7. AI & Cognitive Fitness

### Dual AI System: COMPLETE (Template-Based)

| Component | Status | Details |
|-----------|--------|---------|
| COACH personality | ✅ Complete | Workout tips, form guidance, motivation |
| PROFESSOR personality | ✅ Complete | Reading comprehension, Socratic prompts |
| Intent routing | ✅ Complete | NLP-lite keyword scoring + context weighting |
| Conversation encryption | ✅ Complete | AES-256-GCM in encrypted_ai_conversations |
| Chat UI (Coach) | ✅ Complete | app/coach/ |
| Chat UI (Professor) | ✅ Complete | app/professor/ |

### FitMind Cognitive Module: COMPLETE

| Component | Status | Details |
|-----------|--------|---------|
| Document library | ✅ Complete | PDF/EPUB/ARTICLE/NOTE support |
| Document processor | ✅ Complete | Import, text analysis, Flesch-Kincaid scoring |
| Import pipeline | ✅ Complete | Validation, SHA-256 dedup, chunking, quota |
| Reader | ✅ Complete | Paginated, annotations, AI chat panel |
| Flashcards (FSRS) | ✅ Complete | ts-fsrs spaced repetition, SM-2 fallback |
| Reading tracker | ✅ Complete | Session lifecycle, focus scoring, WPM |
| Reading goals/streaks | ✅ Complete | Daily/weekly/monthly targets |

### Future AI Opportunities

| Enhancement | Complexity | Impact | Priority |
|-------------|-----------|--------|----------|
| On-device LLM (ExecuTorch) | HIGH (4-6 weeks) | Offline coaching without templates | LOW — templates work well |
| Exercise form analysis (camera) | HIGH (6-8 weeks) | Real-time rep counting from video | LOW — sensor fusion already works |
| Adaptive response tone | LOW (1 week) | Personalize coach personality over time | MEDIUM |
| Document summarization | MEDIUM (2-3 weeks) | Auto-generate FitMind summaries | MEDIUM |

---

## 8. Performance & Quality

### Test Coverage

| Area | Tests | Status |
|------|-------|--------|
| Workout generation | ✅ | Deterministic output verification |
| Progression engine | ✅ | Difficulty scaling, rep targets |
| Recovery engine | ✅ | Fatigue decay, deload detection |
| Health engine | ✅ | BMR, TDEE, body fat, heart rate zones |
| AI / intent routing | ✅ | Intent classification accuracy |
| Validation (zod) | ✅ | Schema validation edge cases |
| Security | ✅ | Encryption round-trip, key management |
| Reader | ✅ | Document processing, session tracking |
| **Total** | **157/157** | **All passing** |

### Missing Test Areas

| Area | Priority | Complexity |
|------|----------|-----------|
| E2E tests (Detox/Maestro) | HIGH | 2-3 weeks setup + authoring |
| UI component tests | MEDIUM | 1 week (React Native Testing Library) |
| Database migration tests | MEDIUM | 1 week |
| Subscription flow tests | HIGH | 1 week (after RevenueCat installed) |

### Build & Performance

| Metric | Current | Target |
|--------|---------|--------|
| Cold start (estimated) | Not measured | < 2 seconds |
| Bundle size (JS) | Not measured | < 15 MB |
| Crash rate | Not measured (Sentry installed but not configured) | < 0.1% |
| ANR rate | Not measured | < 0.5% |

**Sentry Configuration Status**: Package installed (`@sentry/react-native ~7.2.0`), but `Sentry.init()` call needs verification and DSN configuration.

---

## 9. Feature Completeness Matrix

### Core Features

| Feature | Status | Notes |
|---------|--------|-------|
| Workout generation | ✅ 100% | Deterministic, fatigue-aware, equipment-based |
| Exercise catalogue | ✅ 100% | ~1,300 exercises, 6 categories |
| Workout execution | ✅ 100% | Timer, audio cues, exercise-by-exercise flow |
| Progress tracking | ✅ 100% | XP system, streak tracking, session history |
| Sensor fusion | ✅ 100% | Steps, activity classification, rep counting |
| Health monitoring | ✅ 100% | Daily summaries, anomaly detection, sleep |
| Health dashboard | ✅ 100% | Composite score, metric rings, trend charts |
| FitMind library | ✅ 100% | Document import, reader, flashcards |
| Dual AI chat | ✅ 100% | Coach + Professor, encrypted storage |
| Theme system | ✅ 100% | Dark/light mode, glass-morphism UI |
| i18n | ✅ 100% | 15 languages including SA languages |
| Biometric auth | ✅ 100% | Face ID/fingerprint + passcode fallback |
| Encryption | ✅ 100% | AES-256-GCM v3, auto-migration |
| Move module | ✅ 90% | Steps, jog tracking, distance estimation |
| Nutrition calculator | ✅ 90% | BMR/TDEE, macro targets, food database |
| Body Craft algorithm | ✅ 90% | Body type analysis, training splits |

### Revenue-Critical Features

| Feature | Status | Blocker |
|---------|--------|---------|
| Paywall UI | ✅ Built | — |
| Subscription state machine | ✅ Built | — |
| Trial system | ✅ Built | — |
| **RevenueCat SDK** | � IN PACKAGE.JSON | **Run `npm install`** |
| **Store products** | 🔴 NOT CONFIGURED | **App Store Connect + Play Console** |
| **Receipt validation** | 🔴 NOT BUILT | **RevenueCat handles server-side** |

### Platform Features

| Feature | Status | Priority |
|---------|--------|----------|
| HealthKit integration | 🟡 Scaffolded | HIGH |
| Health Connect integration | 🟡 Scaffolded | HIGH |
| Push notifications | 🟡 Configured | MEDIUM (expo-notifications in plugins) |
| OTA updates | ✅ Configured | expo-updates ON_LOAD |
| Deep linking | ✅ Configured | scheme: "fitquest" |
| Cloud backup | 🟡 Scaffolded | LOW (client-side architecture) |
| Home widgets | 🔴 Not started | LOW (iOS alpha in SDK 55) |
| Apple Watch | 🔴 Not started | LOW |

---

## 10. Competitive Landscape

### Feature Parity vs. Market Leaders

| Feature | FitQuest | Fitbod | JEFIT | Strong | Nike Training |
|---------|----------|--------|-------|--------|---------------|
| Workout generation | ✅ Fatigue-aware | ✅ ML-based | ❌ Manual | ❌ Manual | ✅ Curated |
| Exercise library | ~1,300 | ~1,000 | ~1,300 | ~300 | ~200 |
| Sensor fusion | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| Health monitoring | ✅ Full stack | ❌ | ❌ | ❌ | ❌ |
| AI coaching | ✅ Dual AI | ❌ | ❌ | ❌ | ❌ |
| Reading/learning | ✅ FitMind | ❌ | ❌ | ❌ | ❌ |
| Offline-first | ✅ Full | ✅ Partial | ❌ | ✅ Partial | ❌ |
| Privacy (on-device) | ✅ All data local | ❌ Cloud-first | ❌ Cloud | ❌ Cloud | ❌ Cloud |
| Encryption | ✅ AES-256-GCM | ❌ | ❌ | ❌ | ❌ |

### FitQuest Differentiators

1. **Fully offline-first** — all data on-device, no server dependency
2. **Body + Mind (FitMind)** — only app combining physical fitness with cognitive training
3. **Privacy-by-design** — AES-256-GCM encryption, biometric auth, no cloud data
4. **Dual AI coaching** — workout coach + reading professor in one app
5. **Open health engine** — anomaly detection, sleep analysis, recovery scoring
6. **15-language i18n** — broader market reach including African languages

---

## 11. Upgrade Recommendations

### Immediate Priority (Week 1)

| # | Action | Impact | Time |
|---|--------|--------|------|
| 1 | Run `npm install` for RevenueCat SDK | Unblocks monetization | 1 minute |
| 2 | ~~Delete `server/` directory~~ | ✅ Done — committed secrets removed | — |
| 3 | ~~Update `engines.node` in package.json~~ | ✅ Done — constraint relaxed | — |
| 4 | Fix Sentry import in crashReporting.ts | Crash reporting operational | 15 minutes |
| 5 | ~~Add BILLING permission to app.json~~ | ✅ Done | — |

### Short-Term (Weeks 2-3)

| # | Action | Impact | Time |
|---|--------|--------|------|
| 6 | Upgrade Expo SDK 54 → 55 | RN 0.83, React 19.2, better tooling | 2-4 hours |
| 7 | Wire HealthKit adapter | Apple health data flows into engines | 2-3 days |
| 8 | Wire Health Connect adapter | Android health data flows into engines | 2-3 days |
| 9 | Configure RevenueCat dashboard | Products, entitlements, offerings | 2-3 hours |
| 10 | Set up E2E testing framework | Automated UI testing | 3-5 days |

### Medium-Term (Weeks 4-8)

| # | Action | Impact | Time |
|---|--------|--------|------|
| 11 | Accessibility audit + fixes | WCAG compliance, screen readers | 1 week |
| 12 | UI consistency pass | Replace hardcoded colors, raw Text → ThemedText | 3-5 days |
| 13 | Sandbox IAP testing | Verify purchase flows end-to-end | 1 week |
| 14 | App Store submission prep | Screenshots, metadata, privacy labels | 1 week |
| 15 | Play Store submission prep | Same + content rating questionnaire | 1 week |

### Long-Term (Months 3-6)

| # | Action | Impact | Time |
|---|--------|--------|------|
| 16 | Enable expo-updates bytecode diffing | 75% smaller OTA updates | 1 hour |
| 17 | Evaluate expo-crypto for encryption | Native AES-GCM (faster, tamper-resistant) | 1 week |
| 18 | Home screen widgets (iOS) | Engagement: streak/goals at a glance | 1-2 weeks |
| 19 | On-device LLM exploration | Offline AI without templates | 2-4 weeks |
| 20 | Wearable integration | Apple Watch / Wear OS companion | 4-6 weeks |

---

## 12. Feature Audit — Current State & Gaps (March 2026)

### 12.1 Exercise Images (CRITICAL GAP)

**Status**: Database seeded, files NOT on device

- 873 exercises in `workspace-repos/exercise-content/free-exercise-db/exercises/` with 2 frames each (0.jpg start, 1.jpg end)
- `exercise_images` table seeded via `external-exercises-data.ts` (1736 INSERT statements)
- `ExerciseImage.tsx` component resolves images from `documentDirectory/exercises/{folder}/images/{file}`
- **Gap**: No mechanism copies image files from source to device `documentDirectory` — users see only placeholder icons
- **Fix**: Build an on-first-launch asset copy service that copies bundled exercise images (via expo-asset config plugin) to `documentDirectory/exercises/`
- Image sharing works: `shareExternalImagesToCore()` maps external exercise images to core exercises by fuzzy name match

### 12.2 AI Coach & Professor

**Status**: Template engine working, conversation persistence broken

- DualAIEngine has 100+ coach templates and 50+ professor prompts across 15+ categories
- IntentRouter classifies 7 intent categories with keyword scoring
- Coach screen loads user context (streak, fatigue, workouts, XP) for personalization
- `storeAIConversation()` exists in EncryptedDatabase and is called from DualAIEngine
- **Gap 1**: Coach screen (`app/coach/index.tsx`) never loads conversation history from DB — messages lost on navigation
- **Gap 2**: Template placeholder substitution incomplete — `{name}`, `{streakDays}`, `{muscleGroup}` sometimes show as literal strings
- **Gap 3**: OpenAI cloud provider toggle in Professor is entirely decorative — no HTTP calls implemented
- **Gap 4**: No follow-up suggestion buttons after responses
- **Fix**: Load encrypted_ai_conversations on screen mount, save messages on each send, fix template substitution

### 12.3 Move Module (Steps/Jogging)

**Status**: Step counting works, GPS tracking stubbed

- usePedometer hook integrates expo-sensors Pedometer + SensorFusionEngine fallback
- Jog session type structure has `route_data` (JSON), `distance_meters`, `avg_pace_per_km`
- **Gap 1**: `startJog(useGPS)` parameter never activates `expo-location` — no actual GPS tracking
- **Gap 2**: Step counting stops on app background (AppState pauses)
- **Gap 3**: No split pacing alerts or cadence coaching
- **Fix**: Install `expo-location`, wire `Location.watchPositionAsync()` during jog sessions, use `Location.startLocationUpdatesAsync()` for background tracking

### 12.4 Dashboard & Health Dashboard

**Status**: UI complete, data sources partially wired

- Dashboard shows XP, streaks, fatigue, recent workouts, completion rate, weekly heatmap
- Health dashboard shows composite score, metric rings, anomaly alerts, trend bars
- **Gap 1**: Health adapter integration stubbed — HealthKit/Health Connect buttons do nothing
- **Gap 2**: Anomaly alerts from AnomalyDetector never surface in UI
- **Gap 3**: Sleep analysis requires manual input not implemented
- **Gap 4**: No goal achievement celebrations (reaching 10k steps, weekly workout target)
- **Fix**: Wire `encryptedDB.getActiveAlerts()` to health dashboard, add dismiss callback

### 12.5 FitMind (Reading/Cognitive)

**Status**: Core library + reader working, advanced features stubbed

- Document CRUD, PDF/EPUB viewing, annotation system, reading session tracking all functional
- SM-2 spaced repetition for flashcards implemented
- **Gap 1**: Document deduplication via SHA-256 hash never executes
- **Gap 2**: OpenAI integration for Professor is decorative
- **Gap 3**: Storage quota enforcement (50MB/file, 500MB total) not implemented
- **Gap 4**: No quiz generation from highlights/annotations

### 12.6 Workout Generation

**Status**: 3-engine system fully functional, minor UX gaps

- WorkoutGenerator: multi-factor scoring (freshness, goal alignment, pattern, progression, variety)
- ProgressionEngine: success ratio tracking, rep/set progression with ceilings
- RecoveryEngine: daily passive recovery (8%), fatigue accumulation, deload detection
- **Gap 1**: Progressive overload not signaled to user — no celebration for PRs
- **Gap 2**: Rest time hardcoded to 60s regardless of exercise/fatigue/fitness level
- **Gap 3**: Warmup/cooldown generation failures silently produce empty arrays
- **Gap 4**: Adaptive training profile returned but never applied

### 12.7 Workspace-Repos Resources

Available libraries cloned for future integration:

| Directory | Contents | Integration Status |
|-----------|----------|-------------------|
| `exercise-content/free-exercise-db` | 873 exercises + 1746 images | DB seeded, images not on device |
| `exercise-content/exercises.json` | JSON exercise catalogue | Used by import script |
| `ai-enhancement/llama.cpp` | GGML inference engine | Not integrated (future on-device LLM) |
| `ai-enhancement/react-native-executorch` | Meta ExecuTorch RN bridge | Not integrated |
| `ai-enhancement/ts-fsrs` | TypeScript FSRS spaced repetition | Not integrated (using custom SM-2) |
| `health-integrations/react-native-health` | iOS HealthKit binding | Not integrated |
| `health-integrations/react-native-health-connect` | Android Health Connect API | Not integrated |
| `health-integrations/react-native-google-fit` | Android Google Fit binding (deprecated) | Not needed (Health Connect preferred) |
| `visualization/react-native-chart-kit` | Chart rendering library | Not integrated |
| `visualization/victory-native` | Victory charts for RN | Not integrated |
| `visualization/react-native-reanimated` | Animation engine | Already installed via npm |

---

## Appendix A: Resolved Blockers (Previously Critical)

These were flagged in earlier audits but are now confirmed resolved:

| Blocker | Status | Verification |
|---------|--------|-------------|
| Android package `com.anonymous.mobile` | ✅ FIXED | app.json: `com.hugelet.fitquest` |
| Sentry not installed | ✅ FIXED | `@sentry/react-native ~7.2.0` in node_modules |
| Exercise variations bloating DB | ✅ FIXED | v12 migration stripped 364 variations |
| XOR encryption (v1) | ✅ FIXED | Auto-migrated to AES-256-GCM v3 |
| `last_read_at` column bug | ✅ FIXED | Using `updated_at` everywhere |

## Appendix B: Files This Document Replaces

The following documents are superseded by this research:

| File | Reason |
|------|--------|
| docs/ENHANCEMENT_RESEARCH_COMPREHENSIVE_2026.md | Consolidated here |
| docs/ENHANCEMENT_RESEARCH.md | Outdated, older version |
| docs/AI_ENHANCEMENT_RESEARCH.md | Outdated enhancement list |
| docs/CODEBASE_AUDIT_AND_STRATEGY.md | Consolidated here |
| docs/DEPLOYMENT_READINESS_NOTES.md | Outdated deployment notes |
| docs/CHAT_UI_RESEARCH_NOTES.md | Chat UI already built |
| RESEARCH_SUMMARY.md | This is the new summary |
| EXPO_UPDATES_FIX.md | Issue already resolved |
| FITQUEST_AUDIT_REPORT.md | Superseded by this audit |
| SERVERLESS_MIGRATION.md | Architecture cancelled |
| PHASE2_CHECKLIST.md | Phase completed |
| PHASE3_SYNC_GUIDE.md | Sync cancelled (offline-only) |
| PHASE4_ANALYTICS.md | Consolidated into master plan |

## Appendix C: Expo SDK 55 Full Changelog Reference

**Release**: February 25, 2026  
**RN**: 0.83 | **React**: 19.2 | **Min Xcode**: 26 | **Min iOS**: 15.1 (bumping to 16.4 in SDK 56)

Key additions:
- Hermes V1 (opt-in, builds from source)
- Bytecode diffing for OTA updates (~75% size reduction)
- Native AES-GCM in expo-crypto
- SQLite Inspector DevTools + tagged template literals
- expo-blur stable on Android (RenderNode API)
- expo-widgets alpha (iOS home screen widgets)
- expo-sharing receive support
- expo-audio playlist + lock screen controls
- Expo UI (SwiftUI + Jetpack Compose) beta
- Expo Router: native tabs, zoom transitions, SplitView, Colors API
- New package versioning (all packages use SDK major version number)
- Agent skills + MCP enhancements for AI-assisted development

Breaking changes affecting FitQuest:
- Remove `newArchEnabled` from app.json (property removed)
- Remove `edgeToEdgeEnabled` from app.json (mandatory on Android 16+)
- `eas update` requires `--environment` flag
