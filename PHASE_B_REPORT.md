# Phase B Report — Backend Connectivity Verification

**Date**: 2026-04-05  
**Commit**: (this commit)  
**Server**: https://fitq-56sj.onrender.com v5.0.0

---

## Summary

Phase B verified backend connectivity, deployed the latest server code, audited the authority client, and identified migration gaps blocking auth flow testing.

---

## Task 0: Debug Panel Removal ✅

- Deleted `app/dev/debug-panel.tsx` and `app/dev/` directory
- Removed `<Tabs.Screen name="dev/debug-panel" />` from `app/_layout.tsx`
- Updated `tests/navigation/routeSafety.test.ts` to remove the route reference
- No dangling imports found
- TypeScript: 0 errors, 562 tests pass

## Task 1: Server Deployment ✅

- Pushed `main` (25ec449) to `fitq` remote (was at cfbbae0)
- Render auto-deployed successfully
- Health check confirmed: v5.0.0, all 5 engines operational (trust_decay, anomaly, enforcement, reputation, adaptive_response)

## Task 2: Supabase Migration Status ❌ BLOCKED

**Auth endpoint test result**: `POST /auth/email/register` returns `"Failed to create account."` — the Supabase `users` table exists but **lacks the `password_hash` column** added by migration `003_token_lifecycle.sql`.

### Migrations That Need Manual Execution in Supabase SQL Editor

Run these **in order** in the [Supabase SQL Editor](https://supabase.com/dashboard/project/czfsoheldgxyzowymfay/sql):

1. **`003_token_lifecycle.sql`** — Adds `password_hash`, `name`, `last_login` to `users`; creates `refresh_tokens` table. **CRITICAL for auth.**
2. **`003_device_tokens.sql`** — Creates `device_tokens` table for device binding.
3. **`004_device_tokens_unique_active.sql`** — Adds unique constraint on active device tokens.
4. **`005_trust_alerts.sql`** — Creates `trust_alerts` table for security alerting.
5. **`006_revenue_events.sql`** — Creates `revenue_events` table for webhook logging.
6. **`007_user_attribution.sql`** — Creates `user_attribution` table for attribution tracking.

All migrations are idempotent (use `IF NOT EXISTS` / `IF NOT EXISTS`). Safe to run even if some tables already exist.

**Migration files location**: `server/migrations/`

## Task 3: Full Auth Flow Test ❌ BLOCKED

Cannot test register/login/refresh/logout until migration `003_token_lifecycle.sql` is run on Supabase. The `password_hash` column is required for account creation.

**After running migration 003**, test with:
```bash
curl -s -X POST https://fitq-56sj.onrender.com/auth/email/register \
  -H "Content-Type: application/json" \
  -d '{"email":"phaseB_test@fitquest.dev","password":"PhaseB_Test123!","name":"Phase B Test"}'
```

## Task 4: authorityClient.ts Audit ✅

The authority client is well-implemented:

| Check | Status |
|-------|--------|
| `getApiBaseUrl()` reads `EXPO_PUBLIC_API_BASE_URL` | ✅ Via `apiBaseUrl.ts` with URL validation |
| `requestAI()` POSTs to `/ai/request` | ✅ With userId, deviceId, prompt |
| `verifySubscription()` POSTs to `/verify/subscription` | ✅ (Note: uses `/verify/subscription`, not `/subscriptions/status`) |
| `getServerSubscriptionStatus()` POSTs to `/subscriptions/status` | ✅ Separate function exists |
| Handles 401/network errors gracefully (returns null) | ✅ Never throws |
| AI throttle: 2s | ✅ `AI_THROTTLE_MS = 2_000` |
| Subscription throttle: 5min | ✅ `SUB_THROTTLE_MS = 5 * 60 * 1000` |
| Subscription cache with `clearSubscriptionCache()` | ✅ |
| Receipt verification via `/subscriptions/verify` | ✅ |
| 8s timeout with AbortController | ✅ |
| HTTPS-only enforcement (except dev localhost) | ✅ Via `apiBaseUrl.ts` |

## Task 5: Device Binding Check ⚠️ KNOWN GAP (Acceptable)

- **Server**: Device binding routes exist (`/device/register`, `/device/challenge`), `validateDeviceToken()` middleware active
- **Client**: `authorityClient.ts` accepts `deviceId` parameter and sends `device_id` in requests, but **no client-side device registration service exists** (`src/services/deviceService.ts` not found)
- **Behavior**: Without a registered device token, protected routes return 401 → client treats as offline → graceful degradation to local mode
- **Status**: Acceptable for Phase B. Device binding is a Phase D concern.

## Task 6: Client Connectivity ✅

- `.env` has `EXPO_PUBLIC_API_BASE_URL=https://fitq-56sj.onrender.com` ✅
- `.env` has `EXPO_PUBLIC_AUTHORITY_API_KEY` set ✅
- `apiBaseUrl.ts` validates URL structure and enforces HTTPS ✅

## Task 7: TypeScript + Tests ✅

- `npx tsc --noEmit`: 0 errors
- `npx vitest run`: 562 tests, 562 passing (after route safety test fix)

---

## Known Gaps

1. **Supabase migrations not run** — Auth flow blocked until `003_token_lifecycle.sql` is executed manually
2. **Device binding not implemented client-side** — Server gracefully degrades, acceptable for Phase B
3. **Server API key validation** — The `requireAuth` middleware uses JWT validation, not API key. The `EXPO_PUBLIC_AUTHORITY_API_KEY` in `.env` is sent as Bearer token but public routes (register/login) don't need it

## Recommended Next Steps

1. **IMMEDIATE**: Run migrations 003-007 in Supabase SQL Editor (003_token_lifecycle is critical)
2. **After migrations**: Re-test full auth flow (register → login → refresh → logout)
3. **Phase D**: Implement client-side device registration service
4. **Phase D**: Wire auth flow into app login/registration screens
