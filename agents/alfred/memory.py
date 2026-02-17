from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


@dataclass
class MemoryPaths:
    root: Path

    @property
    def state_file(self) -> Path:
        return self.root / "state" / "memory.json"


class MemoryStore:
    def __init__(self, root: Path) -> None:
        self.paths = MemoryPaths(root=root)
        self.paths.state_file.parent.mkdir(parents=True, exist_ok=True)
        self._state: Dict[str, Any] = self._load()

    def _default_state(self) -> Dict[str, Any]:
        return {
            "created_at": self._now(),
            "updated_at": self._now(),
            "architecture_map": {},
            "feature_completion_map": {},
            "security_risk_map": {},
            "performance_bottleneck_map": {},
            "monetization_optimization_map": {},
            "task_queue_snapshot": [],
            "iterations": [],
            "known_weaknesses": [],
        }

    def _load(self) -> Dict[str, Any]:
        if not self.paths.state_file.exists():
            state = self._default_state()
            self._write(state)
            return state

        try:
            with self.paths.state_file.open("r", encoding="utf-8") as f:
                loaded = json.load(f)
            if not isinstance(loaded, dict):
                raise ValueError("Memory state file is not a JSON object")
            return loaded
        except Exception:
            state = self._default_state()
            self._write(state)
            return state

    def _write(self, state: Dict[str, Any]) -> None:
        state["updated_at"] = self._now()
        with self.paths.state_file.open("w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def snapshot(self) -> Dict[str, Any]:
        return dict(self._state)

    def get(self, key: str, default: Any = None) -> Any:
        return self._state.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._state[key] = value
        self._write(self._state)

    def upsert_maps(self, *, architecture_map: Dict[str, Any], completion_map: Dict[str, Any], security_map: Dict[str, Any], performance_map: Dict[str, Any], monetization_map: Dict[str, Any]) -> None:
        self._state["architecture_map"] = architecture_map
        self._state["feature_completion_map"] = completion_map
        self._state["security_risk_map"] = security_map
        self._state["performance_bottleneck_map"] = performance_map
        self._state["monetization_optimization_map"] = monetization_map
        self._write(self._state)

    def get_task_queue_snapshot(self) -> List[Dict[str, Any]]:
        queue = self._state.get("task_queue_snapshot", [])
        return queue if isinstance(queue, list) else []

    def set_task_queue_snapshot(self, queue: List[Dict[str, Any]]) -> None:
        self._state["task_queue_snapshot"] = queue
        self._write(self._state)

    def add_weaknesses(self, weaknesses: List[str]) -> None:
        existing = set(self._state.get("known_weaknesses", []))
        for weakness in weaknesses:
            if weakness and weakness not in existing:
                existing.add(weakness)
        self._state["known_weaknesses"] = sorted(existing)
        self._write(self._state)

    def record_iteration(self, payload: Dict[str, Any]) -> None:
        entries = self._state.get("iterations", [])
        if not isinstance(entries, list):
            entries = []

        entries.append({
            "timestamp": self._now(),
            **payload,
        })

        max_entries = 100
        self._state["iterations"] = entries[-max_entries:]
        self._write(self._state)
