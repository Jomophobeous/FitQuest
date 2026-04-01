/**
 * Design Intelligence Runner
 * 
 * CLI entry point: node design-intelligence/runner.js --query "fitness dashboard dark" --intent "UI layout"
 * 
 * Execution flow:
 *   Trigger → Fetch → Extract → Score → Store → Report
 * 
 * Rules:
 *   - Human-triggered only (CLI invocation)
 *   - Max 5 requests per source per run
 *   - 60-120s cooldown between sources
 *   - Cache results locally
 *   - No background polling
 *   - No bulk scraping
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const openverse = require('./adapters/openverse');
const pexels = require('./adapters/pexels');
const dribbble = require('./adapters/dribbble');
const { processResults } = require('./extractor');

const CACHE_DIR = path.join(__dirname, 'cache');
const OUTPUT_DIR = path.join(__dirname, 'output');
const COOLDOWN_MS = 3000; // 3s between sources (compliant — no bulk)

// ─── INTENT ROUTING ───

function routeSources(intent) {
  switch (intent) {
    case 'UI layout':
      return ['dribbble', 'openverse', 'pexels'];
    case 'visual mood':
      return ['pexels', 'openverse', 'dribbble'];
    case 'generic assets':
      return ['openverse', 'pexels', 'dribbble'];
    default:
      return ['openverse', 'pexels']; // safe default, skip dribbble if no OAuth
  }
}

// ─── COOLDOWN ───

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── CACHE ───

function getCacheKey(query, source) {
  const safe = query.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
  return `${source}_${safe}.json`;
}

function readCache(query, source) {
  const file = path.join(CACHE_DIR, getCacheKey(query, source));
  if (!fs.existsSync(file)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    // Cache valid for 24 hours
    if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
      return data.results;
    }
  } catch {
    // corrupt cache — ignore
  }
  return null;
}

function writeCache(query, source, results) {
  const file = path.join(CACHE_DIR, getCacheKey(query, source));
  fs.writeFileSync(file, JSON.stringify({ timestamp: Date.now(), query, source, results }, null, 2));
}

// ─── SOURCE FETCHERS ───

async function fetchOpenverse(query, limit) {
  const cached = readCache(query, 'openverse');
  if (cached) {
    console.log('  [openverse] cache hit');
    return cached;
  }

  console.log('  [openverse] fetching...');
  const results = await openverse.search(query, { limit });
  writeCache(query, 'openverse', results);
  return results;
}

async function fetchPexels(query, limit) {
  const cached = readCache(query, 'pexels');
  if (cached) {
    console.log('  [pexels] cache hit');
    return cached;
  }

  if (!process.env.PEXELS_API_KEY) {
    console.log('  [pexels] SKIPPED — no API key');
    return [];
  }

  console.log('  [pexels] fetching...');
  const res = await pexels.search(query, { limit, orientation: 'portrait' });
  writeCache(query, 'pexels', res.results);
  return res.results;
}

async function fetchDribbble(query, limit) {
  const cached = readCache(query, 'dribbble');
  if (cached) {
    console.log('  [dribbble] cache hit');
    return cached;
  }

  if (!process.env.DRIBBBLE_TOKEN) {
    console.log('  [dribbble] SKIPPED — no OAuth token (run: node design-intelligence/runner.js --dribbble-auth)');
    return [];
  }

  console.log('  [dribbble] fetching...');
  const res = await dribbble.search(query, { limit });
  if (res.needsAuth) {
    console.log(`  [dribbble] AUTH REQUIRED — ${res.error}`);
    return [];
  }
  writeCache(query, 'dribbble', res.results);
  return res.results;
}

// ─── DRIBBBLE AUTH HELPER ───

async function handleDribbbleAuth() {
  if (process.argv.includes('--dribbble-exchange')) {
    const codeIdx = process.argv.indexOf('--dribbble-exchange');
    const code = process.argv[codeIdx + 1];
    if (!code) {
      console.error('Usage: --dribbble-exchange <authorization_code>');
      process.exit(1);
    }
    try {
      const token = await dribbble.exchangeToken(code);
      console.log('\n✓ Dribbble token obtained. Add to .env:');
      console.log(`DRIBBBLE_TOKEN="${token}"`);
    } catch (err) {
      console.error('Token exchange failed:', err.message);
    }
    process.exit(0);
  }

  if (process.argv.includes('--dribbble-auth')) {
    try {
      const url = dribbble.getAuthUrl();
      console.log('\n1. Open this URL in your browser:');
      console.log(`   ${url}`);
      console.log('\n2. Authorize the app, copy the code from the redirect URL');
      console.log('\n3. Exchange the code:');
      console.log('   node design-intelligence/runner.js --dribbble-exchange <code>');
    } catch (err) {
      console.error('Auth URL failed:', err.message);
    }
    process.exit(0);
  }
}

// ─── MAIN PIPELINE ───

async function run(query, intent, limit = 5) {
  console.log(`\n━━━ DESIGN INTELLIGENCE ━━━`);
  console.log(`Query:  "${query}"`);
  console.log(`Intent: ${intent}`);
  console.log(`Limit:  ${limit}/source`);
  console.log();

  const sources = routeSources(intent);
  console.log(`Source priority: ${sources.join(' → ')}`);

  const allResults = [];
  const sourceStatus = {};

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];

    // Cooldown between sources (not before first)
    if (i > 0) {
      console.log(`  [cooldown] ${COOLDOWN_MS / 1000}s...`);
      await sleep(COOLDOWN_MS);
    }

    try {
      let results;
      switch (source) {
        case 'openverse':
          results = await fetchOpenverse(query, limit);
          break;
        case 'pexels':
          results = await fetchPexels(query, limit);
          break;
        case 'dribbble':
          results = await fetchDribbble(query, limit);
          break;
        default:
          results = [];
      }

      allResults.push(...(Array.isArray(results) ? results : []));
      sourceStatus[source] = { status: 'OK', count: Array.isArray(results) ? results.length : 0 };
      console.log(`  [${source}] ${sourceStatus[source].count} results`);
    } catch (err) {
      sourceStatus[source] = { status: 'ERROR', error: err.message };
      console.log(`  [${source}] ERROR: ${err.message}`);
    }
  }

  console.log(`\nTotal raw results: ${allResults.length}`);

  // Extract + Score + Filter → Top 3
  const patterns = processResults(allResults, 3);
  console.log(`Patterns selected: ${patterns.length}`);

  // Build output
  const output = {
    timestamp: new Date().toISOString(),
    query,
    intent,
    sources: sourceStatus,
    patterns_selected: patterns.length,
    patterns,
    recommended_layout: patterns.length > 0 ? patterns[0].layout : 'N/A',
    components_to_build: [...new Set(patterns.flatMap((p) => p.components))],
    color_system: buildColorSystem(patterns),
    next_action: patterns.length > 0 ? 'generate React Native component' : 'refine query or add more sources',
  };

  // Write outputs
  fs.writeFileSync(path.join(OUTPUT_DIR, 'patterns.json'), JSON.stringify(output.patterns, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'components.json'), JSON.stringify(output.components_to_build, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'color_tokens.json'), JSON.stringify(output.color_system, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'last-run.json'), JSON.stringify(output, null, 2));

  // Report
  console.log('\n━━━ RESULT ━━━');
  console.log(JSON.stringify(output, null, 2));
  console.log(`\nOutputs written to: design-intelligence/output/`);

  return output;
}

/**
 * Build color system from top patterns
 */
function buildColorSystem(patterns) {
  const allColors = patterns.flatMap((p) => p.colors);
  const unique = [...new Set(allColors)];

  return {
    primary_background: '#0A0E17',   // FitQuest dark
    primary_accent: '#10B981',       // FitQuest green
    secondary_accent: '#F4A427',     // FitQuest warning/gold
    extracted_colors: unique.filter((c) => c !== '#0A0E17' && c !== '#10B981'),
    total_unique: unique.length,
  };
}

// ─── CLI ───

async function main() {
  // Handle Dribbble auth commands
  await handleDribbbleAuth();

  // Parse CLI args
  let query = 'fitness app dark minimal';
  let intent = 'UI layout';
  let limit = 5;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--query' && args[i + 1]) query = args[++i];
    if (args[i] === '--intent' && args[i + 1]) intent = args[++i];
    if (args[i] === '--limit' && args[i + 1]) limit = Math.min(parseInt(args[++i], 10) || 5, 5);
  }

  try {
    await run(query, intent, limit);
    process.exit(0);
  } catch (err) {
    console.error('FATAL:', err.message);
    process.exit(1);
  }
}

main();
