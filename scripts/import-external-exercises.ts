#!/usr/bin/env node
/**
 * External Exercise Dataset Importer
 * 
 * Imports exercises from external sources (free-exercise-db, exercises.json)
 * into the FitQuest canonical schema.
 * 
 * Usage:
 *   node scripts/import-external-exercises.js --dry-run
 *   node scripts/import-external-exercises.js --source free-exercise-db
 *   node scripts/import-external-exercises.js --source free-exercise-db --limit 50
 * 
 * Options:
 *   --dry-run     Show what would be imported without making changes
 *   --source      Source dataset: 'free-exercise-db' or 'exercises-json' (default: free-exercise-db)
 *   --limit       Maximum number of exercises to import (default: all)
 *   --force       Overwrite existing exercises with same ID
 *   --bodyweight  Only import bodyweight exercises (equipment = 'body only')
 */

const fs = require('fs');
const path = require('path');

// ============================================
// TYPE DEFINITIONS (inline to avoid module resolution)
// ============================================

type Category = 'body_control' | 'posture' | 'speed' | 'mobility' | 'focus' | 'strength';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type EquipmentLevel = 'none' | 'minimal' | 'playground';
type ImpactLevel = 'no_impact' | 'low_impact' | 'high_impact';
type SpaceFilter = 'mat_only_1x1' | 'small_bedroom_2x2' | 'living_room_3x3' | 'outdoors_hall';
type TrainingType = 'strength' | 'hypertrophy' | 'endurance' | 'mobility' | 'speed_power' | 'balance' | 'recovery' | 'mindfulness' | 'fat_loss' | 'posture' | 'decompression' | 'coordination';
type TargetMuscle = string;
type EquipmentItem = string;

// ============================================
// INLINE TAXONOMY MAPPER
// ============================================

const CATEGORY_MAP: Record<string, Category> = {
  'strength': 'strength',
  'powerlifting': 'strength',
  'olympic weightlifting': 'strength',
  'strongman': 'strength',
  'stretching': 'mobility',
  'cardio': 'speed',
  'plyometrics': 'speed',
  'compound': 'body_control',
  'isolation': 'strength',
};

function mapCategory(externalCategory: string | null | undefined): Category {
  if (!externalCategory) return 'body_control';
  const normalized = externalCategory.toLowerCase().trim();
  return CATEGORY_MAP[normalized] || 'body_control';
}

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  'beginner': 'beginner',
  'intermediate': 'intermediate',
  'advanced': 'advanced',
  'expert': 'advanced',
};

function mapDifficulty(externalLevel: string | null | undefined): Difficulty {
  if (!externalLevel) return 'intermediate';
  const normalized = externalLevel.toLowerCase().trim();
  return DIFFICULTY_MAP[normalized] || 'intermediate';
}

const MUSCLE_MAP: Record<string, string> = {
  'abdominals': 'abs',
  'abductors': 'glutes_med',
  'adductors': 'adductors',
  'biceps': 'biceps',
  'calves': 'calves_gastrocnemius',
  'chest': 'chest_mid',
  'forearms': 'forearms',
  'glutes': 'glutes_max',
  'hamstrings': 'hamstrings',
  'lats': 'lats',
  'lower back': 'lower_back',
  'middle back': 'rhomboids',
  'neck': 'neck',
  'quadriceps': 'quads',
  'shoulders': 'shoulders',
  'traps': 'traps_upper',
  'triceps': 'triceps',
  'core': 'core_deep',
  'abs': 'abs',
  'obliques': 'obliques',
  'hip flexors': 'hip_flexors',
  'rotator cuff': 'rotator_cuff',
  'serratus': 'serratus',
  'deltoids': 'deltoids_front',
  'pecs': 'pecs',
};

function mapMuscle(externalMuscle: string | null | undefined): string | null {
  if (!externalMuscle) return null;
  const normalized = externalMuscle.toLowerCase().trim();
  return MUSCLE_MAP[normalized] || null;
}

function mapMuscles(externalMuscles: string[] | null | undefined): string[] {
  if (!externalMuscles || !Array.isArray(externalMuscles)) return [];
  return externalMuscles
    .map(m => mapMuscle(m))
    .filter((m): m is string => m !== null);
}

const EQUIPMENT_MAP: Record<string, string | null> = {
  'body only': null,
  'bands': 'band',
  'dumbbell': null,
  'barbell': null,
  'kettlebells': null,
  'cable': null,
  'machine': null,
  'exercise ball': null,
  'medicine ball': null,
  'foam roll': 'foam_roller',
  'e-z curl bar': null,
  'other': null,
  'pull up bar': 'pull_up_bar',
  'pullup bar': 'pull_up_bar',
  'pull-up bar': 'pull_up_bar',
  'parallel bars': 'parallel_bars',
  'dip bars': 'parallel_bars',
  'rings': 'rings',
  'bench': 'bench',
  'chair': 'chair',
  'wall': 'wall',
  'door': 'door_frame',
  'jump rope': 'jump_rope',
  'towel': 'towel',
  'strap': 'strap',
  'resistance band': 'band',
  'backpack': 'backpack',
};

function mapEquipment(externalEquipment: string | null | undefined): string | null {
  if (!externalEquipment) return null;
  const normalized = externalEquipment.toLowerCase().trim();
  return EQUIPMENT_MAP[normalized] ?? null;
}

function inferEquipmentLevel(equipment: string | null): EquipmentLevel {
  if (!equipment) return 'none';
  const playgroundEquipment = ['pull_up_bar', 'parallel_bars', 'monkey_bars', 'bench', 'hill', 'sand', 'sled', 'parachute', 'parallettes', 'rings'];
  if (playgroundEquipment.includes(equipment)) return 'playground';
  return 'minimal';
}

function inferTrainingTypes(
  category: string | null | undefined,
  mechanic: string | null | undefined,
  force: string | null | undefined
): { type: TrainingType; effectiveness: number }[] {
  const types: { type: TrainingType; effectiveness: number }[] = [];
  const cat = (category || '').toLowerCase();
  const mech = (mechanic || '').toLowerCase();
  
  if (cat === 'strength' || cat === 'powerlifting') {
    types.push({ type: 'strength', effectiveness: 8 });
    types.push({ type: 'hypertrophy', effectiveness: 6 });
  } else if (cat === 'stretching') {
    types.push({ type: 'mobility', effectiveness: 9 });
    types.push({ type: 'recovery', effectiveness: 7 });
  } else if (cat === 'cardio') {
    types.push({ type: 'endurance', effectiveness: 8 });
    types.push({ type: 'fat_loss', effectiveness: 7 });
  } else if (cat === 'plyometrics') {
    types.push({ type: 'speed_power', effectiveness: 9 });
    types.push({ type: 'coordination', effectiveness: 6 });
  } else if (cat === 'olympic weightlifting') {
    types.push({ type: 'speed_power', effectiveness: 8 });
    types.push({ type: 'strength', effectiveness: 7 });
    types.push({ type: 'coordination', effectiveness: 7 });
  } else if (cat === 'strongman') {
    types.push({ type: 'strength', effectiveness: 9 });
    types.push({ type: 'endurance', effectiveness: 5 });
  }
  
  if (mech === 'compound' && !types.find(t => t.type === 'strength')) {
    types.push({ type: 'strength', effectiveness: 6 });
  } else if (mech === 'isolation' && !types.find(t => t.type === 'hypertrophy')) {
    types.push({ type: 'hypertrophy', effectiveness: 7 });
  }
  
  if (types.length === 0) types.push({ type: 'strength', effectiveness: 5 });
  return types;
}

function inferImpactLevel(category: string | null | undefined, name: string): ImpactLevel {
  const cat = (category || '').toLowerCase();
  const nameLower = name.toLowerCase();
  
  if (cat === 'plyometrics' || nameLower.includes('jump') || nameLower.includes('hop') || nameLower.includes('bound') || nameLower.includes('sprint')) {
    return 'high_impact';
  }
  if (cat === 'stretching' || nameLower.includes('stretch') || nameLower.includes('static') || nameLower.includes('isometric')) {
    return 'no_impact';
  }
  return 'low_impact';
}

function inferSpaceRequired(category: string | null | undefined, name: string): SpaceFilter {
  const cat = (category || '').toLowerCase();
  const nameLower = name.toLowerCase();
  
  if (cat === 'plyometrics' || cat === 'cardio' || nameLower.includes('sprint') || nameLower.includes('walk') || nameLower.includes('run') || nameLower.includes('sled')) {
    return 'outdoors_hall';
  }
  if (nameLower.includes('lunge') || nameLower.includes('deadlift') || nameLower.includes('squat')) {
    return 'living_room_3x3';
  }
  return 'small_bedroom_2x2';
}

function generateExerciseId(name: string, source: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);
  const sourcePrefix = source === 'free-exercise-db' ? 'fed' : 'ext';
  return `${sourcePrefix}_${normalized}`;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateExternalExercise(exercise: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!exercise.name || typeof exercise.name !== 'string') errors.push('Missing or invalid name');
  if (!exercise.instructions || !Array.isArray(exercise.instructions) || exercise.instructions.length === 0) errors.push('Missing or empty instructions');
  if (!exercise.primaryMuscles || !Array.isArray(exercise.primaryMuscles) || exercise.primaryMuscles.length === 0) warnings.push('No primary muscles specified');
  if (!exercise.level) warnings.push('No difficulty level specified, defaulting to intermediate');
  if (!exercise.category) warnings.push('No category specified, defaulting to body_control');
  
  return { valid: errors.length === 0, errors, warnings };
}

// ============================================
// CLI ARGUMENT PARSING
// ============================================

interface ImportOptions {
  dryRun: boolean;
  source: 'free-exercise-db' | 'exercises-json';
  limit: number | null;
  force: boolean;
  bodyweightOnly: boolean;
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    dryRun: false,
    source: 'free-exercise-db',
    limit: null,
    force: false,
    bodyweightOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--source':
        options.source = args[++i] as ImportOptions['source'];
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--force':
        options.force = true;
        break;
      case '--bodyweight':
        options.bodyweightOnly = true;
        break;
      case '--help':
        console.log(`
External Exercise Dataset Importer

Usage:
  npx ts-node scripts/import-external-exercises.ts [options]

Options:
  --dry-run     Show what would be imported without making changes
  --source      Source dataset: 'free-exercise-db' or 'exercises-json'
  --limit N     Maximum number of exercises to import
  --force       Overwrite existing exercises with same ID
  --bodyweight  Only import bodyweight exercises
  --help        Show this help message
`);
        process.exit(0);
    }
  }

  return options;
}

// ============================================
// EXTERNAL EXERCISE TYPES
// ============================================

interface FreeExerciseDbExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

// ============================================
// DATA LOADING
// ============================================

function loadFreeExerciseDbExercises(basePath: string): FreeExerciseDbExercise[] {
  const exercisesDir = path.join(basePath, 'exercises');
  const exercises: FreeExerciseDbExercise[] = [];

  if (!fs.existsSync(exercisesDir)) {
    console.error(`Exercise directory not found: ${exercisesDir}`);
    return exercises;
  }

  const files = fs.readdirSync(exercisesDir);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    const filePath = path.join(exercisesDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const exercise = JSON.parse(content) as FreeExerciseDbExercise;
      exercises.push(exercise);
    } catch (error) {
      console.warn(`Failed to parse ${file}:`, error);
    }
  }

  return exercises;
}

// ============================================
// TRANSFORMATION
// ============================================

interface TransformedExercise {
  id: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  equipment_level: EquipmentLevel;
  impact_level: ImpactLevel;
  space_required: SpaceFilter;
  time_per_set_seconds: number;
  instructions: string;
  order_in_category: number;
  audio_intro: string;
  audio_setup: string;
  audio_execution: string;
  audio_transition: string;
  force_type: string | null;
  mechanic: string | null;
  external_id: string;
  primaryMuscles: TargetMuscle[];
  secondaryMuscles: TargetMuscle[];
  equipment: EquipmentItem | null;
  trainingTypes: { type: TrainingType; effectiveness: number }[];
  images: string[];
  source: string;
  validation: ValidationResult;
}

function transformExercise(
  external: FreeExerciseDbExercise,
  source: string,
  index: number
): TransformedExercise {
  const validation = validateExternalExercise(external as unknown as Record<string, unknown>);
  const equipment = mapEquipment(external.equipment);
  
  return {
    id: generateExerciseId(external.name, source),
    name: external.name.replace(/_/g, ' '),
    category: mapCategory(external.category),
    difficulty: mapDifficulty(external.level),
    equipment_level: inferEquipmentLevel(equipment),
    impact_level: inferImpactLevel(external.category, external.name),
    space_required: inferSpaceRequired(external.category, external.name),
    time_per_set_seconds: 30, // Default
    instructions: JSON.stringify(external.instructions || []),
    order_in_category: index,
    audio_intro: '',
    audio_setup: '',
    audio_execution: '',
    audio_transition: '',
    force_type: external.force,
    mechanic: external.mechanic,
    external_id: external.id,
    primaryMuscles: mapMuscles(external.primaryMuscles),
    secondaryMuscles: mapMuscles(external.secondaryMuscles),
    equipment,
    trainingTypes: inferTrainingTypes(external.category, external.mechanic, external.force),
    images: external.images || [],
    source,
    validation,
  };
}

// ============================================
// DEDUPLICATION
// ============================================

function checkDuplicates(
  exercises: TransformedExercise[],
  existingIds: Set<string>
): { unique: TransformedExercise[]; duplicates: TransformedExercise[] } {
  const seen = new Set<string>();
  const unique: TransformedExercise[] = [];
  const duplicates: TransformedExercise[] = [];

  for (const exercise of exercises) {
    if (seen.has(exercise.id) || existingIds.has(exercise.id)) {
      duplicates.push(exercise);
    } else {
      seen.add(exercise.id);
      unique.push(exercise);
    }
  }

  return { unique, duplicates };
}

// ============================================
// SQL GENERATION
// ============================================

function generateInsertSQL(exercise: TransformedExercise): string {
  const escapeSql = (s: string) => s.replace(/'/g, "''");
  
  const lines: string[] = [];
  
  // Main exercise insert
  lines.push(`
-- Exercise: ${exercise.name}
INSERT OR IGNORE INTO exercises (
  id, name, category, difficulty, equipment_level, impact_level,
  space_required, time_per_set_seconds, instructions, order_in_category,
  audio_intro, audio_setup, audio_execution, audio_transition,
  force_type, mechanic, external_id
) VALUES (
  '${escapeSql(exercise.id)}',
  '${escapeSql(exercise.name)}',
  '${exercise.category}',
  '${exercise.difficulty}',
  '${exercise.equipment_level}',
  '${exercise.impact_level}',
  '${exercise.space_required}',
  ${exercise.time_per_set_seconds},
  '${escapeSql(exercise.instructions)}',
  ${exercise.order_in_category},
  '${escapeSql(exercise.audio_intro)}',
  '${escapeSql(exercise.audio_setup)}',
  '${escapeSql(exercise.audio_execution)}',
  '${escapeSql(exercise.audio_transition)}',
  ${exercise.force_type ? `'${exercise.force_type}'` : 'NULL'},
  ${exercise.mechanic ? `'${exercise.mechanic}'` : 'NULL'},
  '${escapeSql(exercise.external_id)}'
);`);

  // Primary muscles
  for (const muscle of exercise.primaryMuscles) {
    lines.push(`INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle, is_primary) VALUES ('${exercise.id}', '${muscle}', 1);`);
  }

  // Secondary muscles
  for (const muscle of exercise.secondaryMuscles) {
    lines.push(`INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle, is_primary) VALUES ('${exercise.id}', '${muscle}', 0);`);
  }

  // Equipment
  if (exercise.equipment) {
    lines.push(`INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment, is_required) VALUES ('${exercise.id}', '${exercise.equipment}', 1);`);
  }

  // Training types
  for (const tt of exercise.trainingTypes) {
    lines.push(`INSERT OR IGNORE INTO exercise_training_types (exercise_id, training_type, effectiveness) VALUES ('${exercise.id}', '${tt.type}', ${tt.effectiveness});`);
  }

  // Images (v10 schema)
  for (let i = 0; i < exercise.images.length; i++) {
    const imgPath = exercise.images[i];
    lines.push(`INSERT OR IGNORE INTO exercise_images (exercise_id, image_path, image_order, source) VALUES ('${exercise.id}', '${escapeSql(imgPath)}', ${i}, 'external');`);
  }

  return lines.join('\n');
}

// ============================================
// MAIN IMPORT LOGIC
// ============================================

async function main() {
  const options = parseArgs();
  
  console.log('\n🏋️ FitQuest Exercise Importer\n');
  console.log('Options:', options);
  console.log('');

  // Determine source path - use process.cwd() for portability
  const workspaceRoot = process.cwd();
  let sourcePath: string;
  
  if (options.source === 'free-exercise-db') {
    sourcePath = path.join(workspaceRoot, 'workspace-repos', 'exercise-content', 'free-exercise-db');
  } else {
    sourcePath = path.join(workspaceRoot, 'workspace-repos', 'exercise-content', 'exercises.json');
  }

  console.log(`📂 Loading from: ${sourcePath}\n`);

  // Load exercises
  let rawExercises: FreeExerciseDbExercise[];
  
  if (options.source === 'free-exercise-db') {
    rawExercises = loadFreeExerciseDbExercises(sourcePath);
  } else {
    console.error('exercises-json source not yet implemented');
    process.exit(1);
  }

  console.log(`📊 Loaded ${rawExercises.length} raw exercises\n`);

  // Filter bodyweight only if requested
  if (options.bodyweightOnly) {
    rawExercises = rawExercises.filter(e => 
      e.equipment === 'body only' || e.equipment === null
    );
    console.log(`🏃 Filtered to ${rawExercises.length} bodyweight exercises\n`);
  }

  // Apply limit
  if (options.limit !== null) {
    rawExercises = rawExercises.slice(0, options.limit);
    console.log(`📏 Limited to ${rawExercises.length} exercises\n`);
  }

  // Transform exercises
  const transformed = rawExercises.map((ex, i) => 
    transformExercise(ex, options.source, i)
  );

  // Validation stats
  const valid = transformed.filter(e => e.validation.valid);
  const invalid = transformed.filter(e => !e.validation.valid);

  console.log('📋 Validation Summary:');
  console.log(`   ✅ Valid: ${valid.length}`);
  console.log(`   ❌ Invalid: ${invalid.length}`);
  
  if (invalid.length > 0) {
    console.log('\n   Invalid exercises:');
    for (const ex of invalid.slice(0, 10)) {
      console.log(`   - ${ex.name}: ${ex.validation.errors.join(', ')}`);
    }
    if (invalid.length > 10) {
      console.log(`   ... and ${invalid.length - 10} more`);
    }
  }

  // Check duplicates (mock existing IDs for dry run)
  const existingIds = new Set<string>(); // Would load from DB in real run
  const { unique, duplicates } = checkDuplicates(valid, existingIds);

  console.log(`\n🔍 Deduplication:`);
  console.log(`   📥 Unique: ${unique.length}`);
  console.log(`   🔄 Duplicates: ${duplicates.length}`);

  // Category distribution
  const categoryDist: Record<string, number> = {};
  for (const ex of unique) {
    categoryDist[ex.category] = (categoryDist[ex.category] || 0) + 1;
  }
  console.log('\n📊 Category Distribution:');
  for (const [cat, count] of Object.entries(categoryDist).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat}: ${count}`);
  }

  // Training type distribution
  const ttDist: Record<string, number> = {};
  for (const ex of unique) {
    for (const tt of ex.trainingTypes) {
      ttDist[tt.type] = (ttDist[tt.type] || 0) + 1;
    }
  }
  console.log('\n🎯 Training Type Distribution:');
  for (const [tt, count] of Object.entries(ttDist).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${tt}: ${count}`);
  }

  // Muscle distribution
  const muscleDist: Record<string, number> = {};
  for (const ex of unique) {
    for (const m of ex.primaryMuscles) {
      muscleDist[m] = (muscleDist[m] || 0) + 1;
    }
  }
  console.log('\n💪 Primary Muscle Distribution (top 10):');
  const topMuscles = Object.entries(muscleDist).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [muscle, count] of topMuscles) {
    console.log(`   ${muscle}: ${count}`);
  }

  if (options.dryRun) {
    console.log('\n🔸 DRY RUN - No changes made\n');
    
    // Generate sample SQL
    console.log('📝 Sample SQL (first 3 exercises):\n');
    for (const ex of unique.slice(0, 3)) {
      console.log(generateInsertSQL(ex));
      console.log('');
    }
    
    // Output import summary path
    const summaryPath = path.join(workspaceRoot, 'reports', 'exercise-import-preview.json');
    const summary = {
      timestamp: new Date().toISOString(),
      source: options.source,
      totalLoaded: rawExercises.length,
      valid: valid.length,
      invalid: invalid.length,
      unique: unique.length,
      duplicates: duplicates.length,
      categoryDistribution: categoryDist,
      trainingTypeDistribution: ttDist,
      muscleDistribution: muscleDist,
      sampleExercises: unique.slice(0, 10),
    };
    
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📄 Import preview saved to: ${summaryPath}\n`);
  } else {
    console.log('\n🚀 LIVE IMPORT MODE\n');
    
    // Generate full SQL file
    const sqlPath = path.join(workspaceRoot, 'src', 'database', 'external-exercises-seed.sql');
    const sqlContent = [
      '-- Auto-generated external exercise seed data',
      `-- Source: ${options.source}`,
      `-- Generated: ${new Date().toISOString()}`,
      `-- Total exercises: ${unique.length}`,
      '',
      'BEGIN TRANSACTION;',
      '',
      ...unique.map(generateInsertSQL),
      '',
      'COMMIT;',
    ].join('\n');
    
    fs.writeFileSync(sqlPath, sqlContent);
    console.log(`📄 SQL seed file generated: ${sqlPath}`);
    console.log(`   Run this SQL against your SQLite database to import exercises.\n`);
  }

  console.log('✅ Import process complete!\n');
}

main().catch(console.error);
