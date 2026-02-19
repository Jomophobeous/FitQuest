#!/usr/bin/env node
/**
 * Phase 2 import wrapper
 * Single source of truth lives in scripts/import-external-exercises.ts
 */

const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.resolve(__dirname, 'import-external-exercises.ts');
const args = process.argv.slice(2);

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['ts-node', scriptPath, ...args],
  { stdio: 'inherit' }
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
