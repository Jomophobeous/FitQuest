#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'app', 'meal-prep.tsx');

let source = '';
try {
  source = readFileSync(FILE, 'utf8');
} catch {
  console.error('❌ Meal Prep text safety gate failed: missing app/meal-prep.tsx');
  process.exit(1);
}

const forbiddenPatterns = [
  'food.calories_per_serving &&',
  'food.protein_g &&',
  'food.local_name &&',
];

const requiredPatterns = [
  'food.calories_per_serving != null ? (',
  'food.protein_g != null ? (',
  'const hasLocalName =',
  'hasLocalName ? (',
  'MEAL_PREP_BUNDLE_SIGNATURE',
  'Bundle signature:',
];

const failures = [];

for (const token of forbiddenPatterns) {
  if (source.includes(token)) {
    failures.push(`Forbidden render pattern still present: ${token}`);
  }
}

for (const token of requiredPatterns) {
  if (!source.includes(token)) {
    failures.push(`Expected safe render guard missing: ${token}`);
  }
}

if (failures.length > 0) {
  console.error('❌ Meal Prep text safety gate failed.');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('✅ Meal Prep text safety gate passed.');
