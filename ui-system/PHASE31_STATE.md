# Phase 31 — UI/UX Enforcement System State

## A. Previous Instructions (Phase 31 Goals)

### Mission
Turn design intelligence output into consistent, enforced UI across the entire app.

### Enforced Rules
1. **Token-only styling** — all colors, spacing, typography from `/ui-system/tokens/`
2. **Component lock** — only 5 approved base components (Button, Card, ProgressBar, StatBlock, Carousel)
3. **No freestyle UI** — no new components without registry update
4. **Lint enforcement** — `node ui-system/rules/lint.js` with 10 rules
5. **Screen blueprints** — onboarding + dashboard layouts defined
6. **ThemedText only** — no raw `<Text>` with inline fontSize
7. **GradientButton only** — no new button components
8. **GlassCard only** — no freestyle card patterns
9. **No AsyncStorage** — SecureStore or SQLite only
10. **No setTimeout hacks** — explicit state gates

### Design Intelligence Pipeline
- Pexels → confirmed working (mood/color/atmosphere extraction)
- Openverse → intermittent (3s timeout graceful)
- Dribbble → credentials updated, needs OAuth flow
- Extraction engine → source-aware, fitness context inference working

---

## B. Current Progress

| Area | Status | Detail |
|------|--------|--------|
| Design tokens (colors) | ✅ Complete | `tokens/colors.json` — dark/light/semantic/category |
| Design tokens (spacing) | ✅ Complete | `tokens/spacing.json` — numeric keys + radius |
| Design tokens (typography) | ✅ Complete | `tokens/typography.json` — h1-caption + variants |
| Component specs (5) | ✅ Complete | Button, Card, ProgressBar, StatBlock, Carousel |
| Component registry | ✅ Complete | `registry.json` — lock manifest |
| Layout blueprints | ⚠️ Partial | onboarding + dashboard only |
| Lint rule engine | ✅ Complete | 10 rules, baseline: 225 errors, 662 warnings |
| Screen implementations | ❌ Not started | Zero screens rebuilt to spec |
| Screen migrations | ❌ Not started | Legacy screens untouched |
| Navigation structure | ❌ Not started | Not defined in ui-system |
| Component expansion | ❌ Not started | ExerciseCard, ActivityFeed, HeaderBar pending |
| Figma sync | ❌ Not started | No Figma-driven validation yet |
| Visual testing | ❌ Not started | No before/after diff system |

---

## C. Incomplete Structures

### Screens (ALL — not built)
- 30 screens identified in `app/` directory
- Zero screens rebuilt to ui-system spec
- Legacy screens remain functional but violate token/component rules

### Navigation
- Expo Router file-based routing exists but not aligned with ui-system
- No navigation structure defined in ui-system

### Component Expansion
- Only 5 base components locked
- Missing domain-specific: ExerciseCard, ActivityFeed, HeaderBar, WorkoutTimer, MuscleMap

### Integration
- ui-system exists as standalone spec files
- No runtime enforcement (lint is CLI only)
- No CI/CD integration

---

## D. Lint Baseline (codebase-wide)

```
Errors:   225
Warnings: 662
Total:    887
```

Primary violation categories:
- Hardcoded hex colors (errors)
- Inline fontSize (warnings)
- setTimeout usage (warnings)
- Math.random (errors — security context)

---

## E. Decision Record

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-01 | Created ui-system | System-first approach |
| 2026-04-01 | Locked 5 base components | Prevent freestyle UI |
| 2026-04-01 | Freeze legacy UI | No modifications to old screens |
| 2026-04-01 | Clean room rebuild | Decouple new UI from legacy complexity |
| 2026-04-01 | fitquest-ui-core repo | Isolated fast iteration environment |

---

## F. Screen Inventory (30 screens)

### SYSTEM (3)
| Screen | File | Priority |
|--------|------|----------|
| Splash | `app/splash.tsx` | P2 |
| Index (entry) | `app/index.tsx` | P1 |
| Root Layout | `app/_layout.tsx` | P1 |

### AUTH (2)
| Screen | File | Priority |
|--------|------|----------|
| Login | `app/login.tsx` | P2 |
| Register | `app/register.tsx` | P2 |

### ONBOARDING (1)
| Screen | File | Priority |
|--------|------|----------|
| Onboarding | `app/onboarding.tsx` | P1 |

### CORE APP — Dashboard (1)
| Screen | File | Priority |
|--------|------|----------|
| Dashboard | `app/dashboard.tsx` | P1 |

### CORE APP — Workout (5)
| Screen | File | Priority |
|--------|------|----------|
| FitQuest (workout hub) | `app/fitquest.tsx` | P1 |
| Workout (active session) | `app/workout.tsx` | P1 |
| Create Workout | `app/create-workout.tsx` | P2 |
| Saved Workouts | `app/saved-workouts.tsx` | P2 |
| Workout Detail | `app/workouts/[id].tsx` | P2 |
| Workouts Index | `app/workouts/index.tsx` | P2 |

### CORE APP — Exercises & Movement (3)
| Screen | File | Priority |
|--------|------|----------|
| Exercises | `app/exercises.tsx` | P1 |
| Move (steps/jog) | `app/move.tsx` | P2 |
| Craft My Body | `app/craft-my-body.tsx` | P3 |

### HEALTH & PROGRESS (3)
| Screen | File | Priority |
|--------|------|----------|
| Health Dashboard | `app/health-dashboard.tsx` | P2 |
| Progress | `app/progress.tsx` | P2 |
| Analytics | `app/analytics.tsx` | P3 |

### AI ASSISTANTS (2)
| Screen | File | Priority |
|--------|------|----------|
| Coach | `app/coach/index.tsx` | P3 |
| Professor | `app/professor/index.tsx` | P3 |

### FITMIND (2)
| Screen | File | Priority |
|--------|------|----------|
| FitMind Library | `app/fitmind-library.tsx` | P3 |
| FitMind Reader | `app/fitmind-reader.tsx` | P3 |

### NUTRITION (2)
| Screen | File | Priority |
|--------|------|----------|
| Meal Prep | `app/meal-prep.tsx` | P3 |
| Nutrition Calculator | `app/nutrition-calculator.tsx` | P3 |

### PROFILE & SETTINGS (1)
| Screen | File | Priority |
|--------|------|----------|
| Profile | `app/profile.tsx` | P2 |

### MONETIZATION (1)
| Screen | File | Priority |
|--------|------|----------|
| Paywall | `app/paywall.tsx` | P2 |

### LEGAL & SUPPORT (4)
| Screen | File | Priority |
|--------|------|----------|
| Legal Center | `app/legal-center.tsx` | P3 |
| Privacy Policy | `app/privacy-policy.tsx` | P3 |
| Terms of Service | `app/terms-of-service.tsx` | P3 |
| Feedback | `app/feedback.tsx` | P3 |

### DATA MANAGEMENT (1)
| Screen | File | Priority |
|--------|------|----------|
| Backups | `app/backups.tsx` | P3 |

---

**Total: 30 screens | P1: 7 | P2: 11 | P3: 12**
