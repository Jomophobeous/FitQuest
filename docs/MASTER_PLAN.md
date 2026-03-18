# FitQuest 2.0 — MASTER PLAN

> **Single source of truth for all development work.**  
> Follow this checklist sequentially. Check items off as completed.  
> Technical details: see [docs/COMPREHENSIVE_RESEARCH_2026.md](COMPREHENSIVE_RESEARCH_2026.md)

---

## Phase 0: Critical Blockers (Day 1)

> These MUST be done before any other work. They are immediate, small fixes.

- [x] **0.1** ~~Delete `server/` directory (contains committed secrets: JWT secret + refresh pepper)~~
- [x] **0.2** ~~Update `engines.node` in package.json from `">=20.19.4 <21"` to `">=20.19.4"`~~
- [x] **0.3** ~~Add RevenueCat SDK to package.json: `react-native-purchases` + `react-native-purchases-ui`~~
- [x] **0.4** ~~Add `"com.android.vending.BILLING"` to `android.permissions` in app.json~~
- [x] **0.5** ~~Run `npm install` to materialize RevenueCat packages in node_modules~~
- [x] **0.6** ~~Fix Sentry import: rewrite `src/services/crashReporting.ts` to use `@sentry/react-native` instead of `sentry-expo`~~
- [x] **0.7** ~~Run `npx expo-doctor@latest` — 17/17 checks passing~~
- [x] **0.8** ~~Run tests: `npm test` — 157/157 pass~~

---

## Phase 0.5: Feature Wiring (Days 2-5)

> Wire existing features that are scaffolded but not fully connected.
> These improve the actual user experience before any SDK upgrade.

### Exercise Image Pipeline
- [x] **0.5.1** Create `src/services/exerciseImageService.ts` — asset copy service that copies bundled images to `documentDirectory/exercises/`
- [x] **0.5.2** Bundle exercise images via expo-asset config plugin in app.json (or copy from bundled assets at first launch)
- [x] **0.5.3** Verify `ExerciseImage.tsx` displays real images after copy (test with 5 exercises)
- [x] **0.5.4** Wire `shareExternalImagesToCore()` to run after external seed

### AI Conversation Persistence
- [x] **0.5.5** Wire Coach screen to save messages via `encryptedDB.storeAIConversation()`
- [x] **0.5.6** Wire Coach screen to load conversation history on mount from `encrypted_ai_conversations`
- [x] **0.5.7** Wire Professor screen to save/load conversation history (same pattern)
- [x] **0.5.8** Fix template placeholder substitution — `fillTemplate()` already handles all placeholders with graceful fallbacks

### Health Dashboard Wiring
- [x] **0.5.9** Wire anomaly alerts: query `encryptedDB.getActiveAlerts()` and display in health dashboard
- [x] **0.5.10** Wire alert dismiss button to `encryptedDB.acknowledgeAlert()`

### Move Module GPS
- [x] **0.5.11** Install `expo-location` and add to app.json plugins — already installed (expo-location ~19.0.8) with permissions configured
- [x] **0.5.12** Wire `Location.watchPositionAsync()` in usePedometer `startJog()` for GPS route tracking — already implemented via DistanceEngine
- [x] **0.5.13** Store route points in `jog_sessions.route_data` as JSON — already saved by `endJogSession()`

---

## Phase 1: Expo SDK 55 Upgrade (Days 6-7)

> Upgrade framework to get RN 0.83, React 19.2, and better tooling.
> Zero user-facing breaking changes in RN 0.83. SDK 55 drops Legacy Architecture support (already on New Arch).

- [x] **1.1** Run `npx expo install expo@^55.0.0 --fix` — upgraded Expo 55.0.6, RN 0.83.2, React 19.2.0, expo-router 55.0.5, reanimated 4.2.1, + 34 companion packages
- [x] **1.2** Remove `newArchEnabled` from app.json (property removed in SDK 55 — already on New Arch)
- [x] **1.3** Remove `edgeToEdgeEnabled` from app.json android config (mandatory in SDK 55, config removed). Also removed `predictiveBackGestureEnabled`.
- [x] **1.4** Run `npx expo-doctor@latest` — 17/17 checks passed, no issues
- [ ] **1.5** Rebuild native project: `npx expo prebuild --clean && npx expo run:android`
- [ ] **1.6** Verify all screens render correctly on device/emulator
- [x] **1.7** Run tests: `npx vitest run` — 149/149 tests pass, 0 failures (10 test files)
- [x] **1.8** Run TypeScript check: `npx tsc --noEmit` — 0 errors
- [x] **1.9** ~~Enable bytecode diffing~~ — N/A: `enableBsdiffPatchSupport` does not exist in expo-updates 55.0.13. Bytecode diffing is handled server-side by EAS Update automatically.
- [x] **1.10** Evaluate `<Activity>` from React 19.2 — `React.Activity` is available as a symbol but still experimental. React Navigation / expo-router would need to adopt it at the navigation layer. Tab state is already preserved via React Navigation's built-in lazy mounting. Not actionable yet.

---

## Phase 2: RevenueCat Integration (Days 4-7)

> Wire payment processing into the existing paywall/subscription scaffolding.
> RevenueCat has a **Test Store** — no App Store/Play Console setup needed for dev testing.
> Use Test Store API key for development, platform API keys for production.

### Dashboard Setup
- [ ] **2.1** Create RevenueCat account and project at app.revenuecat.com
- [ ] **2.2** Connect Apple App Store (requires App Store Connect + shared secret)
- [ ] **2.3** Connect Google Play Store (requires Play Console service account JSON)
- [ ] **2.4** Create products in App Store Connect: monthly + annual subscription
- [ ] **2.5** Create products in Google Play Console: monthly + annual subscription
- [ ] **2.6** Create RevenueCat entitlement: `premium`
- [ ] **2.7** Attach products to entitlement in RevenueCat dashboard
- [ ] **2.8** Create RevenueCat offering: `default` with monthly + annual packages

### Paywall Configuration (Dashboard)
- [ ] **2.9** Configure RevenueCat paywall template in dashboard (FitQuest branding)
- [ ] **2.10** Configure exit offer — secondary paywall shown when user dismisses without purchasing
- [ ] **2.11** Upload custom fonts to dashboard for paywall text consistency
- [ ] **2.12** Set custom variables for paywall personalization (user name, workout count, streak)

### SDK Wiring
- [ ] **2.13** Add RevenueCat API keys via environment variables (NEVER hardcode)
- [ ] **2.14** Wire `SubscriptionManager.ts`: call `Purchases.configure()` on app launch with platform API key
- [ ] **2.15** Wire `SubscriptionManager.ts`: call `Purchases.getCustomerInfo()` for status checks
- [ ] **2.16** Add `Purchases.addCustomerInfoUpdateListener()` to `SubscriptionContext.tsx`
- [ ] **2.17** Wire locale override: `Purchases.overridePreferredUILocale()` matching app i18n setting (15 languages)
- [ ] **2.18** Wire feature gates: use `RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'premium' })` at gate points
- [ ] **2.19** Wire paywall screen: either replace `app/paywall.tsx` with `<RevenueCatUI.Paywall>` or keep custom UI with `purchasePackage()` calls
- [ ] **2.20** Wire restore purchases button to `Purchases.restorePurchases()`
- [ ] **2.21** Test purchase flow with Test Store (no real store setup needed)
- [ ] **2.22** Verify subscription state persists in SQLite after purchase

---

## Phase 3: Health Platform Adapters (Days 8-14)

> Wire existing health packages into the built engines.

- [ ] **3.1** Create `src/adapters/HealthKitAdapter.ts` — read Apple HealthKit data
- [ ] **3.2** Request HealthKit permissions (steps, heart rate, sleep, workouts)
- [ ] **3.3** Wire HealthKit data into `BackgroundHealthEngine.collectData()`
- [ ] **3.4** Test on iOS device with real HealthKit data
- [ ] **3.5** Create `src/adapters/HealthConnectAdapter.ts` — read Google Health Connect data
- [ ] **3.6** Request Health Connect permissions (steps, heart rate, sleep, exercise)
- [ ] **3.7** Wire Health Connect data into `BackgroundHealthEngine.collectData()`
- [ ] **3.8** Test on Android device with real Health Connect data
- [ ] **3.9** Add health data permissions to app.json (`ios.infoPlist` and `android.permissions`)
- [ ] **3.10** Verify health dashboard populates with real platform data

---

## Phase 4: Quality & Polish (Days 15-25)

> Fix UI consistency, accessibility, and add missing tests.

### Accessibility
- [ ] **4.1** Add `accessibilityRole` and `accessibilityLabel` to all interactive components
- [ ] **4.2** Test with TalkBack (Android) and VoiceOver (iOS)
- [ ] **4.3** Ensure all touch targets are ≥ 44x44 points

### UI Consistency
- [ ] **4.4** Audit all screens for hardcoded colors — replace with `theme.colors.*`
- [ ] **4.5** Replace any raw `Text` components with `ThemedText`
- [ ] **4.6** Verify dark mode renders correctly on all 34 screens
- [ ] **4.7** Verify light mode renders correctly on all 34 screens

### Testing
- [ ] **4.8** Set up E2E testing framework (Maestro recommended for Expo)
- [ ] **4.9** Write E2E test: app launch → onboarding → first workout
- [ ] **4.10** Write E2E test: paywall → purchase → verify premium access
- [ ] **4.11** Write E2E test: FitMind → import document → read → flashcard
- [ ] **4.12** Add database migration tests (v0 → v16 clean path)
- [ ] **4.13** Add subscription state machine tests

### Sentry Configuration
- [ ] **4.14** Create Sentry project at sentry.io
- [ ] **4.15** Configure DSN via `EXPO_PUBLIC_SENTRY_DSN` environment variable
- [ ] **4.16** Verify error reporting works: trigger test error, check Sentry dashboard
- [ ] **4.17** Add source maps upload to build pipeline (use `@sentry/react-native` Expo plugin)

---

## Phase 5: Store Submission Prep (Days 26-35)

> Everything needed to submit to App Store and Play Store.

### App Store (iOS)
- [ ] **5.1** Create app listing in App Store Connect
- [ ] **5.2** Generate app screenshots (6.7" and 5.5" iPhones minimum)
- [ ] **5.3** Write app description and promotional text
- [ ] **5.4** Fill in privacy nutrition labels (data collected, usage purposes)
- [ ] **5.5** Configure subscription group and products
- [ ] **5.6** Submit privacy policy URL (https://fitquest.app/privacy)
- [ ] **5.7** Create first EAS Build for iOS: `eas build --platform ios --profile production`
- [ ] **5.8** Submit to App Store Review

### Play Store (Android)
- [ ] **5.9** Create app listing in Google Play Console
- [ ] **5.10** Generate feature graphic and screenshots
- [ ] **5.11** Fill in content rating questionnaire
- [ ] **5.12** Write data safety form (all data on-device, no cloud transmission)
- [ ] **5.13** Configure subscription products
- [ ] **5.14** Create first EAS Build for Android: `eas build --platform android --profile production`
- [ ] **5.15** Submit to closed testing track first, then production
- [ ] **5.16** Submit to Play Store Review

### Legal
- [ ] **5.17** Verify privacy policy page renders at app/privacy-policy.tsx
- [ ] **5.18** Verify terms of service page renders at app/terms-of-service.tsx
- [ ] **5.19** Ensure GDPR data export/deletion mechanisms work

---

## Phase 6: Post-Launch Optimization (Weeks 6-12)

> Iterate based on real user data after store approval.

- [ ] **6.1** Monitor Sentry for crash patterns — fix top 5 crashes
- [ ] **6.2** Monitor RevenueCat analytics — optimize trial-to-paid conversion
- [ ] **6.3** A/B test paywall copy and pricing (use RevenueCat exit offers + custom variables)
- [x] **6.4** ~~Enable expo-updates bytecode diffing~~ — N/A: handled server-side by EAS Update automatically (verified in Phase 1)
- [ ] **6.5** Implement push notification campaigns (workout reminders, streak nudges)
- [ ] **6.6** Add App Store rating prompt after 5th completed workout
- [ ] **6.7** Performance profiling: use RN 0.83 Web Performance APIs (`performance.mark/measure`) in production
- [ ] **6.8** Evaluate expo-crypto migration (replace @noble/ciphers with native AES-GCM — v4 encryption)
- [ ] **6.9** Leverage `<Activity>` component for tab state caching (preserve workout state across tab switches)

---

## Phase 7: Growth Features (Months 3-6)

> Features that drive retention and expansion.

- [ ] **7.1** Home screen widgets (iOS — expo-widgets alpha)
- [ ] **7.2** Adaptive AI response tone (personalize coach over time)
- [ ] **7.3** Document summarization for FitMind
- [ ] **7.4** Share-into-FitMind (expo-sharing receive — mark experimental in SDK 55)
- [ ] **7.5** Weekly health report notifications
- [ ] **7.6** Wearable companion app exploration (Apple Watch / Wear OS)
- [ ] **7.7** On-device LLM evaluation (ExecuTorch)
- [ ] **7.8** Social features (workout sharing, challenge boards)
- [ ] **7.9** Additional language packs based on user demand
- [ ] **7.10** Tablet layout support using Expo Router SplitView (experimental)
- [ ] **7.11** Native workout controls via Expo Router Stack.Toolbar (iOS)
- [ ] **7.12** expo-blur glass-morphism polish on Android (stable in SDK 55 via RenderNode)

---

## Quick Reference

| Phase | Focus | Duration | Dependency |
|-------|-------|----------|------------|
| 0 | Critical blockers | Day 1 | None |
| 0.5 | Feature wiring (images, AI chat, alerts, GPS) | Days 2-5 | Phase 0 |
| 1 | SDK 55 upgrade (RN 0.83, React 19.2) | Days 6-7 | Phase 0 |
| 2 | RevenueCat integration (dashboard + SDK + paywall) | Days 8-11 | Phase 0 |
| 3 | Health adapters (HealthKit + Health Connect) | Days 12-18 | Phase 1 |
| 4 | Quality & polish (a11y, testing, Sentry) | Days 19-29 | Phase 1 |
| 5 | Store submission (iOS + Android) | Days 30-39 | Phases 2 + 4 |
| 6 | Post-launch optimization | Weeks 6-12 | Phase 5 |
| 7 | Growth features | Months 3-6 | Phase 6 |

**Phases 2, 3, 4 can overlap.** Phase 5 requires Phase 2 (payments) and Phase 4 (quality) to be complete.
