/**
 * FitQuest Exercise Seed Data
 * From FitQuest_Filters.docx - Calisthenics, Getting Taller, and more
 */

import { getDatabase } from './schema';
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

interface SeedExercise {
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
  // Audio fields for TTS (each ≤2 sentences)
  audio_intro?: string;      // What the exercise is and main benefit
  audio_setup?: string;      // How to get into position
  audio_execution?: string;  // How to perform the movement
  audio_transition?: string; // What to do after (rest, next exercise)
}

// ============================================
// CALISTHENICS EXERCISES (from docx 1-52)
// ============================================

const CALISTHENICS_EXERCISES: SeedExercise[] = [
  {
    id: 'cal_001',
    name: 'Wall Push-up',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Stand arm-length from a wall, feet together.',
      'Place palms on wall at shoulder height, hands just wider than shoulders.',
      'Body straight from head to heels (core tight).',
      'Inhale, bend elbows until chest nearly touches wall (2-3 s).',
      'Exhale, push back to start (1-2 s).',
      'Keep heels down whole time.',
    ],
    order_in_category: 1,
    primary_muscles: ['chest_mid', 'triceps'],
    secondary_muscles: ['deltoids_front', 'core_deep'],
    equipment_required: [],
    equipment_optional: ['wall'],
    training_types: [
      { type: 'strength', effectiveness: 3 },
      { type: 'hypertrophy', effectiveness: 2 },
    ],
  },
  {
    id: 'cal_002',
    name: 'Incline Push-up',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'minimal',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 35,
    instructions: [
      'Hands on edge of counter, wrists under shoulders.',
      'Walk feet back so body is straight line head-to-heels.',
      'Core tight, glutes squeezed.',
      'Lower chest to counter (elbows 45° from body).',
      'Press back up fully locked.',
      'Easier = higher surface; harder = lower table.',
    ],
    order_in_category: 2,
    primary_muscles: ['chest_mid', 'triceps'],
    secondary_muscles: ['deltoids_front', 'core_deep'],
    equipment_required: ['table'],
    equipment_optional: ['chair'],
    training_types: [
      { type: 'strength', effectiveness: 4 },
      { type: 'hypertrophy', effectiveness: 3 },
    ],
  },
  {
    id: 'cal_003',
    name: 'Knee Push-up',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Start on all-fours, hands slightly wider than shoulders.',
      'Walk knees back so body makes straight line from head to knees.',
      'Tuck toes (or keep shoelaces flat if floor hurts).',
      'Lower chest until 5 cm above floor.',
      'Push back to straight arms.',
      'Keep hips in line with shoulders—no "snake" up.',
    ],
    order_in_category: 3,
    primary_muscles: ['chest_mid', 'triceps'],
    secondary_muscles: ['deltoids_front', 'core_deep'],
    equipment_required: [],
    equipment_optional: ['pillow'],
    training_types: [
      { type: 'strength', effectiveness: 4 },
      { type: 'hypertrophy', effectiveness: 4 },
    ],
  },
  {
    id: 'cal_004',
    name: 'Hip Hinge Drill (Good Morning)',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 25,
    instructions: [
      'Stand feet hip-width, hands on hips.',
      'Soft knees, chest proud.',
      'Push hips backward (imagine closing car door).',
      'Feel hamstrings stretch; stop when torso is near parallel to floor.',
      'Drive hips forward to stand tall—do NOT round back.',
      'Movement comes from hips, not waist bend.',
    ],
    order_in_category: 4,
    primary_muscles: ['hamstrings', 'glutes_max'],
    secondary_muscles: ['lower_back', 'core_deep'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 7 },
      { type: 'posture', effectiveness: 6 },
    ],
  },
  {
    id: 'cal_005',
    name: 'Glute Bridge',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Lie on back, knees bent 90°, feet hip-width.',
      'Arms palms-up at 45° for stability.',
      'Tilt pelvis slightly (flatten low-back into floor).',
      'Squeeze glutes, lift hips until straight line knees-shoulders.',
      'Hold 1 s at top—knees stay in line (no flop-out).',
      'Lower under control; lightly touch floor and go again.',
    ],
    order_in_category: 5,
    primary_muscles: ['glutes_max', 'hamstrings'],
    secondary_muscles: ['core_deep', 'lower_back'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 5 },
      { type: 'hypertrophy', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_006',
    name: 'Single-leg Glute Bridge',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 35,
    instructions: [
      'Same set-up, but straighten one leg up toward ceiling.',
      'Push through heel of grounded foot.',
      'Lift hips evenly—do not let pelvis drop on free-leg side.',
      '8-12 reps, then switch.',
      'Too wobbly? Keep lifted leg bent at 90° instead.',
    ],
    order_in_category: 6,
    primary_muscles: ['glutes_max', 'hamstrings'],
    secondary_muscles: ['core_deep', 'glutes_med'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 6 },
      { type: 'balance', effectiveness: 6 },
    ],
  },
  {
    id: 'cal_007',
    name: 'Wall Sit',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 45,
    instructions: [
      'Back flat against wall, feet 30-40 cm forward.',
      'Slide down until knees 90° (thighs parallel to floor).',
      'Ankles directly under knees, feet shoulder-width.',
      'Hands on thighs or crossed at chest—no pushing with arms.',
      'Breathe normally; hold prescribed time.',
      'Finish by sliding up, not rolling out.',
    ],
    order_in_category: 7,
    primary_muscles: ['quads', 'glutes_max'],
    secondary_muscles: ['hamstrings', 'calves_gastrocnemius'],
    equipment_required: [],
    equipment_optional: ['wall'],
    training_types: [
      { type: 'endurance', effectiveness: 7 },
      { type: 'strength', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_008',
    name: 'Static Lunge Hold',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 40,
    instructions: [
      'Step forward long stride; back heel off floor.',
      'Drop back knee straight down until both knees ~90°.',
      'Torso upright, core tight.',
      'Hold still; press front heel into floor to keep tension.',
      'Switch legs next set.',
      'Knee should NOT travel past toes—if it does, take longer step.',
    ],
    order_in_category: 8,
    primary_muscles: ['quads', 'glutes_max'],
    secondary_muscles: ['hamstrings', 'hip_flexors'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'endurance', effectiveness: 6 },
      { type: 'balance', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_009',
    name: 'Calf Raise',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 25,
    instructions: [
      'Stand on floor, feet hip-width, hands lightly touching wall for balance.',
      'Rise onto balls of feet as high as possible (squeeze).',
      'Pause 1 s at top.',
      'Lower slowly 2-3 s until heels touch floor.',
      'Keep knees straight to hit gastrocnemius.',
    ],
    order_in_category: 9,
    primary_muscles: ['calves_gastrocnemius'],
    secondary_muscles: ['calves_soleus'],
    equipment_required: [],
    equipment_optional: ['wall'],
    training_types: [
      { type: 'strength', effectiveness: 5 },
      { type: 'hypertrophy', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_010',
    name: 'Single-leg Calf Raise',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Same stance, but cross free foot behind ankle.',
      'Shift body-weight onto standing leg.',
      'Use two fingers on wall only for balance, not to pull.',
      'Full range: heel below floor level if you can, then up high.',
      'Do all reps on one side, then switch.',
    ],
    order_in_category: 10,
    primary_muscles: ['calves_gastrocnemius', 'calves_soleus'],
    secondary_muscles: ['ankle'],
    equipment_required: [],
    equipment_optional: ['wall'],
    training_types: [
      { type: 'strength', effectiveness: 6 },
      { type: 'balance', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_011',
    name: 'Dead-bug',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 40,
    instructions: [
      'Lie on back, arms straight toward ceiling, knees over hips (90-90 position).',
      'Flatten lower back into floor (imagine squashing a bug).',
      'Slowly lower RIGHT arm overhead and LEFT leg out until heel almost touches floor.',
      'Keep back glued down—if it arches, shorten range.',
      'Return to start; repeat opposite sides.',
      'That\'s 1 rep. Move slowly 3 s out, 3 s back.',
    ],
    order_in_category: 11,
    primary_muscles: ['core_deep', 'abs'],
    secondary_muscles: ['hip_flexors', 'deltoids_front'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 5 },
      { type: 'coordination', effectiveness: 6 },
    ],
  },
  {
    id: 'cal_012',
    name: 'Side-plank Hip Dip',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 35,
    instructions: [
      'Lie on side, elbow under shoulder, legs straight, top foot in front of bottom for balance.',
      'Lift hips so body is straight line head-heels.',
      'Lower hip toward floor (but don\'t touch), then lift back up.',
      'Small, controlled 2-2 tempo.',
      'Do all reps on one side, then switch.',
    ],
    order_in_category: 12,
    primary_muscles: ['obliques', 'core_deep'],
    secondary_muscles: ['glutes_med', 'deltoids_lateral'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 6 },
      { type: 'balance', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_013',
    name: 'Standard Push-up',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 35,
    instructions: [
      'Start plank on hands, wrists under shoulders, feet together.',
      'Body straight line ear-ankle; squeeze glutes, brace core.',
      'Elbows 45° from torso, lower chest to 5 cm above floor (2-3 s).',
      'Press back up until arms straight; keep hips in line—no sag.',
      'Breathe in down, out up.',
    ],
    order_in_category: 16,
    primary_muscles: ['chest_mid', 'triceps'],
    secondary_muscles: ['deltoids_front', 'core_deep'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 7 },
      { type: 'hypertrophy', effectiveness: 6 },
    ],
  },
  {
    id: 'cal_014',
    name: 'Close-stance Squat',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'low_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Stand feet hip-width, toes slightly out.',
      'Hands on hips or crossed at chest.',
      'Break at hips first, then knees; sit down until thighs parallel to floor.',
      'Knees track over 2nd toe; chest proud.',
      'Drive through whole foot to stand; squeeze glutes at top.',
    ],
    order_in_category: 17,
    primary_muscles: ['quads', 'glutes_max'],
    secondary_muscles: ['hamstrings', 'core_deep'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 7 },
      { type: 'hypertrophy', effectiveness: 6 },
    ],
  },
  {
    id: 'cal_015',
    name: 'Walking Lunge',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'low_impact',
    space_required: 'living_room_3x3',
    time_per_set_seconds: 40,
    instructions: [
      'Step forward long stride.',
      'Drop back knee straight down until both knees ~90°.',
      'Push through front heel to bring back foot forward into next step.',
      'Keep torso upright, core tight.',
      'Alternate legs for desired reps.',
    ],
    order_in_category: 18,
    primary_muscles: ['quads', 'glutes_max'],
    secondary_muscles: ['hamstrings', 'hip_flexors'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 7 },
      { type: 'coordination', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_016',
    name: 'Jump Squat',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'high_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 25,
    instructions: [
      'Start at bottom of squat (thighs parallel).',
      'Swing arms back, then explode up, arms overhead.',
      'Land softly on mid-foot, immediately sink back into squat (quiet landing).',
      'Reset if form breaks; stop if knees cave inward.',
    ],
    order_in_category: 19,
    primary_muscles: ['quads', 'glutes_max'],
    secondary_muscles: ['calves_gastrocnemius', 'hamstrings'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'speed_power', effectiveness: 8 },
      { type: 'fat_loss', effectiveness: 7 },
    ],
  },
  {
    id: 'cal_017',
    name: 'Star Jump',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'high_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 20,
    instructions: [
      'Stand tall, feet together, arms at sides.',
      'Drop into quarter-squat, swing arms back.',
      'Explode up, spread legs wider than shoulders and raise arms to form an "X" in air.',
      'Land softly feet together, arms back at sides.',
      'That\'s 1 rep; use springy rhythm.',
    ],
    order_in_category: 20,
    primary_muscles: ['quads', 'glutes_max'],
    secondary_muscles: ['calves_gastrocnemius', 'deltoids_lateral'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'speed_power', effectiveness: 7 },
      { type: 'fat_loss', effectiveness: 8 },
    ],
  },
  {
    id: 'cal_018',
    name: 'Mountain Climber (fast)',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'low_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Start in plank, wrists under shoulders, body straight.',
      'Drive one knee toward chest; keep foot off floor.',
      'Quickly switch legs in one smooth motion (like running horizontally).',
      'Keep hips level—no pike or sag.',
      'Breathe rhythmically; count reps each knee forward.',
    ],
    order_in_category: 21,
    primary_muscles: ['core_deep', 'hip_flexors'],
    secondary_muscles: ['deltoids_front', 'quads'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'endurance', effectiveness: 8 },
      { type: 'fat_loss', effectiveness: 8 },
    ],
  },
  {
    id: 'cal_019',
    name: 'High-knee Sprint on Spot',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'high_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 25,
    instructions: [
      'Stand tall, elbows 90°.',
      'Drive knees up to hip height (thigh parallel to floor).',
      'Opposite arm drives forward; stay on balls of feet.',
      'Land softly; minimal ground contact.',
      'Eyes forward, core tight.',
    ],
    order_in_category: 22,
    primary_muscles: ['hip_flexors', 'quads'],
    secondary_muscles: ['calves_gastrocnemius', 'core_deep'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'speed_power', effectiveness: 7 },
      { type: 'fat_loss', effectiveness: 8 },
    ],
  },
  {
    id: 'cal_020',
    name: 'Butt-kick Sprint',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'high_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 25,
    instructions: [
      'Same posture as high-knee sprint.',
      'Heels flick up toward glutes; knees stay low, pointing down.',
      'Arms still drive hard; imagine pulling floor backward.',
      'Quick, light steps—noise should be quiet.',
    ],
    order_in_category: 23,
    primary_muscles: ['hamstrings', 'calves_gastrocnemius'],
    secondary_muscles: ['glutes_max', 'core_deep'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'speed_power', effectiveness: 7 },
      { type: 'fat_loss', effectiveness: 7 },
    ],
  },
  {
    id: 'cal_021',
    name: 'Plank',
    category: 'calisthenics',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 45,
    instructions: [
      'Forearms on floor, elbows under shoulders.',
      'Body straight line from head to heels.',
      'Squeeze glutes, brace core, tuck pelvis slightly.',
      'Look down at floor, neck neutral.',
      'Breathe normally; hold prescribed time.',
    ],
    order_in_category: 25,
    primary_muscles: ['core_deep', 'abs'],
    secondary_muscles: ['deltoids_front', 'glutes_max'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'endurance', effectiveness: 6 },
      { type: 'posture', effectiveness: 7 },
    ],
  },
  {
    id: 'cal_022',
    name: 'V-up',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Lie flat, arms overhead, legs straight.',
      'Simultaneously lift torso and legs, reaching hands toward feet.',
      'Form a "V" at top; balance on tailbone.',
      'Lower under control to heels and shoulder blades just above floor.',
      'If back strains, bend knees slightly.',
    ],
    order_in_category: 27,
    primary_muscles: ['abs', 'hip_flexors'],
    secondary_muscles: ['core_deep', 'quads'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 7 },
      { type: 'hypertrophy', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_023',
    name: 'Hollow-body Rock',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Lie on back, arms overhead, legs straight, LOW BACK pressed into floor.',
      'Lift shoulders and feet 5-10 cm (banana shape).',
      'Gently rock forward and back like a rocking-chair, maintaining shape.',
      'Rock comes from ankles/shoulders, NOT by jerking hips.',
      'Stop if lower-back arches off floor.',
    ],
    order_in_category: 31,
    primary_muscles: ['abs', 'core_deep'],
    secondary_muscles: ['hip_flexors', 'deltoids_front'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 6 },
      { type: 'coordination', effectiveness: 5 },
    ],
  },
  {
    id: 'cal_024',
    name: 'Pull-up',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'playground',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 40,
    instructions: [
      'Hang from bar, hands shoulder-width, palms facing away.',
      'Pull shoulder blades down and back.',
      'Pull chin over bar by driving elbows down.',
      'Lower with control until arms straight.',
      'Don\'t swing or kip.',
    ],
    order_in_category: 35,
    primary_muscles: ['lats', 'biceps'],
    secondary_muscles: ['rhomboids', 'forearms'],
    equipment_required: ['pull_up_bar'],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 9 },
      { type: 'hypertrophy', effectiveness: 8 },
    ],
  },
  {
    id: 'cal_025',
    name: 'Archer Push-up',
    category: 'calisthenics',
    difficulty: 'advanced',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 40,
    instructions: [
      'Start wide hands (1.5× shoulder width), feet wider for balance.',
      'Lower toward right hand, allowing left arm to straighten and slide slightly out.',
      'Chest nearly touches right hand; keep body straight.',
      'Press back to centre; repeat left side = 1 rep.',
      'Elbows stay 45°; no hip sag.',
    ],
    order_in_category: 33,
    primary_muscles: ['chest_mid', 'triceps'],
    secondary_muscles: ['deltoids_front', 'core_deep'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 8 },
      { type: 'hypertrophy', effectiveness: 7 },
    ],
  },
  {
    id: 'cal_026',
    name: 'Handstand Wall Hold',
    category: 'calisthenics',
    difficulty: 'advanced',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 30,
    instructions: [
      'Face wall, place hands 15-20 cm away, shoulder-width.',
      'Kick one leg up, then the other, until heels rest lightly on wall.',
      'Body straight (wrists-hips-ankles one line).',
      'Look slightly between hands, breathe.',
      'Hold prescribed time; walk feet down to exit.',
    ],
    order_in_category: 32,
    primary_muscles: ['deltoids_front', 'triceps'],
    secondary_muscles: ['core_deep', 'traps_upper'],
    equipment_required: [],
    equipment_optional: ['wall'],
    training_types: [
      { type: 'strength', effectiveness: 7 },
      { type: 'balance', effectiveness: 8 },
    ],
  },
  {
    id: 'cal_027',
    name: 'Hanging Leg Raise (bent)',
    category: 'calisthenics',
    difficulty: 'intermediate',
    equipment_level: 'playground',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 35,
    instructions: [
      'Hang from bar, grip shoulder-width, shoulders active (pull down).',
      'Bend knees 90°, press them together.',
      'Tilt pelvis backward (round low back).',
      'Lift knees toward chest until thighs parallel to floor or slightly past.',
      'Lower with control; avoid swinging by moving slowly.',
    ],
    order_in_category: 46,
    primary_muscles: ['abs', 'hip_flexors'],
    secondary_muscles: ['forearms', 'core_deep'],
    equipment_required: ['pull_up_bar'],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 7 },
      { type: 'hypertrophy', effectiveness: 6 },
    ],
  },
  {
    id: 'cal_028',
    name: 'Toes-to-bar',
    category: 'calisthenics',
    difficulty: 'advanced',
    equipment_level: 'playground',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 40,
    instructions: [
      'Hang as above.',
      'Use posterior tilt + hip flexors to lift straight legs all the way until toes touch bar between hands.',
      'Lower with control to hollow position (legs in front, not loose behind).',
      'If you can\'t reach bar yet, aim for "toes-as-high-as-possible" and increase range weekly.',
    ],
    order_in_category: 48,
    primary_muscles: ['abs', 'hip_flexors'],
    secondary_muscles: ['forearms', 'lats'],
    equipment_required: ['pull_up_bar'],
    equipment_optional: [],
    training_types: [
      { type: 'strength', effectiveness: 8 },
      { type: 'hypertrophy', effectiveness: 7 },
    ],
  },
  {
    id: 'cal_029',
    name: 'L-sit (Parallettes)',
    category: 'calisthenics',
    difficulty: 'advanced',
    equipment_level: 'playground',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 20,
    instructions: [
      'Sit between parallettes, grip handles, straight arms locked.',
      'Press shoulders down (depress scapula).',
      'Lift legs straight until parallel to floor (form an "L").',
      'Hold time prescribed; keep chin neutral, core tight.',
      'Can\'t lift both? Keep one foot on floor or tuck one knee.',
    ],
    order_in_category: 50,
    primary_muscles: ['abs', 'hip_flexors'],
    secondary_muscles: ['triceps', 'core_deep'],
    equipment_required: ['parallettes'],
    equipment_optional: ['chair'],
    training_types: [
      { type: 'strength', effectiveness: 8 },
      { type: 'endurance', effectiveness: 6 },
    ],
  },
];

// ============================================
// GETTING TALLER (DECOMPRESSION/MOBILITY) EXERCISES
// ============================================

const GETTING_TALLER_EXERCISES: SeedExercise[] = [
  {
    id: 'tall_001',
    name: 'Bar Dead-hang',
    category: 'getting_taller',
    difficulty: 'beginner',
    equipment_level: 'playground',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 45,
    instructions: [
      'Reach overhead to a sturdy pull-up bar.',
      'Jump or step up so hands grip shoulder-width, palms forward.',
      'Let body weight sink you down; relax shoulders away from ears.',
      'Keep arms straight, slight bend OK to avoid hyper-extension.',
      'Breathe deeply; hold 30-45 s.',
      'Step down gently—don\'t drop from height.',
    ],
    order_in_category: 1,
    primary_muscles: ['lats', 'forearms'],
    secondary_muscles: ['spinal_erectors', 'core_deep'],
    equipment_required: ['pull_up_bar'],
    equipment_optional: [],
    training_types: [
      { type: 'decompression', effectiveness: 9 },
      { type: 'mobility', effectiveness: 7 },
    ],
  },
  {
    id: 'tall_002',
    name: 'Active Hang Scapular Elevations',
    category: 'getting_taller',
    difficulty: 'intermediate',
    equipment_level: 'playground',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 30,
    instructions: [
      'Hang straight arms from bar.',
      'Without bending arms, pull shoulder blades DOWN (away from ears) so body rises 2-3 cm.',
      'Slowly let shoulders rise back up (relax).',
      'That\'s 1 rep—small but powerful.',
      'Move comes from shoulder blades only, not arms.',
    ],
    order_in_category: 3,
    primary_muscles: ['scapular_stabilisers', 'lats'],
    secondary_muscles: ['traps_mid', 'rhomboids'],
    equipment_required: ['pull_up_bar'],
    equipment_optional: [],
    training_types: [
      { type: 'posture', effectiveness: 8 },
      { type: 'decompression', effectiveness: 7 },
    ],
  },
  {
    id: 'tall_003',
    name: 'Cobra Pose',
    category: 'getting_taller',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Lie face-down, legs straight, tops of feet on floor.',
      'Place hands under shoulders, elbows tucked.',
      'Press tops of feet and pelvis down.',
      'Slowly straighten arms until hips just start to lift—NO pain in low back.',
      'Hold 30 s, breathe into belly.',
    ],
    order_in_category: 5,
    primary_muscles: ['spinal_erectors', 'abs'],
    secondary_muscles: ['hip_flexors', 'deltoids_front'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 7 },
      { type: 'decompression', effectiveness: 6 },
    ],
  },
  {
    id: 'tall_004',
    name: 'Cat-Camel',
    category: 'getting_taller',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 40,
    instructions: [
      'On all-fours, wrists under shoulders, knees under hips.',
      'ROUND back up like an angry cat—tuck tailbone, drop head.',
      'Slowly ARCH back, belly drops, tailbone lifts, look forward.',
      'Flow between both shapes 10-12 times with breath.',
    ],
    order_in_category: 7,
    primary_muscles: ['spinal_erectors', 'abs'],
    secondary_muscles: ['core_deep', 'neck'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 8 },
      { type: 'recovery', effectiveness: 7 },
    ],
  },
  {
    id: 'tall_005',
    name: 'Child\'s Pose Reach',
    category: 'getting_taller',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 45,
    instructions: [
      'Knees wide, big toes touch, sit hips toward heels.',
      'Walk hands forward on floor; lower forehead to ground.',
      'Reach fingertips farther each exhale—feel lats stretch.',
      'Hold 45 s; breathe into ribs.',
    ],
    order_in_category: 8,
    primary_muscles: ['lats', 'spinal_erectors'],
    secondary_muscles: ['deltoids_front', 'hip_flexors'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 7 },
      { type: 'recovery', effectiveness: 8 },
    ],
  },
  {
    id: 'tall_006',
    name: 'Standing Forward Fold',
    category: 'getting_taller',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 45,
    instructions: [
      'Stand feet hip-width.',
      'Hinge hips (push butt back), then let torso fold toward thighs.',
      'Let arms dangle; grab opposite elbows if you like.',
      'Shift weight slightly forward so hips stack over ankles.',
      'Hold 45 s; micro-bend knees if hamstrings scream.',
    ],
    order_in_category: 9,
    primary_muscles: ['hamstrings', 'spinal_erectors'],
    secondary_muscles: ['calves_gastrocnemius', 'glutes_max'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 7 },
      { type: 'decompression', effectiveness: 6 },
    ],
  },
  {
    id: 'tall_007',
    name: 'Jefferson Curl (Light)',
    category: 'getting_taller',
    difficulty: 'intermediate',
    equipment_level: 'minimal',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 40,
    instructions: [
      'Stand on small step or sturdy book.',
      'Hold light backpack at thighs.',
      'Tuck chin, slowly roll down ONE vertebra at a time.',
      'Keep legs straight; go only as far as hamstrings allow without pain.',
      'Pause at bottom, feel gentle spine stretch.',
      'Reverse roll up slowly, head comes up last.',
      '5 reps total; never rush or use heavy weight.',
    ],
    order_in_category: 10,
    primary_muscles: ['spinal_erectors', 'hamstrings'],
    secondary_muscles: ['glutes_max', 'core_deep'],
    equipment_required: ['backpack'],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 8 },
      { type: 'decompression', effectiveness: 8 },
    ],
  },
  {
    id: 'tall_008',
    name: 'Wall Angels',
    category: 'getting_taller',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 35,
    instructions: [
      'Stand back against wall, feet 10 cm forward.',
      'Press low back, upper back, head into wall.',
      'Lift arms to 90° (goal-post), backs of hands touch wall.',
      'Slide arms overhead as high as possible without losing contact.',
      'Lower to 90°; 10-12 reps. Stop if shoulders pinch.',
    ],
    order_in_category: 28,
    primary_muscles: ['scapular_stabilisers', 'deltoids_rear'],
    secondary_muscles: ['traps_mid', 'rhomboids'],
    equipment_required: [],
    equipment_optional: ['wall'],
    training_types: [
      { type: 'posture', effectiveness: 9 },
      { type: 'mobility', effectiveness: 7 },
    ],
  },
  {
    id: 'tall_009',
    name: 'Thoracic Extension (Foam Roller)',
    category: 'getting_taller',
    difficulty: 'beginner',
    equipment_level: 'minimal',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Sit on floor, place foam roller (or rolled towel) under upper back.',
      'Support head with hands, tuck chin.',
      'Exhale, arch over roller, reaching shoulders toward floor.',
      'Hold 20-30 s; breathe into chest.',
      'Move roller 2 cm lower and repeat twice.',
    ],
    order_in_category: 30,
    primary_muscles: ['spinal_erectors', 'rhomboids'],
    secondary_muscles: ['traps_mid', 'core_deep'],
    equipment_required: ['foam_roller'],
    equipment_optional: ['rolled_towel'],
    training_types: [
      { type: 'decompression', effectiveness: 8 },
      { type: 'posture', effectiveness: 7 },
    ],
  },
  {
    id: 'tall_010',
    name: 'Neck Rolls',
    category: 'getting_taller',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 30,
    instructions: [
      'Sit or stand tall.',
      'Drop chin toward chest; slowly roll right ear toward right shoulder.',
      'Continue circle back, left ear to left shoulder, finish chin to chest.',
      'Keep shoulders relaxed; move slowly (5 s per half-circle).',
      'Do 3 circles each direction.',
    ],
    order_in_category: 14,
    primary_muscles: ['neck'],
    secondary_muscles: ['traps_upper', 'scapular_stabilisers'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 6 },
      { type: 'recovery', effectiveness: 7 },
    ],
  },
];

// ============================================
// FLEXIBLE (MOBILITY/STRETCHING) EXERCISES
// ============================================

const FLEXIBLE_EXERCISES: SeedExercise[] = [
  {
    id: 'flex_001',
    name: 'Standing Quad Stretch',
    category: 'flexible',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 35,
    instructions: [
      'Stand tall, feet together.',
      'Bend right knee and grab ankle with right hand (or use strap).',
      'Keep knees side-by-side; don\'t let right thigh drift forward.',
      'Gently pull heel toward glute until stretch felt down front of thigh.',
      'Hold 30-45 s, breathe; switch legs.',
    ],
    order_in_category: 1,
    primary_muscles: ['quads', 'hip_flexors'],
    secondary_muscles: ['core_deep'],
    equipment_required: [],
    equipment_optional: ['strap'],
    training_types: [
      { type: 'mobility', effectiveness: 7 },
      { type: 'recovery', effectiveness: 6 },
    ],
  },
  {
    id: 'flex_002',
    name: 'Knee-to-chest Supine',
    category: 'flexible',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 35,
    instructions: [
      'Lie on back, legs straight.',
      'Hug right knee toward chest with both hands.',
      'Keep left leg extended and heavy on floor.',
      'Hold 30 s; feel low-back stretch.',
      'Switch legs; finish with both knees hugged for 10 s.',
    ],
    order_in_category: 2,
    primary_muscles: ['lower_back', 'glutes_max'],
    secondary_muscles: ['hip_flexors', 'hamstrings'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 6 },
      { type: 'recovery', effectiveness: 7 },
    ],
  },
  {
    id: 'flex_003',
    name: 'Reclined Butterfly',
    category: 'flexible',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 60,
    instructions: [
      'Lie on back; bring soles of feet together, knees drop out.',
      'Place hands on inner thighs for gentle extra weight.',
      'Keep low-back neutral (don\'t force knees to floor).',
      'Hold 60 s; breathe into belly.',
    ],
    order_in_category: 3,
    primary_muscles: ['adductors', 'hip_flexors'],
    secondary_muscles: ['glutes_med', 'lower_back'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 7 },
      { type: 'recovery', effectiveness: 7 },
    ],
  },
  {
    id: 'flex_004',
    name: 'Happy Baby',
    category: 'flexible',
    difficulty: 'beginner',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'mat_only_1x1',
    time_per_set_seconds: 45,
    instructions: [
      'Lie on back; grab outer feet or shins.',
      'Knees bend deeper than butterfly, toward armpits.',
      'Flex feet; gently pull knees toward floor beside chest.',
      'Rock side-to-side 30 s to massage low back.',
    ],
    order_in_category: 4,
    primary_muscles: ['hip_flexors', 'lower_back'],
    secondary_muscles: ['adductors', 'glutes_max'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 7 },
      { type: 'recovery', effectiveness: 8 },
    ],
  },
  {
    id: 'flex_005',
    name: 'Front Split (Half-split)',
    category: 'flexible',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 45,
    instructions: [
      'Start in low lunge: right foot forward, both knees 90°.',
      'Slide right foot forward little by little, keeping heel on floor.',
      'Simultaneously straighten front leg and let back knee drift behind until top of foot lies flat.',
      'Keep hips square (imagine headlights forward).',
      'Stop at first strong stretch; hold 30-45s, breathe.',
      'Walk hands back and switch legs.',
    ],
    order_in_category: 5,
    primary_muscles: ['hamstrings', 'hip_flexors'],
    secondary_muscles: ['glutes_max', 'quads'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 8 },
    ],
  },
  {
    id: 'flex_006',
    name: 'Side Split (Middle Split)',
    category: 'flexible',
    difficulty: 'advanced',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 60,
    instructions: [
      'Stand wide, toes forward.',
      'Shift weight side-to-side, bending one knee while keeping the other leg straight (horse-stance rocks).',
      'Gradually widen stance each exhale until you feel inner-thigh stretch.',
      'Place hands on floor for support; keep spine long, chest proud.',
      'Hold 30-60s; micro-bend knees to protect joints.',
    ],
    order_in_category: 6,
    primary_muscles: ['adductors', 'hamstrings'],
    secondary_muscles: ['hip_flexors', 'glutes_med'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 9 },
    ],
  },
  {
    id: 'flex_007',
    name: 'Scorpion Stretch',
    category: 'flexible',
    difficulty: 'intermediate',
    equipment_level: 'none',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 35,
    instructions: [
      'Lie face-down, arms out 90° (T-position).',
      'Lift left leg, bend knee, reach foot across body toward right hand.',
      'Keep shoulders down; turn head opposite if comfortable.',
      'Hold 30s; switch sides.',
      'Stretches abs, hip flexor, thoracic spine.',
    ],
    order_in_category: 7,
    primary_muscles: ['abs', 'hip_flexors'],
    secondary_muscles: ['spinal_erectors', 'deltoids_front'],
    equipment_required: [],
    equipment_optional: [],
    training_types: [
      { type: 'mobility', effectiveness: 8 },
      { type: 'decompression', effectiveness: 6 },
    ],
  },
  {
    id: 'flex_008',
    name: 'King Arthur Stretch',
    category: 'flexible',
    difficulty: 'intermediate',
    equipment_level: 'minimal',
    impact_level: 'no_impact',
    space_required: 'small_bedroom_2x2',
    time_per_set_seconds: 35,
    instructions: [
      'Kneel facing away from couch/bench.',
      'Place top of left foot on edge, shin vertical.',
      'Step right foot forward into lunge.',
      'Push hips forward and down until deep stretch in left quad/hip flexor.',
      'Hold 30s; switch.',
    ],
    order_in_category: 8,
    primary_muscles: ['quads', 'hip_flexors'],
    secondary_muscles: ['glutes_max', 'core_deep'],
    equipment_required: ['bench'],
    equipment_optional: ['chair'],
    training_types: [
      { type: 'mobility', effectiveness: 9 },
    ],
  },
];

// ============================================
// AUDIO GENERATION HELPERS
// ============================================

/**
 * Generate default audio intro for an exercise
 * Format: What it is + main benefit (≤2 sentences)
 */
function generateDefaultAudioIntro(exercise: SeedExercise): string {
  const muscle = exercise.primary_muscles[0]?.replace(/_/g, ' ') || 'multiple muscles';
  const categoryName = exercise.category.replace(/_/g, ' ');
  
  const difficultyDesc = {
    beginner: 'beginner-friendly',
    intermediate: 'moderate',
    advanced: 'challenging',
  }[exercise.difficulty];
  
  return `${exercise.name} is a ${difficultyDesc} ${categoryName} exercise. It primarily targets your ${muscle}.`;
}

/**
 * Generate default audio setup for an exercise
 * Format: Starting position (≤2 sentences)
 */
function generateDefaultAudioSetup(exercise: SeedExercise): string {
  // Use first 1-2 instructions as setup
  const setupInstructions = exercise.instructions.slice(0, 2).join(' ');
  
  // Truncate if too long
  if (setupInstructions.length > 150) {
    return setupInstructions.substring(0, 147) + '...';
  }
  return setupInstructions;
}

/**
 * Generate default audio execution for an exercise
 * Format: How to perform the movement (≤2 sentences)
 */
function generateDefaultAudioExecution(exercise: SeedExercise): string {
  // Use middle instructions as execution
  const midStart = Math.min(2, exercise.instructions.length - 1);
  const midEnd = Math.min(4, exercise.instructions.length);
  const execInstructions = exercise.instructions.slice(midStart, midEnd).join(' ');
  
  // Truncate if too long
  if (execInstructions.length > 150) {
    return execInstructions.substring(0, 147) + '...';
  }
  return execInstructions || 'Perform the movement with control, focusing on proper form.';
}

// Import the expanded exercise generator (700+ exercises)
import { generateAllExercises, type GeneratedExercise } from './exerciseGeneratorExpanded';

// ============================================
// SEED FUNCTION
// ============================================

/**
 * Convert generated exercise to seed exercise format
 */
function convertGeneratedExercise(exercise: GeneratedExercise): SeedExercise {
  return {
    id: exercise.id,
    name: exercise.name,
    category: exercise.category,
    difficulty: exercise.difficulty,
    equipment_level: exercise.equipment_level,
    impact_level: exercise.impact_level,
    space_required: exercise.space_required,
    time_per_set_seconds: exercise.time_per_set_seconds,
    instructions: exercise.instructions,
    order_in_category: exercise.order_in_category,
    primary_muscles: exercise.primary_muscles,
    secondary_muscles: exercise.secondary_muscles,
    equipment_required: exercise.equipment_required,
    equipment_optional: exercise.equipment_optional,
    training_types: exercise.training_types,
    audio_intro: exercise.audio_intro,
    audio_setup: exercise.audio_setup,
    audio_execution: exercise.audio_execution,
    audio_transition: exercise.audio_transition,
  };
}

/**
 * Seed all exercises into the database
 */
export async function seedExercises(): Promise<void> {
  const db = await getDatabase();

  // Check if already seeded
  // Minimum expected exercise count (handcrafted + generated)
  const MINIMUM_EXPECTED = 720; // If fewer than this, re-seed to include generated exercises

  const count = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercises`
  );

  if (count && count.count >= MINIMUM_EXPECTED) {
    console.log(`Database already seeded with ${count.count} exercises (above ${MINIMUM_EXPECTED} threshold)`);
    return;
  }

  // Clear existing exercises if re-seeding (incomplete seed from before generator was added)
  if (count && count.count > 0) {
    console.log(`Re-seeding: found only ${count.count} exercises (below ${MINIMUM_EXPECTED} threshold)`);
    await db.execAsync(`
      DELETE FROM exercise_training_types;
      DELETE FROM exercise_equipment;
      DELETE FROM exercise_muscles;
      DELETE FROM exercises;
    `);
  }

  // Get handcrafted exercises
  const handcraftedExercises = [
    ...CALISTHENICS_EXERCISES,
    ...GETTING_TALLER_EXERCISES,
    ...FLEXIBLE_EXERCISES,
  ];
  
  // Get generated exercises and convert them
  const generatedExercises = generateAllExercises().map(convertGeneratedExercise);
  
  // Merge: use handcrafted first (better quality), then add generated ones with unique IDs
  const handcraftedIds = new Set(handcraftedExercises.map(e => e.id));
  const uniqueGenerated = generatedExercises.filter(e => !handcraftedIds.has(e.id));
  
  const merged = [...handcraftedExercises, ...uniqueGenerated];
  
  // Global deduplication by ID (in case generator produces duplicate IDs)
  const seenIds = new Set<string>();
  const allExercises = merged.filter(e => {
    if (seenIds.has(e.id)) {
      return false;
    }
    seenIds.add(e.id);
    return true;
  });

  console.log(`Seeding ${allExercises.length} exercises (${merged.length - allExercises.length} duplicates removed)...`);

  // Use a transaction for massive performance improvement (700+ exercises)
  await db.execAsync('BEGIN TRANSACTION');
  
  try {
    for (const exercise of allExercises) {
    // Insert exercise with audio fields
    await db.runAsync(
      `INSERT OR REPLACE INTO exercises (id, name, category, difficulty, equipment_level, 
        impact_level, space_required, time_per_set_seconds, instructions, order_in_category,
        audio_intro, audio_setup, audio_execution, audio_transition)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

      [
        exercise.id,
        exercise.name,
        exercise.category,
        exercise.difficulty,
        exercise.equipment_level,
        exercise.impact_level,
        exercise.space_required,
        exercise.time_per_set_seconds,
        JSON.stringify(exercise.instructions),
        exercise.order_in_category,
        exercise.audio_intro || generateDefaultAudioIntro(exercise),
        exercise.audio_setup || generateDefaultAudioSetup(exercise),
        exercise.audio_execution || generateDefaultAudioExecution(exercise),
        exercise.audio_transition || '',
      ]
    );

    // Insert primary muscles (deduplicated)
    const primaryMuscles = [...new Set(exercise.primary_muscles)];
    for (const muscle of primaryMuscles) {
      await db.runAsync(
        `INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle, is_primary) VALUES (?, ?, 1)`,
        [exercise.id, muscle]
      );
    }

    // Insert secondary muscles (deduplicated, skip if already primary)
    const secondaryMuscles = [...new Set(exercise.secondary_muscles)].filter(m => !primaryMuscles.includes(m));
    for (const muscle of secondaryMuscles) {
      await db.runAsync(
        `INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle, is_primary) VALUES (?, ?, 0)`,
        [exercise.id, muscle]
      );
    }

    // Insert required equipment (deduplicated)
    const requiredEquip = [...new Set(exercise.equipment_required)];
    for (const equip of requiredEquip) {
      await db.runAsync(
        `INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment, is_required) VALUES (?, ?, 1)`,
        [exercise.id, equip]
      );
    }

    // Insert optional equipment (deduplicated, skip if already required)
    const optionalEquip = [...new Set(exercise.equipment_optional)].filter(e => !requiredEquip.includes(e));
    for (const equip of optionalEquip) {
      await db.runAsync(
        `INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment, is_required) VALUES (?, ?, 0)`,
        [exercise.id, equip]
      );
    }

    // Insert training types (deduplicated by type)
    const seenTypes = new Set<string>();
    for (const tt of exercise.training_types) {
      if (seenTypes.has(tt.type)) continue;
      seenTypes.add(tt.type);
      await db.runAsync(
        `INSERT OR IGNORE INTO exercise_training_types (exercise_id, training_type, effectiveness) VALUES (?, ?, ?)`,
        [exercise.id, tt.type, tt.effectiveness]
      );
    }
    }

    await db.execAsync('COMMIT');
    console.log(`Successfully seeded ${allExercises.length} exercises`);
  } catch (error) {
    await db.execAsync('ROLLBACK');
    console.error(`Failed to seed exercises:`, error);
    throw error;
  }
}

/**
 * Get total exercise count
 */
export async function getExerciseCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM exercises`
  );
  return result?.count ?? 0;
}
