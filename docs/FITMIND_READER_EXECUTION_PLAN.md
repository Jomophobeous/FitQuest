# FitMind Reader Execution Plan

Last updated: 2026-02-18
Owner: Mobile Core

## Phase 1 (Now) — Binary Reader Stabilization
- [x] Detect binary document types (`PDF`/`EPUB`) in reader path.
- [x] Prevent binary file text rendering in `DocumentProcessor.readDocumentPage()`.
- [x] Add clear fallback UX in `fitmind-reader` for binary documents.
- [x] Add `Open Document` action using system reader.
- [x] Add logs for fallback/open flow.

## Phase 2 — Commercial-Safe Renderer Integration
- [x] Finalize permissive renderer candidate (MIT/BSD/Apache only).
- [ ] Validate Expo/New Architecture compatibility.
- [x] Add in-app native PDF render mode behind feature flag.
- [x] Keep system-reader fallback as always-available path.

### Phase 2 progress notes
- Implemented `react-native-pdf` path in `app/fitmind-reader.tsx`.
- Added engine gate via `EXPO_PUBLIC_FITMIND_READER_ENGINE` (`native_pdf` | `web_pdfjs` | `web_epub` | `external`).
- Added automatic Expo Go safeguard: forces external-reader fallback in Expo Go runtime.
- Added EPUB in-app web mode via `react-native-webview` + bundled `@intity/epub-js` script (`web_epub` engine).
- Added explicit reader progress percentage feedback in top bar and page indicator.
- Added `web_pdfjs` in-app fallback engine path (WebView-based PDF renderer) and native page controls.
- Added EPUB progress persistence to `app_state` (percent + CFI + derived page) and restore on reopen.
- Added focused helper tests in `tests/fitmindReaderEngine.test.ts` for engine resolution, progress %, and fallback message parsing.
- Hardened binary load path to avoid stale state reads during first PDF/EPUB open.
- Added dedicated `web_pdfjs` failure state so failed web PDF render cleanly falls back to external reader.
- Normalized external reader file URI handling (`file://`) for local-document open reliability.
- Replaced CDN-based web reader initialization with bundled local assets (`assets/fitmind/reader/*.txt`) for PDF.js and EPUB.js scripts.
- Added bundled local HTML templates (`pdf-viewer.html.txt`, `epub-viewer.html.txt`) with tokenized script/URI injection at runtime.
- Added retry-capable fallback UX for failed `web_pdfjs`/`web_epub` initialization before external-open fallback.
- Added focused template injection tests in `tests/readerWebAssets.test.ts` to verify offline asset wiring.

## Phase 3 — Service Quality Upgrade
- [ ] Improve PDF/EPUB text extraction pipeline for indexing.
- [ ] Save structured chunks for Professor retrieval context.
- [ ] Add robust progress mapping between rendered pages and stored state.

## Phase 4 — Test & Release Gate
- [x] Add tests for binary detection and fallback behavior.
- [x] Add tests for provider switch + Professor query stability.
- [ ] Run full regression (`vitest`) and device smoke script.
- [ ] Sign off with release checklist and known limitations.

### Phase 4 progress notes
- Added reader helper coverage in `tests/fitmindReaderEngine.test.ts` for file URI normalization, binary fallback message selection, and inline navigation gating.
- Expanded `tests/readerWebAssets.test.ts` with JSON-escape assertions for injected script/template values.
- Re-ran focused reader regression: `tests/fitmindReaderEngine.test.ts` + `tests/readerWebAssets.test.ts` (21 tests passed).
- Re-ran broader targeted regression: `tests/validation.test.ts`, `tests/rateLimiter.test.ts`, `tests/dualAIEngine.test.ts`, and reader tests (66 tests passed).
- `npm run test` still appears to hang in this workspace, so full-suite completion remains pending while targeted suites are green.

## Risks & Mitigations
- Risk: Native reader lib incompatibility with Expo Go/dev environment
  - Mitigation: keep fallback and stage via feature flag.
- Risk: License drift from copied third-party code
  - Mitigation: use package-level license audit before merge.
- Risk: Parsing quality variance across PDFs
  - Mitigation: preserve renderer-first reading path; use extraction mainly for indexing/AI context.
