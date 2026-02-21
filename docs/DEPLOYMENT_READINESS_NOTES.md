# FitQuest 2.0 — Deployment Readiness Notes

> Generated from comprehensive deployment research. Last updated: Session 3.

---

## Overall Status: ~57% Ready

| Area | Status | Details |
|------|--------|---------|
| App Configuration | ✅ Done | app.json, eas.json, package.json all configured |
| Build Pipeline | ✅ Done | EAS dev/preview/production profiles ready |
| Permissions | ⚠️ 1 Missing | NSFaceIDUsageDescription needed |
| Store Listings | ❌ Not Started | Need Play Console + App Store Connect accounts |
| Live URLs | ❌ Not Started | Privacy policy + ToS need public URLs |
| Crash Reporting | ⚠️ Partial | Sentry SDK installed but not wired |
| Monetization | ❌ Not Started | RevenueCat SDK not integrated |
| Data Safety Forms | ❌ Not Started | Required by both stores |

---

## 7 Critical Blockers (Must Fix Before Submission)

### 1. Privacy Policy URL Must Be Live
**Both stores require a publicly accessible privacy policy URL.**
- Register domain (e.g., `fitquest.app`)
- Host privacy policy at `https://fitquest.app/privacy`
- Host terms of service at `https://fitquest.app/terms`
- Options: GitHub Pages, Vercel, Netlify (all free)
- Update `app.json` with URL once live

### 2. Missing `NSFaceIDUsageDescription` (iOS)
**Apple will reject if Face ID usage description is missing.**
- Add to `app.json > expo > ios > infoPlist`:
```json
"NSFaceIDUsageDescription": "FitQuest uses Face ID to secure your health data and provide quick app access."
```

### 3. Sentry Crash Reporting Not Wired
**Both stores expect crash reporting for production apps.**
- Sentry SDK is installed but the plugin is missing from `app.json`
- Need to configure DSN and add `@sentry/react-native` plugin
- Alternatively: use `expo-updates` error boundaries (already partially in place)

### 4. RevenueCat SDK Not Installed
**If monetization is planned (paywall screen exists):**
- Install `react-native-purchases`
- Configure products in App Store Connect + Play Console
- Wire up subscription flows
- If free-only launch: remove/hide paywall screen

### 5. EAS Submit Credentials Empty
**Need store credentials for `eas submit`:**
- **Android**: Create Google Cloud service account → download JSON key → `eas credentials`
- **iOS**: Create App Store Connect API key → configure in `eas.json`

### 6. Store Listings Not Created
**Need app entries before submission:**
- **Google Play Console**: Create app → fill title, description, screenshots, feature graphic
- **App Store Connect**: Create app → fill metadata, screenshots, preview videos

### 7. Data Safety / App Privacy Forms
**Both stores require privacy declarations:**
- **Google Play**: Data Safety form — declare what data is collected, shared, encrypted
- **Apple**: App Privacy details — nutrition labels for data usage
- FitQuest collects: health metrics (encrypted), device info, usage analytics
- FitQuest does NOT: share with third parties, sell data, track across apps

---

## What's Already Done ✅

### App Configuration
- Package name: `com.hugelet.fitquest`
- Bundle ID: `com.hugelet.fitquest`
- Version: `1.0.0`
- iOS buildNumber: `1`
- Android versionCode: auto-increment via EAS
- SDK version: Expo 54
- Runtime version: `{ "policy": "appVersion" }` (correct for production)
- New Architecture enabled

### Permissions (Android)
- CAMERA ✅
- NOTIFICATIONS ✅
- ACCESS_FINE_LOCATION ✅
- ACCESS_COARSE_LOCATION ✅
- ACTIVITY_RECOGNITION ✅

### Permissions (iOS)
- NSCameraUsageDescription ✅
- NSPhotoLibraryUsageDescription ✅
- NSLocationWhenInUseUsageDescription ✅
- NSMotionUsageDescription ✅
- **NSFaceIDUsageDescription ❌ MISSING**

### EAS Build Profiles
```json
{
  "development": { "developmentClient": true, "distribution": "internal" },
  "preview": { "distribution": "internal", "channel": "preview" },
  "production": { "channel": "production", "autoIncrement": true }
}
```

### Splash Screen
- Image: `./assets/splash-icon.png`
- Background: `#0A0E17` (matches dark theme)
- Resize mode: contain

### Adaptive Icon (Android)
- Foreground: `./assets/adaptive-icon.png`
- Background: `#0A0E17`

### OTA Updates
- Enabled: true
- URL: configured for expo-updates
- Fallback: `embedded`

### Babel Config
- Reanimated plugin listed LAST ✅
- Console stripping in production ✅ (`transform-remove-console`)

---

## Pre-Submission Checklist

### Phase 1: Configuration (1-2 days)
- [ ] Add `NSFaceIDUsageDescription` to app.json
- [ ] Register domain and host privacy policy/ToS
- [ ] Create Play Console developer account ($25 one-time)
- [ ] Create Apple Developer account ($99/year)
- [ ] Configure Sentry DSN or alternative crash reporting

### Phase 2: Assets (1-2 days)
- [ ] Verify app icon at all required sizes (1024x1024 master)
- [ ] Create Play Store feature graphic (1024x500)
- [ ] Prepare screenshots: phone (min 2) + tablet (optional)
  - 18 raw screenshots already exist in `App screenshots/`
  - Need proper framing for store listings
- [ ] Write store listing copy (title, short desc, full desc)
- [ ] Choose category: Health & Fitness
- [ ] Set content rating: Everyone / 4+

### Phase 3: Build & Test (2-3 days)
- [ ] Run `eas build --profile production --platform android`
- [ ] Run `eas build --profile production --platform ios`
- [ ] Test production builds on real devices
- [ ] Verify all screens load without crashes
- [ ] Test offline functionality (airplane mode)
- [ ] Verify encrypted data reads/writes
- [ ] Test biometric auth flow
- [ ] Performance profiling (cold start < 3s target)

### Phase 4: Store Submission (1-2 days)
- [ ] Upload Android AAB to Play Console → Internal Testing
- [ ] Upload iOS IPA to TestFlight → Internal Testing
- [ ] Fill Data Safety form (Google)
- [ ] Fill App Privacy form (Apple)
- [ ] Submit for review

### Phase 5: Post-Launch
- [ ] Monitor crash reports (Sentry/Expo)
- [ ] Monitor store reviews
- [ ] Plan first OTA update for quick patches
- [ ] Set up monitoring for health metric encryption
- [ ] Plan v1.1 with user feedback

---

## Actionable Items I Can Do Now

These items can be done without store accounts or external services:

1. ✅ **Add NSFaceIDUsageDescription** — app.json edit
2. ✅ **Verify all screens have error boundaries** — code audit
3. ✅ **Remove console.log from production** — babel.config.js already strips them
4. ✅ **Ensure all permissions have user-facing descriptions**
5. ✅ **Verify version sync** — app.json 1.0.0 = package.json 1.0.0

---

## Technical Notes

### Signing
- EAS manages signing automatically for both platforms
- Android: EAS generates upload keystore on first build
- iOS: EAS manages certificates and provisioning profiles
- Both are stored securely in EAS cloud

### OTA Updates Strategy
- Channel-based: `preview` for testing, `production` for live
- `runtimeVersion: { "policy": "appVersion" }` — OTA only within same app version
- Critical native changes require new store build

### Bundle Size Estimate
- Based on dependencies: ~40-60MB APK, ~80-120MB IPA
- Key heavy deps: Reanimated, expo-sqlite, LinearGradient, Lottie
- Consider excluding unused fonts/assets before production build

### Security Checklist for Stores
- ✅ AES-256-GCM encryption for health data
- ✅ Biometric auth with session management
- ✅ No AsyncStorage for sensitive data
- ✅ SecureStore for encryption keys
- ✅ PBKDF2-hardened passcode fallback
- ✅ Emergency wipe after 15 failed attempts
