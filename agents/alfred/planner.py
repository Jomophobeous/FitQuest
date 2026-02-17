from __future__ import annotations

from typing import Dict, List

from task_queue import Task


class Planner:
    def __init__(self) -> None:
        self.priority_order = [
            "security",
            "data_integrity",
            "auth_stability",
            "feature_reliability",
            "rn_crash_risk",
            "error_handling",
            "performance",
            "monetization",
            "refactor",
        ]

    def infer_objective(self, scan: Dict) -> Dict:
        weaknesses: List[str] = []

        if not scan.get("auth_state", {}).get("secure_store_present", False):
            weaknesses.append("SecureStore migration not detected")
        if not scan.get("auth_state", {}).get("biometric_auth_present", False):
            weaknesses.append("Biometric auth flow not detected")

        # RN crash risks are highest severity
        rn_risks = scan.get("rn_crash_risks", [])
        if rn_risks:
            weaknesses.append(
                f"React Native crash risks: {len(rn_risks)} unsafe falsy render patterns"
            )

        # Theme violations
        theme_violations = scan.get("theme_violations", [])
        if theme_violations:
            weaknesses.append(
                f"Theme violations: {len(theme_violations)} hardcoded color/spacing values"
            )

        # Verification gate status
        gates = scan.get("verification_gates", {})
        missing_gates = [
            name for name, present in gates.get("gate_scripts", {}).items()
            if not present
        ]
        if missing_gates:
            weaknesses.append(f"Missing verification gates: {', '.join(missing_gates)}")

        tech_debt = scan.get("technical_debt", [])
        weaknesses.extend(tech_debt)

        # Determine primary objective based on severity
        objective = "Improve production readiness and reduce reliability risks"
        if rn_risks:
            objective = "Fix React Native crash risks — unsafe render patterns detected"
        elif any("not reachable" in issue for issue in scan.get("broken_flows", [])):
            objective = "Fix navigation discoverability and broken user flows"

        return {
            "primary_objective": objective,
            "sub_objectives": [
                "Eliminate RN crash-causing render patterns",
                "Eliminate critical broken flows",
                "Address highest-priority security and reliability gaps",
                "Reduce technical debt that blocks stable releases",
            ],
            "completion_criteria": [
                "Zero unsafe falsy render patterns in scan report",
                "No critical broken flow findings in scan report",
                "Security/auth baseline checks pass",
                "All verification gates pass",
            ],
            "known_weaknesses": weaknesses,
        }

    def build_tasks(self, scan: Dict, objective: Dict) -> List[Task]:
        tasks: List[Task] = []

        # Priority 0: RN crash risks (highest priority — causes red screen)
        rn_risks = scan.get("rn_crash_risks", [])
        if rn_risks:
            affected_files = sorted(set(r["file"] for r in rn_risks))
            tasks.append(
                Task(
                    id="crash_risk::unsafe_falsy_render",
                    title="Fix RN crash patterns",
                    description=(
                        f"{len(rn_risks)} unsafe falsy render patterns in: "
                        + ", ".join(affected_files[:8])
                    ),
                    priority=0,
                    risk="high",
                )
            )

        # Priority 1: Broken navigation flows
        for issue in scan.get("broken_flows", []):
            tasks.append(
                Task(
                    id=f"broken_flow::{issue[:80]}",
                    title="Fix broken flow",
                    description=issue,
                    priority=1,
                    risk="medium",
                )
            )

        # Priority 2: Run verification gates
        gates = scan.get("verification_gates", {})
        npm_scripts = gates.get("npm_verify_scripts", [])
        for script_name in npm_scripts[:6]:
            gate_key = script_name.replace("verify:", "").replace(":", "-")
            tasks.append(
                Task(
                    id=f"gate::{gate_key}",
                    title=f"Run gate: {gate_key}",
                    description=f"Execute npm run {script_name}",
                    priority=2,
                    risk="low",
                )
            )

        # Priority 3: Technical debt items
        for debt in scan.get("technical_debt", [])[:5]:
            tasks.append(
                Task(
                    id=f"debt::{debt[:80]}",
                    title="Reduce technical debt",
                    description=debt,
                    priority=3,
                    risk="low",
                )
            )

        # Priority 4: Theme violations
        theme_violations = scan.get("theme_violations", [])
        if theme_violations:
            affected = sorted(set(v["file"] for v in theme_violations))
            tasks.append(
                Task(
                    id="style::theme_violations",
                    title="Fix theme violations",
                    description=(
                        f"{len(theme_violations)} hardcoded values in: "
                        + ", ".join(affected[:6])
                    ),
                    priority=4,
                    risk="low",
                )
            )

        # Fallback: run stability validation if nothing else
        if not tasks:
            tasks.append(
                Task(
                    id="stability::validation-pass",
                    title="Run stability validation",
                    description="Run core validation gates and update objective maps",
                    priority=2,
                    risk="low",
                )
            )

        return tasks
