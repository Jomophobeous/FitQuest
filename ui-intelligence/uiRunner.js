/**
 * UI Runner — Phase 29.5: UI Intelligence Layer
 *
 * Core execution engine for UI flows.
 * Runs Playwright flows, captures screenshots, produces structured results.
 *
 * Usage:
 *   node uiRunner.js                    — run all flows
 *   node uiRunner.js onboarding         — run single flow
 *   node uiRunner.js --diff             — run all + diff against baseline
 *
 * Env:
 *   UI_TEST_BASE_URL  — target URL to test (default: http://localhost:8081)
 *   PLAYWRIGHT_TIMEOUT — override default timeout (ms)
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { firefox } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('./playwright.config');

const BASE_URL = process.env.UI_TEST_BASE_URL || 'http://localhost:8081';
const FLOWS_DIR = path.join(__dirname, 'flows');
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const RESULTS_FILE = path.join(__dirname, 'last-run.json');

// ── Flow executor ──

async function runFlow(flow, options = {}) {
  const { browser: sharedBrowser, verbose = true } = options;
  const ownBrowser = !sharedBrowser;
  const browser = sharedBrowser || await firefox.launch({ headless: config.use.headless });
  const context = await browser.newContext({
    viewport: config.use.viewport,
    userAgent: 'FitQuest-UIIntelligence/1.0 (Playwright; Firefox)',
  });
  const page = await context.newPage();

  const result = {
    flow: flow.name,
    status: 'pass',
    steps_executed: 0,
    steps_total: flow.steps.length,
    diff_pixels: null,
    screenshot_path: null,
    error: null,
    duration_ms: 0,
    timestamp: new Date().toISOString(),
  };

  const start = Date.now();

  try {
    const targetUrl = flow.url || BASE_URL;
    if (verbose) console.log(`  → Navigating to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: config.use.navigationTimeout });

    for (const step of flow.steps) {
      try {
        await executeStep(page, step, verbose);
        result.steps_executed++;
      } catch (stepErr) {
        result.status = 'fail';
        result.error = `Step ${result.steps_executed + 1} (${step.type}): ${stepErr.message}`;
        if (verbose) console.log(`  ❌ Step failed: ${stepErr.message}`);
        break;
      }
    }

    // Capture screenshot
    const screenshotName = `${flow.name}.png`;
    const screenshotPath = path.join(SCREENSHOTS_DIR, 'current', screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: flow.fullPage !== false });
    result.screenshot_path = `screenshots/current/${screenshotName}`;
    if (verbose) console.log(`  📸 Screenshot saved: ${result.screenshot_path}`);

  } catch (err) {
    result.status = 'fail';
    result.error = err.message;
    if (verbose) console.log(`  ❌ Flow error: ${err.message}`);
  } finally {
    result.duration_ms = Date.now() - start;
    await context.close();
    if (ownBrowser) await browser.close();
  }

  return result;
}

// ── Step executor ──

async function executeStep(page, step, verbose) {
  switch (step.type) {
    case 'click':
      if (verbose) console.log(`    click: ${step.selector}`);
      await page.click(step.selector, { timeout: step.timeout || config.use.actionTimeout });
      break;

    case 'input':
    case 'fill':
      if (verbose) console.log(`    fill: ${step.selector} → "${step.value?.slice(0, 20)}..."`);
      await page.fill(step.selector, step.value || '', { timeout: step.timeout || config.use.actionTimeout });
      break;

    case 'wait':
      if (verbose) console.log(`    wait: ${step.ms}ms`);
      await page.waitForTimeout(step.ms || 1000);
      break;

    case 'waitForSelector':
      if (verbose) console.log(`    waitFor: ${step.selector}`);
      await page.waitForSelector(step.selector, { timeout: step.timeout || config.use.actionTimeout });
      break;

    case 'scroll':
      if (verbose) console.log(`    scroll: ${step.direction || 'down'} ${step.amount || 300}px`);
      await page.evaluate(({ direction, amount }) => {
        window.scrollBy(0, direction === 'up' ? -amount : amount);
      }, { direction: step.direction || 'down', amount: step.amount || 300 });
      break;

    case 'screenshot':
      if (verbose) console.log(`    screenshot: ${step.name}`);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'current', `${step.name}.png`),
        fullPage: step.fullPage !== false,
      });
      break;

    case 'assert_visible':
      if (verbose) console.log(`    assert visible: ${step.selector}`);
      await page.waitForSelector(step.selector, { state: 'visible', timeout: step.timeout || 5000 });
      break;

    case 'assert_text':
      if (verbose) console.log(`    assert text: "${step.text}" in ${step.selector || 'page'}`);
      if (step.selector) {
        const el = await page.$(step.selector);
        if (!el) throw new Error(`Element ${step.selector} not found`);
        const text = await el.textContent();
        if (!text?.includes(step.text)) throw new Error(`Text "${step.text}" not found in ${step.selector}`);
      } else {
        const content = await page.textContent('body');
        if (!content?.includes(step.text)) throw new Error(`Text "${step.text}" not found on page`);
      }
      break;

    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

// ── Load flows ──

function loadFlows(filterName) {
  const files = fs.readdirSync(FLOWS_DIR).filter(f => f.endsWith('.json'));
  const flows = [];

  for (const file of files) {
    const flow = JSON.parse(fs.readFileSync(path.join(FLOWS_DIR, file), 'utf-8'));
    if (filterName && flow.name !== filterName) continue;
    flows.push(flow);
  }

  return flows;
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);
  const doDiff = args.includes('--diff');
  const flowFilter = args.find(a => !a.startsWith('--')) || null;

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  UI Intelligence — Flow Runner               ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Target: ${BASE_URL}`);
  console.log(`║  Filter: ${flowFilter || 'all flows'}`);
  console.log(`║  Diff: ${doDiff}`);
  console.log('╚══════════════════════════════════════════════╝');

  const flows = loadFlows(flowFilter);
  if (flows.length === 0) {
    console.log('⚠️  No flows found in', FLOWS_DIR);
    process.exit(0);
  }

  const browser = await firefox.launch({ headless: config.use.headless });
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const flow of flows) {
    console.log(`\n── Flow: ${flow.name} ──`);
    const result = await runFlow(flow, { browser, verbose: true });
    results.push(result);

    if (result.status === 'pass') {
      passed++;
      console.log(`  ✅ PASS (${result.duration_ms}ms)`);
    } else {
      failed++;
      console.log(`  ❌ FAIL: ${result.error}`);
    }
  }

  await browser.close();

  // Run diff if requested
  if (doDiff) {
    try {
      const { compareAll } = require('./diff');
      console.log('\n── Visual Diff ──');
      const diffResults = compareAll();
      for (const d of diffResults) {
        const r = results.find(r => r.flow === d.name);
        if (r) r.diff_pixels = d.mismatch;
        const status = d.mismatch === 0 ? '✅' : d.mismatch < 100 ? '⚠️' : '❌';
        console.log(`  ${status} ${d.name}: ${d.mismatch} pixels differ`);
      }
    } catch (diffErr) {
      console.log(`  ⚠️ Diff skipped: ${diffErr.message}`);
    }
  }

  // Write results
  const summary = {
    timestamp: new Date().toISOString(),
    base_url: BASE_URL,
    total_flows: flows.length,
    passed,
    failed,
    results,
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  Results: ${passed} passed, ${failed} failed (${flows.length} total)`);
  console.log(`╚══════════════════════════════════════════════╝`);

  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { runFlow, loadFlows, executeStep };
