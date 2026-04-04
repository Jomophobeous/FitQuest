/**
 * DualAI Engine — Coach Intent Definitions
 * Scored matching: best match wins, not first match
 */

// ============================================
// COACH INTENT DEFINITIONS (scored matching)
// ============================================

/** Intent definitions for scored matching — best match wins, not first match */
export const COACH_INTENT_DEFS: Array<{ id: string; keywords: string[]; weight?: number }> = [
  // High-signal intents (specific multi-word phrases score 3 each)
  { id: 'thanks', keywords: ['thanks', 'thank you', 'appreciate', 'thx'], weight: 1.5 },
  { id: 'greeting', keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening', "what's up", 'whats up'] },
  {
    id: 'meal_prep',
    keywords: [
      'meal prep',
      'meal plan',
      'cook',
      'recipe',
      'breakfast',
      'lunch',
      'dinner',
      'snack',
      'what to eat',
      'what should i eat',
    ],
  },
  {
    id: 'macros',
    keywords: ['macro', 'how much protein', 'how many calories', 'calorie count', 'tdee', 'bulk', 'cut', 'caloric'],
  },
  {
    id: 'body_transform',
    keywords: ['transform', 'physique', 'appearance', 'aesthetic', 'craft my body', 'body transformation', 'recomp'],
  },
  { id: 'warmup', keywords: ['warm up', 'warmup', 'cool down', 'cooldown', 'before workout', 'after workout'] },
  {
    id: 'exercise_rec',
    keywords: [
      'recommend',
      'suggest exercise',
      'what exercise',
      'which exercise',
      'workout idea',
      'exercise for',
      'best exercise',
    ],
  },
  {
    id: 'frequency',
    keywords: ['how often', 'frequency', 'schedule', 'routine', 'split', 'training days', 'days per week'],
  },
  {
    id: 'motivation',
    keywords: [
      'motivation',
      'tired',
      "can't",
      'give up',
      'hard',
      'push through',
      'keep going',
      'struggle',
      'motivate',
      'lazy',
      'no energy',
      'exhausted',
      'quit',
    ],
  },
  { id: 'form', keywords: ['form', 'technique', 'how to do', 'correct form', 'proper form', 'posture'] },
  { id: 'rest', keywords: ['rest', 'recover', 'sore', 'fatigue', 'recovery day', 'off day', 'overtraining', 'deload'] },
  { id: 'streak', keywords: ['streak', 'consistent', 'days in a row', 'consistency'] },
  { id: 'nutrition', keywords: ['eat', 'food', 'nutrition', 'diet', 'protein', 'calorie', 'healthy eating'] },
  {
    id: 'progress',
    keywords: ['progress', 'results', 'improve', 'plateau', 'stuck', 'not seeing results', 'getting stronger'],
  },
  { id: 'stretching', keywords: ['stretch', 'flexible', 'mobility', 'stiff', 'tight', 'foam roll'] },
  { id: 'sleep', keywords: ['sleep', 'insomnia', 'bedtime', "can't sleep", 'rest quality', 'tired at night'] },
  {
    id: 'injury',
    keywords: [
      'injury',
      'prevent injury',
      'joint pain',
      'knee pain',
      'shoulder pain',
      'back pain',
      'wrist pain',
      'hurt',
    ],
  },
  {
    id: 'supplements',
    keywords: ['supplement', 'creatine', 'protein powder', 'bcaa', 'pre workout', 'vitamin', 'fish oil'],
  },
  {
    id: 'mental',
    keywords: ['mental', 'stress', 'anxiety', 'confidence', 'discipline', 'mindset', 'mental health', 'depression'],
  },
  { id: 'hydration', keywords: ['water', 'hydration', 'drink water', 'dehydrated', 'thirsty', 'electrolyte'] },
  {
    id: 'weight',
    keywords: ['lose weight', 'gain weight', 'fat loss', 'skinny', 'overweight', 'bmi', 'body fat', 'weight loss'],
  },
  // Phase 4: New intent definitions
  {
    id: 'skill_progressions',
    keywords: [
      'progression',
      'progress to',
      'next level',
      'advance',
      'bodyweight skill',
      'handstand',
      'muscle up',
      'planche',
      'pistol squat',
      'unlock',
    ],
  },
  { id: 'outdoor', keywords: ['outdoor', 'outside', 'park', 'playground', 'fresh air', 'nature', 'garden'] },
  {
    id: 'plateau',
    keywords: ['plateau', 'stuck', 'stagnant', 'not progressing', 'no progress', 'same weight', 'same reps'],
  },
  { id: 'pr', keywords: ['personal record', 'pr', 'personal best', 'pb', 'new max', 'best ever', 'record'] },
  { id: 'partner', keywords: ['partner', 'buddy', 'training together', 'solo', 'alone', 'accountability'] },
  {
    id: 'seasonal',
    keywords: ['summer', 'winter', 'spring', 'autumn', 'fall', 'hot weather', 'cold weather', 'rain', 'season'],
  },
  {
    id: 'energy',
    keywords: [
      'energy',
      'low energy',
      'pre workout',
      'caffeine',
      'tired before',
      'no energy',
      'fatigue before',
      'boost',
    ],
  },
  {
    id: 'breathing',
    keywords: ['breath', 'breathing', 'breathe', 'inhale', 'exhale', 'oxygen', 'winded', 'out of breath'],
  },
  {
    id: 'time_mgmt',
    keywords: [
      'no time',
      'busy',
      'short workout',
      'quick workout',
      'time efficient',
      '15 minutes',
      '20 minutes',
      'fit in',
    ],
  },
  {
    id: 'mindfulness',
    keywords: [
      'mindful',
      'focus',
      'concentrate',
      'mind muscle',
      'visualization',
      'meditate',
      'mental training',
      'presence',
    ],
  },
  {
    id: 'recovery_protocol',
    keywords: [
      'foam roll',
      'ice bath',
      'cold shower',
      'sauna',
      'massage',
      'active recovery',
      'recovery protocol',
      'rest day routine',
    ],
  },
];
