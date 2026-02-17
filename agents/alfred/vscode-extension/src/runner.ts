/**
 * Alfred Runner — Python process bridge.
 *
 * Spawns the Alfred Python runtime as a subprocess and parses JSON output.
 * All communication is one-shot (no long-lived process).
 */

import * as vscode from "vscode";
import { execFile } from "child_process";
import * as path from "path";

export class AlfredRunner {
  private readonly workspaceRoot: string;
  private readonly pythonPath: string;
  private readonly alfredDir: string;
  private lastScan: any = null;
  private lastCycle: any = null;

  constructor(workspaceRoot: string, _context: vscode.ExtensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.alfredDir = path.join(workspaceRoot, "agents", "alfred");
    // Prefer workspace .venv, fall back to system Python
    this.pythonPath = path.join(workspaceRoot, ".venv", "bin", "python");
  }

  /** Run a repository scan and return summary metrics. */
  async scan(): Promise<any> {
    const result = await this.runPython(`
import json, sys
sys.path.insert(0, '${this.alfredDir.replace(/'/g, "\\'")}')
from scanner import RepositoryScanner
from pathlib import Path

scan = RepositoryScanner(Path('${this.workspaceRoot.replace(/'/g, "\\'")}')).run()
print(json.dumps({
    "file_count": scan.get("file_count", 0),
    "rn_crash_risks": len(scan.get("rn_crash_risks", [])),
    "theme_violations": len(scan.get("theme_violations", [])),
    "broken_flows": len(scan.get("broken_flows", [])),
    "tech_debt_items": len(scan.get("technical_debt", [])),
    "todo_markers": len(scan.get("todo_markers", [])),
    "gates_all_present": scan.get("verification_gates", {}).get("all_present", False),
}))
`);
    this.lastScan = result;
    return result;
  }

  /** Run a full orchestrator cycle. */
  async runCycle(dryRun: boolean): Promise<any> {
    const dryRunFlag = dryRun ? "--dry-run" : "";
    const result = await this.runPython(`
import json, sys
sys.path.insert(0, '${this.alfredDir.replace(/'/g, "\\'")}')
from orchestrator import AlfredOrchestrator
from pathlib import Path

config = {"max_cycles": 1, "dry_run": ${dryRun ? "True" : "False"}}
orch = AlfredOrchestrator(Path('${this.workspaceRoot.replace(/'/g, "\\'")}'), config)
result = orch.cycle(1)
print(json.dumps(result, default=str))
`);
    this.lastCycle = result;
    return result;
  }

  /** Run auto-fixer and return summary. */
  async autofix(dryRun: boolean): Promise<any> {
    return this.runPython(`
import json, sys
sys.path.insert(0, '${this.alfredDir.replace(/'/g, "\\'")}')
from auto_fixer import AutoFixer
from pathlib import Path

fixer = AutoFixer(Path('${this.workspaceRoot.replace(/'/g, "\\'")}'), dry_run=${dryRun ? "True" : "False"})
results = fixer.run_all()
print(json.dumps(AutoFixer.summarize(results)))
`);
  }

  /** Run all verification gates. */
  async gatesSweep(): Promise<any> {
    return this.runPython(`
import json, sys
sys.path.insert(0, '${this.alfredDir.replace(/'/g, "\\'")}')
from executor import Executor
from pathlib import Path

ex = Executor(Path('${this.workspaceRoot.replace(/'/g, "\\'")}'), dry_run=False)
results = ex.execute_gate_sweep()
print(json.dumps([{"task_id": r.task_id, "status": r.status, "exit_code": r.exit_code} for r in results]))
`);
  }

  /** Get cached scan result. */
  getLastScan(): any {
    return this.lastScan;
  }

  /** Get cached cycle result. */
  getLastCycle(): any {
    return this.lastCycle;
  }

  // ── Internal ─────────────────────────────────────────────────────

  private runPython(script: string): Promise<any> {
    return new Promise((resolve, reject) => {
      execFile(
        this.pythonPath,
        ["-c", script],
        {
          cwd: this.workspaceRoot,
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            const msg = stderr || error.message;
            vscode.window.showErrorMessage(`Alfred error: ${msg.slice(0, 300)}`);
            reject(new Error(msg));
            return;
          }
          try {
            resolve(JSON.parse(stdout.trim()));
          } catch (parseErr) {
            reject(new Error(`Failed to parse Alfred output: ${stdout.slice(0, 200)}`));
          }
        }
      );
    });
  }
}
