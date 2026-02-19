# FitMind Reader Objectives (Commercial-Safe)

Last updated: 2026-02-18

## Purpose of FitMind Reader
FitMind Reader is meant to be a **usable reading environment** for imported documents where users can:
- read content page-by-page,
- annotate and bookmark,
- ask Professor contextual questions,
- track reading progress and streaks.

## Problem Statement
Current reader path treated binary formats (`PDF`, `EPUB`) as plain text, causing unreadable byte-like output.

## External Repo Assessment (Requested)
- `zeniko/mupdf` → License: **AGPL-3.0** (`COPYING`)
- `mudlej/mj_pdf` → License: **GPL-3.0** (`LICENSE`)

Both are copyleft licenses that are generally incompatible with closed/proprietary commercial app distribution unless the full app is distributed under compatible terms.

## Objective Constraints
1. Keep integration commercially safe (avoid AGPL/GPL code embedding).
2. Improve reader reliability without breaking existing FitMind workflows.
3. Preserve offline-first architecture and existing SQLite/Encrypted DB boundaries.
4. Keep implementation incremental and testable.

## Sequential Objectives
1. **Stabilize reader UX for binary docs**
   - Stop rendering binary bytes as text.
   - Provide explicit binary-reader mode and open-in-system-reader fallback.
2. **Introduce production-grade PDF/EPUB rendering path (permissive license only)**
   - Evaluate permissive alternatives (e.g., MIT/BSD/Apache).
   - Add renderer behind feature flag and fallback path.
3. **Improve extraction + indexing service**
   - Store parsed text/chunks for Professor context and search.
   - Keep progress and annotation model consistent.
4. **Harden and measure quality**
   - Add reader service tests and end-to-end smoke checklist.
   - Keep observability logs on import/read/open/fallback actions.

## Success Criteria
- Imported PDF/EPUB is no longer displayed as gibberish in-app.
- User can always read document via system reader fallback.
- Reader service paths are deterministic and covered by tests.
- Commercial distribution remains license-safe.
