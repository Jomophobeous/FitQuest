import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'Food_base_info.txt');
const outputPath = path.join(root, 'src', 'services', 'foodDatabase.ts');

const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/);

const headingToRegion = (line) => {
  const lower = line.toLowerCase();
  if (lower.includes('australia')) return 'AU';
  if (lower.includes('south africa')) return 'ZA';
  if (lower.includes('russia') || lower.includes('eastern europe')) return 'EE';
  if (lower.includes('brazil') || lower.includes('south america')) return 'SA';
  if (lower.includes('north africa')) return 'NA';
  if (lower.includes('middle africa')) return 'MAF';
  if (lower.includes('europe-middle east') || lower.includes('mediterranean') || lower.includes('levant')) return 'EME';
  if (lower.includes('asia (east') || lower.includes('southeast')) return 'AS';
  if (lower.includes('pacific islands')) return 'PAC';
  if (lower.includes('central asia')) return 'CAS';
  return null;
};

const mapSectionToCategory = (section, categoryText, name) => {
  const s = (section || '').toLowerCase();
  const c = (categoryText || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (
    s.includes('protein') ||
    c.includes('meat') ||
    c.includes('seafood') ||
    c.includes('poultry') ||
    c.includes('offal') ||
    c.includes('legume') ||
    c.includes('insect') ||
    c.includes('protein')
  ) return 'protein';

  if (
    s.includes('carb') ||
    c.includes('grain') ||
    c.includes('tuber') ||
    c.includes('root') ||
    c.includes('rice') ||
    n.includes('rice') ||
    n.includes('potato')
  ) return 'carb';

  if (s.includes('vegetable') || c.includes('vegetable')) return 'vegetable';
  if (s.includes('fruit') || c.includes('fruit')) return 'fruit';
  if (s.includes('fat') || c.includes('nut') || c.includes('seed') || c.includes('oil') || n.includes('oil') || n.includes('nut')) return 'fat';
  if (s.includes('snack')) return 'snack';
  if (s.includes('meal')) return 'meal';
  return 'meal';
};

let currentRegion = 'GLOBAL';
let currentSection = '';
const foods = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  if (/^\d+\.\s+.*\(80\+ Foods\)/.test(line)) {
    const region = headingToRegion(line);
    if (region) currentRegion = region;
    currentSection = '';
    continue;
  }

  if (/(PROTEINS|CARBS|VEGETABLES|FRUITS|FATS|SNACKS|MEALS|PLANT PROTEINS)/i.test(line) && line.length < 120) {
    currentSection = line;
    continue;
  }

  const itemMatch = line.match(/^\d+\.\s+(.+)$/);
  if (!itemMatch) continue;

  const name = itemMatch[1].trim();
  if (name.includes('(80+ Foods)')) continue;

  let categoryText = '';
  let desc = 'Regional fitness food';
  let localName = '';
  let protein;
  let calories;

  for (let j = i + 1; j < Math.min(i + 16, lines.length); j++) {
    const l = lines[j].trim();
    if (!l) continue;
    if (/^\d+\.\s+/.test(l) || /^\d+\.\s+.*\(80\+ Foods\)/.test(l)) break;

    if (/^Category:/i.test(l)) categoryText = l.replace(/^Category:\s*/i, '').trim();
    if (/^Health Benefits:/i.test(l)) desc = l.replace(/^Health Benefits:\s*/i, '').trim();
    if (/^Local Name:/i.test(l)) localName = l.replace(/^Local Name:\s*/i, '').trim();

    if (/^Protein:/i.test(l)) {
      const match = l.match(/(\d+(?:\.\d+)?)\s*g/i);
      if (match) protein = Math.round(Number(match[1]));
    }

    if (/^Calories:/i.test(l)) {
      const match = l.match(/(\d+(?:\.\d+)?)/);
      if (match) calories = Math.round(Number(match[1]));
    }
  }

  const category = mapSectionToCategory(currentSection, categoryText, name);
  foods.push({
    name,
    category,
    description: desc,
    calories_per_serving: calories,
    protein_g: protein,
    available_regions: [currentRegion],
    local_name: localName || undefined,
  });
}

const dedup = [];
const seen = new Set();
for (const food of foods) {
  const key = `${food.available_regions[0]}|${food.name.toLowerCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);
  dedup.push(food);
}

const ts = `/**\n * Auto-generated from Food_base_info.txt\n * Do not edit manually.\n */\n\nexport type RegionalFoodCategory = 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'snack' | 'meal';\n\nexport interface RegionalFoodItem {\n  name: string;\n  category: RegionalFoodCategory;\n  description: string;\n  calories_per_serving?: number;\n  protein_g?: number;\n  available_regions: string[];\n  local_name?: string;\n}\n\nexport const REGIONAL_FOOD_DATABASE: RegionalFoodItem[] = ${JSON.stringify(dedup, null, 2)};\n`;

fs.writeFileSync(outputPath, ts);
console.log(`[FoodDB] generated ${dedup.length} foods -> ${outputPath}`);
