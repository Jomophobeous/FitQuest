# Alfred Autonomous Runtime

Alfred is a repository-local autonomous build agent runtime for iterative improvement.

## Components
- `orchestrator.py`: main autonomous loop controller with self-evaluation
- `scanner.py`: repository and architecture scanner (RN crash detection, theme violations, gate inventory)
- `planner.py`: objective inference and prioritized task planning
- `task_queue.py`: prioritized task queue with dedupe/status
- `executor.py`: guarded command registry with dry-run/live execution + auto-fix integration
- `auto_fixer.py`: deterministic auto-fix engine for RN crash patterns and theme violations
- `memory.py`: persistent memory maps and iteration history
- `config.yaml`: runtime controls
- `prompts/`: system and planning directives
- `vscode-extension/`: VS Code sidebar integration (Phase 4)

## Quick Start
From repository root:

1. Dry-run autonomous cycles (default):
   - `python agents/alfred/orchestrator.py --repo-root .`

2. Override cycle count:
   - `python agents/alfred/orchestrator.py --repo-root . --cycles 5`

3. Force dry-run from CLI:
   - `python agents/alfred/orchestrator.py --repo-root . --dry-run`

4. Run auto-fixer preview:
   - `python -c "from agents.alfred.auto_fixer import AutoFixer; from pathlib import Path; import json; f=AutoFixer(Path('.'),dry_run=True); print(json.dumps(AutoFixer.summarize(f.run_all()),indent=2))"`

## Phase 2 — Detection
- **RN Crash Detection**: Scans for `{value && (<Component>)}` patterns that render `0`/`NaN` as bare text — the #1 cause of React Native red screens
- **Theme Violation Detection**: Finds hardcoded colors/spacing in style contexts (excludes data configs, splash screen, theme definitions)
- **Verification Gate Inventory**: Detects which npm verify scripts exist and maps them to executable tasks
- **Self-Evaluation**: Each cycle produces a health score (0-100), verdict (HEALTHY/NEEDS_WORK/CRITICAL), and continuation signal
- **Guarded Executor**: Command registry with timeout protection, gate sweep capability, and prefix-based task matching

## Phase 3 — Auto-Fix Engine
- **`auto_fixer.py`**: Deterministic, file-level text transforms — no AST required
- **RN crash fix**: Converts `{val && (<JSX>)}` → `{!!val && (<JSX>)}` (boolean coercion)
- **Theme color fix**: Replaces known hex literals (`#EF4444`, `#F4A427`, `#10B981` etc.) with `theme.colors.*` tokens
- **Idempotent**: Running twice produces no additional changes
- **Dry-run aware**: Preview patches without writing files
- **Integrated**: Executor routes `autofix::*` and `crash_risk::*` task IDs to the auto-fixer automatically

## Phase 4 — VS Code Extension
- **Sidebar panels**: Health Score, Task Queue, Signals — live tree views
- **8 commands**: Scan, Cycle (dry-run/live), Auto-fix (preview/apply), Gates sweep, Health report, Memory viewer
- **Status bar**: Live health score indicator with icon (check/warning/error)
- **Health webview**: Rich HTML panel with score ring and signal grid
- **Python bridge**: `runner.ts` spawns one-shot Python subprocesses, parses JSON
- **Safety**: Live mode and auto-fix require confirmation modal

See `vscode-extension/README.md` for development setup.

## Memory Output
State persists at:
- `agents/alfred/state/memory.json`

Includes:
- Architecture map
- Feature completion map
- Security risk map (with RN crash risks)
- Performance bottleneck map
- Monetization optimization map
- Iteration history with health scores
- Queue snapshot

## Safety Defaults
- `dry_run: true` by default
- Only commands in `COMMAND_REGISTRY` can execute (whitelist model)
- Auto-fix tasks use deterministic text transforms (no shell commands)
- Non-mapped tasks are blocked rather than executed
- 120s timeout on all subprocess calls
- VS Code extension requires confirmation for destructive actions
- Intended for supervised incremental rollout
