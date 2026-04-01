/**
 * Screenshot Diff Engine — Phase 29.5: UI Intelligence Layer
 *
 * Compares current screenshots against baselines using pixelmatch.
 * Produces diff images and mismatch counts.
 *
 * Usage:
 *   const { compare, compareAll, promoteBaseline } = require('./diff');
 *   const result = compare('health-check');        // single compare
 *   const results = compareAll();                   // compare all current vs baseline
 *   promoteBaseline('health-check');                // promote current → baseline
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const BASELINE_DIR = path.join(SCREENSHOTS_DIR, 'baseline');
const CURRENT_DIR = path.join(SCREENSHOTS_DIR, 'current');
const DIFF_DIR = path.join(SCREENSHOTS_DIR, 'diff');

const THRESHOLD = 0.1;

/**
 * Compare a single screenshot against its baseline.
 * @param {string} name — screenshot name without extension
 * @returns {{ name: string, status: string, mismatch: number, diffPath: string|null }}
 */
function compare(name) {
  const baselinePath = path.join(BASELINE_DIR, `${name}.png`);
  const currentPath = path.join(CURRENT_DIR, `${name}.png`);
  const diffPath = path.join(DIFF_DIR, `${name}-diff.png`);

  if (!fs.existsSync(currentPath)) {
    return { name, status: 'missing_current', mismatch: -1, diffPath: null };
  }

  if (!fs.existsSync(baselinePath)) {
    return { name, status: 'no_baseline', mismatch: -1, diffPath: null };
  }

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const current = PNG.sync.read(fs.readFileSync(currentPath));

  // Handle size mismatch — resize to larger dimensions
  const width = Math.max(baseline.width, current.width);
  const height = Math.max(baseline.height, current.height);

  // If dimensions differ, report as full mismatch
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      name,
      status: 'size_mismatch',
      mismatch: width * height,
      diffPath: null,
      baseline_size: `${baseline.width}x${baseline.height}`,
      current_size: `${current.width}x${current.height}`,
    };
  }

  const diff = new PNG({ width, height });

  const mismatch = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold: THRESHOLD }
  );

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    name,
    status: mismatch === 0 ? 'match' : 'diff',
    mismatch,
    diffPath: `screenshots/diff/${name}-diff.png`,
    total_pixels: width * height,
    diff_percent: ((mismatch / (width * height)) * 100).toFixed(2),
  };
}

/**
 * Compare all current screenshots against baselines.
 * @returns {Array<Object>}
 */
function compareAll() {
  const currentFiles = fs.readdirSync(CURRENT_DIR).filter(f => f.endsWith('.png'));
  const results = [];

  for (const file of currentFiles) {
    const name = file.replace('.png', '');
    results.push(compare(name));
  }

  return results;
}

/**
 * Promote current screenshot to baseline (accept as new baseline).
 * @param {string} name — screenshot name without extension
 */
function promoteBaseline(name) {
  const currentPath = path.join(CURRENT_DIR, `${name}.png`);
  const baselinePath = path.join(BASELINE_DIR, `${name}.png`);

  if (!fs.existsSync(currentPath)) {
    throw new Error(`No current screenshot for "${name}"`);
  }

  fs.copyFileSync(currentPath, baselinePath);
}

/**
 * Promote all current screenshots to baselines.
 */
function promoteAllBaselines() {
  const currentFiles = fs.readdirSync(CURRENT_DIR).filter(f => f.endsWith('.png'));
  for (const file of currentFiles) {
    const name = file.replace('.png', '');
    promoteBaseline(name);
  }
  return currentFiles.length;
}

module.exports = { compare, compareAll, promoteBaseline, promoteAllBaselines };
