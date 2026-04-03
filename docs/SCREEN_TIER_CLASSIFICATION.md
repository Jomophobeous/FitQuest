# Phase 33 — SCREEN_TIER_CLASSIFICATION

**Mode**: `full_autonomous` | **Generated**: 2026-04-02

Classifies all 31 production screens into Tier 1 (Complex REBUILD), Tier 2 (Moderate PARTIAL REFACTOR), or Tier 3 (Simple DIRECT LINT FIX) based on complexity, violation density, and UI debt.

---

## Classification Criteria

| Factor | Weight | Tier 1 Threshold | Tier 2 Threshold | Tier 3 Threshold |
|--------|--------|-----------------|-----------------|-----------------|
| Line count | 30% | >1000 LOC | 400–1000 LOC | <400 LOC |
| Inline fontSize violations | 25% | >25 | 10–25 | <10 |
| Raw `<Text>` density | 20% | >40 | 15–40 | <15 |
| Hardcoded colors | 15% | >10 | 3–10 | <3 |
| Freestyle buttons (CTA context) | 10% | >10 CTA-worthy | 3–10 | <3 |

---

## TIER 1 — Complex REBUILD (7 screens)

These screens have >1000 LOC, high violation density, and complex state logic. They need component extraction + full token migration, not just find-replace.

| # | Screen | LOC | fontSize Violations | Raw Text | Notes |
|---|--------|-----|--------------------:|----------|-------|
| 1 | profile.tsx | 2,756 | 60 | ~80 | Settings mega-file. Needs extraction into sub-screens. Single biggest debt item. |
| 2 | coach/index.tsx | 2,025 | 19 | ~30 | AI chat interface. Complex message rendering, input bar, animation. |
| 3 | fitquest.tsx | 1,819 | 43 | ~50 | Main workout hub. Heavy animation, category cards, workout generation CTA. |
| 4 | onboarding.tsx | 1,493 | 27 | ~35 | Multi-step wizard. Complex form state, animations, step navigation. |
| 5 | move.tsx | 1,320 | 39 | ~40 | Step tracker + jog tracker. Sensor integration, charts, background services. |
| 6 | dashboard.tsx | 1,292 | 22 | ~30 | App home. Dynamic tiles, streak ring, quick actions, daily summary. |
| 7 | craft-my-body.tsx | 1,084 | 29 | ~30 | Body assessment wizard. Multi-step form, calculations, output display. |

**Total Tier 1 debt**: 11,789 LOC | 239 fontSize violations | ~295 raw Text

**Rebuild strategy**: Extract sub-components → migrate tokens → replace inline patterns → validate each screen in isolation. Profile.tsx should be split into at least 4 files (Settings sections).

---

## TIER 2 — Moderate PARTIAL REFACTOR (11 screens)

These screens have 400–1000 LOC. Violation density is moderate. Fix approach: batch lint fixes + selective component extraction where needed.

| # | Screen | LOC | fontSize Violations | Raw Text | Notes |
|---|--------|-----|--------------------:|----------|-------|
| 8 | health-dashboard.tsx | 1,079 | 11 | ~15 | Health rings and charts. Lower violation ratio for its size — cleanest large screen. |
| 9 | create-workout.tsx | 1,037 | 17 | ~20 | Exercise picker + workout builder. Moderate complexity. |
| 10 | analytics.tsx | 1,035 | 37 | ~35 | Charts + stats. High violation count but patterns are repetitive (batch-fixable). |
| 11 | login.tsx | 917 | 15 | ~15 | Auth form. Moderate size due to validation + animation. |
| 12 | nutrition-calculator.tsx | 860 | 16 | ~15 | Calculator form. Repetitive input patterns. |
| 13 | saved-workouts.tsx | 836 | 15 | ~15 | Workout list. Cards + list items. |
| 14 | workout.tsx | 803 | 24 | ~25 | Active workout screen. Timer + exercise display. |
| 15 | exercises.tsx | 781 | 17 | ~20 | Exercise catalogue browser. Filter + list pattern. |
| 16 | progress.tsx | 637 | ~8 | ~15 | Progress charts. Moderate complexity. |
| 17 | meal-prep.tsx | 617 | 16 | ~20 | Meal planning. Form + list pattern. |
| 18 | feedback.tsx | 535 | 15 | ~15 | Feedback form. Relatively simple but large LOC for scope. |

**Total Tier 2 debt**: 9,137 LOC | ~191 fontSize violations | ~210 raw Text

**Refactor strategy**: Batch 1 — fix all hardcoded colors across Tier 2 (scriptable). Batch 2 — fontSize → ThemedText (pattern-match per-screen). Batch 3 — extract any repeated card/list-item into shared component.

---

## TIER 3 — Simple DIRECT LINT FIX (13 screens)

These screens have <535 LOC and low violation density. Fix approach: direct find-replace. No architectural changes needed.

| # | Screen | LOC | fontSize Violations | Raw Text | Notes |
|---|--------|-----|--------------------:|----------|-------|
| 19 | backups.tsx | 519 | ~4 | ~10 | Backup/restore UI. Simple. |
| 20 | paywall.tsx | 488 | 14 | ~15 | Subscription paywall. Mostly styled already. |
| 21 | splash.tsx | 452 | 5 | ~5 | Splash screen. 6 hardcoded colors (main issue). |
| 22 | register.tsx | 392 | 8 | ~10 | Registration form. Simple. |
| 23 | _layout.tsx | 546 | 0 | ~5 | Root layout. No typography violations — logic file. |
| 24 | legal-center.tsx | 280 | ~2 | ~10 | Legal links page. Trivial. |
| 25 | privacy-policy.tsx | 228 | ~1 | ~5 | Static content. Trivial. |
| 26 | workouts/index.tsx | 213 | ~3 | ~8 | Workout list navigation. |
| 27 | terms-of-service.tsx | 123 | ~1 | ~5 | Static content. Trivial. |
| 28 | workouts/[id].tsx | 86 | ~2 | ~5 | Workout detail route. |
| 29 | index.tsx | 7 | 0 | 0 | Redirect only. |
| 30 | fitmind-library.tsx | 6 | 0 | 0 | Placeholder. |
| 31 | fitmind-reader.tsx | 5 | 0 | 0 | Placeholder. |
| 32 | professor/index.tsx | 5 | 0 | 0 | Placeholder. |

**Total Tier 3 debt**: 3,350 LOC | ~40 fontSize violations | ~78 raw Text

**Fix strategy**: Direct lint-fix pass — 1 batch per rule type. Splash needs 6 color token swaps. Paywall has the highest Tier 3 violation count (14 fontSize) — still batch-fixable.

---

## Execution Priority Matrix

| Phase | Tier | Screens | Approach | Estimated Violations Fixed |
|-------|------|---------|----------|---------------------------|
| **Phase A** | Tier 3 | 13 screens | Direct lint fix (colors → fontSize → spacing) | ~118 violations |
| **Phase B** | Tier 2 | 11 screens | Batch lint fix + selective extraction | ~401 violations |
| **Phase C** | Tier 1 | 7 screens | Component extraction + full token migration | ~534 violations |

**Rationale**: Tier 3 first = quick wins, proves the pattern works. Tier 2 = bulk of screens, batch-scriptable. Tier 1 last = requires architectural decisions (esp. profile.tsx split).

---

## Cross-Tier Violation Density Heat Map

```
VIOLATION DENSITY (fontSize + raw Text + hardcoded colors per 100 LOC)

profile.tsx         ████████████████████  7.8/100 LOC  (TIER 1)
analytics.tsx       █████████████████████ 9.3/100 LOC  (TIER 2) ← worst ratio
fitquest.tsx        ████████████████      6.7/100 LOC  (TIER 1)
move.tsx            ███████████████████   8.0/100 LOC  (TIER 1)
craft-my-body.tsx   ██████████████        6.5/100 LOC  (TIER 1)
onboarding.tsx      ████████████          5.3/100 LOC  (TIER 1)
workout.tsx         ██████████████████    7.8/100 LOC  (TIER 2)
dashboard.tsx       ████████████          5.4/100 LOC  (TIER 1)
paywall.tsx         ███████████████████   7.5/100 LOC  (TIER 3) ← worst Tier 3
feedback.tsx        ███████████████████   7.3/100 LOC  (TIER 2)
```

**Key insight**: analytics.tsx has the WORST violation density (9.3/100 LOC) despite being Tier 2. Consider treating it as high-priority within its tier.

---

*Alfred Ω — Phase 33 System Convergence*
