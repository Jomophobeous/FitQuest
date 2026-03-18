#!/usr/bin/env node
/**
 * Build Exercise Image Map
 * Maps ALL exercise names (handcrafted + generated + external) to free-exercise-db image folders.
 * Outputs a TypeScript mapping file for ExerciseImage component.
 */

const fs = require('fs');
const path = require('path');

const EXERCISES_DIR = path.join(__dirname, '..', 'workspace-repos', 'exercise-content', 'free-exercise-db', 'exercises');
const ASSETS_DIR = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'exercises');

// Get all available image folders (free-exercise-db + yoga + any other asset folders)
const freeExDbFolders = fs.readdirSync(EXERCISES_DIR)
  .filter(f => fs.statSync(path.join(EXERCISES_DIR, f)).isDirectory());
const assetOnlyFolders = fs.readdirSync(ASSETS_DIR)
  .filter(f => fs.statSync(path.join(ASSETS_DIR, f)).isDirectory() && !freeExDbFolders.includes(f));
const imageFolders = [...freeExDbFolders, ...assetOnlyFolders];

console.log(`Found ${freeExDbFolders.length} image folders in free-exercise-db`);
console.log(`Found ${assetOnlyFolders.length} additional folders in assets (yoga etc.)`);
console.log(`Total image folders: ${imageFolders.length}`);

// Load all JSON exercise data for name reference
const exerciseJsons = {};
fs.readdirSync(EXERCISES_DIR)
  .filter(f => f.endsWith('.json'))
  .forEach(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(EXERCISES_DIR, f), 'utf8'));
      exerciseJsons[data.name] = {
        folder: f.replace('.json', ''),
        ...data
      };
    } catch (e) {}
  });

console.log(`Loaded ${Object.keys(exerciseJsons).length} exercise JSON files`);

// Normalize a name for comparison
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Create lookup maps
const folderByNormalized = {};
const folderByOriginal = {};
imageFolders.forEach(folder => {
  const name = folder.replace(/_/g, ' ').replace(/-/g, ' ');
  folderByNormalized[normalize(name)] = folder;
  folderByOriginal[folder] = true;
});

// Also index by JSON exercise names
Object.entries(exerciseJsons).forEach(([name, data]) => {
  folderByNormalized[normalize(name)] = data.folder;
});

// Try to match an exercise name to an image folder
function findBestMatch(exerciseName) {
  const norm = normalize(exerciseName);
  
  // 1. Direct normalized match
  if (folderByNormalized[norm]) return folderByNormalized[norm];
  
  // 2. Try direct underscore conversion
  const underscored = exerciseName.replace(/[\s]+/g, '_').replace(/[(),']/g, '');
  if (folderByOriginal[underscored]) return underscored;
  
  // 3. Try with different capitalization patterns
  const capsAfterUnderscore = underscored.split('_').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join('_');
  if (folderByOriginal[capsAfterUnderscore]) return capsAfterUnderscore;
  
  // 4. Keyword-based fuzzy matching
  const words = norm.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  
  // Score each folder
  let bestScore = 0;
  let bestFolder = null;
  
  const stopWords = new Set(['the', 'and', 'with', 'for', 'from', 'into', 'onto', 'fast', 'slow', 'tempo', 'pause', 'isometric', 'explosive', 'single', 'one', 'two', 'each', 'hold', 'weighted', 'elevated', 'unilateral', 'light', 'heavy']);
  
  const significantWords = words.filter(w => !stopWords.has(w));
  
  for (const folder of imageFolders) {
    const folderNorm = normalize(folder.replace(/_/g, ' '));
    
    // Exact substring match
    if (folderNorm.includes(norm) || norm.includes(folderNorm)) {
      const score = Math.min(norm.length, folderNorm.length) / Math.max(norm.length, folderNorm.length) * 100;
      if (score > bestScore) {
        bestScore = score;
        bestFolder = folder;
      }
      continue;
    }
    
    // Word overlap scoring
    let matchedWords = 0;
    let totalWeight = 0;
    for (const word of significantWords) {
      const weight = word.length; // longer words = more significant
      totalWeight += weight;
      if (folderNorm.includes(word)) {
        matchedWords += weight;
      }
    }
    
    if (totalWeight > 0) {
      const score = (matchedWords / totalWeight) * 100;
      if (score > bestScore) {
        bestScore = score;
        bestFolder = folder;
      }
    }
  }
  
  // Only accept matches with >75% confidence (stricter to avoid wrong images)
  if (bestScore >= 75) return bestFolder;
  
  return null;
}

// Read exercise names from seed files
function extractSeedNames() {
  const seedPath = path.join(__dirname, '..', 'src', 'database', 'seed.ts');
  const content = fs.readFileSync(seedPath, 'utf8');
  const matches = content.match(/name:\s*'([^']+)'/g) || [];
  return matches.map(m => m.replace(/name:\s*'/, '').replace(/'$/, ''));
}

function extractGeneratorNames() {
  const genPath = path.join(__dirname, '..', 'src', 'database', 'exerciseGeneratorExpanded.ts');
  const content = fs.readFileSync(genPath, 'utf8');
  const matches = content.match(/baseName:\s*'([^']+)'/g) || [];
  return [...new Set(matches.map(m => m.replace(/baseName:\s*'/, '').replace(/'$/, '')))];
}

function extractExternalNames() {
  // External exercises have names from free-exercise-db JSON files
  return Object.keys(exerciseJsons);
}

// Build the map
const handcraftedNames = extractSeedNames();
const generatorNames = extractGeneratorNames();
const externalNames = extractExternalNames();

console.log(`\nExercise counts:`);
console.log(`  Handcrafted: ${handcraftedNames.length}`);
console.log(`  Generator base templates: ${generatorNames.length}`);
console.log(`  External (free-exercise-db): ${externalNames.length}`);

const allNames = [...new Set([...handcraftedNames, ...generatorNames, ...externalNames])];
console.log(`  Total unique names: ${allNames.length}\n`);

const mapping = {};
let matched = 0;
let unmatched = 0;
const unmatchedList = [];

for (const name of allNames) {
  const folder = findBestMatch(name);
  if (folder) {
    mapping[name] = folder;
    matched++;
  } else {
    unmatched++;
    unmatchedList.push(name);
  }
}

console.log(`\nResults:`);
console.log(`  Matched: ${matched}/${allNames.length} (${(matched/allNames.length*100).toFixed(1)}%)`);
console.log(`  Unmatched: ${unmatched}`);

if (unmatchedList.length > 0) {
  console.log(`\nUnmatched exercises (${unmatchedList.length}):`);
  unmatchedList.sort().forEach(n => console.log(`  - ${n}`));
}

// Now handle generated variations: They get prefixed like "Tempo Wall Push-up", "Pause Push-up" etc
// For these, we strip the variation prefix and match the base exercise
const variationPrefixes = [
  'Tempo ', 'Slow Tempo ', 'Fast ', 'Pause ', 'Paused ',
  'Isometric ', 'Explosive ', 'Plyometric ',
  'Single-leg ', 'Single-arm ', 'Single Leg ', 'Single Arm ',
  'Elevated ', 'Weighted ', 'Unilateral ',
  'One-Arm ', 'One-Leg ',
];

// For the generated exercises, also build variation->base mapping
const variationMapping = {};
for (const name of generatorNames) {
  if (mapping[name]) continue; // Already matched
  
  // Try stripping common variation prefixes
  for (const prefix of variationPrefixes) {
    const stripped = name.replace(new RegExp('^' + prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'), '');
    if (stripped !== name) {
      const folder = findBestMatch(stripped);
      if (folder) {
        mapping[name] = folder;
        break;
      }
    }
  }
  
  // Try stripping suffixes like "(fast)", "(slow)", "(each side)"
  if (!mapping[name]) {
    const stripped = name.replace(/\s*\([^)]+\)\s*$/, '').trim();
    if (stripped !== name) {
      const folder = findBestMatch(stripped);
      if (folder) {
        mapping[name] = folder;
      }
    }
  }
}

// Re-count
const finalMatched = Object.keys(mapping).length;
const finalUnmatched = allNames.filter(n => !mapping[n]);

console.log(`\nAfter variation matching:`);
console.log(`  Matched: ${finalMatched}/${allNames.length} (${(finalMatched/allNames.length*100).toFixed(1)}%)`);
console.log(`  Still unmatched: ${finalUnmatched.length}`);

if (finalUnmatched.length > 0 && finalUnmatched.length <= 100) {
  console.log(`\nStill unmatched:`);
  finalUnmatched.sort().forEach(n => console.log(`  - ${n}`));
}

// Comprehensive manual mappings — verified against actual folder names in free-exercise-db
const MANUAL_MAPPINGS = {
  // === PUSH-UP VARIANTS ===
  'Wall Push-up': 'Pushups',
  'Incline Push-up': 'Incline_Push-Up',
  'Knee Push-up': 'Pushups',
  'Standard Push-up': 'Pushups',
  'Push-up': 'Pushups',
  'Wide Push-up': 'Push-Up_Wide',
  'Diamond Push-up': 'Push-Ups_-_Close_Triceps_Position',
  'Pike Push-up': 'Handstand_Push-Ups',
  'Decline Push-up': 'Decline_Push-Up',
  'Clap Push-up': 'Plyo_Push-up',
  'One-Arm Push-up': 'Single-Arm_Push-Up',
  'Hindu Push-up': 'Pushups',
  'Archer Push-up': 'Pushups',
  'Spiderman Push-up': 'Push_Up_to_Side_Plank',
  'Typewriter Push-up': 'Pushups',
  'Pseudo Planche Push-up': 'Pushups',
  'Scapular Push-up': 'Pushups',
  'Plank to Push-up': 'Pushups',
  'Deficit Push-up': 'Push-Ups_With_Feet_Elevated',
  'Dive Bomber Push-up': 'Pushups',
  'Diamond Cutter Push-up': 'Push-Ups_-_Close_Triceps_Position',
  'Tempo Push-up': 'Pushups',
  'Ring Push-up': 'Suspended_Push-Up',
  'Weighted Push-up': 'Pushups',

  // === PULL / HANG / CHIN ===
  'Pull-up': 'Pullups',
  'Chin-up': 'Chin-Up',
  'Close Grip Chin-up': 'Chin-Up',
  'Neutral Grip Pull-up': 'Pullups',
  'Wide Grip Pull-up': 'Wide-Grip_Rear_Pull-Up',
  'Dead Hang': 'One_Handed_Hang',
  'Active Hang': 'One_Handed_Hang',
  'Bar Dead-hang': 'One_Handed_Hang',
  'Active Hang Scapular Elevations': 'Scapular_Pull-Up',
  'Scapular Pull': 'Scapular_Pull-Up',
  'Muscle-up': 'Muscle_Up',
  'Muscle-up Negative': 'Muscle_Up',
  'Strict Muscle-up': 'Muscle_Up',
  'Commando Pull-up': 'Pullups',
  'Archer Pull-up': 'Pullups',
  'L-Sit Pull-up': 'Pullups',
  'One-Arm Pull-up Progression': 'Pullups',
  'Inverted Row': 'Bodyweight_Mid_Row',
  'Ring Row': 'Bodyweight_Mid_Row',
  'Renegade Row': 'Alternating_Renegade_Row',
  'Front Lever Progression': 'Pullups',
  'Front Lever Row': 'Pullups',
  'Back Lever Progression': 'Pullups',
  'Back Lever Hold': 'Pullups',
  'Hanging Leg Raise (bent)': 'Hanging_Leg_Raise',
  'Hanging Knee Raise': 'Hanging_Leg_Raise',
  'Toes-to-bar': 'Hanging_Leg_Raise',
  'Toes to Bar': 'Hanging_Leg_Raise',
  'Spinal Decompression Hang': 'One_Handed_Hang',

  // === SQUATS / LUNGES / LEGS ===
  'Squat': 'Bodyweight_Squat',
  'Close-stance Squat': 'Bodyweight_Squat',
  'Jump Squat': 'Freehand_Jump_Squat',
  'Tempo Squat': 'Bodyweight_Squat',
  'Deep Squat Hold': 'Bodyweight_Squat',
  'Cossack Squat': 'Bodyweight_Squat',
  'Hindu Squat': 'Bodyweight_Squat',
  'Sumo Squat': 'Bodyweight_Squat',
  'Sumo Pulse': 'Bodyweight_Squat',
  'Squat to Stand': 'Bodyweight_Squat',
  'Squat to Press': 'Bodyweight_Squat',
  'Squat Jump 180': 'Freehand_Jump_Squat',
  'In and Out Squat Jump': 'Freehand_Jump_Squat',
  'Reactive Squat Jump': 'Freehand_Jump_Squat',
  'Shrimp Squat': 'Bodyweight_Squat',
  'Skater Squat': 'Bodyweight_Squat',
  'Sissy Squat': 'Weighted_Sissy_Squat',
  'Pistol Squat': 'Bodyweight_Squat',
  'Pistol Squat Progression': 'Bodyweight_Squat',
  'Pistol Box Squat': 'Box_Squat',
  'Bulgarian Split Squat': 'Elevated_Back_Lunge',
  'Wall Sit': 'Bodyweight_Squat',
  'Lunge': 'Dumbbell_Lunges',
  'Walking Lunge': 'Bodyweight_Walking_Lunge',
  'Reverse Lunge': 'Dumbbell_Rear_Lunge',
  'Reverse Lunge Pattern': 'Dumbbell_Rear_Lunge',
  'Reverse Lunge Knee Drive': 'Dumbbell_Rear_Lunge',
  'Reverse Lunge Twist': 'Dumbbell_Rear_Lunge',
  'Alternating Lunge': 'Dumbbell_Lunges',
  'Curtsy Lunge': 'Crossover_Reverse_Lunge',
  'Curtsy Lunge Jump': 'Crossover_Reverse_Lunge',
  'Lateral Lunge': 'Dumbbell_Lunges',
  'Lateral Lunge with Reach': 'Dumbbell_Lunges',
  'Lunge Pulse': 'Dumbbell_Lunges',
  'Lunge with Twist': 'Lunge_Pass_Through',
  'Static Lunge Hold': 'Dumbbell_Lunges',
  'Step Through Lunge': 'Dumbbell_Lunges',
  'Reaching Lunge': 'Dumbbell_Lunges',
  'Knee Hug to Lunge': 'Dumbbell_Lunges',
  'Weighted Lunge': 'Barbell_Lunge',
  'Step-up': 'Dumbbell_Step_Ups',
  'Lateral Step-Up': 'Dumbbell_Step_Ups',
  'Box Jump': 'Box_Jump_Multiple_Response',
  'Box Jump for Speed': 'Box_Jump_Multiple_Response',
  'Single Leg Box Jump': 'Box_Jump_Multiple_Response',
  'Calf Raise': 'Standing_Calf_Raises',
  'Single-leg Calf Raise': 'Standing_Dumbbell_Calf_Raise',
  'Single Leg Calf Raise Balance': 'Standing_Dumbbell_Calf_Raise',
  'Single-leg Deadlift': 'Kettlebell_One-Legged_Deadlift',
  'Single Leg Deadlift': 'Kettlebell_One-Legged_Deadlift',
  'Single Leg Deadlift Balance': 'Kettlebell_One-Legged_Deadlift',
  'Single Leg Romanian Deadlift Reach': 'Kettlebell_One-Legged_Deadlift',
  'Single Leg Hip Hinge': 'Kettlebell_One-Legged_Deadlift',
  'Single Leg Hip Thrust': 'Pelvic_Tilt_Into_Bridge',
  'Single Leg Squat to Chair': 'Chair_Squat',
  'Single Leg Press': 'Leg_Press',
  'Single Leg Reach': 'Kettlebell_One-Legged_Deadlift',
  'Single Leg Row': 'Bodyweight_Mid_Row',
  'Single Leg Stand': null,
  'Single Leg Stand Eyes Closed': null,
  'Nordic Curl': 'Natural_Glute_Ham_Raise',
  'Nordic Hamstring Curl': 'Natural_Glute_Ham_Raise',
  'Deadlift Pattern': 'Barbell_Deadlift',
  'Suitcase Deadlift': 'Barbell_Deadlift',

  // === CORE / ABS ===
  'Plank': 'Plank',
  'Side Plank': 'Side_Bridge',
  'Side Plank Dip': 'Side_Bridge',
  'Side-plank Hip Dip': 'Side_Bridge',
  'Reverse Plank': null,
  'High Plank Shoulder Tap': 'Plank',
  'Plank Shoulder Tap': 'Plank',
  'Plank Jack': 'Mountain_Climbers',
  'Plank Up Down': 'Plank',
  'Knee to Elbow Plank': 'Mountain_Climbers',
  'V-up': 'Jackknife_Sit-Up',
  'V-Up Jacks': 'Jackknife_Sit-Up',
  'Hollow-body Rock': 'Jackknife_Sit-Up',
  'Hollow Body Hold': null,
  'Leg Raise': 'Flat_Bench_Lying_Leg_Raise',
  'Bicycle Crunch': 'Air_Bike',
  'Russian Twist': 'Russian_Twist',
  'Dragon Flag': 'Hanging_Leg_Raise',
  'Dragon Flag Progression': 'Hanging_Leg_Raise',
  'Ab Wheel Rollout': 'Ab_Roller',
  'Flutter Kick': 'Flutter_Kicks',
  'Superman Hold': 'Superman',
  'Superman': 'Superman',
  'Reverse Snow Angel': 'Superman',
  'Windshield Wiper': 'Windmills',
  'Dead-bug': null,
  'Dead Bug for Posture': null,
  'Bird Dog': 'Superman',
  'Mountain Climber (fast)': 'Mountain_Climbers',
  'Mountain Climber Twist': 'Mountain_Climbers',
  'Cross-body Reach': 'Cross-Body_Crunch',
  'Cross Body Toe Touch': 'Cross-Body_Crunch',
  'Crab Toe Touch': 'Cross-Body_Crunch',
  'Woodchop': 'Standing_Cable_Wood_Chop',
  'Pallof Press with Band': null,

  // === GLUTES / HIPS ===
  'Glute Bridge': 'Barbell_Glute_Bridge',
  'Single-leg Glute Bridge': 'Single_Leg_Glute_Bridge',
  'Glute Bridge for Posture': 'Barbell_Glute_Bridge',
  'Glute Kickback': 'Glute_Kickback',
  'Donkey Kick': 'Glute_Kickback',
  'Fire Hydrant': 'IT_Band_and_Glute_Stretch',
  'Clamshell': 'Lying_Glute',
  'Hip Circle': 'Hip_Circles_prone',
  'Hip Hinge': 'Barbell_Deadlift',
  'Hip Hinge Pattern': 'Barbell_Deadlift',
  'Hip Hinge Drill (Good Morning)': 'Good_Morning',
  'Hip Flexor March': 'Kneeling_Hip_Flexor',
  'Hip Flexor Lunge Stretch': 'Kneeling_Hip_Flexor',
  'Hip Flexor Lunge for Posture': 'Kneeling_Hip_Flexor',
  'Quadruped Hip Circles': 'Hip_Circles_prone',
  'Standing Knee Drive': 'Knee_Tuck_Jump',
  'Standing Figure Four': 'Ankle_On_The_Knee',
  'Seated Figure Four': 'Ankle_On_The_Knee',
  'Shin Box Switch': 'Groin_and_Back_Stretch',

  // === HANDSTAND / BALANCE / BODYWEIGHT SKILL ===
  'Handstand Wall Hold': null,
  'Handstand Kick-up': null,
  'Headstand Practice': null,
  'Crow Pose': null,
  'Frog Stand': null,
  'L-sit (Parallettes)': null,
  'L-Sit': null,
  'L-Sit Hold': null,
  'Standing Balance': null,
  'Single-leg Balance': null,
  'Stork Stand': null,
  'Flamingo Stand': null,
  'BOSU Ball Stand': null,
  'Eyes Closed Balance': null,
  'Tandem Stand': null,
  'Airplane Balance': 'Kettlebell_One-Legged_Deadlift',
  'Tree Pose': null,
  'Warrior III': 'Kettlebell_One-Legged_Deadlift',
  'Half Moon Pose': 'Kettlebell_One-Legged_Deadlift',
  'Clock Reach': 'Kettlebell_One-Legged_Deadlift',
  'Compass Reach': 'Kettlebell_One-Legged_Deadlift',
  'Planche Lean': 'Pushups',
  'Ring Dip': 'Ring_Dips',
  'Weighted Dip': 'Dips_-_Chest_Version',
  'Dip': 'Dips_-_Chest_Version',
  'Bench Dip': 'Bench_Dips',

  // === DIP VARIANTS ===

  // === CARDIO / PLYOMETRICS / SPEED ===
  'Burpee': 'Freehand_Jump_Squat',
  'Burpee with Tuck Jump': 'Knee_Tuck_Jump',
  'Half Burpee': 'Freehand_Jump_Squat',
  'Squat Thrust': 'Freehand_Jump_Squat',
  'Sprawl': 'Freehand_Jump_Squat',
  'Bear Crawl': 'Bear_Crawl_Sled_Drags',
  'Bear Crawl Sprint': 'Bear_Crawl_Sled_Drags',
  'Crab Walk': 'Bear_Crawl_Sled_Drags',
  'Gecko Walk': 'Bear_Crawl_Sled_Drags',
  'Lizard Walk': 'Inchworm',
  'Crawl Pattern': 'Bear_Crawl_Sled_Drags',
  'High Knees': 'Jogging_Treadmill',
  'High-knee Sprint on Spot': 'Jogging_Treadmill',
  'Jumping Jack': 'Star_Jump',
  'Jumping Jacks': 'Star_Jump',
  'Cross Jacks': 'Star_Jump',
  'Seal Jack': 'Star_Jump',
  'Power Jack': 'Star_Jump',
  'Star Jump': 'Star_Jump',
  'Tuck Jump': 'Knee_Tuck_Jump',
  'Broad Jump': 'Frog_Hops',
  'Forward Bound': 'Frog_Hops',
  'Frog Jump': 'Frog_Hops',
  'Triple Hop': 'Frog_Hops',
  'Pogo Jump': 'Rope_Jumping',
  'Rotational Jump': 'Freehand_Jump_Squat',
  'Lateral Shuffle': 'Side_to_Side_Box_Shuffle',
  'Skaters': 'Side_to_Side_Box_Shuffle',
  'Speed Skater': 'Side_to_Side_Box_Shuffle',
  'Shuffle Cut': 'Side_to_Side_Box_Shuffle',
  'A-Skip': 'Jogging_Treadmill',
  'A-skip': 'Jogging_Treadmill',
  'B-skip': 'Jogging_Treadmill',
  'Power Skip': 'Jogging_Treadmill',
  'Butt-kick Sprint': 'Double_Leg_Butt_Kick',
  'Butt Kicks': 'Double_Leg_Butt_Kick',
  'Sprint Intervals': 'Wind_Sprints',
  'Sprint in Place': 'Wind_Sprints',
  'Sprint Start': 'Wind_Sprints',
  'Sand Sprint': 'Wind_Sprints',
  'Hill Sprint': 'Wind_Sprints',
  'Tabata Sprint': 'Wind_Sprints',
  'Zigzag Sprint': 'Wind_Sprints',
  'Backpedal Sprint': 'Wind_Sprints',
  'Wind Sprints': 'Wind_Sprints',
  'Inchworm': 'Inchworm',
  'Frankenstein Walk': 'Bodyweight_Walking_Lunge',
  'Jump Rope': 'Rope_Jumping',
  'Single Leg Hop': 'Rope_Jumping',
  'Lateral Hop and Stick': 'Rope_Jumping',
  'Line Hop': 'Rope_Jumping',
  'Reactive Start': 'Wind_Sprints',
  'Runner Touch': 'Runners_Stretch',
  'Carioca Drill': 'Side_to_Side_Box_Shuffle',
  'Crossover Step': 'Side_to_Side_Box_Shuffle',
  'Cone Drill': 'Wind_Sprints',
  'Pro Agility Shuttle': 'Wind_Sprints',
  'Agility T-Drill': 'Wind_Sprints',
  'L-Drill': 'Wind_Sprints',
  'Fast Feet Drill': 'Wind_Sprints',
  'Defensive Shuffle': 'Side_to_Side_Box_Shuffle',
  'Defensive Slides': 'Side_to_Side_Box_Shuffle',
  'Touchdown Shuffle': 'Side_to_Side_Box_Shuffle',
  'Drop Step': 'Wind_Sprints',
  'Vertical Jump Training': 'Freehand_Jump_Squat',
  'Front Kick': 'Knee_Tuck_Jump',
  'Side Kick': 'Knee_Tuck_Jump',
  'Cross Punch': 'Chest_Push_with_Run_Release',
  'Uppercut': 'Chest_Push_with_Run_Release',
  'Knee Strike': 'Knee_Tuck_Jump',
  'Throwing Motion': 'One-Arm_Medicine_Ball_Slam',
  'Medicine Ball Rotation Pass': 'Medicine_Ball_Full_Twist',
  'Rotational Press': 'Alternating_Kettlebell_Press',

  // === CARRIES ===
  'Farmers Carry': 'Farmers_Walk',
  'Suitcase Carry': 'Farmers_Walk',
  'Overhead Carry': 'Farmers_Walk',
  'Rack Carry': 'Farmers_Walk',
  'Cross Carry': 'Farmers_Walk',
  'Waiter Carry': 'Farmers_Walk',

  // === FLEXIBILITY / STRETCHING ===
  'Cobra Pose': null,
  'Cobra Stretch': null,
  'Cat-Camel': 'Cat_Stretch',
  'Cat-Cow Stretch': 'Cat_Stretch',
  'Thoracic Rotation': 'Cat_Stretch',
  'Thoracic Spine Rotation': 'Cat_Stretch',
  'Kneeling Thoracic Rotation': 'Cat_Stretch',
  'Standing Thoracic Rotation': 'Cat_Stretch',
  'Quadruped Thoracic Extension': 'Cat_Stretch',
  'T-Spine Book Opener': 'Cat_Stretch',
  'Thread the Needle': 'Cat_Stretch',
  'Thread the Needle Stretch': 'Cat_Stretch',
  'Thoracic Extension': 'Cat_Stretch',
  'Thoracic Extension (Foam Roller)': 'Cat_Stretch',
  'Thoracic Extension Over Roller': 'Cat_Stretch',
  'Standing Forward Fold': 'Standing_Toe_Touches',
  'Seated Forward Fold': 'Seated_Floor_Hamstring_Stretch',
  'Seated Straddle Stretch': 'Seated_Floor_Hamstring_Stretch',
  'Seated Twist': 'Seated_Floor_Hamstring_Stretch',
  'Hamstring Stretch': 'Seated_Floor_Hamstring_Stretch',
  'Standing Quad Stretch': 'All_Fours_Quad_Stretch',
  'Standing Quad Pull': 'All_Fours_Quad_Stretch',
  'Standing Quad Pull Balance': 'All_Fours_Quad_Stretch',
  'Reclined Butterfly': 'Butterfly',
  'Reclining Butterfly': 'Butterfly',
  'Butterfly Stretch': 'Butterfly',
  'Butterfly Stretch Deep': 'Butterfly',
  'Happy Baby': 'Butterfly',
  'Happy Baby Pose': 'Butterfly',
  'Pigeon Pose': 'Groiners',
  'Scorpion Stretch': 'Groin_and_Back_Stretch',
  'King Arthur Stretch': 'All_Fours_Quad_Stretch',
  'Front Split (Half-split)': 'Groin_and_Back_Stretch',
  'Side Split (Middle Split)': 'Groin_and_Back_Stretch',
  'Frog Stretch': 'Groin_and_Back_Stretch',
  'Gate Stretch': 'Groin_and_Back_Stretch',
  'Bretzel Stretch': 'Groin_and_Back_Stretch',
  'Downward Dog': 'Downward_Facing_Balance',
  'Upward Dog': 'Downward_Facing_Balance',
  'Neck Rolls': 'Neck_Press',
  'Neck Side Stretch': 'Neck_Press',
  'Lateral Neck Stretch': 'Neck_Press',
  'Neck Retraction': 'Neck_Press',
  'Chin Tucks': 'Chin_To_Chest_Stretch',
  'Chin Tuck Against Wall': 'Chin_To_Chest_Stretch',
  'Ankle Circles': 'Ankle_Circles',
  'Ankle Alphabet': 'Ankle_Circles',
  'Wrist Circles and Stretches': 'Wrist_Circles',
  'Wrist Flexion Extension': 'Wrist_Circles',
  'Shoulder Stretch': 'Shoulder_Stretch',
  'Shoulder Cross-Body Stretch': 'Shoulder_Stretch',
  'Sleeper Stretch': 'Shoulder_Stretch',
  'Chest Opener Stretch': 'Chest_Stretch_on_Stability_Ball',
  'Chest Doorway Stretch': 'Chest_Stretch_on_Stability_Ball',
  'Doorway Chest Stretch': 'Chest_Stretch_on_Stability_Ball',
  'Wall Chest Stretch': 'Chest_Stretch_on_Stability_Ball',
  'Hip Flexor Stretch': 'Kneeling_Hip_Flexor',
  'Wall Hip Flexor Stretch': 'Kneeling_Hip_Flexor',
  'Knee-to-chest Supine': 'One_Knee_To_Chest',
  'Supine Knee to Chest': 'Hug_Knees_To_Chest',
  'Knee Hug': 'Hug_Knees_To_Chest',
  'Jefferson Curl': null,
  'Jefferson Curl (Light)': null,
  'Wall Angels': null,
  'Wall Slide Recovery': null,
  'Lat Stretch': 'Close-Grip_Front_Lat_Pulldown',
  'Cow Face Arms': 'Shoulder_Stretch',
  'Prone Press Up': null,
  'Prayer Stretch': 'Cat_Stretch',
  'Reclined Hero Pose': 'All_Fours_Quad_Stretch',
  'Supported Fish Pose': 'Cat_Stretch',
  'Dynamic Arm Swings': 'Dynamic_Chest_Stretch',
  'Dynamic Leg Swing Forward': 'Standing_Toe_Touches',
  'Dynamic Leg Swing Lateral': 'Dumbbell_Lunges',
  'Lying Spinal Twist': 'Groin_and_Back_Stretch',
  'Supine Spinal Twist': 'Groin_and_Back_Stretch',
  'Supine Spinal Twist Stretch': 'Groin_and_Back_Stretch',
  'Spinal Wave': 'Cat_Stretch',
  'Spine Twist': 'Groin_and_Back_Stretch',
  'Standing Side Bend': 'Dumbbell_Side_Bend',
  'Legs Up Wall': 'Flat_Bench_Lying_Leg_Raise',
  'Reverse Table': null,

  // === POSTURE ===
  'Prone T Raise': 'Superman',
  'Prone T Raise Hold': 'Superman',
  'Prone W Raise': 'Superman',
  'Prone W Raise Hold': 'Superman',
  'Prone Y Raise': 'Superman',
  'Prone Y Raise Hold': 'Superman',
  'I-Y-T Raise': 'Superman',
  'Scapular Squeeze': 'Superman',
  'Band Pull-apart': 'Band_Pull_Apart',
  'Face Pull with Band': 'Face_Pull',
  'Seated Row': 'Seated_Cable_Rows',
  'Row Pattern': 'Seated_Cable_Rows',
  'Push-Pull Pattern': 'Pushups',
  'Overhead Press Pattern': 'Shoulder_Press_-_With_Bands',
  'Side Bend': 'Barbell_Side_Bend',
  'Banded Good Morning': 'Band_Good_Morning',
  'Half-kneeling Chop': 'Standing_Cable_Wood_Chop',

  // === FOAM ROLLING / RECOVERY ===
  'Foam Rolling': 'IT_Band_and_Glute_Stretch',
  'Foam Roll Adductors': 'IT_Band_and_Glute_Stretch',
  'Foam Roll Calves': 'IT_Band_and_Glute_Stretch',
  'Foam Roll Chest': 'IT_Band_and_Glute_Stretch',
  'Foam Roll Glutes': 'IT_Band_and_Glute_Stretch',
  'Foam Roll Hamstrings': 'IT_Band_and_Glute_Stretch',
  'Foam Roll IT Band': 'IT_Band_and_Glute_Stretch',
  'Foam Roll Lats': 'IT_Band_and_Glute_Stretch',
  'Foam Roll Quads': 'IT_Band_and_Glute_Stretch',
  'Foam Roll TFL': 'IT_Band_and_Glute_Stretch',
  'Foam Roll Upper Back': 'IT_Band_and_Glute_Stretch',
  'Lacrosse Ball Foot Roll': 'IT_Band_and_Glute_Stretch',
  'Lacrosse Ball Glute Release': 'IT_Band_and_Glute_Stretch',
  'Lacrosse Ball Shoulder Release': 'IT_Band_and_Glute_Stretch',
  'Ball Trap Release': 'IT_Band_and_Glute_Stretch',
  'Active Recovery Walk': 'Bodyweight_Walking_Lunge',
  'Supine Twist Recovery': 'Groin_and_Back_Stretch',
  'Tension Release Shake': 'Star_Jump',
  'Gentle Flow Sequence': 'Cat_Stretch',
  'Get Up from Floor': 'Dumbbell_Squat',

  // === TURKISH GET-UP ===
  'Turkish Get-Up': 'Kettlebell_Turkish_Get-Up_Lunge_style',

  // === BREATHING / MEDITATION / MINDFULNESS ===
  'Box Breathing': 'Stomach_Vacuum',
  'Power Breathing': 'Stomach_Vacuum',
  'Breath Work': 'Stomach_Vacuum',
  '4-7-8 Breathing': 'Stomach_Vacuum',
  'Diaphragmatic Breathing': 'Stomach_Vacuum',
  'Crocodile Breath': 'Stomach_Vacuum',
  'Alternate Nostril Breathing': 'Stomach_Vacuum',
  'Extended Exhale Breathing': 'Stomach_Vacuum',
  'Cold Exposure Breathing': 'Stomach_Vacuum',
  'Focus Breathing 5-5-5': 'Stomach_Vacuum',
  'Body Scan Meditation': 'Stomach_Vacuum',
  'Seated Meditation': 'Stomach_Vacuum',
  'Walking Meditation': 'Bodyweight_Walking_Lunge',
  'Loving-Kindness Meditation': 'Stomach_Vacuum',
  'Mindful Movement': 'Stomach_Vacuum',
  'Focus Drill': 'Stomach_Vacuum',
  'Concentration Circuit': 'Stomach_Vacuum',
  'Meditation': 'Stomach_Vacuum',
  'Visualization': 'Stomach_Vacuum',
  'Progressive Muscle Relaxation': 'Stomach_Vacuum',
  'Gratitude Practice': 'Stomach_Vacuum',
  'Grounding Exercise 5-4-3-2-1': 'Stomach_Vacuum',
  'Bilateral Tapping': 'Stomach_Vacuum',
  'Laughing Yoga': 'Stomach_Vacuum',
  'Yoga Nidra': 'Stomach_Vacuum',
  'Tai Chi Flow': 'Stomach_Vacuum',

  // === MOBILITY / DYNAMIC ===
  'Mobility Flow': 'Groin_and_Back_Stretch',
  'Joint Circles': 'Ankle_Circles',
  'Dynamic Stretching': 'Groin_and_Back_Stretch',
  'PNF Stretching': 'Groin_and_Back_Stretch',
  'Loaded Stretch': 'Groin_and_Back_Stretch',
  'Active Flexibility': 'Groin_and_Back_Stretch',
  'Passive Flexibility': 'Groin_and_Back_Stretch',
  '90/90 Hip Stretch': '90_90_Hamstring',
  'Heel to Toe Walk': 'Bodyweight_Walking_Lunge',
  'Heel-toe Walk': 'Bodyweight_Walking_Lunge',
  'Tandem Walk': 'Bodyweight_Walking_Lunge',
  'Duck Walk': 'Bodyweight_Squat',
  'Cartwheel': 'Star_Jump',

  // === CHILD'S POSE (escaped name) ===
  "Child\\'s Pose": 'Cat_Stretch',
  "Child'\\s Pose": 'Cat_Stretch',
  'Child\\': 'Cat_Stretch',
  "World\\'s Greatest Stretch": 'Groin_and_Back_Stretch',
  'World\\': 'Groin_and_Back_Stretch',

  // === PREVIOUSLY UNMATCHED — manual curation ===
  'BOSU Ball Stand': 'Bosu_Ball_Cable_Crunch_With_Side_Bends',
  'Cobra Pose': 'Cobra_Pose',
  'Cobra Stretch': 'Cobra_Pose',
  'Cross-Body Shoulder Stretch': 'Shoulder_Stretch',
  'Dead Bug for Posture': 'Dead_Bug',
  'Depth Jump': 'Depth_Jump_Leap',
  'Eyes Closed Balance': 'Tree_Pose',
  'Flamingo Stand': 'Tree_Pose',
  'Frog Stand': 'Crane_Crow_Pose',
  'Handstand Wall Hold': 'Handstand',
  'Hip Circles': 'Standing_Hip_Circles',
  'Hollow Body Hold': 'Plank',
  'Jefferson Curl': 'Standing_Forward_Bend',
  'Jefferson Curl (Light)': 'Standing_Forward_Bend',
  'Kneeling Hip Flexor Stretch': 'Kneeling_Hip_Flexor',
  'L-Sit': 'Scale_Pose',
  'L-Sit Hold': 'Scale_Pose',
  'L-sit (Parallettes)': 'Scale_Pose',
  'Medicine Ball Slam': 'One-Arm_Medicine_Ball_Slam',
  'Pallof Press with Band': 'Pallof_Press',
  'Plank Run': 'Mountain_Climbers',
  'Prone Press Up': 'Cobra_Pose',
  'Prone Quad Stretch': 'On-Your-Back_Quad_Stretch',
  'Reverse Plank': 'Upward_Plank_Pose',
  'Reverse Table': 'Upward_Plank_Pose',
  'Single Leg Stand': 'Tree_Pose',
  'Single Leg Stand Eyes Closed': 'Tree_Pose',
  'Standing Hamstring Stretch': 'Standing_Hamstring_and_Calf_Stretch',
  'Stork Stand': 'Tree_Pose',
  'Tandem Stand': 'Mountain_Pose',
  'Tree Pose': 'Tree_Pose',
  'Tricep Overhead Stretch': 'Triceps_Stretch',
  'Wall Angels': 'One_Arm_Against_Wall',
  'Wall Slide Recovery': 'One_Arm_Against_Wall',

  // === YOGA POSES (from yoga-poses-dataset) ===
  'Mountain Pose': 'Mountain_Pose',
  'Chair Pose': 'Chair_Pose',
  'Warrior I Pose': 'Warrior_I_Pose',
  'Warrior II Pose': 'Warrior_II_Pose',
  'Extended Triangle Pose': 'Extended_Triangle_Pose',
  'Extended Side Angle Pose': 'Extended_Side_Angle_Pose',
  'Revolved Triangle Pose': 'Revolved_Triangle_Pose',
  'Revolved Side Angle Pose': 'Revolved_Side_Angle_Pose',
  'Garland Pose': 'Garland_Pose',
  'Eagle Pose': 'Eagle_Pose',
  'Lord of the Dance Pose': 'Lord_of_the_Dance_Pose',
  'Staff Pose': 'Staff_Pose',
  'Boat Pose': 'Boat_Pose',
  'Head-to-Knee Forward Bend': 'Head-to-Knee_Forward_Bend',
  'Half Lord of the Fishes Pose': 'Half_Lord_of_the_Fishes_Pose',
  'Lotus Pose': 'Lotus_Pose',
  'Scale Pose': 'Scale_Pose',
  'Cobra Pose': 'Cobra_Pose',
  'Upward-Facing Dog Pose': 'Upward-Facing_Dog_Pose',
  'Camel Pose': 'Camel_Pose',
  'Bow Pose': 'Bow_Pose',
  'Bridge Pose': 'Bridge_Pose',
  'Upward Bow (Wheel) Pose': 'Upward_Bow_Wheel_Pose',
  'Sphinx Pose': 'Sphinx_Pose',
  'Crane (Crow) Pose': 'Crane_Crow_Pose',
  'Dolphin Pose': 'Dolphin_Pose',
  'Supported Headstand': 'Supported_Headstand',
  'Supported Shoulderstand': 'Supported_Shoulderstand',
  'Plow Pose': 'Plow_Pose',
  'Corpse Pose': 'Corpse_Pose',
  'Reclining Bound Angle Pose': 'Reclining_Bound_Angle_Pose',
  'Crocodile Pose': 'Crocodile_Pose',
  'Big Toe Pose': 'Big_Toe_Pose',
  'Wide-Legged Forward Bend': 'Wide-Legged_Forward_Bend',
  'Extended Hand-To-Big-Toe Pose': 'Extended_Hand-To-Big-Toe_Pose',
  'Four-Limbed Staff Pose': 'Four-Limbed_Staff_Pose',
  'Upward Plank Pose': 'Upward_Plank_Pose',
  'Locust Pose': 'Locust_Pose',
  'Cat Pose': 'Cat_Pose',
  'Cat Cow Pose': 'Cat_Cow_Pose',
  'Cow Pose': 'Cow_Pose',
  'Fish Pose': 'Fish_Pose',
  'Gate Pose': 'Gate_Pose',
  'Heron Pose': 'Heron_Pose',
  'Hero Pose': 'Hero_Pose',
  'Lion Pose': 'Lion_Pose',
  'Easy Pose': 'Easy_Pose',
  'Fire Log Pose': 'Fire_Log_Pose',
  'Thunderbolt Pose': 'Thunderbolt_Pose',
  'Wild Thing': 'Wild_Thing',
  'Handstand': 'Handstand',
  'Dolphin Plank Pose': 'Dolphin_Plank_Pose',
  'Side Plank Pose': 'Side_Plank_Pose',
  'Feathered Peacock Pose': 'Feathered_Peacock_Pose',
  'Scorpion Pose': 'Scorpion_Pose',
  'Standing Split': 'Standing_Split',
  'Standing Half Forward Bend': 'Standing_Half_Forward_Bend',
  'Upward Salute': 'Upward_Salute',
  'Low Lunge': 'Low_Lunge',
  'High Lunge': 'High_Lunge',
  'Half Moon Pose': 'Half_Moon_Pose',
  'Warrior III': 'Warrior_III_Pose',
};

// Apply manual mappings (override any existing match — manual is curated)
for (const [name, folder] of Object.entries(MANUAL_MAPPINGS)) {
  if (folderByOriginal[folder]) {
    mapping[name] = folder;
  } else {
    console.warn(`⚠ Manual mapping "${name}" → "${folder}" — folder not found!`);
  }
}

// Also try matching exercises with apostrophes (Child's Pose, World's Greatest Stretch)
for (const name of allNames) {
  if (mapping[name]) continue;
  // Normalized apostrophe forms
  const variants = [
    name.replace(/\\'/g, "'"),
    name.replace(/'/g, "\\'"),
    name.replace(/[''`]/g, "'"),
  ];
  for (const v of variants) {
    if (MANUAL_MAPPINGS[v] && folderByOriginal[MANUAL_MAPPINGS[v]]) {
      mapping[name] = MANUAL_MAPPINGS[v];
      break;
    }
  }
  // Also try partial key match for Child's, World's etc
  if (!mapping[name]) {
    const cleanName = name.replace(/[\\''`]/g, '').toLowerCase();
    for (const [key, folder] of Object.entries(MANUAL_MAPPINGS)) {
      const cleanKey = key.replace(/[\\''`]/g, '').toLowerCase();
      if (cleanName === cleanKey) {
        if (folder === null) {
          // Explicitly null — no good image, skip (will show placeholder)
          break;
        }
        if (folderByOriginal[folder]) {
          mapping[name] = folder;
          break;
        }
      }
    }
  }
}

// Try variation prefix stripping on ALL unmapped exercises (not just generator)
for (const name of allNames) {
  if (mapping[name]) continue;
  for (const prefix of variationPrefixes) {
    const stripped = name.replace(new RegExp('^' + prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'), '');
    if (stripped !== name) {
      // Check manual mappings first
      if (stripped in MANUAL_MAPPINGS) {
        const folder = MANUAL_MAPPINGS[stripped];
        if (folder === null) break; // explicitly no image
        if (folderByOriginal[folder]) {
          mapping[name] = folder;
          break;
        }
      }
      // Then check existing mapping
      if (mapping[stripped]) {
        mapping[name] = mapping[stripped];
        break;
      }
      // Then fuzzy match
      const folder = findBestMatch(stripped);
      if (folder) {
        mapping[name] = folder;
        break;
      }
    }
  }
  // Also try stripping parenthetical suffixes
  if (!mapping[name]) {
    const stripped = name.replace(/\s*\([^)]+\)\s*$/, '').trim();
    if (stripped !== name) {
      if (mapping[stripped]) {
        mapping[name] = mapping[stripped];
      } else if (MANUAL_MAPPINGS[stripped] && folderByOriginal[MANUAL_MAPPINGS[stripped]]) {
        mapping[name] = MANUAL_MAPPINGS[stripped];
      }
    }
  }
}

// Final count
const totalMapped = Object.keys(mapping).length;
const stillUnmatched = allNames.filter(n => !mapping[n]);
console.log(`\nFinal after manual mappings:`);
console.log(`  Matched: ${totalMapped}/${allNames.length} (${(totalMapped/allNames.length*100).toFixed(1)}%)`);
console.log(`  Still unmatched: ${stillUnmatched.length}`);

if (stillUnmatched.length > 0) {
  console.log(`\nRemaining unmatched:`);
  stillUnmatched.sort().forEach(n => console.log(`  - ${n}`));
}

// Generate TypeScript output
const tsContent = `/**
 * Exercise Image Mapping - Auto-generated
 * Maps exercise names to free-exercise-db image folder names.
 * Generated on ${new Date().toISOString().split('T')[0]}
 * Coverage: ${totalMapped}/${allNames.length} exercises (${(totalMapped/allNames.length*100).toFixed(1)}%)
 */

// Maps exercise name → image folder name in assets/exercises/
export const EXERCISE_IMAGE_MAP: Record<string, string> = ${JSON.stringify(mapping, null, 2)};

/**
 * Resolve an exercise name to its image folder.
 * Tries: exact match → normalized match → fuzzy match → null
 */
export function resolveExerciseImageFolder(exerciseName: string): string | null {
  // 1. Direct lookup
  if (EXERCISE_IMAGE_MAP[exerciseName]) return EXERCISE_IMAGE_MAP[exerciseName];
  
  // 2. Case-insensitive lookup
  const lower = exerciseName.toLowerCase();
  for (const [name, folder] of Object.entries(EXERCISE_IMAGE_MAP)) {
    if (name.toLowerCase() === lower) return folder;
  }
  
  // 3. Strip variation prefixes and try again
  const prefixes = ['Tempo ', 'Slow ', 'Fast ', 'Pause ', 'Paused ', 'Isometric ', 'Explosive ', 
    'Plyometric ', 'Single-leg ', 'Single-arm ', 'Elevated ', 'Weighted ', 'Unilateral ',
    'One-Arm ', 'One-Leg ', 'Banded '];
  for (const prefix of prefixes) {
    if (exerciseName.startsWith(prefix)) {
      const base = exerciseName.slice(prefix.length);
      if (EXERCISE_IMAGE_MAP[base]) return EXERCISE_IMAGE_MAP[base];
    }
  }
  
  // 4. Strip parenthetical suffixes
  const stripped = exerciseName.replace(/\\s*\\([^)]+\\)\\s*$/, '').trim();
  if (stripped !== exerciseName && EXERCISE_IMAGE_MAP[stripped]) {
    return EXERCISE_IMAGE_MAP[stripped];
  }
  
  // 5. Try underscore version as folder name directly
  const underscored = exerciseName.replace(/[\\s]+/g, '_').replace(/[(),']/g, '');
  // Return underscored as potential folder (ExerciseImage will verify existence)
  // If folder doesn't exist, ExerciseImage shows placeholder
  return underscored || null;
}
`;

const outputPath = path.join(__dirname, '..', 'src', 'services', 'exerciseImageMap.ts');
fs.writeFileSync(outputPath, tsContent);
console.log(`\nWrote mapping to ${outputPath}`);

// Also verify which folders are in assets vs only in workspace-repos
const assetFolders = new Set(fs.readdirSync(ASSETS_DIR).filter(f => 
  fs.statSync(path.join(ASSETS_DIR, f)).isDirectory()
));

let missingFromAssets = 0;
const foldersToAdd = new Set();
for (const folder of Object.values(mapping)) {
  if (!assetFolders.has(folder)) {
    missingFromAssets++;
    foldersToAdd.add(folder);
  }
}

console.log(`\nAsset verification:`);
console.log(`  Folders in APK assets: ${assetFolders.size}`);
console.log(`  Mapped folders missing from assets: ${missingFromAssets}`);
if (foldersToAdd.size > 0) {
  console.log(`  Need to copy ${foldersToAdd.size} folders to assets`);
}
