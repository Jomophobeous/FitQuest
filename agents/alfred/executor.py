from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from auto_fixer import AutoFixer
from memory import MemoryStore
from task_queue import Task


@dataclass
class ExecutionResult:
    task_id: str
    status: str  # done | failed | simulated | blocked
    details: str
    exit_code: Optional[int] = None


# ── Guarded command registry ─────────────────────────────────────────
# Only commands explicitly listed here can be executed.
# Each entry maps a task-id prefix to its shell command.
COMMAND_REGISTRY: Dict[str, List[str]] = {
    "stability::validation-pass": ["npm", "run", "typecheck"],
    "gate::typecheck": ["npm", "run", "typecheck"],
    "gate::mealprep-text-safety": ["npm", "run", "verify:mealprep:text-safety"],
    "gate::notifications-reliability": ["npm", "run", "verify:notifications:reliability"],
    "gate::ops-readiness": ["npm", "run", "verify:ops:readiness"],
    "gate::performance-budget": ["npm", "run", "verify:performance:budget"],
    "gate::i18n-p0": ["npm", "run", "verify:i18n:p0"],
    "gate::all-gates": ["npm", "run", "verify:mealprep:text-safety"],
}

# Auto-fix task IDs — handled by AutoFixer, not shell commands
AUTOFIX_TASKS = {
    "autofix::rn_crash_risks",
    "autofix::theme_colors",
    "autofix::all",
    "crash_risk::unsafe_falsy_render",   # alias from planner
    "style::theme_violations",           # alias from planner
}

# Maximum output size kept per execution (chars)
MAX_OUTPUT_CHARS = 6000
# Maximum execution time (seconds)
MAX_TIMEOUT_SECONDS = 120


class Executor:
    def __init__(self, repo_root: Path, dry_run: bool = True, mode: str = "full_autonomous") -> None:
        self.repo_root = repo_root
        self.dry_run = dry_run
        self.mode = mode
        self.auto_fixer = AutoFixer(repo_root, dry_run=dry_run)
        self.memory = MemoryStore(repo_root / "agents" / "alfred")

    def execute(self, task: Task) -> ExecutionResult:
        # ── Auto-fix tasks ────────────────────────────────────────────
        if task.id in AUTOFIX_TASKS:
            return self._execute_autofix(task)

        if self.dry_run:
            matched = self._find_command(task.id)
            cmd_desc = f" (would run: {' '.join(matched)})" if matched else ""
            result = ExecutionResult(
                task_id=task.id,
                status="simulated",
                details=f"Dry-run: {task.title} — {task.description}{cmd_desc}",
            )
            self._log_task_execution(task, result, command=matched, changed_files=[])
            return result

        command = self._find_command(task.id)
        if command:
            before = self._git_status_snapshot()
            result = self._run_command(task, command)
            after = self._git_status_snapshot()
            self._log_task_execution(
                task,
                result,
                command=command,
                changed_files=self._git_status_delta(before, after),
            )
            return result

        result = ExecutionResult(
            task_id=task.id,
            status="blocked",
            details="No executor mapping. Requires supervised implementation.",
        )
        self._log_task_execution(task, result, command=None, changed_files=[])
        return result

    # ── Auto-fix execution ────────────────────────────────────────────

    def _execute_autofix(self, task: Task) -> ExecutionResult:
        """Run the appropriate auto-fixer based on task ID."""
        try:
            if task.id in {"autofix::rn_crash_risks", "crash_risk::unsafe_falsy_render"}:
                result = self.auto_fixer.fix_rn_crash_risks()
            elif task.id in {"autofix::theme_colors", "style::theme_violations"}:
                result = self.auto_fixer.fix_theme_colors()
            elif task.id == "autofix::all":
                results = self.auto_fixer.run_all()
                summary = AutoFixer.summarize(results)
                mode = "DRY-RUN preview" if self.dry_run else "APPLIED"
                return ExecutionResult(
                    task_id=task.id,
                    status="done",
                    details=(
                        f"Auto-fix sweep ({mode}): "
                        f"{summary['total_fixes']} fixes across all classes. "
                        f"Errors: {summary['total_errors']}. "
                        f"Details: {_compact_json(summary['details'])}"
                    )[:MAX_OUTPUT_CHARS],
                    exit_code=0 if summary["total_errors"] == 0 else 1,
                )
            else:
                return ExecutionResult(
                    task_id=task.id,
                    status="blocked",
                    details=f"Unknown autofix task: {task.id}",
                )

            mode = "DRY-RUN preview" if self.dry_run else "APPLIED"
            patch_summary = "; ".join(
                f"{p.file}:L{p.line}" for p in result.patches[:10]
            )
            return ExecutionResult(
                task_id=task.id,
                status="done",
                details=(
                    f"Auto-fix [{result.fix_class}] ({mode}): "
                    f"{result.fixes_applied} fixes in {result.files_scanned} files. "
                    f"Patches: {patch_summary or 'none (already clean)'}. "
                    f"Errors: {result.errors[:3] or 'none'}"
                )[:MAX_OUTPUT_CHARS],
                exit_code=0 if not result.errors else 1,
            )

        except Exception as exc:
            return ExecutionResult(
                task_id=task.id,
                status="failed",
                details=f"Auto-fix error: {exc}",
            )

    def execute_gate_sweep(self) -> List[ExecutionResult]:
        """Run all registered gate:: commands sequentially. Returns list of results."""
        results: List[ExecutionResult] = []
        for task_id, command in COMMAND_REGISTRY.items():
            if not task_id.startswith("gate::"):
                continue
            task = Task(
                id=task_id,
                title=f"Gate: {task_id.split('::', 1)[1]}",
                description=f"Automated gate check: {' '.join(command)}",
                priority=0,
                risk="low",
            )
            results.append(self.execute(task))
        return results

    def execute_autofix_sweep(self) -> ExecutionResult:
        """Run all auto-fixers in one sweep."""
        task = Task(
            id="autofix::all",
            title="Auto-fix sweep",
            description="Run all registered auto-fixers",
            priority=0,
            risk="medium",
        )
        return self._execute_autofix(task)

    def _find_command(self, task_id: str) -> Optional[List[str]]:
        """Look up exact match first, then prefix match."""
        if task_id in COMMAND_REGISTRY:
            return COMMAND_REGISTRY[task_id]
        for key, cmd in COMMAND_REGISTRY.items():
            if task_id.startswith(key):
                return cmd
        return None

    def _run_command(self, task: Task, command: List[str]) -> ExecutionResult:
        try:
            proc = subprocess.run(
                command,
                cwd=self.repo_root,
                check=False,
                text=True,
                capture_output=True,
                timeout=MAX_TIMEOUT_SECONDS,
            )
            status = "done" if proc.returncode == 0 else "failed"
            output = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
            return ExecutionResult(
                task_id=task.id,
                status=status,
                details=output[-MAX_OUTPUT_CHARS:],
                exit_code=proc.returncode,
            )
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                task_id=task.id,
                status="failed",
                details=f"Command timed out after {MAX_TIMEOUT_SECONDS}s: {' '.join(command)}",
                exit_code=-1,
            )
        except Exception as exc:
            return ExecutionResult(
                task_id=task.id,
                status="failed",
                details=str(exc),
            )

    def _log_task_execution(self, task: Task, result: ExecutionResult, command: Optional[List[str]], changed_files: List[str]) -> None:
        self.memory.log_change({
            "event_type": "task_execution",
            "task_id": task.id,
            "title": task.title,
            "mode": self.mode,
            "dry_run": self.dry_run,
            "status": result.status,
            "summary": result.details[:500],
            "command": command,
            "changed_files": changed_files,
            "exit_code": result.exit_code,
        })

    def _git_status_snapshot(self) -> Dict[str, str]:
        try:
            proc = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=self.repo_root,
                check=False,
                text=True,
                capture_output=True,
                timeout=15,
            )
            if proc.returncode != 0:
                return {}

            snapshot: Dict[str, str] = {}
            for line in proc.stdout.splitlines():
                if len(line) < 4:
                    continue
                status = line[:2]
                path = line[3:]
                if " -> " in path:
                    path = path.split(" -> ", 1)[1]
                snapshot[path] = status
            return snapshot
        except Exception:
            return {}

    @staticmethod
    def _git_status_delta(before: Dict[str, str], after: Dict[str, str]) -> List[str]:
        changed = []
        for path, status in after.items():
            if path not in before or before[path] != status:
                changed.append(path)
        return sorted(changed)


def _compact_json(obj: object) -> str:
    """Return a compact JSON string, truncated if needed."""
    import json
    return json.dumps(obj, separators=(",", ":"))[:MAX_OUTPUT_CHARS]