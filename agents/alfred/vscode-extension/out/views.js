"use strict";
/**
 * Alfred Sidebar Tree View Providers.
 *
 * Three panels in the Alfred sidebar:
 * 1. HealthView  — shows overall health score and verdict
 * 2. TasksView   — shows items in the task queue
 * 3. SignalsView  — shows individual scanner signals
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
exports.SignalsViewProvider = exports.TasksViewProvider = exports.HealthViewProvider = void 0;
const vscode = __importStar(require("vscode"));
// ── Health View ──────────────────────────────────────────────────────
class HealthViewProvider {
    constructor(runner) {
        this.runner = runner;
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChange.event;
    }
    refresh() {
        this._onDidChange.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren() {
        const scan = this.runner.getLastScan();
        if (!scan) {
            const item = new vscode.TreeItem("Run a scan to see health", vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon("info");
            return [item];
        }
        const score = computeScore(scan);
        const verdict = score >= 85 ? "HEALTHY" : score >= 50 ? "NEEDS_WORK" : "CRITICAL";
        const icon = score >= 85 ? "pass" : score >= 50 ? "warning" : "error";
        const scoreItem = new vscode.TreeItem(`${score}/100 — ${verdict}`, vscode.TreeItemCollapsibleState.None);
        scoreItem.iconPath = new vscode.ThemeIcon(icon);
        scoreItem.description = `${scan.file_count} files scanned`;
        return [scoreItem];
    }
}
exports.HealthViewProvider = HealthViewProvider;
// ── Tasks View ───────────────────────────────────────────────────────
class TasksViewProvider {
    constructor(runner) {
        this.runner = runner;
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChange.event;
    }
    refresh() {
        this._onDidChange.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren() {
        const cycle = this.runner.getLastCycle();
        if (!cycle) {
            const item = new vscode.TreeItem("Run a cycle to see tasks", vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon("info");
            return [item];
        }
        const items = [];
        if (cycle.executed_task) {
            const task = cycle.executed_task;
            const statusIcon = cycle.execution?.status === "done" ? "pass" :
                cycle.execution?.status === "simulated" ? "eye" : "error";
            const item = new vscode.TreeItem(task.title, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon(statusIcon);
            item.description = `[${cycle.execution?.status}] ${task.description?.slice(0, 80)}`;
            items.push(item);
        }
        const pending = new vscode.TreeItem(`${cycle.remaining_pending} tasks pending`, vscode.TreeItemCollapsibleState.None);
        pending.iconPath = new vscode.ThemeIcon("tasklist");
        items.push(pending);
        return items;
    }
}
exports.TasksViewProvider = TasksViewProvider;
// ── Signals View ─────────────────────────────────────────────────────
class SignalsViewProvider {
    constructor(runner) {
        this.runner = runner;
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChange.event;
    }
    refresh() {
        this._onDidChange.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren() {
        const scan = this.runner.getLastScan();
        if (!scan) {
            const item = new vscode.TreeItem("Run a scan to see signals", vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon("info");
            return [item];
        }
        const signals = [
            { label: "Crash Risks", value: scan.rn_crash_risks ?? 0, good: 0 },
            { label: "Theme Violations", value: scan.theme_violations ?? 0, good: 0 },
            { label: "Broken Flows", value: scan.broken_flows ?? 0, good: 0 },
            { label: "Tech Debt", value: scan.tech_debt_items ?? 0, good: 0 },
            { label: "TODO/FIXME", value: scan.todo_markers ?? 0, good: -1 },
            { label: "Gates Present", value: scan.gates_all_present ? "YES" : "NO", good: -1 },
        ];
        return signals.map((sig) => {
            const isGood = sig.good === -1 ? true : sig.value === sig.good;
            const icon = isGood ? "pass" : "error";
            const item = new vscode.TreeItem(sig.label, vscode.TreeItemCollapsibleState.None);
            item.iconPath = new vscode.ThemeIcon(icon);
            item.description = String(sig.value);
            return item;
        });
    }
}
exports.SignalsViewProvider = SignalsViewProvider;
// ── Helpers ──────────────────────────────────────────────────────────
function computeScore(scan) {
    let score = 100;
    score -= Math.min(40, (scan.rn_crash_risks ?? 0) * 15);
    score -= Math.min(20, (scan.broken_flows ?? 0) * 10);
    score -= Math.min(10, scan.theme_violations ?? 0);
    score -= Math.min(15, (scan.tech_debt_items ?? 0) * 5);
    return Math.max(0, score);
}
//# sourceMappingURL=views.js.map