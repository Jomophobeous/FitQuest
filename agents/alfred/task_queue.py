from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List


@dataclass
class Task:
    id: str
    title: str
    description: str
    priority: int
    risk: str
    status: str = "pending"


class TaskQueue:
    def __init__(self, initial: List[Dict] | None = None) -> None:
        self._queue: List[Task] = []
        if initial:
            for row in initial:
                self._queue.append(Task(**row))

    def enqueue(self, task: Task) -> None:
        if any(t.id == task.id and t.status in {"pending", "in_progress"} for t in self._queue):
            return
        self._queue.append(task)
        self._queue.sort(key=lambda t: t.priority)

    def enqueue_many(self, tasks: List[Task]) -> None:
        for task in tasks:
            self.enqueue(task)

    def next_task(self) -> Task | None:
        for task in self._queue:
            if task.status == "pending":
                task.status = "in_progress"
                return task
        return None

    def mark_done(self, task_id: str) -> None:
        for task in self._queue:
            if task.id == task_id:
                task.status = "done"
                return

    def mark_blocked(self, task_id: str) -> None:
        for task in self._queue:
            if task.id == task_id:
                task.status = "blocked"
                return

    def pending_count(self) -> int:
        return sum(1 for t in self._queue if t.status == "pending")

    def dump(self) -> List[Dict]:
        return [asdict(task) for task in self._queue]
