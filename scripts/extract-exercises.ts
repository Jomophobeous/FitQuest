/**
 * FitQuest Exercise Extractor
 * 
 * Extracts ALL exercises (handcrafted + generated + external) 
 * into a single JSON file for the translation pipeline.
 * 
 * Usage: npx tsx scripts/extract-exercises.ts
 * Output: scripts/exercise_translations/exercises_en.json
 */

import * as fs from 'fs';
import * as path from 'path';

// Parse external exercises from SQL
function extractExternalExercises(): Array<{
  id: string;
  name: string;
  category: string;
  instructions: string[];
  audio_intro: string;
  audio_setup: string;
  audio_execution: string;
  audio_transition: string;
}> {
  const dataPath = path.join(__dirname, '..', 'src', 'database', 'external-exercises-data.ts');
  const content = fs.readFileSync(dataPath, 'utf-8');
  
  const exercises: Array<{
    id: string;
    name: string;
    category: string;
    instructions: string[];
    audio_intro: string;
    audio_setup: string;
    audio_execution: string;
    audio_transition: string;
  }> = [];
  
  // Parse INSERT statements
  const insertPattern = /INSERT OR IGNORE INTO exercises \(\s*id, name, category, difficulty, equipment_level, impact_level,\s*space_required, time_per_set_seconds, instructions, order_in_category,\s*audio_intro, audio_setup, audio_execution, audio_transition,\s*force_type, mechanic, external_id\s*\) VALUES \(\s*'([^']*)',\s*'([^']*(?:''[^']*)*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*'(\[[\s\S]*?\])',\s*(\d+),\s*'([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',\s*'([^']*(?:''[^']*)*)',/g;
  
  let match;
  while ((match = insertPattern.exec(content)) !== null) {
    const id = match[1];
    const name = match[2].replace(/''/g, "'");
    const category = match[3];
    const instructionsRaw = match[9].replace(/''/g, "'");
    const audioIntro = match[11]?.replace(/''/g, "'") || '';
    const audioSetup = match[12]?.replace(/''/g, "'") || '';
    const audioExec = match[13]?.replace(/''/g, "'") || '';
    const audioTrans = match[14]?.replace(/''/g, "'") || '';
    
    let instructions: string[] = [];
    try {
      instructions = JSON.parse(instructionsRaw);
    } catch {
      // Try splitting by newlines
      instructions = instructionsRaw.split('\n').filter(s => s.trim());
    }
    
    exercises.push({
      id,
      name,
      category,
      instructions,
      audio_intro: audioIntro,
      audio_setup: audioSetup,
      audio_execution: audioExec,
      audio_transition: audioTrans,
    });
  }
  
  return exercises;
}

// Parse handcrafted exercises from seed.ts by regex
function extractHandcraftedExercises(): Array<{
  id: string;
  name: string;
  category: string;
  instructions: string[];
  audio_intro: string;
  audio_setup: string;
  audio_execution: string;
  audio_transition: string;
}> {
  const seedPath = path.join(__dirname, '..', 'src', 'database', 'seed.ts');
  const content = fs.readFileSync(seedPath, 'utf-8');
  
  const exercises: Array<{
    id: string;
    name: string;
    category: string;
    instructions: string[];
    audio_intro: string;
    audio_setup: string;
    audio_execution: string;
    audio_transition: string;
  }> = [];
  
  // Find all exercise objects within the arrays
  // Use a state machine to find balanced braces
  const arrayNames = ['CALISTHENICS_EXERCISES', 'GETTING_TALLER_EXERCISES', 'FLEXIBLE_EXERCISES'];
  
  for (const arrayName of arrayNames) {
    const arrayStart = content.indexOf(`const ${arrayName}`);
    if (arrayStart === -1) continue;
    
    // Find the opening bracket
    let pos = content.indexOf('[', arrayStart);
    if (pos === -1) continue;
    
    // Find matching closing bracket
    let depth = 0;
    let objStart = -1;
    
    for (let i = pos; i < content.length; i++) {
      const ch = content[i];
      if (ch === '[' && depth === 0) {
        depth = 1;
        continue;
      }
      if (ch === '{') {
        if (depth === 1) objStart = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 1 && objStart !== -1) {
          const objStr = content.substring(objStart, i + 1);
          const ex = parseExerciseObject(objStr);
          if (ex) exercises.push(ex);
          objStart = -1;
        }
        if (depth === 0) break; // end of array
      }
    }
  }
  
  return exercises;
}

function parseExerciseObject(objStr: string): {
  id: string;
  name: string;
  category: string;
  instructions: string[];
  audio_intro: string;
  audio_setup: string;
  audio_execution: string;
  audio_transition: string;
} | null {
  const id = extractStringField(objStr, 'id');
  const name = extractStringField(objStr, 'name');
  const category = extractStringField(objStr, 'category');
  
  if (!id || !name) return null;
  
  // Extract instructions array
  const instrMatch = objStr.match(/instructions:\s*\[([\s\S]*?)\]/);
  let instructions: string[] = [];
  if (instrMatch) {
    instructions = [...instrMatch[1].matchAll(/'([^']*(?:\\'[^']*)*)'/g)].map(m => 
      m[1].replace(/\\'/g, "'")
    );
  }
  
  const audio_intro = extractStringField(objStr, 'audio_intro') || '';
  const audio_setup = extractStringField(objStr, 'audio_setup') || '';
  const audio_execution = extractStringField(objStr, 'audio_execution') || '';
  const audio_transition = extractStringField(objStr, 'audio_transition') || '';
  
  return { id, name, category: category || 'body_control', instructions, audio_intro, audio_setup, audio_execution, audio_transition };
}

function extractStringField(objStr: string, field: string): string | null {
  const pattern = new RegExp(`${field}:\\s*'([^']*(?:\\\\'[^']*)*)'`);
  const match = objStr.match(pattern);
  return match ? match[1].replace(/\\'/g, "'") : null;
}

// Parse generated exercises from exerciseGeneratorExpanded.ts
function extractGeneratedExercises(): Array<{
  id: string;
  name: string;
  category: string;
  instructions: string[];
  audio_intro: string;
  audio_setup: string;
  audio_execution: string;
  audio_transition: string;
}> {
  const genPath = path.join(__dirname, '..', 'src', 'database', 'exerciseGeneratorExpanded.ts');
  const content = fs.readFileSync(genPath, 'utf-8');
  
  const exercises: Array<{
    id: string;
    name: string;
    category: string;
    instructions: string[];
    audio_intro: string;
    audio_setup: string;
    audio_execution: string;
    audio_transition: string;
  }> = [];
  
  // Extract all template arrays and their base exercises
  // Templates have baseName and baseInstructions
  const templateArrays = [
    'PUSH_TEMPLATES', 'PULL_TEMPLATES', 'SQUAT_TEMPLATES', 'HINGE_TEMPLATES',
    'CORE_TEMPLATES', 'BALANCE_TEMPLATES', 'POSTURE_TEMPLATES', 'MOBILITY_TEMPLATES',
    'SPEED_TEMPLATES', 'FOCUS_TEMPLATES', 'STRENGTH_TEMPLATES',
  ];
  
  // First, find the generateAllExercises function to understand ID generation
  // IDs are typically category prefix + counter
  // For bases: they use their own ID generation
  
  // Parse templates to build base exercises
  // Each template array contains objects with baseName and baseInstructions
  const allTemplates: Array<{
    baseName: string;
    category: string;
    baseInstructions: string[];
  }> = [];
  
  for (const arrayName of templateArrays) {
    const arrStart = content.indexOf(`const ${arrayName}`);
    if (arrStart === -1) continue;
    
    let pos = content.indexOf('[', arrStart);
    if (pos === -1) continue;
    
    let depth = 0;
    let objStart = -1;
    
    for (let i = pos; i < content.length; i++) {
      const ch = content[i];
      if (ch === '[' && depth === 0) {
        depth = 1;
        continue;
      }
      if (ch === '{') {
        if (depth === 1) objStart = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 1 && objStart !== -1) {
          const objStr = content.substring(objStart, i + 1);
          
          const baseName = extractStringField(objStr, 'baseName');
          const category = extractStringField(objStr, 'category');
          
          const instrMatch = objStr.match(/baseInstructions:\s*\[([\s\S]*?)\]/);
          let baseInstructions: string[] = [];
          if (instrMatch) {
            baseInstructions = [...instrMatch[1].matchAll(/'([^']*(?:\\'[^']*)*)'/g)].map(m => 
              m[1].replace(/\\'/g, "'")
            );
          }
          
          if (baseName && baseInstructions.length > 0) {
            allTemplates.push({
              baseName,
              category: category || 'body_control',
              baseInstructions,
            });
          }
          
          objStart = -1;
        }
        if (depth === 0) break;
      }
    }
  }
  
  // Now find the generateAllExercises function to understand how IDs and exercises are built
  // The function creates base exercises from each template
  // ID format varies by category, typically: body_001, pos_001, etc.
  
  // For our purposes, we'll generate the same base exercises
  const categoryPrefixes: Record<string, string> = {
    'body_control': 'body',
    'posture': 'pos',
    'speed': 'spd',
    'mobility': 'mob',
    'focus': 'foc',
    'strength': 'str',
  };
  
  const catCounters: Record<string, number> = {};
  
  for (const tmpl of allTemplates) {
    const prefix = categoryPrefixes[tmpl.category] || 'gen';
    catCounters[prefix] = (catCounters[prefix] || 0) + 1;
    const id = `${prefix}_${String(catCounters[prefix]).padStart(3, '0')}`;
    
    exercises.push({
      id,
      name: tmpl.baseName,
      category: tmpl.category,
      instructions: tmpl.baseInstructions,
      audio_intro: '',
      audio_setup: '',
      audio_execution: '',
      audio_transition: '',
    });
  }
  
  return exercises;
}

// Audio generation (mirrors seed.ts logic)
function generateAudioIntro(name: string, category: string, difficulty: string, primaryMuscles: string[]): string {
  const muscle = (primaryMuscles?.[0] || 'multiple muscles').replace(/_/g, ' ');
  const categoryName = category.replace(/_/g, ' ');
  const difficultyDesc: Record<string, string> = {
    beginner: 'beginner-friendly',
    intermediate: 'moderate',
    advanced: 'challenging',
  };
  return `${name} is a ${difficultyDesc[difficulty] || 'moderate'} ${categoryName} exercise. It primarily targets your ${muscle}.`;
}

function generateAudioSetup(instructions: string[]): string {
  const setup = instructions.slice(0, 2).join(' ');
  return setup.length > 150 ? setup.substring(0, 147) + '...' : setup;
}

function generateAudioExecution(instructions: string[]): string {
  const midStart = Math.min(2, instructions.length - 1);
  const midEnd = Math.min(4, instructions.length);
  const exec = instructions.slice(midStart, midEnd).join(' ');
  if (!exec) return 'Perform the movement with control, focusing on proper form.';
  return exec.length > 150 ? exec.substring(0, 147) + '...' : exec;
}

// Enrich exercises with generated audio where missing
function enrichAudio(exercises: ReturnType<typeof extractHandcraftedExercises>): void {
  // Read seed.ts to extract primary_muscles for handcrafted exercises
  const seedPath = path.join(__dirname, '..', 'src', 'database', 'seed.ts');
  const seedContent = fs.readFileSync(seedPath, 'utf-8');
  const difficultyMap = new Map<string, string>();
  
  // Build muscle lookup from seed
  const muscleMap = new Map<string, string[]>();
  const idPattern = /id:\s*'([^']*)'/g;
  const musclePattern = /primary_muscles:\s*\[([\s\S]*?)\]/g;
  const diffPattern = /difficulty:\s*'([^']*)'/g;
  
  let idMatch, muscleMatch, diffMatch;
  const idPositions: Array<{id: string, pos: number}> = [];
  while ((idMatch = idPattern.exec(seedContent)) !== null) {
    idPositions.push({id: idMatch[1], pos: idMatch.index});
  }
  
  for (const ex of exercises) {
    if (!ex.audio_intro && ex.instructions.length > 0) {
      ex.audio_intro = generateAudioIntro(ex.name, ex.category, 'intermediate', []);
    }
    if (!ex.audio_setup && ex.instructions.length > 0) {
      ex.audio_setup = generateAudioSetup(ex.instructions);
    }
    if (!ex.audio_execution && ex.instructions.length > 0) {
      ex.audio_execution = generateAudioExecution(ex.instructions);
    }
  }
}

// Main
function main() {
  const outDir = path.join(__dirname, 'exercise_translations');
  fs.mkdirSync(outDir, { recursive: true });
  
  console.log('[Extract] Reading exercise sources...');
  
  const handcrafted = extractHandcraftedExercises();
  console.log(`  Handcrafted exercises: ${handcrafted.length}`);
  
  const generated = extractGeneratedExercises();
  console.log(`  Generated base exercises: ${generated.length}`);
  
  const external = extractExternalExercises();
  console.log(`  External exercises: ${external.length}`);
  
  // Deduplicate by ID
  const seen = new Set<string>();
  const all: typeof handcrafted = [];
  
  for (const ex of [...handcrafted, ...generated, ...external]) {
    if (!seen.has(ex.id)) {
      seen.add(ex.id);
      all.push(ex);
    }
  }
  
  console.log(`  Total unique: ${all.length}`);
  
  // Generate audio fields where missing
  enrichAudio(all);
  
  // Category breakdown
  const cats: Record<string, number> = {};
  for (const ex of all) {
    cats[ex.category] = (cats[ex.category] || 0) + 1;
  }
  console.log('\n  Categories:');
  for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }
  
  // Instructions stats
  const totalSteps = all.reduce((sum, ex) => sum + ex.instructions.length, 0);
  const avgSteps = (totalSteps / all.length).toFixed(1);
  console.log(`\n  Total instruction steps: ${totalSteps}`);
  console.log(`  Avg steps per exercise: ${avgSteps}`);
  
  // Audio stats
  const withAudio = all.filter(e => e.audio_intro).length;
  console.log(`  With audio: ${withAudio}/${all.length}`);
  
  // Write output
  const outPath = path.join(outDir, 'exercises_en.json');
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`\n  Written to: ${outPath}`);
}

main();
