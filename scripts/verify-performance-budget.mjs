#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT = path.join(ROOT, 'reports', 'ml-benchmark-lite.md');

const thresholds = {
  'vector dot product (512 dims)': 0.010,
  'token scoring (intent-like)': 0.005,
};

function parseRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const parts = line.split('|').map((x) => x.trim()).filter(Boolean);
    if (parts.length !== 4) continue;
    if (parts[0] === 'Operation' || parts[0] === '---') continue;
    const avg = Number(parts[3]);
    if (!Number.isFinite(avg)) continue;
    rows.push({ operation: parts[0], avgMs: avg });
  }
  return rows;
}

let markdown;
try {
  markdown = readFileSync(REPORT, 'utf8');
} catch {
  console.error('❌ Performance budget gate failed: missing reports/ml-benchmark-lite.md');
  process.exit(1);
}

const rows = parseRows(markdown);
const failures = [];
for (const [operation, maxAvgMs] of Object.entries(thresholds)) {
  const row = rows.find((r) => r.operation === operation);
  if (!row) {
    failures.push(`Missing benchmark row: ${operation}`);
    continue;
  }
  if (row.avgMs > maxAvgMs) {
    failures.push(`Budget exceeded for ${operation}: avg ${row.avgMs}ms > ${maxAvgMs}ms`);
  }
}

if (failures.length > 0) {
  console.error('❌ Performance budget gate failed.');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log('✅ Performance budget gate passed.');
