# FILEMAP.md — FitQuest Codebase Navigation Index
# Read THIS before opening any file. It tells you where everything lives.
# Last updated: 2026-04-06

## SCREENS (app/)
app/_layout.tsx              — Root layout, tab navigation, auth gate (474 lines)
app/index.tsx                — Entry redirect to dashboard or onboarding (510 lines)
app/splash.tsx               — Splash screen (35 lines)
app/onboarding.tsx           — New user onboarding flow (309 lines) → useOnboardingViewModel
app/login.tsx                — Email/password login (977 lines) → standalone
app/register.tsx             — Registration screen (448 lines) → standalone
app/dashboard.tsx            — Main dashboard, stats, greeting (933 lines) → useDashboardViewModel
app/coach/index.tsx          — AI Coach chat screen (510 lines) → useCoachViewModel
app/profile.tsx              — User profile + settings (750 lines) → useProfileViewModel
app/workouts/index.tsx       — Workout list/browse (227 lines) → standalone
app/workouts/[id].tsx        — Single workout detail (97 lines) → standalone
app/workout.tsx              — Active workout session (849 lines) → useWorkoutViewModel
app/create-workout.tsx       — Workout builder (871 lines) → useCreateWorkoutViewModel
app/saved-workouts.tsx       — Saved workout library (874 lines) → useSavedWorkoutsViewModel
app/exercises.tsx            — Exercise browser (812 lines) → useExercisesViewModel
app/move.tsx                 — Movement/activity tracker (891 lines) → useMoveViewModel
app/progress.tsx             — Progress tracking/charts (556 lines) → useProgressViewModel
app/craft-my-body.tsx        — Body composition planner (971 lines) → useCraftMyBodyViewModel
app/fitquest.tsx             — FitQuest challenges (519 lines) → useFitquestViewModel
app/analytics.tsx            — Analytics dashboard (1011 lines) → useAnalyticsViewModel
app/meal-prep.tsx            — Meal prep (38 lines, stub)
app/nutrition-calculator.tsx — Nutrition calculator (374 lines) → standalone
app/health-dashboard.tsx     — Health Connect data (298 lines) → standalone
app/paywall.tsx              — Subscription paywall (496 lines) → usePaywallViewModel
app/feedback.tsx             — User feedback form (561 lines) → standalone
app/backups.tsx              — Data backup/restore (226 lines) → standalone
app/legal-center.tsx         — Legal docs hub (262 lines) → useLegalCenterViewModel
app/privacy-policy.tsx       — Privacy policy (266 lines)
app/terms-of-service.tsx     — Terms of service (156 lines)

## VIEWMODELS (src/viewmodels/)
useCoachViewModel.ts         — AI chat logic: context loading, AI dispatch, streaming, suggestions (910 lines)
useDashboardViewModel.ts     — Dashboard data: progress, streak, readiness, name (580 lines)
useProfileViewModel.ts       — Profile: settings, pickers, export, name editing (1118 lines)
useWorkoutViewModel.ts       — Active workout: timer, sets, completion (large)
useOnboardingViewModel.ts    — Onboarding: profile creation, validation (166 lines)
useCreateWorkoutViewModel.ts — Workout builder logic
useSavedWorkoutsViewModel.ts — Saved workout CRUD
useExercisesViewModel.ts     — Exercise browsing/filtering
useMoveViewModel.ts          — Movement tracking
useProgressViewModel.ts      — Progress data aggregation
useCraftMyBodyViewModel.ts   — Body composition algorithms
useFitquestViewModel.ts      — Challenge/quest logic
useAnalyticsViewModel.ts     — Analytics aggregation
usePaywallViewModel.ts       — Subscription state
useLegalCenterViewModel.ts   — Legal document loading

## COMPONENTS (src/components/)
ui/GlassUI.tsx               — GlassCard, GlassButton, ProgressRing, SectionHeader, GradientButton
ui/GlassCard.tsx             — Standalone GlassCard component
ui/InteractionFeedback.tsx   — RippleButton, haptic feedback (⚠️ wraps children in own View)
ui/primitives.tsx            — ScreenContainer base component
coach/ChatComponents.tsx     — MessageBubble, StreamingBubble, TypingIndicator, MessageActionSheet
coach/CoachStatusCard.tsx    — Visual readiness dashboard card
coach/CoachActivationModal.tsx — First-visit welcome modal
coach/styles.ts              — Coach screen styles
profile/ProfileHeader.tsx    — Avatar, name, email, XP bar
profile/ProfileParts.tsx     — MenuItem, ThemedPickerModal
profile/ProfileModals.tsx    — Change password, photo picker
profile/InlinePickers.tsx    — Language/theme compact pickers
profile/AccountSection.tsx   — Sign out, delete account
profile/StatsGrid.tsx        — Profile stats display
dashboard/*                  — Dashboard-specific components
onboarding/OnboardingSteps.tsx — Step-by-step onboarding UI (956 lines)
SimpleMarkdown.tsx           — Markdown renderer for chat
ThemedText.tsx               — Theme-aware text component
AnimatedFQLogoMark.tsx       — Animated logo (Reanimated, no Skia)
ScreenErrorBoundary.tsx      — Error boundary wrapper
ScreenTutorial.tsx           — First-visit tutorial tooltips
PremiumGate.tsx              — Subscription gate wrapper

## AI & ENGINES (src/engines/, src/services/)
services/aiProvider.ts       — Cloud AI chain: Groq/Grok/OpenRouter + fallback (1081 lines) ⚠️ DO NOT MODIFY
engines/DualAIEngine.ts      — Offline AI templates, greeting gen, fillTemplate (1797 lines)
engines/ai/templates.ts      — Coach/Professor response templates (680 lines)
engines/IntentRouter.ts      — TF-IDF intent classification
engines/ReadinessEngine.ts   — Workout readiness scoring
services/authorityClient.ts  — Backend server communication ⚠️ DO NOT MODIFY
services/aiProvider.ts       — Cloud AI routing ⚠️ DO NOT MODIFY

## DATABASE (src/database/) — ⚠️ RARELY EDIT
database/schema.ts           — SQLite schema v16, migrations (1925 lines)
database/service.ts          — All CRUD operations (2927 lines)
database/types.ts            — TypeScript types, SCHEMA_VERSION constant
database/seed.ts             — Initial data seeding (1520 lines)
database/external-exercises-data.ts — 868 exercises SQL (28796 lines) ❌ NEVER LOAD
database/external-seed.ts    — Seeds external exercises
database/exerciseGenerator.ts — Workout generation algorithm (1987 lines)
database/bodyCraftService.ts — Body composition DB queries

## SECURITY (src/security/) — ⚠️ DO NOT MODIFY
security/EncryptedDatabase.ts — AES-256-GCM encrypted storage
security/BiometricAuth.ts     — Biometric session validation
security/tamper*.ts           — Tamper detection engines

## DESIGN (src/design/)
design/theme-system.ts       — Theme tokens: spacing[], typography, radius (canonical)
design/themes/themeConfigs.ts — 8 theme color configs
design/themes/themeEffects.ts — Glass-morphism presets, animation easing
design/motion.ts             — Motion/animation constants

## I18N (src/i18n/)
i18n/en.ts                   — English translations (1572 lines)
i18n/es.ts                   — Spanish (1422 lines)
i18n/fr.ts                   — French (1432 lines)
i18n/zh.ts                   — Chinese (1385 lines)
i18n/translations.ts         — SUPPORTED_LANGUAGES, translation loader

## CONTEXT (src/context/)
context/ThemeContext.tsx      — Theme provider + useTheme hook
context/LanguageContext.tsx   — Language provider + useLanguage hook
context/DatabaseContext.tsx   — Database provider
context/AuthContext.tsx       — Auth state provider

## HARD RULES
- Spacing: theme.spacing[N] with NUMERIC keys (1,2,3,4,5,6,8,10)
- Colors: theme.colors.* only, NEVER hardcode hex
- Schema: increment SCHEMA_VERSION for any migration
- Touch targets: minimum 48px
- No AsyncStorage — SecureStore or SQLite only
- No Apollo — SQLite is single source of truth
