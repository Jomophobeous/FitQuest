# Alfred Autonomous Runtime

Alfred is a repository-local autonomous build agent runtime for iterative improvement.

## Components
- `orchestrator.py`: main autonomous loop controller with self-evaluation
- `scanner.py`: repository and architecture scanner (RN crash detection, theme violations, gate inventory)
- `planner.py`: objective inference and prioritized task planning
- `task_queue.py`: prioritized task queue with dedupe/status
- `executor.py`: guarded command registry with dry-run/live execution
- `memory.py`: persistent memory maps and iteration history
- `config.yaml`: runtime controls
- `prompts/`: system and planning directives

## Quick Start
From repository root:

1. Dry-run autonomous cycles (default):
   - `python agents/alfred/orchestrator.py --repo-root .`

2. Override cycle count:
   - `python agents/alfred/orchestrator.py --repo-root . --cycles 5`

3. Force dry-run from CLI:
   - `python agents/alfred/orchestrator.py --repo-root . --dry-run`

## Phase 2 Capabilities
- **RN Crash Detection**: Scans for `{value && (<Component>)}` patterns that render `0`/`NaN` as bare text — the #1 cause of React Native red screens
- **Theme Violation Detection**: Finds hardcoded colors/spacing that should use the theme system
- **Verification Gate Inventory**: Detects which npm verify scripts exist and maps them to executable tasks
- **Self-Evaluation**: Each cycle produces a health score (0-100), verdict (HEALTHY/NEEDS_WORK/CRITICAL), and continuation signal
- **Guarded Executor**: Command registry with timeout protection, gate sweep capability, and prefix-based task matching

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
- Non-mapped tasks are blocked rather than executed
- 120s timeout on all subprocess calls
- Intended for supervised incremental rollout
