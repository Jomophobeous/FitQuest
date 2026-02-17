"use strict";
/**
 * Alfred VS Code Extension — Phase 4
 *
 * Provides editor-integrated access to Alfred's autonomous agent runtime:
 * - Sidebar panels showing health score, task queue, and scan signals
 * - Commands for scan, cycle, auto-fix, and gate sweep
 * - Status bar indicator with live health score
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const runner_1 = require("./runner");
const views_1 = require("./views");
let runner;
let statusBarItem;
function activate(context) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showWarningMessage("Alfred: No workspace folder open");
        return;
    }
    runner = new runner_1.AlfredRunner(workspaceRoot, context);
    // ── Status Bar ─────────────────────────────────────────────────
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBarItem.command = "alfred.showHealth";
    statusBarItem.text = "$(robot) Alfred";
    statusBarItem.tooltip = "Alfred Agent — Click for health score";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // ── Tree View Providers ────────────────────────────────────────
    const healthProvider = new views_1.HealthViewProvider(runner);
    const tasksProvider = new views_1.TasksViewProvider(runner);
    const signalsProvider = new views_1.SignalsViewProvider(runner);
    context.subscriptions.push(vscode.window.registerTreeDataProvider("alfred.healthView", healthProvider), vscode.window.registerTreeDataProvider("alfred.tasksView", tasksProvider), vscode.window.registerTreeDataProvider("alfred.signalsView", signalsProvider));
    // ── Commands ───────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand("alfred.scan", async () => {
        await runWithProgress("Scanning repository...", async () => {
            const result = await runner.scan();
            updateStatusBar(result);
            healthProvider.refresh();
            signalsProvider.refresh();
            vscode.window.showInformationMessage(`Alfred scan complete: ${result.file_count} files, ` +
                `${result.rn_crash_risks} crash risks, ` +
                `${result.theme_violations} theme violations`);
        });
    }), vscode.commands.registerCommand("alfred.runCycle", async () => {
        await runWithProgress("Running Alfred cycle (dry-run)...", async () => {
            const result = await runner.runCycle(true);
            updateStatusBar(result.scan_summary);
            healthProvider.refresh();
            tasksProvider.refresh();
            signalsProvider.refresh();
            const eval_ = result.evaluation;
            vscode.window.showInformationMessage(`Alfred cycle complete: Health ${eval_.health_score}/100 (${eval_.verdict})`);
        });
    }), vscode.commands.registerCommand("alfred.runCycleLive", async () => {
        const confirm = await vscode.window.showWarningMessage("Run Alfred in LIVE mode? This will execute real commands.", { modal: true }, "Run Live");
        if (confirm !== "Run Live") {
            return;
        }
        await runWithProgress("Running Alfred cycle (LIVE)...", async () => {
            const result = await runner.runCycle(false);
            updateStatusBar(result.scan_summary);
            healthProvider.refresh();
            tasksProvider.refresh();
            signalsProvider.refresh();
            const eval_ = result.evaluation;
            vscode.window.showInformationMessage(`Alfred LIVE cycle complete: Health ${eval_.health_score}/100 (${eval_.verdict})`);
        });
    }), vscode.commands.registerCommand("alfred.autofix", async () => {
        const confirm = await vscode.window.showWarningMessage("Run Alfred auto-fix? This will modify source files.", { modal: true }, "Auto-Fix");
        if (confirm !== "Auto-Fix") {
            return;
        }
        await runWithProgress("Running auto-fix...", async () => {
            const result = await runner.autofix(false);
            healthProvider.refresh();
            signalsProvider.refresh();
            vscode.window.showInformationMessage(`Alfred auto-fix: ${result.total_fixes} fixes applied`);
        });
    }), vscode.commands.registerCommand("alfred.autofixPreview", async () => {
        await runWithProgress("Previewing auto-fix...", async () => {
            const result = await runner.autofix(true);
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(result, null, 2),
                language: "json",
            });
            await vscode.window.showTextDocument(doc);
        });
    }), vscode.commands.registerCommand("alfred.gatesSweep", async () => {
        await runWithProgress("Running verification gates...", async () => {
            const result = await runner.gatesSweep();
            const passed = result.filter((r) => r.status === "done").length;
            const total = result.length;
            vscode.window.showInformationMessage(`Alfred gates: ${passed}/${total} passed`);
        });
    }), vscode.commands.registerCommand("alfred.showHealth", async () => {
        const result = await runner.scan();
        updateStatusBar(result);
        healthProvider.refresh();
        signalsProvider.refresh();
        const score = computeHealth(result);
        const panel = vscode.window.createWebviewPanel("alfredHealth", "Alfred Health Report", vscode.ViewColumn.One, {});
        panel.webview.html = generateHealthHtml(score, result);
    }), vscode.commands.registerCommand("alfred.showMemory", async () => {
        const memoryPath = vscode.Uri.file(`${workspaceRoot}/agents/alfred/state/memory.json`);
        try {
            const doc = await vscode.workspace.openTextDocument(memoryPath);
            await vscode.window.showTextDocument(doc);
        }
        catch {
            vscode.window.showWarningMessage("No Alfred memory state found");
        }
    }));
    // Initial scan on activation
    runner.scan().then((result) => {
        updateStatusBar(result);
        healthProvider.refresh();
        signalsProvider.refresh();
    }).catch(() => {
        // Silent fail on initial scan
    });
}
function deactivate() {
    // Cleanup handled by disposables
}
// ── Helpers ──────────────────────────────────────────────────────────
async function runWithProgress(title, task) {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: false }, task);
}
function computeHealth(scan) {
    let score = 100;
    score -= Math.min(40, (scan.rn_crash_risks ?? 0) * 15);
    score -= Math.min(20, (scan.broken_flows ?? 0) * 10);
    score -= Math.min(10, scan.theme_violations ?? 0);
    score -= Math.min(15, (scan.tech_debt_items ?? 0) * 5);
    return Math.max(0, score);
}
function updateStatusBar(scan) {
    const score = computeHealth(scan);
    const icon = score >= 85 ? "$(check)" : score >= 50 ? "$(warning)" : "$(error)";
    statusBarItem.text = `${icon} Alfred ${score}/100`;
    statusBarItem.tooltip = `Health: ${score}/100 | Crash risks: ${scan.rn_crash_risks ?? 0} | Theme: ${scan.theme_violations ?? 0}`;
}
function generateHealthHtml(score, scan) {
    const color = score >= 85 ? "#10B981" : score >= 50 ? "#F4A427" : "#EF4444";
    const verdict = score >= 85 ? "HEALTHY" : score >= 50 ? "NEEDS_WORK" : "CRITICAL";
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; background: #0A0E17; color: #F5F7FB; }
    .score { font-size: 72px; font-weight: 900; color: ${color}; text-align: center; margin: 32px 0 8px; }
    .verdict { font-size: 18px; text-align: center; color: ${color}; letter-spacing: 2px; margin-bottom: 32px; }
    .signals { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 500px; margin: 0 auto; }
    .signal { background: #121820; border-radius: 12px; padding: 16px; }
    .signal-label { font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; }
    .signal-value { font-size: 28px; font-weight: 700; margin-top: 4px; }
    .good { color: #10B981; }
    .bad { color: #EF4444; }
  </style>
</head>
<body>
  <div class="score">${score}</div>
  <div class="verdict">${verdict}</div>
  <div class="signals">
    <div class="signal">
      <div class="signal-label">Crash Risks</div>
      <div class="signal-value ${scan.rn_crash_risks === 0 ? "good" : "bad"}">${scan.rn_crash_risks ?? 0}</div>
    </div>
    <div class="signal">
      <div class="signal-label">Theme Violations</div>
      <div class="signal-value ${scan.theme_violations === 0 ? "good" : "bad"}">${scan.theme_violations ?? 0}</div>
    </div>
    <div class="signal">
      <div class="signal-label">Broken Flows</div>
      <div class="signal-value ${scan.broken_flows === 0 ? "good" : "bad"}">${scan.broken_flows ?? 0}</div>
    </div>
    <div class="signal">
      <div class="signal-label">Tech Debt</div>
      <div class="signal-value ${scan.tech_debt_items === 0 ? "good" : "bad"}">${scan.tech_debt_items ?? 0}</div>
    </div>
    <div class="signal">
      <div class="signal-label">Files Scanned</div>
      <div class="signal-value good">${scan.file_count ?? 0}</div>
    </div>
    <div class="signal">
      <div class="signal-label">Gates Present</div>
      <div class="signal-value ${scan.gates_all_present ? "good" : "bad"}">${scan.gates_all_present ? "YES" : "NO"}</div>
    </div>
  </div>
</body>
</html>`;
}
//# sourceMappingURL=extension.js.map