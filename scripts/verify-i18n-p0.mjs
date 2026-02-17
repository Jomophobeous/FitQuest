#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const files = [
  'app/dashboard.tsx',
  'app/fitquest.tsx',
  'app/login.tsx',
  'app/meal-prep.tsx',
  'app/move.tsx',
  'app/profile.tsx',
  'app/legal-center.tsx',
  'app/privacy-policy.tsx',
  'app/terms-of-service.tsx',
];

const allowExact = new Set([
  'FitQuest',
  'XP',
  'LVL',
]);

const findings = [];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const content = readFileSync(abs, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    const jsxTextRegex = /<([A-Za-z][\w.]*)[^>]*>([^<{]*[A-Za-z][^<{]*)<\//g;
    for (const m of line.matchAll(jsxTextRegex)) {
      const tag = (m[1] || '').trim();
      const text = (m[2] || '').trim();
      if (!tag || !text) continue;
      if (text.includes('&&') || text.includes('||')) continue;
      if (text.includes('=>')) continue;
      if (text.includes('Pick')) continue;
      if (text.includes(',')) continue;
      if (allowExact.has(text)) continue;
      if (text.startsWith('•')) continue;
      findings.push({ file: rel, line: lineNo, kind: 'JSX text', value: text });
    }

    const attrRegex = /(placeholder|title|label|subtitle|sublabel)="([^"]*[A-Za-z][^"]*)"/g;
    for (const m of line.matchAll(attrRegex)) {
      const value = (m[2] || '').trim();
      if (!value || allowExact.has(value)) continue;
      findings.push({ file: rel, line: lineNo, kind: `${m[1]} literal`, value });
    }

    const alertLiteralRegex = /Alert\.alert\(\s*'([^']*[A-Za-z][^']*)'|Alert\.alert\(\s*"([^"]*[A-Za-z][^"]*)"/g;
    for (const m of line.matchAll(alertLiteralRegex)) {
      const value = (m[1] || m[2] || '').trim();
      if (!value) continue;
      findings.push({ file: rel, line: lineNo, kind: 'Alert literal', value });
    }
  });
}

if (findings.length > 0) {
  console.error('❌ i18n P0 gate failed: hardcoded user-facing literals found in critical routes.');
  for (const f of findings.slice(0, 200)) {
    console.error(`- ${f.file}:${f.line} [${f.kind}] ${f.value}`);
  }
  process.exit(1);
}

console.log('✅ i18n P0 gate passed for critical routes.');
