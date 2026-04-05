# FitQuest 2.0 — Production Roadmap

> **Author**: Alfred Ω  
> **Date**: 5 April 2026  
> **Baseline**: Commit `694f235` (Phase C.5)  
> **Score**: 8.5/10 code quality — 0% deployed to users

---

## Constraints

| Resource | Spec | Limit |
|----------|------|-------|
| Dev machine | 8GB RAM | No heavy parallel builds. One build at a time. |
| Render | Free tier — Express API | 512MB RAM, spins down after 15min idle, 750h/month |
| Supabase | Free tier — PostgreSQL | 500MB DB, 1GB bandwidth, 50K auth MAU |
| RevenueCat | Free tier | Unlimited for <$2.5M revenue |
| Sentry | Free tier | 5K errors/month, 10K transactions/month |
| PostHog | Free tier | 1M events/month, session replay |
| GitHub | Pro ($10/mo) | 3K Actions minutes/month, 2GB packages |
| Google Play Console | Active | $25 one-time (paid) |
| Budget | $10 reserve | Emergency only |

**Emails**: `tumisangkheleli7@gmail.com` (primary), `jomophobeous@gmail.com` (secondary)

---

## Architecture Decision: Server Auth + Offline-First

**Current**: Fully offline. Biometric auth. No sign-up. No way to verify users or enforce subscriptions server-side.

**Target**: Sign-up required (email/password via Supabase Auth) → server issues session → app runs offline with local SQLite → server validates subscriptions, syncs critical state on reconnect.

```
┌─────────────────────────────────────────────────────┐
│ MOBILE APP (React Native + Expo)                     │
│                                                       │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Supabase│  │ SQLite   │  │ SecureStore       │    │
│  │ Auth SDK│  │ (offline │  │ (tokens, keys,    │    │
│  │ (login) │  │  data)   │  │  biometric DK)    │    │
│  └────┬────┘  └────┬─────┘  └──────────────────┘    │
│       │            │                                  │
│       │   On login: download user seed                │
│       │   On sync:  push workout/health data          │
│       │   On verify: check subscription               │
└───────┼────────────┼─────────────────────────────────┘
        │            │
        ▼            ▼
┌───────────────────────────────────────────────────────┐
│ RENDER (Express API)                                   │
│                                                         │
│  /auth/signup    → Supabase Auth (createUser)           │
│  /auth/login     → Supabase Auth (signInWithPassword)   │
│  /auth/refresh   → Supabase Auth (refreshSession)       │
│  /verify/sub     → RevenueCat API (server-side)         │
│  /sync/push      → Supabase DB (write workout data)     │
│  /health         → Service health check                 │
│                                                         │
│  Middleware: JWT validation (Supabase access_token)      │
│  Rate limit: 60 req/min/IP                              │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ SUPABASE (PostgreSQL)                                   │
│                                                         │
│  users, subscriptions, devices                          │
│  RLS: service_role only (no direct client access)       │
│  Auth: email/password (built-in Supabase Auth)          │
└───────────────────────────────────────────────────────┘
```

**Why this architecture**:
- Supabase Auth handles email/password, JWT tokens, password reset — we don't build any of it
- Render server validates JWTs and proxies to Supabase DB — mobile never touches DB directly
- App works fully offline after first login — SQLite has all exercise/workout data
- RevenueCat subscription verified server-side — can't be spoofed by client
- Free tier handles thousands of users before scaling is needed

---

## Phase Map

| Phase | Name | Scope | Depends On |
|-------|------|-------|------------|
| **D** | Server Auth | Supabase Auth + signup/login on mobile + JWT middleware | — |
| **E** | Subscription Hardening | RevenueCat production keys + server verification + paywall enforcement | D |
| **F** | Release Build | EAS production build + signing + ProGuard + Sentry wiring | D, E |
| **G** | Play Store Submission | Store listing + screenshots + privacy policy + review | F |
| **H** | Post-Launch Ops | OTA updates + crash monitoring + analytics review | G |

**Total**: 5 phases. Each phase has explicit entry criteria, exit criteria, and validation.

---

## Phase D: Server Auth

**Objective**: Users must sign up with email/password to use the app. Auth tokens stored securely. App works offline after login.

### D.1 — Supabase Auth Setup

- [ ] Enable Email/Password auth in Supabase dashboard (project `czfsoheldgxyzowymfay`)
- [ ] Disable email confirmation (friction reduction for beta — re-enable later)
- [ ] Set JWT expiry to 1 hour, refresh token to 30 days
- [ ] Add `SUPABASE_JWT_SECRET` to server `.env`

### D.2 — Server Auth Routes

- [ ] `POST /auth/signup` — Accept `{ email, password }`, call `supabase.auth.signUp()`, return `{ access_token, refresh_token, user_id }`
- [ ] `POST /auth/login` — Accept `{ email, password }`, call `supabase.auth.signInWithPassword()`, return tokens
- [ ] `POST /auth/refresh` — Accept `{ refresh_token }`, call `supabase.auth.refreshSession()`, return new tokens
- [ ] `POST /auth/logout` — Accept bearer token, call `supabase.auth.signOut()`
- [ ] JWT middleware: validate `Authorization: Bearer <access_token>` on all protected routes
- [ ] Rate limit auth routes: 5 attempts/min/IP (brute-force protection)

### D.3 — Mobile Auth Integration

- [ ] Create `src/services/authAPI.ts` — signup, login, refresh, logout calls to Render server
- [ ] Rewire `AuthContext.tsx`:
  - On first launch → show login/register screen
  - On register → call `/auth/signup` → store tokens in SecureStore → navigate to onboarding
  - On login → call `/auth/login` → store tokens in SecureStore → navigate to dashboard
  - On app resume → check token expiry → auto-refresh if needed
  - On token failure → redirect to login
- [ ] Rewire `login.tsx` and `register.tsx` screens to use real auth (currently stubs)
- [ ] Keep biometric as **session lock** (not auth) — if user has biometric enabled, require face/fingerprint to unlock app after 30min idle
- [ ] Store `user_id` from Supabase in SQLite `user_profile` table (replaces hardcoded `user_local_001`)

### D.4 — Offline Resilience

- [ ] After successful login, app operates fully offline using local SQLite
- [ ] Token refresh attempts on reconnect — silent failure keeps user logged in with stale token
- [ ] If refresh token expired (30 days offline), redirect to login screen
- [ ] No feature gating on network — everything works offline except signup/login/subscription verify

### D.5 — Validation

- [ ] Test: signup → login → close app → reopen → auto-auth → works offline
- [ ] Test: airplane mode → all features work → reconnect → token refreshes silently
- [ ] Test: expired token → login redirect → re-login → data preserved
- [ ] Test: 5 failed login attempts → rate limited → wait → retry works

**Exit criteria**: Users can sign up, log in, and use the app. Auth persists across restarts. Works offline after first login.

---

## Phase E: Subscription Hardening

**Objective**: RevenueCat production keys wired. Server validates subscriptions. Paywall enforces correctly.

### E.1 — RevenueCat Production Setup

- [ ] Create production app in RevenueCat dashboard
- [ ] Create Google Play Store app in RevenueCat
- [ ] Add production API key to server `.env` (`REVENUECAT_API_KEY`)
- [ ] Add public API key to app `.env` (`EXPO_PUBLIC_REVENUECAT_API_KEY`) — replace test key
- [ ] Configure products in Google Play Console:
  - `fitquest_monthly` — $5.39/month
  - `fitquest_annual` — $53.99/year
- [ ] Link Google Play billing to RevenueCat

### E.2 — Server Subscription Verification

- [ ] `POST /verify/subscription` — Accept `{ user_id }`, query RevenueCat REST API, return `{ status, expires_at, tier }`
- [ ] Cache subscription status in Supabase `subscriptions` table (avoid hitting RevenueCat on every request)
- [ ] Webhook endpoint for RevenueCat events (renewal, expiry, cancellation) — update Supabase in real-time
- [ ] Grace period: 24h after expiry before downgrade

### E.3 — Mobile Subscription Flow

- [ ] On login: call `/verify/subscription` → update local `subscription_state` table
- [ ] Paywall screen (`app/paywall.tsx`): wire to RevenueCat purchase flow (not mock)
- [ ] `EXPO_PUBLIC_BILLING_MODE` → remove mock mode, use real RevenueCat SDK
- [ ] Access state machine: `RESOLVING → TRIAL → SUBSCRIBED → EXPIRED`
- [ ] Trial: 14 days from first signup (server tracks `trial_state.started_at`)

### E.4 — Feature Gating

- [ ] Free tier: exercises, basic workout generation, step tracking
- [ ] Premium tier: AI coach, FitMind, advanced analytics, health dashboard, body craft
- [ ] Gate at screen level (not component level) — simpler enforcement
- [ ] Expired users see paywall overlay, not locked screens

### E.5 — Validation

- [ ] Test: new user → 14-day trial → all features accessible
- [ ] Test: trial expired → paywall shown → purchase → immediate access
- [ ] Test: subscription active → kill app → reopen → still premium (cached)
- [ ] Test: offline for 48h → cached subscription still valid within grace period

**Exit criteria**: RevenueCat production billing works. Server verifies subscriptions. Paywall enforces feature access.

---

## Phase F: Release Build

**Objective**: Production APK/AAB built, signed, crash-reporting active, performance acceptable.

### F.1 — Sentry Production Wiring

- [ ] Verify `EXPO_PUBLIC_SENTRY_DSN` points to production project
- [ ] Ensure `@sentry/react-native` init runs in app entry (`App.tsx` or `_layout.tsx`)
- [ ] Upload source maps to Sentry during EAS build (auto via plugin)
- [ ] Test: throw test error → appears in Sentry dashboard within 60s
- [ ] Wire server: add `@sentry/node` to Express server for backend error tracking

### F.2 — PostHog Analytics

- [ ] Verify PostHog SDK init in app entry
- [ ] Add key events: `app_opened`, `signup_completed`, `workout_started`, `workout_completed`, `subscription_purchased`, `paywall_shown`
- [ ] Session replay enabled (already configured — verify it captures)
- [ ] Test: open app → check PostHog dashboard → events flowing

### F.3 — Build Configuration

- [ ] Android keystore: generate release keystore (or use existing in `android/`)
- [ ] EAS secrets: upload keystore + passwords to EAS
- [ ] ProGuard/R8: add shrink rules for release build (especially for Skia, Reanimated)
- [ ] App icon: verify adaptive icon + monochrome for Android 13+
- [ ] Splash screen: verify themed splash displays correctly
- [ ] Version: set `version: "1.0.0"`, `android.versionCode: 1`

### F.4 — Production Build

- [ ] `eas build --platform android --profile production`
- [ ] Download AAB, verify size (target: <50MB)
- [ ] Install on test device, verify:
  - Cold start <3s
  - No crashes on first launch
  - Signup → login → dashboard → workout flow works
  - Offline mode works
  - Subscription paywall appears for free users

### F.5 — Performance Pass

- [ ] Remove all `__DEV__` console.log flood (or gate behind dev flag)
- [ ] Verify no JS bundle warnings (large modules, missing tree-shaking)
- [ ] Memory: <200MB resident after 10min use
- [ ] Delete `assets/models/` (68MB untracked dead weight) from disk

**Exit criteria**: Production AAB built, <50MB, crashes report to Sentry, analytics flow to PostHog, performance acceptable on 8GB device.

---

## Phase G: Play Store Submission

**Objective**: App listed on Google Play Store, passing review.

### G.1 — Store Listing

- [ ] App name: "FitQuest — Workout & Fitness"
- [ ] Short description (80 chars): "Smart workouts, step tracking, and AI coaching — all offline"
- [ ] Full description (4000 chars): Feature overview, privacy emphasis, offline-first
- [ ] Category: Health & Fitness
- [ ] Content rating: complete questionnaire (no violent/sexual content)

### G.2 — Assets

- [ ] Feature graphic: 1024x500px
- [ ] App icon: 512x512px (already exists)
- [ ] Screenshots: minimum 4, recommended 8 (phone frames)
  - Dashboard, workout in progress, exercise list, profile, health dashboard, FitMind, step tracker, paywall
- [ ] Use existing Screenshots-Expo/ folder — crop and frame

### G.3 — Legal & Compliance

- [ ] Privacy policy URL: host on Render static site (`website/privacy-policy.html`)
- [ ] Terms of service URL: host on Render static site (`website/terms.html`)
- [ ] Add URLs to `app.config.ts` (`expo.android.privacyPolicyUrl`)
- [ ] Data safety form: declare all data types collected
  - Personal info: email (for auth)
  - Health info: steps, heart rate, workouts (stored locally, encrypted)
  - App activity: analytics events (PostHog)
  - Crash logs (Sentry)
- [ ] Declare: data encrypted in transit (HTTPS) and at rest (AES-256-GCM)

### G.4 — Submission

- [ ] Upload AAB to Google Play Console
- [ ] Set up internal testing track first (closed alpha)
- [ ] Add test accounts for Google review team
- [ ] Submit for review
- [ ] Address any rejection feedback

### G.5 — Validation

- [ ] Install from Play Store internal track
- [ ] Full signup → workout → subscription flow works
- [ ] Crash-free for 24h on test device

**Exit criteria**: App approved and available on Google Play (internal/closed track initially).

---

## Phase H: Post-Launch Ops

**Objective**: Monitor, iterate, grow.

### H.1 — Monitoring Loop

- [ ] Daily: check Sentry for crashes (target: 99.5% crash-free)
- [ ] Weekly: review PostHog funnels (signup → first workout → 7-day retention)
- [ ] Monthly: review subscription metrics in RevenueCat

### H.2 — OTA Updates

- [ ] `expo-updates` already configured with EAS Update channels
- [ ] JS-only fixes ship via `eas update --channel production` (no new build needed)
- [ ] Native changes require new AAB + Play Store review

### H.3 — Growth Actions

- [ ] Open to public (move from closed to open track)
- [ ] Enable email confirmation in Supabase (spam prevention)
- [ ] Re-enable additional languages based on user locale data
- [ ] Add Google OAuth (already stubbed in AuthContext)

### H.4 — Scale Triggers

| Trigger | Action |
|---------|--------|
| >100 MAU | Review Render cold-start impact, consider paid tier ($7/mo) |
| >500 MAU | Enable Supabase connection pooling |
| >1K MAU | Move to Render Pro, add Redis for session cache |
| >5K MAU | Evaluate Supabase Pro ($25/mo) |
| Revenue >$100/mo | All infra costs covered by subscriptions |

---

## Execution Order

```
NOW                                                    PLAY STORE
 │                                                         │
 ▼                                                         ▼
[D.1] Supabase Auth config                              [G.4] Submit
  │                                                       ▲
[D.2] Server auth routes                                  │
  │                                                    [G.3] Legal
[D.3] Mobile auth integration                             │
  │                                                    [G.2] Assets
[D.4] Offline resilience                                  │
  │                                                    [G.1] Store listing
[D.5] Validate auth flow                                  │
  │                                                       │
[E.1] RevenueCat production                               │
  │                                                       │
[E.2] Server subscription verify                          │
  │                                                       │
[E.3] Mobile subscription flow                            │
  │                                                       │
[E.4] Feature gating                                      │
  │                                                       │
[E.5] Validate subscription                               │
  │                                                       │
[F.1] Sentry wiring ─────────────────────────────────────►│
  │                                                       │
[F.2] PostHog wiring ────────────────────────────────────►│
  │                                                       │
[F.3] Build config                                        │
  │                                                       │
[F.4] Production build ──────────────────────────────────►│
  │
[F.5] Performance pass
```

---

## Alfred Automation Scope

What Alfred can execute autonomously (with current tooling):

| Action | Capability |
|--------|-----------|
| Write server routes | Full — edit `server/` files, test with curl |
| Write mobile code | Full — edit `src/`, `app/` files, type-check |
| Edit configs | Full — `.env.example`, `app.config.ts`, `eas.json`, `render.yaml` |
| Run EAS builds | Requires terminal — `eas build` (needs EAS CLI login) |
| Deploy server | Requires git push to trigger Render auto-deploy |
| Supabase config | Dashboard-only (auth settings, RLS policies) — Alfred can generate SQL |
| RevenueCat config | Dashboard-only — Alfred can document exact steps |
| Play Store submission | Dashboard-only — Alfred can prepare all assets and text |
| Git operations | `git add`, `git commit` — push requires user confirmation |

**What needs your hands**:
1. Supabase dashboard: enable Email auth, set JWT expiry
2. RevenueCat dashboard: create production app, link Google Play
3. Google Play Console: create listing, upload AAB, submit
4. EAS CLI: `eas login` (one-time), then Alfred can trigger builds
5. `git push` (Alfred will prepare commits, you push)

---

## Current Commit Trail

| Commit | Phase |
|--------|-------|
| `694f235` | C.5 — Dead code removal (81MB models, LanguageSelector) |
| `6f308a6` | C.4 — Profile UX restructure |
| `48e054b` | C.3 — i18n modular split |
| `348f1a4` | C.2 — TTS, RTL, AI indicator, typewriter |
| `cfbbae0` | C.1 — Migration 14 fix |
| `97902b7` | B.5 — Pre-launch prep |
| `c7427e0` | B — Backend connectivity |
| `564b91b` | A — Foundation fixes |

**Next commit**: Phase D.2 (server auth routes)
