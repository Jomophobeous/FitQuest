# OSS Repo Intake Notes (2026-02-18)

## Scope

This document captures the repositories cloned into `workspace-repos/` for FitQuest evaluation, grouped by:

1. Top 5 immediate foundation repos
2. Health integrations
3. Custom smooth visualizations
4. Exercise content expansion
5. EPUB alternatives

Includes licensing, recency, implementation fit, and recommended adoption order.

---

## Clone Layout Created

- `workspace-repos/top5/`
- `workspace-repos/health-integrations/`
- `workspace-repos/visualization/`
- `workspace-repos/exercise-content/`
- `workspace-repos/epub-alternatives/`

---

## Top 5 (Cloned)

### 1) `top5/react-native-pdf`
- **License**: MIT
- **Last commit**: 2025-10-16
- **Why it matters**: Fastest path to in-app PDF rendering in React Native.
- **FitQuest fit**:
	- Strong fit for `app/fitmind-reader.tsx` binary document mode replacement.
	- Can be feature-flagged for Phase 2 reader rollout.
- **Integration notes**:
	- Requires native modules and dev build flow for Expo (not pure Expo Go in all cases).
	- Best used with local file URI support already present in current pipeline.
- **Risk**: Medium (native integration complexity).

### 2) `top5/pdf.js`
- **License**: Apache-2.0
- **Last commit**: 2026-02-17
- **Why it matters**: battle-tested JS PDF engine with full rendering logic.
- **FitQuest fit**:
	- Great fallback if native PDF module has compatibility issues.
	- Can run inside WebView to keep rendering mostly JS-driven.
- **Integration notes**:
	- Heavier bundle; manage memory and page virtualization.
	- Better for advanced controls/search/annotation features later.
- **Risk**: Medium (performance tuning required on low-end devices).

### 3) `top5/react-native-webview`
- **License**: MIT
- **Last commit**: 2025-08-25
- **Why it matters**: bridge layer for web-based document renderers (PDF.js / EPUB engines).
- **FitQuest fit**:
	- Enables hybrid renderer strategy in FitMind without backend.
	- Good wrapper for fallback rendering path.
- **Integration notes**:
	- Sandbox HTML content and disable unsafe JS bridges.
	- Use for document-only surfaces, not broad app UI.
- **Risk**: Low.

### 4) `top5/react-native-file-viewer`
- **License**: MIT
- **Last commit**: 2021-12-07
- **Why it matters**: external open fallback for unsupported formats.
- **FitQuest fit**:
	- Aligns with current fallback behavior already added in reader flow.
	- Maintains user access while in-app renderer evolves.
- **Integration notes**:
	- Keep as last-resort path, not primary UX.
	- Validate MIME handling + URI permissions on Android.
- **Risk**: Medium (older maintenance activity).

### 5) `top5/react-native-skia`
- **License**: MIT
- **Last commit**: 2026-02-12
- **Why it matters**: high-performance canvas rendering and smooth chart/animation primitives.
- **FitQuest fit**:
	- Ideal for premium dashboards (health rings, progress charts, smooth counters).
	- Strong candidate for `app/health-dashboard.tsx` visual upgrades.
- **Integration notes**:
	- Use alongside Reanimated for buttery 60fps transitions.
	- Keep theme token mapping (no hardcoded colors/spacings).
- **Risk**: Medium (new rendering stack introduces complexity).

---

## Health Integrations (Cloned)

### `health-integrations/react-native-health-connect`
- **License**: MIT
- **Last commit**: 2025-11-27
- **Platform**: Android (Health Connect)
- **FitQuest use**:
	- Import steps, heart-rate, activity sessions into encrypted health pipeline.
	- Feed `BackgroundHealthEngine` and anomaly detection with cleaner sources.
- **Implementation path**:
	- Build adapter service in `src/services/` to normalize records.
	- Persist sensitive data through `encryptedDB` only.

### `health-integrations/react-native-health`
- **License**: MIT
- **Last commit**: 2024-10-15
- **Platform**: iOS (HealthKit)
- **FitQuest use**:
	- iOS parity for health metrics and workout summaries.
- **Implementation path**:
	- Mirror the Android adapter shape for cross-platform consistency.
	- Keep permissions flow isolated and explicit in settings UI.

### `health-integrations/react-native-google-fit`
- **License**: MIT
- **Last commit**: 2026-01-21
- **Platform**: Android (Google Fit)
- **FitQuest use**:
	- Optional fallback for users not migrated to Health Connect.
- **Implementation path**:
	- Put behind feature flag and runtime capability checks.
	- Prefer Health Connect first where available.
- **Risk note**: ecosystem direction is moving toward Health Connect.

---

## Custom Smooth Visualizations (Cloned)

### `visualization/react-native-reanimated`
- **License**: MIT-style (license file present)
- **Last commit**: 2026-02-16
- **FitQuest use**:
	- Smooth transitions for rings, counters, and workout progress feedback.
	- Enhance completion moments without changing core logic.
- **Implementation path**:
	- Add motion wrappers around existing Glass UI components.
	- Keep animations subtle and deterministic.

### `visualization/react-native-chart-kit`
- **License**: MIT
- **Last commit**: 2022-02-07
- **FitQuest use**:
	- Quick charts for analytics and trends.
- **Implementation path**:
	- Use only for MVP charting where Skia is overkill.
- **Risk note**: older maintenance; treat as short-term fallback.

### `visualization/victory-native`
- **License**: package reports MIT
- **Last commit**: 2024-08-15
- **FitQuest use**:
	- Higher-level chart components with richer semantics.
- **Implementation path**:
	- Consider for analytics screens needing robust axes/tooltips.
	- Wrap in theme adapter to enforce tokenized styling.

---

## Exercise Content Expansion (Cloned)

### `exercise-content/free-exercise-db`
- **License**: Unlicense (public domain dedication)
- **Last commit**: 2025-04-21
- **FitQuest use**:
	- Expand movement library metadata and media references.
	- Improve long-tail coverage (mobility, accessories, variations).
- **Implementation path**:
	- Build ingestion script under `scripts/` to map into existing schema categories.
	- Validate fields against FitQuest enums before insert.
- **Risk note**: external taxonomy mismatch; needs strict normalization layer.

### `exercise-content/exercises.json`
- **License**: Public Domain (Unlicense text)
- **Last commit**: 2025-02-16
- **FitQuest use**:
	- Supplemental source for alternatives, aliases, and cue text.
- **Implementation path**:
	- Add dedupe + canonical naming strategy against seeded exercise IDs.
	- Use as enrichment source, not direct blind import.

---

## EPUB Alternatives (Cloned + Recommendation)

### `epub-alternatives/epub.js`
- **License**: BSD-2-Clause
- **Last commit**: 2023-05-15
- **Assessment**: proven but older activity.

### `epub-alternatives/epub-js-intity`
- **License**: BSD-2-Clause
- **Last commit**: 2026-02-15
- **Assessment**: same engine lineage, more active maintenance.
- **Recommendation**: use this first if EPUB integration starts now.

### `epub-alternatives/readium-r2-navigator-js`
- **License**: BSD-3-Clause
- **Last commit**: 2025-11-24
- **Assessment**: powerful, standards-oriented, but heavier architecture.
- **Recommendation**: keep as advanced fallback if EPUB.js stack is troublesome.

### Missing repo note
- Requested candidate `gerhardsletten/react-native-epubjs` was not found (repository unavailable).

---

## FitQuest Implementation Recommendations

## 0) Immediate rule alignment
- Keep all health metrics encrypted via `src/security/EncryptedDatabase.ts`.
- Keep theme tokens via `theme.colors.*` and `theme.spacing[n]`.
- Avoid introducing new state architecture; use existing context/hooks.

## 1) Reader upgrade path (highest priority)
1. Add feature flag: `fitmind.reader.engine = native_pdf | web_pdfjs | external`
2. Implement `native_pdf` with `react-native-pdf` in `app/fitmind-reader.tsx`
3. Add `web_pdfjs` fallback via `react-native-webview` + `pdf.js`
4. For EPUB:
	 - Try `epub-js-intity` first via WebView integration
	 - If unstable, move to Readium (`readium-r2-navigator-js`) evaluation spike

## 2) Health integration path
1. New adapter service layer for each provider (Health Connect / HealthKit / Google Fit)
2. Normalize to FitQuest health event model
3. Encrypt at write boundary before persistence
4. Feed `BackgroundHealthEngine`, `AnomalyDetector`, and daily summaries

## 3) Visualization path
1. Use Reanimated first for low-risk smoothness upgrades
2. Add Skia selectively for high-value visual components
3. Keep charting stack simple:
	 - `victory-native` for robust data views
	 - `chart-kit` only as short-term fallback

## 4) Exercise data expansion path
1. Build importer script with strict enum/category mapping
2. Dedupe by normalized movement name + muscle + equipment profile
3. Persist through existing schema/service flow only
4. Run seed health checks before enabling imported items in generation

---

## Practical “Do Next” Backlog

1. Create `scripts/import-external-exercises.ts` (dry-run mode + diff report).
2. Add FitMind reader feature-flag plumbing and engine selector.
3. Implement first in-app PDF renderer (`react-native-pdf`) under feature flag.
4. Add provider-neutral health data adapter interface.
5. Prototype one Skia-based metric card in health dashboard.

---

## Legal/Compliance Snapshot

- All cloned primary candidates above are permissive (MIT/Apache/BSD/Public Domain).
- `react-native-file-viewer` and `react-native-chart-kit` are older; keep under review.
- Public domain exercise datasets are commercially usable, but still verify source provenance and quality before shipping production content.

