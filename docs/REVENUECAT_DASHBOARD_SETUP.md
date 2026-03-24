# RevenueCat Dashboard Setup — FitQuest (Comprehensive)

Complete step-by-step guide with **exact navigation paths** for configuring RevenueCat + Google Play Console for FitQuest's subscription model.

**Model**: 14-day free trial → Region-specific subscription (single tier, full access)

**Do everything in order** — each section builds on the previous.

---

## Table of Contents

1. [Prerequisites (Before You Start)](#1-prerequisites)
2. [Google Play Console — Merchant Account](#2-merchant-account)
3. [Google Play Console — Create Subscription Products](#3-create-products)
4. [Google Play Console — Set Regional Pricing](#4-regional-pricing)
5. [Google Play Console — Create Service Account](#5-service-account)
6. [RevenueCat Dashboard — Project Setup](#6-revenuecat-project)
7. [RevenueCat Dashboard — Connect Google Play](#7-connect-google-play)
8. [RevenueCat Dashboard — Import Products](#8-import-products)
9. [RevenueCat Dashboard — Create Entitlement](#9-entitlement)
10. [RevenueCat Dashboard — Create Offering](#10-offering)
11. [RevenueCat Dashboard — Paywalls](#11-paywalls)
12. [RevenueCat Dashboard — Targeting (Country-Based)](#12-targeting)
13. [RevenueCat Dashboard — Experiments (A/B Testing)](#13-experiments)
14. [Google Play Console — Real-Time Notifications](#14-rtdn)
15. [Testing in Sandbox](#15-testing)
16. [Going to Production](#16-production)
17. [API Keys Reference](#17-keys)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Prerequisites

Before starting, you need:

- [ ] **Google Play Developer Account** ($25 one-time fee) — https://play.google.com/console
- [ ] **Merchant/Payments Profile** set up in Google Play Console (required before creating any paid products)
- [ ] **RevenueCat Account** (free) — https://app.revenuecat.com
- [ ] **FitQuest APK uploaded** to Google Play Console (at least Internal Testing track) — products can only be created after you upload at least one APK/AAB
- [ ] **Google Cloud Project** with Pub/Sub API enabled

### Your API Keys

| Key Type | Value | Use |
|----------|-------|-----|
| RevenueCat Secret | `sk_REDACTED_ROTATE_IN_DASHBOARD` | Server-side only, webhooks, API calls. **NEVER** in the app. |
| RevenueCat Test | `test_DYcyZTNVVNpVqhswVWLUBvVMaeP` | In-app during development (already in `.env`) |

---

## 2. Merchant Account (Google Play Console)

You **must** set up a payments profile before creating subscriptions.

### Navigation:

```
Google Play Console
  → Settings (gear icon, bottom-left sidebar)
    → Payments profile
```

### Steps:

1. Click **"Create payments profile"** (or "Set up a merchant account")
2. Fill in:
   - **Country**: Your country of residence (e.g., Lesotho)
   - **Business type**: Individual (solo developer) or Organization
   - **Legal name**: Your full legal name (must match tax documents)
   - **Address**: Your registered address
3. **Tax information**:
   - Google will ask for tax residency information
   - If in Lesotho/South Africa: You may need to fill a W-8BEN form (non-US tax entity)
   - If in the US: W-9 form
4. **Bank account**: Add a bank account for receiving payouts
   - Bank name, account number, routing/SWIFT code
   - Google pays monthly (threshold: $100 minimum)
5. Click **"Submit"** — verification takes 1-3 business days

> ⚠️ **You cannot create subscription products until this is approved.**

---

## 3. Create Subscription Products (Google Play Console)

### Navigation:

```
Google Play Console
  → Select "FitQuest" app
    → Left sidebar: Monetize
      → Products
        → Subscriptions
          → "Create subscription"
```

### Product 1: FitQuest Monthly

**Step 3a: Create the subscription**

| Field | Value | Where to Enter |
|-------|-------|---------------|
| Product ID | `fitquest_monthly` | First field on creation page |
| Name | FitQuest Premium | "Subscription details" section |
| Description | Full access to AI workouts, FitMind cognitive library, health monitoring, anomaly detection, and encrypted data protection. | Below name |

Click **"Save"** at the bottom.

**Step 3b: Create a Base Plan**

After saving, you're on the subscription detail page. Click **"Add base plan"**:

| Field | Value | Where to Enter |
|-------|-------|---------------|
| Base plan ID | `fitquest-monthly-base` | First field |
| Auto-renewing | ✅ Yes (default) | Toggle |
| Billing period | 1 Month | Dropdown |
| Grace period | 7 days | Under "Grace period" section |
| Resubscribe | ✅ Allow | Checkbox |

Click **"Set price"** → Default price → Enter **$8.99** → Apply

**Step 3c: Add Free Trial Offer**

Still on the base plan detail page, scroll to **"Offers"** section:

1. Click **"Add offer"**
2. Select **"Free trial"**

| Field | Value |
|-------|-------|
| Offer ID | `fitquest-monthly-trial` |
| Eligibility | New customers only |
| Phase 1 — Free | ✅ Free trial |
| Duration | 14 days |

Click **"Save"** then **"Activate"** the base plan.

---

### Product 2: FitQuest Annual

Repeat the same flow:

```
Monetize → Products → Subscriptions → "Create subscription"
```

| Field | Value |
|-------|-------|
| Product ID | `fitquest_annual` |
| Name | FitQuest Premium Annual |
| Description | Full access to all features — save 33% with annual billing. AI workouts, cognitive training, health monitoring, and more. |

**Base plan:**

| Field | Value |
|-------|-------|
| Base plan ID | `fitquest-annual-base` |
| Billing period | 1 Year |
| Grace period | 16 days |
| Price | $53.99 |

**Free trial offer:**

| Field | Value |
|-------|-------|
| Offer ID | `fitquest-annual-trial` |
| Duration | 14 days |
| Eligibility | New customers only |

**Activate** the base plan.

---

## 4. Regional Pricing (Google Play Console)

This is how you implement location-based pricing. Google Play lets you set **custom prices per country**.

### Navigation:

```
Google Play Console
  → Select "FitQuest"
    → Monetize → Products → Subscriptions
      → Click "fitquest_monthly"
        → Click the base plan "fitquest-monthly-base"
          → "Set price" → "Add country price"
```

### Monthly Prices by Region

From the monetization model (14-day trial → region-specific pricing):

| Country/Region | Monthly Price | How to Enter |
|----------------|--------------|--------------|
| 🇺🇸 United States | $8.99 | Default price (already set) |
| 🇨🇦 Canada | CAD 11.99 | Add country: Canada |
| 🇬🇧 United Kingdom | £6.99 | Add country: UK |
| 🇩🇪 Germany / 🇫🇷 France / 🇪🇸 Spain / 🇮🇹 Italy | €5.99 | Add countries: Select all Eurozone |
| 🇿🇦 South Africa | ZAR 49.99 | Add country: South Africa |
| 🇱🇸 Lesotho | ZAR 49.99 | Add country: Lesotho (uses ZAR) |
| 🇳🇬 Nigeria | NGN 3,999 | Add country: Nigeria |
| 🇰🇪 Kenya | KES 399 | Add country: Kenya |
| 🇪🇬 Egypt | EGP 199 | Add country: Egypt |
| 🇮🇳 India | INR 249 | Add country: India |
| 🇧🇷 Brazil | BRL 22.90 | Add country: Brazil |
| 🇲🇽 Mexico | MXN 89.99 | Add country: Mexico |
| 🇦🇺 Australia | AUD 13.99 | Add country: Australia |
| 🇯🇵 Japan | ¥980 | Add country: Japan |
| 🇰🇷 South Korea | KRW 9,900 | Add country: South Korea |
| 🇦🇪 UAE / 🇸🇦 Saudi Arabia | $4.99 | Add countries: UAE, Saudi |

**Repeat for `fitquest_annual`** with annual equivalents:

| Country/Region | Annual Price | Equiv Monthly |
|----------------|-------------|---------------|
| 🇺🇸 United States | $53.99 | $4.50/mo (50% saving) |
| 🇬🇧 UK | £44.99 | £3.75/mo |
| 🇪🇺 Eurozone | €47.99 | €4.00/mo |
| 🇿🇦 South Africa / 🇱🇸 Lesotho | ZAR 449.99 | ZAR 37.50/mo |
| 🇮🇳 India | INR 1,999 | INR 167/mo |
| 🇧🇷 Brazil | BRL 179.90 | BRL 15/mo |
| 🇦🇺 Australia | AUD 109.99 | AUD 9.17/mo |

> **Tip**: For countries you don't explicitly set, Google Play auto-converts from your USD base price using their exchange rates. This is fine for most countries — only manually set prices for your **key markets**.

### How to Add Country Prices:

1. On the base plan pricing page, click **"Add price"**
2. Select countries from the list (you can multi-select)
3. Enter the price in **local currency**
4. Click **"Apply"**
5. Repeat for each region/country
6. Click **"Save"** at the bottom

---

## 5. Service Account (Google Cloud Console)

RevenueCat needs a Service Account to validate purchases server-side.

### Step 5a: Create Google Cloud Project (if you don't have one)

```
Google Cloud Console (https://console.cloud.google.com)
  → Top bar: Project selector → "New Project"
    → Name: "FitQuest"
    → Create
```

### Step 5b: Enable APIs

```
Google Cloud Console
  → APIs & Services (left sidebar)
    → "Enable APIs and Services" (top bar)
      → Search: "Google Play Android Developer API"
        → Click it → "Enable"
      → Search: "Cloud Pub/Sub API"  
        → Click it → "Enable"
```

### Step 5c: Create Service Account

```
Google Cloud Console
  → IAM & Admin (left sidebar)
    → Service Accounts
      → "Create Service Account" (top bar)
```

| Field | Value |
|-------|-------|
| Name | `revenuecat-fitquest` |
| Description | RevenueCat subscription validation for FitQuest |

Click **"Create and Continue"**

**Roles** (Step 2 of 3):
- Click "Add another role" → **Pub/Sub Admin**

Click **"Continue"** → **"Done"**

### Step 5d: Generate JSON Key

```
IAM & Admin → Service Accounts
  → Click the service account you just created
    → "Keys" tab
      → "Add Key" → "Create new key"
        → Key type: JSON
          → "Create"
```

A `.json` file downloads. **Save this securely** — you'll upload it to RevenueCat.

### Step 5e: Link to Google Play Console

```
Google Play Console
  → Settings (gear icon)
    → API access
      → "Link" next to your Google Cloud project
        → Find "revenuecat-fitquest" service account
          → "Grant access"
```

**Permissions to grant:**

```
API access → Service account → "Manage permissions"
  → Check: "View financial data, orders, and cancellation survey responses"
  → Check: "Manage orders and subscriptions"
  → Apply
```

> **IMPORTANT**: After granting access, it can take **up to 24 hours** for the service account to become active.

---

## 6. RevenueCat Project Setup

### Navigation:

```
RevenueCat Dashboard (https://app.revenuecat.com)
  → Projects (left sidebar)
    → "Create new project" (or select existing)
```

| Field | Value |
|-------|-------|
| Project name | FitQuest |

### Add App Platform:

```
Project → Apps (left sidebar)
  → "New App" (top right)
```

| Field | Value |
|-------|-------|
| Platform | Google Play Store |
| App name | FitQuest |
| Package name | `com.hugelet.fitquest` |

Click **"Save"**.

---

## 7. Connect Google Play to RevenueCat

### Navigation:

```
RevenueCat Dashboard
  → Your Project (FitQuest)
    → Left sidebar: App Settings
      → Google Play app
        → "Service Account credentials"
```

### Steps:

1. Click **"Upload"** under Service Account credentials
2. Select the **JSON key file** you downloaded in Step 5d
3. RevenueCat will validate the key
4. If successful: ✅ "Service credentials are valid"
5. If error: Wait 24 hours (Google Play permission propagation) and retry

---

## 8. Import Products into RevenueCat

### Navigation:

```
RevenueCat Dashboard
  → Your Project
    → Left sidebar: Products
      → "New" (top right)
```

### Add Product 1 (Monthly):

| Field | Value |
|-------|-------|
| Store | Google Play Store |
| Product identifier | `fitquest_monthly` |
| Display name | FitQuest Monthly |

Click **"Add"**.

### Add Product 2 (Annual):

| Field | Value |
|-------|-------|
| Store | Google Play Store |
| Product identifier | `fitquest_annual` |
| Display name | FitQuest Annual |

Click **"Add"**.

> **Alternative**: Click **"Import Products"** if available — RevenueCat can auto-detect products from connected Google Play Store.

---

## 9. Create Entitlement

An entitlement is what the app checks for access. Both products grant the same entitlement.

### Navigation:

```
RevenueCat Dashboard
  → Your Project
    → Left sidebar: Entitlements
      → "New" (top right)
```

| Field | Value |
|-------|-------|
| Identifier | `full_access` |
| Description | Full access to all FitQuest premium features |

Click **"Add"**.

### Attach Products to Entitlement:

```
Entitlements → Click "full_access"
  → "Attach" button (top right)
    → Check both:
      ✅ fitquest_monthly
      ✅ fitquest_annual
    → "Attach"
```

Now when either product is purchased, the user gets `full_access` entitlement.

This matches the app code in `src/purchases/SubscriptionManager.ts`:
```typescript
const ENTITLEMENT_ID = 'full_access';
```

---

## 10. Create Offering

An offering is a group of packages shown to users. The app fetches `offerings.current` to display prices.

### Navigation:

```
RevenueCat Dashboard
  → Your Project
    → Left sidebar: Offerings
      → "New" (top right)
```

### Create Default Offering:

| Field | Value |
|-------|-------|
| Identifier | `default` |
| Description | Default FitQuest subscription offering |

Click **"Add"**.

Make this the **Current Offering** (click the star icon or "Set as Current").

### Add Packages:

```
Offerings → Click "default"
  → "New" package
```

**Package 1:**

| Field | Value |
|-------|-------|
| Package | `$rc_monthly` (select from dropdown — this is RevenueCat's standard identifier) |
| Product | `fitquest_monthly` (Google Play) |

**Package 2:**

| Field | Value |
|-------|-------|
| Package | `$rc_annual` (select from dropdown) |
| Product | `fitquest_annual` (Google Play) |

> These standard identifiers (`$rc_monthly`, `$rc_annual`) map to the app code:
> ```typescript
> offerings.current?.monthly   // → $rc_monthly package
> offerings.current?.annual    // → $rc_annual package
> ```

---

## 11. Paywalls (RevenueCat Dashboard)

**YES, create paywalls.** RevenueCat Paywalls let you change paywall design remotely without app updates, and A/B test different layouts.

### How It Works

The app already has a custom paywall (`app/paywall.tsx`). RevenueCat paywalls are a **complementary option**:

- **Custom paywall** (current): Beautiful dark-themed UI matching FitQuest aesthetic, uses `useSubscription()` hook
- **RevenueCat paywall**: Configured in dashboard, presented via `react-native-purchases-ui` SDK (already installed in `package.json`)

You can use RevenueCat paywalls for A/B testing while keeping the custom one as default.

### Navigation:

```
RevenueCat Dashboard
  → Your Project
    → Left sidebar: Paywalls
      → "Create Paywall" (top right)
```

### Create Your Paywall:

**Step 1: Choose Template**

RevenueCat offers several templates. Recommended for FitQuest:
- **"Malibu"** — Clean, modern, dark-friendly
- **"Bohemian"** — Feature-rich with card layout
- **"Minimal"** — Simple and effective

**Step 2: Customize Content**

| Section | Value |
|---------|-------|
| **Header image** | Upload FitQuest icon or hero image |
| **Title** | "Unlock Your Full Potential" |
| **Subtitle** | "AI-powered workouts, cognitive training, and health monitoring" |
| **Call-to-action** | "Start 14-Day Free Trial" |
| **Feature list** | |
| • Feature 1 | "AI-Personalized Workouts — Adapted to your body and goals" |
| • Feature 2 | "FitMind Cognitive Library — Read, learn, grow smarter" |
| • Feature 3 | "Health Monitoring — Heart rate, sleep, anomaly detection" |
| • Feature 4 | "Military-Grade Encryption — Your data stays yours" |
| • Feature 5 | "Offline-First — Works without internet" |
| **Restore button** | ✅ "Already a subscriber?" |

**Step 3: Attach Offering**

- Select your **"default"** offering
- Both packages (monthly + annual) will automatically appear

**Step 4: Style**

| Property | Value |
|----------|-------|
| Background color | `#0A0E17` (matches FitQuest dark theme) |
| Accent color | `#10B981` (FitQuest green) |
| Text color | `#FFFFFF` |
| Button color | `#10B981` |
| Font | System default |

**Step 5: Publish**

Click **"Publish"** — the paywall is now live and can be presented from the app.

### Attaching Paywall to Offering:

```
Offerings → "default" → "Paywall" tab
  → Select the paywall you just created
  → "Attach"
```

---

## 12. Targeting (Country-Based Offerings)

Targeting lets you show **completely different offerings** to users in different countries. This goes beyond just different prices — you can show different plans, different trials, or different paywalls per region.

### Navigation:

```
RevenueCat Dashboard
  → Your Project
    → Left sidebar: Targeting
      → "New Targeting Rule" (top right)
```

### Create Rule 1: Africa Pricing

| Field | Value |
|-------|-------|
| Name | Africa Pricing |
| Condition type | Country |
| Countries | ZA, LS, NG, KE, GH, TZ, UG, ET, EG, MA, DZ, TN, SN, CM, CI, BW, MZ, ZW, NA, RW, MW |
| Offering | Create new offering: "africa_pricing" |

**For the "africa_pricing" offering**, create packages with the same products but the Google Play regional prices apply automatically — users in these countries see the ZAR/NGN/KES prices you set in Step 4.

> **The key benefit**: You could also offer a 30-day trial in Africa (instead of 14 days) by creating different intro offers in Google Play Console for these countries.

### Create Rule 2: Asia Pricing

| Field | Value |
|-------|-------|
| Name | Asia Pricing |
| Countries | IN, ID, TH, VN, PH, MY, PK, BD, LK, MM, KH, NP |
| Offering | Create new offering: "asia_pricing" |

### Create Rule 3: Europe Pricing

| Field | Value |
|-------|-------|
| Name | Europe |
| Countries | GB, DE, FR, ES, IT, NL, BE, PT, SE, NO, DK, FI, AT, CH, IE, PL, CZ, RO, HU, GR |
| Offering | Create new offering: "europe_pricing" |

### Default (No Rule Match):

Users not matching any targeting rule get the **"default"** offering (US pricing / $8.99 monthly).

### How It Works in the App:

The app code (`SubscriptionManager.ts`) calls:
```typescript
const offerings = await Purchases.getOfferings();
const monthly = offerings.current?.monthly;
const annual = offerings.current?.annual;
```

RevenueCat's SDK automatically returns the **targeted offering** for that user's country. No app code changes needed — targeting is entirely server-side.

---

## 13. Experiments (A/B Testing)

Test different paywalls, pricing, or offerings to maximize conversion.

### Navigation:

```
RevenueCat Dashboard
  → Your Project
    → Left sidebar: Experiments
      → "New Experiment" (top right)
```

### Example Experiment: Paywall A vs B

| Field | Value |
|-------|-------|
| Name | Paywall Copy Test |
| Type | Paywall |
| Variant A | Current paywall ("Unlock Your Full Potential") — 50% |
| Variant B | New paywall ("Transform Your Body in 14 Days") — 50% |
| Goal | Trial conversion |
| Sample size | 1,000 users |

### Example Experiment: Trial Length

| Field | Value |
|-------|-------|
| Name | 14 vs 30 Day Trial |
| Type | Offering |
| Variant A | Default offering (14-day trial) — 50% |
| Variant B | Long trial offering (30-day trial) — 50% |

> **Recommendation**: Don't run experiments until you have at least 1,000+ trial signups. Statistical significance requires volume.

---

## 14. Real-Time Developer Notifications (RTDN)

RTDN ensures RevenueCat instantly knows about subscription events (renewals, cancellations, refunds).

### Step 14a: Get the Pub/Sub Topic from RevenueCat

```
RevenueCat Dashboard
  → Your Project
    → App Settings → Google Play app
      → Scroll to "Google Real-Time Developer Notifications"
        → Copy the Pub/Sub topic URL (looks like: projects/XXX/topics/XXX)
```

### Step 14b: Set in Google Play Console

```
Google Play Console
  → Select "FitQuest"
    → Left sidebar: Monetize
      → Monetization setup
        → "Real-time developer notifications" section
          → Paste the Pub/Sub topic URL
          → "Save" (bottom of page)
```

### Step 14c: Verify

Back in RevenueCat:
- Go to App Settings → Google Play app
- Click **"Verify"** next to the RTDN topic
- Should show ✅ "Notifications are working"

> **Without RTDN**: RevenueCat polls for subscription changes (slower, up to several hours). **With RTDN**: Changes are reflected within seconds.

---

## 15. Testing

### Step 15a: Set Up License Testers (Google Play Console)

```
Google Play Console
  → Settings (gear icon, bottom-left)
    → License testing
      → "Add email address"
```

Add your test Gmail addresses. These accounts can make purchases **without being charged**.

### Step 15b: Upload to Internal Testing Track

```
Google Play Console
  → Select "FitQuest"
    → Left sidebar: Testing
      → Internal testing
        → "Create new release"
          → Upload your AAB/APK
          → Roll out to internal testing
```

Add the same test email addresses as testers.

### Step 15c: Test Flow

1. Build the app: `npm run android` (or use EAS Build)
2. Install on a test device signed into a license tester account
3. Open the paywall
4. Tap **"Start Subscription"**
5. Google Play test purchase dialog appears
6. Complete the purchase (no real charge)
7. App should navigate to dashboard with `ACTIVE` status

### Step 15d: Verify in RevenueCat

```
RevenueCat Dashboard
  → Customers (left sidebar)
    → Search for your user ID or app user ID
      → See all events, entitlements, purchases
```

### Test Checklist:

- [ ] Monthly purchase → `full_access` entitlement granted
- [ ] Annual purchase → `full_access` entitlement granted
- [ ] Trial starts → 14-day trial visible
- [ ] Trial expires → paywall shown, `EXPIRED` status
- [ ] Restore purchases → previous entitlement restored
- [ ] Cancel subscription → entitlement remains until period end
- [ ] Regional pricing → correct price shown for test country

---

## 16. Going to Production

### Checklist:

1. **Replace test key** in `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_API_KEY="goog_YourRealPublicKeyHere"
   ```
   Get this from: RevenueCat Dashboard → Project Settings → API Keys → Public app-specific key

2. **Activate products** in Google Play Console (Status: Active)

3. **Verify RTDN** is connected and working

4. **Run a real purchase** with a license tester account

5. **Check RevenueCat events** appear in real-time

6. **Submit app** to Google Play production track

### API Key Swap:

| Environment | Key | Source |
|-------------|-----|--------|
| Development | `test_DYcyZTNVVNpVqhswVWLUBvVMaeP` | Testing mode, no real purchases |
| Production | `goog_...` (get from RevenueCat) | Real purchases, real revenue |

---

## 17. Keys & Identifiers Reference

These must match **exactly** between Google Play Console, RevenueCat Dashboard, and the app code:

| What | Identifier | Where in Code |
|------|-----------|--------------|
| Entitlement | `full_access` | `src/purchases/SubscriptionManager.ts` line 48 |
| Monthly product | `fitquest_monthly` | `src/purchases/SubscriptionManager.ts` line 49 |
| Annual product | `fitquest_annual` | `src/purchases/SubscriptionManager.ts` line 50 |
| Offering | `default` | RevenueCat auto-resolves `offerings.current` |
| Monthly package | `$rc_monthly` | RevenueCat standard identifier |
| Annual package | `$rc_annual` | RevenueCat standard identifier |
| App package | `com.hugelet.fitquest` | `app.config.ts` → android.package |

### Important About Your Keys:

| Key | Starts With | Where It Goes | Who Sees It |
|-----|-------------|--------------|-------------|
| Secret API key | `sk_` | Server-side only, RevenueCat REST API, webhooks | Only you |
| Public API key | `goog_` / `appl_` / `test_` | In the app `.env` file | The app (client-side, safe to embed) |

> ⚠️ Your `sk_` secret key must **NEVER** go in the app or source code — only use it for server-side API calls or webhook verification. Rotate it in the RevenueCat dashboard if it was ever committed to version control.

---

## 18. Troubleshooting

### "Products not found in RevenueCat"

- **Cause**: Products not activated in Google Play Console
- **Fix**: Go to Google Play Console → Subscriptions → Click product → Click **"Activate"** on the base plan

### "Service credentials are invalid"

- **Cause**: Service account permissions not propagated yet
- **Fix**: Wait 24 hours after granting permissions, then retry

### "No offerings available" in app

- **Cause**: Offering not set as "Current" in RevenueCat
- **Fix**: RevenueCat → Offerings → Click star icon next to "default" to make it Current

### "Purchase failed" on test device

- **Cause**: Device not signed into a license tester Google account
- **Fix**: Google Play Console → Settings → License testing → Ensure email is listed

### App falls back to local pricing

- **Cause**: `.env` key is placeholder or test key not recognized
- **Fix**: Verify `EXPO_PUBLIC_REVENUECAT_API_KEY` in `.env` is not `rcbp_your_key_here`

### RevenueCat not initializing

Check the app code in `SubscriptionManager.ts` — it checks:
```typescript
if (apiKey && !apiKey.includes('your_key_here')) {
  Purchases.configure({ apiKey: apiKey.trim() });
}
```
If the key contains `your_key_here`, the SDK won't initialize.

---

## Who Tracks What — Payment Flow

```
User taps "Subscribe" in app
    ↓
App calls → Purchases.purchasePackage(pkg)
    ↓
Google Play handles the actual payment
• Credit card charge
• Trial management
• Renewal billing
    ↓
Google Play notifies → RevenueCat (via RTDN)
    ↓
RevenueCat updates → Customer entitlements
    ↓
App SDK queries → Purchases.getCustomerInfo()
    ↓
App checks → info.entitlements.active['full_access']
    ↓
Access granted (or paywall shown)
```

### What YOU (the developer) see:

| RevenueCat Dashboard | Google Play Console |
|---------------------|-------------------|
| Revenue charts & metrics | Sales reports & financials |
| Customer subscription status | Order management |
| Experiment results | Tax reports |
| Churn analytics | Payment disputes |
| Country/region breakdown | Payout history |

### What YOU never see:

- ❌ Credit card numbers
- ❌ Billing addresses
- ❌ Bank details
- ❌ Personal identity documents

Google Play and RevenueCat handle all PCI compliance. You just see aggregate analytics and subscription status.
