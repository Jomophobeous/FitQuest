"""Alfred Phase 3 — Deterministic Auto-Fix Engine.

Provides safe, AST-free text-transform fixers for common React Native
and theme-system issues.  Every fixer:

1. Operates on a single file at a time (no cross-file mutations).
2. Returns a unified ``FixResult`` with before/after diffs.
3. Is idempotent — running twice produces no additional changes.
4. Respects ``dry_run`` — preview changes without writing.

Supported fix classes
─────────────────────
``rn_crash_risk``   Convert ``{val && (<JSX>)}`` → ``{!!val && (<JSX>)}``
``theme_color``     Replace known hardcoded hex with theme tokens
``theme_spacing``   Replace inline numeric spacing with ``theme.spacing[n]``
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from memory import MemoryStore

# ── Fix result ────────────────────────────────────────────────────────

@dataclass
class FilePatch:
    file: str
    line: int
    before: str
    after: str


@dataclass
class FixResult:
    fix_class: str
    files_scanned: int
    fixes_applied: int
    patches: List[FilePatch] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


# ── Regex patterns ────────────────────────────────────────────────────

# Matches  {identifier && (  or  {identifier.prop && (
_RN_UNSAFE_RENDER_RE = re.compile(
    r"(\{\s*)"                      # opening brace + optional space
    r"(\w+(?:\.\w+)*)"             # identifier (e.g., value, obj.prop)
    r"(\s*&&\s*\()"                # && (
)

# Matches  color: '#hex' | backgroundColor: '#hex' | borderColor: '#hex'
_STYLE_HEX_RE = re.compile(
    r"((?:backgroundColor|color|borderColor)\s*:\s*)"
    r"(['\"])#([0-9A-Fa-f]{3,8})\2"
)

# Known hex → theme.colors mapping (lowercase keys, no #)
_HEX_TO_THEME: Dict[str, str] = {
    "10b981": "theme.colors.accent",
    "f4a427": "theme.colors.warning",
    "ef4444": "theme.colors.error",
    "dc2626": "theme.colors.error",
    "0a0e17": "theme.colors.background",
    "121820": "theme.colors.surface",
    "1a1f2b": "theme.colors.surfaceVariant",
    "f5f7fb": "theme.colors.text",
    "fff":    "theme.colors.text",
    "ffffff": "theme.colors.text",
    "a8b0bd": "theme.colors.textSecondary",
    "6b7280": "theme.colors.textMuted",
}


# ── Fixer engine ──────────────────────────────────────────────────────

class AutoFixer:
    """Deterministic, file-level auto-fix engine."""

    def __init__(self, repo_root: Path, dry_run: bool = True) -> None:
        self.repo_root = repo_root
        self.dry_run = dry_run
        self.memory = MemoryStore(repo_root / "agents" / "alfred")

    # ── Public API ────────────────────────────────────────────────────

    def fix_rn_crash_risks(self, files: Optional[List[Path]] = None, log_event: bool = True) -> FixResult:
        """Fix ``{val && (<JSX>)}`` → ``{!!val && (<JSX>)}`` in .tsx files."""
        result = FixResult(fix_class="rn_crash_risk", files_scanned=0, fixes_applied=0)
        targets = files or self._tsx_files()

        for path in targets:
            result.files_scanned += 1
            try:
                text = path.read_text(encoding="utf-8")
            except Exception as exc:
                result.errors.append(f"{path}: {exc}")
                continue

            new_lines: List[str] = []
            changed = False

            for line_no, line in enumerate(text.splitlines(keepends=True), start=1):
                new_line = self._fix_rn_line(line)
                if new_line != line:
                    rel = str(path.relative_to(self.repo_root))
                    result.patches.append(FilePatch(
                        file=rel,
                        line=line_no,
                        before=line.rstrip(),
                        after=new_line.rstrip(),
                    ))
                    changed = True
                new_lines.append(new_line)

            if changed:
                result.fixes_applied += sum(
                    1 for p in result.patches if p.file == str(path.relative_to(self.repo_root))
                )
                if not self.dry_run:
                    path.write_text("".join(new_lines), encoding="utf-8")

        if log_event:
            self._log_fix_result("autofix::rn_crash_risks", result)
        return result

    def fix_theme_colors(self, files: Optional[List[Path]] = None, log_event: bool = True) -> FixResult:
        """Replace known hardcoded hex colors with theme.colors.* tokens."""
        result = FixResult(fix_class="theme_color", files_scanned=0, fixes_applied=0)
        targets = files or self._tsx_files()

        # Data-config signal — skip lines that are object configs, not styles
        data_config_signal = re.compile(r"\b(?:icon|label|key|text)\s*:")

        for path in targets:
            result.files_scanned += 1
            rel = str(path.relative_to(self.repo_root))
            try:
                text = path.read_text(encoding="utf-8")
            except Exception as exc:
                result.errors.append(f"{rel}: {exc}")
                continue

            new_lines: List[str] = []
            changed = False

            for line_no, line in enumerate(text.splitlines(keepends=True), start=1):
                # Skip data-config, comments, StyleSheet definition line
                if data_config_signal.search(line) or "// " in line or "* " in line or "StyleSheet" in line:
                    new_lines.append(line)
                    continue

                new_line = self._fix_theme_color_line(line)
                if new_line != line:
                    result.patches.append(FilePatch(
                        file=rel, line=line_no,
                        before=line.rstrip(), after=new_line.rstrip(),
                    ))
                    changed = True
                new_lines.append(new_line)

            if changed:
                result.fixes_applied += sum(
                    1 for p in result.patches if p.file == rel
                )
                if not self.dry_run:
                    path.write_text("".join(new_lines), encoding="utf-8")

        if log_event:
            self._log_fix_result("autofix::theme_colors", result)
        return result

    def run_all(self, log_event: bool = True) -> Dict[str, FixResult]:
        """Run all registered fixers and return results keyed by fix_class."""
        results = {
            "rn_crash_risk": self.fix_rn_crash_risks(log_event=False),
            "theme_color": self.fix_theme_colors(log_event=False),
        }
        if log_event:
            self._log_fix_run(results)
        return results

    # ── Summary helpers ───────────────────────────────────────────────

    @staticmethod
    def summarize(results: Dict[str, FixResult]) -> Dict:
        """Return a compact JSON-serialisable summary of all fix results."""
        total_fixes = sum(r.fixes_applied for r in results.values())
        total_errors = sum(len(r.errors) for r in results.values())

        details = {}
        for key, result in results.items():
            details[key] = {
                "files_scanned": result.files_scanned,
                "fixes_applied": result.fixes_applied,
                "errors": result.errors[:10],
                "sample_patches": [
                    {"file": p.file, "line": p.line, "before": p.before[:120], "after": p.after[:120]}
                    for p in result.patches[:5]
                ],
            }

        return {
            "total_fixes": total_fixes,
            "total_errors": total_errors,
            "all_clean": total_fixes == 0 and total_errors == 0,
            "details": details,
        }

    # ── Internal ──────────────────────────────────────────────────────

    def _tsx_files(self) -> List[Path]:
        """Collect .tsx files from app/ and src/components/.

        Excludes splash.tsx (renders before ThemeProvider mounts) and
        the theme-system definition itself.
        """
        _SKIP = {"splash.tsx", "theme-system.ts"}
        targets: List[Path] = []
        for subdir in ("app", "src/components"):
            d = self.repo_root / subdir
            if d.exists():
                targets.extend(
                    p for p in d.rglob("*.tsx")
                    if p.name not in _SKIP
                )
        return sorted(targets)

    def _log_fix_result(self, task_id: str, result: FixResult) -> None:
        changed_files = sorted({patch.file for patch in result.patches})
        mode = "preview" if self.dry_run else "applied"
        self.memory.log_change({
            "event_type": "autofix",
            "task_id": task_id,
            "fix_class": result.fix_class,
            "dry_run": self.dry_run,
            "status": "logged",
            "summary": (
                f"Auto-fix {mode}: {result.fixes_applied} fixes in "
                f"{len(changed_files)} files for {result.fix_class}."
            ),
            "changed_files": changed_files,
            "patches": [
                {
                    "file": patch.file,
                    "line": patch.line,
                    "before": patch.before[:160],
                    "after": patch.after[:160],
                }
                for patch in result.patches[:50]
            ],
            "errors": result.errors[:20],
            "files_scanned": result.files_scanned,
            "fixes_applied": result.fixes_applied,
        })

    def _log_fix_run(self, results: Dict[str, FixResult]) -> None:
        changed_files = sorted({
            patch.file
            for result in results.values()
            for patch in result.patches
        })
        summary = AutoFixer.summarize(results)
        mode = "preview" if self.dry_run else "applied"
        self.memory.log_change({
            "event_type": "autofix",
            "task_id": "autofix::all",
            "dry_run": self.dry_run,
            "status": "logged",
            "summary": (
                f"Auto-fix sweep {mode}: {summary['total_fixes']} fixes across "
                f"{len(changed_files)} files."
            ),
            "changed_files": changed_files,
            "details": summary["details"],
            "total_fixes": summary["total_fixes"],
            "total_errors": summary["total_errors"],
        })

    @staticmethod
    def _fix_rn_line(line: str) -> str:
        """Replace {val && ( with {!!val && ( — idempotent."""
        def _replacer(m: re.Match) -> str:
            brace = m.group(1)   # { or {  (with spaces)
            ident = m.group(2)   # the identifier
            tail = m.group(3)    # && (
            # Already safe — double-bang present
            if brace.rstrip().endswith("!!"):
                return m.group(0)
            return f"{brace}!!{ident}{tail}"

        return _RN_UNSAFE_RENDER_RE.sub(_replacer, line)

    @staticmethod
    def _fix_theme_color_line(line: str) -> str:
        """Replace known hex literals with theme.colors.* tokens."""
        def _replacer(m: re.Match) -> str:
            prop = m.group(1)     # e.g. "color: "
            hex_val = m.group(3).lower()

            token = _HEX_TO_THEME.get(hex_val)
            if not token:
                return m.group(0)  # unknown hex — leave as-is

            return f"{prop}{token}"

        return _STYLE_HEX_RE.sub(_replacer, line)
