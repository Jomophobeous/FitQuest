# Mobile TODO / Progress (FitApp2)

Purpose: single-source checklist for mobile work — track what has been done, what's in-progress, and the immediate next steps. Update this file whenever you complete or start a task (include date + short note).

Last updated: 2026-02-08 (UTC)

## Status legend

-   ✅ completed
-   🔁 in-progress
-   ⏳ planned / backlog

## Future Tests

-   ⏳ Full Phase 2 verification (`npm run verify:phase2`) — deferred due memory usage (typecheck + tests + smoke in one pass)
-   ⏳ Full mobile regression run after stabilization (typecheck + tests + live device OAuth)
-   ⏳ Extended server regression run (auth rotation edge cases + backup overwrite/read consistency)

---

## Deferred (saved for later) — 2026-02-12

### Google OAuth live verification (Android device/emulator)

-   ⏳ Start backend with OAuth env loaded (`server/.env` has `GOOGLE_CLIENT_ID`)
-   ⏳ Start Expo app with root `.env` loaded (`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` set)
-   ⏳ On login screen, tap **Continue with Google** and complete account picker flow
-   ⏳ Verify app navigates to dashboard and user session is stored
-   ⏳ Verify server accepts token exchange (`POST /auth/google`) without `401/501`
-   ⏳ Negative check: remove client ID and confirm UI shows configuration error

Notes saved:
-   Current Android package in native build: `com.anonymous.mobile`
-   Debug SHA-1 used for OAuth setup: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

---

## Checklist (high-level)

16.  Expo Go readiness — ✅ (2026-01-21)

-   Babel config includes NativeWind and Reanimated plugins (correct order).
-   Metro config present; add SVG transformer if SVGs as components are needed.
-   All required assets and app.json fields present.
-   Ready for Expo Go and further feature setup.

1.  Map web → mobile screens — ✅ (2026-01-18)
    
    -   Mapped Dashboard, TrainToday/ActiveSession, Exercise flows, Progress, Food assistant, Onboarding, Paywall.
2.  Scaffold design system (tokens, shared components) — ✅ (2026-01-18)
    
    -   Added: `src/design/tokens.ts`, `src/components/{Button,Card,StatRing}.tsx`, `DesignSystemGallery` demo.
    -   Verified: wired into `App.tsx` (visual gallery on launch).
3.  Add native animation & gesture libs — ✅ (2026-01-20)
    

-   All Expo/React Native dependencies installed and version-matched.
-   Peer dependency (react-native-worklets) installed.
-   Ready for Reanimated Babel/plugin setup.

4.  Scaffold navigation (RootStack) — ✅ completed (2026-01-21)
5.  High-fidelity Dashboard screen — ✅ completed (2025-07-17) — Full glass-morphism rewrite with GlassUI components
6.  TrainToday → ActiveSession flow — ✅ completed (2026-01-21)
7.  Workout loop + XP wiring — ✅ completed (2026-01-21)
8.  Exercise list & Exercise detail — ✅ completed (2025-07-17) — Fixed SQL + full glass UI rewrite
9.  Progress (photo timeline + charts) — ⏳ planned
10.  Food assistant (AI meals) — ⏳ planned
11.  Onboarding & auth screens — ⏳ planned
12.  Paywall & subscription UI — ⏳ planned
13.  GraphQL + auth integration — ⏳ planned
14.  Extract/shared assets & queries (from web frontend) — ⏳ planned
15.  Micro-interactions & Lottie animations — ✅ completed (2025-07-17) — Reanimated animations across all screens
16.  Accessibility, tests & E2E — ⏳ planned
17.  Glass-morphism UI system (Figma integration) — ✅ completed (2025-07-17)
18.  Dropdown menu UX cleanup — ✅ completed (2025-07-17)
19.  Exercise loading pipeline fix — ✅ completed (2025-07-17)
20.  AI Coach screen glass UI rewrite — ✅ completed (2026-02-06)
21.  Profile screen glass UI rewrite — ✅ completed (2026-02-06)
22.  Database seed duplicate constraint fixes — ✅ completed (2026-02-06)
23.  TTS voice instructions for workouts — ✅ completed (2026-02-06)
24.  Glass modal for jog completion — ✅ completed (2026-02-06)
25.  Move screen layout height fixes — ✅ completed (2026-02-06)
26.  XP formula fixes (steps & jog) — ✅ completed (2026-02-06)
27.  Stop tracking button — ✅ completed (2026-02-06)
28.  Analytics page — ✅ completed (2026-02-06)
29.  Saved/My Workouts screen — ✅ completed (2026-02-06)
30.  Exercise library balancing (70 new templates) — ✅ completed (2026-02-06)
31.  AI Coach: exercise recommendations + meal prep — ✅ completed (2026-02-06)
32.  Location service + Meal Prep screen — ✅ completed (2026-02-06)
33.  Dropdown menu additions (Analytics, My Workouts, Meal Prep) — ✅ completed (2026-02-06)

---

## 🔁 IN PROGRESS — Major UI Refactor (2026-02-06)

### Phase 1: Core Functionality Fixes
34. [ ] Add ALL 722 exercises to app — expand exercise generator/seed to include full library
35. [ ] Add bell ring sound when exercise timer stops — integrate audio notification
36. [ ] Fix timing consistency — counter/voice stops immediately when user presses complete
37. [ ] Workout rating — move rating prompt to AFTER entire session completes (not per-exercise)
38. [ ] Fix location call error — debug expo-location permissions/calls
39. [ ] Add proper filters to Create Workout — muscle groups, difficulty, equipment, training type
40. [ ] Fix exercise count inconsistency — available vs library counts should match
41. [ ] Move "Create Workout" from dropdown to Exercise Library screen

### Phase 2: Kill Visual Excess
42. [ ] Remove 70-80% of glows, blurs, gradients
43. [ ] Use flat surfaces with 1 elevation level max
44. [ ] Result: Cleaner, faster visual parsing, serious not "gaming UI"

### Phase 3: Rebuild Hierarchy
45. [ ] One screen = one primary objective rule
46. [ ] Train screen priorities: Primary=Start Workout, Secondary=Recovery Status, Tertiary=Exercise list
47. [ ] Make Recovery Status full-width, high-contrast, warning-colored
48. [ ] Exercise cards: reduce height by ~25%, push metadata into single muted line

### Phase 4: Enforce Color Doctrine
49. [ ] Pick ONE accent color (remove purple OR green, not both)
50. [ ] Primary action → Green
51. [ ] Warnings → Amber/Red
52. [ ] Progress → Same green, different opacity
53. [ ] Everything else → Grayscale
54. [ ] Stats should be gray unless actionable

### Phase 5: Typography Discipline
55. [ ] 3 weights max: Bold (titles/actions), Medium (primary info), Regular (metadata)
56. [ ] Increase line height for secondary text
57. [ ] Reduce font size for repeated info
58. [ ] Make numbers visually heavier than labels

### Phase 6: Reduce Redundancy
59. [ ] Remove per-exercise "calisthenics" tag — put once at top
60. [ ] Combine sets/reps/rest into compact format: "2× (8–15) · 60s"
61. [ ] Dashboard: don't repeat kcal everywhere

### Phase 7: Fix Dashboard
62. [ ] New priority order: Today's Goal > Recovery/Readiness > Last Workout > Everything else
63. [ ] Make Today's Goal the largest card
64. [ ] Remove glow from stat pills
65. [ ] Replace 0% ring with horizontal progress bar or vertical fill gauge

### Phase 8: Improve Spacing Rhythm
66. [ ] Spacing scale ONLY: 8, 16, 24, 32 — no random padding
67. [ ] Apply consistently across all cards and sections

### Phase 9: Match Tone to Message (State-Driven UI)
68. [ ] When recovery is BAD: darker background, sharper color contrast, less animation
69. [ ] When recovery is GOOD: lighter accents, motion allowed

### Phase 10: Animation Discipline
70. [ ] Remove idle animations
71. [ ] Keep ONLY: button press, progress change, screen transitions
72. [ ] Duration: 120-180ms, NO bounce

### Phase 11: Validation
73. [ ] Per-screen test: "What should user do in next 5 seconds?" — if UI doesn't answer instantly, redesign

---

## 🚀 FITQUEST 2.0 TRANSFORMATION ROADMAP (2026-02-07)

### PHASE 0: CRITICAL SECURITY LOCKDOWN (Weeks 1-2)
74. [x] ✅ Create `src/security/EncryptedDatabase.ts` — v2 rewrite with CTR+HMAC authenticated encryption, auto v1→v2 migration (2026-02-08)
75. [x] ✅ Create `src/security/BiometricAuth.ts` — biometric-first auth, PBKDF2-hardened passcode, constant-time comparison, emergency wipe after 15 failures (2026-02-08)
76. [x] ✅ Create `src/security/AESEncryption.ts` — PBKDF2-SHA256 key derivation (100K iterations), CTR-mode cipher, HMAC-SHA256 Encrypt-then-MAC (2026-02-08)
77. [x] ✅ Create `src/security/StorageMigration.ts` — AsyncStorage → SecureStore migration (2026-02-07)
78. [x] ✅ Rewire `src/context/AuthContext.ts` — SecureStore + BiometricAuth integration (2026-02-07)
79. [ ] Update `app/login.tsx` — biometric prompt UI with fallback to passcode
80. [x] ✅ Added `expo-local-authentication` + `expo-crypto` dependencies (2026-02-07)

### PHASE 1: REALISTIC SENSOR INFRASTRUCTURE (Weeks 3-4)
81. [x] ✅ Create `src/engines/SensorFusionEngine.ts` — Accel+Gyro+Pedometer fusion at 10Hz, activity classification, rep counting (2026-02-07)
82. [x] ✅ Step counting + activity recognition built into SensorFusionEngine (2026-02-07)
83. [x] ✅ Activity classification in SensorFusionEngine — STATIONARY/WALKING/RUNNING/CYCLING/EXERCISE (2026-02-07)
84. [x] ✅ Create `src/engines/HealthMonitor.ts` — daily health tracking, goals, weekly summaries (2026-02-07)
85. [x] ✅ Schema v8 — added heart_rate_readings, anomaly_log, daily_health_summaries, document_content_hashes tables (2026-02-08)
86. [ ] Wire sensors into Move screen — replace basic pedometer with SensorFusion engine

### PHASE 2: FITMIND — COGNITIVE FITNESS MODULE (Weeks 5-8)
87. [x] ✅ FitMind database tables in schema v7-v8 (fitmind_documents, reading_sessions, annotations, flashcards, goals, streaks) (2026-02-07)
88. [x] ✅ Create `src/fitmind/DocumentProcessor.ts` — file/text/URL import, Flesch-Kincaid readability, keyword extraction (2026-02-07)
89. [x] ✅ Create `src/fitmind/DocumentImportPipeline.ts` — validation, sanitization, deduplication, chunking, batch import, quotas (2026-02-08)
90. [x] ✅ Create `src/fitmind/DualAIEngine.ts` — COACH + PROFESSOR template-based AI with context injection (2026-02-07)
91. [ ] Create `src/fitmind/KnowledgeRetriever.ts` — semantic search over knowledge graph (requires embeddings)
92. [x] ✅ Create `src/fitmind/ReadingSessionTracker.ts` — session state machine, focus scoring, idle detection, WPM tracking (2026-02-08)
93. [x] ✅ SM-2 spaced repetition in `src/fitmind/schema.ts` FitMindService (2026-02-07)
94. [x] ✅ FitMind screens — `app/fitmind-library.tsx` + `app/fitmind-reader.tsx` (2026-02-07)
95. [ ] Add FitMind tab to main navigation

### PHASE 3: ADVANCED FEATURES & INTEGRATION (Weeks 9-12)
96. [x] ✅ Create `src/engines/RealisticHealthEngine.ts` — BMR, TDEE, body fat, HR zones, macros, recovery, 1RM (2026-02-07)
97. [ ] Wire analytics screen to real SQLite data
98. [x] ✅ Schema v8 tables: heart_rate_readings, anomaly_log, daily_health_summaries (2026-02-08)
99. [ ] Create `src/health/EmergencyService.ts` — emergency GPS tracking
100. [ ] Add external book source integration
101. [x] ✅ Schema v8 migration complete — v0→v8 with auto-migration chain (2026-02-08)

### PHASE 2-3 ADVANCED ENGINES (2026-02-08)
107. [x] ✅ Create `src/engines/AnomalyDetector.ts` — Z-score, IQR, rate-of-change, moving average, multi-metric correlation, auto health alerts
108. [x] ✅ Create `src/engines/SleepAnalysisEngine.ts` — sleep quality scoring, stage estimation, sleep debt, circadian consistency, recovery multiplier
109. [x] ✅ Create `src/engines/BackgroundHealthEngine.ts` — orchestrates all health subsystems, periodic collection, anomaly checking, daily summaries, weekly reports, composite health score
110. [x] ✅ Create `src/engines/IntentRouter.ts` — natural language intent classification, keyword scoring + context weighting, entity extraction, routes to COACH/PROFESSOR/HEALTH/WORKOUT/NAVIGATION/SETTINGS
111. [x] ✅ Create `app/health-dashboard.tsx` — unified health & wellness overview, health score ring, daily metric rings, anomaly alerts, step/sleep trends, recovery/sleep cards, quick actions

### PHASE 4: PRODUCTION HARDENING (Weeks 13-16)
102. [ ] Add Jest + React Native Testing Library — engine unit tests (workoutGenerator, progressionEngine, recoveryEngine)
103. [ ] Security tests — encryption at rest verification, biometric auth flow, session expiry
104. [ ] Performance optimization — SQLite connection pooling, React.memo on list items, getItemLayout for FlatLists
105. [ ] Add ESLint + Prettier configuration
106. [ ] Medical disclaimer system — "consult your physician" warnings on health features
107. [ ] Battery-aware background tasks — respect iOS/Android doze modes for health monitoring
108. [ ] Update `.github/copilot-instructions.md` with FitQuest 2.0 architecture

---

## Completed (short changelog)

-   2026-01-18: Added design tokens + `Button`, `Card`, `StatRing` components.
    
-   2026-01-18: Added `DesignSystemGallery` demo and wired it into `App.tsx`.
    
-   2026-01-18: Updated `mobile/package.json` with recommended native deps.
    
-   2026-01-18: Added `mobile/README.md` with install / Reanimated notes.
    
-   2026-01-20: Resolved all Expo/React Native dependency issues and installed required peer dependencies.
    
-   2026-01-21: Completed Expo Go readiness (Babel, Metro, app.json, assets verified).
    
-   2026-01-21: Scaffolded Android navigation and empty core screens (Splash, Auth, Dashboard, Craft-My-Body, Workout Player, Progress, Paywall, Profile). Wired flow: Launch → Sign in → Dashboard → Craft-My-Body → Workout → Progress.
    
-   2026-01-21: Workout loop complete — added Start, Timer (stopwatch), exercise list placeholder (5 items), and Finish which navigates back to Dashboard with a mock completion state.
    
-   2026-01-21: Workout loop + XP confirmed — added `XP` context, awarding 50 XP on workout finish, level-up feedback, and Dashboard XP/Level visualization.
    
-   2025-07-17: **Bug fix — Empty exercises everywhere**: Root cause was `getExercises()` in `src/database/service.ts` using `LEFT JOIN exercise_training_types` + `WHERE` clause that eliminated all rows. Replaced with subquery approach (`e.id IN (SELECT exercise_id FROM exercise_training_types WHERE ...)`).

-   2025-07-17: **Database integrity check**: Added junction table verification in `src/database/index.ts` — after `seedExercises()`, checks that `exercise_muscles` and `exercise_training_types` are populated; force re-seeds if empty.

-   2025-07-17: **Dropdown menu cleanup**: Removed "Step Counter" and "Jog History" from `DropdownMenu.tsx` (already accessible via bottom tab bar). Rewrote dropdown with Reanimated staggered animations, LinearGradient header, colored icon containers, spring press scale.

-   2025-07-17: **Installed `expo-linear-gradient` and `expo-blur`** for glass-morphism and gradient effects across all screens.

-   2025-07-17: **Created GlassUI component library** (`src/components/ui/GlassUI.tsx`): GlassCard, GradientHeader, PulseDot, StatChip, AnimatedCounter, GradientButton (3 variants, 3 sizes), WeekCalendar, ProgressRing, SectionHeader, AnimatedListItem. Full dark/light theme support.

-   2025-07-17: **Figma UI integration — full screen rewrites** (glass-morphism + Reanimated animations + LinearGradient effects):
    - `app/dashboard.tsx`: Gradient hero header, animated streak badge, StatChip row, WeekCalendar, ProgressRing daily goal card, GradientButton quick actions, animated workout list.
    - `app/exercises.tsx`: Gradient header with count, glass search bar with focus animation, gradient category pills, animated exercise cards with accent strip + difficulty badges + muscle tags.
    - `app/move.tsx`: Gradient header, GlassCard step hero with ProgressRing, animated jog card with pulse, gradient controls, animated history items.
    - `app/fitquest.tsx`: All 7 states rewritten (loading, error, completion, generating, ready/preview, in_progress, idle) with glass cards, gradient progress bars, animated transitions, trophy glow effects.
    - `src/components/DropdownMenu.tsx`: Reanimated backdrop/menu/item stagger, gradient header, spring press scale, colored icon backgrounds.

-   2026-02-06: **AI Coach screen glass UI rewrite** (`app/coach/index.tsx`): Gradient header with PulseDot "Online" status, animated typing indicator with bouncing dots, glass message bubbles with gradient robot avatar, user messages with LinearGradient fill, staggered suggestion chips with colored icons, gradient send button with press animation.

-   2026-02-06: **Profile screen glass UI rewrite** (`app/profile.tsx`): Animated gradient avatar with pulsing glow ring, live XP progress bar from database, StatChip row (streak/workouts/XP), ProgressRing achievements section, animated settings menu items with icons, functional dark mode toggle wired to ThemeContext, logout with Alert confirmation.

-   2026-02-06: **Database seed constraint fixes** (`src/database/seed.ts`): Fixed UNIQUE constraint violations on `exercise_muscles`, `exercise_equipment`, `exercise_training_types` by deduplicating arrays before insert and using `INSERT OR IGNORE`. Prevents same muscle appearing in both primary and secondary arrays from crashing. Schema bumped to v4.

-   2026-02-06: **TTS voice instructions for workouts** (`app/fitquest.tsx`, `src/hooks/useFitQuestWorkout.ts`):
    - Wired `audioService` into workout flow - speaks exercise intro and setup when transitioning to each exercise
    - Added `WorkoutExerciseDisplay` audio fields: `audioIntro`, `audioSetup`, `audioExecution`, `audioTransition`
    - Added voice toggle button in session clock bar with PulseDot speaking indicator
    - Voice state persisted through `audioService.updateSettings()`
    - Import `audioService` from `src/services/audioService.ts` (expo-speech)

-   2026-02-06: **Glass modal for jog completion** (`app/move.tsx`):
    - Replaced plain `Alert.alert` with premium glass modal for jog completion
    - Modal shows: runner icon with gradient glow, distance/duration/calories stats in colored glass boxes, XP earned badge with gradient, "Awesome!" button
    - Added `JogCompletionData` interface and modal state management
    - Imported `Modal` from react-native, `SlideInUp` from reanimated

-   2026-02-06: **Fixed glow/glass text height glitch** (`app/move.tsx`):
    - Added `minHeight: 48` to `trackingButtonWrap` and `trackingLive` styles for consistent heights when switching between Start button and "Tracking active" text
    - Added `minHeight: 48` to `jogStartButtonWrap` style
    - Added `minHeight: 180` to `activeJog` style to prevent layout jumps

-   2026-02-06: **XP formula fixes** (`src/services/xpService.ts`):
    - Step XP: Changed from 1 XP per 100 steps (capped 100/day) → 4 XP per 1,000 steps (incremental, no daily cap)
    - Jog XP: Changed from 50 base + 10 per 500m → 10 XP per 100m (no base, purely distance-based)
    - Added incremental step tracking — awards XP for new milestones without re-awarding already-counted steps

-   2026-02-06: **Stop tracking button** (`app/move.tsx`):
    - Added "Stop" button next to "Tracking active" PulseDot when step tracking is active
    - Button calls `stopTracking()` from usePedometer hook + awards step XP for steps tracked so far
    - Glass-styled button with error color border and stop icon

-   2026-02-06: **Analytics page** (`app/analytics.tsx`):
    - Full analytics dashboard with Weekly/Monthly toggle
    - Workout frequency bar chart (proportional View-based bars)
    - XP progress trend visualization
    - Muscle group heatmap (intensity-colored grid)
    - Steps & jog summary cards
    - Calendar heatmap showing active days for current month
    - Personal records section and streak/consistency stats
    - Added to DropdownMenu as "Analytics" with teal chart-bar icon

-   2026-02-06: **Saved Workouts screen** (`app/saved-workouts.tsx`):
    - Lists custom workouts saved by user from SQLite database
    - Cards show workout name, exercises, duration, creation date
    - Expand/collapse to view details, delete with confirmation
    - "Start Workout" navigates to workout player
    - Floating action button links to Create Workout
    - Empty state with feature list
    - Added to DropdownMenu as "My Workouts" with folder-star icon

-   2026-02-06: **Create Workout improvements** (`app/create-workout.tsx`):
    - Added folder icon button in header to navigate to Saved Workouts
    - Multiple workouts can be created and viewed later

-   2026-02-06: **Exercise library balancing** (`src/database/exerciseGeneratorExpanded.ts`):
    - Added 70 new exercise templates across 5 categories
    - Flexibility: +15 (Standing Forward Fold, Butterfly Stretch, Thread the Needle, etc.)
    - Posture/Getting Taller: +15 (Thoracic Extension, Prone Y/T/W Raise, Band Pull-Apart, etc.)
    - Speed/Faster: +15 (Mountain Climbers, Box Jump, Jump Rope, Hill Sprint, etc.)
    - Mental Clarity: +10 (Yoga Nidra, Loving-Kindness Meditation, Grounding Exercise, etc.)
    - Building Muscle: +15 (Bulgarian Split Squat, Nordic Curl, Dragon Flag, Muscle-up, etc.)
    - Seed threshold bumped from 200→400 to force re-seed with new exercises

-   2026-02-06: **AI Coach enhancements** (`app/coach/index.tsx`):
    - Added "Recommend exercises for me" topic — context-aware suggestions based on fatigue, goals, and exercise count
    - Added "Meal prep ideas" topic — comprehensive meal timing and food suggestions
    - Added "Macros & calories" topic — TDEE, protein, carb, fat guidelines
    - Updated quick suggestion chips: "Recommend exercises" and "Meal prep ideas" now top of list
    - CoachContext now includes exerciseCount from database

-   2026-02-06: **Location service + Meal Prep screen** (`src/services/locationService.ts`, `app/meal-prep.tsx`):
    - Created locationService with expo-location: getCurrentLocation, reverseGeocodeAsync, hasLocationPermission
    - Created FoodItem type with available_regions for location filtering
    - Global food database with 15 universal foods (proteins, carbs, fats, veggies, fruits)
    - REGION_SPECIFIC_FOODS placeholder ready for user-provided location-specific food data
    - getFoodsByLocation filters by ISO country code
    - getMealSuggestions provides meal-type-specific food lists with tips
    - Meal Prep screen: 6 meal types (breakfast, pre-workout, lunch, post-workout, dinner, snack)
    - Location badge with tap-to-refresh and city/country display
    - Color-coded food cards with nutrition info
    - Added to DropdownMenu as "Meal Prep" with green food icon

-   2026-02-06: **Dropdown menu expanded** (`src/components/DropdownMenu.tsx`):
    - Now 9 items: Exercise Library, Progress Photos, Create Workout, AI Coach, Analytics, Meal Prep, My Workouts, Subscription, About FitQuest
    - All new routes registered in `app/_layout.tsx` as hidden tabs

---

## How to verify locally

1.  cd `mobile`
2.  npm install
3.  Add Reanimated plugin to `babel.config.js` (see README) — required before running.
4.  npm start → open in Expo Go or simulator → you should see the "Design system — components" gallery.
5.  Verify: Stat rings animate, buttons/cards render, tokens apply (background, spacing).

---

## Next immediate actions (pick one)

-   A (recommended): Complete Reanimated + Gesture Handler setup and add an animated swipe card example. (blocking for micro-interactions)
-   B: Scaffold `RootStack` and port `Dashboard` mock with static data.

Branch suggestion: `mobile/feat/design-system` (already used) → next `mobile/feat/animations` or `mobile/feat/dashboard`

---

## Notes / conventions

-   Keep UI tokens in `src/design/tokens.ts` as the single source of truth.
-   Add component demos to `src/screens/DesignSystemGallery.tsx` when introducing new primitives.
-   When porting screens, add a `*.mock.ts` with sample data to make visual QA quick.

---

If you want, I can open a PR with these changes and add a CI job that runs a visual smoke test on the gallery.

---

## Run logs / Errors (detailed)

-   2026-01-18 10:12:00 UTC — npm install
    
    -   Command: `cd mobile && npm install`
    -   Result: Success (packages added). ✅
    -   Action: None needed.
-   2026-01-18 10:14:00 UTC — Failed Expo prebuild (wrong cwd)
    
    -   Command: `cd mobile ; npx expo prebuild --platform android --no-install`
    -   Result: Error: attempted to change directory to `C:UserstumisOneDriveDocumentsGitHubFitApp2mobilemobile` (path does not exist).
    -   Error Output: `cd : Cannot find path 'C:UserstumisOneDriveDocumentsGitHubFitApp2mobilemobile' because it does not exist.`
    -   Troubling: Running `cd mobile` while already in the `mobile` folder causes this failure. Use `npx expo prebuild --platform android --no-install` if already in `mobile`, or `cd mobile && npx expo prebuild --platform android --no-install` when running from the repo root.
    -   Action: Retry from the correct working directory.
-   2026-01-18 10:14:30 UTC — Expo prebuild
    
    -   Command: `npx expo prebuild --platform android --no-install`
    -   Result: Native `android/` created; `android.package` set to `com.anonymous.mobile`.
    -   Note: dev manifest suggested installing `expo-system-ui` for `userInterfaceStyle` feature.
    -   Action: Prebuild succeeded, proceed to native run when emulator available.
-   2026-01-18 10:16:10 UTC — Attempt to run Android build
    
    -   Command: `npx expo run:android`
    -   Result: Command failed: No Android connected device found, and no emulators could be started automatically.
    -   Error: `CommandError: No Android connected device found, and no emulators could be started automatically.`
    -   Troubling: The CI here can't start an emulator; requires a running AVD or physical device.
    -   Action/Fix: Start an AVD via Android Studio or set up `ANDROID_SDK_ROOT` and ensure `adb` is in PATH.
-   2026-01-18 10:18:30 UTC — adb check
    
    -   Command: `adb devices`
    -   Result: `adb` not found (`'adb' is not recognized as the name of a cmdlet`).
    -   Troubling: `adb` missing from PATH prevents automatic emulator detection. This is a blocker for local native runs.
    -   Action/Fix: Add `platform-tools` to PATH (e.g., `C:Users<you>AppDataLocalAndroidSdkplatform-tools`) or run commands from Android Studio terminal.
-   2026-01-18 10:23:00 UTC — Expo dev server responded 500
    
    -   Symptom: The development server returned response error code: 500 when opening in Expo Go.
    -   Action taken: Restarted Metro with cleared cache: `npx expo start -c` to get a full stack trace and fresh bundle.
    -   Troubling: 500 errors prevent loading the bundle in Expo Go; common causes: Metro cache, malformed JS (syntax/type issues), or native module mismatches after prebuild.
    -   Next steps: Check Metro logs for stack trace; reproduce after cleaning cache; revert recent changes if error trace points to a specific file.
-   2026-01-18 10:30:00 UTC — Git commit & push
    
    -   Action: Created branch `mobile/feat/native-setup` and committed scaffold + native config; pushed to remote.
    -   PR creation: prepared a PR draft but GitKraken auth prevented automatic creation (requires sign-in).
    -   Troubleshooting: PR should be created from the branch once authenticated or via GitHub web UI.

---

## Troubles that need attention (short)

-   `adb` not in PATH on development machine — blocks `npx expo run:android` and automated emulator detection. Please add platform-tools to PATH or start an AVD manually.
-   Running `cd mobile` while already inside the `mobile` folder will cause a "path not found" error (attempts to `cd` into `mobile/mobile`). Check your current working directory before running commands; use `npx expo prebuild` if already in `mobile`, or `cd mobile && npx expo prebuild` when running from repo root.
-   Development server 500 errors — needs stack trace from Metro to pinpoint whether it's Metro cache, runtime JS error, or a native module mismatch after prebuild. Re-running `npx expo start -c` and checking terminal logs will provide the error location.
-   PR automation blocked by local GitKraken auth — sign in to enable automatic PR creation, or create the PR via GitHub manually.

---

Update notes: these entries record what happened during the current session and provide exact commands and fixes for future reference. If you'd like, I can (A) capture and paste the Metro error trace here, (B) walk you through setting `ANDROID_SDK_ROOT` and adding `adb` to PATH, or (C) open the PR manually and continue with Reanimated/gesture examples.