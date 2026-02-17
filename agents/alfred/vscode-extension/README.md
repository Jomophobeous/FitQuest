# Alfred VS Code Extension

VS Code sidebar integration for the Alfred autonomous agent runtime.

## Features

| Command | Description |
|---------|-------------|
| `Alfred: Scan Repository` | Run full repository scan and update signals |
| `Alfred: Run Cycle (Dry-Run)` | Execute one orchestrator cycle in safe mode |
| `Alfred: Run Cycle (Live)` | Execute one orchestrator cycle with real commands |
| `Alfred: Auto-Fix All Issues` | Apply deterministic auto-fixes to source |
| `Alfred: Auto-Fix Preview` | Preview auto-fix changes without applying |
| `Alfred: Run All Gates` | Execute all verification gate scripts |
| `Alfred: Show Health Score` | Open health report webview panel |
| `Alfred: Show Memory State` | Open Alfred's memory.json state file |

## Sidebar Panels

The **Alfred Agent** sidebar contains three views:

1. **Health Score** — Overall project health (0-100) with verdict
2. **Task Queue** — Current/pending tasks from the planning engine
3. **Signals** — Individual scanner signals (crash risks, theme violations, etc.)

## Architecture

```
┌─────────────────────────────────────────┐
│  VS Code Extension (TypeScript)         │
│  ├── extension.ts  — commands, UI       │
│  ├── runner.ts     — Python subprocess  │
│  └── views.ts      — sidebar providers  │
└──────────────┬──────────────────────────┘
               │ execFile (one-shot)
┌──────────────▼──────────────────────────┐
│  Alfred Python Runtime                  │
│  ├── orchestrator.py  — main loop       │
│  ├── scanner.py       — repo analysis   │
│  ├── planner.py       — task generation │
│  ├── executor.py      — guarded exec    │
│  ├── auto_fixer.py    — Phase 3 fixes   │
│  ├── memory.py        — JSON state      │
│  └── task_queue.py    — priority queue  │
└─────────────────────────────────────────┘
```

## Development

```bash
cd agents/alfred/vscode-extension
npm install
npm run compile
```

Press F5 in VS Code to launch extension development host.

## Safety Model

- **Dry-run by default** — all orchestrator cycles simulate execution
- **Confirmation required** — Live mode and auto-fix prompt user before acting
- **Guarded executor** — Only whitelisted commands can be run
- **Idempotent fixes** — Auto-fixer can be run multiple times safely
