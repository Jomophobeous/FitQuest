# RevenueCat Dashboard Setup — FitQuest

Complete step-by-step guide for configuring RevenueCat for FitQuest.  
**Do everything in order** — each section builds on the previous.

---

## 1. Project & API Keys

Your keys (already configured in `.env`):

| Key Type | Value | Where Used |
|----------|-------|------------|
| Secret API Key | `sk_NuDQEoVbdvabRpSiUFVLIDQFInKxv` | **Server-side only** (NOT in the app) |
| Test Store API | `test_DYcyZTNVVNpVqhswVWLUBvVMaeP` | In-app during development/testing |

> ⚠️ **IMPORTANT**: When you go to production, replace the test key with your **Public App-Specific API Key** from RevenueCat:
> - For **Google Play**: Look for a key starting with `goog_...`
> - For **App Store**: Look for a key starting with `appl_...`
>
> Navigate to: **RevenueCat Dashboard → Project Settings → API Keys**
>
> The `sk_` key is your SECRET key — **never** put it in the app.

---

## 2. Products — Create in Google Play Console FIRST

Before RevenueCat can see your products, create them in Google Play Console.

### Google Play Console Steps:

1. Go to **Google Play Console → FitQuest → Monetize → Products → Subscriptions**
2. Create **two** subscription products:

#### Product 1: Monthly

| Field | Value |
|-------|-------|
| Product ID | `fitquest_monthly` |
| Name | FitQuest Premium Monthly |
| Description | Full access to all FitQuest features — AI workouts, FitMind library, health monitoring, and more. |
| Base plan ID | `fitquest-monthly-base` |
| Billing period | 1 month |
| Price (US) | $8.99 |
| Free trial | 14 days |
| Grace period | 7 days |

#### Product 2: Annual

| Field | Value |
|-------|-------|
| Product ID | `fitquest_annual` |
| Name | FitQuest Premium Annual |
| Description | Full access to all FitQuest features — save 33% with annual billing. |
| Base plan ID | `fitquest-annual-base` |
| Billing period | 1 year |
| Price (US) | $53.99 |
| Free trial | 14 days |
| Grace period | 16 days |

> After creating, click **Activate** on each product so they become available.

---

## 3. Products — Import into RevenueCat

1. Go to **RevenueCat Dashboard → Products**
2. Click **+ New** (or use "Import from Store" if available)
3. Add:

| RevenueCat Product ID | Store Product ID | Store |
|----------------------|-----------------|-------|
| `fitquest_monthly` | `fitquest_monthly` | Google Play |
| `fitquest_annual` | `fitquest_annual` | Google Play |

Later, for iOS:

| RevenueCat Product ID | Store Product ID | Store |
|----------------------|-----------------|-------|
| `fitquest_monthly` | `fitquest_monthly` | App Store |
| `fitquest_annual` | `fitquest_annual` | App Store |

---

## 4. Entitlement

1. Go to **RevenueCat Dashboard → Entitlements**
2. Click **+ New**:

| Field | Value |
|-------|-------|
| Identifier | `full_access` |
| Description | Full access to all FitQuest premium features |

3. **Associate Products**: Click the entitlement, then **Attach** both `fitquest_monthly` and `fitquest_annual`.

This means either product grants the `full_access` entitlement.

---

## 5. Offerings

1. Go to **RevenueCat Dashboard → Offerings**
2. You should see a **Default** offering already created
3. Edit it (or create one):

| Field | Value |
|-------|-------|
| Identifier | `default` |
| Description | Default FitQuest subscription offering |

4. Add **two packages** to this offering:

| Package | Product |
|---------|---------|
| `$rc_monthly` (Monthly) | `fitquest_monthly` |
| `$rc_annual` (Annual) | `fitquest_annual` |

> The `$rc_monthly` and `$rc_annual` are RevenueCat's standard package identifiers. The app's code uses `offerings.current?.monthly` and `offerings.current?.annual` which map to these.

---

## 6. Paywalls — YES, Create Them

RevenueCat Paywalls let you **remotely change your paywall design without an app update**, and A/B test different layouts.

### Should you create paywalls in RevenueCat?

**YES** — but as a **secondary option**. The app has a beautiful custom paywall (`app/paywall.tsx`) that matches the FitQuest dark aesthetic. RevenueCat's dashboard paywall editor is useful for:

- **A/B testing** different copy/layouts without app updates
- **Quick experiments** (e.g., testing "50% off" vs "Save $50")
- **Localized paywalls** per country

### How to create a paywall:

1. Go to **RevenueCat Dashboard → Paywalls**
2. Click **+ Create Paywall**
3. Choose a template (recommended: **"Malibu"** or **"Bohemian"** — clean dark themes)
4. Configure:

| Section | Content |
|---------|---------|
| **Title** | Unlock Your Full Potential |
| **Subtitle** | AI-powered workouts, cognitive training, and health monitoring |
| **Call to action** | Start Free Trial |
| **Feature list** | ✅ AI-Personalized Workouts · ✅ FitMind Library · ✅ Health Monitoring · ✅ Anomaly Detection · ✅ Military-Grade Encryption |
| **Packages** | Select your Default offering |

5. Attach the paywall to your **Default** offering
6. Publish

### Using RevenueCat Paywall in the app:

The app can present RevenueCat's paywall using `react-native-purchases-ui` (already installed). The code supports both custom and RevenueCat paywalls — see `app/paywall.tsx`.

---

## 7. Targeting — Location-Based Pricing

### Does RevenueCat handle location-based pricing?

**YES, automatically.** Here's how it works:

### Automatic (Store-Level) — No Extra Work

Google Play and App Store **automatically** convert your base USD price to local currencies using their own exchange rate tables. When you set $8.99/month in Google Play Console, users in:

- 🇿🇦 South Africa see ~R169.99/month
- 🇪🇺 Europe see ~€8.49/month
- 🇯🇵 Japan see ~¥1,360/month
- 🇧🇷 Brazil see ~R$54.90/month

You don't need to do anything — the stores handle it.

### Manual Country Pricing (Optional, Recommended)

For **better** conversion rates, set custom prices per country:

1. **Google Play Console → Subscription → Pricing**
2. Click **Add price** for specific countries
3. Set prices that feel natural in local currency:

| Country | Monthly | Annual | Why |
|---------|---------|--------|-----|
| 🇿🇦 South Africa | ZAR 49.99 | ZAR 449.99 | PPP adjusted — $2.69 equivalent |
| 🇮🇳 India | INR 249 | INR 2,249 | PPP adjusted — $2.99 equivalent |
| 🇧🇷 Brazil | BRL 22.90 | BRL 206.90 | PPP adjusted — $4.49 equivalent |
| 🇲🇽 Mexico | MXN 89.99 | MXN 809.99 | $4.49 equivalent |
| 🇬🇧 UK | £6.99 | £62.99 | Premium market |
| 🇩🇪 Germany | €7.99 | €71.99 | Premium market |
| 🇯🇵 Japan | ¥980 | ¥8,820 | Local-friendly rounding |

> The app's `src/utils/regionalPricing.ts` already has fallback prices for 7 regions. These are displayed before RevenueCat loads actual store prices.

### RevenueCat Targeting Feature (Experiments)

RevenueCat also has a **Targeting** feature for creating country-specific offerings:

1. Go to **RevenueCat Dashboard → Experiments → Targeting**
2. Create a targeting rule:

| Field | Value |
|-------|-------|
| Name | Africa Pricing |
| Condition | Country is in [ZA, NG, KE, GH, TZ, UG, ET, EG, MA, DZ] |
| Offering | Create a new "africa_pricing" offering with lower prices |

3. Repeat for other regions as needed

This lets you show **completely different offerings** (not just different prices) to users in different countries. Useful for:
- Showing 3 plans in premium markets (weekly + monthly + annual)
- Showing only monthly + annual in developing markets
- Offering longer trials in new markets (30 days vs 14 days)

---

## 8. Google Play Store Configuration

### Link Google Play to RevenueCat:

1. Go to **RevenueCat Dashboard → Project Settings → Google Play**
2. Upload your **Service Account JSON key** (from Google Cloud Console)
3. This enables:
   - Server-side receipt validation
   - Real-time subscription status updates
   - Grace period handling
   - Refund detection

### Create Service Account:

1. **Google Cloud Console** → IAM & Admin → Service Accounts
2. Create account: `revenuecat-fitquest@your-project.iam.gserviceaccount.com`
3. Grant role: **Pub/Sub Admin**
4. Create JSON key, download it
5. In **Google Play Console** → Setup → API Access → Link the service account
6. Grant permission: **View financial data, Manage orders and subscriptions**
7. Upload the JSON to RevenueCat

### Real-Time Developer Notifications (RTDN):

1. Go to **Google Play Console → Monetize → Monetization Setup**
2. Set the topic to what RevenueCat gives you (in their Google Play settings page)
3. This ensures subscription events (renewals, cancellations, grace period) are processed instantly

---

## 9. Testing

### Test with Sandbox:

The `test_DYcyZTNVVNpVqhswVWLUBvVMaeP` key enables testing mode:

1. In the app, the SDK will initialize with this test key
2. On Android, use **License Testing** accounts:
   - Go to **Google Play Console → Setup → License Testing**
   - Add your test Gmail addresses
   - These accounts can make purchases without being charged

### RevenueCat Sandbox Testing:

1. Go to **RevenueCat Dashboard → Customers**
2. Search for your test user ID (`user_local_001` or your device's anonymous ID)
3. You can see all events, entitlements, and subscription status

### Test Flow:

1. Build the app (`npm run android`)
2. Open the paywall
3. Tap "Start Subscription" → Google Play test dialog appears
4. Complete the test purchase
5. App should navigate to dashboard with `ACTIVE` status
6. Check RevenueCat dashboard → Customers to verify

---

## 10. Going to Production

When ready for real users:

1. **Replace test key** in `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_API_KEY="goog_YourRealPublicKeyHere"
   ```

2. **Activate products** in Google Play Console (if not already)

3. **Verify webhook** (RTDN) is connected

4. **Test with a real purchase** using a license tester account

5. **Deploy** the app update

---

## Quick Reference — Product & Entitlement IDs

These must match exactly between Google Play Console, RevenueCat Dashboard, and the app code:

```
Entitlement:  full_access
Monthly:      fitquest_monthly
Annual:       fitquest_annual
Offering:     default
```

App file: `src/purchases/SubscriptionManager.ts` (lines 46-48)
