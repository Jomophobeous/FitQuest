# Alfred Ω — Autonomous Runtime

Alfred is a constraint-driven autonomous execution engine for iterative improvement.
Not an assistant. A system that enforces correctness, stability, and performance.

## Components

- `orchestrator.py`: main autonomous loop controller with self-evaluation and mode awareness
- `scanner.py`: repository and architecture scanner (RN crash detection, theme violations, gate inventory)
- `planner.py`: objective inference and prioritized task planning
- `task_queue.py`: prioritized task queue with dedupe/status
- `executor.py`: guarded command registry with dry-run/live execution + auto-fix integration
- `auto_fixer.py`: deterministic auto-fix engine for RN crash patterns and theme violations
- `memory.py`: persistent memory maps, iteration history, and append-only change logging
- `modes.py`: operational mode system (15 modes), override authority levels, audit severity
- `config.yaml`: runtime controls (mode, dry_run, cycles)
- `prompts/`: system and planning directives
- `vscode-extension/`: VS Code sidebar integration (Phase 4)

## Operational Modes

Alfred operates in one active mode at a time. Default: `full_autonomous`.

| Mode | Purpose |
|------|---------|
| `full_autonomous` | Full scan → execute → validate loop |
| `failure_simulation` | Stress test with synthetic race conditions |
| `race_condition_hunt` | Find async/init issues, add guards |
| `render_stabilization` | Stop flicker/twitch, memoize, gate renders |
| `performance_optimization` | Reduce startup, CPU, memory |
| `boot_sequence_control` | Fix init order: DB → Auth → Subscription |
| `access_control_lockdown` | Enforce subscription/trial state machine |
| `async_control` | Deduplicate & cancel async |
| `layout_keyboard_stabilization` | Fix padding/input bar |
| `architecture_map` | Build system map, dependency graph |
| `validation` | Verify all changes, confirm constraints met |
| `aggressive_cleanup` | Remove dead code, duplicate logic |
| `continuous_hardening` | Simulate → break → fix → validate loop |
| `critical_failure_response` | Isolate root cause, prevent regression |
| `self_audit` | Continuous integrity enforcement |

### Mode selection

```bash
# Via config.yaml
mode: failure_simulation

# Via CLI
python agents/alfred/orchestrator.py --repo-root . --mode self_audit
```

Alfred may recommend mode switches based on scan results.

## Override Authority

Alfred enforces correctness even against the user. Override levels:

| Level | Name | Trigger |
|-------|------|---------|
| 0 | PASSIVE | Normal execution |
| 1 | WARNING | Minor inefficiency — proceed with flag |
| 2 | CORRECTION | Suboptimal architecture — replace approach |
| 3 | BLOCK | Race condition / instability — refuse execution |
| 4 | HARD STOP | Data corruption / auth breakage — demand confirmation |

## Quick Start

From repository root:

1. Default autonomous cycle:
   - `python agents/alfred/orchestrator.py --repo-root .`

2. Override cycle count:
   - `python agents/alfred/orchestrator.py --repo-root . --cycles 5`

3. Force dry-run:
   - `python agents/alfred/orchestrator.py --repo-root . --dry-run`

4. Run in a specific mode:
   - `python agents/alfred/orchestrator.py --repo-root . --mode failure_simulation`

5. Run auto-fixer preview:
   - `python -c "from agents.alfred.auto_fixer import AutoFixer; from pathlib import Path; import json; f=AutoFixer(Path('.'),dry_run=True); print(json.dumps(AutoFixer.summarize(f.run_all()),indent=2))"`

## Phase 2 — Detection

- **RN Crash Detection**: Scans for `{value && (<Component>)}` patterns that render `0`/`NaN` as bare text
- **Theme Violation Detection**: Finds hardcoded colors/spacing in style contexts
- **Verification Gate Inventory**: Detects which npm verify scripts exist
- **Self-Evaluation**: Each cycle produces a health score (0-100), verdict, and continuation signal
- **Guarded Executor**: Command registry with timeout protection and gate sweep capability

## Phase 3 — Auto-Fix Engine

- **`auto_fixer.py`**: Deterministic, file-level text transforms — no AST required
- **RN crash fix**: Converts `{val && (<JSX>)}` → `{!!val && (<JSX>)}`
- **Theme color fix**: Replaces known hex literals with `theme.colors.*` tokens
- **Idempotent**: Running twice produces no additional changes
- **Dry-run aware**: Preview patches without writing files
- **Integrated**: Executor routes `autofix::*` and `crash_risk::*` task IDs automatically

## Phase 4 — VS Code Extension

- **Sidebar panels**: Health Score, Task Queue, Signals — live tree views
- **8 commands**: Scan, Cycle (dry-run/live), Auto-fix (preview/apply), Gates sweep, Health report, Memory viewer
- **Status bar**: Live health score indicator
- **Health webview**: Rich HTML panel with score ring and signal grid
- **Python bridge**: `runner.ts` spawns one-shot Python subprocesses, parses JSON
- **Safety**: Live mode and auto-fix require confirmation modal

See `vscode-extension/README.md` for development setup.

## Memory Output

State persists at:
- `agents/alfred/state/memory.json`
- `agents/alfred/state/change-log.jsonl`

Includes:
- Architecture, completion, security, performance, monetization maps
- Iteration history with health scores
- Queue snapshot
- Append-only change events with active mode recorded

## Change Logging

- Alfred always logs change attempts and applied changes with timestamps.
- Auto-fix logs include affected files and patch summaries.
- Executor logs include task outcome, command details, workspace deltas, and active mode.
- Dry-run previews are logged. Every proposed change is auditable.

## Safety Defaults

- `dry_run: true` by default
- Only commands in `COMMAND_REGISTRY` can execute (whitelist model)
- Auto-fix tasks use deterministic text transforms (no shell commands)
- Non-mapped tasks are blocked rather than executed
- 120s timeout on all subprocess calls
- VS Code extension requires confirmation for destructive actions
- Override authority blocks unsafe operations before execution
- Intended for supervised incremental rollout
