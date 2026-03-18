# FitQuest 2.0 — Google Play Readiness Report

> **Prepared by:** Development Team  
> **Date:** 13 March 2026  
> **Status:** Pre-Submission Assessment  
> **App:** FitQuest 2.0 (com.hugelet.fitquest)  
> **Developer Entity:** fitquest.dev  
> **Support Email:** fitquestsupp0rt@gmail.com  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Google Play Console Setup Requirements](#2-google-play-console-setup-requirements)
3. [Mandatory Declarations & Policy Compliance](#3-mandatory-declarations--policy-compliance)
4. [Health & Fitness App-Specific Requirements](#4-health--fitness-app-specific-requirements)
5. [Legal Document Audit — Gap Analysis](#5-legal-document-audit--gap-analysis)
6. [Remediation Actions Completed](#6-remediation-actions-completed)
7. [Distribution Strategy Analysis](#7-distribution-strategy-analysis)
8. [Website Deliverables](#8-website-deliverables)
9. [Data Safety Form Guidance](#9-data-safety-form-guidance)
10. [Pre-Submission Checklist](#10-pre-submission-checklist)
11. [Remaining Action Items](#11-remaining-action-items)

---

## 1. Executive Summary

FitQuest 2.0 is a privacy-first, offline-first fitness application built with React Native (Expo SDK 55). All user data is stored locally on-device using SQLite with AES-256-GCM encryption for sensitive health records. The app has no cloud backend — this is a significant privacy advantage but creates unique challenges for Google Play compliance (e.g., account deletion requirements when there's no server-side account).

This report documents:
- All Google Play Console requirements researched from official documentation
- A legal document audit identifying 5 critical gaps (all now remediated)
- A distribution strategy analysis (verdict: Google Play Store)
- All legal documents updated in-app and created for the website
- A step-by-step pre-submission checklist

### Key Findings

| Area | Status |
|------|--------|
| Privacy Policy (in-app) | ✅ Updated — 12 sections, POPIA/GDPR/CCPA compliant |
| Privacy Policy (web) | ✅ Created at website/privacy.html |
| Terms of Service (in-app) | ✅ Updated — 12 sections, SA governing law |
| Terms of Service (web) | ✅ Created at website/terms.html |
| Account Deletion (web) | ✅ Created at website/delete-account.html |
| Developer Entity | ✅ fitquest.dev referenced throughout |
| Support Contact | ✅ fitquestsupp0rt@gmail.com |
| Medical Disclaimer | ✅ In-app + in Terms of Service |
| POPIA Compliance | ✅ Dedicated section in Privacy Policy |
| Health Connect Disclosure | ✅ Dedicated section in Privacy Policy |
| AI Data Processing Disclosure | ✅ Dedicated section in Privacy Policy |
| TypeScript Build | ✅ Zero errors |

---

## 2. Google Play Console Setup Requirements

### 2.1 Developer Account

| Requirement | Details |
|-------------|---------|
| Registration fee | $25 USD one-time |
| Identity verification | Government ID + physical address required |
| Account type | Personal or Organization (Organization requires D-U-N-S number) |
| Setup URL | https://play.google.com/console/signup |

**Recommendation:** Start with a Personal account. Organization accounts require a D-U-N-S number (free from Dun & Bradstreet but takes 30 days).

### 2.2 New Developer Testing Gate (Since November 2023)

Google requires new personal developer accounts to complete closed testing before production release:

| Requirement | Details |
|-------------|---------|
| Minimum testers | **12 opted-in testers** (not just invited — they must accept) |
| Testing duration | **14 consecutive days** of continuous testing |
| Test track | Closed testing track (not internal) |
| Testers must | Actually install and use the app during the testing period |
| After completion | Production access is unlocked |

**Strategy:**
1. Create a closed test track immediately after account setup
2. Recruit 15-20 testers (buffer for drop-off) — friends, family, fitness communities
3. Share the opt-in link
4. Monitor daily that testers keep the app installed
5. After 14 days, production publishing unlocks

### 2.3 Required Assets for Store Listing

| Asset | Specification |
|-------|---------------|
| App icon | 512 × 512 px PNG (32-bit, no alpha) |
| Feature graphic | 1024 × 500 px |
| Screenshots | Min 2, max 8. Phone: 16:9 or 9:16. Min 320px, max 3840px |
| Short description | Max 80 characters |
| Full description | Max 4000 characters |
| App category | Health & Fitness |
| Content rating | Complete IARC questionnaire |
| Video | Optional, YouTube URL |

---

## 3. Mandatory Declarations & Policy Compliance

### 3.1 App Content Page (Required for All Apps)

Every app must complete the App Content page in Play Console with:

| Declaration | FitQuest Status | Action Needed |
|-------------|----------------|---------------|
| **Privacy Policy URL** | ✅ https://fitquest.dev/privacy | Deploy website |
| **Ads Declaration** | App contains no ads | Select "No" |
| **App Access** | App requires login (biometric/passcode) | Provide demo credentials or mark "All functionality available without restrictions" |
| **Content Rating** | Complete IARC questionnaire | Fill out in console |
| **Target Audience** | 13+ (not designed for children) | Select appropriate age range |
| **Data Safety** | See Section 9 below | Fill out Data Safety form |
| **Government Apps** | Not a government app | Select "No" |
| **Financial Features** | No financial features | Select "No" |
| **Health Apps** | ✅ Health app — requires declaration | See Section 4 |

### 3.2 User Data Policy Compliance

Google's User Data policy requires:

1. **Privacy Policy**: Must be accessible both in-app AND as a URL on the store listing
   - ✅ In-app: `app/privacy-policy.tsx`
   - ✅ Web: `website/privacy.html` → https://fitquest.dev/privacy

2. **Prominent Disclosure**: Before collecting sensitive data, apps must show a prominent disclosure that:
   - Clearly describes what data is collected
   - Explains how the data is used
   - Requests user consent (affirmative action — not pre-checked boxes)
   - ⚠️ **This should be added to the onboarding flow** (see Section 11)

3. **Account Deletion**: Apps that allow account creation must provide:
   - In-app deletion option: ✅ Profile → Settings → Delete All Data
   - Web-based deletion: ✅ https://fitquest.dev/delete-account

### 3.3 Permissions Declaration

FitQuest uses the following permissions that require justification:

| Permission | Purpose | Justification |
|------------|---------|---------------|
| ACCESS_FINE_LOCATION | Jog tracking GPS | Required for route mapping during jog sessions |
| ACTIVITY_RECOGNITION | Step counting | Required for pedometer and activity classification |
| CAMERA | Profile photo | Optional — user can set a profile picture |
| BODY_SENSORS | Heart rate | Optional — for heart rate monitoring |
| POST_NOTIFICATIONS | Workout reminders | For streak reminders and health alerts |

---

## 4. Health & Fitness App-Specific Requirements

### 4.1 Health Apps Declaration

Google Play has a specific declaration form for health apps. FitQuest must:

1. **Declare as a health app** in the App Content section
2. **Confirm compliance** with Health Content and Services policy
3. **Not claim** to be a medical device or provide medical diagnosis

### 4.2 Medical Disclaimer Requirements

The medical disclaimer must appear in:

| Location | Status |
|----------|--------|
| Google Play store description | ⚠️ Include in store listing description |
| In-app Terms of Service | ✅ Section 2 — comprehensive medical disclaimer |
| Website Terms of Service | ✅ Section 2 — with highlight box |
| Onboarding / first launch | ⚠️ Recommended (see Section 11) |

**Required disclaimer language (adapted for store listing):**

> FitQuest is a fitness and wellness application and is NOT a medical device. It does not provide medical advice, diagnosis, or treatment. Always consult a healthcare professional before starting any exercise program.

### 4.3 Health Connect Integration

If FitQuest uses Google Health Connect:

| Requirement | Status |
|-------------|--------|
| Request only necessary permissions | ✅ Steps, heart rate, sleep, workouts |
| Clearly explain each permission request | ✅ Disclosed in privacy policy |
| Use read-only access unless write is needed | ✅ Read-only |
| Display Health Connect data in-app | ✅ Health dashboard |
| Include Health Connect in privacy policy | ✅ Dedicated section |
| Declare in Data Safety form | ⚠️ Must check during form completion |

### 4.4 User Data Types Requiring Declaration

FitQuest processes these sensitive data types that Google specifically asks about:

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Health info (heart rate, sleep) | Yes — on-device only | No | Fitness tracking |
| Fitness info (workouts, steps) | Yes — on-device only | No | Activity tracking |
| Location (GPS during jogs) | Yes — on-device only | No | Jog route mapping |
| Photos (profile picture) | Yes — on-device only | No | User personalization |
| App interactions | Yes — anonymized | Sentry (crash reports) | Bug fixing |
| Device info | Yes — anonymized | Sentry (crash reports) | Compatibility |

---

## 5. Legal Document Audit — Gap Analysis

### 5.1 Gaps Identified (Pre-Remediation)

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| 1 | No developer entity name in privacy policy or terms | CRITICAL | ✅ Fixed |
| 2 | No data protection compliance section (Lesotho) | CRITICAL | ✅ Fixed |
| 3 | No Health Connect / HealthKit data disclosure | CRITICAL | ✅ Fixed |
| 4 | Governing law was not in the actual terms sections | HIGH | ✅ Fixed |
| 5 | No external account deletion URL | CRITICAL | ✅ Fixed |
| 6 | No AI data processing disclosure (OpenRouter) | HIGH | ✅ Fixed |
| 7 | No biometric data section in privacy policy | MEDIUM | ✅ Fixed |
| 8 | No intellectual property clause in terms | MEDIUM | ✅ Fixed |
| 9 | No termination clause in terms | MEDIUM | ✅ Fixed |
| 10 | No user-generated content clause | LOW | ✅ Fixed |
| 11 | Legal URLs pointed to fitquest.app (unowned domain) | CRITICAL | ✅ Fixed → fitquest.dev |
| 12 | No live privacy policy URL for Google Play | CRITICAL | ✅ Fixed — website created |

### 5.2 Files Modified

| File | Changes Made |
|------|-------------|
| `src/i18n/translations.ts` | Added developer entity, POPIA section, Health Connect disclosure, AI processing disclosure, biometric data section, IP clause, termination clause, UGC clause, updated governing law, account deletion URL |
| `src/services/legalService.ts` | Updated legal URLs from fitquest.app → fitquest.dev |
| `app.json` | Updated extra.legal URLs to fitquest.dev |
| `app/privacy-policy.tsx` | Added sections for developer info, POPIA, Health Connect, AI processing, biometric data |
| `app/terms-of-service.tsx` | Added sections for IP, termination, UGC, updated governing law |

### 5.3 Legal Document Section Inventory

#### Privacy Policy (12 Sections)

1. **Data We Collect** — Health metrics, biometric auth, location, profile, usage, device info, photos, Health Connect
2. **Data Storage** — Offline-first, SQLite, no external servers, AES-256-GCM
3. **Data Security** — AES-256-GCM, Keychain/Keystore, biometric auth, PBKDF2
4. **Third-Party Services** — OpenRouter/Llama (AI only, no health data), Health Connect (read-only), RevenueCat (anonymous), Sentry (anonymized crashes)
5. **Children's Privacy** — 13+ age requirement, deletion contact
6. **Data Retention** — Local storage, delete via settings or uninstall, web deletion option
7. **Your Rights** — Access, deletion, portability (JSON export), correction, objection
8. **POPIA Compliance** — Responsible party declaration, Information Regulator reference
9. **Background Health Monitoring** — 1-minute collection intervals, encrypted, disableable
10. **Work Schedule Data** — Optional, local-only, for workout timing
11. **Policy Updates** — In-app notification, updated date tracking
12. **Contact** — Email, website, developer name

#### Terms of Service (12 Sections)

1. **Acceptable Use** — Lawful use, no reverse engineering, no security bypass
2. **Medical Disclaimer** — NOT a medical device, consult healthcare professionals
3. **Subscription & Billing** — Google Play/App Store billing, auto-renewal, cancellation
4. **Intellectual Property** — fitquest.dev owns all content, code, algorithms
5. **Limitation of Liability** — Maximum liability = 12 months of premium fees
6. **Termination** — Right to suspend for violations, data persists locally
7. **User Content** — User owns their content, AI processing disclosure
8. **Account Deletion** — In-app and web deletion paths
9. **Governing Law** — Kingdom of Lesotho, Lesotho courts jurisdiction
10. **Platform Compliance** — Google Play and App Store policy compliance
11. **Changes to Terms** — Updated on website, continued use = acceptance
12. **Contact** — Email, website, developer name

---

## 6. Remediation Actions Completed

### 6.1 In-App Legal Updates

All legal translations added to `src/i18n/translations.ts`:

```
legal.privacy.sections.developerBody    → fitquest.dev entity declaration
legal.privacy.sections.popiaTitle       → "Data Protection Compliance (Lesotho)"
legal.privacy.sections.popiaBody        → Responsible party, Information Regulator
legal.privacy.sections.healthConnectTitle → "Health Connect / HealthKit Data"
legal.privacy.sections.healthConnectBody  → Read-only, encrypted storage
legal.privacy.sections.aiTitle          → "AI Data Processing"  
legal.privacy.sections.aiBody           → OpenRouter/Llama, no health data sent
legal.privacy.sections.biometricTitle   → "Biometric Data"
legal.privacy.sections.biometricBody    → On-device only, never transmitted
legal.terms.sections.ipTitle            → "Intellectual Property"
legal.terms.sections.ipBody             → Copyright and trademark protection
legal.terms.sections.terminationTitle   → "Termination"
legal.terms.sections.terminationBody    → Suspension rights, data persistence
legal.terms.sections.ugcTitle           → "User Content"
legal.terms.sections.ugcBody            → User ownership, AI disclosure
legal.terms.sections.governingLawBody   → Kingdom of Lesotho
```

### 6.2 URL Migration

| Location | Old Value | New Value |
|----------|-----------|-----------|
| legalService.ts DEFAULT_LINKS | fitquest.app/privacy | fitquest.dev/privacy |
| legalService.ts DEFAULT_LINKS | fitquest.app/terms | fitquest.dev/terms |
| app.json extra.legal | fitquest.app/privacy | fitquest.dev/privacy |
| app.json extra.legal | fitquest.app/terms | fitquest.dev/terms |
| Translations (account delete) | — | fitquest.dev/delete-account |

### 6.3 Website Created

Full website at `website/` folder with 2,325 total lines across 8 files. See Section 8 for details.

---

## 7. Distribution Strategy Analysis

### 7.1 Google Play Store vs. Own Website (APK Distribution)

| Factor | Google Play Store | Own Website |
|--------|-------------------|-------------|
| **Discoverability** | 2.5B+ monthly active users, organic search, category browsing, "similar apps" | Zero — requires 100% self-driven marketing |
| **Trust** | "Verified by Google Play" badge, user confidence | Users must enable "Unknown Sources" — major friction |
| **Updates** | Automatic OTA updates for all users | Manual — users must revisit site and reinstall |
| **Payments** | Built-in billing (30% commission, 15% for <$1M) | Must build own payment system (Stripe/PayPal) |
| **Security** | Play Protect scanning, code signing verification | Users bypass security settings to install |
| **Legal** | Google mediates GDPR/CCPA compliance UI | Full liability on developer |
| **Analytics** | Free crash reports, ANR data, device stats, acquisition reports | Must integrate third-party analytics |
| **Reviews** | Star ratings drive social proof | No review system |
| **Cost** | $25 one-time + 15-30% commission on sales | Hosting cost (~$5-20/month) + payment processing (2.9%) |
| **Time to market** | 1-3 days (after testing gate) | Immediate |
| **Geo-targeting** | 190+ countries with automatic currency conversion | Manual price/currency management |

### 7.2 Verdict: Google Play Store

**Google Play is the clear winner** for a health & fitness app targeting Lesotho, Africa, and beyond:

1. **Trust is essential for health apps** — Users sharing health data need platform credibility
2. **African market is Play Store dominant** — 85%+ Android market share across Africa
3. **Subscription billing is handled** — RevenueCat + Google Play Billing eliminates payment complexity
4. **Update distribution is automatic** — Critical for fixing bugs in health-monitoring code
5. **15% Small Business commission** — For revenue under $1M/year, commission is only 15%

**Own website should still exist** for:
- Legal document hosting (privacy policy, terms, account deletion)
- Marketing and landing page
- Support and FAQ
- SEO and brand presence

---

## 8. Website Deliverables

### 8.1 Site Map

```
fitquest.dev/
├── index.html          (353 lines) — Home: hero, features, how-it-works, showcase, pricing, CTA
├── about.html          (242 lines) — Story, values (6 cards), tech stack, stats
├── privacy.html        (143 lines) — 12-section privacy policy, POPIA/GDPR/CCPA
├── terms.html          (132 lines) — 12-section terms of service, SA law
├── support.html        (230 lines) — Contact cards, support form, 5 FAQ items
├── delete-account.html (172 lines) — 3 deletion options, deletion form, data inventory
├── css/
│   └── styles.css      (882 lines) — Premium dark theme, glassmorphism, animations
└── js/
    └── main.js         (171 lines) — Scroll reveal, particles, counters, tilt effects
```

### 8.2 Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | #0A0E17 | Matches app dark theme |
| Surface | #111827 | Cards, sections |
| Accent | #10B981 | CTA buttons, highlights, borders |
| Accent Light | #34D399 | Hover states |
| Text Primary | #F1F5F9 | Headings |
| Text Secondary | #94A3B8 | Body text |
| Text Muted | #64748B | Captions, labels |
| Warning | #F4A427 | Warnings |
| Error | #EF4444 | Errors |

### 8.3 Features

- **Premium dark theme** matching the app's #0A0E17 color scheme
- **Glass-morphism cards** with backdrop-filter blur and accent borders
- **Scroll animations** (reveal, scale, slide-left, slide-right) via IntersectionObserver
- **Floating particles** background (30 particles, varied speeds)
- **Animated counters** (1,300+ exercises, 15 languages, 6 categories, 256-bit encryption)
- **Magnetic button effects** (follow cursor on hover)
- **3D tilt cards** (perspective transform on mouse move)
- **Responsive design** (desktop, tablet, mobile breakpoints at 768px and 480px)
- **Mobile hamburger navigation** (slide-in drawer)
- **FAQ accordion** with smooth expand/collapse
- **Contact form** (mailto: fallback — no backend needed)
- **Account deletion form** (mailto: fallback)
- **Custom scrollbar** styled to match theme
- **Google Fonts** (Inter, weights 400-900)

### 8.4 Deployment

The website is static HTML/CSS/JS — no build step required. Deployment options:

| Platform | Cost | Setup |
|----------|------|-------|
| **GitHub Pages** | Free | Push to gh-pages branch, set custom domain |
| **Netlify** | Free tier | Drag-and-drop or Git integration |
| **Vercel** | Free tier | Git integration, instant deploys |
| **Cloudflare Pages** | Free tier | Git integration, edge CDN |

**Recommended:** Netlify or Cloudflare Pages for simplicity and free SSL.

After purchasing `fitquest.dev`, point DNS to chosen host and configure:
- `fitquest.dev` → index.html
- `fitquest.dev/privacy` → privacy.html
- `fitquest.dev/terms` → terms.html
- `fitquest.dev/delete-account` → delete-account.html

---

## 9. Data Safety Form Guidance

When filling out the Google Play Data Safety form, use this reference:

### 9.1 Data Types Collected

| Data Type | Collected? | Shared? | Purpose | Required? |
|-----------|------------|---------|---------|-----------|
| Name | No | — | — | — |
| Email | No | — | — | — |
| Phone number | No | — | — | — |
| Approximate location | No | — | — | — |
| Precise location | Yes | No | Jog route mapping | Optional — only during jog tracking |
| Health info | Yes | No | Fitness tracking, health dashboard | Required for core functionality |
| Fitness info | Yes | No | Workout tracking, progression | Required for core functionality |
| Photos | Yes | No | Profile picture | Optional |
| App interactions | Yes | Yes (Sentry) | Crash reporting | Required for stability |
| Crash logs | Yes | Yes (Sentry) | Bug fixing | Required for stability |
| Device ID | No | — | — | — |
| Other user-generated content | Yes | No | Workout notes, annotations | Optional |

### 9.2 Data Handling Declarations

| Question | Answer |
|----------|--------|
| Is data encrypted in transit? | Yes — TLS for AI requests and Sentry |
| Is data encrypted at rest? | Yes — AES-256-GCM for health data |
| Can users request data deletion? | Yes — in-app and web |
| Is data processed ephemerally? | AI text is processed by OpenRouter and not stored on their servers |

### 9.3 Third-Party SDKs to Declare

| SDK | Data Accessed | Purpose |
|-----|---------------|---------|
| Sentry | Crash logs, device info (anonymized) | Crash reporting |
| RevenueCat | Purchase tokens, anonymous user ID | Subscription management |
| OpenRouter | User text prompts (no health data) | AI Coach & Professor features |
| expo-location | GPS coordinates | Jog tracking |
| expo-sensors | Accelerometer, gyroscope | Step counting, rep detection |

---

## 10. Pre-Submission Checklist

### 10.1 Critical (Must Complete Before Submission)

| # | Task | Status |
|---|------|--------|
| 1 | Purchase `fitquest.dev` domain | ⬜ Pending |
| 2 | Deploy website to hosting platform | ⬜ Pending |
| 3 | Verify https://fitquest.dev/privacy loads correctly | ⬜ Pending |
| 4 | Verify https://fitquest.dev/terms loads correctly | ⬜ Pending |
| 5 | Verify https://fitquest.dev/delete-account loads correctly | ⬜ Pending |
| 6 | Create Google Play Developer account ($25) | ⬜ Pending |
| 7 | Complete identity verification | ⬜ Pending |
| 8 | Build release APK/AAB with proper signing | ⬜ Pending |
| 9 | Create app icon (512×512) and feature graphic (1024×500) | ⬜ Pending |
| 10 | Take 4-8 app screenshots | ⬜ Pending |
| 11 | Write store listing (short + full description with medical disclaimer) | ⬜ Pending |
| 12 | Complete IARC content rating questionnaire | ⬜ Pending |
| 13 | Fill out Data Safety form (see Section 9) | ⬜ Pending |
| 14 | Complete Health Apps Declaration | ⬜ Pending |
| 15 | Set up closed testing track with 12+ testers | ⬜ Pending |
| 16 | Run 14-day closed testing period | ⬜ Pending |

### 10.2 Recommended (Before or Shortly After Submission)

| # | Task | Status |
|---|------|--------|
| 17 | Add prominent data disclosure + consent to onboarding flow | ⬜ Pending |
| 18 | Add medical disclaimer to first-launch screen | ⬜ Pending |
| 19 | Remove console.log statements from production build | ⬜ To verify |
| 20 | Test app on multiple Android versions (API 26+) | ⬜ Pending |
| 21 | Set up RevenueCat for production subscription billing | ⬜ Pending |
| 22 | Configure Sentry for production error tracking | ⬜ Pending |
| 23 | Create Google Play Console A/B listing experiments | ⬜ Optional |

---

## 11. Remaining Action Items

### 11.1 Onboarding Consent Flow (Priority: HIGH)

Google Play requires a **prominent in-app disclosure** before collecting sensitive user data. This should be integrated into the onboarding flow at `app/onboarding.tsx`:

**Required elements:**
- Clear description of what health data is collected
- How the data is used (workout generation, health tracking)
- How the data is stored (locally, encrypted)
- Which third parties receive data (AI text only → OpenRouter)
- Affirmative consent button (not pre-checked)
- Link to full privacy policy

**Suggested implementation:**
Add a dedicated consent step to the onboarding screens that users must acknowledge before proceeding. Store consent timestamp via `legalService.ts`.

### 11.2 Store Listing Description Template

```
Short description (≤80 chars):
AI-powered adaptive workouts & health tracking. Offline-first. Privacy-first.

Full description (key points to include):
• 1,300+ exercises across 6 training categories
• AI-adaptive workout generation based on your goals, fatigue, and recovery
• Real-time health dashboard with heart rate, steps, sleep tracking
• FitMind cognitive fitness — document reader, flashcards, AI learning
• Dual AI assistants: Coach (workouts) + Professor (knowledge)
• AES-256-GCM encryption for all health data
• Works completely offline — no account required
• Supports 15 languages including SA languages
• Biometric lock with passcode fallback

⚠️ MEDICAL DISCLAIMER: FitQuest is NOT a medical device and does not
provide medical advice, diagnosis, or treatment. Always consult a
healthcare professional before starting any exercise program.
```

### 11.3 Domain + Hosting

1. Purchase `fitquest.dev` from a registrar (Google Domains, Namecheap, Cloudflare)
2. Deploy `website/` folder to Netlify or Cloudflare Pages
3. Configure custom domain + SSL
4. Test all pages load correctly
5. Submit privacy policy URL to Google Play Console

---

## Appendices

### A. Google Play Documentation Sources

| Document | URL |
|----------|-----|
| App Content Requirements | https://support.google.com/googleplay/android-developer/answer/9859455 |
| User Data Policy | https://support.google.com/googleplay/android-developer/answer/9888076 |
| Health Content Policy | https://support.google.com/googleplay/android-developer/answer/12261419 |
| Data Safety Form | https://support.google.com/googleplay/android-developer/answer/10787469 |
| Testing Requirements | https://support.google.com/googleplay/android-developer/answer/14151465 |
| Account Setup | https://support.google.com/googleplay/android-developer/answer/9859152 |

### B. Legal Framework References

| Law | Jurisdiction | Key Requirements |
|-----|-------------|------------------|
| Data Protection Act 2011 | Lesotho | Responsible party declaration, data minimization, lawful processing |
| POPIA | South Africa (cross-border) | Responsible party declaration, data minimization, Information Regulator complaints |
| GDPR | European Union | Lawful basis, data subject rights, DPO (if applicable), 72-hour breach notification |
| CCPA | California, USA | Right to know, right to delete, right to opt-out of sale, financial incentive notice |

### C. Technology Stack Summary

| Component | Technology |
|-----------|------------|
| Framework | React Native 0.83.2 + Expo SDK 55 |
| Router | Expo Router v6 |
| Database | expo-sqlite (SQLite) |
| Encryption | AES-256-GCM (src/security/AESEncryption.ts) |
| Auth | Biometric (expo-local-authentication) + PBKDF2 passcode |
| State | React Context + Zustand (minimal) |
| AI | OpenRouter / Llama (external API) |
| Subscriptions | RevenueCat |
| Crash Reporting | Sentry |
| Languages | 15 (src/i18n/translations.ts) |

---

*This document should be updated as requirements are fulfilled. Last verified: 13 March 2026.*
