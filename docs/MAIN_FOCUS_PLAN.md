# FitQuest 2.0 — MAIN FOCUS PLAN

> Created: 18 March 2026 | Last Updated: 18 March 2026
> Purpose: Fix what we broke, cut what doesn't belong, polish what matters, ship to Google Play.

---

## STATUS LEGEND: ✅ Done | 🔧 In Progress | ❌ Not Started

---

## PHASE 1 — CRITICAL BUG FIXES

### 1.1 ✅ ACCENT_AMBER Crash (Blank Screen)
- **Fix:** Replaced undefined `ACCENT_AMBER` with `'#F4A427'` literal in DropdownMenu.tsx

### 1.2 ✅ HealthConnect Crash on Allow
- **Fix:** Added defensive guard + ProGuard rules for native module

### 1.3 ✅ Battery Permission Shows Code Terms
- **Fix:** Replaced `expo-constants` with explicit package name constant

### 1.4 ✅ Exercise Images Not Loading
- **Fix:** Added .webp fallback path resolution in ExerciseImage component

### 1.5 🔧 MapLibre/Jog Map Fatal Crash (Sentry REACT-NATIVE-3)
- **Symptom:** `RuntimeException: You should not use ReactNativeHost directly in the New Architecture`
- **Root Cause:** MapLibre v10.4.2 is incompatible with React Native New Architecture (Bridgeless). Native JNI crash at app startup during ReactHost initialization, before JS even loads.
- **Fix:** Remove `@maplibre/maplibre-react-native` from plugins + dependencies. JogMap already has fallback UI.

### 1.6 🔧 Reanimated TypeError (Sentry)
- **Symptom:** `TypeError: undefined is not a function` in `__callListeners` during animation update
- **Root Cause:** Reanimated native module initialization issue in New Architecture. Babel plugin is correctly last. Not reproducible from code — likely a race condition during cold start.
- **Status:** Monitoring. May resolve after MapLibre removal (reduces native module load complexity).

---

## PHASE 2 — CODE QUALITY & STRICT MODE

### 2.1 ✅ TypeScript Strict Mode — COMPLETE
- `strict: true` + `noUncheckedIndexedAccess: true` enabled
- **529 errors → 0 errors** across 73+ files over multiple sessions
- All tests pass: 18 files, 241 passed, 1 skipped

### 2.2 ❌ ESLint Strict Rules
- Enable `no-undef`, `no-unused-vars`, `@typescript-eslint/strict`

---

## PHASE 3 — SCOPE REDUCTION

### 3.1 ✅ Remove Unnecessary Screens — COMPLETE
- Deleted: autonomous-center, platform-studio, federation-hub, enterprise-hardening, style-guide, sitemap
- Deleted associated services: autonomousPolicyRuntime, platformStudioService, federationRegistryService, enterpriseHardeningService
- Cleaned: _layout.tsx tabs, DropdownMenu refs, deprecated Button.tsx + StatRing.tsx

---

## PHASE 4 — GOOGLE PLAY COMPLIANCE (NEW — PRIORITY)

### 4.1 🔧 Fix Fatal Crashes (MapLibre removal)
- Remove `@maplibre/maplibre-react-native` from app.config.ts plugins and package.json
- Rebuild APK — must have zero fatal crashes for Play Store

### 4.2 ❌ Add Prominent Data Consent Screen to Onboarding
- Google Play requires explicit consent before health/location/biometric collection
- Must show: what data, how used, how stored, who receives it
- Must have affirmative consent (checkbox, not pre-checked)
- Store consent timestamp in `app_state` table

### 4.3 ❌ Add Age Verification Gate (13+)
- Add "You must be 13+ to use FitQuest" confirmation before onboarding
- Log confirmation to `app_state` for audit trail

### 4.4 ❌ Remove SYSTEM_ALERT_WINDOW Permission
- Not needed for fitness app — Google Play restricts this permission

### 4.5 ❌ Build AAB (Android App Bundle)
- Google Play requires AAB format (not APK) since August 2021
- Command: `./gradlew bundleRelease` instead of `assembleRelease`
- Accept Play App Signing Terms of Service in Console

### 4.6 ❌ Deploy Website (fitquest.dev)
- Purchase domain
- Deploy website/ folder (Netlify or Cloudflare Pages)
- Verify: /privacy, /terms, /delete-account all load with HTTPS

### 4.7 ❌ Prepare Store Listing Assets
- App icon: 512x512 PNG
- Feature graphic: 1024x500
- 4-8 screenshots (phone 16:9 or 9:16)
- Short description (≤80 chars) + Full description (≤4000 chars) with medical disclaimer

### 4.8 ❌ Complete Google Play Console Forms
- Data Safety form (mapped in GOOGLE_PLAY_READINESS_REPORT.md §9)
- IARC content rating questionnaire
- Health Apps Declaration
- Target audience: 13+
- Ads declaration: No ads

### 4.9 ❌ Closed Testing Track (14-day gate)
- Upload AAB to closed testing track
- Recruit 12+ opted-in testers (need 15-20 for buffer)
- 14 consecutive days of testing required before production access

### 4.10 ❌ US Export Laws — Encryption Declaration
- App uses AES-256-GCM encryption
- Must self-classify under BIS and declare in Play Console
- Encryption is for local data protection only (non-military, mass-market exemption likely applies)

---

## PHASE 5 — TEST COVERAGE EXPANSION

### 5.1 ❌ Screen Smoke Tests
### 5.2 ❌ Integration Tests (DB init → seed → query, workout lifecycle, encryption round-trip)
### 5.3 ✅ Module Import Tests — 241 tests passing across 18 test files

---

## PHASE 6 — APK/AAB SIZE REDUCTION

### 6.1 ❌ Dependency Audit (61 production deps — remove unused)
### 6.2 ❌ Asset Optimization (873 exercise image folders)
### 6.3 ❌ R8 ProGuard Rules Review

---

## PHASE 7 — FEATURE POLISH

### Core (must be flawless): Dashboard, Workout Engine, Exercise Library, Move, Profile, Progress
### Secondary (should work): AI Coach/Professor, FitMind, Health Dashboard, Body Craft, Nutrition
### Utility (basic): Auth, Subscription (RevenueCat), Legal, Backups

---

## PHASE 8 — CI/CD PIPELINE

### 8.1 ✅ CI/CD Guide Created — `docs/CI_CD_GUIDE.md`
### 8.2 ❌ GitHub Actions implementation

---

## EXECUTION ORDER (Updated)

1. ~~ACCENT_AMBER fix~~ ✅
2. ~~HealthConnect + Battery + Images~~ ✅
3. ~~Remove dead screens~~ ✅
4. ~~TypeScript strict mode (529 → 0)~~ ✅
5. **Fix MapLibre crash** ← CURRENT
6. **Google Play compliance (consent, age gate, permissions, AAB)**
7. **Deploy website + store listing**
8. **Closed testing track (14 days)**
9. Test expansion
10. APK/AAB size reduction
11. Feature polish (ongoing)
12. Production release

---

## NOTES
- Test devices: Galaxy A05 (primary), Galaxy A14 (compatibility testing)
- Google Play Console: Account created (March 2026)
- RevenueCat: Will wire up when API key available
- Build command: Always use `nohup` with `--max-workers=1` for low-RAM machine
- PostHog MCP: Available for AI-assisted analytics (`npx @posthog/wizard mcp add`)
