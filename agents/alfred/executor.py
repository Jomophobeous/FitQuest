from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

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

# Maximum output size kept per execution (chars)
MAX_OUTPUT_CHARS = 6000
# Maximum execution time (seconds)
MAX_TIMEOUT_SECONDS = 120


class Executor:
    def __init__(self, repo_root: Path, dry_run: bool = True) -> None:
        self.repo_root = repo_root
        self.dry_run = dry_run

    def execute(self, task: Task) -> ExecutionResult:
        if self.dry_run:
            matched = self._find_command(task.id)
            cmd_desc = f" (would run: {' '.join(matched)})" if matched else ""
            return ExecutionResult(
                task_id=task.id,
                status="simulated",
                details=f"Dry-run: {task.title} — {task.description}{cmd_desc}",
            )

        command = self._find_command(task.id)
        if command:
            return self._run_command(task, command)

        return ExecutionResult(
            task_id=task.id,
            status="blocked",
            details="No executor mapping. Requires supervised implementation.",
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
