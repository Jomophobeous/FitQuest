# PostHog Setup Guide — FitQuest 2.0

**Date:** 18 March 2026  
**Status:** Code integration complete, dashboard configuration needed  
**Your plan:** PostHog Free Tier  

---

## Current Status

| Step | Status | Who |
|------|--------|-----|
| 1. Create PostHog account | DONE | You |
| 2. Install SDK packages | DONE | Copilot |
| 3. Wire SDK into app code | DONE | Copilot |
| 4. Wire telemetry → PostHog | DONE | Copilot |
| 5. Add key event captures | DONE | Copilot |
| 6. User identification | DONE | Copilot |
| 7. Enable Session Replay in dashboard | **TODO** | You |
| 8. Verify API key + host in .env | **TODO** | You (verify) |
| 9. Build APK with native session replay | **TODO** | Copilot (after you confirm step 7-8) |
| 10. Install APK → test events flowing | **TODO** | You + Copilot |

---

## What's Already Done (Code Side)

### Packages installed
```
posthog-react-native@^4.37.3
posthog-react-native-session-replay@^1.5.1
```

### Files created/modified

| File | What was done |
|------|---------------|
| `src/services/posthogService.tsx` | **NEW** — PostHogAnalyticsProvider (React) + getPostHogClient() singleton for imperative access |
| `src/services/telemetry.ts` | **MODIFIED** — All logEvent/logPerf/logError now auto-forward to PostHog |
| `app/_layout.tsx` | **MODIFIED** — PostHogAnalyticsProvider wraps the app (inside ErrorBoundary, above LanguageProvider) |
| `src/context/DatabaseContext.tsx` | **MODIFIED** — Identifies user in PostHog after profile loads (non-PII: goal, experience, training_days) |
| `src/hooks/useFitQuestWorkout.ts` | **MODIFIED** — Added `workout_started` and `exercise_skipped` events |
| `src/services/xpService.ts` | **MODIFIED** — Added `xp_earned` event on every XP award |
| `app/onboarding.tsx` | **MODIFIED** — Added `onboarding_completed` event |
| `app/paywall.tsx` | **MODIFIED** — Added `paywall_viewed` and `subscription_purchased` events |
| `app/move.tsx` | **MODIFIED** — Added `jog_completed` event |
| `.env` | **MODIFIED** — Added EXPO_PUBLIC_POSTHOG_API_KEY and EXPO_PUBLIC_POSTHOG_HOST |
| `.env.example` | **MODIFIED** — Added PostHog section with empty placeholders |

### Events now tracked

| Event Name | When it fires | Properties |
|------------|---------------|------------|
| `workout_started` | User taps "Start Workout" | exercise_count |
| `exercise_skipped` | User skips an exercise | exercise_id, exercise_index |
| `xp_earned` | Any XP award (workout, jog, steps, reading) | xp_amount, new_total, new_level, level_up |
| `onboarding_completed` | User finishes onboarding | goal, experience, training_days, equipment_count |
| `paywall_viewed` | Paywall screen opens | — |
| `subscription_purchased` | User completes purchase | plan (monthly/annual) |
| `jog_completed` | User finishes a jog | distance_meters, duration_seconds, calories |
| `app_launch` | App opens | — |
| `app_error` | Any error via logError() | error_name, error_message, context |
| `perf_*` | Performance measurements | duration_ms |
| + ~25 existing telemetry events | Notifications, cache, mutations, etc. | varies |

### User identification

When the app loads, PostHog identifies the user with:
- `distinct_id`: `user_local_001` (local user ID — no PII)
- Person properties: `goal`, `experience`, `training_days`, `onboarded`

---

## Step 7 — Enable Session Replay (YOU DO THIS)

Session replay lets you watch real recordings of how users interact with your app. The code already enables it, but you need to turn it on in your PostHog dashboard.

### 7a. Go to Session Replay settings

1. Log in to [PostHog](https://us.posthog.com) (or `eu.posthog.com` if you chose EU)
2. Click **Session Replay** in the left sidebar
3. You may see a page saying "Enable Session Replay" — click the button to enable it
4. If it's already enabled, you'll see a list of recordings (empty for now)

### 7b. Check your project settings

1. Click the **gear icon** (⚙️) in the top nav → **Project settings**
2. Scroll to **Session Recording** section
3. Ensure **"Record user sessions"** is toggled **ON**
4. **Sampling rate**: Set to 100% for now (you have very few users). Our code also sets 50% client-side, so effectively 50% of sessions will record. You can lower it later when you have more traffic.
5. **Minimum recording duration**: Leave at default (2 seconds) or set to 5 seconds to skip very short visits

### 7c. Mobile replay specific settings

1. Still in Project settings → Session Recording section
2. Look for **"Mobile recording"** or **"React Native"** — make sure it's not disabled
3. If there's a toggle for **"Enable mobile session recording"**, turn it **ON**

> **Free tier limit:** 5,000 session recordings per month. With 50% client-side sampling, that covers ~10,000 sessions/month worth of usage.

---

## Step 8 — Verify Your API Key + Host (YOU DO THIS)

### 8a. Find your project API key

1. In PostHog dashboard → **⚙️ Settings** → **Project settings**
2. Under **"Project API Key"** you'll see a key starting with `phc_`
3. **Verify** it matches what's in your `.env` file:

```
EXPO_PUBLIC_POSTHOG_API_KEY="phc_YOUR_PROJECT_API_KEY_HERE"
```

If it doesn't match, update the `.env` file with the correct key.

### 8b. Verify your host region

Your API host depends on where you created your account:

| If you signed up at | Your host should be |
|---------------------|---------------------|
| `us.posthog.com` | `https://us.i.posthog.com` |
| `eu.posthog.com` | `https://eu.i.posthog.com` |

Your `.env` currently has:
```
EXPO_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```

If you created your account on the EU instance, tell me and I'll change it to `https://eu.i.posthog.com`.

### 8c. Confirm to me

Tell me:
1. "API key matches" or give me the correct key
2. "US region" or "EU region"
3. "Session replay is enabled"

---

## Step 9 — Build APK (COPILOT DOES THIS)

Once you confirm step 7-8, I will:

1. Run `npx expo prebuild --clean` (already done, but may need refresh)
2. Copy exercise image assets
3. Build the release APK:
   ```
   cd android && JAVA_OPTS="-Xmx2048m -XX:+UseSerialGC" ./gradlew assembleRelease --no-daemon --max-workers=1 -x lint -x lintVitalRelease
   ```
4. The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

> **Important:** Session replay requires a native build (not Expo Go). The `posthog-react-native-session-replay` package has native Android code that must be compiled into the APK.

---

## Step 10 — Test That Events Are Flowing (YOU + COPILOT)

### 10a. Install the APK on your phone

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### 10b. Open the app and do these actions (takes ~2 minutes)

Do each one and wait a few seconds between:

1. **Open the app** → triggers `app_launch`
2. **If not onboarded yet:** Complete onboarding → triggers `onboarding_completed`
3. **Go to FitQuest tab** → generate a workout → tap Start → triggers `workout_started`
4. **Skip one exercise** → triggers `exercise_skipped`
5. **Complete a few exercises** → finish workout → triggers `xp_earned` (multiple)
6. **Go to Move tab** → start and stop a short jog → triggers `jog_completed`
7. **Navigate to different tabs** → PostHog autocapture tracks screen views

### 10c. Check events in PostHog dashboard

1. Go to PostHog → **Activity** (left sidebar) → **Live Events**
2. You should see events appearing within 30-60 seconds
3. Look for your event names: `workout_started`, `xp_earned`, `$screen`, etc.

### 10d. Check session replay

1. Go to PostHog → **Session Replay** (left sidebar)
2. Wait 2-5 minutes after using the app (recordings need to upload)
3. You should see a session recording appear
4. Click on it to watch the replay

### If events are NOT appearing:

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| No events at all | Wrong API key | Double-check `.env` key matches PostHog project settings |
| No events at all | Wrong host region | US vs EU mismatch — check step 8b |
| Events but no replay | Session replay not enabled in dashboard | Do step 7 |
| Events but no replay | Expo Go instead of native build | Must use the APK from step 9, not Expo Go |
| Events appear after long delay | Normal — buffer flushes every 30s | Wait 60 seconds |

---

## What PostHog Gives You (Free Tier)

| Feature | Free Tier Limit | Your usage |
|---------|----------------|------------|
| Product Analytics (events) | 1 million events/month | More than enough |
| Session Replay | 5,000 recordings/month | Plenty for early stage |
| Feature Flags | 1 million API requests/month | Not using yet (future) |
| Surveys | 250 responses/month | Not using yet |
| A/B Testing | Unlimited | Not using yet |
| Data retention | 1 year | Good |

---

## Optional: Things You Can Do Later in PostHog Dashboard

These are NOT required now, but useful as you grow:

### Create a Dashboard
1. PostHog → **Dashboards** → **New Dashboard**
2. Add these insights:
   - **Daily Active Users** (Unique users by day)
   - **Workout Completions** (Count of `workout_started` events)
   - **Onboarding Funnel** (onboarding_completed conversion rate)
   - **Revenue** (subscription_purchased events)

### Set Up a Funnel
1. PostHog → **Product Analytics** → **New Insight** → **Funnel**
2. Steps: `app_launch` → `workout_started` → `xp_earned`
3. This shows you what % of users actually complete a workout

### Feature Flags (replace your custom flags)
Your app has `src/services/featureFlags.ts` with a custom implementation. PostHog can replace this — you'd create flags in the dashboard and check them with `useFeatureFlag('flag-name')` from `posthog-react-native`. Not urgent but eliminates local-only feature flags.

---

## Configuration Reference

### Current PostHog SDK config in the app

```typescript
// Session replay
enableSessionReplay: true
sessionReplayConfig: {
  maskAllTextInputs: true,   // Hides text in inputs (passwords, names)
  maskAllImages: true,        // Blurs images in replay 
  captureLog: false,          // Don't capture Android logcat
  captureNetworkTelemetry: true,  // Track network timing
  sampleRate: 0.5,            // 50% of sessions get recorded
  throttleDelayMs: 1000,      // Min 1s between replay snapshots
}

// Event batching
flushInterval: 30    // Send events every 30 seconds
flushAt: 20          // Or when 20 events are queued

// Autocapture
captureScreens: true     // Auto-track screen views ($screen events)
captureTouches: false    // Don't track taps (too noisy)
```

### To change sample rate later

Edit `src/services/posthogService.tsx` — change `sampleRate: 0.5` to any value from `0.0` (no recording) to `1.0` (record everything). The value appears in two places in that file (PostHogProvider and getPostHogClient).

---

## TL;DR — What You Need To Do Right Now

1. **In PostHog dashboard:** Enable Session Replay (step 7)
2. **Verify:** Your API key matches (step 8a) + you're on US region (step 8b)
3. **Tell me:** "Ready to build" and I'll compile the APK
4. **After build:** Install APK, use the app for 2 minutes, check PostHog dashboard for events
