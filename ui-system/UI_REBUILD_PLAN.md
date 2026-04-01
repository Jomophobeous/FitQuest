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

| Phase | Clusters | Screens |
|-------|----------|---------|
| A (Foundations) | — | — | ✅ Done |
| B (Primitives + Domain) | — | — |
| C.1 (Onboarding) | 1 | 2 |
| C.2 (Auth) | 1 | 2 |
| C.3 (Dashboard) | 1 | 1 |
| C.4 (Workout) | 1 | 4 |
| C.5 (Exercises) | 1 | 2 |
| C.6 (Health) | 1 | 3 |
| C.7 (Profile) | 1 | 2 |
| C.8-11 (P3 screens) | 4 | 10 |
| D (Integration) | — | 30 |
| E (Enforcement) | — | — |
