import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const FOOD_DB_PATH = path.join(ROOT, 'src', 'services', 'foodDatabase.ts');

const EXPECTED_TOTAL = 861;
const EXPECTED_COUNTS = {
  AU: 85,
  ZA: 90,
  EE: 85,
  SA: 85,
  NA: 85,
  MAF: 88,
  EME: 85,
  AS: 88,
  PAC: 85,
  CAS: 85,
};

const REQUIRED_REGIONS = Object.keys(EXPECTED_COUNTS);
const MIN_PER_REGION = 80;

function parseFoodArray(tsSource) {
  const match = tsSource.match(
    /export\s+const\s+REGIONAL_FOOD_DATABASE:\s*RegionalFoodItem\[\]\s*=\s*([\s\S]*?);\s*$/
  );

  if (!match) {
    throw new Error('Could not find REGIONAL_FOOD_DATABASE export');
  }

  return JSON.parse(match[1]);
}

function countByRegion(items) {
  const counts = {};
  for (const item of items) {
    const region = item?.available_regions?.[0];
    if (!region) continue;
    counts[region] = (counts[region] || 0) + 1;
  }
  return counts;
}

function findDuplicateRegionNameKeys(items) {
  const seen = new Set();
  const duplicates = [];

  for (const item of items) {
    const region = item?.available_regions?.[0];
    const name = String(item?.name || '').trim().toLowerCase();
    if (!region || !name) continue;

    const key = `${region}|${name}`;
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }

  return duplicates;
}

function printCheck(ok, label, detail = '') {
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('FitQuest Food DB verification');
  console.log('============================');

  const raw = await fs.readFile(FOOD_DB_PATH, 'utf8');
  const foods = parseFoodArray(raw);
  const counts = countByRegion(foods);
  const duplicates = findDuplicateRegionNameKeys(foods);

  let failed = false;

  printCheck(Array.isArray(foods), 'database.parsed', `${foods.length} items`);

  const totalMatches = foods.length === EXPECTED_TOTAL;
  printCheck(totalMatches, 'database.total', `${foods.length}/${EXPECTED_TOTAL}`);
  if (!totalMatches) failed = true;

  for (const region of REQUIRED_REGIONS) {
    const actual = counts[region] || 0;
    const expected = EXPECTED_COUNTS[region];
    const meetsMin = actual >= MIN_PER_REGION;
    const matchesExpected = actual === expected;

    printCheck(meetsMin, `region.${region}.min`, `${actual} (min ${MIN_PER_REGION})`);
    printCheck(matchesExpected, `region.${region}.exact`, `${actual}/${expected}`);

    if (!meetsMin || !matchesExpected) failed = true;
  }

  const noUnexpectedRegions = Object.keys(counts).every((region) => REQUIRED_REGIONS.includes(region));
  printCheck(noUnexpectedRegions, 'region.set', Object.keys(counts).sort().join(', '));
  if (!noUnexpectedRegions) failed = true;

  const noDuplicates = duplicates.length === 0;
  printCheck(noDuplicates, 'region_name.duplicates', noDuplicates ? 'none' : `${duplicates.length} found`);
  if (!noDuplicates) failed = true;

  if (failed) {
    throw new Error('Food DB verification failed');
  }

  console.log('\n✅ Food DB verification passed');
}

main().catch((error) => {
  console.error(`\n❌ ${error.message}`);
  process.exit(1);
});
