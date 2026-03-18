# FitQuest 2.0 — MAIN FOCUS PLAN

> Created: 18 March 2026 | Last Updated: 19 March 2026
> Purpose: Fix what we broke, cut what doesn't belong, polish what matters, ship to Google Play.

---

## STATUS LEGEND: ✅ Done | 🔧 In Progress | ❌ Not Started | 👤 USER ACTION REQUIRED

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

### 1.5 ✅ MapLibre/Jog Map Fatal Crash (Sentry REACT-NATIVE-3)
- **Root Cause:** MapLibre v10.4.2 incompatible with New Architecture (Bridgeless)
- **Fix:** Uninstalled `@maplibre/maplibre-react-native`, commented plugin in app.config.ts, commented ProGuard rules. JogMap has fallback UI.

### 1.6 🔧 Reanimated TypeError (Sentry)
- **Symptom:** `TypeError: undefined is not a function` in `__callListeners` during animation update
- **Status:** Monitoring post-MapLibre removal. May resolve with reduced native module load complexity.

---

## PHASE 2 — CODE QUALITY & STRICT MODE

### 2.1 ✅ TypeScript Strict Mode — COMPLETE
- `strict: true` + `noUncheckedIndexedAccess: true` enabled
- **529 errors → 0 errors** across 73+ files

### 2.2 ❌ ESLint Strict Rules
- Enable `no-undef`, `no-unused-vars`, `@typescript-eslint/strict`

---

## PHASE 3 — SCOPE REDUCTION

### 3.1 ✅ Remove Unnecessary Screens — COMPLETE
- Deleted 6 screens + 4 dead services
- Cleaned: _layout.tsx tabs, DropdownMenu refs, deprecated components

---

## PHASE 4 — GOOGLE PLAY COMPLIANCE

> Full audit: `docs/GOOGLE_PLAY_POLICY_COMPLIANCE_AUDIT.md` (13 categories)

### DEV Tasks (Copilot can implement)

| # | Task | Severity | Status |
|---|---|---|---|
| 4.1 | ✅ Fix fatal crashes (MapLibre removal) | BLOCKER | Done |
| 4.2 | ✅ Remove SYSTEM_ALERT_WINDOW permission | HIGH | Done |
| 4.3 | ✅ Add **prominent data consent screen** in onboarding | BLOCKER | Done — step 1 in onboarding |
| 4.4 | ✅ Add **age verification gate** (13+) before onboarding | HIGH | Done — step 0 in onboarding |
| 4.5 | ✅ Build **AAB** (`npm run build:aab`) | BLOCKER | Done — script added to package.json |
| 4.5b | ✅ **Data deletion mechanism** ("Delete My Data" in profile) | HIGH | Done — `deleteAllUserData()` wipes all user data |

### 👤 USER Tasks (require human action — Play Console, domain, assets)

| # | Task | Severity | Where | Notes |
|---|---|---|---|---|
| 4.6 | 👤 **Purchase domain** (fitquest.dev or similar) | BLOCKER | Domain registrar | Need HTTPS URL for privacy policy |
| 4.7 | 👤 **Deploy website** (privacy, terms, delete-account) | BLOCKER | Netlify/Cloudflare | `website/` folder is ready to deploy |
| 4.8 | 👤 **Create store listing assets** | BLOCKER | Design tool | Icon 512x512, Feature graphic 1024x500, 4-8 screenshots |
| 4.9 | 👤 **Fill IARC content rating** questionnaire | BLOCKER | Play Console | Answer honestly — fitness app, targets 13+, no violence/sex |
| 4.10 | 👤 **Complete Data Safety form** | BLOCKER | Play Console | Mappings ready in `docs/GOOGLE_PLAY_READINESS_REPORT.md` §9 |
| 4.11 | 👤 **Submit Health Apps Declaration** | HIGH | Play Console | Declare health-related data usage |
| 4.12 | 👤 **Accept Play App Signing** Terms of Service | HIGH | Play Console | Required before uploading AAB |
| 4.13 | 👤 **Check US Export Laws** encryption box | MEDIUM | Play Console | AES-256-GCM for local data = mass-market exemption |
| 4.14 | 👤 **Add medical disclaimer** to store listing description | HIGH | Play Console | Template: "FitQuest is not a medical device. Consult a healthcare professional." |
| 4.15 | 👤 **Audit exercise image licensing** | MEDIUM | Local | Verify all images in assets are licensed/original |
| 4.16 | 👤 **Recruit 12+ testers** for closed testing | BLOCKER | Play Console | Need 15-20 for buffer. 14-day testing gate before production. |
| 4.17 | 👤 **Upload AAB to closed testing track** | BLOCKER | Play Console | After AAB build + signing enrollment |

---

## PHASE 5 — TEST COVERAGE EXPANSION

### 5.1 ✅ Unit & Module Tests — 350 tests passing across 23 files
- anomalyDetector (25), intentRouter (29), sleepAnalysisEngine (26)
- aesEncryptionExtended (12), workoutGeneratorEdgeCases (17)
- Plus 18 original test files (241 tests)

### 5.2 ❌ Screen Smoke Tests
### 5.3 ❌ Integration Tests (DB init → seed → query, workout lifecycle, encryption round-trip)

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

## EXECUTION ORDER

1. ~~ACCENT_AMBER fix~~ ✅
2. ~~HealthConnect + Battery + Images~~ ✅
3. ~~Remove dead screens~~ ✅
4. ~~TypeScript strict mode (529 → 0)~~ ✅
5. ~~Fix MapLibre crash~~ ✅
6. ~~Remove SYSTEM_ALERT_WINDOW~~ ✅
7. ~~Test coverage expansion (241 → 350)~~ ✅
8. ~~Add consent screen + age gate~~ ✅
9. ~~Build AAB script~~ ✅ (`npm run build:aab`)
10. ~~Data deletion mechanism~~ ✅ (Delete My Data in profile)
11. 👤 **Deploy website** (USER — domain purchase + deploy) ← NEXT USER ACTION
12. 👤 **Store listing assets** (USER — icon, screenshots, graphics)
13. 👤 **Play Console forms** (USER — Data Safety, IARC, Health Apps, Export Laws, Signing)
14. 👤 **Upload AAB + start 14-day closed testing** (USER)
15. APK/AAB size reduction
16. Feature polish (ongoing)
17. 👤 **Production release** (USER)

---

## PRIVACY POLICY URL — SETUP GUIDE

**YES, you need a website.** Google Play requires a publicly accessible HTTPS URL for your privacy policy.

**Fastest path (free):**
1. You already have a `website/` folder with privacy policy, terms, and delete-account pages
2. Push to a GitHub repo (or use the existing FitQuest repo's `website/` folder)
3. Deploy via one of these free options:
   - **GitHub Pages**: Settings → Pages → Source: Deploy from branch → select folder `website/`
   - **Netlify**: Drag-and-drop `website/` folder at app.netlify.com → get a `.netlify.app` URL
   - **Cloudflare Pages**: Connect repo → set build output to `website/` → get a `.pages.dev` URL
4. Optional: buy a custom domain (fitquest.dev ~$12/yr) and point DNS to your host
5. Verify these URLs load: `/privacy`, `/terms`, `/delete-account`
6. Enter the privacy policy URL in Play Console → Store Listing → Privacy Policy URL

**Without a custom domain**, you can use the free subdomain (e.g., `fitquest.netlify.app/privacy`) — Google Play accepts any valid HTTPS URL.

---

## NOTES
- Git: `d9a310c` on origin/main (19 Mar 2026)
- Test devices: Galaxy A05 (primary), Galaxy A14 (compatibility testing)
- Google Play Console: Account created (March 2026)
- RevenueCat: Will wire up when API key available
- Build command: Always use `nohup` with `--max-workers=1` for low-RAM machine
- PostHog MCP: Available for AI-assisted analytics (`npx @posthog/wizard mcp add`)
