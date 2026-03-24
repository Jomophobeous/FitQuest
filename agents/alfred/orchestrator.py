from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

from executor import Executor, ExecutionResult
from memory import MemoryStore
from modes import ModeController
from planner import Planner
from scanner import RepositoryScanner
from task_queue import TaskQueue


class AlfredOrchestrator:
    def __init__(self, repo_root: Path, config: Dict) -> None:
        self.repo_root = repo_root
        self.config = config
        self.scanner = RepositoryScanner(repo_root)
        self.memory = MemoryStore(repo_root / "agents" / "alfred")
        self.planner = Planner()
        self.executor = Executor(repo_root, dry_run=config.get("dry_run", True))
        self.mode = ModeController(config.get("mode", "full_autonomous"))
        self.executor.mode = self.mode.active.value

    def cycle(self, cycle_index: int) -> Dict:
        # ── 1. State Scan ─────────────────────────────────────────────
        scan = self.scanner.run()

        # ── 2-3. Intent Inference + Objective Definition ──────────────
        objective = self.planner.infer_objective(scan)
        tasks = self.planner.build_tasks(scan, objective)

        # ── 4. Queue Management ───────────────────────────────────────
        queue = TaskQueue(self.memory.get_task_queue_snapshot())
        queue.enqueue_many(tasks)

        # ── 5. Execution ─────────────────────────────────────────────
        active = queue.next_task()
        execution = None
        if active:
            execution = self.executor.execute(active)
            if execution.status in {"done", "simulated"}:
                queue.mark_done(active.id)
            elif execution.status in {"blocked", "failed"}:
                queue.mark_blocked(active.id)

        # ── 6. Self-Evaluation ────────────────────────────────────────
        evaluation = self._evaluate(scan, objective, execution)

        # ── 7. Memory Update ─────────────────────────────────────────
        self._update_maps(scan, objective, queue)
        self.memory.add_weaknesses(objective.get("known_weaknesses", []))
        self.memory.set_task_queue_snapshot(queue.dump())

        # ── Mode recommendation ────────────────────────────────────
        mode_recommendation = self.mode.recommend(scan)

        # ── Result Assembly ──────────────────────────────────────────
        result = {
            "cycle": cycle_index,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "mode": self.mode.active.value,
            "mode_recommendation": mode_recommendation,
            "objective": objective,
            "scan_summary": {
                "file_count": scan.get("file_count", 0),
                "rn_crash_risks": len(scan.get("rn_crash_risks", [])),
                "theme_violations": len(scan.get("theme_violations", [])),
                "broken_flows": len(scan.get("broken_flows", [])),
                "tech_debt_items": len(scan.get("technical_debt", [])),
                "todo_markers": len(scan.get("todo_markers", [])),
                "gates_all_present": scan.get("verification_gates", {}).get("all_present", False),
            },
            "executed_task": {
                "id": active.id,
                "title": active.title,
                "description": active.description,
            } if active else None,
            "execution": {
                "status": execution.status,
                "details": execution.details[:2000],
                "exit_code": getattr(execution, "exit_code", None),
            } if execution else None,
            "evaluation": evaluation,
            "remaining_pending": queue.pending_count(),
        }

        self.memory.record_iteration(result)
        return result

    # ── Self-Evaluation ──────────────────────────────────────────────

    def _evaluate(self, scan: Dict, objective: Dict, execution: ExecutionResult | None) -> Dict:
        """Assess cycle outcome and decide continuation signal."""
        health_score = 100

        rn_risks = len(scan.get("rn_crash_risks", []))
        broken_flows = len(scan.get("broken_flows", []))
        theme_violations = len(scan.get("theme_violations", []))
        tech_debt = len(scan.get("technical_debt", []))

        # Deductions
        health_score -= min(40, rn_risks * 15)      # crash risks are severe
        health_score -= min(20, broken_flows * 10)   # navigation issues
        health_score -= min(10, theme_violations)    # cosmetic
        health_score -= min(15, tech_debt * 5)       # structural

        if execution and execution.status == "failed":
            health_score -= 10

        health_score = max(0, health_score)

        # Continuation decision
        should_continue = health_score < 85 or rn_risks > 0 or broken_flows > 0

        verdict = "HEALTHY" if health_score >= 85 else "NEEDS_WORK" if health_score >= 50 else "CRITICAL"

        return {
            "health_score": health_score,
            "verdict": verdict,
            "should_continue": should_continue,
            "signals": {
                "rn_crash_risks": rn_risks,
                "broken_flows": broken_flows,
                "theme_violations": theme_violations,
                "tech_debt_items": tech_debt,
                "execution_ok": execution.status in {"done", "simulated"} if execution else True,
            },
            "recommendation": self._recommend(health_score, rn_risks, broken_flows),
        }

    @staticmethod
    def _recommend(health: int, crashes: int, broken: int) -> str:
        if crashes > 0:
            return "URGENT: Fix React Native crash patterns before any other work"
        if broken > 0:
            return "Fix broken navigation flows to restore user accessibility"
        if health < 70:
            return "Address technical debt and missing verification infrastructure"
        if health < 85:
            return "Run verification gates and resolve remaining warnings"
        return "Project is healthy. Consider incremental improvements."

    # ── Map Updates ──────────────────────────────────────────────────

    def _update_maps(self, scan: Dict, objective: Dict, queue: TaskQueue) -> None:
        architecture_map = {
            "tech_stack": scan.get("tech_stack", {}),
            "entry_points": scan.get("entry_points", []),
            "auth_state": scan.get("auth_state", {}),
            "database_models": scan.get("database_models", {}),
            "api_routes": scan.get("api_routes", {}),
            "ui_components": scan.get("ui_components", {}),
            "env_configs": scan.get("env_configs", {}),
        }

        completion_map = {
            "objective": objective.get("primary_objective"),
            "pending_tasks": queue.pending_count(),
            "completion_criteria": objective.get("completion_criteria", []),
        }

        security_map = {
            "risk_level": "medium" if objective.get("known_weaknesses") else "low",
            "known_weaknesses": [
                w for w in objective.get("known_weaknesses", [])
                if any(kw in w.lower() for kw in ("auth", "secure", "encrypt", "biometric"))
            ],
        }

        performance_map = {
            "known_bottlenecks": [
                w for w in objective.get("known_weaknesses", [])
                if any(kw in w.lower() for kw in ("large tsx", "performance", "bottleneck"))
            ],
            "rn_crash_risks": scan.get("rn_crash_risks", [])[:20],
        }

        monetization_map = {
            "notes": ["Monetization analysis deferred — focus on stability"],
        }

        self.memory.upsert_maps(
            architecture_map=architecture_map,
            completion_map=completion_map,
            security_map=security_map,
            performance_map=performance_map,
            monetization_map=monetization_map,
        )


def _load_config(config_path: Path) -> Dict:
    config: Dict = {
        "max_cycles": 1,
        "dry_run": True,
    }
    if not config_path.exists():
        return config

    try:
        import yaml  # type: ignore

        loaded = yaml.safe_load(config_path.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            config.update(loaded)
        return config
    except Exception:
        for raw in config_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or ":" not in line:
                continue
            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()
            if value.lower() in {"true", "false"}:
                config[key] = value.lower() == "true"
            elif value.isdigit():
                config[key] = int(value)
            else:
                config[key] = value
        return config


def main() -> None:
    parser = argparse.ArgumentParser(description="Alfred autonomous build agent runtime")
    parser.add_argument("--repo-root", default=".", help="Repository root path")
    parser.add_argument("--cycles", type=int, default=None, help="Override number of cycles")
    parser.add_argument("--dry-run", action="store_true", help="Force dry-run mode")
    parser.add_argument("--mode", default=None, help="Operational mode override")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    config_path = repo_root / "agents" / "alfred" / "config.yaml"
    config = _load_config(config_path)

    if args.cycles is not None:
        config["max_cycles"] = args.cycles
    if args.dry_run:
        config["dry_run"] = True
    if args.mode:
        config["mode"] = args.mode

    orchestrator = AlfredOrchestrator(repo_root, config)

    max_cycles = int(config.get("max_cycles", 1))
    for cycle in range(1, max_cycles + 1):
        result = orchestrator.cycle(cycle)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
