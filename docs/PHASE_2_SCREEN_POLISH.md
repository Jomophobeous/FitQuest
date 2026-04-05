# PHASE_2_SCREEN_POLISH.md
## Core Screens Implementation (14 hours, 2 subagents)

**Ready for deployment after Phase 1 completion**

---

## Overview

Phase 2 focuses on 5 high-impact daily-driver screens:
1. **Dashboard** (3h) — Entry point, visual center
2. **Coach** (4h) — Feature-critical, keyboard fix
3. **Profile** (3h) — Account management
4. **Workouts/Exercises** (2h) — Exercise list, image loading
5. **Settings** (2h) — Preferences, app controls

**Parallelization**:
- **Subagent A**: Dashboard + Coach (7h)
- **Subagent B**: Profile + Workouts + Settings (7h)

---

## Subagent A: Dashboard + Coach (7 hours)

### Screen 1: Dashboard (3 hours)

**Current State**:
- Shows welcome, progress ring, workout stats
- Mostly functional, needs visual polish

**Improvements**:
- [ ] **Logo Integration**: Add animated logo to header (pulse mode)
- [ ] **Progress Visualization**: Replace flat bars with circular rings (Skia if available, else Reanimated)
  - Daily completion ring (center, 120px)
  - Weekly goals ring (secondary)
  - Overall fitness score ring
- [ ] **Stat Cards**: Apply glass-morphism from themeEffects
  - Cards: glassCard preset (blur 12px, border 1px accent@30%)
  - Spacing: spacing[6] between sections
  - Typography: consistent h2/body per section
- [ ] **CTA Button**: Apply GlassButton with gradient
  - "Start Workout" → gradient button, variant="primary", size="md"
  - Color: theme.colors.accent → gradient
- [ ] **Animation**: Count-up animation on stats (already implemented, verify)
- [ ] **Spacing Audit**:
  - Verify all gaps are spacing[4], spacing[6], not hardcoded
  - Section padding: spacing[4] horizontal, spacing[6] vertical
- [ ] **Color Consistency**:
  - All accent colors → theme.colors.accent
  - All text → theme.colors.text / textSecondary / textMuted
  - All borders → theme.colors.border

**Files to Update**:
- `app/dashboard.tsx` (main screen)
- `src/components/charts/XPProgressChart.tsx` (rings)
- `src/components/profile/ProfileStats.tsx` (stat cards if reused)

**Acceptance Criteria**:
- ✅ Animated logo visible in header
- ✅ Circular progress rings render correctly
- ✅ Glass-morphism cards apply without error
- ✅ Gradient CTA button visible + functional
- ✅ No spacing hardcoded values
- ✅ No color hardcoded hex values
- ✅ Device testing: 375px, 412px, 480px
- ✅ Before/after screenshots

---

### Screen 2: Coach (4 hours) — CRITICAL

**Current Issues**:
- Input bar too small (send button 20px → 40px)
- Keyboard overlap on Android (KeyboardAvoidingView not configured)
- No activation/onboarding flow
- Suggestion cards cramped, no glass effect
- Message bubbles lack visual polish

**Improvements**:

#### 2.1 Coach Activation Modal (1h)
- [ ] Create modal screen on first coach visit
  - Use glassmorphism from themeEffects.glassModal
  - Title: "Meet Your AI Coach"
  - Icon: animated logo (small, 60px)
  - Description: explain coach features
  - CTA: "Get Started" (GlassButton, primary, gradient)
  - Format: match age-verification reference (centered, breathing room)
- [ ] Store activation flag in database
- [ ] Show only once per user

**Files**:
- Create: `src/components/coach/CoachActivationModal.tsx`
- Update: `app/coach/index.tsx` (show modal on first load)

#### 2.2 Input Bar Redesign (1h)
- [ ] Fix height to 48px (was flexible/small)
- [ ] Send button: 40×40px with icon
- [ ] Text input: remaining space, padding spacing[2] vertical
- [ ] KeyboardAvoidingView:
  - iOS: keyboardVerticalOffset = 60
  - Android: behavior = "padding" (not height)
- [ ] Test on device: typing doesn't hide input

**Files**:
- Update: `src/components/coach/ChatComponents.tsx` (InputBar component)
- Update: `app/coach/index.tsx` (wrap with KeyboardAvoidingView)

#### 2.3 Suggestion Cards (1h)
- [ ] Apply glass-morphism (glassCard preset)
- [ ] Gradient border (theme.colors.accent @ 30%)
- [ ] Better spacing: gap spacing[2] between cards
- [ ] Wrap if needed (no horizontal scroll, vertical stack okay)
- [ ] Animation: FadeInUp on appear

**Files**:
- Update: `src/components/coach/ChatComponents.tsx` (SuggestionCard component)

#### 2.4 Message Bubbles (1h)
- [ ] User messages: glass background + slight gradient
- [ ] Coach messages: similar glass effect + accent accent color
- [ ] Spacing: margin between messages = spacing[2]
- [ ] Timestamp: smaller text (caption size), textMuted color
- [ ] Animation: FadeInUp + slide from side

**Files**:
- Update: `src/components/coach/ChatComponents.tsx` (MessageBubble component)

**Acceptance Criteria**:
- ✅ Activation modal shows on first visit (never again)
- ✅ Input bar is exactly 48px, send button 40×40px
- ✅ Keyboard doesn't overlap input on Android
- ✅ Suggestion cards have glass-morphism border
- ✅ Message bubbles animated smoothly
- ✅ No TypeScript errors
- ✅ Device testing: type message, verify input visible
- ✅ Before/after screenshots + video demo

---

## Subagent B: Profile + Workouts + Settings (7 hours)

### Screen 3: Profile Menu (3 hours)

**Current Issues**:
- Menu items oversized (68px → target 56px)
- Font sizes inconsistent
- No account management section
- No glass effects on items

**Improvements**:

#### 3.1 Menu Item Redesign (1.5h)
- [ ] Reduce item height: 68px → 56px
- [ ] Typography: label → body (16px, not bodyMid 15px)
- [ ] Layout: icon (40px, left) | label (center) | arrow (right, 24px)
- [ ] Spacing: padding spacing[2.5] vertical (not spacing[4])
- [ ] Glass background: apply glassCard preset to each item
- [ ] Border: 1px, theme.colors.border
- [ ] Tap animation: scale 0.98 + opacity feedback

**Files**:
- Update: `src/components/profile/ProfileParts.tsx` (MenuItem component)

#### 3.2 Account Section (NEW) (1.5h)
- [ ] Add new section: "Account"
- [ ] Items:
  - Email display (read-only, copy button)
  - Change password (tap → modal)
  - Sign out (tap → confirm → logout)
  - Delete account (danger zone, red icon)
- [ ] Each item: icon + label + chevron, glass background
- [ ] Password change modal: form with current + new + confirm fields

**Files**:
- Create: `src/components/profile/AccountSection.tsx`
- Update: `src/components/profile/ProfileParts.tsx` (add section to main profile)
- Create: `src/components/profile/ChangePasswordModal.tsx`

#### 3.3 Spacing & Color Audit (not counted, part of above)
- [ ] All hardcoded spacing → spacing[N]
- [ ] All hardcoded colors → theme.colors.*

**Acceptance Criteria**:
- ✅ Menu items exactly 56px height
- ✅ Account section visible with all 4 items
- ✅ Glass-morphism applied to each item
- ✅ Password change modal functional
- ✅ No TypeScript errors
- ✅ Device testing: 375px-480px
- ✅ Before/after screenshots

---

### Screen 4: Workouts/Exercises List (2 hours)

**Current Issues**:
- Exercise cards lack glass-morphism
- Images don't show loading state
- No error handling for missing images
- No color-coded intensity badges

**Improvements**:

#### 4.1 Exercise Card Redesign (1h)
- [ ] Apply glass-morphism card (glassCard preset)
- [ ] Add gradient border (theme.colors.accent @ 30%)
- [ ] Spacing: spacing[3] between cards in list
- [ ] Layout: image (left, 72×72) | info (right, name + category + badges)
- [ ] Animation: FadeInUp on scroll into view

#### 4.2 Image Loading Integration (1h)
- [ ] Use ImageLoadingState component from Phase 1
- [ ] Show skeleton while loading
- [ ] Show error UI if image fails
- [ ] Cache integration: instant load on re-visit
- [ ] Frame indicators: if multi-frame exercise

**Files**:
- Update: `app/exercises.tsx` (list layout + card rendering)
- Update: `src/components/ExerciseImage.tsx` (use ImageLoadingState)

**Acceptance Criteria**:
- ✅ Cards have glass-morphism appearance
- ✅ Image loading shows skeleton
- ✅ Image error shows retry button
- ✅ Cache hits instant (0ms delay on 2nd load)
- ✅ No TypeScript errors
- ✅ Device testing: scroll, verify performance
- ✅ Before/after screenshots

---

### Screen 5: Settings (2 hours)

**Current Issues**:
- Menu items oversized (same as Profile)
- No visual grouping by section
- No theme switcher
- No glass effects

**Improvements**:

#### 5.1 Section Grouping & Glass (1h)
- [ ] Group menu items into sections:
  - **Account**: email, password (reuse from Profile account section)
  - **App**: notifications, theme, offline mode
  - **About**: version, legal, feedback
  - **Danger Zone**: delete account, factory reset
- [ ] Each section:
  - Glass background (glassCard variant)
  - Title header (h4, accent color, spacing[3] top)
  - Items inside: reduced padding (no glass per item, just list inside glass section)
  - Separator: divider between sections
- [ ] Spacing: spacing[4] between sections

#### 5.2 Theme Switcher (1h)
- [ ] Add to "App" section
- [ ] Radio buttons: 8 themes (dark, light, blackGold, neon, energy, wellness, elite, sunset)
- [ ] Show theme name + 3 color dots (primary, accent2, semantic)
- [ ] On select: apply theme immediately, persist to localStorage
- [ ] Animation: theme change smooth (FadeOut → FadeIn)

**Files**:
- Create/update: `app/settings.tsx` (or similar)
- Update: `src/context/ThemeContext.tsx` (persist to localStorage)

**Acceptance Criteria**:
- ✅ Sections grouped with glass containers
- ✅ Theme switcher shows 8 options
- ✅ Theme changes apply immediately
- ✅ Theme persists across app restart
- ✅ No TypeScript errors
- ✅ Device testing: change theme, restart, verify persistence
- ✅ Before/after screenshots (all 8 themes)

---

## Commit Strategy

**Subagent A** (Dashboard + Coach):
- Branch: `feature/ui-phase2-dashboard-coach`
- Commits (hourly):
  - "WIP: dashboard rings + glass cards"
  - "WIP: coach activation modal"
  - "WIP: input bar redesign + keyboard fix"
  - "WIP: suggestion cards glass effect"
  - "WIP: message bubbles animation"
  - "done: dashboard + coach (7h)"
- Final PR with before/after screenshots + device video

**Subagent B** (Profile + Workouts + Settings):
- Branch: `feature/ui-phase2-profile-workouts-settings`
- Commits (hourly):
  - "WIP: profile menu redesign + account section"
  - "WIP: change password modal"
  - "WIP: exercise cards glass + image loading"
  - "WIP: settings sections + theme switcher"
  - "done: profile + workouts + settings (7h)"
- Final PR with before/after screenshots + device video

---

## Testing Checklist

**Before Final PR**:
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] All tests pass (`npm test`)
- [ ] Device testing on 3 widths: 375px, 412px, 480px
- [ ] Navigation between screens (back/forward, no crashes)
- [ ] Theme switching works (all 8 themes, all screens)
- [ ] Images load (with skeleton, error fallback, cache hit)
- [ ] Keyboard on Android (input visible, no overlap)
- [ ] Animations smooth (60fps, no jank)
- [ ] Contrast ratios checked (WCAG AA, screenshot report)
- [ ] Touch targets verified (min 48px)

---

## Success Criteria

**Phase 2 Completion** = All 5 core screens following:
1. **Glass-morphism** applied to cards/modals (glassCard preset)
2. **Gradient buttons** on all CTAs (GlassButton, primary variant)
3. **Breathing room** (spacing[6] between sections)
4. **Animated logo** integrated (if phase 1 done)
5. **Image loading** states (skeleton + error + cache)
6. **Theme support** (all 8 themes, switchable)
7. **No hardcoded** spacing or colors
8. **Accessibility** (48px touch targets, WCAG AA contrast)
9. **Performance** (60fps, <1s screen load)
10. **Device tested** (375px, 412px, 480px)

---

**Document ID**: PHASE_2_SCREEN_POLISH.md  
**Created**: 2026-04-05 21:15 GMT+2  
**Status**: Ready for deployment (after Phase 1 complete)  
**Effort**: 14 hours (2 subagents, 7h each)  
**Target**: Screens 1-5 (tier 1, daily drivers)
