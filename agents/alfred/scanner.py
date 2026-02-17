from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Dict, List

EXCLUDED_DIRS = {
    ".git",
    "node_modules",
    ".expo",
    ".venv",
    "__pycache__",
}

EXCLUDED_PREFIXES = {
    "android/build",
    "ios/build",
    "dist",
    "web-build",
    "Figma UI",
}

# React Native crash patterns: {value && (<View>...)} renders 0/NaN as bare text
_RN_UNSAFE_RENDER_RE = re.compile(
    r"\{\s*\w+(?:\.\w+)*\s*&&\s*\(\s*$"
    r"|"
    r"\{\s*\w+(?:\.\w+)*\s*&&\s*\(<",
)

# Hardcoded color hex outside theme usage
_HARDCODED_COLOR_RE = re.compile(
    r"""(?:backgroundColor|color|borderColor)\s*:\s*['"]#[0-9A-Fa-f]{3,8}['"]"""
)

# Inline style numeric literals that should use theme.spacing
_HARDCODED_SPACING_RE = re.compile(
    r"""(?:padding|margin|gap)\s*:\s*\d{2,}"""
)


class RepositoryScanner:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root

    def run(self) -> Dict:
        files = self._collect_files()
        stack = self._detect_stack(files)
        entry_points = self._detect_entry_points(files)

        return {
            "repo_root": str(self.repo_root),
            "file_count": len(files),
            "tech_stack": stack,
            "entry_points": entry_points,
            "auth_state": self._detect_auth_state(files),
            "database_models": self._detect_database_models(files),
            "api_routes": self._detect_api_routes(files),
            "ui_components": self._detect_ui_components(files),
            "env_configs": self._detect_env_configs(files),
            "todo_markers": self._find_todo_fixme(files),
            "broken_flows": self._detect_broken_flows(files),
            "technical_debt": self._detect_technical_debt(files),
            "rn_crash_risks": self._detect_rn_crash_risks(files),
            "theme_violations": self._detect_theme_violations(files),
            "verification_gates": self._detect_verification_gates(),
        }

    def _collect_files(self) -> List[Path]:
        files: List[Path] = []
        for current_root, dirs, file_names in os.walk(self.repo_root, topdown=True):
            current_path = Path(current_root)
            rel_root = str(current_path.relative_to(self.repo_root)) if current_path != self.repo_root else ""

            dirs[:] = [
                d
                for d in dirs
                if d not in EXCLUDED_DIRS
                and not any(
                    (f"{rel_root}/{d}" if rel_root else d) == prefix
                    or (f"{rel_root}/{d}" if rel_root else d).startswith(prefix + "/")
                    for prefix in EXCLUDED_PREFIXES
                )
            ]

            for file_name in file_names:
                path = current_path / file_name
                files.append(path)
        return files

    def _detect_stack(self, files: List[Path]) -> Dict:
        package_json = self.repo_root / "package.json"
        stack = {
            "frontend": "unknown",
            "mobile": "unknown",
            "backend": "none",
            "languages": [],
        }

        if package_json.exists():
            stack["languages"].extend(["TypeScript", "JavaScript"])
            try:
                data = json.loads(package_json.read_text(encoding="utf-8"))
                deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
                if "expo" in deps:
                    stack["mobile"] = "Expo React Native"
                if "expo-router" in deps:
                    stack["frontend"] = "Expo Router"
            except Exception:
                pass

        if any(p.suffix == ".py" for p in files):
            stack["languages"].append("Python")

        if (self.repo_root / "server").exists():
            stack["backend"] = "Server directory present"

        stack["languages"] = sorted(set(stack["languages"]))
        return stack

    def _detect_entry_points(self, files: List[Path]) -> List[str]:
        candidates = [
            "App.tsx",
            "index.ts",
            "app/_layout.tsx",
            "app/index.tsx",
        ]
        return [c for c in candidates if (self.repo_root / c).exists()]

    def _detect_auth_state(self, files: List[Path]) -> Dict:
        auth_files = [
            str(path.relative_to(self.repo_root))
            for path in files
            if "auth" in path.name.lower() or "login" in path.name.lower() or "register" in path.name.lower()
        ]
        return {
            "auth_related_files": sorted(auth_files)[:30],
            "secure_store_present": (self.repo_root / "src/security/StorageMigration.ts").exists(),
            "biometric_auth_present": (self.repo_root / "src/security/BiometricAuth.ts").exists(),
        }

    def _detect_database_models(self, files: List[Path]) -> Dict:
        tables = []
        schema = self.repo_root / "src/database/schema.ts"
        if schema.exists():
            text = schema.read_text(encoding="utf-8", errors="ignore")
            for line in text.splitlines():
                if "CREATE TABLE" in line.upper():
                    tables.append(line.strip())

        return {
            "schema_file": str(schema.relative_to(self.repo_root)) if schema.exists() else None,
            "detected_table_statements": tables[:120],
        }

    def _detect_api_routes(self, files: List[Path]) -> Dict:
        server_dir = self.repo_root / "server"
        if not server_dir.exists():
            return {"server_present": False, "route_files": []}

        route_files = [
            str(p.relative_to(self.repo_root))
            for p in server_dir.rglob("*.ts")
            if "route" in p.name.lower() or "controller" in p.name.lower()
        ]
        return {"server_present": True, "route_files": route_files[:100]}

    def _detect_ui_components(self, files: List[Path]) -> Dict:
        component_files = [
            str(path.relative_to(self.repo_root))
            for path in files
            if "src/components" in str(path.relative_to(self.repo_root)) and path.suffix in {".ts", ".tsx"}
        ]
        screens = [
            str(path.relative_to(self.repo_root))
            for path in files
            if str(path.relative_to(self.repo_root)).startswith("app/") and path.suffix == ".tsx"
        ]
        return {
            "components": sorted(component_files)[:200],
            "screens": sorted(screens)[:300],
        }

    def _detect_env_configs(self, files: List[Path]) -> Dict:
        env_files = [
            str(path.relative_to(self.repo_root))
            for path in files
            if path.name.startswith(".env") or path.name in {"app.json", "eas.json"}
        ]
        return {"config_files": sorted(env_files)}

    def _find_todo_fixme(self, files: List[Path]) -> List[Dict]:
        findings: List[Dict] = []
        for path in files:
            rel = str(path.relative_to(self.repo_root))
            if not rel.endswith((".ts", ".tsx", ".js", ".mjs", ".py", ".md")):
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for line_no, line in enumerate(text.splitlines(), start=1):
                upper = line.upper()
                if "TODO" in upper or "FIXME" in upper:
                    findings.append({"file": rel, "line": line_no, "text": line.strip()[:220]})
                    if len(findings) >= 200:
                        return findings
        return findings

    def _detect_broken_flows(self, files: List[Path]) -> List[str]:
        issues: List[str] = []

        layout = self.repo_root / "app/_layout.tsx"
        if layout.exists():
            text = layout.read_text(encoding="utf-8", errors="ignore")
            if "legal-center" not in text:
                issues.append("legal-center not registered in app/_layout.tsx")
            if "health-dashboard" in text and "route: '/health-dashboard'" not in (self.repo_root / "src/components/DropdownMenu.tsx").read_text(encoding="utf-8", errors="ignore"):
                issues.append("health-dashboard not reachable from dropdown menu")

        return issues

    def _detect_technical_debt(self, files: List[Path]) -> List[str]:
        debt: List[str] = []
        large_tsx = []
        for path in files:
            if path.suffix != ".tsx":
                continue
            try:
                line_count = sum(1 for _ in path.open("r", encoding="utf-8", errors="ignore"))
            except Exception:
                continue
            if line_count > 1300:
                large_tsx.append((str(path.relative_to(self.repo_root)), line_count))

        if large_tsx:
            debt.append("Large TSX files detected: " + ", ".join(f"{p}({n})" for p, n in sorted(large_tsx)[:12]))

        if not (self.repo_root / "eslint.config.js").exists() and not (self.repo_root / ".eslintrc.js").exists():
            debt.append("ESLint config not found")

        if not (self.repo_root / "jest.config.js").exists() and not (self.repo_root / "jest.config.ts").exists():
            debt.append("Jest config not found")

        return debt

    # ── Phase 2: RN crash risk detection ──────────────────────────────

    def _detect_rn_crash_risks(self, files: List[Path]) -> List[Dict]:
        """Detect React Native patterns that cause 'Text strings must be rendered within <Text>'."""
        risks: List[Dict] = []
        for path in files:
            if path.suffix != ".tsx":
                continue
            rel = str(path.relative_to(self.repo_root))
            if not rel.startswith("app/") and "src/components" not in rel:
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for line_no, line in enumerate(text.splitlines(), start=1):
                if _RN_UNSAFE_RENDER_RE.search(line):
                    risks.append({
                        "file": rel,
                        "line": line_no,
                        "pattern": "unsafe_falsy_render",
                        "snippet": line.strip()[:160],
                    })
            if len(risks) >= 100:
                break
        return risks

    # ── Phase 2: theme violation detection ────────────────────────────

    def _detect_theme_violations(self, files: List[Path]) -> List[Dict]:
        """Detect hardcoded colors/spacing in *style* contexts only.

        Excludes data-config objects (lines containing ``icon:``, ``label:``,
        ``key:``, or ``text:``) which legitimately carry colour metadata.
        Also skips the theme-system definition file itself and the splash
        screen (which renders before ThemeProvider mounts).
        """
        violations: List[Dict] = []
        _DATA_CONFIG_SIGNAL = re.compile(r"\b(?:icon|label|key|text)\s*:")
        for path in files:
            if path.suffix not in {".tsx", ".ts"}:
                continue
            rel = str(path.relative_to(self.repo_root))
            if not rel.startswith("app/") and "src/components" not in rel:
                continue
            # Skip theme definition file and splash (pre-provider)
            if rel in {"src/design/theme-system.ts", "app/splash.tsx"}:
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue
            for line_no, line in enumerate(text.splitlines(), start=1):
                if "StyleSheet" in line or "// " in line or "* " in line:
                    continue
                # Skip data-config lines (icon/label/key/text objects)
                if _DATA_CONFIG_SIGNAL.search(line):
                    continue
                if _HARDCODED_COLOR_RE.search(line):
                    violations.append({
                        "file": rel,
                        "line": line_no,
                        "type": "hardcoded_color",
                        "snippet": line.strip()[:160],
                    })
            if len(violations) >= 200:
                break
        return violations

    # ── Phase 2: verification gate inventory ──────────────────────────

    def _detect_verification_gates(self) -> Dict:
        """Check which verification scripts exist and return their paths."""
        scripts_dir = self.repo_root / "scripts"
        gates: Dict[str, bool] = {}
        expected = [
            "verify-mealprep-text-safety.mjs",
            "verify-notification-reliability.mjs",
            "verify-ops-readiness.mjs",
            "verify-performance-budget.mjs",
            "verify-i18n-p0.mjs",
            "quality-110-gate.mjs",
        ]
        for script_name in expected:
            gates[script_name] = (scripts_dir / script_name).exists()

        # Check package.json for corresponding npm scripts
        pkg_json = self.repo_root / "package.json"
        npm_scripts: List[str] = []
        if pkg_json.exists():
            try:
                data = json.loads(pkg_json.read_text(encoding="utf-8"))
                npm_scripts = [
                    k for k in data.get("scripts", {}).keys()
                    if k.startswith("verify:")
                ]
            except Exception:
                pass

        return {
            "gate_scripts": gates,
            "npm_verify_scripts": sorted(npm_scripts),
            "all_present": all(gates.values()),
        }
