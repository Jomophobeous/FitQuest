# UNIFIED_IMPLEMENTATION_PLAN.md
## FitQuest v1.2.0 — Complete Polish & Theme Integration

**Status**: Ready for execution (all screens, full theme integration, Skia logo, image loading)

**Scope**: 
- 28 app screens + 40+ UI components
- 8 complete themes (dark, light, blackGold, neon, energy, wellness, elite, sunset)
- Exercise image loading with skeleton/error states
- Skia-powered animated logo
- Glass-morphism + gradients + breathing room across all surfaces
- Full play Store launch readiness

---

## 📋 Master Implementation Checklist

### Phase 1: Foundation & Infrastructure (Days 1-2, 16 hours)

**Objective**: Core systems ready, no screen UI changes yet

#### 1.1 Logo Animation System (4 hours)
- [ ] Install `@shopify/react-native-skia` + `react-native-gesture-handler` (if needed)
- [ ] Create `AnimatedFQLogoMark.tsx` with Skia Canvas
  - Pulse animation (2.5s cycle, emerald glow)
  - Rotation on demand (spin in after tap)
  - Multicolor theme support (apply current theme accent)
- [ ] Update `app/splash.tsx` to use animated logo
- [ ] Add animated logo to dashboard, coach, profile headers
- **Files**: src/components/AnimatedFQLogoMark.tsx, app/splash.tsx

#### 1.2 Exercise Image Loading Enhancement (6 hours)
- [ ] Create `ImageLoadingState.tsx` component (skeleton + error)
  - Skeleton shimmer during load
  - Error state with retry button + icon
  - Frame indicator (for multi-frame exercises)
- [ ] Update `ExerciseImage.tsx`
  - Add isLoading state with skeleton fallback
  - Retry logic with visual feedback
  - Cache loaded images in memory
  - Better error boundaries
- [ ] Create `ImageCacheService.ts`
  - LRU cache for exercise images (100 max)
  - Pre-fetch next/prev frames
  - Clear cache on memory warning
- **Files**: src/components/ui/ImageLoadingState.tsx, src/services/ImageCacheService.ts (update ExerciseImage.tsx)

#### 1.3 Theme System Unification (3 hours)
- [ ] Update `src/design/themes/themeConfigs.ts` with inspiration-mapped colors
  - Add accent2 color for secondary CTAs (cyan, orange per theme)
  - Add glass-morphism effect specs (blur amount, opacity, border)
  - Add gradient specs for buttons per theme
  - Document animation timing per theme
- [ ] Create `src/design/themes/themeEffects.ts`
  - Glass-morphism presets (card, button, modal, navbar)
  - Gradient button presets per theme
  - Shadow/elevation specs per mood (dark vs light)
  - Animation easing + duration per theme
- [ ] Update `theme-system.ts` to export all effects
- **Files**: themeConfigs.ts (enhance), themeEffects.ts (new), theme-system.ts (export)

#### 1.4 Component Library Standardization (3 hours)
- [ ] Create/enhance GlassCard variant with border + glow
- [ ] Create GlassButton component (gradient + press feedback)
- [ ] Create NotificationBar component (toast system)
- [ ] Update all spacing to use numeric keys (spacing[4] not spacing.md)
- [ ] Audit all hardcoded colors → swap to theme.colors.*
- **Files**: src/components/ui/GlassCard.tsx, GlassButton.tsx, NotificationBar.tsx

---

### Phase 2: Screen Polish — Core Screens (Days 3-4, 14 hours)

**Objective**: Transform 5 core screens to premium feel

#### 2.1 Dashboard (3 hours)
- [ ] Add animated logo to header
- [ ] Replace flat progress bars with circular rings (Skia)
- [ ] Apply glass-morphism to stat cards
- [ ] Add gradient to "Start Workout" CTA
- [ ] Breathing room: increase section gaps spacing[6]
- [ ] Add count-up animation to stats (already have, enhance)
- **Files**: app/dashboard.tsx, update components/charts/*.tsx

#### 2.2 Coach Screen (4 hours) — CRITICAL
- [ ] Fix keyboard overlap (Android KeyboardAvoidingView)
- [ ] Input bar redesign (48px fixed height, 40px send button)
- [ ] Suggestion cards: glass-morphism + gradient borders
- [ ] Coach activation modal (glassmorphism, centered, matches age-verification reference)
- [ ] Message bubbles: glass effect + slight gradient
- [ ] Fix wrapping on suggestions
- **Files**: app/coach/index.tsx, src/components/coach/ChatComponents.tsx

#### 2.3 Profile Menu (3 hours)
- [ ] Reduce menu item height 68px → 56px
- [ ] Typography: bodyMid (15px) → body (16px)
- [ ] Add glass background to each menu item
- [ ] Standardize icon + text layout (icon left 40px, label right, arrow)
- [ ] Add Account section (new)
- **Files**: app/profile.tsx, src/components/profile/ProfileParts.tsx

#### 2.4 Settings (2 hours)
- [ ] Compact menu items to 56px
- [ ] Group into sections: Account, App, About, Danger Zone
- [ ] Glass background per section
- [ ] Inline toggles with emerald accent
- [ ] Gradient buttons for destructive actions
- **Files**: Create or update settings screen (if exists)

#### 2.5 Workouts List (2 hours)
- [ ] Exercise cards: glass-morphism + category gradient border
- [ ] Exercise images: skeleton loaders + error states
- [ ] Color-coded intensity badges
- [ ] Smooth item enter animation
- **Files**: app/exercises.tsx, src/components/ExerciseImage.tsx

---

### Phase 3: Thematic Enhancements (Days 5, 6 hours)

**Objective**: Apply all 8 themes + effects uniformly

#### 3.1 Theme Switching Infrastructure (2 hours)
- [ ] Verify ThemeContext supports all 8 themes
- [ ] Add theme toggle to Settings (radio buttons, 8 options)
- [ ] Persist theme choice to localStorage
- [ ] Test theme switching doesn't break animations
- **Files**: src/context/ThemeContext.tsx, app/settings.tsx

#### 3.2 Apply Effects Across 28 Screens (4 hours)
- [ ] Spreadsheet: Map screens → required glass/gradient/spacing updates
- [ ] For each screen:
  - [ ] Glass backgrounds on cards/modals
  - [ ] Gradient CTAs
  - [ ] Breathing room verification
  - [ ] Typography audit
  - [ ] Image loading states
- **Target**: ~4 screens per hour (parallel sub-agents)
- **Files**: app/*.tsx, src/components/**/*.tsx

---

### Phase 4: Image Loading + Skia Polish (Days 7, 8 hours)

#### 4.1 Exercise Image Service (3 hours)
- [ ] Skeleton loader animation (shimmer, gradient sweep)
- [ ] Error state UI (icon + message + retry button)
- [ ] Multi-frame animation (0.jpg/1.jpg cycling)
- [ ] Image caching service (LRU, 100 max)
- [ ] Pre-fetch adjacent frames
- **Files**: src/components/ui/ImageLoadingState.tsx, src/services/ImageCacheService.ts

#### 4.2 Skia Logo Animations (3 hours)
- [ ] AnimatedFQLogoMark with canvas rendering
  - Pulse effect (emerald glow, 2.5s)
  - Rotation on tap (360° spin + scale bounce)
  - Theme-aware accent color
  - Fallback to static SVG on error
- [ ] Place on:
  - Splash screen (animated)
  - Dashboard header (subtle pulse)
  - Coach header (rotation on tap)
  - Profile header (pulse when idle)
- **Files**: src/components/AnimatedFQLogoMark.tsx, splash.tsx, dashboard.tsx, coach/index.tsx, profile.tsx

#### 4.3 Polish Pass (2 hours)
- [ ] Cross-screen consistency audit
- [ ] Animation timing alignment (use MOTION constants)
- [ ] Accessibility audit (touch targets, contrast ratios)
- [ ] Performance profiling (60fps, no jank)
- [ ] Device testing (375px, 412px, 480px, tablet)

---

### Phase 5: Testing & Launch Prep (Day 9, 8 hours)

#### 5.1 Quality Assurance (4 hours)
- [ ] Visual regression testing (before/after screenshots)
- [ ] Cross-device testing (4 device widths)
- [ ] Animation performance (60fps, no frame drops)
- [ ] Memory profiling (no leaks)
- [ ] Contrast ratio audit (WCAG AA)
- [ ] Touch target sizes (min 44-48px)

#### 5.2 Pre-Launch Checklist (4 hours)
- [ ] All screens captured + documented
- [ ] Theme showcase: 8 screenshots per theme
- [ ] Play Store listing screenshots (5-8 localized)
- [ ] Privacy policy + terms updated (if needed)
- [ ] Sentry monitoring activated
- [ ] PostHog analytics configured
- [ ] Build final APK + bundle

---

## 📊 Unified Theme + Design Pattern Matrix

| Theme | Mood | Primary Accent | Secondary | Gradient | Glass Opacity | Animation Speed |
|-------|------|---|---|---|---|---|
| **dark** | Immersion | #10B981 (emerald) | #F4A427 (amber) | Emerald → Teal | 0.12 | 250ms |
| **light** | Analysis | #10B981 (emerald) | #F4A427 (amber) | Emerald → Teal | 0.08 | 200ms |
| **blackGold** | Luxury | #D4A843 (gold) | #C8943A (warm) | Gold → Amber | 0.15 | 300ms |
| **neon** | Cyberpunk | #06B6D4 (cyan) | #EC4899 (magenta) | Cyan → Magenta | 0.14 | 200ms |
| **energy** | Intensity | #FF6B35 (orange) | #FCD34D (yellow) | Orange → Yellow | 0.13 | 180ms |
| **wellness** | Calm | #9DC183 (sage) | #C1643F (terracotta) | Sage → Cream | 0.10 | 320ms |
| **elite** | Authority | #E2E8F0 (platinum) | #94A3B8 (titanium) | Platinum → Gray | 0.16 | 280ms |
| **sunset** | Drama | #FF6B6B (coral) | #FCD34D (amber) | Coral → Purple | 0.14 | 260ms |

---

## 🎯 Screen Prioritization (Execution Order)

### Tier 1 — Daily Driver (highest impact, days 3-4)
1. **Dashboard** (3h) — Entry point, workout CTA, progress visualization
2. **Coach** (4h) — Messaging, activation, keyboard fix
3. **Profile** (3h) — Account mgmt, personalization
4. **Workouts** (2h) — Exercise list, image loading
5. **Settings** (2h) — Preferences, app controls

### Tier 2 — Onboarding & Auth (user journeys, day 4-5)
6. **Login** (2h)
7. **Register** (2h)
8. **Onboarding** (2h)
9. **Paywall** (1h)

### Tier 3 — Secondary Features (day 5-6)
10. **Health Dashboard** (2h)
11. **Progress** (2h)
12. **Exercises** (1h)
13. **Saved Workouts** (1h)
14. **Analytics** (1h)

### Tier 4 — Tertiary (day 6-7)
15. **Feedback** (1h)
16. **Meal Prep** (1h)
17. **Nutrition Calculator** (1h)
18. **Move** (1h)
19. **Craft My Body** (1h)
20. **Create Workout** (1h)
21. **Legal/Privacy** (1h)

### Tier 5 — Modals & Overlays (throughout)
- Modals: glass-morphism, centered, emerald accent CTA
- Overlays: GetReadyOverlay, RestTimerOverlay, ConfettiBurst
- Error screens: DatabaseRecoveryScreen, ErrorBoundary

---

## 🚀 Subagent Task Assignments

**Subagent 1**: Screens 1-5 (Dashboard, Coach, Profile, Workouts, Settings)  
**Subagent 2**: Screens 6-10 (Login, Register, Onboarding, Paywall, Health Dashboard)  
**Subagent 3**: Screens 11-14 + overlays (Progress, Exercises, Workouts, Analytics, modals)  
**Subagent 4**: Image loading + Skia logo animation  
**Subagent 5**: Component library (GlassCard, GlassButton, NotificationBar, spacing audit)

Each subagent uses **claude-opus-4.6**, follows **UI_GUIDELINES.md** + **INSPIRATION_SYNTHESIS.md**, commits to feature branches, creates PR for review.

---

## 📁 File Structure Changes

```
src/
├── components/
│   ├── AnimatedFQLogoMark.tsx (NEW)
│   ├── ui/
│   │   ├── GlassCard.tsx (ENHANCE)
│   │   ├── GlassButton.tsx (NEW)
│   │   ├── NotificationBar.tsx (NEW)
│   │   ├── ImageLoadingState.tsx (NEW)
│   │   └── Skeleton.tsx (ENHANCE)
│   ├── ExerciseImage.tsx (ENHANCE)
│   ├── coach/ChatComponents.tsx (ENHANCE)
│   └── profile/ProfileParts.tsx (ENHANCE)
├── services/
│   ├── ImageCacheService.ts (NEW)
│   └── exerciseImageService.ts (ENHANCE)
├── design/
│   ├── themes/
│   │   ├── themeConfigs.ts (ENHANCE)
│   │   └── themeEffects.ts (NEW)
│   ├── theme-system.ts (ENHANCE)
│   └── motion.ts (VERIFY)
└── context/
    └── ThemeContext.tsx (ENHANCE for 8-theme support)

app/
├── splash.tsx (ENHANCE with animated logo)
├── dashboard.tsx (ENHANCE)
├── coach/index.tsx (ENHANCE)
├── profile.tsx (ENHANCE)
├── [other 23 screens] (POLISH)
```

---

## ⏱️ Timeline

| Phase | Days | Hours | Deliverable |
|-------|------|-------|---|
| 1 | 1-2 | 16 | Logo animation, image loading, theme system, components ready |
| 2 | 3-4 | 14 | 5 core screens polished (Dashboard, Coach, Profile, Workouts, Settings) |
| 3 | 5 | 6 | Theme switching, effects applied to all 28 screens |
| 4 | 7-8 | 8 | Image loading polish, Skia animations across app |
| 5 | 9 | 8 | QA, testing, launch prep, Play Store ready |
| **TOTAL** | **9 days** | **52 hours** | **Full v1.2.0 Launch-Ready** |

---

## 🔧 Subagent Instructions

Each subagent receives:
1. This UNIFIED_IMPLEMENTATION_PLAN.md
2. UI_GUIDELINES.md (canonical rules)
3. INSPIRATION_SYNTHESIS.md (design patterns)
4. COMPONENT_SPECIFICATION.md (component specs)
5. Assigned screen list + task checklist
6. Feature branch name + PR template

Example: Subagent 1 → feature/ui-phase2-screens-1-5 (dashboard, coach, profile, workouts, settings)

All work:
- Commits hourly with descriptive messages
- Tests on device (Samsung R92X418XP9E)
- Screenshots before/after
- No merge to main until review pass

---

## ✅ Launch Gate Criteria

Before Play Store submission:

- [ ] All 28 screens follow UI_GUIDELINES.md
- [ ] All 8 themes fully supported + switchable
- [ ] Exercise images load with skeleton/error states
- [ ] Logo animated on splash, dashboard, coach, profile
- [ ] Glass-morphism applied to all cards/modals
- [ ] Gradient buttons on all CTAs
- [ ] Breathing room verified (spacing[6] between sections)
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] 60fps animations, no jank
- [ ] WCAG AA contrast ratios
- [ ] Touch targets ≥48px
- [ ] Performance: app launch <2s, screens <1s
- [ ] Sentry + PostHog configured
- [ ] Privacy policy + terms reviewed

---

**Document ID**: UNIFIED_IMPLEMENTATION_PLAN.md  
**Created**: 2026-04-05 20:45 GMT+2  
**Status**: Ready for execution — subagent deployment pending  
**Scope**: 28 screens, 40+ components, 8 themes, full launch-ready polish
