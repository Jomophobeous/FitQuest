# Google Play Developer Account — Legal & Compliance Checklist

**App**: FitQuest 2.0  
**Package**: `com.hugelet.fitquest`  
**Target**: Google Play production release  
**Last Updated**: June 2025

This document covers **every legal and compliance requirement** for getting FitQuest from developer account to production on Google Play. Work through it section by section.

---

## Table of Contents

1. [Developer Account Setup](#1-developer-account-setup)
2. [Store Listing Legal Requirements](#2-store-listing-legal-requirements)
3. [Data Safety Form](#3-data-safety-form)
4. [Content Rating (IARC)](#4-content-rating-iarc)
5. [Health Apps Declaration](#5-health-apps-declaration)
6. [Privacy Policy — What Google Requires](#6-privacy-policy)
7. [Terms of Service](#7-terms-of-service)
8. [Data Deletion Policy](#8-data-deletion-policy)
9. [Subscription & Billing Compliance](#9-subscription-compliance)
10. [Age & Children's Policy](#10-age-policy)
11. [Prominent Disclosure & Consent](#11-prominent-disclosure)
12. [US Export Compliance (Encryption)](#12-export-compliance)
13. [Closed Testing Gate](#13-closed-testing-gate)
14. [App Signing](#14-app-signing)
15. [Hosted Legal Pages (URLs)](#15-hosted-legal-pages)
16. [FitQuest-Specific Status Tracker](#16-status-tracker)

---

## 1. Developer Account Setup

### What You Need

```
Google Play Console (https://play.google.com/console)
  → Create developer account ($25 one-time)
```

| Requirement | Details |
|-------------|---------|
| **Google Account** | Use a dedicated developer Gmail (e.g., `fitquest.dev@gmail.com`) |
| **$25 Registration Fee** | One-time, non-refundable |
| **Identity Verification** | Google may request government ID + selfie (new accounts since 2023) |
| **Contact Details** | Developer name, email, phone — **all visible to users on Play Store** |
| **Developer Address** | Physical address (required for individual accounts) |
| **Payments Profile** | Linked via Google Payments Center — required for paid apps/subscriptions |

### Navigation:

```
Play Console → Settings → Developer account
  → Developer page: Fill in public contact info
  → Identity verification: Upload ID if prompted
```

> ⚠️ **New personal accounts** (2024+) must complete **closed testing with 12+ testers for 14+ consecutive days** before accessing production. See [Section 13](#13-closed-testing-gate).

---

## 2. Store Listing Legal Requirements

### Navigation:

```
Play Console → Select "FitQuest"
  → Grow → Store presence → Main store listing
```

### Required Fields:

| Field | Requirement | FitQuest Value |
|-------|-------------|----------------|
| **App name** | Max 30 characters | "FitQuest — AI Fitness & Mind" |
| **Short description** | Max 80 characters | "AI workouts, cognitive training & encrypted health tracking" |
| **Full description** | Max 4,000 characters | Features, benefits, disclaimer (see below) |
| **App icon** | 512×512 PNG, 32-bit, no transparency | ❌ Need to create |
| **Feature graphic** | 1024×500 PNG or JPG | ❌ Need to create |
| **Screenshots** | Min 2, recommended 8 per device type | ❌ Need to create |
| **App category** | Primary: Health & Fitness | Set in App content |
| **Contact email** | Public support email | `support@fitquest.dev` (or your email) |
| **Privacy Policy URL** | HTTPS link to hosted policy | `https://fitquest.dev/privacy` |

### Required Disclaimer in Full Description:

Google Play requires health/fitness apps to include this in the store listing:

```
⚠️ IMPORTANT: FitQuest is NOT a medical device and does NOT provide 
medical advice, diagnosis, or treatment. All health data (heart rate, 
sleep, activity) is for informational and motivational purposes only. 
Always consult a qualified healthcare professional before starting any 
exercise program, especially if you have existing health conditions.

FitQuest does NOT replace professional medical, fitness, or nutritional 
advice. Use at your own risk.
```

---

## 3. Data Safety Form

Google Play's Data Safety section tells users what data you collect, how it's used, and how it's protected.

### Navigation:

```
Play Console → Select "FitQuest"
  → Policy → App content
    → Data safety → "Start"
```

### Section 1: Data Collection Overview

| Question | Answer | Why |
|----------|--------|-----|
| Does your app collect or share any user data? | **Yes** | Fitness data, health metrics |
| Is all collected data encrypted in transit? | **Yes** | HTTPS + AES-256-GCM on-device |
| Do you provide a way for users to request data deletion? | **Yes** | In-app (Profile → Delete All Data) + website |
| Has your app been independently security-reviewed? | **No** | Not yet (optional for now) |

### Section 2: Data Types

Declare **each data type** and how it's handled:

| Data Type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| **Personal info (name)** | ❌ No | — | — | — |
| **Email address** | ❌ No* | — | — | — |
| **Health info (heart rate, sleep)** | ✅ Yes | ❌ No | App functionality | Optional |
| **Fitness info (workouts, steps, exercises)** | ✅ Yes | ❌ No | App functionality | Required for core |
| **Location (approximate)** | ✅ Yes | ❌ No | Jog tracking | Optional |
| **Photos/Videos** | ❌ No | — | — | — |
| **Files/Docs** | ✅ Yes | ❌ No | FitMind document import | Optional |
| **App activity (screens viewed)** | ✅ Yes | ✅ Yes (PostHog) | Analytics | Required |
| **App interactions** | ✅ Yes | ✅ Yes (PostHog) | Analytics | Required |
| **Crash logs** | ✅ Yes | ✅ Yes (Sentry) | Debugging | Required |
| **Device info** | ✅ Yes | ✅ Yes (Sentry) | Debugging | Required |
| **Purchase history** | ✅ Yes | ✅ Yes (RevenueCat) | Subscription management | Required for premium |

\* Email is only collected if the user voluntarily creates a server-backed account (currently optional/disabled).

### Section 3: Data Handling Details

For EACH data type marked "Collected", you must declare:

| Question | Answer for Health/Fitness Data | Answer for Analytics |
|----------|-------------------------------|---------------------|
| Is data collected, shared, or both? | Collected only | Both (shared with PostHog/Sentry) |
| Is this data processed ephemerally? | No (stored on-device) | No (sent to analytics) |
| Is this data required or can users opt out? | Core features require it | Required for app quality |
| Reason for collection | App functionality | Analytics, crash reporting |

### Section 4: Data Security

| Question | Answer |
|----------|--------|
| Is data encrypted in transit? | **Yes** (HTTPS for any network requests) |
| Is data encrypted at rest? | **Yes** (AES-256-GCM for health data, standard SQLite for non-sensitive) |
| Can users request data deletion? | **Yes** (in-app + website: `https://fitquest.dev/delete-account`) |
| Retention policy | Data stored locally on device; deleted when user initiates deletion or uninstalls |

Click **"Save"** → **"Submit"** when all sections complete.

> ⚠️ Google reviews this form. False declarations can result in app suspension.

---

## 4. Content Rating (IARC)

IARC (International Age Rating Coalition) determines the age rating shown on the Play Store.

### Navigation:

```
Play Console → Select "FitQuest"
  → Policy → App content
    → Content rating → "Start questionnaire"
```

### Key Answers for FitQuest:

| Question | Answer |
|----------|--------|
| Does the app contain violence? | No |
| Does the app reference drugs/alcohol/tobacco? | No |
| Does the app contain sexual content? | No |
| Does the app allow users to communicate with each other? | No |
| Does the app share user location? | No (location is on-device only) |
| Does the app allow purchases? | Yes (subscriptions) |
| Does the app contain ads? | No |
| Does the app reference gambling? | No |

### Expected Rating: **Everyone** (ESRB) / **PEGI 3** / **USK 0**

Fitness apps with no violence, social features, or controversial content typically receive the lowest rating.

Click **"Submit"** after completing all questions.

---

## 5. Health Apps Declaration

Google Play has specific requirements for health-related apps.

### Navigation:

```
Play Console → Select "FitQuest"
  → Policy → App content
    → Health apps
```

### Declaration:

| Question | Answer |
|----------|--------|
| Is this app a health app? | **Yes** |
| Does the app provide medical advice/diagnosis/treatment? | **No** — informational only |
| Does the app connect to government health systems? | **No** |
| Does the app connect to medical devices? | **No** |
| Does the app use health sensors (accelerometer for fitness)? | **Yes** |

### Required Actions:

1. **Medical disclaimer** must be visible in the app (✅ exists in `MedicalDisclaimer.tsx` and Terms of Service)
2. **Medical disclaimer** must appear in the store listing description (see Section 2)
3. App must NOT claim to diagnose, cure, or treat any condition
4. Heart rate, sleep, and health scores must be labeled as **estimates/informational**

### What to Check in the App:

| Screen | Has Disclaimer? | Location |
|--------|----------------|----------|
| Craft My Body | ✅ Yes | `MedicalDisclaimer` component |
| Nutrition Calculator | ✅ Yes | `MedicalDisclaimer` component |
| Health Dashboard | ⚠️ Should add | Consider adding "Estimates only" label |
| Terms of Service | ✅ Yes | Section 3 (Medical Disclaimer) |

---

## 6. Privacy Policy — What Google Requires

Google mandates a **hosted, publicly accessible** Privacy Policy for any app that:
- Collects personal or sensitive data
- Uses health/fitness data
- Has subscriptions

### Requirements:

| Requirement | Status | Action |
|-------------|--------|--------|
| Hosted at HTTPS URL | ⚠️ URL created, not deployed | Deploy `website/privacy.html` to `fitquest.dev/privacy` |
| Accessible without login | ✅ | Static HTML page |
| Discloses data types collected | ✅ | Draft covers all types |
| Discloses purpose of collection | ✅ | Draft covers purposes |
| Discloses third-party sharing | ✅ | Sentry, PostHog, RevenueCat listed |
| Discloses data retention | ⚠️ | Retention periods need exact values |
| Discloses user rights | ✅ | Access, export, delete covered |
| Includes contact information | ⚠️ | Finalize support email |
| Compliant with GDPR (if serving EU) | ✅ | Bases, rights, DPO contact covered |
| Compliant with POPIA (South Africa) | ⚠️ | Need to add POPIA-specific language |
| Compliant with LGPD (Brazil) | ⚠️ | Need to add LGPD-specific language |
| Mentions Health Connect (if used) | N/A | Not using Health Connect currently |

### Where to Set in Play Console:

```
Play Console → Select "FitQuest"
  → Store presence → Main store listing
    → "Privacy policy" field
      → Enter: https://fitquest.dev/privacy
```

Also in App content:

```
Play Console → Policy → App content
  → Privacy policy → Enter the same URL
```

### Existing Files:

| File | Purpose |
|------|---------|
| `docs/legal/PRIVACY_POLICY_DRAFT.md` | Source of truth (Markdown) |
| `website/privacy.html` | Hosted version (HTML) |
| `app/privacy-policy.tsx` | In-app display screen |

---

## 7. Terms of Service

Not strictly required by Google Play, but **strongly recommended** and needed for subscription apps.

### Requirements:

| Requirement | Status |
|-------------|--------|
| Covers subscription terms | ✅ Section 6 in draft |
| Covers cancellation/refund policy | ⚠️ Add: "Refunds follow Google Play Store policies" |
| Covers limitations of liability | ✅ Section 10 |
| Covers termination | ✅ Section 8 |
| Governing law specified | ❌ Need to choose jurisdiction |
| Age requirement stated | ✅ Section implied (requires 13+) |
| Hosted at HTTPS URL | ⚠️ URL created, not deployed |

### Existing Files:

| File | Purpose |
|------|---------|
| `docs/legal/TERMS_OF_SERVICE_DRAFT.md` | Source of truth |
| `website/terms.html` | Hosted version |
| `app/terms-of-service.tsx` | In-app display screen |

---

## 8. Data Deletion Policy

Google Play requires that apps collecting user data provide a **clear way to delete it**.

### Requirements:

| Requirement | Status | Where |
|-------------|--------|-------|
| In-app deletion option | ✅ | Profile → Delete All Data |
| Web-based deletion instructions | ✅ | `website/delete-account.html` |
| Deletion URL set in Play Console | ❌ | Need to set `https://fitquest.dev/delete-account` |
| Deletion is complete (all user data) | ✅ | SQLite tables dropped + SecureStore cleared |
| Response within reasonable time | ✅ | Immediate (on-device) |

### Where to Set:

```
Play Console → Policy → App content
  → Data safety → "Data deletion" section
    → Enter: https://fitquest.dev/delete-account
```

> Since FitQuest is fully offline/client-side, data deletion is **immediate and complete** — all data lives on the device. Uninstalling the app also deletes all data.

---

## 9. Subscription & Billing Compliance

Google Play has specific rules for subscription apps.

### Navigation:

```
Play Console → Policy → App content
  → Financial features → "Subscriptions"
```

### Requirements:

| Requirement | Status | Action |
|-------------|--------|--------|
| Subscription terms clearly communicated before purchase | ✅ | Paywall shows price, billing period, trial length |
| Free trial duration shown | ✅ | "14-day free trial" on paywall |
| Auto-renewal disclosed | ⚠️ | Add "Subscription auto-renews unless cancelled" text |
| Cancellation instructions | ⚠️ | Add "Cancel anytime in Google Play Store → Subscriptions" |
| "Restore Purchases" button | ✅ | Paywall has restore button |
| Billing uses Google Play Billing | ✅ | RevenueCat uses Play Billing Library |
| No alternative payment methods | ✅ | Only Google Play billing |
| Subscription management deep link | ⚠️ | Add link to `https://play.google.com/store/account/subscriptions` |

### Required Text on Paywall:

Add this to your paywall screen (or near the subscribe button):

```
Payment will be charged to your Google Play account at confirmation of 
purchase. Subscription automatically renews unless auto-renew is turned 
off at least 24 hours before the end of the current period. Your account 
will be charged for renewal within 24 hours prior to the end of the 
current period. You can manage and cancel your subscriptions by going to 
your Google Play Store account settings.
```

---

## 10. Age & Children's Policy

### Navigation:

```
Play Console → Select "FitQuest"
  → Policy → App content
    → Target audience → "Start"
```

### Declaration:

| Question | Answer |
|----------|--------|
| Minimum target age | **13+** |
| Does the app appeal to children? | **No** (fitness app for teens+adults) |
| Does the app comply with COPPA? | **Yes** (no data collected from under-13) |
| Is the app in the "Designed for Families" program? | **No** |

### ⚠️ Age Verification:

Google recommends (and for health apps, essentially requires) that you:

1. Ask age during onboarding OR
2. Include a statement that the app is for users 13+ in the store listing

**Current FitQuest status**: No age check in onboarding.

**Recommended action**: Add age confirmation to onboarding flow:
```
"I confirm that I am 13 years of age or older"  [Checkbox]
```

This is simpler than a date-of-birth picker and satisfies the requirement.

---

## 11. Prominent Disclosure & Consent

**This is the #1 compliance gap for FitQuest.**

Google Play requires a **prominent disclosure** screen before accessing sensitive data (health, fitness, sensors, location). This is separate from the Privacy Policy — it must be an in-app dialog or screen.

### What Google Requires:

> "If your app collects and transmits personal or sensitive user data not related to functionality prominently described in the app's Play Store listing and in-app user interface, then prior to the collection and transmission, it must prominently highlight how the user data will be used and have the user provide affirmative consent."

### Implementation Needed:

Add a **consent screen** in the onboarding flow (after profile setup, before dashboard):

```
┌─────────────────────────────────────────┐
│         Your Data, Your Control         │
│                                         │
│  FitQuest collects the following data   │
│  to personalize your experience:        │
│                                         │
│  ✅ Workout & Exercise Data             │
│     To track progress and generate      │
│     personalized plans                  │
│                                         │
│  ✅ Health Metrics (Heart Rate, Sleep)  │
│     Encrypted with AES-256-GCM          │
│     Stored only on your device          │
│                                         │
│  ✅ Step & Activity Data                │
│     For daily activity tracking         │
│                                         │
│  ⬜ Location (Optional)                 │
│     For jog route tracking              │
│                                         │
│  All data stays on your device.         │
│  We never sell or share your data.      │
│                                         │
│  [Read Full Privacy Policy]             │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │    I Understand & Agree          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Decline & Exit]                       │
└─────────────────────────────────────────┘
```

### Key Requirements:

| Requirement | Details |
|-------------|---------|
| **Prominent** | Full screen, not a small banner |
| **Before collection** | Must show BEFORE any health/fitness data is created |
| **Affirmative consent** | User must tap "I Agree" (not just passive scroll-past) |
| **Specific** | Lists what data is collected and why |
| **Separate from ToS** | This is NOT the Terms acceptance — it's a data consent screen |
| **Link to Privacy Policy** | Must include a link |
| **Decline option** | User can decline (app functionality may be limited) |

---

## 12. US Export Compliance (Encryption)

Apps using encryption must declare compliance with US export regulations.

### Navigation:

```
Play Console → Select "FitQuest"
  → Policy → App content
    → App access → (not here, see below)
```

This is typically asked during app signing/upload as a checkbox.

### FitQuest's Encryption:

| Algorithm | Purpose | Export Status |
|-----------|---------|--------------|
| AES-256-GCM | Health data encryption | EAR99 exempt (standard commercial crypto) |
| PBKDF2-SHA256 | Passcode hashing | EAR99 exempt |
| SHA-256 | Document deduplication | Not encryption, exempt |
| HTTPS/TLS | Network transport | Built into OS, exempt |

**Action**: When uploading your AAB, Google will ask:
> "Does your app use encryption?"

Answer: **Yes**, and declare it as **standard commercial encryption** (exempt under EAR99).

---

## 13. Closed Testing Gate

**Since November 2023**, new personal developer accounts must complete a closed testing program before accessing the production track.

### Requirements:

| Requirement | Details |
|-------------|---------|
| **Track** | Closed testing (not internal, not open) |
| **Testers** | Minimum 12 opted-in testers |
| **Duration** | 14 consecutive days |
| **Crashes** | Must maintain acceptable crash rate |
| **After completion** | Production access unlocked |

### Navigation:

```
Play Console → Select "FitQuest"
  → Testing → Closed testing
    → "Create track" (or use "Closed testing - Alpha")
      → "Manage testers" → Add testers
        → Upload release → Roll out
```

### Steps:

1. **Create closed track**:
   - Track name: "Closed Beta"
   - Create a testers list with email addresses (at least 12 people)
   
2. **Upload AAB**:
   - Build: `cd android && ./gradlew bundleRelease`
   - Upload the AAB from `android/app/build/outputs/bundle/release/`
   
3. **Roll out**:
   - Set rollout percentage to 100%
   - Click "Review and roll out"
   
4. **Wait 14 days** with 12+ active testers

5. **Check status**:
   ```
   Play Console → Publishing overview
     → See if "Production" track is unlocked
   ```

### Where to Find Testers:

- Friends and family
- Fitness communities (Reddit r/bodyweightfitness, r/fitness)
- Developer communities (Reddit r/androiddev)
- FitQuest social media followers
- Consider beta testing platforms (BetaFamily, TestFairy)

---

## 14. App Signing

Google Play App Signing is mandatory for new apps.

### Navigation:

```
Play Console → Select "FitQuest"
  → Setup → App signing
```

### What Happens:

1. Google manages your app's signing key
2. You upload with an "upload key" (different from signing key)
3. Google re-signs with the managed key before distribution

### Action:

- Accept the terms when prompted during first upload
- **Keep your upload keystore** (`*.jks`) safe — you need it for every update
- If using EAS Build (Expo), this is handled automatically

---

## 15. Hosted Legal Pages (URLs)

Google Play Console requires **hosted URLs** for legal documents. These must be publicly accessible.

### Required URLs:

| Document | URL | File |
|----------|-----|------|
| Privacy Policy | `https://fitquest.dev/privacy` | `website/privacy.html` |
| Terms of Service | `https://fitquest.dev/terms` | `website/terms.html` |
| Data Deletion | `https://fitquest.dev/delete-account` | `website/delete-account.html` |
| Support | `https://fitquest.dev/support` | `website/support.html` |

### Where to Enter in Play Console:

| URL | Console Location |
|-----|-----------------|
| Privacy Policy | Store listing → Privacy policy URL |
| Privacy Policy | App content → Privacy policy |
| Data Deletion | App content → Data safety → Data deletion |
| Support | Store listing → Website (optional) |

### Hosting Options (Cheapest & Simplest):

| Option | Cost | Setup |
|--------|------|-------|
| **GitHub Pages** | Free | Push `website/` folder, enable Pages |
| **Netlify** | Free | Connect repo, set build directory to `website/` |
| **Vercel** | Free | Same as Netlify |
| **Firebase Hosting** | Free (within limits) | `firebase deploy --only hosting` |
| **Custom domain** | ~$12/year | Register `fitquest.dev` + point to any host |

**Recommended**: GitHub Pages + custom domain. Free, reliable, HTTPS included.

### Quick GitHub Pages Setup:

1. Go to your GitHub repo → Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: `main`, folder: `/website`
4. Save — site is live at `https://yourusername.github.io/FitQuest/`
5. Add custom domain: `fitquest.dev` (requires DNS A records pointing to GitHub IPs)

---

## 16. FitQuest Status Tracker

### Checklist — Work Through In Order

| # | Task | Status | Blocking? |
|---|------|--------|-----------|
| 1 | Google Play developer account created | ⬜ | YES |
| 2 | Identity verification completed | ⬜ | YES |
| 3 | Payments / merchant profile set up | ⬜ | YES (for subscriptions) |
| 4 | Privacy Policy finalized (add POPIA, retention periods) | ⬜ | YES |
| 5 | Terms of Service finalized (add governing law, refund text) | ⬜ | NO (but recommended) |
| 6 | Legal pages hosted at HTTPS URLs | ⬜ | YES |
| 7 | Privacy Policy URL entered in Play Console | ⬜ | YES |
| 8 | Data deletion URL entered in Play Console | ⬜ | YES |
| 9 | Store listing created (icon, screenshots, description) | ⬜ | YES |
| 10 | Medical disclaimer in store listing description | ⬜ | YES |
| 11 | Data Safety form completed | ⬜ | YES |
| 12 | Content Rating (IARC) questionnaire done | ⬜ | YES |
| 13 | Health Apps declaration done | ⬜ | YES |
| 14 | Target audience & content set (13+) | ⬜ | YES |
| 15 | Age confirmation added to onboarding | ⬜ | HIGH priority |
| 16 | Prominent data consent screen added to onboarding | ⬜ | BLOCKER |
| 17 | Auto-renewal / cancellation text on paywall | ⬜ | HIGH priority |
| 18 | App Signing accepted | ⬜ | YES |
| 19 | Export compliance declared | ⬜ | YES |
| 20 | Build AAB (not APK) | ⬜ | YES |
| 21 | Upload to Closed Testing track | ⬜ | YES |
| 22 | Get 12+ testers opted in | ⬜ | YES |
| 23 | Wait 14 days in closed testing | ⬜ | YES |
| 24 | Fix any policy violations flagged during testing | ⬜ | If any |
| 25 | Create subscription products in Play Console | ⬜ | YES |
| 26 | Connect RevenueCat (see REVENUECAT_DASHBOARD_SETUP.md) | ⬜ | YES |
| 27 | Test subscription flow end-to-end | ⬜ | YES |
| 28 | Submit to production track | ⬜ | — |

### Priority Order (What to Do First):

**Phase 1 — Foundation (Do Now)**
1. Create/verify developer account
2. Set up payments profile
3. Finalize and host legal documents
4. Create store listing assets (icon, screenshots)

**Phase 2 — Code Changes (Implement)**
5. Add prominent data consent screen to onboarding
6. Add age confirmation to onboarding
7. Add auto-renewal text to paywall
8. Build AAB

**Phase 3 — Play Console Forms (Fill Out)**
9. Complete Data Safety form
10. Complete Content Rating
11. Complete Health Apps declaration
12. Set target audience
13. Accept App Signing
14. Declare export compliance

**Phase 4 — Testing (Wait)**
15. Upload to closed testing
16. Recruit 12+ testers
17. Wait 14 days
18. Fix any issues

**Phase 5 — Monetization & Launch**
19. Set up subscription products
20. Connect RevenueCat
21. Test purchases
22. Submit to production

---

## Appendix A: Relevant FitQuest Files

| Purpose | File |
|---------|------|
| Privacy Policy (source) | `docs/legal/PRIVACY_POLICY_DRAFT.md` |
| Terms of Service (source) | `docs/legal/TERMS_OF_SERVICE_DRAFT.md` |
| Privacy Policy (hosted) | `website/privacy.html` |
| Terms of Service (hosted) | `website/terms.html` |
| Data Deletion (hosted) | `website/delete-account.html` |
| Support Page (hosted) | `website/support.html` |
| Legal Consent Tracking | `src/services/legalService.ts` |
| Legal Center Screen | `app/legal-center.tsx` |
| Privacy Policy Screen | `app/privacy-policy.tsx` |
| Terms of Service Screen | `app/terms-of-service.tsx` |
| Medical Disclaimer | `src/components/MedicalDisclaimer.tsx` |
| Subscription Manager | `src/purchases/SubscriptionManager.ts` |
| Paywall Screen | `app/paywall.tsx` |
| Onboarding Screen | `app/onboarding.tsx` |
| Google Play Compliance Audit | `docs/GOOGLE_PLAY_POLICY_COMPLIANCE_AUDIT.md` |
| RevenueCat Setup Guide | `docs/REVENUECAT_DASHBOARD_SETUP.md` |

## Appendix B: Third-Party SDKs to Declare

| SDK | Data Shared | Purpose | Required to Declare |
|-----|-------------|---------|-------------------|
| **Sentry** (`@sentry/react-native`) | Crash logs, device info | Error tracking | Yes — in Data Safety |
| **PostHog** (`posthog-react-native`) | App events, device info | Analytics | Yes — in Data Safety |
| **RevenueCat** (`react-native-purchases`) | Purchase history, subscription status | Billing | Yes — in Data Safety |
| **OpenRouter** (via fetch) | AI prompts (no health data) | AI chat responses | Yes — in Data Safety |
| **Expo** (various) | No PII shared | Framework | Minimal declaration |

> ⚠️ If you disable PostHog or OpenRouter before launch, remove them from Data Safety too.
