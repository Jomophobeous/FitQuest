# FitQuest 2.0 — Deployment Readiness Assessment

**Date:** 2026-02-21  
**App Version:** 1.0.0  
**Expo SDK:** 54 | **Runtime Version Policy:** appVersion  
**EAS Project ID:** `5952667d-bab3-4bce-9cb0-be0106c98d01`

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ DONE | Ready for submission — no action needed |
| ⚠️ NEEDS ATTENTION | Partially done — requires specific fixes |
| ❌ MISSING | Not configured — blocks submission |

---

## 1. Android (Google Play Store)

| Item | Status | Details |
|------|--------|---------|
| Package name | ✅ DONE | `com.hugelet.fitquest` set in `app.json → android.package` |
| Version name | ✅ DONE | `1.0.0` in `app.json → version` |
| Version code (auto-increment) | ✅ DONE | EAS production profile has `"autoIncrement": true` |
| Adaptive icon (foreground) | ✅ DONE | `assets/adaptive-icon.png` exists, 1024×1024 PNG |
| Adaptive icon (background color) | ✅ DONE | `#0A0E17` set in `app.json` |
| Splash screen | ✅ DONE | `assets/splash-icon.png` exists, 1024×1024, bg `#0A0E17` |
| Permissions: Camera | ✅ DONE | `CAMERA` declared |
| Permissions: Notifications | ✅ DONE | `NOTIFICATIONS` declared |
| Permissions: Fine Location | ✅ DONE | `ACCESS_FINE_LOCATION` declared |
| Permissions: Coarse Location | ✅ DONE | `ACCESS_COARSE_LOCATION` declared |
| Permissions: Activity Recognition | ✅ DONE | `ACTIVITY_RECOGNITION` declared |
| Permissions: Internet | ✅ DONE | Auto-granted on Android, no declaration needed |
| Edge-to-edge mode | ✅ DONE | `edgeToEdgeEnabled: true` |
| Keystore / signing | ⚠️ NEEDS ATTENTION | EAS manages signing automatically on first `eas build`, but no credentials have been uploaded yet. Run `eas credentials` to verify or generate the upload keystore before the first production build. |
| Play Store Data Safety | ❌ MISSING | Google Play requires a Data Safety declaration. Must be completed in Play Console (details below in §5). |
| Play Store listing metadata | ❌ MISSING | Title, short description, full description, feature graphic (1024×500), and at least 2 phone screenshots required. |
| Content rating questionnaire | ❌ MISSING | Must complete IARC questionnaire in Play Console. |
| Target API level | ⚠️ NEEDS ATTENTION | Google Play requires `targetSdkVersion 34` (Android 14) for new apps as of Aug 2024. EAS + Expo SDK 54 should default to 34+ but verify with `eas build --platform android --profile production --dry-run`. |
| RevenueCat SDK | ❌ MISSING | `react-native-purchases` is NOT in `package.json`. The `.env` has a placeholder key (`rcbp_your_key_here`). Must install the SDK and configure real API keys before billing works. |

### Android Action Items
1. Run `eas credentials --platform android` to generate/verify upload keystore
2. Install RevenueCat: `npx expo install react-native-purchases`
3. Set real `EXPO_PUBLIC_REVENUECAT_API_KEY` in EAS secrets
4. Complete Play Console listing: title, descriptions, feature graphic, screenshots
5. Complete Data Safety form in Play Console
6. Complete IARC content rating questionnaire
7. Verify `targetSdkVersion ≥ 34` in the build output

---

## 2. iOS (Apple App Store)

| Item | Status | Details |
|------|--------|---------|
| Bundle identifier | ✅ DONE | `com.hugelet.fitquest` in `app.json → ios.bundleIdentifier` |
| Build number | ✅ DONE | `"1"` set; EAS auto-increments in production profile |
| Supports tablet | ✅ DONE | `supportsTablet: true` |
| App icon | ✅ DONE | `assets/icon.png` — 1024×1024 PNG (Expo generates all sizes) |
| Info.plist: Camera | ✅ DONE | `NSCameraUsageDescription` with descriptive string |
| Info.plist: Photo Library | ✅ DONE | `NSPhotoLibraryUsageDescription` with descriptive string |
| Info.plist: Location | ✅ DONE | `NSLocationWhenInUseUsageDescription` with descriptive string |
| Info.plist: Motion | ✅ DONE | `NSMotionUsageDescription` with descriptive string |
| Info.plist: Face ID | ❌ MISSING | App uses `expo-local-authentication` for biometrics. Must add `NSFaceIDUsageDescription` to `infoPlist` or Apple will reject. |
| Info.plist: Health (HealthKit) | ⚠️ NEEDS ATTENTION | `react-native-health` is in dependencies. If HealthKit is used on iOS, `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` must be declared, AND the HealthKit entitlement must be enabled. If NOT used yet, remove the dependency to avoid rejection. |
| Info.plist: User Tracking (ATT) | ✅ DONE (N/A) | No ad tracking — `NSUserTrackingUsageDescription` not needed. |
| App Transport Security | ✅ DONE | Expo defaults to requiring HTTPS. No custom ATS exceptions found — correct for production. |
| Push notification entitlement | ⚠️ NEEDS ATTENTION | `expo-notifications` is installed and in plugins. Push entitlement needs to be enabled in Apple Developer portal and APN key uploaded to EAS. |
| Apple Developer signing | ⚠️ NEEDS ATTENTION | EAS manages provisioning profiles automatically, but an Apple Developer account must be connected. Run `eas credentials --platform ios` to set up. |
| App Store listing metadata | ❌ MISSING | Same as Android — title, description, keywords, screenshots (6.7" + 5.5" required), preview video (optional). |
| App Review information | ❌ MISSING | Contact info, demo account (if login required), and review notes must be prepared. |
| RevenueCat SDK (iOS) | ❌ MISSING | Same issue as Android — SDK not in `package.json`. |

### iOS Action Items
1. Add `NSFaceIDUsageDescription` to `app.json → ios.infoPlist`:
   ```json
   "NSFaceIDUsageDescription": "FitQuest uses Face ID to secure your health data and app access."
   ```
2. Decide on HealthKit: either add `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription` + HealthKit entitlement, or remove `react-native-health` from dependencies
3. Run `eas credentials --platform ios` to connect Apple Developer account
4. Upload APN key to EAS for push notifications
5. Install RevenueCat: `npx expo install react-native-purchases`
6. Prepare App Store Connect listing: title, subtitle, description, keywords, screenshots, review info

---

## 3. EAS Build Configuration

| Item | Status | Details |
|------|--------|---------|
| Development profile | ✅ DONE | `developmentClient: true`, `distribution: "internal"`, channel: `development` |
| Preview profile | ✅ DONE | `distribution: "internal"`, channel: `preview` |
| Production profile | ✅ DONE | channel: `production`, `autoIncrement: true` |
| Submit config | ⚠️ NEEDS ATTENTION | `submit.production` exists but is empty `{}`. Needs store credentials (Google service account JSON for Play, ASC API key for App Store). |
| CLI version | ✅ DONE | Requires `>= 12.0.0` |
| App version source | ✅ DONE | `"local"` — version managed in `app.json` |
| OTA Updates enabled | ✅ DONE | `expo-updates` in plugins, `updates.enabled: true`, `checkAutomatically: "ON_LOAD"` |
| Updates URL | ✅ DONE | `https://u.expo.dev/5952667d-bab3-4bce-9cb0-be0106c98d01` |
| Runtime version policy | ✅ DONE | `"appVersion"` — OTA updates only apply to same app version. Safe policy for store builds. |
| Fallback timeout | ✅ DONE | `fallbackToCacheTimeout: 5000` (5s) — reasonable for cold start |
| Channel-based deployment | ✅ DONE | Three channels (development/preview/production) enable staged rollouts |

### EAS Action Items
1. Configure `eas.json → submit.production` with:
   - **Android:** Upload Google Play service account JSON via `eas credentials`
   - **iOS:** Upload App Store Connect API key via `eas credentials`
2. Test OTA update flow: `eas update --channel production --message "test"`
3. Verify runtime version mismatch handling (what happens when native code changes)

---

## 4. Babel / Metro / Build Pipeline

| Item | Status | Details |
|------|--------|---------|
| Reanimated plugin position | ✅ DONE | Last in plugins array in `babel.config.js` |
| Console stripping (production) | ✅ DONE | `transform-remove-console` active when `NODE_ENV=production` |
| TypeScript | ✅ DONE | `tsc --noEmit` available via `npm run typecheck` |
| Metro config | ✅ DONE | Custom `metro.config.js` present |
| New Architecture | ✅ DONE | `newArchEnabled: true` in `app.json` |

---

## 5. Pre-Submission Checklist

### 5.1 App Icons

| Item | Status | Details |
|------|--------|---------|
| iOS App Icon (1024×1024) | ✅ DONE | `assets/icon.png` — Expo generates all required sizes |
| Android Adaptive Icon | ✅ DONE | `assets/adaptive-icon.png` foreground + `#0A0E17` background |
| Custom icon design (not placeholder) | ⚠️ NEEDS ATTENTION | Files exist at 1024×1024, ~17-22KB. Small file size for 1024×1024 suggests these may be simple/placeholder images. Verify these are the final branded icons. |

### 5.2 Splash Screen

| Item | Status | Details |
|------|--------|---------|
| Splash image | ✅ DONE | `assets/splash-icon.png` configured with dark background `#0A0E17` |
| Splash resize mode | ✅ DONE | `"contain"` — safe for all screen ratios |
| Custom branded splash | ⚠️ NEEDS ATTENTION | Same concern as icons — verify this is final artwork, not Expo default. |

### 5.3 Store Screenshots

| Item | Status | Details |
|------|--------|---------|
| Raw screenshots captured | ✅ DONE | 18 screenshots in `App screenshots/` directory |
| Formatted for Play Store | ❌ MISSING | Play Store needs: min 2, max 8 per device type. Recommended: phone (1080×1920 or 16:9) + 7" tablet + 10" tablet. Raw Expo Go screenshots need framing/mockups. |
| Formatted for App Store | ❌ MISSING | App Store needs: 6.7" (1290×2796), 6.5" (1284×2778), 5.5" (1242×2208). iPad screenshots if `supportsTablet: true`. Raw screenshots must be formatted. |

### 5.4 Privacy Policy

| Item | Status | Details |
|------|--------|---------|
| Privacy policy draft | ✅ DONE | `docs/legal/PRIVACY_POLICY_DRAFT.md` — comprehensive, covers health data, encryption, GDPR rights |
| Privacy policy URL in app.json | ✅ DONE | `https://fitquest.app/privacy` in `expo.extra.legal.privacyPolicyUrl` |
| Privacy policy hosted & live | ❌ MISSING | URL `https://fitquest.app/privacy` must resolve to a live web page. Domain must be registered and hosting set up. Both stores will reject if URL is broken. |
| In-app legal center | ✅ DONE | Legal Center screen accessible from profile (per deployment checklist) |
| Legal counsel review | ⚠️ NEEDS ATTENTION | Both drafts marked "Draft for legal counsel review". Should be finalized by a lawyer before go-live. |

### 5.5 Terms of Service

| Item | Status | Details |
|------|--------|---------|
| ToS draft | ✅ DONE | `docs/legal/TERMS_OF_SERVICE_DRAFT.md` — covers medical disclaimer, billing, IP |
| ToS URL in app.json | ✅ DONE | `https://fitquest.app/terms` in `expo.extra.legal.termsOfServiceUrl` |
| ToS hosted & live | ❌ MISSING | Same as privacy policy — URL must be live |

### 5.6 Data Safety / App Privacy

| Item | Status | Details |
|------|--------|---------|
| Google Play Data Safety form | ❌ MISSING | Must declare: data types collected (health/fitness, location, device ID), encryption at rest (yes — AES-256-GCM), data sharing (none), data deletion mechanism |
| Apple App Privacy labels | ❌ MISSING | Must declare in App Store Connect: Health & Fitness data, Location (when in use), Diagnostics (crash data). Mark all as "not linked to identity" if no backend accounts. |

### 5.7 Age Rating

| Item | Status | Details |
|------|--------|---------|
| IARC rating (Google Play) | ❌ MISSING | Complete questionnaire in Play Console. Likely "Everyone" / PEGI 3 (fitness app, no violence/gambling). |
| App Store age rating | ❌ MISSING | Complete in App Store Connect. Likely 4+ (no objectionable content). |
| Minimum age in privacy policy | ✅ DONE | Policy mentions minimum digital consent age requirement |

### 5.8 App Category

| Item | Status | Details |
|------|--------|---------|
| Google Play category | ❌ MISSING | Set in Play Console → "Health & Fitness" |
| App Store category | ❌ MISSING | Set in App Store Connect → Primary: "Health & Fitness", Secondary: "Education" (for FitMind) |

### 5.9 Performance & Optimization

| Item | Status | Details |
|------|--------|---------|
| Console log stripping | ✅ DONE | `babel-plugin-transform-remove-console` active in production |
| Bundle size awareness | ⚠️ NEEDS ATTENTION | No bundle analysis configured. Consider running `npx expo export` and checking output size. Target <50MB for quick installs. |
| Hermes engine | ✅ DONE | Default with Expo SDK 54 + New Architecture |
| DB initialization performance | ⚠️ NEEDS ATTENTION | 1253 exercises seeded on first run. From logs: initial bundle ~46s on dev. Production should be faster but test cold-start time. |
| Memory / sensor cleanup | ⚠️ NEEDS ATTENTION | SensorFusion runs at 10Hz. Verify it properly cleans up on unmount and doesn't leak in background. |

### 5.10 Crash / Error Reporting

| Item | Status | Details |
|------|--------|---------|
| Sentry SDK installed | ✅ DONE | `@sentry/react-native: ~7.2.0` in dependencies |
| Sentry plugin in app.json | ❌ MISSING | `@sentry/react-native/expo` plugin NOT in `app.json → plugins`. Must add for source maps and native crash reporting. |
| Sentry DSN configured | ❌ MISSING | `EXPO_PUBLIC_SENTRY_DSN` is not set (logs confirm: "External crash reporting disabled (missing EXPO_PUBLIC_SENTRY_DSN)"). Must create Sentry project and set DSN in EAS secrets. |
| Error boundaries | ⚠️ NEEDS ATTENTION | Verify React error boundaries wrap critical screens (database init, workout engine). |

### 5.11 Analytics / Telemetry

| Item | Status | Details |
|------|--------|---------|
| Analytics SDK | ❌ MISSING | No analytics library in `package.json` (no Firebase Analytics, Amplitude, Mixpanel, etc.). Optional but strongly recommended for understanding user behavior post-launch. |
| Consent for analytics | ✅ DONE | Privacy disclosure + consent toggle implemented per deployment checklist |
| Observability infrastructure | ⚠️ NEEDS ATTENTION | Sentry covers crashes but not user analytics. Consider adding lightweight event tracking. |

---

## 6. Critical Blockers (Must Fix Before Any Submission)

These items will cause **immediate rejection** or **broken functionality** in store builds:

| # | Blocker | Platform | Fix |
|---|---------|----------|-----|
| 1 | **Privacy policy URL not live** | Both | Register `fitquest.app` domain, host privacy policy + ToS as web pages |
| 2 | **Missing `NSFaceIDUsageDescription`** | iOS | Add to `app.json → ios.infoPlist` |
| 3 | **Sentry not wired up** | Both | Add plugin to `app.json`, set DSN in EAS secrets |
| 4 | **RevenueCat SDK not installed** | Both | `npx expo install react-native-purchases` + configure |
| 5 | **EAS submit credentials missing** | Both | Upload Google service account JSON + ASC API key |
| 6 | **Store listings not created** | Both | Create app entries in Play Console + App Store Connect |
| 7 | **Data Safety / App Privacy not declared** | Both | Complete forms in respective consoles |

---

## 7. Recommended Submission Order

### Phase 1: Infrastructure (1–2 days)
- [ ] Register and configure `fitquest.app` domain
- [ ] Host privacy policy and ToS as live web pages
- [ ] Create Sentry project, add plugin to `app.json`, set DSN in EAS secrets
- [ ] Install RevenueCat SDK, configure with real API keys
- [ ] Add `NSFaceIDUsageDescription` to `app.json`
- [ ] Resolve HealthKit: add entitlement or remove `react-native-health`

### Phase 2: Store Setup (1–2 days)
- [ ] Create app in Google Play Console
- [ ] Create app in App Store Connect
- [ ] Run `eas credentials` for both platforms
- [ ] Configure `eas.json → submit.production` with store credentials
- [ ] Complete Data Safety (Play) and App Privacy (App Store) forms
- [ ] Complete age rating questionnaires on both platforms
- [ ] Set app category on both platforms

### Phase 3: Assets & Listings (2–3 days)
- [ ] Verify/finalize app icon and splash screen artwork
- [ ] Format screenshots for Play Store requirements (phone + tablet)
- [ ] Format screenshots for App Store requirements (6.7" + 6.5" + 5.5" + iPad)
- [ ] Write store descriptions (title, short desc, full desc, keywords)
- [ ] Create feature graphic for Play Store (1024×500)
- [ ] Prepare App Review notes + demo info for Apple

### Phase 4: Build & Test (1–2 days)
- [ ] Run `eas build --platform all --profile production`
- [ ] Test production build on physical Android device
- [ ] Test production build on physical iOS device
- [ ] Verify OTA update flow works: `eas update --channel production`
- [ ] Verify cold-start performance (<5s to interactive)
- [ ] Verify Sentry captures test crash correctly
- [ ] Verify RevenueCat paywall + restore purchases flow

### Phase 5: Submit (1 day + review wait)
- [ ] `eas submit --platform android --profile production`
- [ ] `eas submit --platform ios --profile production`
- [ ] Monitor review status; respond to any reviewer questions within 24h

---

## 8. Summary Scorecard

| Category | Done | Attention | Missing | Score |
|----------|------|-----------|---------|-------|
| Android Config | 11 | 2 | 4 | 65% |
| iOS Config | 9 | 3 | 4 | 56% |
| EAS Build | 9 | 1 | 0 | 90% |
| Build Pipeline | 5 | 0 | 0 | 100% |
| Pre-Submission | 12 | 8 | 12 | 38% |
| **Overall** | **46** | **14** | **20** | **57%** |

**Bottom line:** The app's core configuration (package names, versions, permissions, OTA, build profiles) is solid. The main gaps are **store-facing requirements**: live legal URLs, store listing metadata, formatted screenshots, data safety declarations, and completing the Sentry + RevenueCat integration. Estimated **5–8 working days** to submission-ready.
