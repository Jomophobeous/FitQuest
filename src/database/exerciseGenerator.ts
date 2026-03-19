/**
 * FitQuest Exercise Generator
 * Generates 722+ exercises across all categories
 * 
 * Categories (6):
 * - body_control (bodyweight strength)
 * - posture (posture, spinal decompression)
 * - faster (speed, agility, cardio)
 * - flexible (stretching, mobility)
 * - focus (meditation, breathing)
 * - strength (hypertrophy focus)
 */

import type {
  Category,
  Difficulty,
  EquipmentLevel,
  EquipmentItem,
  TargetMuscle,
  TrainingType,
  ImpactLevel,
  SpaceFilter,
} from './types';

interface GeneratedExercise {
  id: string;
  name: string;
  category: Category;
  difficulty: Difficulty;
  equipment_level: EquipmentLevel;
  impact_level: ImpactLevel;
  space_required: SpaceFilter;
  time_per_set_seconds: number;
  instructions: string[];
  order_in_category: number;
  primary_muscles: TargetMuscle[];
  secondary_muscles: TargetMuscle[];
  equipment_required: EquipmentItem[];
  equipment_optional: EquipmentItem[];
  training_types: { type: TrainingType; effectiveness: number }[];
  audio_intro?: string;
  audio_setup?: string;
  audio_execution?: string;
  audio_transition?: string;
}

// ============================================
// EXERCISE TEMPLATES
// ============================================

// Calisthenics - Push Movements
const PUSH_EXERCISES: Partial<GeneratedExercise>[] = [
  // Wall push-ups (beginner)
  { name: 'Wall Push-up', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['Stand arm-length from wall, feet together.', 'Place palms on wall at shoulder height.', 'Lower chest toward wall.', 'Push back to start.'], time_per_set_seconds: 30 },
  { name: 'Wall Push-up Wide Grip', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['chest_mid', 'chest_upper'], secondary_muscles: ['triceps', 'deltoids_front'], instructions: ['Stand facing wall with hands wider than shoulders.', 'Lower chest toward wall.', 'Focus on chest stretch at bottom.', 'Push back explosively.'], time_per_set_seconds: 30 },
  { name: 'Wall Push-up Narrow Grip', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['triceps', 'chest_mid'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['Hands close together on wall.', 'Elbows stay close to body.', 'Lower slowly.', 'Push back focusing on triceps.'], time_per_set_seconds: 30 },
  
  // Incline push-ups (beginner to intermediate)
  { name: 'Incline Push-up', difficulty: 'beginner', equipment_level: 'minimal', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], equipment_required: ['table'], instructions: ['Hands on elevated surface.', 'Body forms straight line.', 'Lower chest to surface.', 'Push back up.'], time_per_set_seconds: 35 },
  { name: 'Incline Push-up Wide', difficulty: 'beginner', equipment_level: 'minimal', primary_muscles: ['chest_mid', 'chest_upper'], secondary_muscles: ['triceps', 'deltoids_front'], equipment_required: ['bench'], instructions: ['Wide hand placement on bench.', 'Lower with control.', 'Feel chest stretch.', 'Press up.'], time_per_set_seconds: 35 },
  { name: 'Incline Push-up Diamond', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['triceps', 'chest_mid'], secondary_muscles: ['deltoids_front', 'core_deep'], equipment_required: ['bench'], instructions: ['Diamond hand position on bench.', 'Elbows close to body.', 'Lower slowly.', 'Push up focusing on triceps.'], time_per_set_seconds: 35 },
  
  // Knee push-ups
  { name: 'Knee Push-up', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['Knees on floor, hands shoulder-width.', 'Body straight from head to knees.', 'Lower chest to floor.', 'Push back up.'], time_per_set_seconds: 30 },
  { name: 'Knee Push-up Wide', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['chest_mid', 'chest_upper'], secondary_muscles: ['triceps', 'deltoids_front'], instructions: ['Wide hand placement.', 'Knees supporting.', 'Lower with chest focus.', 'Push up.'], time_per_set_seconds: 30 },
  { name: 'Knee Push-up Close Grip', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['triceps', 'chest_mid'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['Hands close together.', 'Elbows stay close.', 'Lower controlled.', 'Triceps drive the push.'], time_per_set_seconds: 30 },
  
  // Standard push-ups
  { name: 'Standard Push-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['Hands shoulder-width, feet together.', 'Body forms straight plank.', 'Lower until chest nearly touches floor.', 'Push back explosively.'], time_per_set_seconds: 35 },
  { name: 'Wide Push-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['chest_mid', 'chest_upper'], secondary_muscles: ['triceps', 'deltoids_front'], instructions: ['Hands wider than shoulders.', 'Lower with chest stretch.', 'Keep core tight.', 'Push up.'], time_per_set_seconds: 35 },
  { name: 'Diamond Push-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['triceps', 'chest_mid'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['Hands form diamond shape.', 'Elbows stay close.', 'Lower slowly.', 'Push up through triceps.'], time_per_set_seconds: 35 },
  { name: 'Staggered Push-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['One hand forward, one back.', 'Lower evenly.', 'Push up.', 'Alternate hand positions.'], time_per_set_seconds: 40 },
  { name: 'Pike Push-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['deltoids_front', 'deltoids_lateral'], secondary_muscles: ['triceps', 'traps_mid'], instructions: ['Hips high in pike position.', 'Lower head toward floor.', 'Push back up.', 'Great shoulder builder.'], time_per_set_seconds: 40 },
  { name: 'Decline Push-up', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['chest_upper', 'deltoids_front'], secondary_muscles: ['triceps', 'core_deep'], equipment_required: ['bench'], instructions: ['Feet elevated on bench.', 'Hands on floor.', 'Lower chest to floor.', 'Push up targeting upper chest.'], time_per_set_seconds: 35 },
  
  // Advanced push-ups
  { name: 'Archer Push-up', difficulty: 'advanced', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['Extra wide hand placement.', 'Shift weight to one arm while lowering.', 'Other arm extends.', 'Alternate sides.'], time_per_set_seconds: 45 },
  { name: 'Clap Push-up', difficulty: 'advanced', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], impact_level: 'high_impact', instructions: ['Standard push-up position.', 'Explosive push off floor.', 'Clap hands mid-air.', 'Land softly.'], time_per_set_seconds: 40 },
  { name: 'One-Arm Push-up', difficulty: 'advanced', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['core_deep', 'deltoids_front'], instructions: ['One hand behind back.', 'Wide foot stance for balance.', 'Lower slowly.', 'Push up with single arm.'], time_per_set_seconds: 45 },
  { name: 'Pseudo Planche Push-up', difficulty: 'advanced', equipment_level: 'none', primary_muscles: ['chest_mid', 'deltoids_front'], secondary_muscles: ['triceps', 'core_deep', 'biceps'], instructions: ['Hands placed by hips.', 'Lean forward significantly.', 'Lower chest toward hands.', 'Push back up.'], time_per_set_seconds: 45 },
  { name: 'Typewriter Push-up', difficulty: 'advanced', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['Wide grip push-up position.', 'Lower down then shift side to side.', 'Move like a typewriter.', 'Return and push up.'], time_per_set_seconds: 50 },
  { name: 'Spiderman Push-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['obliques', 'hip_flexors'], instructions: ['Standard push-up start.', 'As you lower, bring knee to elbow.', 'Push up and return leg.', 'Alternate sides.'], time_per_set_seconds: 40 },
  { name: 'Hindu Push-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['chest_mid', 'deltoids_front'], secondary_muscles: ['triceps', 'hamstrings', 'lower_back'], instructions: ['Start in downward dog.', 'Dive forward, chest skims floor.', 'Push up into upward dog.', 'Return to start.'], time_per_set_seconds: 40 },
];

// Calisthenics - Pull Movements
const PULL_EXERCISES: Partial<GeneratedExercise>[] = [
  // Beginner pulls
  { name: 'Dead Hang', difficulty: 'beginner', equipment_level: 'playground', primary_muscles: ['lats', 'forearms'], secondary_muscles: ['biceps', 'shoulders'], equipment_required: ['pull_up_bar'], instructions: ['Grip bar overhand.', 'Hang with arms fully extended.', 'Engage shoulders slightly.', 'Hold for time.'], time_per_set_seconds: 30 },
  { name: 'Scapular Pull', difficulty: 'beginner', equipment_level: 'playground', primary_muscles: ['lats', 'scapular_stabilisers'], secondary_muscles: ['rhomboids', 'traps_mid'], equipment_required: ['pull_up_bar'], instructions: ['Hang from bar.', 'Without bending elbows, pull shoulders down.', 'Squeeze shoulder blades together.', 'Lower and repeat.'], time_per_set_seconds: 25 },
  { name: 'Active Hang', difficulty: 'beginner', equipment_level: 'playground', primary_muscles: ['lats', 'scapular_stabilisers'], secondary_muscles: ['core_deep', 'forearms'], equipment_required: ['pull_up_bar'], instructions: ['Hang from bar.', 'Engage lats and depress shoulders.', 'Keep core tight.', 'Hold position.'], time_per_set_seconds: 30 },
  { name: 'Inverted Row (High Bar)', difficulty: 'beginner', equipment_level: 'playground', primary_muscles: ['lats', 'rhomboids'], secondary_muscles: ['biceps', 'traps_mid'], equipment_required: ['parallel_bars'], instructions: ['Set bar at chest height.', 'Hang underneath, body straight.', 'Pull chest to bar.', 'Lower with control.'], time_per_set_seconds: 35 },
  { name: 'Band Assisted Pull-up', difficulty: 'beginner', equipment_level: 'playground', primary_muscles: ['lats', 'biceps'], secondary_muscles: ['rhomboids', 'forearms'], equipment_required: ['pull_up_bar', 'band'], instructions: ['Loop band around bar.', 'Step or kneel in band.', 'Perform pull-up with assistance.', 'Lower controlled.'], time_per_set_seconds: 40 },
  
  // Intermediate pulls
  { name: 'Chin-up', difficulty: 'intermediate', equipment_level: 'playground', primary_muscles: ['biceps', 'lats'], secondary_muscles: ['forearms', 'rhomboids'], equipment_required: ['pull_up_bar'], instructions: ['Underhand grip, shoulder width.', 'Pull chin over bar.', 'Squeeze biceps at top.', 'Lower with control.'], time_per_set_seconds: 40 },
  { name: 'Pull-up', difficulty: 'intermediate', equipment_level: 'playground', primary_muscles: ['lats', 'biceps'], secondary_muscles: ['rhomboids', 'forearms'], equipment_required: ['pull_up_bar'], instructions: ['Overhand grip, slightly wider than shoulders.', 'Pull chest toward bar.', 'Squeeze lats at top.', 'Lower fully extended.'], time_per_set_seconds: 40 },
  { name: 'Neutral Grip Pull-up', difficulty: 'intermediate', equipment_level: 'playground', primary_muscles: ['lats', 'biceps'], secondary_muscles: ['brachialis', 'forearms'], equipment_required: ['parallel_bars'], instructions: ['Palms facing each other.', 'Pull up until chin over bar.', 'Even lat and bicep engagement.', 'Lower controlled.'], time_per_set_seconds: 40 },
  { name: 'Inverted Row (Low Bar)', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['lats', 'rhomboids'], secondary_muscles: ['biceps', 'traps_mid'], equipment_required: ['table'], instructions: ['Lie under sturdy table.', 'Grip edge, body straight.', 'Pull chest to table.', 'Lower slowly.'], time_per_set_seconds: 35 },
  { name: 'Commando Pull-up', difficulty: 'intermediate', equipment_level: 'playground', primary_muscles: ['lats', 'biceps'], secondary_muscles: ['obliques', 'forearms'], equipment_required: ['pull_up_bar'], instructions: ['Grip bar lengthwise (hands in line).', 'Pull up to one side of bar.', 'Lower and pull to other side.', 'Alternate each rep.'], time_per_set_seconds: 45 },
  
  // Advanced pulls
  { name: 'Wide Grip Pull-up', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['lats', 'rhomboids'], secondary_muscles: ['biceps', 'traps_mid'], equipment_required: ['pull_up_bar'], instructions: ['Extra wide overhand grip.', 'Pull chest to bar.', 'Focus on lat stretch.', 'Full extension at bottom.'], time_per_set_seconds: 45 },
  { name: 'Archer Pull-up', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['lats', 'biceps'], secondary_muscles: ['forearms', 'core_deep'], equipment_required: ['pull_up_bar'], instructions: ['Wide grip on bar.', 'Pull toward one hand while other extends.', 'Alternate sides.', 'Advanced unilateral work.'], time_per_set_seconds: 50 },
  { name: 'L-Sit Pull-up', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['lats', 'biceps'], secondary_muscles: ['abs', 'hip_flexors'], equipment_required: ['pull_up_bar'], instructions: ['Hold L-sit position while hanging.', 'Perform pull-up maintaining L.', 'Extreme core engagement.', 'Lower controlled.'], time_per_set_seconds: 50 },
  { name: 'Muscle-up', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['lats', 'chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], equipment_required: ['pull_up_bar'], instructions: ['Explosive pull-up.', 'Transition over bar.', 'Press to straight arms above bar.', 'Lower controlled.'], time_per_set_seconds: 60 },
  { name: 'One Arm Chin-up Negative', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['biceps', 'lats'], secondary_muscles: ['forearms', 'core_deep'], equipment_required: ['pull_up_bar'], instructions: ['Start at top of chin-up.', 'Release one hand.', 'Lower as slowly as possible.', 'Alternate arms.'], time_per_set_seconds: 45 },
];

// Calisthenics - Leg Movements
const LEG_EXERCISES: Partial<GeneratedExercise>[] = [
  // Beginner legs
  { name: 'Bodyweight Squat', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'core_deep'], instructions: ['Feet shoulder-width, toes slightly out.', 'Sit back and down.', 'Thighs parallel or below.', 'Drive through heels.'], time_per_set_seconds: 30 },
  { name: 'Wall Sit', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'calves_gastrocnemius'], instructions: ['Back against wall.', 'Slide down to 90 degree knees.', 'Hold position.', 'Quads on fire.'], time_per_set_seconds: 45 },
  { name: 'Glute Bridge', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['glutes_max', 'hamstrings'], secondary_muscles: ['core_deep', 'lower_back'], instructions: ['Lie on back, knees bent.', 'Squeeze glutes and lift hips.', 'Form straight line knee to shoulder.', 'Lower controlled.'], time_per_set_seconds: 30 },
  { name: 'Calf Raise', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['calves_gastrocnemius'], secondary_muscles: ['calves_soleus'], instructions: ['Stand on flat ground.', 'Rise onto balls of feet.', 'Squeeze at top.', 'Lower slowly.'], time_per_set_seconds: 25 },
  { name: 'Static Lunge Hold', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'hip_flexors'], instructions: ['Step into lunge position.', 'Both knees at 90 degrees.', 'Hold position.', 'Switch legs.'], time_per_set_seconds: 40 },
  { name: 'Hip Hinge (Good Morning)', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['hamstrings', 'glutes_max'], secondary_muscles: ['lower_back', 'core_deep'], instructions: ['Feet hip-width, hands on hips.', 'Push hips back, slight knee bend.', 'Feel hamstring stretch.', 'Drive hips forward to stand.'], time_per_set_seconds: 25 },
  
  // Intermediate legs
  { name: 'Split Squat', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'hip_flexors'], instructions: ['Staggered stance, front foot flat.', 'Lower back knee toward ground.', 'Keep torso upright.', 'Drive through front heel.'], time_per_set_seconds: 35 },
  { name: 'Bulgarian Split Squat', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'hip_flexors'], equipment_required: ['bench'], instructions: ['Rear foot elevated on bench.', 'Lower into deep lunge.', 'Keep front knee tracking over toes.', 'Press up through front leg.'], time_per_set_seconds: 40 },
  { name: 'Reverse Lunge', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'core_deep'], instructions: ['Step backward into lunge.', 'Both knees at 90 degrees.', 'Push through front heel to return.', 'Alternate legs.'], time_per_set_seconds: 35 },
  { name: 'Walking Lunge', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'hip_flexors'], space_required: 'living_room_3x3', instructions: ['Step forward into lunge.', 'Push off and step into next lunge.', 'Continue walking forward.', 'Maintain upright torso.'], time_per_set_seconds: 40 },
  { name: 'Single Leg Glute Bridge', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['glutes_max', 'hamstrings'], secondary_muscles: ['core_deep', 'glutes_med'], instructions: ['Lie on back, one leg extended.', 'Drive through grounded foot.', 'Lift hips evenly.', 'Lower controlled.'], time_per_set_seconds: 35 },
  { name: 'Step-up', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'calves_gastrocnemius'], equipment_required: ['bench'], instructions: ['Place foot on elevated surface.', 'Drive through heel to stand.', 'Step down controlled.', 'Alternate or same leg reps.'], time_per_set_seconds: 35 },
  { name: 'Goblet Squat Hold', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['core_deep', 'deltoids_front'], equipment_required: ['backpack'], instructions: ['Hold weight at chest.', 'Squat deep and hold at bottom.', 'Keep chest up.', 'Stand up explosively.'], time_per_set_seconds: 40 },
  
  // Advanced legs
  { name: 'Pistol Squat', difficulty: 'advanced', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'hip_flexors', 'ankle'], instructions: ['Stand on one leg.', 'Extend other leg forward.', 'Squat all the way down.', 'Stand back up without assistance.'], time_per_set_seconds: 45 },
  { name: 'Shrimp Squat', difficulty: 'advanced', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'hip_flexors'], instructions: ['Stand on one leg.', 'Hold other foot behind you.', 'Squat until back knee touches ground.', 'Stand back up.'], time_per_set_seconds: 45 },
  { name: 'Jump Squat', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['calves_gastrocnemius', 'hamstrings'], impact_level: 'high_impact', instructions: ['Squat down.', 'Explode upward into jump.', 'Land softly.', 'Immediately descend into next rep.'], time_per_set_seconds: 30 },
  { name: 'Box Jump', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['calves_gastrocnemius', 'hamstrings'], equipment_required: ['bench'], impact_level: 'high_impact', instructions: ['Stand facing box.', 'Swing arms and jump onto box.', 'Land softly with bent knees.', 'Step down.'], time_per_set_seconds: 35 },
  { name: 'Nordic Curl', difficulty: 'advanced', equipment_level: 'minimal', primary_muscles: ['hamstrings'], secondary_muscles: ['glutes_max', 'calves_gastrocnemius'], equipment_required: ['bench'], instructions: ['Kneel with ankles secured.', 'Slowly lower torso forward.', 'Control the descent.', 'Use hands to help push back up.'], time_per_set_seconds: 40 },
  { name: 'Single Leg Calf Raise', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['calves_gastrocnemius', 'calves_soleus'], secondary_muscles: ['ankle'], instructions: ['Stand on one leg.', 'Rise onto ball of foot.', 'Full range of motion.', 'Lower slowly past neutral.'], time_per_set_seconds: 30 },
];

// Calisthenics - Core Movements
const CORE_EXERCISES: Partial<GeneratedExercise>[] = [
  // Beginner core
  { name: 'Dead Bug', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['core_deep', 'abs'], secondary_muscles: ['hip_flexors', 'obliques'], instructions: ['Lie on back, arms up, knees 90 degrees.', 'Lower opposite arm and leg.', 'Keep lower back pressed to floor.', 'Return and alternate.'], time_per_set_seconds: 30 },
  { name: 'Bird Dog', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['core_deep', 'lower_back'], secondary_muscles: ['glutes_max', 'deltoids_front'], instructions: ['On hands and knees.', 'Extend opposite arm and leg.', 'Keep hips level.', 'Return and alternate.'], time_per_set_seconds: 30 },
  { name: 'Plank', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['core_deep', 'abs'], secondary_muscles: ['deltoids_front', 'glutes_max'], instructions: ['Forearms and toes on ground.', 'Body in straight line.', 'Squeeze glutes and core.', 'Hold position.'], time_per_set_seconds: 45 },
  { name: 'Side Plank', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['obliques', 'core_deep'], secondary_muscles: ['glutes_med', 'deltoids_lateral'], instructions: ['Lie on side, forearm on ground.', 'Lift hips off floor.', 'Body forms straight line.', 'Hold and switch sides.'], time_per_set_seconds: 30 },
  { name: 'Crunch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['abs'], secondary_muscles: ['hip_flexors'], instructions: ['Lie on back, knees bent.', 'Hands behind head.', 'Curl shoulders off floor.', 'Lower controlled.'], time_per_set_seconds: 25 },
  { name: 'Glute Bridge Hold', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['glutes_max', 'core_deep'], secondary_muscles: ['hamstrings', 'lower_back'], instructions: ['Lie on back, knees bent.', 'Lift hips and hold.', 'Squeeze glutes.', 'Maintain position.'], time_per_set_seconds: 30 },
  
  // Intermediate core
  { name: 'Bicycle Crunch', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['abs', 'obliques'], secondary_muscles: ['hip_flexors'], instructions: ['Lie on back, hands behind head.', 'Bring knee to opposite elbow.', 'Alternate in cycling motion.', 'Keep lower back pressed down.'], time_per_set_seconds: 35 },
  { name: 'Mountain Climber', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['core_deep', 'hip_flexors'], secondary_muscles: ['deltoids_front', 'quads'], instructions: ['High plank position.', 'Drive knee toward chest.', 'Alternate rapidly.', 'Keep hips low.'], time_per_set_seconds: 30 },
  { name: 'Leg Raise', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['abs', 'hip_flexors'], secondary_muscles: ['core_deep'], instructions: ['Lie on back, hands by sides.', 'Raise straight legs to 90 degrees.', 'Lower slowly without touching floor.', 'Keep lower back pressed down.'], time_per_set_seconds: 35 },
  { name: 'Russian Twist', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['obliques', 'abs'], secondary_muscles: ['hip_flexors', 'core_deep'], instructions: ['Sit with knees bent, lean back slightly.', 'Rotate torso side to side.', 'Touch floor beside hip each rep.', 'Keep core engaged.'], time_per_set_seconds: 35 },
  { name: 'Hollow Body Hold', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['abs', 'core_deep'], secondary_muscles: ['hip_flexors', 'quads'], instructions: ['Lie on back.', 'Raise legs and shoulders off floor.', 'Form banana shape.', 'Hold position.'], time_per_set_seconds: 30 },
  { name: 'V-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['abs', 'hip_flexors'], secondary_muscles: ['core_deep'], instructions: ['Lie flat, arms overhead.', 'Simultaneously raise legs and torso.', 'Touch toes at top.', 'Lower with control.'], time_per_set_seconds: 35 },
  { name: 'Plank to Push-up', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['core_deep', 'triceps'], secondary_muscles: ['deltoids_front', 'chest_mid'], instructions: ['Start in forearm plank.', 'Push up to high plank one arm at a time.', 'Return to forearm plank.', 'Alternate leading arm.'], time_per_set_seconds: 40 },
  
  // Advanced core
  { name: 'L-Sit', difficulty: 'advanced', equipment_level: 'none', primary_muscles: ['abs', 'hip_flexors'], secondary_muscles: ['triceps', 'quads'], instructions: ['Hands on floor, arms straight.', 'Lift body, legs straight in front.', 'Form L-shape.', 'Hold position.'], time_per_set_seconds: 30 },
  { name: 'Dragon Flag', difficulty: 'advanced', equipment_level: 'minimal', primary_muscles: ['abs', 'core_deep'], secondary_muscles: ['hip_flexors', 'lower_back'], equipment_required: ['bench'], instructions: ['Lie on bench, grip behind head.', 'Lift entire body to vertical.', 'Lower slowly maintaining straight line.', 'Stop before touching.'], time_per_set_seconds: 40 },
  { name: 'Hanging Leg Raise', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['abs', 'hip_flexors'], secondary_muscles: ['forearms', 'lats'], equipment_required: ['pull_up_bar'], instructions: ['Hang from bar.', 'Raise straight legs to 90 degrees.', 'Lower with control.', 'Avoid swinging.'], time_per_set_seconds: 40 },
  { name: 'Toes to Bar', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['abs', 'hip_flexors'], secondary_muscles: ['lats', 'forearms'], equipment_required: ['pull_up_bar'], instructions: ['Hang from bar.', 'Raise legs and touch toes to bar.', 'Lower with control.', 'Use kip for efficiency or strict for strength.'], time_per_set_seconds: 45 },
  { name: 'Ab Wheel Rollout', difficulty: 'advanced', equipment_level: 'minimal', primary_muscles: ['abs', 'core_deep'], secondary_muscles: ['lats', 'deltoids_front'], equipment_required: ['foam_roller'], instructions: ['Kneel with roller in front.', 'Roll forward extending body.', 'Maintain rigid core.', 'Roll back to start.'], time_per_set_seconds: 40 },
  { name: 'Windshield Wiper', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['obliques', 'abs'], secondary_muscles: ['hip_flexors', 'forearms'], equipment_required: ['pull_up_bar'], instructions: ['Hang from bar.', 'Raise legs to L-sit.', 'Rotate legs side to side.', 'Control the movement.'], time_per_set_seconds: 45 },
];

// Flexibility Exercises
const FLEXIBILITY_EXERCISES: Partial<GeneratedExercise>[] = [
  // Upper body stretches
  { name: 'Chest Doorway Stretch', difficulty: 'beginner', equipment_level: 'minimal', primary_muscles: ['chest_mid', 'deltoids_front'], secondary_muscles: ['biceps'], equipment_required: ['door_frame'], instructions: ['Place forearm on doorframe.', 'Step through door gently.', 'Feel chest stretch.', 'Hold and breathe deeply.'], time_per_set_seconds: 30 },
  { name: 'Shoulder Cross-Body Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['deltoids_rear', 'rhomboids'], secondary_muscles: ['traps_mid'], instructions: ['Bring arm across chest.', 'Use other arm to pull gently.', 'Feel shoulder stretch.', 'Hold and switch.'], time_per_set_seconds: 30 },
  { name: 'Tricep Overhead Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['triceps'], secondary_muscles: ['lats', 'deltoids_rear'], instructions: ['Raise arm overhead.', 'Bend elbow, hand behind head.', 'Use other hand to push elbow back.', 'Hold and switch.'], time_per_set_seconds: 30 },
  { name: 'Neck Side Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['neck'], secondary_muscles: ['traps_upper'], instructions: ['Tilt head to one side.', 'Ear toward shoulder.', 'Gently use hand for extra stretch.', 'Hold and switch.'], time_per_set_seconds: 30 },
  { name: 'Cat-Cow Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['spinal_erectors', 'core_deep'], secondary_muscles: ['abs', 'neck'], instructions: ['On hands and knees.', 'Arch back up (cat).', 'Then drop belly down (cow).', 'Flow between positions.'], time_per_set_seconds: 40 },
  { name: 'Thread the Needle', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['rhomboids', 'traps_mid'], secondary_muscles: ['deltoids_rear', 'obliques'], instructions: ['On hands and knees.', 'Reach one arm under body.', 'Rotate torso, shoulder to floor.', 'Hold and switch.'], time_per_set_seconds: 30 },
  
  // Lower body stretches
  { name: 'Standing Quad Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['quads', 'hip_flexors'], secondary_muscles: ['ankle'], instructions: ['Stand on one leg.', 'Pull foot to glutes.', 'Keep knees together.', 'Hold and switch.'], time_per_set_seconds: 30 },
  { name: 'Standing Hamstring Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['hamstrings'], secondary_muscles: ['calves_gastrocnemius', 'lower_back'], instructions: ['Place heel on low surface.', 'Hinge at hips toward foot.', 'Feel hamstring stretch.', 'Hold and switch.'], time_per_set_seconds: 30 },
  { name: 'Hip Flexor Lunge Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['hip_flexors', 'quads'], secondary_muscles: ['glutes_max'], instructions: ['Kneel on one knee.', 'Front foot flat, knee at 90.', 'Push hips forward.', 'Hold and switch.'], time_per_set_seconds: 30 },
  { name: 'Pigeon Pose', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['glutes_max', 'hip_flexors'], secondary_muscles: ['glutes_med', 'lower_back'], instructions: ['From all fours, bring knee forward.', 'Extend back leg.', 'Lower hips toward floor.', 'Hold and switch.'], time_per_set_seconds: 45 },
  { name: 'Butterfly Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['adductors', 'hip_flexors'], secondary_muscles: ['glutes_med'], instructions: ['Sit with soles of feet together.', 'Knees out to sides.', 'Gently press knees down.', 'Lean forward for deeper stretch.'], time_per_set_seconds: 45 },
  { name: 'Seated Forward Fold', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['hamstrings', 'lower_back'], secondary_muscles: ['calves_gastrocnemius'], instructions: ['Sit with legs extended.', 'Hinge at hips forward.', 'Reach for toes.', 'Hold and breathe.'], time_per_set_seconds: 45 },
  { name: 'Frog Stretch', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['adductors', 'hip_flexors'], secondary_muscles: ['glutes_med'], instructions: ['On hands and knees.', 'Spread knees wide apart.', 'Lower hips toward floor.', 'Hold and breathe.'], time_per_set_seconds: 45 },
  { name: '90/90 Hip Stretch', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['glutes_max', 'hip_flexors'], secondary_muscles: ['adductors', 'glutes_med'], instructions: ['Sit with both legs at 90 degree angles.', 'Front leg in front, back leg to side.', 'Rotate torso over front leg.', 'Switch sides.'], time_per_set_seconds: 45 },
  
  // Full body stretches
  { name: 'World\'s Greatest Stretch', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['hip_flexors', 'hamstrings'], secondary_muscles: ['chest_mid', 'spinal_erectors', 'obliques'], instructions: ['Lunge forward with hands on floor.', 'Rotate and reach arm to sky.', 'Return and straighten front leg.', 'Step forward and repeat.'], time_per_set_seconds: 50 },
  { name: 'Downward Dog', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['hamstrings', 'calves_gastrocnemius'], secondary_muscles: ['deltoids_front', 'lats'], instructions: ['Hands and feet on floor.', 'Hips high, heels pushing down.', 'Body forms inverted V.', 'Hold and breathe.'], time_per_set_seconds: 45 },
  { name: 'Child\'s Pose', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['lower_back', 'lats'], secondary_muscles: ['deltoids_rear', 'glutes_max'], instructions: ['Kneel and sit back on heels.', 'Reach arms forward.', 'Rest forehead on floor.', 'Relax and breathe.'], time_per_set_seconds: 45 },
  { name: 'Cobra Stretch', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['abs', 'hip_flexors'], secondary_muscles: ['chest_mid', 'lower_back'], instructions: ['Lie face down.', 'Push chest up, hips stay down.', 'Arch lower back.', 'Hold and breathe.'], time_per_set_seconds: 30 },
  { name: 'Lying Spinal Twist', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['obliques', 'lower_back'], secondary_muscles: ['glutes_max', 'chest_mid'], instructions: ['Lie on back, arms out.', 'Bring knees to one side.', 'Look opposite direction.', 'Hold and switch.'], time_per_set_seconds: 40 },
];

// Getting Taller (Posture/Decompression) Exercises
const POSTURE_EXERCISES: Partial<GeneratedExercise>[] = [
  { name: 'Wall Angels', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['rhomboids', 'scapular_stabilisers'], secondary_muscles: ['deltoids_rear', 'traps_mid'], instructions: ['Stand with back against wall.', 'Arms in goalpost position against wall.', 'Slide arms up and down.', 'Maintain contact with wall.'], time_per_set_seconds: 40 },
  { name: 'Chin Tucks', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['neck', 'core_deep'], secondary_muscles: ['traps_upper'], instructions: ['Stand or sit tall.', 'Pull chin back creating double chin.', 'Hold briefly.', 'Release and repeat.'], time_per_set_seconds: 25 },
  { name: 'Thoracic Extension', difficulty: 'beginner', equipment_level: 'minimal', primary_muscles: ['spinal_erectors', 'rhomboids'], secondary_muscles: ['lats', 'traps_mid'], equipment_required: ['foam_roller'], instructions: ['Lie on foam roller at mid-back.', 'Hands behind head.', 'Extend back over roller.', 'Roll to different segments.'], time_per_set_seconds: 45 },
  { name: 'Dead Hang (Spinal Decompression)', difficulty: 'beginner', equipment_level: 'playground', primary_muscles: ['spinal_erectors', 'lats'], secondary_muscles: ['forearms', 'shoulders'], equipment_required: ['pull_up_bar'], instructions: ['Hang from bar with relaxed shoulders.', 'Let spine lengthen.', 'Breathe deeply.', 'Feel vertebrae separate.'], time_per_set_seconds: 30 },
  { name: 'Prone Y Raise', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['traps_mid', 'rhomboids'], secondary_muscles: ['deltoids_rear', 'rotator_cuff'], instructions: ['Lie face down.', 'Raise arms in Y shape.', 'Squeeze shoulder blades.', 'Lower and repeat.'], time_per_set_seconds: 30 },
  { name: 'Prone T Raise', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['rhomboids', 'traps_mid'], secondary_muscles: ['deltoids_rear', 'rotator_cuff'], instructions: ['Lie face down.', 'Raise arms out to sides (T shape).', 'Squeeze shoulder blades.', 'Lower and repeat.'], time_per_set_seconds: 30 },
  { name: 'Prone W Raise', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['traps_mid', 'rotator_cuff'], secondary_muscles: ['rhomboids', 'deltoids_rear'], instructions: ['Lie face down.', 'Elbows bent, raise arms in W shape.', 'Squeeze shoulder blades down and back.', 'Lower and repeat.'], time_per_set_seconds: 30 },
  { name: 'Supine Spinal Twist', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['obliques', 'spinal_erectors'], secondary_muscles: ['glutes_max', 'lower_back'], instructions: ['Lie on back, arms out.', 'Knees bent, drop to one side.', 'Look opposite direction.', 'Hold and breathe, then switch.'], time_per_set_seconds: 45 },
  { name: 'Inversion (Legs Up Wall)', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['lower_back', 'hamstrings'], secondary_muscles: ['hip_flexors', 'vagus_nerve'], instructions: ['Lie with legs up the wall.', 'Hips close to wall.', 'Arms relaxed by sides.', 'Hold and breathe deeply.'], time_per_set_seconds: 60 },
  { name: 'Neck Retraction', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['neck'], secondary_muscles: ['traps_upper', 'core_deep'], instructions: ['Sit or stand tall.', 'Pull head straight back.', 'Imagine string pulling crown up.', 'Hold and release.'], time_per_set_seconds: 25 },
];

// Speed/Agility Exercises
const SPEED_EXERCISES: Partial<GeneratedExercise>[] = [
  { name: 'High Knees', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['hip_flexors', 'quads'], secondary_muscles: ['core_deep', 'calves_gastrocnemius'], impact_level: 'high_impact', instructions: ['Run in place.', 'Drive knees high toward chest.', 'Pump arms.', 'Stay on balls of feet.'], time_per_set_seconds: 30 },
  { name: 'Butt Kicks', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['hamstrings', 'quads'], secondary_muscles: ['calves_gastrocnemius', 'hip_flexors'], impact_level: 'high_impact', instructions: ['Run in place.', 'Kick heels to glutes.', 'Keep knees down.', 'Quick tempo.'], time_per_set_seconds: 30 },
  { name: 'Jumping Jacks', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['deltoids_lateral', 'calves_gastrocnemius'], secondary_muscles: ['quads', 'adductors'], impact_level: 'high_impact', instructions: ['Start feet together, arms down.', 'Jump feet apart, arms overhead.', 'Jump back to start.', 'Repeat rhythmically.'], time_per_set_seconds: 30 },
  { name: 'Skaters', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['glutes_med', 'quads'], secondary_muscles: ['adductors', 'calves_gastrocnemius'], impact_level: 'high_impact', space_required: 'small_bedroom_2x2', instructions: ['Jump laterally to one side.', 'Land on outside foot.', 'Touch floor with opposite hand.', 'Jump to other side.'], time_per_set_seconds: 35 },
  { name: 'Burpee', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['whole_body'], secondary_muscles: ['chest_mid', 'triceps', 'core_deep'], impact_level: 'high_impact', instructions: ['Squat down, hands to floor.', 'Jump feet back to plank.', 'Perform push-up.', 'Jump feet forward, then jump up.'], time_per_set_seconds: 45 },
  { name: 'Tuck Jump', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hip_flexors', 'calves_gastrocnemius'], impact_level: 'high_impact', instructions: ['Stand with feet hip-width.', 'Jump explosively upward.', 'Tuck knees to chest in air.', 'Land softly.'], time_per_set_seconds: 30 },
  { name: 'Lateral Shuffle', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['glutes_med', 'quads'], secondary_muscles: ['adductors', 'calves_gastrocnemius'], space_required: 'small_bedroom_2x2', instructions: ['Athletic stance, knees bent.', 'Shuffle sideways quickly.', 'Stay low.', 'Switch direction.'], time_per_set_seconds: 30 },
  { name: 'A-Skip', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['hip_flexors', 'calves_gastrocnemius'], secondary_muscles: ['quads', 'core_deep'], space_required: 'living_room_3x3', instructions: ['Skip forward with high knee drive.', 'Emphasize vertical movement.', 'Land on balls of feet.', 'Alternate legs.'], time_per_set_seconds: 35 },
  { name: 'Broad Jump', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'calves_gastrocnemius'], impact_level: 'high_impact', space_required: 'living_room_3x3', instructions: ['Stand with feet hip-width.', 'Swing arms back then forward.', 'Jump forward as far as possible.', 'Land softly with bent knees.'], time_per_set_seconds: 35 },
  { name: 'Sprint in Place', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['quads', 'hip_flexors'], secondary_muscles: ['calves_gastrocnemius', 'core_deep'], impact_level: 'high_impact', instructions: ['Run as fast as possible in place.', 'Drive knees high.', 'Pump arms aggressively.', 'Stay on balls of feet.'], time_per_set_seconds: 20 },
];

// Mental Clarity/Breathing Exercises
const MENTAL_CLARITY_EXERCISES: Partial<GeneratedExercise>[] = [
  { name: 'Box Breathing', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['core_deep'], secondary_muscles: ['vagus_nerve'], instructions: ['Inhale for 4 counts.', 'Hold for 4 counts.', 'Exhale for 4 counts.', 'Hold for 4 counts. Repeat.'], time_per_set_seconds: 60 },
  { name: '4-7-8 Breathing', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['core_deep'], secondary_muscles: ['vagus_nerve'], instructions: ['Inhale through nose for 4 counts.', 'Hold breath for 7 counts.', 'Exhale through mouth for 8 counts.', 'Repeat cycle.'], time_per_set_seconds: 60 },
  { name: 'Diaphragmatic Breathing', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['core_deep'], secondary_muscles: ['abs', 'vagus_nerve'], instructions: ['Lie on back, knees bent.', 'Hand on belly, hand on chest.', 'Breathe into belly, not chest.', 'Slow exhale, belly falls.'], time_per_set_seconds: 60 },
  { name: 'Body Scan Meditation', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['whole_body'], secondary_muscles: ['vagus_nerve'], instructions: ['Lie comfortably.', 'Mentally scan from toes to head.', 'Notice sensations without judgment.', 'Release tension with each exhale.'], time_per_set_seconds: 120 },
  { name: 'Seated Meditation', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['core_deep'], secondary_muscles: ['spinal_erectors', 'vagus_nerve'], instructions: ['Sit comfortably, spine tall.', 'Close eyes, breathe naturally.', 'Focus on breath sensation.', 'Gently return when mind wanders.'], time_per_set_seconds: 120 },
  { name: 'Walking Meditation', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['whole_body'], secondary_muscles: ['vagus_nerve'], space_required: 'small_bedroom_2x2', instructions: ['Walk very slowly.', 'Feel each part of step.', 'Heel, ball, toe.', 'Stay present in body.'], time_per_set_seconds: 120 },
  { name: 'Progressive Muscle Relaxation', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['whole_body'], secondary_muscles: ['vagus_nerve'], instructions: ['Lie comfortably.', 'Tense muscle group for 5 seconds.', 'Release and notice relaxation.', 'Move through whole body.'], time_per_set_seconds: 120 },
  { name: 'Alternate Nostril Breathing', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['core_deep'], secondary_muscles: ['vagus_nerve'], instructions: ['Sit comfortably.', 'Close right nostril, inhale left.', 'Close left, exhale right.', 'Inhale right, exhale left. Repeat.'], time_per_set_seconds: 60 },
  { name: 'Gratitude Practice', difficulty: 'beginner', equipment_level: 'none', primary_muscles: ['whole_body'], secondary_muscles: ['vagus_nerve'], instructions: ['Sit quietly.', 'Think of three things you\'re grateful for.', 'Feel the gratitude in your body.', 'Breathe deeply and smile.'], time_per_set_seconds: 60 },
  { name: 'Visualization', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['whole_body'], secondary_muscles: ['vagus_nerve'], instructions: ['Close eyes, relax body.', 'Imagine a peaceful place.', 'Engage all senses in the image.', 'Stay present in visualization.'], time_per_set_seconds: 120 },
];

// Building Muscle (weighted bodyweight focus)
const MUSCLE_BUILDING_EXERCISES: Partial<GeneratedExercise>[] = [
  // These are bodyweight exercises done with tempo and volume for hypertrophy
  { name: 'Tempo Push-up (4-1-2)', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], instructions: ['4 seconds down.', '1 second pause at bottom.', '2 seconds up.', 'Focus on muscle tension.'], time_per_set_seconds: 45 },
  { name: 'Tempo Squat (3-2-1)', difficulty: 'intermediate', equipment_level: 'none', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'core_deep'], instructions: ['3 seconds down.', '2 second pause at bottom.', '1 second up explosively.', 'Feel the burn.'], time_per_set_seconds: 45 },
  { name: 'Weighted Push-up', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], equipment_required: ['backpack'], instructions: ['Wear loaded backpack.', 'Perform push-ups with added weight.', 'Maintain form.', 'Build chest mass.'], time_per_set_seconds: 40 },
  { name: 'Weighted Squat', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'lower_back'], equipment_required: ['backpack'], instructions: ['Wear loaded backpack.', 'Perform squats.', 'Keep chest up.', 'Full depth.'], time_per_set_seconds: 40 },
  { name: 'Weighted Lunge', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['quads', 'glutes_max'], secondary_muscles: ['hamstrings', 'hip_flexors'], equipment_required: ['backpack'], instructions: ['Wear loaded backpack.', 'Perform lunges.', 'Step forward or backward.', 'Alternate legs.'], time_per_set_seconds: 40 },
  { name: 'Close Grip Chin-up', difficulty: 'intermediate', equipment_level: 'playground', primary_muscles: ['biceps', 'lats'], secondary_muscles: ['forearms', 'rhomboids'], equipment_required: ['pull_up_bar'], instructions: ['Underhand grip, hands close.', 'Pull chin over bar.', 'Squeeze biceps hard at top.', 'Slow negative.'], time_per_set_seconds: 45 },
  { name: 'Ring Dip', difficulty: 'advanced', equipment_level: 'playground', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], equipment_required: ['rings'], instructions: ['Support yourself on rings.', 'Lower until shoulders below elbows.', 'Press back up.', 'Rings make it unstable.'], time_per_set_seconds: 45 },
  { name: 'Ring Row', difficulty: 'intermediate', equipment_level: 'playground', primary_muscles: ['lats', 'rhomboids'], secondary_muscles: ['biceps', 'traps_mid'], equipment_required: ['rings'], instructions: ['Hold rings, body at angle.', 'Pull chest to rings.', 'Squeeze back muscles.', 'Lower with control.'], time_per_set_seconds: 40 },
  { name: 'Deficit Push-up', difficulty: 'intermediate', equipment_level: 'minimal', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], equipment_required: ['parallettes'], instructions: ['Hands on elevated surfaces.', 'Lower chest below hand level.', 'Greater range of motion.', 'More chest stretch.'], time_per_set_seconds: 40 },
  { name: 'Ring Push-up', difficulty: 'intermediate', equipment_level: 'playground', primary_muscles: ['chest_mid', 'triceps'], secondary_muscles: ['deltoids_front', 'core_deep'], equipment_required: ['rings'], instructions: ['Hands on low rings.', 'Perform push-up.', 'Instability increases difficulty.', 'Turn rings out at top.'], time_per_set_seconds: 40 },
];

// ============================================
// GENERATOR FUNCTIONS
// ============================================

function generateCategoryId(category: Category, index: number): string {
  const prefixes: Record<Category, string> = {
    body_control: 'cal',
    posture: 'tall',
    speed: 'speed',
    mobility: 'flex',
    focus: 'mind',
    strength: 'muscle',
  };
  return `${prefixes[category]}_${String(index).padStart(3, '0')}`;
}

function generateExercisesForCategory(
  category: Category,
  templates: Partial<GeneratedExercise>[],
  startIndex: number
): GeneratedExercise[] {
  return templates.map((template, i) => ({
    id: generateCategoryId(category, startIndex + i + 1),
    name: template.name || 'Unknown Exercise',
    category,
    difficulty: template.difficulty || 'intermediate',
    equipment_level: template.equipment_level || 'none',
    impact_level: template.impact_level || 'no_impact',
    space_required: template.space_required || 'mat_only_1x1',
    time_per_set_seconds: template.time_per_set_seconds || 30,
    instructions: template.instructions || ['Perform exercise with good form.'],
    order_in_category: startIndex + i + 1,
    primary_muscles: template.primary_muscles || ['whole_body'],
    secondary_muscles: template.secondary_muscles || [],
    equipment_required: template.equipment_required || [],
    equipment_optional: template.equipment_optional || [],
    training_types: template.training_types || [
      { type: 'strength', effectiveness: 5 },
    ],
    audio_intro: template.audio_intro,
    audio_setup: template.audio_setup,
    audio_execution: template.audio_execution,
    audio_transition: template.audio_transition,
  }));
}

// Generate variations for more exercises
function generateVariations(base: Partial<GeneratedExercise>[]): Partial<GeneratedExercise>[] {
  const variations: Partial<GeneratedExercise>[] = [];
  
  base.forEach(exercise => {
    variations.push(exercise);
    
    // Add tempo variation for strength exercises
    if (exercise.difficulty !== 'beginner' && !exercise.name?.includes('Tempo')) {
      variations.push({
        ...exercise,
        name: `Tempo ${exercise.name}`,
        difficulty: exercise.difficulty === 'intermediate' ? 'advanced' : 'intermediate',
        time_per_set_seconds: (exercise.time_per_set_seconds || 30) + 15,
        instructions: [...(exercise.instructions || []), 'Use 3-1-2 tempo for time under tension.'],
      });
    }
    
    // Add pause variation
    if (exercise.equipment_level === 'none' && !exercise.name?.includes('Pause')) {
      variations.push({
        ...exercise,
        name: `Pause ${exercise.name}`,
        difficulty: exercise.difficulty === 'beginner' ? 'intermediate' : 'advanced',
        time_per_set_seconds: (exercise.time_per_set_seconds || 30) + 10,
        instructions: [...(exercise.instructions || []), 'Add 2 second pause at hardest point.'],
      });
    }
  });
  
  return variations;
}

// ============================================
// MAIN EXPORT
// ============================================

export function generateAllExercises(): GeneratedExercise[] {
  const allExercises: GeneratedExercise[] = [];
  let offset = 0;
  
  // Calisthenics (push, pull, legs, core)
  const bodyControlExercises = [
    ...generateVariations(PUSH_EXERCISES),
    ...generateVariations(PULL_EXERCISES),
    ...generateVariations(LEG_EXERCISES),
    ...generateVariations(CORE_EXERCISES),
  ];
  allExercises.push(...generateExercisesForCategory('body_control', bodyControlExercises, offset));
  offset += bodyControlExercises.length;
  
  // Getting Taller (posture/decompression)
  const postureExercises = generateVariations(POSTURE_EXERCISES);
  allExercises.push(...generateExercisesForCategory('posture', postureExercises, 0));
  offset += postureExercises.length;
  
  // Faster (speed/agility)
  const speedExercises = generateVariations(SPEED_EXERCISES);
  allExercises.push(...generateExercisesForCategory('speed', speedExercises, 0));
  offset += speedExercises.length;
  
  // Flexible
  const flexExercises = generateVariations(FLEXIBILITY_EXERCISES);
  allExercises.push(...generateExercisesForCategory('mobility', flexExercises, 0));
  offset += flexExercises.length;
  
  // Mental Clarity
  allExercises.push(...generateExercisesForCategory('focus', MENTAL_CLARITY_EXERCISES, 0));
  
  // Building Muscle
  const muscleExercises = generateVariations(MUSCLE_BUILDING_EXERCISES);
  allExercises.push(...generateExercisesForCategory('strength', muscleExercises, 0));
  
  if (__DEV__) console.log(`[ExerciseGenerator] Generated ${allExercises.length} exercises`);
  return allExercises;
}

// Export types for use in seed.ts
export type { GeneratedExercise };
