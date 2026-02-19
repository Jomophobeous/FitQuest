# AI Enhancement — Phase Audit & Bug Prevention Strategy

**Date**: 2026-02-18  
**Scope**: All 5 enhancement phases of DualAIEngine  
**Status**: All bugs found have been **fixed in this audit**

---

## Bugs Found & Fixed

### BUG-1: `fillTemplate` missing 5 placeholders (Phase 4) — **FIXED**

**Severity**: MEDIUM — visible raw `{placeholder}` text shown to users  
**Location**: `src/fitmind/DualAIEngine.ts` → `fillTemplate()`  

**Root cause**: Phase 4 added templates using `{days}`, `{muscle}`, `{insight}`, `{relatedTopic}`, `{observation}`, and `{improvement}` placeholders, but `fillTemplate()` only handled `{name}`, `{streakDays}`, `{muscleGroup}`, etc.

**Affected templates**:
- `comeback_long`: `"Welcome back after {days} days!"` → user sees literal `{days}`
- `injury_aware`: `"Take it easy on that {muscle}"` → user sees `{muscle}`
- `text_analysis`: `{insight}`, `{relatedTopic}`, `{observation}` — never resolved
- `reading_encouragement`: `{improvement}` — never resolved
- `annotation_insight`: `{text}` resolves to empty string when no selection

**Fix**: Added all missing replacements with sensible fallbacks (`{days}` → `'0'`, `{muscle}` → `'that area'`, `{text}` → `'this passage'`, etc.)

---

### BUG-2: `comeback_long` double-replacement race (Phase 4) — **FIXED**

**Severity**: LOW — `{days}` sometimes replaced before `fillTemplate`, losing it  
**Location**: `processCoachQuery()` → hello/hi/hey intent branch  

**Root cause**: The code called `.replace('{days}', ...)` on the raw template string BEFORE `fillTemplate()` ran. Since `fillTemplate` uses regex `/{days}/g`, if the first replace already consumed `{days}`, `fillTemplate`'s version would have nothing to replace (harmless but redundant). But if `fillTemplate` ran first, it would replace `{days}` with `'0'` before the correct value was injected.

**Fix**: Reversed order — `fillTemplate()` runs first, then `.replace(/{days}/g, String(memory.lastInteractionDays))` replaces the fallback `'0'` with the real value.

---

### BUG-3: Division by zero in `getSmartSuggestions` (Phase 5) — **FIXED**

**Severity**: HIGH — JavaScript `Infinity` comparison causes empty suggestions  
**Location**: `getSmartSuggestions()` → `workout.setsCompleted / workout.totalSets`

**Root cause**: When `totalSets = 0` (e.g., no workout loaded yet, or warmup phase), dividing by zero produces `Infinity`. Then `progress >= 0.8` is always true, showing "Final push!" even when no workout exists.

**Fix**: Added guard `&& workout.totalSets > 0` before division.

---

### BUG-4: Streak milestone only fires on exact day (Phase 4, `getGreeting`) — **FIXED**

**Severity**: MEDIUM — users at day 31 never see the 30-day celebration  
**Location**: `getGreeting()` → streak milestone check

**Root cause**: `getGreeting()` used `streakDays === m` (exact match), so only day 7, 14, 30, 60, 90 would trigger. But `processCoachQuery()` correctly used `streakDays >= m`. A user at day 35 would see the streak-milestones in the query handler but never in the greeting.

**Fix**: Changed `=== m` to `>= m` in `getGreeting()` for consistency.

---

### BUG-5: `averageSessionLength` always returns 1-3 (Phase 3) — **FIXED**

**Severity**: LOW — meaningless metric, never impacts UI  
**Location**: `loadConversationMemory()` → return value calculation

**Root cause**: Formula was `Math.round(history.length / Math.min(history.length, 5))` which always equals `ceil(history.length / 5)` — not a session length at all. For 15 conversations it returns 3, for 10 it returns 2. It measured nothing real.

**Fix**: Implemented actual session detection by counting "bursts" of conversations within 30-minute windows, then dividing total conversations by session count.

---

### BUG-6: FSRS crash on NULL `due` from migration (Phase 1) — **FIXED**

**Severity**: CRITICAL — app crash when reviewing any pre-existing flashcard  
**Location**: `FSRSService.toFSRSCard()` + `schema.ts` migration

**Root cause**: The v10→v11 migration copies `next_review` to `due`. But SM-2 cards that were never reviewed have `next_review = NULL`. This means `due = NULL` after migration. When `toFSRSCard()` calls `new Date(null)`, it creates `Date(0)` (January 1, 1970) which is technically valid but semantically wrong. More dangerously, if `stability`, `difficulty`, or other FSRS fields are NULL (SQLite DEFAULT not yet applied), operations on them produce `NaN` which propagates through the FSRS algorithm.

**Fix**: 
1. Migration now uses `COALESCE(next_review, ${Date.now()})` to default NULL values
2. `toFSRSCard()` now guards every field: `flashcard.due && !isNaN(flashcard.due) ? flashcard.due : Date.now()`, and `flashcard.stability || 0`, etc.

---

### BUG-7: Neural model crash propagation (Phase 2) — **FIXED**

**Severity**: HIGH — one bad encoding crashes entire Professor response  
**Location**: `processProfessorQuery()` → `semanticSearch.search()`, `neuralSummarizer.summarize()`

**Root cause**: The semantic search and neural summarizer calls within `processProfessorQuery` intent branches were NOT wrapped in try/catch. If the sentence encoder fails (corrupt model, OOM, bad input encoding), the entire `query()` call crashes and no response is returned to the user.

**Fix**: Wrapped the entire intent-matching block in try/catch. On failure, falls back to a comprehension check template with lower confidence (0.4).

---

## Patterns That Are Safe (Verified)

| Pattern | Why It's Safe |
|---------|---------------|
| `lastInteractionDays = -1` when no history | Comeback templates require `>= 3`, so -1 never triggers them |
| `semanticSearch.search()` on unindexed docs | Returns `[]` safely, falls through to template fallback |
| `neuralSummarizer.summarize()` without model | Falls back to TF-IDF internally, returns valid `SummaryResult` |
| `knowledgeGraph.queryRelated()` before indexing | Already wrapped in its own try/catch in `processProfessorQuery` |
| `encryptedDB.storeAIConversation()` failure | Doesn't block response — stored after response is built |
| `recentTemplates` Map growth | ~40 categories × 5 strings = negligible memory |
| `pickRandomAvoidingRepeats` with 1-item arrays | Returns the only item (filter produces empty → falls back to full array) |
| FSRS `forgetCard()` on new cards | `state=0` is valid for `fsrs.forget()` |

---

## Prevention Strategies

### Strategy 1: Template Placeholder Registry

All template placeholders MUST be registered in `fillTemplate()`. Before adding any new template, verify that every `{placeholder}` in it has a handler.

**Rule**: If `fillTemplate` doesn't handle it, either:
1. Add it to `fillTemplate` with a fallback, OR
2. Replace it inline AFTER `fillTemplate` runs (like `{days}`)

### Strategy 2: Null-Defensive Data Mapping

Any function that reads from SQLite and maps to TypeScript objects must use null guards. SQLite `DEFAULT` clauses are only applied on `INSERT`, not retroactively on existing rows.

**Rule**: When reading FSRS/flashcard fields, always use:
```typescript
const value = row.field || defaultValue;
```

### Strategy 3: Neural Model Error Isolation

All neural model calls (SemanticSearch, NeuralSummarizer, KnowledgeGraph) must be wrapped in try/catch at the call site. Template-based fallbacks should always exist.

**Rule**: Every `await semanticSearch.search()` or `await neuralSummarizer.summarize()` must be inside a try/catch that degrades gracefully.

### Strategy 4: Smart Suggestions Safety

Division, array access, and property reads in `getSmartSuggestions()` must guard against zero/undefined values. All numeric context fields are optional.

**Rule**: Before dividing, check `> 0`. Before accessing `.length`, check existence.

### Strategy 5: Migration Idempotency

Schema migrations MUST be idempotent — running them twice should be safe. Always use `COALESCE`, `IF NOT EXISTS`, and `hasTableColumn` checks.

**Rule**: Every migration function checks for prior execution before altering schema.

---

## Files Modified In This Audit

| File | Changes |
|------|---------|
| `src/fitmind/DualAIEngine.ts` | 7 fixes: fillTemplate placeholders, comeback race, div/zero, streak >=, session length, neural try/catch |
| `src/fitmind/FSRSService.ts` | 1 fix: null-safe `toFSRSCard()` with fallback defaults |
| `src/database/schema.ts` | 1 fix: COALESCE in FSRS migration for NULL values |

**TypeScript verification**: Clean (`npx tsc --noEmit --skipLibCheck` — 0 errors)
