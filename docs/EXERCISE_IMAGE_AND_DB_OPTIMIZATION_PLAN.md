# FitQuest 2.0 — Exercise Image & Database Optimization Plan

> **Status:** Research & Planning (NOT execution)  
> **Created:** 2026-02-21 | **Updated:** 2026-02-19 (corrected exercise counts from live DB)  
> **Depends on:** [WORKOUT_FLOW_RESEARCH_AND_PLAN.md](./WORKOUT_FLOW_RESEARCH_AND_PLAN.md)

---

## Table of Contents
1. [Current State Audit](#1-current-state-audit)
2. [Free Exercise Image Database Research](#2-free-exercise-image-database-research)
3. [Image Strategy: Images Over Videos](#3-image-strategy-images-over-videos)
4. [Exercise Archival Plan](#4-exercise-archival-plan)
5. [Category Rename Evaluation](#5-category-rename-evaluation)
6. [Optimized Execution Phases](#6-optimized-execution-phases)
7. [Risk Assessment](#7-risk-assessment)

---

## 1. Current State Audit

### 1.1 Exercise Inventory

The core seed system has **three layers** that were initially missed:

| Source | Count | Has Images | Categories Used |
|--------|------:|:----------:|-----------------|
| **Handcrafted (seed.ts arrays)** | 47 | ❌ None | calisthenics (29), getting_taller (10), flexible (8) |
| **Generated (exerciseGeneratorExpanded.ts)** | ~741 | ❌ None | calisthenics (364), flexible (161+), faster (102+), getting_taller (43), building_muscle (50+), mental_clarity (21) |
| **External (free-exercise-db)** | 863 (after 5 deduped) | ✅ All (2 per exercise) | building_muscle (666), flexible (123), faster (74) |
| **Total in DB** | **1,651** | 863 with images, **788 without** | 6 categories (all populated) |

**How the generator works:** `exerciseGeneratorExpanded.ts` defines **402 base exercise templates** with variation flags (`canAddTempo`, `canAddPause`, `canAddIsometric`, `canAddPlyometric`, `canAddUnilateral`, `canAddElevated`, `canAddWeighted`). The `generateAllExercises()` function creates ~741 unique exercises from these templates. Combined with 47 handcrafted exercises = **788 core exercises** (confirmed by terminal: `"Database already seeded with 788 exercises"`).

**Key finding:** **788 core exercises have zero images** (47 handcrafted + ~741 generated). Only the 863 external exercises from free-exercise-db have images. This means **47.7% of all exercises are image-less** — far worse than initially estimated.

### 1.2 Image Infrastructure (Already Built)

The `exercise_images` table exists (schema v10) and is already populated:

```sql
CREATE TABLE IF NOT EXISTS exercise_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id TEXT NOT NULL,
  image_path TEXT NOT NULL,        -- e.g. "3_4_Sit-Up/0.jpg"
  image_order INTEGER NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'external',  -- 'external', 'user', 'generated'
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);
```

- **1,736 image records** in `external-exercises-data.ts` (2 per exercise × 868)
- Image paths reference `{ExerciseName}/0.jpg` and `{ExerciseName}/1.jpg`
- Source files exist at `workspace-repos/exercise-content/free-exercise-db/exercises/`

### 1.3 Image Files On Disk

| Metric | Value |
|--------|-------|
| Total image files | 1,746 JPGs |
| Total disk size | ~101 MB |
| Average per image | ~58 KB |
| Images per exercise | Exactly 2 (start + end position) |
| Format | JPEG |
| Source license | **Unlicense (public domain)** |

### 1.4 Category Distribution (Live DB — from terminal logs)

| Category | Core (788) | External (863) | Total | % | Has Images |
|----------|----------:|---------------:|------:|--:|:----------:|
| `building_muscle` | ~58 | 666 | **724** | 43.9% | 666 of 724 (92%) |
| `calisthenics` | ~393 | 0 | **393** | 23.8% | 0 of 393 (0%) ❌ |
| `flexible` | ~161 | 123 | **284** | 17.2% | 123 of 284 (43%) |
| `faster` | ~102 | 74 | **176** | 10.7% | 74 of 176 (42%) |
| `getting_taller` | ~53 | 0 | **53** | 3.2% | 0 of 53 (0%) ❌ |
| `mental_clarity` | ~21 | 0 | **21** | 1.3% | 0 of 21 (0%) ❌ |

*Source: Terminal log — `[FitQuest DB] Category breakdown: [{"category":"building_muscle","count":724},{"category":"calisthenics","count":393},{"category":"faster","count":176},{"category":"flexible","count":284},{"category":"getting_taller","count":53},{"category":"mental_clarity","count":21}]`*

**Critical observations:**
- `calisthenics` (393 exercises) has **zero images** — largest imageless category
- `getting_taller` (53) and `mental_clarity` (21) have **zero images** — entirely FitQuest-original
- `flexible` and `faster` are partially covered (42-43% have images from external DB)
- `building_muscle` is 92% covered — only ~58 generated core exercises lack images
- External exercises never mapped to `calisthenics`, `getting_taller`, or `mental_clarity` because the source DB (free-exercise-db) only has: `strength`, `stretching`, `cardio`, `plyometrics`
- **467 exercises (28.3%) are in categories with 0% image coverage**

### 1.5 Generator Template Distribution (exerciseGeneratorExpanded.ts)

| Template Group | Count | Primary Categories |
|---------------|------:|--------------------|
| PUSH_TEMPLATES | ~15 | calisthenics |
| PULL_TEMPLATES | ~15 | calisthenics |
| LEG_TEMPLATES | ~20 | calisthenics, faster |
| CORE_TEMPLATES | ~15 | calisthenics |
| FLEXIBILITY_TEMPLATES | ~20 | flexible |
| POSTURE_TEMPLATES | ~15 | getting_taller |
| SPEED_TEMPLATES | ~20 | faster |
| MENTAL_CLARITY_TEMPLATES | ~21 | mental_clarity |
| MUSCLE_BUILDING_TEMPLATES | ~25 | building_muscle |
| MOBILITY/CARDIO/BALANCE/RECOVERY/FUNCTIONAL/SPORT + EXTRAS + BONUS | ~236 | mixed |
| **Total templates** | **402** | → generates ~741 exercises via variations |

### 1.6 Current Category Mapping (Import Script)

```typescript
const CATEGORY_MAP: Record<string, Category> = {
  'strength': 'building_muscle',
  'powerlifting': 'building_muscle',
  'olympic weightlifting': 'building_muscle',
  'strongman': 'building_muscle',
  'stretching': 'flexible',
  'cardio': 'faster',
  'plyometrics': 'faster',
  'compound': 'calisthenics',    // ← never fired (no external exercises have category="compound")
  'isolation': 'building_muscle',
};
```

---

## 2. Free Exercise Image Database Research

### 2.1 Database Comparison Matrix

| Database | Exercises | Images | Image Type | License | API | Schema Match |
|----------|--------:|-------:|:----------:|:-------:|:---:|:------------:|
| **yuhonas/free-exercise-db** | 873 | 1,746 | Static JPG (2 per ex.) | Unlicense (PD) | No (JSON files) | ⬛⬛⬛⬛⬛ Perfect |
| **wrkout/exercises.json** | 873 | 0 | None | Unlicense (PD) | No (JSON files) | ⬛⬛⬛⬛⬜ Good (no images) |
| **wger.de API** | 849 | 334 | PNG (mixed) | AGPL-3.0 / CC | REST API | ⬛⬛⬜⬜⬜ Partial |
| **ExerciseDB (rapidapi)** | 1,300+ | GIFs | Animated GIF | Paid API ($10-50/mo) | REST API | ⬛⬛⬛⬜⬜ Medium |
| **MuscleWiki** | 500+ | SVG + GIF | Animated | Proprietary | Scraping only | ⬛⬜⬜⬜⬜ Poor |

### 2.2 Detailed Analysis

#### A. yuhonas/free-exercise-db ⭐ **ALREADY INTEGRATED — PRIMARY SOURCE**
- **Status:** Already cloned at `workspace-repos/exercise-content/free-exercise-db/`
- **Already imported:** 868 exercises with full image references in `external-exercises-data.ts`
- **License:** Unlicense (public domain) — **no attribution required, commercial use allowed**
- **Schema fields:** name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images, id
- **Image quality:** Static JPG, start+end position
- **Verdict:** ✅ Primary source. Already 100% integrated at data level. Only missing: actual image files not yet bundled into the app.

#### B. wrkout/exercises.json
- **Status:** Cloned at `workspace-repos/exercise-content/exercises.json/`
- **Relationship:** This is the UPSTREAM of free-exercise-db. Same exercises, but **no images** in the JSON schema.
- **License:** Unlicense (public domain)
- **Verdict:** ⚠️ Redundant. free-exercise-db is a superset (same data + images). No value to integrate separately.

#### C. wger.de (wger-project/wger)
- **Stars:** 5.6k | **License:** AGPL-3.0 (code), CC (exercise data)
- **Exercises:** 849 via REST API
- **Images:** Only 334 exercise images (38% coverage — incomplete)
- **Categories:** Abs, Arms, Back, Calves, Cardio, Chest, Legs, Shoulders (body-part based, not goal-based)
- **API format:** `{ id, uuid, category (int), muscles (int[]), muscles_secondary (int[]), equipment (int[]) }`
- **Image API:** `GET /api/v2/exerciseimage/` → 334 total images, returns hosted URLs
- **Key issue:** AGPL-3.0 license means **any code that interacts with wger API must be open-sourced**. CC license on exercise data requires attribution.
- **Verdict:** ❌ Not recommended. Low image coverage, license complications, body-part categories don't map well to our goal-based system.

#### D. ExerciseDB (via RapidAPI)
- **Exercises:** 1,300+ with animated GIFs
- **Cost:** $0 for 100 requests/day, $10/mo for 1000/day, $50/mo unlimited
- **Image quality:** High-quality animated GIFs showing full movement
- **Schema:** name, bodyPart, equipment, gifUrl, id, target, secondaryMuscles
- **Key issue:** Paid API, images are hosted (can't bundle offline), API could be discontinued, rate limits
- **Verdict:** ❌ Not suitable for offline-first app. Dependency risk + cost.

#### E. MuscleWiki
- **Exercises:** 500+ with animated SVG muscle overlays
- **License:** Proprietary — **not free for commercial use**
- **Access:** No public API, scraping-only
- **Verdict:** ❌ License prohibits use.

### 2.3 Supplementary Sources for Core Exercises (No Images)

For the **788 imageless core exercises** (47 handcrafted + ~741 generated), options to add images:

| Option | Effort | Quality | License Risk | Coverage |
|--------|--------|---------|:------------:|:--------:|
| **A. Map core exercises to free-exercise-db image counterparts** | Low | High | None | ~455/788 (58%) |
| **B. Reuse base exercise images for variations (Tempo/Pause/Iso)** | Low | Good | None | ~250 more |
| **C. Generate images with AI (DALL-E/Stable Diffusion)** | Medium | Medium | Low | Remaining ~83 |
| **D. Category-level placeholder images** | Low | Acceptable | None | getting_taller (53), mental_clarity (21) |
| **E. Remove all imageless exercises** | Low | N/A | None | Loses 788 unique exercises ❌ |

**Recommendation:** Options A + B + D (Image Sharing Strategy). Most generated exercises are variations of base exercises ("Tempo Push-up" → reuse Push-up images). For truly unique categories (getting_taller, mental_clarity), use category-level placeholder images. Do NOT delete/archive exercises — all 1,651 exercises remain in the DB.

---

## 3. Image Strategy: Images Over Videos

### 3.1 Why Static Images (Not Videos/GIFs)

| Factor | Static JPGs | Animated GIFs | Videos |
|--------|:-----------:|:-------------:|:------:|
| **Bundle size** | ~101 MB for 1,746 | ~500MB+ estimated | 2-5 GB |
| **Offline availability** | ✅ Bundled | ⚠️ Large bundle | ❌ Streaming only |
| **Load time** | Instant | 1-3s | 3-10s |
| **Battery impact** | Minimal | Medium (decode) | High |
| **Storage on device** | ~50 MB compressed | ~250 MB | Not feasible |
| **Already available** | ✅ 1,746 files | ❌ Need conversion | ❌ Need creation |
| **UX suitability** | Good (start/end pose) | Best (shows movement) | Overkill |

### 3.2 Image Delivery Strategy

**Recommended: Hybrid — bundled thumbnails + CDN full-size**

```
Phase 1: Bundle compressed thumbnails (450×450) with the app
         → ~20-30 MB added to app size
         → Instant display, works offline

Phase 2: (Future) Load full-size from GitHub raw CDN on demand
         → Base URL: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/
         → Cache locally after first load
         → No cost (GitHub serves raw files)
```

### 3.3 Image Component Architecture (Planned)

```typescript
// Planned: src/components/ExerciseImage.tsx
interface ExerciseImageProps {
  exerciseId: string;
  imageOrder?: 0 | 1;          // 0=start, 1=end
  size?: 'thumbnail' | 'full';
  autoAlternate?: boolean;      // Flip between 0/1 every 2s
}

// Resolution strategy:
// 1. Check bundled assets/exercises/{path}
// 2. Fallback to CDN: https://raw.githubusercontent.com/.../exercises/{path}
// 3. Fallback to placeholder with exercise name
```

### 3.4 Where Images Will Appear

| Screen | Usage | Image Behavior |
|--------|-------|---------------|
| **Exercise Library** (`exercises.tsx`) | Grid/list thumbnails | Static image_order=0 |
| **Exercise Detail Sheet** | Large image pair | Flip between 0↔1 (2s interval) |
| **Active Workout** (`fitquest.tsx`) | Full-width exercise demo | Flip 0↔1 with timing |
| **Workout Preview** | Small exercise cards | Static thumbnails |
| **Rest Period** | "Up Next" preview | Static image_order=0 |

---

## 4. Exercise Archival Plan

### 4.1 Exercises to Archive (No Images Available)

After cross-referencing core exercises against the free-exercise-db, exercises WITHOUT image matches will be archived rather than deleted.

**Predicted outcome (revised with actual counts):**
- **393 calisthenics** (generated variations like "Tempo Push-up", "Pause Squat") → Base exercises (push-up, squat, plank) likely have external matches, but **tempo/pause/isometric variations won't match** — these are FitQuest-original
- **53 getting_taller** → All FitQuest-specific (decompression hangs, spinal stretches, posture corrections). **No matches** in any free DB.
- **21 mental_clarity** → All FitQuest-specific (meditation, breathing, visualization). **No matches** in any free DB.
- **~161 flexible** (core) → Some base exercises match external stretching equivalents, variations won't
- **~102 faster** (core) → Some base exercises match external cardio/plyometrics equivalents
- **~58 building_muscle** (core) → Many will match external strength exercises

**Estimated archival scope (REVISED):** This is a much larger problem than initially thought. **788 core exercises lack images.** Options:
- **Option A (Aggressive):** Archive ALL imageless exercises, keep only 863 external → loses FitQuest-unique content
- **Option B (Conservative):** Keep all exercises, show placeholder icon for imageless ones → poor UX for 48% of exercises  
- **Option C (Recommended: Hybrid):** Map base exercises to external images where possible. For variations ("Tempo X", "Pause X"), reuse the base exercise's images. For truly unique categories (getting_taller, mental_clarity), create minimal illustrations or use category-level placeholder images.

### 4.2 Archival Strategy

```sql
-- Phase 1: New archive table (schema v12)
CREATE TABLE archived_exercises (
  id TEXT PRIMARY KEY,
  original_data TEXT NOT NULL,    -- Full JSON snapshot of exercise + muscles + equipment + training_types
  archive_reason TEXT NOT NULL,   -- 'no_image', 'duplicate', 'deprecated'
  archived_at INTEGER NOT NULL,
  can_restore INTEGER DEFAULT 1   -- Allow user to restore in future
);

-- Phase 2: Archive process
-- 1. Snapshot exercise + all junction table data into JSON
-- 2. INSERT into archived_exercises
-- 3. DELETE from exercises (CASCADE handles junction tables)
-- 4. Any workout_sessions referencing archived exercises keep their data
--    (session_exercises has exercise_id but workout is already completed)
```

### 4.3 Core ↔ External Image Sharing Strategy (Revised)

Instead of archiving and merging exercises (which would lose 788 unique exercises), **share images between matching exercises:**

```
Core: "gen_push_up" (calisthenics, no image)
Core: "gen_tempo_push_up" (calisthenics, no image)  
Core: "gen_pause_push_up" (calisthenics, no image)
External: "fed_push_up" (building_muscle, has images: Push-Ups/0.jpg, Push-Ups/1.jpg)

Image sharing strategy:
1. Build name-matching map: normalize exercise names, find external matches
2. For exact matches: INSERT INTO exercise_images for core exercise using external's image_path
3. For variations (Tempo/Pause/Isometric X): use base exercise's image_path
4. For truly unique exercises: use category placeholder image
5. NO exercises are deleted or archived — all 1651 remain
```

**Estimated image coverage after sharing:**
- calisthenics (393): ~250 could share images from external matches (~64%)
- flexible (161 core): ~100 could share from stretching equivalents (~62%)
- faster (102 core): ~60 could share from cardio/plyometrics equivalents (~59%)
- building_muscle (58 core): ~45 could share from strength equivalents (~78%)
- getting_taller (53): 0 matches — need placeholder images
- mental_clarity (21): 0 matches — need placeholder images
- **Estimated total with images: ~1318 of 1651 (80%)** vs current 863 (52%)

---

## 5. Category Rename Evaluation

### 5.1 The Two Options

| Current | Option A: Standard | Option B: Ultra-Efficient |
|---------|-------------------|--------------------------|
| `calisthenics` | `body_control` | `control` |
| `getting_taller` | `posture` | `posture` |
| `faster` | `speed` | `speed` |
| `flexible` | `mobility` | `mobility` |
| `mental_clarity` | `focus` | `mind` |
| `building_muscle` | `strength` | `power` |

### 5.2 Compatibility Analysis

**External DB source categories** (free-exercise-db):

| Source Category | Current Mapping | Option A Mapping | Option B Mapping |
|----------------|----------------|------------------|------------------|
| `strength` | → building_muscle | → strength ⭐ NATURAL FIT | → power ⚠️ power ≠ strength |
| `stretching` | → flexible | → mobility ✅ | → mobility ✅ |
| `cardio` | → faster | → speed ⚠️ cardio ≠ speed | → speed ⚠️ |
| `plyometrics` | → faster | → speed ✅ GOOD FIT | → speed ✅ |
| `powerlifting` | → building_muscle | → strength ✅ | → power ⭐ BETTER FIT |
| `olympic weightlifting` | → building_muscle | → strength ✅ | → power ✅ |
| `strongman` | → building_muscle | → strength ✅ | → power ✅ |

**Option A (`strength`)** maps perfectly to the source's `strength` category — 1:1 semantic match.  
**Option B (`power`)** is technically defined as strength × speed — a different training modality than general strength.

### 5.3 External API Compatibility

**wger.de categories:** Abs, Arms, Back, Calves, Cardio, Chest, Legs, Shoulders → body-part based, orthogonal to both options. No mapping advantage.

### 5.4 Code Impact Analysis

| Metric | Count |
|--------|------:|
| Files with category strings | 22 |
| Total string occurrences | 174 |
| Database schema CHECK constraints | 1 (exercises table) |
| Exercise generator templates (402) | exerciseGeneratorExpanded.ts — category strings in all 402 templates |
| External seed data file (28K lines) | Would need regeneration |
| Translation keys | 6 (per 15 languages = 90 entries) |

**Migration effort: ~3-4 hours** with a systematic find-and-replace + schema migration script. The generator (`exerciseGeneratorExpanded.ts`) adds complexity since its 402 base templates each have hardcoded category strings.

### 5.5 Migration Path

```sql
-- Schema v12 migration
-- 1. Drop CHECK constraint (SQLite: recreate table)
-- 2. UPDATE exercises SET category = CASE category
--      WHEN 'calisthenics' THEN 'body_control'
--      WHEN 'getting_taller' THEN 'posture'
--      WHEN 'faster' THEN 'speed'
--      WHEN 'flexible' THEN 'mobility'
--      WHEN 'mental_clarity' THEN 'focus'
--      WHEN 'building_muscle' THEN 'strength'
--    END;
-- 3. Also UPDATE user_profile.goal, body_craft_algorithms.goal_type
-- 4. Regenerate external-exercises-data.ts with new categories
```

### 5.6 Recommendation

**Option A (Standard)** for the following reasons:

1. **`strength`** maps 1:1 to the most common source category (`strength`), avoiding semantic confusion
2. **`body_control`** better describes calisthenics than `control` (which is vague)
3. **`focus`** is clearer than `mind` for mental clarity exercises
4. **`mobility`** is the modern fitness industry standard term (replacing "flexibility")
5. **`posture`** is excellent — both options agree on this
6. **`speed`** works well — both options agree

Option B's single-word approach saves ~3 characters per category but introduces semantic ambiguity (`control` of what? `power` vs `strength`? `mind` for what?).

---

## 6. Optimized Execution Phases

### Phase 0: Pre-work (Before Any Code Changes)
**Estimated: 1 hour**

- [ ] Back up `external-exercises-data.ts` (28K lines, critical)
- [ ] Create `archived_exercises` snapshot of current state
- [ ] Document exact list of core exercises and their external equivalents
- [ ] Verify all 1,746 image files are present in workspace-repos

### Phase 1: Image Bundling Pipeline
**Estimated: 3-4 hours**

- [ ] Create `scripts/optimize-exercise-images.ts`
  - Read all images from `workspace-repos/exercise-content/free-exercise-db/exercises/`
  - Resize to 450×450 (or width-constrained to 450px)
  - Compress to WebP or optimized JPEG (target ~15-20 KB per image)
  - Output to `assets/exercises/{ExerciseName}/0.jpg` (and 1.jpg)
- [ ] Create `src/components/ExerciseImage.tsx` component
  - Takes `exerciseId` + `imageOrder`
  - Resolves from bundled assets, CDN fallback, placeholder fallback
  - Auto-alternating mode (flip between 0 and 1)
- [ ] Wire into `ExerciseDetailSheet.tsx` (replace text-only header with image)
- [ ] Wire into `exercises.tsx` (grid thumbnails)
- [ ] Verify app bundle size increase is acceptable (<30 MB for images)

### Phase 2: Image Sharing — Map Core Exercises to External Images
**Estimated: 3-4 hours**

- [ ] Create mapping script: `scripts/map-core-to-external-images.ts`
  - Normalize exercise names (strip "Tempo ", "Pause ", "Isometric ", etc.)
  - For each core exercise, find best external match by normalized name
  - Output: `{coreId, externalId, imagePath, matchType}[]`
  - Match types: `exact`, `variation` (base exercise match), `manual`, `none`
- [ ] For matched exercises (estimated ~455 exact + ~250 variation):
  - INSERT INTO `exercise_images` for core exercise using external's `image_path`
  - Variation exercises use their base exercise's image ("Tempo Push-up" → Push-Up images)
  - No exercises are deleted — all 1,651 remain
- [ ] For unmatched exercises (~83):
  - Create 6 category-level placeholder images (one per category)
  - INSERT placeholder image for getting_taller (53) and mental_clarity (21)
  - Log remaining ~9 truly unique exercises for future image creation
- [ ] Test: verify image lookup works for core exercises, workout generation still works

### Phase 3: Category Rename (Option A)
**Estimated: 2-3 hours**

- [ ] Schema migration v12:
  - Recreate `exercises` table with new CHECK constraint
  - UPDATE all category values in `exercises`, `user_profile.goal`, `body_craft_algorithms`
  - UPDATE `exercise_training_types` if any category references
- [ ] Code-level renames across 22 files, 174 occurrences:
  - `src/database/types.ts` — Category type union
  - `src/database/schema.ts` — CHECK constraint
  - `src/database/seed.ts` — Core exercise data
  - `src/database/service.ts` — Any hardcoded references
  - `src/engines/workoutGenerator.ts` — Category logic
  - `src/engines/bodyCraftEngine.ts` — Goal mapping
  - `src/i18n/translations.ts` — Display labels (15 languages)
  - `app/exercises.tsx`, `app/onboarding.tsx`, `app/profile.tsx`, etc.
  - `scripts/import-external-exercises.ts` — CATEGORY_MAP
- [ ] Regenerate `external-exercises-data.ts` with new category names
- [ ] Test: onboarding flow, exercise filtering, workout generation, profile settings

### Phase 4: Image Integration in Active Workout Flow
**Estimated: 2-3 hours**

- [ ] Add `ExerciseImage` to `fitquest.tsx` active workout view
  - Show exercise image during exercise execution
  - Auto-alternate 0↔1 every 2 seconds as form reference
- [ ] Add to rest period "Up Next" preview
- [ ] Add to workout preview/summary screens
- [ ] Test on Android device (memory usage with image flipping)

### Phase 5: Cleanup & Validation
**Estimated: 1-2 hours**

- [ ] Verify `mental_clarity` category (21 exercises) works correctly with placeholder images
- [ ] Verify all 863 external exercises display images correctly
- [ ] Verify archived exercises don't break workout history
- [ ] Run through complete onboarding → workout → completion flow
- [ ] Update `copilot-instructions.md` schema with new categories

**Total estimated effort: 13-18 hours**

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| App bundle +100 MB from raw images | HIGH | Compress/resize to 450px WebP (~20-30 MB total) |
| Breaking existing workout sessions after merge | HIGH | Keep `session_exercises` references, don't modify completed sessions |
| Category rename breaks user profiles | MEDIUM | Schema migration updates `user_profile.goal` atomically |
| Archived exercises referenced in progress_records | LOW | Progress records are historical — keep stale exercise_id references |
| External exercise instructions are plain text (not JSON) | MEDIUM | Already handled by `safeParseInstructions()` in service.ts |
| Some external images are duplicates (25 duplicate files per free-exercise-db README) | LOW | Only 25/1746 — negligible |
| `mental_clarity` category has only 21 exercises (all imageless) | LOW | All generated, functional — just needs placeholder images |
| 788 core exercises (48%) have no images at all | HIGH | Implement image sharing from external matches + category placeholders |
| Generated variation exercises ("Tempo X") have plain-text instructions, not JSON | HIGH | Already causes JSON parse errors at service.ts:118 — must fix safeParseInstructions() |

---

## Appendix A: Files Requiring Category Rename Changes

### Source files (src/)
1. `src/database/types.ts` — Category type definition
2. `src/database/schema.ts` — CHECK constraint + migration
3. `src/database/seed.ts` — 47 handcrafted exercises + merge logic with generator
4. `src/database/service.ts` — Query/filter logic
5. `src/database/exerciseGenerator.ts` — Generator logic
6. `src/database/exerciseGeneratorExpanded.ts` — Expanded generator
7. `src/engines/workoutGenerator.ts` — Workout algorithm
8. `src/engines/bodyCraftEngine.ts` — Body craft goals
9. `src/engines/stateResetDoctrine.ts` — State reset
10. `src/engines/transparencyLayer.ts` — Transparency
11. `src/engines/workout/algorithms/VolumeAlgorithm.ts` — Volume calc
12. `src/engines/workout/templates/WorkoutTemplates.ts` — Templates
13. `src/engines/workout/types.ts` — Workout types
14. `src/i18n/translations.ts` — 15 language translations
15. `src/services/exerciseTaxonomyMapper.ts` — Taxonomy mapping
16. `src/platform/phase7Platformization.ts` — Platform layer

### App screens (app/)
17. `app/coach/index.tsx` — Coach chat
18. `app/onboarding.tsx` — Goal selection
19. `app/profile.tsx` — Profile settings
20. `app/exercises.tsx` — Exercise library
21. `app/create-workout.tsx` — Custom workout creator

### Scripts
22. `scripts/import-external-exercises.ts` — Import pipeline

### Data files (must regenerate)
23. `src/database/external-exercises-data.ts` — 28,796 lines of SQL

## Appendix B: Category Rename Quick Reference

```typescript
// OLD → NEW (Option A: Standard)
const CATEGORY_RENAME_MAP = {
  'calisthenics':    'body_control',
  'getting_taller':  'posture',
  'faster':          'speed',
  'flexible':        'mobility',
  'mental_clarity':  'focus',
  'building_muscle': 'strength',
} as const;

// NEW Type
type Category = 'body_control' | 'posture' | 'speed' | 'mobility' | 'focus' | 'strength';

// CATEGORY_MAP for import script (source → new)
const CATEGORY_MAP: Record<string, Category> = {
  'strength':              'strength',     // ← perfect 1:1
  'powerlifting':          'strength',
  'olympic weightlifting': 'strength',
  'strongman':             'strength',
  'stretching':            'mobility',
  'cardio':                'speed',
  'plyometrics':           'speed',
  'compound':              'body_control',
  'isolation':             'strength',
};
```
