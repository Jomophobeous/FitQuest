# Google Play Data Safety Compliance Audit

**App:** FitQuest 2.0 (`com.hugelet.fitquest`)  
**Version:** 2.3.0  
**Audit Date:** 2026-03-20  
**Schema Version:** 15  

---

## 1. Data Safety Form — What to Declare

### Data Types Collected

| Category | Data Type | Collected | Shared | Purpose | Required/Optional |
|----------|-----------|-----------|--------|---------|-------------------|
| **Personal Info** | Name | ❌ No | ❌ No | — | — |
| **Personal Info** | Email | ❌ No | ❌ No | — | — |
| **Health & Fitness** | Health info (HR, sleep, weight, body fat, BP, glucose) | ✅ Yes | ❌ No | App functionality | Optional |
| **Health & Fitness** | Fitness info (steps, distance, calories, workouts) | ✅ Yes | ❌ No | App functionality | Required |
| **Health & Fitness** | Exercise sessions | ✅ Yes | ❌ No | App functionality | Required |
| **Location** | Precise location (GPS) | ✅ Yes | ❌ No | App functionality (jog tracking) | Optional |
| **Location** | Approximate location | ✅ Yes | ❌ No | App functionality | Optional |
| **Photos & Videos** | Photos (progress/profile) | ✅ Yes | ❌ No | App functionality | Optional |
| **App Activity** | App interactions | ✅ Yes | ❌ No | Analytics | Required |
| **App Activity** | In-app search history | ❌ No | ❌ No | — | — |
| **App Activity** | Other user-generated content | ✅ Yes | ❌ No | AI prompts, notes, annotations | Optional |
| **App Info & Performance** | Crash logs | ✅ Yes | ✅ Sentry | Crash reporting | Required |
| **App Info & Performance** | Diagnostics | ✅ Yes | ✅ Sentry | Performance monitoring | Required |
| **App Info & Performance** | Other app performance data | ✅ Yes | ✅ PostHog | Analytics | Required |
| **Device or Other IDs** | Device ID | ✅ Yes | ✅ PostHog, Sentry | Analytics, crash reporting | Required |
| **Financial Info** | Purchase history | ✅ Yes | ✅ RevenueCat | Subscription management | Required |

### Data Shared with Third Parties

| Third Party | Data Shared | Purpose | Disclosure |
|-------------|-------------|---------|------------|
| **PostHog** (us.i.posthog.com) | Screen views, feature usage, device info, session recordings (masked) | Analytics | ✅ Privacy policy updated |
| **Sentry** (Sentry cloud) | Crash logs, stack traces, device info, screenshots | Crash reporting | ✅ Privacy policy |
| **Groq** (api.groq.com) | User-typed text prompts only | AI features | ✅ Privacy policy |
| **OpenRouter** (openrouter.ai) | User-typed text prompts only (fallback) | AI features | ✅ Privacy policy |
| **RevenueCat** (SDK) | Purchase tokens, anonymous user ID | Subscription verification | ✅ Privacy policy |
| **Expo** (u.expo.dev) | Device type, OS version, app version | OTA updates | ✅ Privacy policy updated |

### Important Declarations for Data Safety Form

- **Encryption in transit:** ✅ Yes (all API calls use HTTPS/TLS)
- **Encryption at rest:** ✅ Yes (AES-256-GCM for health data, AI conversations, notes, alerts)
- **Data deletion mechanism:** ✅ Yes (Profile → Delete My Data → `deleteAllUserData()`)
- **Data deletion request URL:** https://fitquest.dev/delete-account
- **Independent security review:** ❌ No (not required for non-enterprise apps)

---

## 2. Families Policy Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| Target audience 13+ | ✅ COMPLIANT | Children's privacy section states 13+ |
| No data collection from children | ✅ COMPLIANT | No registration required, local-first |
| Appropriate content | ✅ COMPLIANT | Fitness/health content only |
| Ads compliance | ✅ N/A | No ads in app |
| COPPA compliance | ✅ COMPLIANT | No data collected from children |

---

## 3. Security Audit Results

### ✅ Passing

| Check | Status | Details |
|-------|--------|---------|
| Health data encryption | ✅ | AES-256-GCM (v3) via EncryptedDatabase |
| AI conversation encryption | ✅ | Stored in `encrypted_ai_conversations` |
| Biometric auth | ✅ | expo-local-authentication with 5-attempt lockout |
| Passcode hashing | ✅ | PBKDF2 with constant-time comparison |
| Secure key storage | ✅ | expo-secure-store (Keychain/Keystore) |
| No plaintext health data | ✅ | All HR, sleep, weight use EncryptedDatabase |
| No console logging in production | ✅ | `babel-plugin-transform-remove-console` strips logs |
| HTTPS for all API calls | ✅ | All endpoints use https:// |
| Input masking in session replay | ✅ | `maskAllTextInputs: true`, `maskAllImages: true` |
| Parameterized SQL queries | ✅ | Fixed: `deleteAllUserData` now uses parameterized queries |

### 🔧 Fixed in This Audit

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| **SQL injection in `deleteAllUserData`** | 🔴 CRITICAL | Converted string interpolation to parameterized `?` placeholders |
| **PostHog not disclosed in privacy policy** | 🟡 HIGH | Added `thirdPartyPostHog` bullet to privacy policy (all 15 languages placeholder, EN done) |
| **Expo Updates not disclosed in privacy policy** | 🟡 HIGH | Added `thirdPartyExpo` bullet to privacy policy |
| **Consent withdrawal didn't stop analytics** | 🟡 HIGH | `withdrawConsentLocally()` now calls `optOutPostHog()` and `disableCrashReporting()` |
| **Consent acceptance didn't re-enable analytics** | 🟡 MEDIUM | `acceptCurrentPolicies()` now calls `optInPostHog()` and `enableCrashReporting()` |
| **Legal policy version outdated** | 🟢 LOW | Bumped from `2026-03-13.1` to `2026-03-20.1` |

---

## 4. Privacy Compliance (GDPR / POPIA / COPPA)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **Lawful basis for processing** | ✅ | Consent-based: user accepts in Legal Center |
| **Right to access** | ✅ | Data stored locally, user has full access |
| **Right to deletion** | ✅ | `deleteAllUserData()` + web form at fitquest.dev |
| **Right to portability** | ⚠️ Partial | Data on-device, no export feature yet |
| **Right to rectification** | ✅ | User can edit profile, goals |
| **Right to object** | ✅ | Consent withdrawal stops all analytics |
| **Data minimization** | ✅ | Only fitness-relevant data collected |
| **Purpose limitation** | ✅ | Each data type has clear purpose |
| **Consent for analytics** | ✅ | PostHog/Sentry respect consent withdrawal |
| **Children's data (COPPA)** | ✅ | 13+ target, no child data collection |
| **POPIA (South Africa)** | ✅ | Dedicated section in privacy policy |

---

## 5. Android Permissions Audit

| Permission | Declared | Used | Purpose |
|------------|----------|------|---------|
| `CAMERA` | ✅ | ✅ | Progress photos |
| `POST_NOTIFICATIONS` | ✅ | ✅ | Workout reminders |
| `ACCESS_FINE_LOCATION` | ✅ | ✅ | Jog route tracking |
| `ACCESS_COARSE_LOCATION` | ✅ | ✅ | Approximate location |
| `ACTIVITY_RECOGNITION` | ✅ | ✅ | Step counting |
| `BILLING` | ✅ | ✅ | In-app purchases |
| Health Connect (20 types) | ✅ | ✅ | Health data sync |

All declared permissions are actively used. No unnecessary permissions detected.

---

## 6. Recommendations

### Must-Do Before Store Submission
1. ✅ ~~Fix SQL injection in deleteAllUserData~~ (DONE)
2. ✅ ~~Add PostHog disclosure to privacy policy~~ (DONE)
3. ✅ ~~Add Expo Updates disclosure to privacy policy~~ (DONE)
4. ✅ ~~Implement consent→analytics opt-out chain~~ (DONE)
5. 📌 Complete Data Safety form in Google Play Console with the table in Section 1
6. 📌 Add PostHog/Expo translation strings for all 14 non-English languages

### Nice-to-Have
- Add data export feature (JSON download) for full GDPR portability
- Add granular analytics consent (separate toggle for crash reporting vs usage analytics)
- Consider adding Privacy Dashboard screen showing all data collected

---

## 7. Files Modified

| File | Change |
|------|--------|
| `src/database/service.ts` | Fixed SQL injection in `deleteAllUserData` — parameterized queries |
| `src/services/posthogService.tsx` | Added `optOutPostHog()` and `optInPostHog()` exports |
| `src/services/crashReporting.ts` | Added `disableCrashReporting()` and `enableCrashReporting()` exports |
| `src/services/legalService.ts` | Wired consent withdrawal/acceptance to analytics opt-out/in; bumped policy version |
| `src/i18n/translations.ts` | Added `thirdPartyPostHog` and `thirdPartyExpo` translation keys (EN) |
| `app/privacy-policy.tsx` | Added PostHog and Expo bullets to third-party section; updated date |
