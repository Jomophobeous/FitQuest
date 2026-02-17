#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const requiredFiles = [
  'reports/responsive-qa-matrix.md',
  'reports/ops/phased-rollout-plan.md',
  'reports/ops/rollback-runbook.md',
  'reports/ops/older-device-sweep.md',
  'reports/ops/rollout-execution-log.md',
  '.github/ISSUE_TEMPLATE/feature-request.yml',
];

const missing = requiredFiles.filter((rel) => !existsSync(path.join(ROOT, rel)));
if (missing.length > 0) {
  console.error('❌ Ops readiness gate failed: missing required operational artifacts.');
  missing.forEach((rel) => console.error(`- ${rel}`));
  process.exit(1);
}

const rollout = readFileSync(path.join(ROOT, 'reports/ops/phased-rollout-plan.md'), 'utf8');
const rollback = readFileSync(path.join(ROOT, 'reports/ops/rollback-runbook.md'), 'utf8');
const olderSweep = readFileSync(path.join(ROOT, 'reports/ops/older-device-sweep.md'), 'utf8');
const rolloutExecution = readFileSync(path.join(ROOT, 'reports/ops/rollout-execution-log.md'), 'utf8');

const rolloutChecks = ['Stop Conditions', 'Stages', 'Entry Criteria'];
const rollbackChecks = ['Trigger Conditions', 'Rollback Procedure', 'Verification Checklist'];

const missingSections = [
  ...rolloutChecks.filter((s) => !rollout.includes(s)).map((s) => `phased-rollout-plan.md missing section: ${s}`),
  ...rollbackChecks.filter((s) => !rollback.includes(s)).map((s) => `rollback-runbook.md missing section: ${s}`),
];

if (!olderSweep.includes('Execution Evidence')) {
  missingSections.push('older-device-sweep.md missing section: Execution Evidence');
}

if (!rolloutExecution.includes('Stage Outcomes')) {
  missingSections.push('rollout-execution-log.md missing section: Stage Outcomes');
}

const evidenceRows = olderSweep
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('|') && !line.includes('---'))
  .filter((line) => /(PASS|FAIL|BLOCKED)/.test(line));

if (evidenceRows.length === 0) {
  missingSections.push('older-device-sweep.md missing executed evidence row with PASS/FAIL/BLOCKED status');
}

const rolloutRows = rolloutExecution
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('|') && !line.includes('---'))
  .filter((line) => /(PASS|FAIL|BLOCKED)/.test(line));

if (rolloutRows.length === 0) {
  missingSections.push('rollout-execution-log.md missing stage outcome evidence row with PASS/FAIL/BLOCKED status');
}

if (missingSections.length > 0) {
  console.error('❌ Ops readiness gate failed: required sections not found.');
  missingSections.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('✅ Ops readiness gate passed.');
