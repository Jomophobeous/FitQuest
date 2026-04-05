/**
 * FitQuest Client-Side SQLite Database Types
 * Based on FitQuest_Filters.docx specifications
 */

// ============================================
// FILTER ENUMS (from docx filter catalogue)
// ============================================

export type Category = 'body_control' | 'posture' | 'speed' | 'mobility' | 'focus' | 'strength';

// v10: Force type from external exercise databases
export type ForceType = 'push' | 'pull' | 'static' | 'compound' | null;

// v10: Exercise mechanic type (compound vs isolation)
export type MechanicType = 'compound' | 'isolation' | null;

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type EquipmentLevel = 'none' | 'minimal' | 'playground';

export type EquipmentItem =
  // Minimal equipment
  | 'backpack'
  | 'band'
  | 'chair'
  | 'door_frame'
  | 'jump_rope'
  | 'pillow'
  | 'rolled_towel'
  | 'strap'
  | 'table'
  | 'towel'
  | 'wall'
  | 'foam_roller'
  // Playground equipment
  | 'pull_up_bar'
  | 'parallel_bars'
  | 'monkey_bars'
  | 'bench'
  | 'hill'
  | 'sand'
  | 'sled'
  | 'parachute'
  | 'parallettes'
  | 'rings';

export type TargetMuscle =
  | 'abs'
  | 'adductors'
  | 'ankle'
  | 'biceps'
  | 'brachialis'
  | 'calves_gastrocnemius'
  | 'calves_soleus'
  | 'chest_upper'
  | 'chest_mid'
  | 'chest_lower'
  | 'core_deep'
  | 'deltoids_front'
  | 'deltoids_lateral'
  | 'deltoids_rear'
  | 'erector_spinae'
  | 'forearms'
  | 'glutes_max'
  | 'glutes_med'
  | 'glutes_min'
  | 'hamstrings'
  | 'hip_flexors'
  | 'lats'
  | 'lower_back'
  | 'neck'
  | 'obliques'
  | 'pecs'
  | 'quads'
  | 'rhomboids'
  | 'rotator_cuff'
  | 'scapular_stabilisers'
  | 'shoulders'
  | 'shin_tibialis'
  | 'spinal_erectors'
  | 'serratus'
  | 'traps_upper'
  | 'traps_mid'
  | 'triceps'
  | 'vagus_nerve'
  | 'whole_body';

export type TrainingType =
  | 'strength'
  | 'hypertrophy'
  | 'endurance'
  | 'mobility'
  | 'speed_power'
  | 'balance'
  | 'recovery'
  | 'mindfulness'
  | 'fat_loss'
  | 'posture'
  | 'decompression'
  | 'coordination';

export type TimeFilter = 'under_5_min' | '5_10_min' | '10_20_min' | '20_30_min' | '30_45_min' | 'over_45_min';

export type SpaceFilter = 'mat_only_1x1' | 'small_bedroom_2x2' | 'living_room_3x3' | 'outdoors_hall';

export type ImpactLevel = 'no_impact' | 'low_impact' | 'high_impact';

// ============================================
// DATABASE ENTITY TYPES
// ============================================

export interface Exercise {
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
  created_at: string;
  updated_at: string;
  // Audio instruction fields (TTS-optimized, ≤2 sentences each)
  audio_intro: string; // "Next exercise: Push-ups"
  audio_setup: string; // "Hands under shoulders. Body straight."
  audio_execution: string; // "Lower under control. Push explosively."
  audio_transition: string; // "Rest for 30 seconds."
  // v10 fields for external exercise database
  external_id?: string;
  force_type?: ForceType;
  mechanic?: MechanicType;
}

export interface ExerciseMuscle {
  exercise_id: string;
  muscle: TargetMuscle;
  is_primary: boolean;
}

export interface ExerciseEquipment {
  exercise_id: string;
  equipment: EquipmentItem;
  is_required: boolean;
}

export interface ExerciseTrainingType {
  exercise_id: string;
  training_type: TrainingType;
  effectiveness: number; // 1-10 scale
}

export interface ExerciseTranslation {
  exercise_id: string;
  language: string;
  name: string;
  instructions: string; // JSON array of instruction steps
  audio_intro: string;
  audio_setup: string;
  audio_execution: string;
  audio_transition: string;
  created_at: string;
}

// ============================================
// USER STATE TABLES
// ============================================

export interface UserProfile {
  id: string;
  sex?: 'male' | 'female' | 'other';
  weight_kg?: number;
  height_cm?: number;
  goal: Category;
  experience: Difficulty;
  training_days_per_week: number;
  time_per_session_minutes: number;
  created_at: string;
  updated_at: string;
  locked: boolean;
}

export interface UserEquipment {
  user_id: string;
  equipment: EquipmentItem;
}

export interface UserInjury {
  user_id: string;
  muscle: TargetMuscle;
  severity: 'mild' | 'moderate' | 'severe';
  created_at: string;
}

export interface MuscleFatigue {
  user_id: string;
  muscle: TargetMuscle;
  fatigue_level: number; // 0-100
  last_trained_at: string | null;
  updated_at: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  started_at: string;
  completed_at?: string;
  duration_minutes: number;
  total_exercises: number;
  completed_exercises: number;
  success: boolean;
  notes?: string;
}

// ============================================
// FITMIND TYPES (Cognitive Fitness)
// ============================================

export type DocumentType = 'PDF' | 'EPUB' | 'ARTICLE' | 'NOTE';
export type DocumentStatus = 'UNREAD' | 'READING' | 'COMPLETED' | 'ARCHIVED';

export interface FitMindDocument {
  id: string;
  title: string;
  author: string;
  type: DocumentType;
  status: DocumentStatus;
  category: string;
  tags: string;
  file_path: string | null;
  file_size: number;
  total_pages: number;
  current_page: number;
  content: string | null;
  word_count: number;
  reading_level: string | null;
  estimated_minutes: number;
  cover_color: string | null;
  created_at: number;
  updated_at: number;
}

export interface ReadingSession {
  id: string;
  document_id: string;
  start_page: number;
  end_page: number;
  duration_minutes: number;
  words_read: number;
  comprehension_score: number | null;
  notes: string | null;
  created_at: number;
}

export interface Annotation {
  id: string;
  document_id: string;
  page_number: number;
  type: 'HIGHLIGHT' | 'NOTE' | 'BOOKMARK' | 'QUESTION';
  content: string;
  color: string;
  position_start: number | null;
  position_end: number | null;
  created_at: number;
}

/**
 * Flashcard with FSRS (Free Spaced Repetition Scheduler) fields.
 * FSRS provides ~40% better retention than SM-2.
 *
 * State progression: New(0) → Learning(1) → Review(2) ↔ Relearning(3)
 */
export interface Flashcard {
  id: string;
  document_id: string;
  front: string;
  back: string;
  // FSRS core fields
  difficulty: number; // FSRS difficulty (1-10 scale, ~5 is neutral)
  stability: number; // Memory stability in days (how long until 90% retention drops)
  state: FlashcardState; // Current learning state (0=New, 1=Learning, 2=Review, 3=Relearning)
  // Scheduling
  due: number; // Next review timestamp (Unix ms) — replaces next_review
  scheduled_days: number; // Days until next review — replaces interval_days
  last_review: number | null; // Timestamp of last review
  // Progress tracking
  reps: number; // Total successful reviews — replaces repetitions
  lapses: number; // Number of times card was forgotten
  learning_steps: number; // Current step in (re)learning sequence
  // Legacy compatibility (for migration)
  ease_factor: number; // SM-2 ease factor (kept for backwards compat)
  created_at: number;
}

/**
 * FSRS card states matching ts-fsrs State enum.
 */
export type FlashcardState = 0 | 1 | 2 | 3; // New=0, Learning=1, Review=2, Relearning=3

export interface ReadingGoal {
  id: string;
  user_id: string;
  type: 'DAILY_MINUTES' | 'WEEKLY_PAGES' | 'MONTHLY_BOOKS';
  target: number;
  current: number;
  period_start: number;
  period_end: number;
  achieved: number;
  created_at: number;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order_in_session: number;
  prescribed_sets: number;
  prescribed_reps: string; // e.g., "8-12" or "30s"
  completed_sets: number;
  completed_reps?: string;
  skipped: boolean;
  notes?: string;
}

export interface ProgressRecord {
  id: string;
  user_id: string;
  exercise_id: string;
  date: string;
  sets_completed: number;
  reps_achieved: string;
  difficulty_rating?: number; // 1-10, optional
  notes?: string;
}

// ============================================
// SUBSCRIPTION / STATE TABLES
// ============================================

export interface SubscriptionState {
  user_id: string;
  tier: 'free' | 'premium';
  expires_at?: string;
  last_verified_at: string;
  grace_period_start?: string;
  receipt_data?: string;
}

export interface AppState {
  key: string;
  value: string;
  updated_at: string;
}

// ============================================
// QUERY / FILTER TYPES
// ============================================

export interface ExerciseFilter {
  categories?: Category[];
  difficulties?: Difficulty[];
  equipment_levels?: EquipmentLevel[];
  target_muscles?: TargetMuscle[];
  training_types?: TrainingType[];
  impact_levels?: ImpactLevel[];
  space_filters?: SpaceFilter[];
  max_time_per_set?: number;
  exclude_equipment?: EquipmentItem[];
  exclude_muscles?: TargetMuscle[]; // for injuries
}

export interface ExerciseWithDetails extends Exercise {
  primary_muscles: TargetMuscle[];
  secondary_muscles: TargetMuscle[];
  equipment_required: EquipmentItem[];
  equipment_optional: EquipmentItem[];
  training_types: { type: TrainingType; effectiveness: number }[];
}

export interface ExerciseImageRecord {
  id: number;
  exercise_id: string;
  image_path: string;
  image_order: number;
  source: 'external' | 'shared' | 'user' | 'generated';
}

// ============================================
// DATABASE SCHEMA VERSION
// ============================================

export const SCHEMA_VERSION = 22; // v22: focus category exercises seeded

// ============================================
// v17 TYPES
// ============================================

export type PersonalDevelopmentTopic =
  | 'fitness'
  | 'nutrition'
  | 'mental_health'
  | 'productivity'
  | 'leadership'
  | 'financial_literacy'
  | 'relationships'
  | 'spirituality'
  | 'creativity'
  | 'self_discipline'
  | 'communication'
  | 'mindfulness'
  | 'career_growth'
  | 'time_management'
  | 'emotional_intelligence';

export interface UserInterest {
  user_id: string;
  topic: PersonalDevelopmentTopic;
  priority: number; // 1-5
  created_at: number;
}

export interface UserPersonalGoal {
  id: string;
  user_id: string;
  goal_text: string;
  category: string; // freeform user category
  status: 'active' | 'completed' | 'paused';
  created_at: number;
  updated_at: number;
}

export interface MindXPData {
  user_id: string;
  total_mind_xp: number;
  mind_level: number;
  pages_read_total: number;
  flashcards_reviewed_total: number;
  documents_completed: number;
  updated_at: number;
}

export type PricingRegion =
  | 'africa'
  | 'europe'
  | 'north_america'
  | 'south_america'
  | 'asia'
  | 'oceania'
  | 'middle_east';

export interface RegionalPricing {
  region: PricingRegion;
  monthly_price: number;
  annual_price: number;
  currency_code: string;
  currency_symbol: string;
}
