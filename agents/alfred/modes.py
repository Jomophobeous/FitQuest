"""Alfred Ω — Operational Mode System.

Defines the 15 operational modes, override authority levels, and audit
severity classifications.  The active mode determines scan scope, fix
strategy, and response format for each execution cycle.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional


# ── Override authority ────────────────────────────────────────────────

class OverrideLevel(Enum):
    PASSIVE = 0      # Normal execution
    WARNING = 1      # Minor inefficiency — proceed with flag
    CORRECTION = 2   # Suboptimal architecture — override approach
    BLOCK = 3        # Race condition / instability — do NOT execute
    HARD_STOP = 4    # Data corruption / auth breakage — refuse

    @property
    def signal(self) -> Optional[str]:
        signals = {
            0: None,
            1: None,
            2: "OVERRIDE: Level 2 — Correcting approach",
            3: "OVERRIDE: Level 3 — Blocking execution",
            4: "OVERRIDE: Level 4 — Hard stop",
        }
        return signals[self.value]


# ── Audit severity ────────────────────────────────────────────────────

class AuditSeverity(Enum):
    LOW = "LOW"           # Inefficiency
    MEDIUM = "MEDIUM"     # Potential instability
    HIGH = "HIGH"         # Active instability — apply correction
    CRITICAL = "CRITICAL" # System-breaking — trigger override


# ── Operational modes ─────────────────────────────────────────────────

class Mode(Enum):
    FULL_AUTONOMOUS = "full_autonomous"
    FAILURE_SIMULATION = "failure_simulation"
    RACE_CONDITION_HUNT = "race_condition_hunt"
    RENDER_STABILIZATION = "render_stabilization"
    PERFORMANCE_OPTIMIZATION = "performance_optimization"
    BOOT_SEQUENCE_CONTROL = "boot_sequence_control"
    ACCESS_CONTROL_LOCKDOWN = "access_control_lockdown"
    ASYNC_CONTROL = "async_control"
    LAYOUT_KEYBOARD_STABILIZATION = "layout_keyboard_stabilization"
    ARCHITECTURE_MAP = "architecture_map"
    VALIDATION = "validation"
    AGGRESSIVE_CLEANUP = "aggressive_cleanup"
    CONTINUOUS_HARDENING = "continuous_hardening"
    CRITICAL_FAILURE_RESPONSE = "critical_failure_response"
    SELF_AUDIT = "self_audit"


@dataclass(frozen=True)
class ModeSpec:
    mode: Mode
    description: str
    trigger: str
    scan_focus: List[str]
    response_format: str  # "standard" | "failure_simulation" | "self_audit"


MODE_REGISTRY: Dict[Mode, ModeSpec] = {
    Mode.FULL_AUTONOMOUS: ModeSpec(
        mode=Mode.FULL_AUTONOMOUS,
        description="Full scan → execute → validate loop until stable",
        trigger="Default / any instruction",
        scan_focus=["all"],
        response_format="standard",
    ),
    Mode.FAILURE_SIMULATION: ModeSpec(
        mode=Mode.FAILURE_SIMULATION,
        description="Stress test systems with synthetic race conditions and async overlaps",
        trigger="Manual",
        scan_focus=["boot", "async", "state", "render", "navigation"],
        response_format="failure_simulation",
    ),
    Mode.RACE_CONDITION_HUNT: ModeSpec(
        mode=Mode.RACE_CONDITION_HUNT,
        description="Find async/init issues. Add guards, mutexes, cancellation tokens",
        trigger="Manual / automated",
        scan_focus=["async", "initialization", "effects"],
        response_format="standard",
    ),
    Mode.RENDER_STABILIZATION: ModeSpec(
        mode=Mode.RENDER_STABILIZATION,
        description="Stop flicker/twitch. Memoize, gate renders, optimize layout",
        trigger="Screen / component",
        scan_focus=["render", "layout", "memoization"],
        response_format="standard",
    ),
    Mode.PERFORMANCE_OPTIMIZATION: ModeSpec(
        mode=Mode.PERFORMANCE_OPTIMIZATION,
        description="Reduce startup time, CPU, memory, async blocking",
        trigger="Manual / auto",
        scan_focus=["startup", "memory", "cpu", "async"],
        response_format="standard",
    ),
    Mode.BOOT_SEQUENCE_CONTROL: ModeSpec(
        mode=Mode.BOOT_SEQUENCE_CONTROL,
        description="Ensure DB → Auth → Subscription init order is correct",
        trigger="System startup",
        scan_focus=["boot", "initialization", "providers"],
        response_format="standard",
    ),
    Mode.ACCESS_CONTROL_LOCKDOWN: ModeSpec(
        mode=Mode.ACCESS_CONTROL_LOCKDOWN,
        description="Enforce subscription/trial state machine integrity",
        trigger="Any access check",
        scan_focus=["subscription", "trial", "auth", "state_machine"],
        response_format="standard",
    ),
    Mode.ASYNC_CONTROL: ModeSpec(
        mode=Mode.ASYNC_CONTROL,
        description="Deduplicate and cancel async. Single execution paths",
        trigger="Any async work",
        scan_focus=["async", "promises", "effects"],
        response_format="standard",
    ),
    Mode.LAYOUT_KEYBOARD_STABILIZATION: ModeSpec(
        mode=Mode.LAYOUT_KEYBOARD_STABILIZATION,
        description="Fix padding/input bar. KeyboardAvoidingView patterns",
        trigger="Screens with input",
        scan_focus=["layout", "keyboard", "input", "tabs"],
        response_format="standard",
    ),
    Mode.ARCHITECTURE_MAP: ModeSpec(
        mode=Mode.ARCHITECTURE_MAP,
        description="Build system map and dependency graph",
        trigger="Manual",
        scan_focus=["imports", "providers", "state", "navigation"],
        response_format="standard",
    ),
    Mode.VALIDATION: ModeSpec(
        mode=Mode.VALIDATION,
        description="Verify all changes. Confirm fixes work and constraints are met",
        trigger="After any edit",
        scan_focus=["all"],
        response_format="standard",
    ),
    Mode.AGGRESSIVE_CLEANUP: ModeSpec(
        mode=Mode.AGGRESSIVE_CLEANUP,
        description="Remove dead code, duplicate logic, redundancy",
        trigger="Manual / auto",
        scan_focus=["dead_code", "duplicates", "unused_imports"],
        response_format="standard",
    ),
    Mode.CONTINUOUS_HARDENING: ModeSpec(
        mode=Mode.CONTINUOUS_HARDENING,
        description="Simulate → break → fix → validate loop until stable",
        trigger="Manual / self-audit",
        scan_focus=["all"],
        response_format="failure_simulation",
    ),
    Mode.CRITICAL_FAILURE_RESPONSE: ModeSpec(
        mode=Mode.CRITICAL_FAILURE_RESPONSE,
        description="Handle serious errors. Isolate root cause, prevent regression",
        trigger="Runtime error / test failure",
        scan_focus=["error_source", "dependencies", "state"],
        response_format="standard",
    ),
    Mode.SELF_AUDIT: ModeSpec(
        mode=Mode.SELF_AUDIT,
        description="Continuous integrity enforcement. Proactive scanning",
        trigger="Always-on / manual",
        scan_focus=["boot", "access_control", "async", "render", "layout",
                     "background", "navigation", "database", "performance"],
        response_format="self_audit",
    ),
}


# ── Mode state ────────────────────────────────────────────────────────

class ModeController:
    """Manages the active operational mode for Alfred's runtime."""

    def __init__(self, initial: str = "full_autonomous") -> None:
        self._mode = self._resolve(initial)

    @property
    def active(self) -> Mode:
        return self._mode

    @property
    def spec(self) -> ModeSpec:
        return MODE_REGISTRY[self._mode]

    def switch(self, mode_name: str) -> ModeSpec:
        self._mode = self._resolve(mode_name)
        return self.spec

    def recommend(self, scan: Dict) -> Optional[str]:
        """Suggest a mode based on scan results. Returns mode name or None."""
        rn_risks = len(scan.get("rn_crash_risks", []))
        theme_violations = len(scan.get("theme_violations", []))
        broken_flows = len(scan.get("broken_flows", []))

        if rn_risks > 5:
            return Mode.RACE_CONDITION_HUNT.value
        if broken_flows > 3:
            return Mode.BOOT_SEQUENCE_CONTROL.value
        if theme_violations > 20:
            return Mode.RENDER_STABILIZATION.value
        return None

    @staticmethod
    def _resolve(name: str) -> Mode:
        try:
            return Mode(name)
        except ValueError:
            return Mode.FULL_AUTONOMOUS
