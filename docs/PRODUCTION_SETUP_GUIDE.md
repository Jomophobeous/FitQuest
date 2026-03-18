# FitQuest Production Setup Guide — Development to Deployment Pipeline

**Document Status:** 🔧 Technical Production Checklist  
**Timeline:** 3-4 weeks (concurrent with final feature polish)  
**Audience:** CTO, DevOps, QA Lead, iOS/Android release managers  
**Last Updated:** March 9, 2026  
**Scope:** Everything needed between development freeze and AppStore/PlayStore submission

---

## 📋 Quick Navigation

- [Overview: What is "Production Stage"?](#overview-production-stage)
- [Phase 1: Infrastructure Setup (Week 1)](#phase-1-infrastructure-setup-week-1)
- [Phase 2: Security & Compliance (Week 1-2)](#phase-2-security--compliance-week-1-2)
- [Phase 3: Testing & QA (Week 2)](#phase-3-testing--qa-week-2)
- [Phase 4: Store Preparation (Week 2-3)](#phase-4-store-preparation-week-2-3)
- [Phase 5: CI/CD & Release Management (Week 3)](#phase-5-cicd--release-management-week-3)
- [Phase 6: Pre-Launch (Week 4)](#phase-6-pre-launch-week-4)
- [Go/No-Go Decision Matrix](#gonogo-decision-matrix)
- [Deployment Day Checklist](#deployment-day-checklist)

---

## 🎯 Overview: What is "Production Stage"?

### Definition

**Production Stage** = The period after feature development is frozen and before the app ships to public stores.

```
Development (continuous) → Code Freeze → Production Setup (THIS DOC) → Deployment → Maintenance
```

### Goals of This Stage

1. ✅ Ensure app is **stable** (crashes handled, performance optimized)
2. ✅ Ensure app is **secure** (credentials managed, data encrypted, APIs protected)
3. ✅ Ensure app is **compliant** (privacy policy, ToS, regional laws, healthcare regs if applicable)
4. ✅ Ensure app is **observable** (crashes tracked, performance monitored, users supported)
5. ✅ Ensure app is **releasable** (TestFlight works, store listings ready, team trained)
6. ✅ Ensure app is **rollback-capable** (hotfix strategy ready, previous builds archived)

### What This IS NOT

- ❌ Building new features (that's done)
- ❌ Major refactoring (too late)
- ❌ Breaking architecture changes (too risky)

### Timeline Pressure

This phase **cannot be skipped or rushed**. Cutting corners here = production disasters later.

**Realistic timeline:** 3-4 weeks for first production build  
**If you skip steps:** Expect 2-3 week delay post-launch fixing avoidable issues

---

## Phase 1: Infrastructure Setup (Week 1)

### 1.1 Third-Party Services (Most Critical)

These services handle revenue, crashes, and user health data. Set them up NOW, not on launch day.

#### A. RevenueCat (Payment Processing)

**Status in codebase:** Scaffolded (not installed)

**What needs to happen:**

```typescript
// 1. Install SDK
npm install react-native-purchases

// 2. Create RevenueCat account + project (https://app.revenuecat.com)

// 3. Configure AppStore + GooglePlay credentials in RevenueCat dashboard
// - Apple: App Store Connect credentials
// - Google: Play Console service account JSON

// 4. Define subscription offerings (in RevenueCat console, not code):
// Single tier, region-specific pricing with 14-day free trial:
// - Lesotho/Africa: $2.69/month, $24.21/year (10% off)
// - Europe: $6.29/month, $56.61/year (10% off)
// - USA/Canada: $8.99/month, $80.91/year (10% off)
// - China: TBD (configure per local market research)
// - Trial intro offer: 14 days free → then recurring charge

// 5. Test trial + purchases on TestFlight + Play Store internal testing:
// - Sandbox accounts need test credit card
// - Verify trial activates for 14 days (no charge)
// - Verify recurring charge on day 15
// - Test manual renewal (annual vs. monthly)
// - Verify receipts validate correctly
// - Test regional pricing (toggle device region in simulator)

// 6. Wire up in code:
export class RevenueCatService {
  async initialize(apiKey: string) {
    await Purchases.configure({ 
      apiKey,
      observerMode: false,
    });
  }

  async handlePurchaseResult(package: Package) {
    try {
      const result = await Purchases.purchasePackage(package);
      // Validate on backend (if backend exists)
      await validateReceipt(result.productIdentifier);
      return { success: true, entitlement: 'premium' };
    } catch (error) {
      logger.error('Purchase failed', error);
      return { success: false };
    }
  }
}

// 7. Create paywall screen (production-ready):
export function PaywallScreen() {
  const [offerings, setOfferings] = useState(null);

  useEffect(() => {
    async function loadOfferings() {
      const offerings = await Purchases.getOfferings();
      setOfferings(offerings);
      analytics.trackEvent('paywall_viewed');
    }
    loadOfferings();
  }, []);

  return (
    <SafeAreaView>
      {offerings?.current?.availablePackages.map((pkg) => (
        <PremiumTier 
          key={pkg.identifier}
          tier={pkg}
          onPurchase={(pkg) => RevenueCatService.handlePurchaseResult(pkg)}
        />
      ))}
    </SafeAreaView>
  );
}
```

**Effort:** 2-3 days (SDK setup + testing)

**Checklist:**
- [ ] RevenueCat account created
- [ ] Apple credentials uploaded to RevenueCat
- [ ] Google credentials uploaded to RevenueCat
- [ ] Subscriptions configured in RevenueCat console
- [ ] Test purchase successful on TestFlight
- [ ] Test purchase successful on Play Store internal testing
- [ ] Webhooks configured (purchase/cancel/refund events)
- [ ] Error handling in place (network failures, permission errors, duplicate purchase)
- [ ] Analytics events tracked (paywall view, purchase, cancel)
- [ ] Fallback login screen (if RevenueCat unavailable, show cached subscription status)

**Risks:**
- App rejected if paywall copy suggests you're evading AppStore fees
- Sandbox vs. production credentials mixed → purchases work in testing but fail in production
- Receipt validation fails if device is offline

---

#### B. Sentry (Crash & Performance Monitoring)

**Status in codebase:** Not installed

**What needs to happen:**

```bash
# 1. Install
npm install @sentry/react-native

# 2. Create Sentry project (https://sentry.io)
# - Create org + project for "FitQuest"
# - Choose "React Native" platform
# - Get DSN (project ID)

# 3. Configure in expo app
export default {
  plugins: [
    "@sentry/react-native/expo",
    {
      organization: "fitquest",
      project: "fitquest-mobile",
      url: "https://sentry.io",
    },
  ],
}

# 4. Initialize in app code:
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: "https://YOUR_DSN@sentry.io/PROJECT_ID",
  tracesSampleRate: __DEV__ ? 1.0 : 0.1, // 10% in production
  environment: __DEV__ ? "development" : "production",
  attachStacktrace: true,
  maxBreadcrumbs: 100,
  integrations: [
    new Sentry.ReactNativeTracing(),
    new Sentry.Replay({
      maskAllText: true,
      maskAllImages: true,
    }),
  ],
  beforeSend(event, hint) {
    // Sanitize sensitive data before sending
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers['Authorization'];
    }
    return event;
  },
});

# 5. Set up Slack notifications in Sentry
# - New issue created → Slack alert
# - Regressed issue → Slack alert
# - Custom metrics → Slack alert
```

**Effort:** 1-2 days (setup + testing)

**Checklist:**
- [ ] Sentry account + project created
- [ ] DSN copied to app secrets
- [ ] Sentry SDK initialized in app entry point
- [ ] Test crash event (throw error in component, verify in Sentry dashboard)
- [ ] Performance monitoring enabled (transaction tracking)
- [ ] Session replay enabled (masked for privacy)
- [ ] Slack notifications configured
- [ ] On-call rotation assigned (who gets paged if critical crash?)
- [ ] Error budget defined (e.g., "alert if >0.5% crash rate")
- [ ] Source maps uploaded (for readable stack traces)

**Risks:**
- SDK overhead could impact app startup time (profile it)
- Session replay uses ~5% battery (document this)
- Sensitive health data could leak in Sentry logs (sanitize aggressively)

---

#### C. Email Service (User Communications)

**Status in codebase:** Not set up

**What needs to happen:**

```typescript
// Choose: SendGrid, Mailgun, or AWS SES (all ~$20/mo for startup volume)
// Recommendation: SendGrid (easiest, good docs)

import sgMail from '@sendgrid/mail';

export class EmailService {
  static initialize(apiKey: string) {
    sgMail.setApiKey(apiKey);
  }

  static async sendWelcomeEmail(userEmail: string) {
    await sgMail.send({
      to: userEmail,
      from: 'noreply@fitquest.app',
      subject: 'Welcome to FitQuest - 14 Days Free',
      html: `
        <h1>Welcome to FitQuest!</h1>
        <p>We're excited to help you reach your fitness goals.</p>
        <p>You have 14 days free to try everything. After that, choose to subscribe or stop.</p>
        <p>No credit card needed yet.</p>
        <a href="https://fitquest.app/app">Open App & Start Workout</a>
      `,
    });
  }

  static async sendTrialExpiringEmail(userEmail: string, expiresInDays: number) {
    await sgMail.send({
      to: userEmail,
      from: 'hello@fitquest.app',
      subject: `Your FitQuest trial expires in ${expiresInDays} days`,
      html: `
        <h1>Your 14-day trial is almost over</h1>
        <p>You have ${expiresInDays} day(s) remaining to try FitQuest for free.</p>
        <p>When your trial ends, subscribe to keep training. Choose monthly ($2.69-8.99) or annual ($24.21-80.91).</p>
        <a href="https://fitquest.app/upgrade">Choose Your Plan</a>
      `,
    });
  }

  static async sendSubscriptionStartedEmail(userEmail: string, plan: 'monthly' | 'annual', price: string) {
    await sgMail.send({
      to: userEmail,
      from: 'hello@fitquest.app',
      subject: `Welcome to FitQuest Premium - ${plan} subscription`,
      html: `
        <h1>Thank you for subscribing!</h1>
        <p>You now have full access to FitQuest Premium.</p>
        <p>Plan: ${plan === 'monthly' ? 'Monthly (' + price + ')' : 'Annual (' + price + ', saves 10%)'}.</p>
        <p>Renews automatically. Cancel anytime in app settings.</p>
        <a href="https://fitquest.app/app">Go Back to Training</a>
      `,
    });
  }

  static async sendCancellationEmail(userEmail: string) {
    await sgMail.send({
      to: userEmail,
      from: 'hello@fitquest.app',
      subject: 'We hate to see you go',
      html: `
        <h1>Your subscription was cancelled</h1>
        <p>We'd love to know why. Hit reply and tell us!</p>
      `,
    });
  }
}
```

**Effort:** 1 day (setup + templates)

**Checklist:**
- [ ] Email service account created (SendGrid recommended)
- [ ] API key stored in secrets (not in code)
- [ ] Email templates created (welcome, purchase, cancellation, support)
- [ ] DKIM/SPF configured (so emails don't go to spam)
- [ ] Unsubscribe link in all marketing emails (legal requirement)
- [ ] Spam tested (send yourself an email, check spam folder)
- [ ] Daily send limit understood (avoid throttling)

---

#### D. Analytics (User Behavior Tracking)

**Status in codebase:** Partial (Firebase scaffolded)

**Choice 1: Firebase Analytics (Free, recommended for bootstrap)**

```typescript
import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "YOUR_KEY",
  projectId: "fitquest-prod",
  appId: "YOUR_APP_ID",
  // ... other config
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Track key events
logEvent(analytics, 'workout_completed', {
  userId: user.id,
  duration: 30,
  exerciseCount: 5,
  xpGained: 100,
});

logEvent(analytics, 'premium_converted', {
  userId: user.id,
  tier: 'standard',
  price: 4.99,
});
```

**Choice 2: Mixpanel (Better UX analytics, $200+/mo)**

```typescript
import Mixpanel from 'react-native-mixpanel';

Mixpanel.sharedInstance().initWithToken('YOUR_TOKEN');

Mixpanel.sharedInstance().trackEvent('workout_completed', {
  userId: user.id,
  duration: 30,
  exerciseCount: 5,
  xpGained: 100,
});
```

**Recommendation:** Start with Firebase (free), upgrade to Mixpanel if needed.

**Effort:** 1 day (setup + key event instrumentation)

**Checklist:**
- [ ] Analytics account + project created
- [ ] API key/token stored in secrets
- [ ] Key events instrumented (workout, purchase, crash, session)
- [ ] User properties tracked (OS, app version, tier)
- [ ] Do-not-track respected (if user opts out)
- [ ] Personally identifiable info (PII) NOT logged (anonymize user IDs)
- [ ] Dashboard created (daily revenue, DAU, retention)
- [ ] Alerts configured (DAU drops >20%, revenue drops >30%)

---

### 1.2 Environment Variables & Secrets

**What needs to happen:**

Create a secrets management system so API keys aren't hardcoded.

```bash
# 1. Create .env.production file (GITIGNORE this file!)
SENTRY_DSN=https://abc123@sentry.io/456
REVENUCAT_API_KEY=rcbp_prod_abc123xyz
SENDGRID_API_KEY=SG.abc123xyz
FIREBASE_PROJECT_ID=fitquest-prod
FIREBASE_API_KEY=AIzaSyD...
MIXPANEL_TOKEN=abc123xyz (if using Mixpanel)
ENVIRONMENT=production
APP_VERSION=1.0.0

# 2. In app initialization, load these securely
import { config } from '@react-native-firebase/config';

export const AppConfig = {
  SENTRY_DSN: process.env.SENTRY_DSN,
  REVENUCAT_API_KEY: process.env.REVENUCAT_API_KEY,
  // ... etc
};

// 3. For EAS builds, use EAS Secrets (not env files)
eas secret:create --scope project --name REVENUCAT_API_KEY --value "rcbp_prod_..."
eas secret:create --scope project --name SENTRY_DSN --value "https://..."

# 4. Reference in app.json
{
  "build": {
    "production": {
      "env": {
        "SENTRY_DSN": "@SENTRY_DSN",
        "REVENUCAT_API_KEY": "@REVENUCAT_API_KEY",
      }
    }
  }
}
```

**Effort:** 0.5 day (setup + audit)

**Checklist:**
- [ ] All API keys in environment variables (not code)
- [ ] `.env.production` added to `.gitignore`
- [ ] EAS Secrets configured for each key
- [ ] Separate dev/staging/prod credentials
- [ ] Credentials rotated every 90 days (document in calendar)
- [ ] Audit log of who accessed which secrets (EAS console)
- [ ] Credentials not in git history (verify with `git log -S "key" -- app.json`)

**Risk:**
- If credentials leak in git history, revoke immediately + regenerate

---

## Phase 2: Security & Compliance (Week 1-2)

### 2.1 Data Security (CRITICAL)

#### A. Encryption Setup (Already Done in Code)

**Status:** AES-256-GCM v3 already implemented in `src/security/AESEncryption.ts`

**Verification checklist:**
- [ ] Verify v3 AES-256-GCM is default (not v1/v2)
- [ ] Test: Health data encrypted at rest
- [ ] Test: AI conversations encrypted at rest
- [ ] Test: Encryption keys NOT logged to console
- [ ] Test: Decryption fails with wrong key (correct behavior)
- [ ] Verify master key is derived from password (not hardcoded)

#### B. SecureStore Configuration

```typescript
// Verify in src/security/StorageMigration.ts:
import * as SecureStore from 'expo-secure-store';

export async function secureStoreSensitiveData(key: string, value: string) {
  // Check: Are we using SecureStore correctly?
  if (typeof value === 'string' && value.length > 2048) {
    // iOS Keychain max: 4KB, Android Keystore: can be larger
    // If value too large, store in SQLite encrypted instead
    logger.warn('Value too large for SecureStore', { key, size: value.length });
  }
  
  await SecureStore.setItemAsync(key, value);
}

// Test secure storage:
// 1. Store a secret
// 2. Uninstall app
// 3. Data should be GONE (not accessible by other apps)
```

**Effort:** 1 day (verification + testing)

**Checklist:**
- [ ] Verify all sensitive data encrypted at rest (health, credentials, tokens)
- [ ] Verify encryption keys stored in SecureStore (not SharedPreferences/UserDefaults)
- [ ] Test: Data persists after app restart
- [ ] Test: Data NOT accessible if app uninstalled + reinstalled
- [ ] Test: Data NOT accessible by other apps on device
- [ ] Document encryption: what data uses which algorithm
- [ ] Create incident response plan: "If master key compromised, what do we do?"

---

#### C. API Communication (TLS/HTTPS)

**Status:** Expo enforces HTTPS by default (good)

**Verification:**

```typescript
// 1. Verify no hardcoded HTTP URLs (except localhost for dev)
// Find all fetch() calls and ensure https://

// 2. Test certificate pinning (for sensitive RevenueCat calls)
import { fetch as fetchWithCert } from 'expo-certificate-pinning';

const pinnedDomains = {
  'api.revenuecat.com': ['sha256/...'], // certificate hash
};

// Risk: If cert rotates and you pinned old cert, app breaks until update
// Mitigation: Pin multiple certificates (active + backup)

// 3. Verify headers don't leak tokens
const headers = {
  'Content-Type': 'application/json',
  // ❌ DON'T DO: 'Authorization': 'Bearer token-here' in headers
  // ✅ DO: Use SecureStore, include in request body encrypted
};
```

**Effort:** 0.5 day (audit + testing)

**Checklist:**
- [ ] All external API calls use HTTPS (no HTTP)
- [ ] No API keys/tokens in request headers (use body + encryption)
- [ ] Certificate pinning considered (if high-security app)
- [ ] Proxy certificate intercepted test (verify app rejects MITM proxy)

---

### 2.2 Privacy & Legal (CRITICAL FOR APP STORE)

#### A. Privacy Policy (Required by AppStore)

**Where to create:** Use generator (privacypolicygenerator.com) or lawyer

```markdown
# Privacy Policy for FitQuest

**Effective Date:** March 9, 2026

## 1. Data We Collect
- Workout data (exercise, reps, duration)
- Health data (steps, heart rate, sleep)
- Account data (email, password)
- Device identifiers (IDFA for analytics)

## 2. How We Use Your Data
- To provide personalized workouts
- To track progress
- To improve the app
- To send notifications
- To calculate revenue (RevenueCat)

## 3. Data We Share
- Health data: Synced to HealthKit/Health Connect (with permission)
- Analytics: Firebase (anonymized)
- Payments: RevenueCat (encrypted)
- Crashes: Sentry (with sensitive fields removed)

## 4. Data Retention
- Workout history: Until you delete
- Health data: Until you delete
- Crash logs: 30 days (Sentry auto-delete)
- Server backups: 90 days

## 5. Data Deletion
User can request deletion of all personal data via [email]

## 6. Third-Party Services
- RevenueCat: Payment processing
- Sentry: Crash monitoring
- Firebase: Analytics
- HealthKit/Health Connect: Health data sync

## 7. GDPR / CCPA
- We comply with GDPR (EU users)
- We comply with CCPA (California users)
- We comply with PIPEDA (Canada users)

## Contact
privacy@fitquest.app
```

**Where to host:** In-app accessibility (Settings → Privacy Policy) + website

**Effort:** 2 hours (using template) or 1-2 days (lawyer review)

**Checklist:**
- [ ] Privacy policy covers all data collection
- [ ] Privacy policy covers all third parties (RevenueCat, Sentry, etc.)
- [ ] Privacy policy includes data deletion instructions
- [ ] Privacy policy includes contact email
- [ ] Privacy policy includes GDPR/CCPA compliance statements
- [ ] Linked prominently in app (Settings, and at signup)
- [ ] Lawyer reviewed (if possible)

---

#### B. Terms of Service (Required by AppStore)

```markdown
# Terms of Service for FitQuest

**Last Updated:** March 9, 2026

## 1. Agreement to Terms
By downloading and using FitQuest, you agree to these terms.

## 2. License Grant
We grant you a limited, non-exclusive license to use FitQuest for personal use.

## 3. Restrictions
You agree NOT to:
- Reverse engineer the app
- Copy/redistribute the app
- Use it for commercial purposes
- Circumvent payment (jailbreak, etc.)

## 4. Disclaimer of Warranties
FitQuest is provided "as-is" without warranties. We are NOT liable for:
- Fitness injuries
- Health problems
- Data loss
- Errors in workouts

## 5. Liability Limitation
Our total liability is limited to amounts you paid us.

## 6. Indemnification
You agree to indemnify us for any third-party claims.

## 7. Modifications
We may modify these terms with 30 days notice.

## 8. Governing Law
These terms are governed by [your jurisdiction].

## Contact
legal@fitquest.app
```

**Effort:** 2 hours (template) or 1-2 days (lawyer review)

**Checklist:**
- [ ] Terms of Service drafted
- [ ] Medical disclaimer included (IMPORTANT: FitQuest doesn't replace doctors)
- [ ] Limitation of liability clear
- [ ] Subscription terms explained
- [ ] Refund/cancellation policy explained
- [ ] Linked in app (Settings, and at signup)
- [ ] Lawyer reviewed (strongly recommended)

---

#### C. Medical Disclaimer (CRITICAL FOR HEALTH APPS)

```
⚠️ DISCLAIMER

FitQuest is a personal fitness app. It is NOT:
- A substitute for medical advice
- A replacement for consulting a doctor
- Appropriate for people with injuries or medical conditions

Please consult a healthcare provider before starting any fitness program.

If you experience chest pain, dizziness, or shortness of breath STOP immediately and seek medical attention.
```

**Where to display:** 
- Startup (on app first launch)
- Settings page
- Before first workout
- In privacy policy

**Effort:** 0.5 day (legal template)

**Checklist:**
- [ ] Medical disclaimer placed at app startup
- [ ] Users must acknowledge before proceeding
- [ ] Language is clear and cannot be missed
- [ ] Lawyer reviewed (especially if app has AI health features)

---

### 2.3 Regional Compliance

#### A. GDPR Compliance (For EU Users)

**Applies if:** Anyone from EU can download the app (they can, so implement this)

```typescript
// 1. Implement right-to-be-forgotten
export async function requestDataDeletion(userId: string) {
  // Delete user data from:
  // - SQLite (local device)
  // - RevenueCat (if applicable)
  // - Sentry (request support ticket)
  // - Analytics (anonymize)
  
  await db.deleteUser(userId);
  await RevenueCat.deleteUser(userId);
}

// 2. Implement data export (user can download their data)
export async function exportUserData(userId: string) {
  const userData = {
    profile: await db.getUserProfile(userId),
    workouts: await db.getWorkoutHistory(userId),
    health: await db.getHealthData(userId),
    subscription: await RevenueCat.getSubscription(userId),
  };
  return JSON.stringify(userData);
}

// 3. Get explicit consent before collecting data
export function DataConsentScreen() {
  const [consentGiven, setConsentGiven] = useState(false);
  
  return (
    <>
      <Text>We need your consent to:
        - Track your workouts
        - Access health data
        - Send notifications
      </Text>
      <Checkbox 
        label="I agree to FitQuest terms"
        value={consentGiven}
        onChange={setConsentGiven}
      />
      <Button
        title="Accept"
        disabled={!consentGiven}
        onPress={acceptConsent}
      />
    </>
  );
}
```

**Effort:** 1-2 days (implementation + testing)

**Checklist:**
- [ ] Data deletion endpoint implemented
- [ ] Data export feature implemented
- [ ] Consent screen implemented (can't proceed without consent)
- [ ] GDPR page linked in settings
- [ ] Privacy policy mentions GDPR rights
- [ ] Legal review of compliance

---

#### B. CCPA Compliance (For California Users)

Similar to GDPR (data deletion, export, consent tracking).

**Effort:** 1 day (mostly reuses GDPR code)

---

### 2.4 Security Audit

**Before deploying to production, run this audit:**

```bash
# 1. Dependency audit (check for CVEs)
npm audit
npm audit fix

# 2. Secret scanning (make sure no passwords in git)
npm install -g detect-secrets
detect-secrets scan

# 3. Code scanning (Snyk or GitHub security)
snyk test

# 4. Permission audit (verify only necessary permissions)
# iOS: Check NSLocalizedDescription for all permissions in Info.plist
# Android: Check <uses-permission> in AndroidManifest.xml

# 5. Certificate validation
# Verify all API URLs use valid HTTPS certificates
```

**Effort:** 0.5 day

**Checklist:**
- [ ] npm audit shows 0 critical/high vulnerabilities
- [ ] No credentials found in git history
- [ ] No unnecessary permissions requested
- [ ] All API endpoints use HTTPS
- [ ] SSL certificates valid (not expired)

---

## Phase 3: Testing & QA (Week 2)

### 3.1 Testing Strategy

#### A. Unit Tests

**Status:** 95 Vitest tests already exist

**What needs to happen:**

```bash
# 1. Run full test suite
npm run test

# 2. Verify coverage >80% for critical paths
npm run test -- --coverage

# 3. Fix any failing tests (should be 0 failures)

# 4. Run in CI (on every commit)
# GitHub Actions or similar
```

**Checklist:**
- [ ] 0 test failures
- [ ] Coverage >80% for: engines, security, database, services
- [ ] Coverage >50% for: components, screens (acceptable, UI changes often)
- [ ] CI configured to run tests on every push

---

#### B. Integration Tests

**Status:** Not written yet (optional but recommended)

**What to test:**
```typescript
// Example: RevenueCat integration test
describe('RevenueCat Integration', () => {
  it('handles successful purchase', async () => {
    const result = await RevenueCatService.purchasePremium();
    expect(result.success).toBe(true);
    expect(result.entitlement).toBe('premium');
  });

  it('handles purchase failure gracefully', async () => {
    const result = await RevenueCatService.purchasePremium();
    // User cancelled or payment failed
    expect(result.success).toBe(false);
  });
});

// Example: Health data encryption test
describe('Data Encryption', () => {
  it('encrypts and decrypts health data', async () => {
    const data = { heartRate: 72, timestamp: Date.now() };
    const encrypted = await encryptV3(JSON.stringify(data));
    const decrypted = await decryptV3(encrypted);
    expect(JSON.parse(decrypted)).toEqual(data);
  });
});
```

**Effort:** 2-3 days (write 10-15 critical integration tests)

**Checklist:**
- [ ] RevenueCat purchase flow tested
- [ ] Payment failure handled
- [ ] Health data sync tested (if using HealthKit)
- [ ] Crash reporting tested
- [ ] Network failure handled
- [ ] Offline mode tested
- [ ] Database migration tested (upgrade from v0 → v15)

---

#### C. E2E Tests (Detox)

**Status:** Not set up yet (very recommended for production apps)

**Example flow to test:**

```typescript
describe('Onboarding → Workout → Premium Conversion Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should complete full user journey', async () => {
    // 1. Sign up
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('TestPassword123!');
    await element(by.id('signup-button')).tap();
    
    // Wait for onboarding
    await waitFor(element(by.text('Select Your Goal')))
      .toBeVisible()
      .withTimeout(5000);
    
    // 2. Generate workout
    await element(by.id('generate-button')).tap();
    
    // 3. Start workout
    await element(by.text('Start Workout')).tap();
    
    // 4. Trigger paywall
    await element(by.id('unlock-advanced-button')).tap();
    await expect(element(by.text('$4.99/month'))).toBeVisible();
    
    // 5. Cancel (don't purchase in test)
    await element(by.id('paywall-close')).tap();
  });
});
```

**Effort:** 2-3 days (Detox setup + 5 critical flows)

**Checklist:**
- [ ] E2E framework (Detox) set up
- [ ] 5+ critical user flows tested
- [ ] Tests run on CI (every commit)
- [ ] Flaky tests fixed (tests should be deterministic)
- [ ] Test environment isolated (doesn't affect production data)

---

### 3.2 Device Testing

**Test on real devices (not just emulator):**

| Device | OS | Status |
|--------|-----|--------|
| iPhone 14+  | iOS 17+ | 🟢 Primary target |
| iPhone SE   | iOS 15+ | 🟡 Min supported |
| Pixel 7+    | Android 13+ | 🟢 Primary target |
| Galaxy S21+ | Android 12+ | 🟡 Common device |
| Pixel 6a    | Android 12  | 🟡 Budget device |

**Test matrix:**
```
✅ Sign up & login
✅ Generate workout (all difficulties)
✅ Complete workout (all exercise types)
✅ View health data + progress
✅ Trigger paywall + cancel
✅ Access settings + profile
✅ Dark mode + light mode
✅ Low-battery mode (if applicable)
✅ Low-connectivity mode (LTE, 3G)
✅ App background + relaunch
✅ Notifications enabled/disabled
✅ Permissions granted/denied
```

**Effort:** 2 days (full device farm test)

**Checklist:**
- [ ] App starts without crashes on all devices
- [ ] Screens render correctly (no cut-off text, proper spacing)
- [ ] Touch targets are large enough (min 44pt iOS, 48dp Android)
- [ ] Performance acceptable (<2s load time, smooth 60fps)
- [ ] Battery drain acceptable (<10% per hour active use)
- [ ] Memory usage acceptable (<200MB)
- [ ] Network requests complete under 3G
- [ ] No layout issues in landscape mode

---

### 3.3 Performance Testing & Optimization

#### A. Startup Time

**Target:** <2 seconds (50th percentile)

```typescript
// Add timing instrumentation
const startTime = performance.now();

// ... app initialization code ...

const endTime = performance.now();
console.log(`App login startup: ${endTime - startTime}ms`);

// Log to analytics
analytics.trackEvent('app_startup_time', { 
  duration: endTime - startTime 
});
```

**Optimization if needed:**
- Lazy load screens (Expo.Router automatic)
- Defer non-critical initialization
- Cache user data (so don't re-fetch on startup)
- Profile with RN DevTools

**Checklist:**
- [ ] Measured startup time (multiple devices)
- [ ] <2s on iPhone 12+
- [ ] <3s on Pixel 6
- [ ] <5s on mid-range devices
- [ ] Startup metrics logged to analytics

---

#### B. Runtime Performance

**Benchmark key operations:**

| Operation | Target | Current |
|-----------|--------|---------|
| Generate workout | <500ms | ? |
| Load exercise list | <100ms | ? |
| Calculate health score | <200ms | ? |
| Process 1Hz sensor data | <50ms per sample | ? |
| Render 100-item list | <16ms frame | ? |

**Measure:**

```typescript
function measurePerformance(label: string, fn: () => void) {
  const start = performance.now();
  fn();
  const duration = performance.now() - start;
  console.log(`${label}: ${duration.toFixed(2)}ms`);
  
  if (duration > THRESHOLDS[label]) {
    console.warn(`⚠️ ${label} exceeded target`);
  }
}

measurePerformance('Workout generation', () => {
  workoutGenerator.generateWorkout(...);
});
```

**Checklist:**
- [ ] All key operations measured
- [ ] Operations within targets or optimized
- [ ] No memory leaks (heap size stable over time)
- [ ] No frame drops (smooth 60fps scrolling)

---

### 3.4 Battery & Network Tests

#### A. Battery Profile

**Test:**
```
1. Launch app
2. Use app for 30 minutes (generate, complete workout)
3. Leave running in background for 1 hour
4. Check: Did battery drain >10%?
```

**Checklist:**
- [ ] Battery drain <10% per hour active use
- [ ] Battery drain <1% per hour background
- [ ] No excessive wakeups (check Settings → Battery Health)
- [ ] Background tasks throttled appropriately

---

#### B. Network Conditions

**Use Xcode's network link conditioner or Android Studio's Network Throttler:**

```
Conditions to test:
- WiFi (fast)
- LTE (medium)
- 3G (slow)
- Offline (no connectivity)
- Fluctuating (WiFi → cell → WiFi)
```

**Checklist:**
- [ ] App handles offline gracefully (cached data displayed)
- [ ] Slow network doesn't crash app
- [ ] Network timeouts handled (retry w/ exponential backoff)
- [ ] Large data load (e.g., 500 workouts) doesn't hang UI

---

## Phase 4: Store Preparation (Week 2-3)

### 4.1 App Store Connect (iOS)

**What needs to happen:**

```
1. Create Apple Developer account (~$99/year)
   - Register company or individual
   - Get Apple ID + password
   - Set up 2FA

2. Create App on App Store Connect
   - BundleID: com.vibecoding.fitquest (or similar)
   - App name: FitQuest
   - Primary language: English
   - Content rating (complete survey):
     - Is app for kids? No
     - Medical info to kids? No
     - Unreviewed UGC? No
     - Etc.

3. Create app screenshots+metadata
   - 5-7 screenshots (iPhone 6.7" 2796x1290)
   - Screenshot 1: "Generate Personalized Workouts"
   - Screenshot 2: "Real-Time Form Coaching"
   - Screenshot 3: "Track Progress & Recovery"
   - etc.
   
   Format: PNG, show main features with text overlay

4. Write app description:
   "FitQuest is your AI-powered personal fitness coach.
   
   ✓ 788+ Exercise Library
   ✓ Personalized Workouts
   ✓ Real-Time Form Feedback
   ✓ Automatic Health Sync
   ✓ Progress Tracking
   ✓ Offline Ready
   
   Join thousands of users transforming their fitness."
   
   Keyword tags: fitness, workouts, AI, health, gym
   Support URL: https://support.fitquest.app
   Privacy policy: https://fitquest.app/privacy

5. Select app icon
   - 1024x1024 PNG (solid background, no transparency issues)
   - Should be recognizable at 12pt size

6. Version Release Notes
   "v1.0.0 Beta
   - Initial release of FitQuest
   - 788+ exercise library
   - AI-powered workout generation
   - Real-time form coaching (iOS 17+)
   - Health app integration
   - Premium subscription ($4.99-$9.99/month)"

7. Build settings
   - Minimum iOS: 14.0 or higher
   - Target architecture: arm64 (no 32-bit)
   - Supported devices: iPhone only (or add iPad)
```

**Effort:** 2-3 days (screenshots, copywriting, metadata)

**Checklist:**
- [ ] Developer account created
- [ ] App registered in App Store Connect
- [ ] Bundle ID matches Expo config
- [ ] Screenshots uploaded (5-7 minimum)
- [ ] App description compelling + accurate
- [ ] Keywords optimized for searchability
- [ ] Icon uploaded (1024x1024)
- [ ] Privacy policy URL provided
- [ ] Support email provided
- [ ] Content rating completed
- [ ] Contact info provided
- [ ] Version notes written

---

### 4.2 Google Play Console (Android)

**Similar process to App Store:**

```
1. Create Google Play Developer account (~$25 one-time)

2. Create app on Google Play Console
   - App name: FitQuest
   - Package name: com.vibecoding.fitquest
   - App category: Health & Fitness

3. Create store listing
   - Short description: "AI-Powered Fitness Coach"
   - Full description: (same as iOS, adjusted for length)
   - Screenshots: 4-8 (min 1080x1920 for phones)
   - App icon: 512x512 PNG
   - Feature graphic: 1024x500 PNG
   - Promotional video: (optional, YouTube link)

4. Content rating
   - Complete Google Play questionnaire (similar to Apple)

5. Pricing & distribution
   - Price: Free (revenu via in-app purchases)
   - Countries: All (or select specific)
   - Requires Google Play Services: Yes (if using Firebase)

6. Release notes same as iOS
```

**Effort:** 1-2 days (screenshots, copywriting)

**Checklist:**
- [ ] Developer account created
- [ ] App registered in Google Play Console
- [ ] Package name matches Expo config
- [ ] Screenshots uploaded (4-8 minimum)
- [ ] App description accurate
- [ ] Icon + feature graphics uploaded
- [ ] Content rating completed
- [ ] Pricing set to free (revenue via IAP)
- [ ] Target countries selected

---

### 4.3 Build Artifacts & Signing

#### A. iOS (ipa file)

**Generated via EAS:**

```bash
# 1. Ensure iOS build credentials are configured
eas credentials

# 2. Build for App Store submission
eas build --platform ios --auto-submit

# OR: Build without auto-submit for manual review
eas build --platform ios

# 3. Upload to App Store Connect
# EAS can auto-submit to TestFlight

# 4. Verify in App Store Connect
#    - Build status should show "Processing"
#    - Wait 5-15 min, then "Ready for Testing"
#    - Approve release to public
```

**Checklist:**
- [ ] iOS build credentials configured
- [ ] Build completes without errors
- [ ] Build successfully uploads to App Store Connect
- [ ] Build status transitions to "Ready for Testing"

---

#### B. Android (aab file)

**Generated via EAS:**

```bash
# 1. Ensure Android build credentials configured
eas credentials

# 2. Build for Play Store submission
eas build --platform android

# 3. Download .aab file (Android App Bundle)

# 4. Upload to Google Play Console
#    - Internal Testing track (first release)
#    - Wait for processing (~30 min)
#    - Then promote to Beta or Production

# 5. Verify in Google Play Console
#    - Build status should show "Processing"
#    - Wait 30-60 min, then "Ready for Review"
```

**Checklist:**
- [ ] Android build credentials configured
- [ ] Build completes without errors
- [ ] .aab file successfully uploads
- [ ] Build appears in Google Play Console

---

### 4.4 App Store Review Preparation

**Apple & Google have strict review criteria. Prepare for these questions:**

| Topic | Answer | Evidence |
|-------|--------|----------|
| Does app do what description says? | Yes (workouts, AI, etc) | Screenshots + metadata match |
| Does app collect sensitive data? | Yes (health) | Privacy policy clear |
| Does app have privacy controls? | Yes (delete data, opt-out) | Test privacy features work |
| Is there misleading marketing? | No | Avoid fake testimonials |
| Does app work on iOS 14+? | Yes | Tested on min OS version |
| Does app handle payments correctly? | Yes (RevenueCat) | Purchase flow works |
| Is free tier properly identified? | Yes (50 workouts/month) | Paywall explains limits |
| Does app respect parental controls? | Yes (age 13+) | Content appropriate |

**Potential rejection reasons (avoid these):**

❌ App crashes on startup  
❌ Payment system doesn't work  
❌ Screenshots don't match functionality  
❌ Privacy policy missing or vague  
❌ Medical claims without backing (e.g., "10% weight loss guaranteed")  
❌ High crash rate detected by Apple  
❌ App requests unnecessary permissions  
❌ VPN/proxy detection (app rejects users on VPN)  

**Checklist:**
- [ ] All screenshots match actual app features
- [ ] Privacy policy clearly describes data collection
- [ ] Medical claims qualified ("may help," not "will cure")
- [ ] No references to "beta" or "experimental" in public listing
- [ ] Support email actively monitored
- [ ] TestFlight build tested thoroughly before submission

---

## Phase 5: CI/CD & Release Management (Week 3)

### 5.1 Automated Build Pipeline

**Set up GitHub Actions (or similar) to:**

1. **Run on every push to main:**
   - Run unit tests
   - Run linting
   - Build APK/IPA
   - Check for security issues

2. **Example GitHub Actions workflow:**

```yaml
# .github/workflows/build.yml
name: Build & Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm audit
  
  build-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: eas build --platform ios --auto-submit
      
      env:
        EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
        EAS_BUILD_PROFILE: production

  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: eas build --platform android
      
      env:
        EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
        EAS_BUILD_PROFILE: production
```

**Effort:** 1 day (setup + testing)

**Checklist:**
- [ ] GitHub Actions workflow created
- [ ] Workflow runs on every push
- [ ] Tests must pass before merging
- [ ] Linting enforced
- [ ] Build artifacts generated
- [ ] Notifications sent (Slack/email) on failure

---

### 5.2 Release Strategy

**Define how you release updates:**

```
Versioning: Semantic (MAJOR.MINOR.PATCH)
  - v1.0.0 (first public release)
  - v1.0.1 (hotfix for crash)
  - v1.1.0 (new features: health sync)
  - v2.0.0 (major redesign: backend launch)

Release tracks:
  1. Internal Testing (team only, unlimited submissions)
  2. Beta (TestFlight/Google Play, limited testers)
  3. Production (public release, goes to all users)

Release process:
  Day 1: Code freeze, version bump
  Day 2: Build + internal testing
  Day 3: Deploy to beta (gather feedback, fix bugs)
  Day 4: Submit to app stores (Apple review: 1-2 days)
  Day 5: App stores release to public OR hotfix issues
  
Hot-fix strategy (if critical crash detected):
  1. Identify issue
  2. Fix + test locally
  3. Rev version to PATCH (v1.0.1)
  4. Build + immediately submit to app stores
  5. Target 24-hour fix (Apple review takes 1-2 days)
  6. New build available 48 hours after discovery

Rollback strategy (if app broken in production):
  1. Revert latest commit
  2. Build + submit hotfix v1.0.1 (if v1.0.0 broken)
  3. Tell users to update (via crash prompt)
  4. Monitor crash rates
  5. Post-mortem: "How do we prevent this?"
```

**Checklist:**
- [ ] Versioning strategy defined
- [ ] Release checklist created (step-by-step)
- [ ] Rollback procedure documented
- [ ] Team trained on release process
- [ ] Who's responsible for each step?
- [ ] Communication plan (inform users if critical update needed)

---

### 5.3 Monitoring Dashboard

**Set up dashboard to monitor app health 24/7 (post-launch):**

```
Sentry Dashboard:
  - Crash rate (alert if >0.5%)
  - Top 5 errors
  - Device/OS breakdown
  - Affected user count

RevenueCat Dashboard:
  - Subscription MRR
  - Conversion rate
  - Churn rate
  - Refunds

Firebase Analytics Dashboard:
  - DAU / MAU
  - Session length
  - Feature usage
  - Retention curves
  
Custom alert rules:
  - Crash rate >0.5% → Slack alert
  - Revenue drop >30% → Slack alert
  - DAU drop >20% → Slack alert
  - New critical error → Slack + page on-call
```

**Effort:** 1 day (setup)

**Checklist:**
- [ ] All dashboards linked/visible
- [ ] Alert thresholds configured
- [ ] Slack integrations set up
- [ ] On-call rotation assigned
- [ ] Daily standup reviews metrics

---

## Phase 6: Pre-Launch (Week 4)

### 6.1 Final Checklist (48 Hours Before Public Release)

```
FUNCTIONALITY:
☐ App starts without crash
☐ All screens tested on min OS (iOS 14, Android 12)
☐ All buttons/links work
☐ Forms validate correctly
☐ Notifications work
☐ Offline mode works
☐ Payments work (RevenueCat)

DATA:
☐ Database migrations tested (upgrade path works)
☐ Data persists after app restart
☐ No data lost on permission changes
☐ Selective sync works (if enabled)

SECURITY:
☐ No credentials in code
☐ API keys in environment variables
☐ HTTPS on all requests
☐ Sensitive data encrypted at rest
☐ No logs contain user data / tokens
☐ Biometric auth optional (not required)

PRIVACY/LEGAL:
☐ Privacy policy current (references all data collection)
☐ Terms of service agreed by users
☐ Medical disclaimer shown on startup
☐ GDPR delete/export working
☐ Contact email monitored

PERFORMANCE:
☐ Startup <2 seconds
☐ Smooth scrolling (60fps)
☐ Battery drain <10%/hour
☐ Memory usage <200MB
☐ No memory leaks

ANALYTICS:
☐ Crash tracking (Sentry) working
☐ Revenue tracking (RevenueCat) working
☐ User behavior tracking (Firebase) working
☐ Dashboards accessible
☐ Alerts configured

QA:
☐ Unit tests passing (0 failures)
☐ E2E tests passing (all user flows)
☐ Device testing complete (iPhone/Android)
☐ No regressions from last version
☐ Accessibility tested (dark mode, text size)

STORE LISTINGS:
☐ App Store screenshots final
☐ App Store description final + SEO keywords
☐ Google Play screenshots final
☐ Google Play description final + keywords
☐ Release notes written
☐ Icon + feature graphics uploaded

BUILDS:
☐ iOS ipa built + uploaded to App Store Connect
☐ Android aab built + uploaded to Google Play
☐ TestFlight build tested by team (minimum 3-5 testers)
☐ Internal testing build on Google Play tested
☐ No build warnings/errors

COMMUNICATION:
☐ Launch announcement drafted (social media, email)
☐ Press release written (if applicable)
☐ Support email monitored (team on standby)
☐ FAQ prepared (common questions)
☐ Rollback procedure tested

TEAM READINESS:
☐ Team trained on release process
☐ On-call rotation scheduled
☐ Incident response plan reviewed
☐ Post-launch standup scheduled (first week daily)
```

**Go/No-Go Meeting:**
- Team reviews checklist
- Go decision: All items checked, team confident
- No-Go decision: Identify blocking items, push launch by 1-2 days

---

### 6.2 Launch Communication

**Email to users (48 hours before, if you have list):**

```
Subject: FitQuest is Launching!

Dear Friends,

We're thrilled to announce FitQuest is launching on [date]!

What to expect:
✓ 788+ exercise library (all difficulty levels)
✓ AI-powered workout generation
✓ Real-time form coaching
✓ Automatic health syncing
✓ Progress tracking & analytics

Pricing:
- Free tier: 50 workouts/month
- Standard: $4.99/month (unlimited workouts)
- Elite: $9.99/month (AI coaching + advanced features)

Download on [date]:
🍎 iOS: https://apps.apple.com/...
🤖 Android: https://play.google.com/...

We can't wait to hear what you think!

Questions? Email us: support@fitquest.app

---
Team FitQuest
```

**Twitter threads (multiple posts):**

```
🚀 We're live! FitQuest just launched on iOS & Android.

788+ workouts. AI coaching. Zero equipment needed.

What makes us different:
1. AI that runs on your phone (not internet)
2. Real-time form feedback
3. Automatic recovery tracking

Download now → https://bit.ly/fitquest-ios

Also live on Android 🤖
https://bit.ly/fitquest-android
```

**Product Hunt (optional, high-impact):**
- Post on launch day
- Be responsive to questions (top posts get upvotes)
- Aim for top 10-20 products of the day

---

## Go/No-Go Decision Matrix

**Use this to decide if you're ready:**

```
Criterion                    | Weight | Status | Go/No-Go
---------------------------|--------|--------|----------
App crashes on startup     | 10x    | ❌ (critical) | NO-GO
Payment system working     | 10x    | ✅     | GO
Privacy policy completed   | 10x    | ✅     | GO
Unit tests passing         | 5x     | ✅     | GO
E2E tests passing          | 5x     | ⚠️ (90%) | CAUTION
Store listings ready       | 5x     | ✅     | GO
Support email monitored    | 3x     | ✅     | GO
Monitoring configured      | 3x     | ✅     | GO
Team trained              | 3x     | ⚠️ (needs review) | CAUTION
Launch comms ready        | 2x     | ✅     | GO

Decision:
- If any 10x criterion is NO-GO → STOP launch (fix first)
- If multiple 5x criteria are NO-GO → Delay 3-5 days (fix)
- If 2-3 items CAUTION → Review with team, likely OK to proceed
- Otherwise → GO ahead
```

---

## Deployment Day Checklist

**Day of public release:**

```
MORNING (6 hours before release):
☐ Final build tested one more time
☐ Store listings double-checked (no typos)
☐ Tea/coffee ready for team ☕
☐ On-call engineer ready

4 HOURS BEFORE:
☐ iOS app ready for release (in App Store Connect)
☐ Android app ready for release (in Google Play)
☐ Social media posts drafted + scheduled

2 HOURS BEFORE:
☐ Crash monitoring online & alerts configured
☐ Analytics dashboard refreshed
☐ Support email client open
☐ Slack status updated ("Launching FitQuest in 2 hours")

RELEASE TIME (T-0):
☐ Release iOS app (App Store Connect UI)
☐ Release Android app (Google Play Console)
☐ Post on social media (Twitter, Reddit, Product Hunt)
☐ Send email to users (if list available)
☐ Post on Discord/Slack communities

T+30 MIN:
☐ Monitor first downloads
☐ Check for immediate crashes
☐ Respond to early feedback

T+1 HOUR:
☐ Post first stats ("500 downloads!" etc.)
☐ Engage with early supporters
☐ Fix any critical bugs if found

T+4 HOURS:
☐ Review crash rate (target: <0.5%)
☐ Review revenue (first purchases)
☐ Celebrate with team 🎉

T+24 HOURS:
☐ Comprehensive metrics review
☐ Post-launch standup (daily for first week)
☐ Identify any issues for v1.0.1 hotfixes
```

---

## Post-Launch Operations (Week 1)

### Daily Standup (First Week)

```
Format: 15 min, same time each day

What to review:
1. Crash rate (Sentry)
   - Any new crashes? What's top error?
   - Action: Prioritize critical crashes

2. Revenue (RevenueCat)
   - MRR so far? Conversion rate?
   - Action: Is pricingworking or need adjustment?

3. User feedback
   - Reviews on app stores
   - Twitter mentions / Reddit threads
   - Most common complaint?

4. Metrics (Firebase Analytics)
   - DAU growing as expected?
   - Session length reasonable?
   - Any features not used?

5. Infrastructure health
   - Any API timeouts? Rate limiting?
   - Data sync working? No data loss?

6. Hotfix priority
   - Is v1.0.1 needed? What's in it?
   - Timeline for release?
```

### Response Time SLAs

```
Severity    | Definition                      | Response | Resolution
------------|--------------------------------|----------|----------
CRITICAL    | Crash on startup / no revenue  | <30 min  | <4 hours
HIGH        | Major feature broken           | <2 hours | <24 hours
MEDIUM      | Feature degraded but working   | <24 hours| <5 days
LOW         | Minor UI issue / typo          | <5 days  | <2 weeks
```

---

## Cross-Reference to Other Documents

**This document should be referenced in:**

1. **FITQUEST_BOOTSTRAP_ROADMAP.md**
   - Add link at "Phase 1: Revenue-First MVP (Days 4-21)" → "See Production Setup Guide for store submission"
   - Add link at "Phase 1.4 Days 15-17: App Store Release" → Full checklist in this document

2. **ENHANCEMENT_RESEARCH_COMPREHENSIVE_2026.md**
   - Add link at "Phase 4.2 Performance Monitoring" → See Production Setup for Sentry details
   - Add link at "Section 6.2 Revenue Infrastructure" → See Production Setup for RevenueCat setup
   - Add link at "Section 8: Security Hardening" → See Production Setup for security audit checklist

3. **START_HERE.txt** / **QUICK_START.md**
   - Add link: "Next: See PRODUCTION_SETUP_GUIDE.md for store preparation"

---

## Risk Mitigation (Emergency Procedures)

### If App Crashes on Launch

```
1. Immediate (within 5 min):
   - Enable airplane mode on your test device
   - Check stack trace in Sentry
   - Identify crashing line of code

2. Short-term (within 30 min):
   - Hotfix locally
   - Build v1.0.1
   - Submit immediately to app stores

3. Communication:
   - Tweet: "Oops! We found issue on launch. v1.0.1 fixing it now. Sorry!"
   - Email: "We're aware of crash, hotfix coming within 2 hours"
   - Be transparent, users appreciate honesty

4. Long-term:
   - Post-mortem: How did this pass QA?
   - Add test that would catch it
   - Review pre-launch checklist
```

### If Revenue System Fails

```
1. Immediate:
   - Disable premium paywall (so users can use free tier)
   - Switch to manual refunds via RevenueCat support
   - Post: "We're investigating payment issues"

2. Investigation:
   - Check RevenueCat status page
   - Verify Apple / Google endpoints responding
   - Check local logs for auth errors

3. Resolution:
   - Once fixed, enable paywall again
   - Offer 1-month free to affected users
   - Root-cause analysis
```

### If User Data Corrupted

```
1. Immediate:
   - Take app offline (remove from store)
   - Notify users via email
   - Clear recovery instructions

2. Investigation:
   - Check database schema version
   - Check encryption/decryption working
   - Verify no recent migrations broke data

3. Resolution:
   - Fix + release v1.0.2
   - Offer affected users refund
   - Backup + recovery procedure documented
```

---

## Documents to Reference/Link

**Create these files before deployment:**

```
✅ docs/PRODUCTION_SETUP_GUIDE.md (THIS FILE)
✅ docs/SECURITY_AUDIT_CHECKLIST.md (reference from Phase 2)
✅ docs/STORE_SUBMISSION_GUIDE.md (iOS + Android specific)
✅ docs/INCIDENT_RESPONSE_PLAN.md (what to do when things break)
✅ docs/ROLLBACK_PROCEDURE.md (how to revert bad release)
✅ docs/HOTFIX_PROCESS.md (fast-track release for critical bugs)
✅ docs/MONITORING_SETUP_GUIDE.md (Sentry + Analytics dashboards)
✅ docs/SUPPORT_PROCEDURE.md (how to handle user support requests)
```

---

## Summary Table: 3-Week Production Timeline

| Week | Focus | Deliverable | Owner |
|------|-------|-------------|-------|
| **Week 1** | Infrastructure setup | RevenueCat, Sentry, Email, Analytics | Backend/DevOps |
| **Week 1-2** | Security & Compliance | Privacy policy, ToS, GDPR, medical disclaimer | Legal/Product |
| **Week 2** | Testing & QA | Unit/integration/E2E tests, device testing | QA/Engineering |
| **Week 2-3** | Store prep | Screenshots, listings, metadata, build artifacts | Product/Marketing |
| **Week 3** | CI/CD & Monitoring | GitHub Actions, alerts, dashboards | DevOps/Engineering |
| **Week 4** | Pre-launch & deployment | Final checklist, team training, go/no-go | Everyone |

---

## Final Checklist (Print & Post)

```
PRE-DEPLOYMENT SIGN-OFF (All Team Members)

I have reviewed PRODUCTION_SETUP_GUIDE.md and verified:

☐ Infrastructure setup complete (RevenueCat, Sentry, Email)
☐ Security audit passed (0 critical vulnerabilities)
☐ Privacy/Legal complete (policy, ToS, disclaimer)
☐ Testing complete (unit/integration/E2E/device)
☐ Store listings finalized (iOS + Android)
☐ Builds passing CI/CD
☐ On-call rotation assigned
☐ Incident response plan reviewed
☐ Team trained on release process
☐ Go/No-Go meeting held

Signed:

Engineering Lead: _________________ Date: _______
Product Manager: _________________ Date: _______
QA Lead:         _________________ Date: _______
DevOps Lead:     _________________ Date: _______

GO/NO-GO Decision: [ ] GO [  ] NO-GO

If NO-GO, blocking issues:
1. _________________________________
2. _________________________________
3. _________________________________

Target launch date: ________________
```

---

**Document Version:** 1.0  
**Status:** 🔧 Complete — Ready to Use  
**Next Update:** Post-first-launch (incorporate learnings)  
**Audience:** CTO, DevOps, QA, iOS/Android Release Managers

---

**End of Production Setup Guide**

*For questions on specific components, see:*
- *RevenueCat integration → docs/ENHANCEMENT_RESEARCH_COMPREHENSIVE_2026.md Section 6.2*
- *Sentry monitoring → docs/ENHANCEMENT_RESEARCH_COMPREHENSIVE_2026.md Section 4.2*
- *Security hardening → docs/ENHANCEMENT_RESEARCH_COMPREHENSIVE_2026.md Section 8*
- *Bootstrap roadmap → docs/FITQUEST_BOOTSTRAP_ROADMAP.md Phases 1-3*
