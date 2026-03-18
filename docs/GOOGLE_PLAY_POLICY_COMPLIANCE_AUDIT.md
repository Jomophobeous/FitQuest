# FitQuest 2.0 — Google Play Policy Compliance Audit

> **Audit Date:** 18 March 2026
> **Auditor:** Development Team (Copilot-assisted)
> **App:** FitQuest 2.0 (com.hugelet.fitquest)
> **Build:** targetSdkVersion=36, minSdkVersion=26, Expo SDK 55, RN 0.83.2
> **Status:** Pre-Submission — Policy-by-Policy Verification

---

## 1. RESTRICTED CONTENT

| Sub-Policy | Verdict | Evidence |
|---|---|---|
| **Child Endangerment** | ✅ COMPLIANT | App targets 13+. No child-targeted content, no cartoon mascots, no young-child gamification. Children's privacy section in privacy policy with deletion contact. |
| **Inappropriate Content** | ✅ COMPLIANT | Fitness/wellness only. No sexual, violent, hateful, or dangerous content. |
| **Age-Restricted Content** | ✅ COMPLIANT | No alcohol, tobacco, gambling, or firearms content. |
| **Financial Services** | ✅ COMPLIANT | No lending, trading, cryptocurrency, or financial advisory features. |
| **Real-Money Gambling** | ✅ COMPLIANT | XP/gamification is cosmetic only — no real money prizes. |
| **Illegal Activities** | ✅ COMPLIANT | No facilitation of illegal activities. |
| **User Generated Content** | ✅ COMPLIANT | Users can create workout notes and annotations. UGC clause exists in Terms of Service. No content moderation needed (all data is local-only, never shared between users). |
| **Health Content** | ✅ COMPLIANT | Medical disclaimer in Terms (Section 2), NOT a medical device, "consult healthcare professional" language present. Must include in store listing description. |
| **Blockchain-based Content** | N/A | No blockchain features. |
| **AI-Generated Content** | ✅ COMPLIANT | AI Coach/Professor generate text responses. Disclosed in privacy policy (Section 11 "AI Data Processing"). Only user text prompts sent to OpenRouter — no health data transmitted to LLMs. |

---

## 2. IMPERSONATION

| Check | Verdict |
|---|---|
| App name "FitQuest" | ✅ COMPLIANT — original name, not impersonating existing apps |
| Developer entity "fitquest.dev" | ✅ COMPLIANT — original identity |
| No Google/Samsung/Apple branding misuse | ✅ COMPLIANT |

---

## 3. INTELLECTUAL PROPERTY

| Check | Verdict |
|---|---|
| Exercise descriptions | ✅ COMPLIANT — original content, not copied from copyrighted sources |
| Icons/assets | ⚠️ VERIFY — ensure all exercise images are licensed/original |
| Third-party libraries | ✅ All open source with compatible licenses (MIT/Apache/BSD) |
| IP clause in Terms | ✅ COMPLIANT — Section 4 covers IP rights |

---

## 4. PRIVACY, DECEPTION AND DEVICE ABUSE

| Sub-Policy | Verdict | Details |
|---|---|---|
| **User Data** | ✅ COMPLIANT | Privacy policy covers all 12 sections (data collection, storage, security, third parties, children, retention, rights, POPIA, health monitoring, AI processing, biometrics). Available in-app and will be at fitquest.dev/privacy. |
| **Prominent Disclosure** | ❌ **GAP** | Google requires an explicit consent screen BEFORE collecting health/location/biometric data. Current onboarding does NOT have a dedicated data consent step with affirmative checkbox. **Must add before submission.** |
| **Permissions** | ✅ COMPLIANT | All permissions declared in manifest with valid justifications. `SYSTEM_ALERT_WINDOW` removed (not needed). |
| **Device and Network Abuse** | ✅ COMPLIANT | No background processes that abuse battery (health check at 5-min intervals is reasonable). No crypto mining, no DDoS. |
| **Deceptive Behavior** | ✅ COMPLIANT | No hidden functionality, no unauthorized data collection. PostHog analytics tracks only non-PII events with 50% sampling. |
| **Misrepresentation** | ✅ COMPLIANT | Medical disclaimer prevents any claims of medical device status. |
| **Target API Level** | ✅ COMPLIANT | targetSdkVersion=36 (Android 16) — exceeds Google Play's requirement of API 34+ for new apps in 2026. |

---

## 5. USE OF SDKs IN APPS

| SDK | Data Accessed | Compliant? | Notes |
|---|---|---|---|
| **Sentry** (~7.11.0) | Crash logs, device info (anonymized) | ✅ YES | No health/PII data in crash payloads. Verified: no secret logging. |
| **RevenueCat** (^9.12.0) | Purchase tokens, anonymous user ID | ✅ YES | Standard billing wrapper. No health data shared. |
| **PostHog** (^4.37.3) | Non-PII events (app_launch, workout_started, etc.) | ✅ YES | All text inputs masked, images masked, no console logs captured. 50% sample rate. |
| **OpenRouter** (API calls) | User text prompts only | ✅ YES | No health metrics sent. Disclosed in privacy policy. |
| **expo-location** | GPS during jog sessions | ✅ YES | Only when user actively jogging. Never shared externally. |
| **expo-sensors** | Accelerometer/gyroscope | ✅ YES | On-device processing only for step counting. |
| **Health Connect** (^3.5.0) | Steps, heart rate, sleep, exercise | ✅ YES | Read-only. All data encrypted locally. Disclosed in privacy policy. |

---

## 6. MONETIZATION AND ADS

| Sub-Policy | Verdict | Details |
|---|---|---|
| **Payments** | ✅ COMPLIANT | RevenueCat SDK handles Google Play Billing. `com.android.vending.BILLING` permission declared. |
| **Subscriptions** | ✅ COMPLIANT | Auto-renewal and cancellation terms in ToS Section 3. Free tier + premium tier. |
| **Ads** | ✅ COMPLIANT | **No ad SDKs in the app**. Declare "No ads" in Play Console. |
| **Families Ads** | N/A | Not a children's app. |

---

## 7. STORE LISTING AND PROMOTION

| Requirement | Status | Action |
|---|---|---|
| App icon (512x512) | ❌ NOT READY | Need to create/export |
| Feature graphic (1024x500) | ❌ NOT READY | Need to create |
| Screenshots (4-8) | ❌ NOT READY | Need to capture from device |
| Short description (≤80 chars) | ✅ DRAFT | "AI-powered adaptive workouts & health tracking. Offline-first. Privacy-first." |
| Full description with medical disclaimer | ✅ DRAFT | Template in GOOGLE_PLAY_READINESS_REPORT.md |
| Content rating (IARC) | ❌ NOT DONE | Fill questionnaire in console |
| No misleading metadata | ✅ COMPLIANT | Descriptions match actual functionality |

---

## 8. SPAM, FUNCTIONALITY, AND USER EXPERIENCE

| Check | Verdict | Details |
|---|---|---|
| App doesn't crash on launch | ✅ **FIXED** | MapLibre crash resolved (uninstalled incompatible package). |
| Basic functionality works | ✅ COMPLIANT | Core features verified: workout gen, exercise library, health tracking. |
| No dead UI/broken features | ⚠️ NEEDS VERIFICATION | Must test every screen on device post-rebuild. |
| Not a webview wrapper | ✅ COMPLIANT | Native React Native app with custom engines. |

---

## 9. MALWARE / MUwS (Mobile Unwanted Software)

| Check | Verdict |
|---|---|
| No data harvesting | ✅ COMPLIANT — all data on-device, encrypted |
| No unauthorized network calls | ✅ COMPLIANT — only Sentry, PostHog, OpenRouter (all disclosed) |
| No ad fraud | ✅ COMPLIANT — no ads |
| No social engineering | ✅ COMPLIANT |
| No hostile downloads | ✅ COMPLIANT |
| Console logs stripped in production | ✅ COMPLIANT — `transform-remove-console` babel plugin |
| No hardcoded secrets | ✅ COMPLIANT — all externalized in .env |

---

## 10. FAMILIES POLICY

**N/A** — App targets 13+ and is NOT designed for children. Will declare appropriate age range in Play Console.

---

## 11. APP BUNDLE FORMAT

| Requirement | Status | Action |
|---|---|---|
| **AAB format required** | ❌ NOT YET | Currently building APK. Must switch to `./gradlew bundleRelease`. |
| **Play App Signing** | ❌ NOT YET | Must accept ToS and enroll signing key in Play Console. |
| **Compressed size < 4GB** | ✅ COMPLIANT | Current APK is 103MB. AAB will be smaller. |

---

## 12. US EXPORT LAWS — ENCRYPTION

- App uses AES-256-GCM encryption (via `@noble/ciphers`)
- Encryption is for **local data protection** only (protecting health records at rest)
- Not for military or restricted use
- Qualifies for **EAR99** or **mass market encryption** exemption (ECCN 5D992)
- Self-classification sufficient — no individual BIS license needed
- Must check export law acknowledgment box in Play Console

---

## 13. CRITICAL GAPS — REMEDIATION TRACKER

| # | Gap | Severity | Owner | Status |
|---|---|---|---|---|
| 1 | **Prominent data consent screen** in onboarding | BLOCKER | DEV | ❌ Not implemented |
| 2 | **Age verification gate** (13+) | HIGH | DEV | ❌ Not implemented |
| 3 | **Build AAB** instead of APK | BLOCKER | DEV | ❌ Needs `bundleRelease` |
| 4 | **Deploy website** to fitquest.dev | BLOCKER | USER | ❌ Domain needed |
| 5 | **Store listing assets** (icon, screenshots, graphics) | BLOCKER | USER | ❌ Not created |
| 6 | **IARC content rating** questionnaire | BLOCKER | USER | ❌ Fill in Console |
| 7 | **Data Safety form** completion | BLOCKER | USER | ❌ Data mappings ready |
| 8 | **14-day closed testing** with 12+ testers | BLOCKER | USER | ❌ Haven't started |
| 9 | **Medical disclaimer in store listing** | HIGH | USER | ❌ Template ready |
| 10 | **Health Apps Declaration** in Console | HIGH | USER | ❌ Must declare |
| 11 | **Play App Signing** enrollment | HIGH | USER | ❌ Accept ToS |
| 12 | **US Export Laws** checkbox | MEDIUM | USER | ❌ Check box |
| 13 | **Verify exercise image licensing** | MEDIUM | USER | ❌ Audit needed |

---

*Last updated: 18 March 2026*
