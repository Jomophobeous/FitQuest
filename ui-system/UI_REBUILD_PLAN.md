# UI Rebuild Plan — Phase 31.1

## Strategy: System → Cluster → Batch Screens

**NOT**: screen → screen → screen  
**INSTEAD**: system → cluster → batch screens → replace

---

## Architecture

```
Repo A (mobile_without_server)     Repo B (fitquest-ui-core)
├── backend logic                  ├── src/tokens/       ← migrated
├── database/engines               ├── src/components/   ← locked 5 + expansion
├── legacy UI (FROZEN)             ├── src/screens/      ← rebuilt from scratch
├── ui-system/ (specs)             ├── src/layouts/      ← migrated
└── design-intelligence/           ├── src/navigation/   ← new
                                   ├── src/mock/         ← mock data only
                                   └── App.tsx           ← Expo entry
```

**Rule**: Legacy UI = read-only. New UI = clean room. Integration = replacement.

---

## Dependency Graph (Build Order)

```
Layer 0: Tokens ──────────────── ✅ DONE
          ↓
Layer 1: Base Components ─────── ✅ DONE (Button, Card, ProgressBar, StatBlock, Carousel)
          ↓
Layer 2: Layout Primitives ───── ⬜ (SafeArea, ScrollContainer, Grid, Divider)
          ↓
Layer 3: Domain Components ───── ⬜ (ExerciseCard, WorkoutTimer, HeaderBar, ActivityFeed)
          ↓
Layer 4: Navigation Shell ────── ⬜ (Tab bar, Stack config, route guards)
          ↓
Layer 5: Screen Clusters ─────── ⬜ (batch-built per cluster)
          ↓
Layer 6: Integration ─────────── ⬜ (replace legacy screens)
```

---

## Phase A — Foundations (DONE)

| Item | Status |
|------|--------|
| Color tokens | ✅ |
| Spacing tokens | ✅ |
| Typography tokens | ✅ |
| Button (GradientButton) | ✅ |
| Card (GlassCard) | ✅ |
| ProgressBar | ✅ |
| StatBlock | ✅ |
| Carousel | ✅ |
| Lint engine (10 rules) | ✅ |

---

## Phase B — Layout Primitives + Domain Components

### B.1 Layout Primitives
| Component | Purpose |
|-----------|---------|
| ScreenContainer | SafeAreaView + StatusBar + scroll wrapper |
| ContentSection | Padded section with optional title |
| Grid | 2-column responsive grid for StatBlocks |
| Divider | Themed horizontal rule |

### B.2 Domain Components (derived from design intelligence patterns)
| Component | Derives From | Used In |
|-----------|-------------|---------|
| ExerciseCard | Card + exercise data | exercises, workout |
| WorkoutTimer | AnimatedCounter + circular | workout active session |
| HeaderBar | Text + back/menu | all screens |
| ActivityFeed | Card list | dashboard |
| MuscleMap | SVG overlay | workout, progress |

---

## Phase C — Screen Clusters (Batch Build)

### Cluster 1: ONBOARDING (P1)
**Build together. Ship together.**

| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Splash | ScreenContainer, Logo | none |
| Onboarding | Carousel, Button, ThemedText | goals[], equipment[] |

**Depends on**: Layer 0-2 only (tokens + base + layout primitives)

### Cluster 2: AUTH (P2)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Login | Card, Button, TextInput | credentials mock |
| Register | Card, Button, TextInput | validation mock |

**Depends on**: Layer 0-2

### Cluster 3: CORE — Dashboard (P1)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Dashboard | StatBlock (x4), ProgressBar, Card, ActivityFeed, Button | stats, sessions |

**Depends on**: Layer 0-3 (needs domain components)

### Cluster 4: CORE — Workout System (P1)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| FitQuest Hub | Card, Button, ProgressBar | workout suggestions |
| Active Workout | WorkoutTimer, ExerciseCard, Button, ProgressBar | exercise sequence |
| Create Workout | Card, Button, TextInput | exercise catalogue |
| Saved Workouts | Card list, Button | saved sessions |

**Depends on**: Layer 0-3

### Cluster 5: EXERCISES & MOVEMENT (P1-P2)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Exercises | ExerciseCard, Grid, SearchInput | exercise catalogue |
| Move | StatBlock, ProgressBar, Card | step/jog data |

**Depends on**: Layer 0-3

### Cluster 6: HEALTH & PROGRESS (P2)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Health Dashboard | StatBlock, ProgressBar, Card, Charts | health metrics |
| Progress | Charts, Card, ProgressBar | history data |
| Analytics | Charts, StatBlock | aggregate data |

**Depends on**: Layer 0-3 + chart component

### Cluster 7: PROFILE & SETTINGS (P2)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Profile | Card, StatBlock, Button, Avatar | user profile |
| Paywall | Card, Button, Carousel | subscription tiers |

**Depends on**: Layer 0-2

### Cluster 8: AI ASSISTANTS (P3)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Coach | Card, TextInput, Message bubbles | chat history |
| Professor | Card, TextInput, Message bubbles | chat history |

**Depends on**: Layer 0-2 + chat components

### Cluster 9: FITMIND (P3)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Library | Card list, SearchInput, Carousel | document list |
| Reader | ScreenContainer, ThemedText, annotations | document content |

**Depends on**: Layer 0-2

### Cluster 10: NUTRITION (P3)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Meal Prep | Card, ProgressBar, Grid | meal plans |
| Calculator | Card, TextInput, StatBlock | macro data |

**Depends on**: Layer 0-3

### Cluster 11: LEGAL & SUPPORT (P3)
| Screen | Components Used | Mock Data |
|--------|----------------|-----------|
| Legal Center | ScreenContainer, ThemedText | static text |
| Privacy/Terms | ScreenContainer, ThemedText | static text |
| Feedback | Card, TextInput, Button | none |
| Backups | Card, Button, ProgressBar | backup metadata |

**Depends on**: Layer 0-2

---

## Phase D — Integration (Replace Legacy)

### Strategy: Screen-by-screen replacement
1. New screen passes all lint rules (0 errors, 0 warnings)
2. Visual diff confirms no layout regression
3. Old screen file replaced with new implementation
4. Navigation config updated if needed
5. Commit per cluster — not per screen

### Order of replacement:
1. Onboarding (lowest risk, highest visibility)
2. Dashboard (highest user exposure)
3. Workout system (core product)
4. Exercises (catalogue)
5. Profile + Settings
6. Health + Progress
7. AI + FitMind
8. Nutrition
9. Legal (static content, lowest risk)

---

## Phase E — Enforcement Escalation

| Stage | Rule |
|-------|------|
| Current | Warnings allowed, errors flagged |
| After Cluster 1 | Onboarding: 0 errors, 0 warnings required |
| After Cluster 3 | Dashboard: 0 errors, 0 warnings required |
| After Cluster 4 | Workout: 0 errors, 0 warnings required |
| Full migration | ALL screens: 0 errors, <50 warnings globally |

---

## Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Lint errors | 225 | 0 |
| Lint warnings | 662 | <50 |
| Screens on ui-system | 0/30 | 30/30 |
| Hardcoded colors | ~225 | 0 |
| Inline fontSize | ~662 | 0 |
| Freestyle buttons | unknown | 0 |
| Freestyle cards | unknown | 0 |

---

## Timeline Estimate

| Phase | Clusters | Screens | Status |
|-------|----------|---------|--------|
| A (Foundations) | — | — | ✅ Done |
| B (Primitives + Domain) | — | — | ⬜ Not started |
| C.1 (Onboarding) | 1 | 2 | ⬜ Not started |
| C.2 (Auth) | 1 | 2 | ⬜ Not started |
| C.3 (Dashboard) | 1 | 1 | ⬜ Not started |
| C.4 (Workout) | 1 | 4 | ⬜ Not started |
| C.5 (Exercises) | 1 | 2 | ⬜ Not started |
| C.6 (Health) | 1 | 3 | ⬜ Not started |
| C.7 (Profile) | 1 | 2 | ⬜ Not started |
| C.8-11 (P3 screens) | 4 | 10 | ⬜ Not started |
| D (Integration) | — | 30 | ⬜ Not started |
| E (Enforcement) | — | — | ⬜ Not started |

---

## Audit Status (2026-04-01)

### Full-Scale Audit Findings

**Production app status**: All 30 screens FULLY IMPLEMENTED (28 functional + 2 deprecated redirects + 1 routing redirect). See `docs/FULL_SCALE_AUDIT_REPORT.md`.

**Feature alignment**: 97% — only `workouts/[id].tsx` is minimal (86 lines). See `docs/FEATURE_ALIGNMENT_REPORT.md`.

### Clean-Room Rebuild Progress (fitquest-ui-core)

| Layer / Cluster | Status | Notes |
|----------------|--------|-------|
| Layer 0: Tokens | ✅ DONE | colors, spacing, typography |
| Layer 1: Base Components | ✅ DONE | Button, Card, ProgressBar, StatBlock, Carousel |
| Layer 2: Layout Primitives | ⬜ | ScreenContainer, Grid, Divider |
| Layer 3: Domain Components | ⚠️ PARTIAL | ExerciseCard, TimerDisplay, WorkoutHeader (Cluster 5) |
| Cluster 1-2: Onboarding/Auth | ✅ DONE | In fitquest-ui-core @ 9cc1d6e |
| Cluster 3: Dashboard | ✅ DONE | In fitquest-ui-core |
| Cluster 4: Workout | ✅ DONE | Extended FSM, ExerciseSelection, WorkoutSummary |
| Cluster 5: Exercises/Movement | ✅ DONE | ExerciseCard, workout flow wiring |
| Clusters 6-11 | ⬜ | Not started |
| Phase D: Integration | ⬜ | No screens replaced in production yet |

### Key Decision Needed

**Option A**: Continue clean-room rebuild (Clusters 6-11 in fitquest-ui-core) → then Phase D integration  
**Option B**: Lint-fix production screens directly (225 errors, 662 warnings) → skip clean-room for remaining clusters  
**Option C**: Hybrid — lint-fix simple screens (legal, feedback) directly; clean-room complex ones (dashboard, workout)

### Production Lint Baseline

| Metric | Count | Target |
|--------|-------|--------|
| Lint errors | 225 | 0 |
| Lint warnings | 662 | 0 |
| Total violations | 887 | <50 |
| Hardcoded colors | ~225 | 0 |
| Inline fontSize | ~662 | 0 |
| Screens on ui-system spec | 0/30 | 30/30 |

### Gaps Identified

1. `workouts/[id].tsx` — 86 lines, functional but minimal. Needs: per-exercise breakdown, set data, performance comparison
2. No standalone post-workout summary screen (embedded in workout flow)
3. FitMind module deprecated (code preserved in src/fitmind/)
4. Professor AI consolidated into Coach (intentional)
5. Test coverage <40% — screen tests virtually absent
6. No CI/CD pipeline
7. RevenueCat test key in use — production key needed
8. No iOS signing/App Store configuration
