"use strict";
/**
 * Alfred Runner — Python process bridge.
 *
 * Spawns the Alfred Python runtime as a subprocess and parses JSON output.
 * All communication is one-shot (no long-lived process).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlfredRunner = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
class AlfredRunner {
    constructor(workspaceRoot, _context) {
        this.lastScan = null;
        this.lastCycle = null;
        this.workspaceRoot = workspaceRoot;
        this.alfredDir = path.join(workspaceRoot, "agents", "alfred");
        // Prefer workspace .venv, fall back to system Python
        this.pythonPath = path.join(workspaceRoot, ".venv", "bin", "python");
    }
    /** Run a repository scan and return summary metrics. */
    async scan() {
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
    async runCycle(dryRun) {
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
    async autofix(dryRun) {
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
    async gatesSweep() {
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
    getLastScan() {
        return this.lastScan;
    }
    /** Get cached cycle result. */
    getLastCycle() {
        return this.lastCycle;
    }
    // ── Internal ─────────────────────────────────────────────────────
    runPython(script) {
        return new Promise((resolve, reject) => {
            (0, child_process_1.execFile)(this.pythonPath, ["-c", script], {
                cwd: this.workspaceRoot,
                timeout: 60_000,
                maxBuffer: 1024 * 1024,
            }, (error, stdout, stderr) => {
                if (error) {
                    const msg = stderr || error.message;
                    vscode.window.showErrorMessage(`Alfred error: ${msg.slice(0, 300)}`);
                    reject(new Error(msg));
                    return;
                }
                try {
                    resolve(JSON.parse(stdout.trim()));
                }
                catch (parseErr) {
                    reject(new Error(`Failed to parse Alfred output: ${stdout.slice(0, 200)}`));
                }
            });
        });
    }
}
exports.AlfredRunner = AlfredRunner;
//# sourceMappingURL=runner.js.map