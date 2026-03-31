/**
 * IntentRouter — Natural Language Intent Classification & Routing Engine
 *
 * Classifies user queries and routes them to the appropriate subsystem:
 * - COACH (DualAI) — workout advice, form tips, motivation
 * - PROFESSOR (DualAI) — reading comprehension, study tips, summaries
 * - HEALTH — health data queries, body metrics, nutrition
 * - WORKOUT — workout generation, exercise lookup, program management
 * - NAVIGATION — screen/feature navigation commands
 * - SETTINGS — app configuration, preferences
 * - GENERAL — catch-all for unclassified queries
 *
 * Uses keyword scoring + context weighting (no ML dependency).
 * Designed for on-device, zero-latency classification.
 */

import { AIPersonality, AIContext, AIResponse, DualAIEngine } from './DualAIEngine';
import { trainedIntentRouter } from '../ai/TrainedIntentRouter';
// NeuralIntentRouter removed — 48MB JS transformer is too heavy for 4GB devices.
// The lightweight TF-IDF + keyword classifier provides equivalent routing quality.

// ============================================
// TYPES
// ============================================

export type IntentCategory = 'COACH' | 'PROFESSOR' | 'HEALTH' | 'WORKOUT' | 'NAVIGATION' | 'SETTINGS' | 'GENERAL';

export interface ClassifiedIntent {
  /** Primary intent category */
  category: IntentCategory;
  /** Confidence score 0-1 */
  confidence: number;
  /** Secondary intent if ambiguous (confidence gap < 0.15) */
  secondaryCategory?: IntentCategory;
  secondaryConfidence?: number;
  /** Extracted entities from the query */
  entities: ExtractedEntities;
  /** Original query */
  query: string;
  /** Processing time in ms */
  classificationTimeMs: number;
}

export interface ExtractedEntities {
  /** Exercise names mentioned */
  exercises: string[];
  /** Muscle groups mentioned */
  muscleGroups: string[];
  /** Numbers/quantities extracted */
  numbers: number[];
  /** Time references (today, yesterday, this week, etc.) */
  timeReferences: string[];
  /** Body metrics (weight, height, bmi, etc.) */
  metrics: string[];
  /** Navigation targets (dashboard, profile, exercises, etc.) */
  screens: string[];
}

export interface RoutedResponse {
  /** The classified intent */
  intent: ClassifiedIntent;
  /** Response from the routed subsystem */
  response: AIResponse;
  /** Which subsystem handled the query */
  handler: string;
}

export interface RouterConfig {
  /** Minimum confidence to route (below this → GENERAL) */
  confidenceThreshold: number;
  /** Whether to include conversation history as context */
  useConversationContext: boolean;
  /** Max recent messages to consider for context */
  contextWindowSize: number;
}

// ============================================
// KEYWORD DICTIONARIES
// ============================================

const INTENT_KEYWORDS: Record<IntentCategory, { keywords: string[]; weight: number }[]> = {
  COACH: [
    { keywords: ['workout', 'exercise', 'train', 'training', 'form', 'technique'], weight: 2.0 },
    { keywords: ['motivation', 'motivate', 'inspire', 'push', 'encourage', 'lazy'], weight: 1.8 },
    { keywords: ['rep', 'reps', 'set', 'sets', 'rest', 'tempo', 'superset'], weight: 2.5 },
    { keywords: ['warm up', 'warmup', 'cool down', 'cooldown', 'stretch'], weight: 1.5 },
    { keywords: ['coach', 'trainer', 'advice', 'tip', 'suggest'], weight: 1.5 },
    { keywords: ['muscle', 'gain', 'bulk', 'lean', 'cut', 'shred', 'tone'], weight: 1.8 },
    { keywords: ['chest', 'back', 'legs', 'arms', 'shoulders', 'core', 'abs', 'glutes'], weight: 1.5 },
    { keywords: ['push-up', 'pushup', 'pull-up', 'pullup', 'squat', 'lunge', 'plank'], weight: 2.0 },
    { keywords: ['sore', 'recovery', 'recover', 'overtraining', 'fatigue', 'tired'], weight: 1.5 },
    { keywords: ['progress', 'plateau', 'improve', 'better', 'stronger', 'speed'], weight: 1.3 },
  ],
  PROFESSOR: [
    { keywords: ['read', 'reading', 'book', 'document', 'article', 'text'], weight: 2.0 },
    { keywords: ['study', 'learn', 'understand', 'comprehend', 'explain'], weight: 1.8 },
    { keywords: ['flashcard', 'flashcards', 'quiz', 'review', 'memorize'], weight: 2.5 },
    { keywords: ['summary', 'summarize', 'summarise', 'key points', 'main idea'], weight: 2.0 },
    { keywords: ['vocabulary', 'word', 'definition', 'meaning', 'concept'], weight: 1.5 },
    { keywords: ['professor', 'teacher', 'tutor', 'mentor'], weight: 1.8 },
    { keywords: ['note', 'notes', 'annotation', 'highlight', 'bookmark'], weight: 1.5 },
    { keywords: ['chapter', 'page', 'paragraph', 'section'], weight: 1.5 },
    { keywords: ['library', 'collection', 'import', 'upload'], weight: 1.3 },
    { keywords: ['focus', 'concentration', 'reading speed', 'wpm'], weight: 1.3 },
  ],
  HEALTH: [
    { keywords: ['health', 'healthy', 'wellness', 'wellbeing'], weight: 2.0 },
    { keywords: ['calories', 'calorie', 'kcal', 'tdee', 'bmr', 'metabolism'], weight: 2.5 },
    { keywords: ['weight', 'bmi', 'body fat', 'body mass', 'lean mass'], weight: 2.0 },
    { keywords: ['heart rate', 'heartrate', 'bpm', 'pulse', 'resting heart'], weight: 2.5 },
    { keywords: ['sleep', 'sleeping', 'insomnia', 'rest', 'nap', 'bedtime'], weight: 2.0 },
    { keywords: ['nutrition', 'diet', 'macro', 'macros', 'protein', 'carbs', 'fat'], weight: 2.0 },
    { keywords: ['hydration', 'water', 'dehydrated', 'drink'], weight: 1.5 },
    { keywords: ['step', 'steps', 'walk', 'walking', 'pedometer'], weight: 1.5 },
    { keywords: ['anomaly', 'unusual', 'abnormal', 'alert', 'warning'], weight: 1.8 },
    { keywords: ['blood pressure', 'oxygen', 'spo2', 'stress'], weight: 2.0 },
  ],
  WORKOUT: [
    { keywords: ['generate', 'create', 'build', 'make', 'start'], weight: 1.5 },
    { keywords: ['workout', 'routine', 'program', 'plan', 'schedule'], weight: 2.0 },
    { keywords: ['beginner', 'intermediate', 'advanced', 'difficulty'], weight: 1.5 },
    { keywords: ['equipment', 'dumbbell', 'barbell', 'resistance band', 'bodyweight'], weight: 1.8 },
    { keywords: ['body_control', 'gymnastics', 'functional', 'hiit', 'cardio'], weight: 2.0 },
    { keywords: ['deload', 'progressive overload', 'periodization'], weight: 2.5 },
    { keywords: ['split', 'full body', 'upper lower', 'push pull'], weight: 2.0 },
    { keywords: ['today', 'next workout', 'my workout', 'session'], weight: 1.3 },
    { keywords: ['streak', 'xp', 'level', 'achievement', 'badge'], weight: 1.3 },
    { keywords: ['log', 'track', 'record', 'history'], weight: 1.0 },
  ],
  NAVIGATION: [
    { keywords: ['go to', 'open', 'show', 'navigate', 'take me to'], weight: 2.5 },
    { keywords: ['dashboard', 'home', 'main screen', 'overview'], weight: 2.0 },
    { keywords: ['profile', 'settings', 'account', 'preferences'], weight: 2.0 },
    { keywords: ['exercises', 'exercise list', 'browse', 'search'], weight: 1.5 },
    { keywords: ['fitquest', 'quest', 'challenge', 'mission'], weight: 1.5 },
    { keywords: ['move', 'jog', 'run', 'walk', 'tracker'], weight: 1.3 },
    { keywords: ['meal', 'meal prep', 'food', 'recipe'], weight: 1.5 },
    { keywords: ['analytics', 'stats', 'statistics', 'chart', 'graph'], weight: 1.5 },
    { keywords: ['craft', 'body craft', 'customize'], weight: 1.3 },
    { keywords: ['where', 'find', 'locate', 'screen'], weight: 1.0 },
  ],
  SETTINGS: [
    { keywords: ['settings', 'setting', 'configure', 'configuration', 'setup'], weight: 2.5 },
    { keywords: ['language', 'translate', 'translation', 'locale'], weight: 2.0 },
    { keywords: ['theme', 'dark mode', 'light mode', 'color', 'appearance'], weight: 2.0 },
    { keywords: ['notification', 'notifications', 'remind', 'reminder', 'alarm'], weight: 2.0 },
    { keywords: ['privacy', 'security', 'biometric', 'fingerprint', 'face id'], weight: 2.0 },
    { keywords: ['sync', 'backup', 'export', 'import', 'data'], weight: 1.5 },
    { keywords: ['subscription', 'premium', 'pro', 'upgrade', 'plan'], weight: 1.8 },
    { keywords: ['unit', 'units', 'metric', 'imperial', 'kg', 'lbs'], weight: 1.5 },
    { keywords: ['audio', 'sound', 'music', 'volume'], weight: 1.3 },
    { keywords: ['reset', 'clear', 'delete', 'erase', 'wipe'], weight: 1.5 },
  ],
  GENERAL: [
    { keywords: ['hello', 'hi', 'hey', 'sup', 'yo', 'greetings'], weight: 2.0 },
    { keywords: ['help', 'how', 'what', 'why', 'when', 'who'], weight: 0.5 },
    { keywords: ['thanks', 'thank you', 'appreciate', 'great', 'awesome'], weight: 2.0 },
    { keywords: ['who are you', 'what can you do', 'features', 'about'], weight: 1.5 },
    { keywords: ['joke', 'fun', 'funny', 'bored', 'chat'], weight: 1.5 },
  ],
};

// Entity extraction patterns
const ENTITY_PATTERNS = {
  exercises: [
    'push-up',
    'pushup',
    'pull-up',
    'pullup',
    'squat',
    'lunge',
    'plank',
    'deadlift',
    'bench press',
    'crunch',
    'burpee',
    'dip',
    'row',
    'curl',
    'press',
    'fly',
    'raise',
    'extension',
    'sit-up',
    'situp',
  ],
  muscleGroups: [
    'chest',
    'back',
    'legs',
    'arms',
    'shoulders',
    'core',
    'abs',
    'glutes',
    'hamstrings',
    'quads',
    'quadriceps',
    'biceps',
    'triceps',
    'calves',
    'forearms',
    'traps',
    'lats',
    'deltoids',
    'obliques',
  ],
  timeReferences: [
    'today',
    'yesterday',
    'tomorrow',
    'this week',
    'last week',
    'next week',
    'this month',
    'last month',
    'this year',
    'morning',
    'evening',
    'night',
  ],
  metrics: [
    'weight',
    'height',
    'bmi',
    'body fat',
    'heart rate',
    'bpm',
    'calories',
    'steps',
    'sleep',
    'recovery',
    'vo2max',
  ],
  screens: [
    'dashboard',
    'home',
    'profile',
    'settings',
    'exercises',
    'fitquest',
    'move',
    'meal prep',
    'analytics',
    'craft my body',
    'library',
    'reader',
  ],
};

// ============================================
// INTENT ROUTER CLASS
// ============================================

export class IntentRouter {
  private static instance: IntentRouter | null = null;
  private dualAI: DualAIEngine;
  private recentIntents: ClassifiedIntent[] = [];
  private config: RouterConfig;
  private mlModelReady = false;

  private constructor() {
    this.dualAI = DualAIEngine.getInstance();
    this.config = {
      confidenceThreshold: 0.25,
      useConversationContext: true,
      contextWindowSize: 5,
    };
    // Initialize lightweight trained model in background (~305KB)
    this.initMLModel();
  }

  private async initMLModel(): Promise<void> {
    try {
      this.mlModelReady = await trainedIntentRouter.initialize();
      if (this.mlModelReady && __DEV__) {
        console.warn('[IntentRouter] v1.0 ML model loaded — using trained classifier');
      }
    } catch {
      if (__DEV__) console.warn('[IntentRouter] ML model unavailable — using keyword fallback');
    }
  }

  static getInstance(): IntentRouter {
    if (!IntentRouter.instance) {
      IntentRouter.instance = new IntentRouter();
    }
    return IntentRouter.instance;
  }

  // ============================================
  // CLASSIFICATION
  // ============================================

  /**
   * Classify a user query into an intent category.
   * Uses: v1.0 TF-IDF+SVC (fast, ~5ms) → keyword scoring fallback
   */
  classify(query: string): ClassifiedIntent {
    const startTime = Date.now();
    const normalizedQuery = query.toLowerCase().trim();

    // Try ML model first (if loaded) — ~5ms, 305KB
    if (this.mlModelReady && trainedIntentRouter.loaded) {
      const mlResult = trainedIntentRouter.classify(query);
      if (mlResult.confidence >= this.config.confidenceThreshold) {
        // Map ML intent to our IntentCategory
        const categoryMap: Record<string, IntentCategory> = {
          WORKOUT: 'WORKOUT',
          FORM_CHECK: 'COACH',
          HEALTH_QUERY: 'HEALTH',
          MOTIVATION: 'COACH',
          NUTRITION: 'HEALTH',
          NAVIGATION: 'NAVIGATION',
          SETTINGS: 'SETTINGS',
          GENERAL: 'GENERAL',
          COACH: 'COACH',
          PROFESSOR: 'PROFESSOR',
        };

        const category = categoryMap[mlResult.intent] ?? 'GENERAL';
        const entities = this.extractEntities(normalizedQuery);

        // Find secondary from ML alternatives
        let secondaryCategory: IntentCategory | undefined;
        let secondaryConfidence: number | undefined;
        if (mlResult.alternatives.length > 0) {
          const alt = mlResult.alternatives[0];
          if (alt) {
            secondaryCategory = categoryMap[alt.intent] ?? 'GENERAL';
            secondaryConfidence = alt.confidence;
            // Only show if gap is small
            if (mlResult.confidence - (secondaryConfidence ?? 0) >= 0.15) {
              secondaryCategory = undefined;
              secondaryConfidence = undefined;
            }
          }
        }

        const result: ClassifiedIntent = {
          category,
          confidence: mlResult.confidence,
          secondaryCategory,
          secondaryConfidence,
          entities,
          query,
          classificationTimeMs: Date.now() - startTime,
        };
        this.recentIntents.push(result);
        if (this.recentIntents.length > 50) this.recentIntents.shift();
        return result;
      }
    }

    // Fallback: keyword-based scoring

    // Score each category
    const scores: Record<IntentCategory, number> = {
      COACH: 0,
      PROFESSOR: 0,
      HEALTH: 0,
      WORKOUT: 0,
      NAVIGATION: 0,
      SETTINGS: 0,
      GENERAL: 0,
    };

    // Keyword matching with weighted scoring
    for (const [category, groups] of Object.entries(INTENT_KEYWORDS)) {
      for (const group of groups) {
        for (const keyword of group.keywords) {
          if (normalizedQuery.includes(keyword)) {
            scores[category as IntentCategory] += group.weight;

            // Bonus for exact word boundary matches (not partial)
            const regex = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
            if (regex.test(normalizedQuery)) {
              scores[category as IntentCategory] += group.weight * 0.5;
            }
          }
        }
      }
    }

    // Context boost: if recent intents cluster on a category, boost it
    if (this.config.useConversationContext && this.recentIntents.length > 0) {
      const recentWindow = this.recentIntents.slice(-this.config.contextWindowSize);
      const contextCounts: Partial<Record<IntentCategory, number>> = {};
      for (const intent of recentWindow) {
        contextCounts[intent.category] = (contextCounts[intent.category] ?? 0) + 1;
      }
      for (const [cat, count] of Object.entries(contextCounts)) {
        // Small boost proportional to recent frequency
        scores[cat as IntentCategory] += count * 0.3;
      }
    }

    // Disambiguation: if COACH and WORKOUT both score high, use query structure
    if (scores.COACH > 0 && scores.WORKOUT > 0) {
      // Questions about "how to" → COACH; "generate/create" → WORKOUT
      if (/\b(how|why|should|can|is it|do i)\b/i.test(normalizedQuery)) {
        scores.COACH += 1.5;
      }
      if (/\b(generate|create|build|make|give me|start)\b/i.test(normalizedQuery)) {
        scores.WORKOUT += 1.5;
      }
    }

    // Extract entities
    const entities = this.extractEntities(normalizedQuery);

    // PROFESSOR system disabled — merge PROFESSOR score into COACH
    if (scores.PROFESSOR > 0) {
      scores.COACH += scores.PROFESSOR;
      scores.PROFESSOR = 0;
    }

    // Find top two categories
    const sorted = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .filter(([, score]) => score > 0);

    let primaryCategory: IntentCategory = 'GENERAL';
    let confidence = 0;
    let secondaryCategory: IntentCategory | undefined;
    let secondaryConfidence: number | undefined;

    if (sorted.length > 0) {
      const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
      primaryCategory = sorted[0]![0] as IntentCategory;
      confidence = totalScore > 0 ? sorted[0]![1] / totalScore : 0;

      if (sorted.length > 1) {
        secondaryCategory = sorted[1]![0] as IntentCategory;
        secondaryConfidence = totalScore > 0 ? sorted[1]![1] / totalScore : 0;

        // If gap is too small, mark ambiguous
        if (confidence - (secondaryConfidence ?? 0) < 0.15) {
          // Keep secondary for disambiguation
        } else {
          secondaryCategory = undefined;
          secondaryConfidence = undefined;
        }
      }
    }

    // Below threshold → GENERAL
    if (confidence < this.config.confidenceThreshold) {
      primaryCategory = 'GENERAL';
    }

    const result: ClassifiedIntent = {
      category: primaryCategory,
      confidence: Math.round(confidence * 100) / 100,
      secondaryCategory,
      secondaryConfidence: secondaryConfidence ? Math.round(secondaryConfidence * 100) / 100 : undefined,
      entities,
      query,
      classificationTimeMs: Date.now() - startTime,
    };

    // Store for context
    this.recentIntents.push(result);
    if (this.recentIntents.length > 20) {
      this.recentIntents = this.recentIntents.slice(-20);
    }

    return result;
  }

  // ============================================
  // ENTITY EXTRACTION
  // ============================================

  private extractEntities(normalizedQuery: string): ExtractedEntities {
    const entities: ExtractedEntities = {
      exercises: [],
      muscleGroups: [],
      numbers: [],
      timeReferences: [],
      metrics: [],
      screens: [],
    };

    for (const exercise of ENTITY_PATTERNS.exercises) {
      if (normalizedQuery.includes(exercise)) {
        entities.exercises.push(exercise);
      }
    }

    for (const muscle of ENTITY_PATTERNS.muscleGroups) {
      if (normalizedQuery.includes(muscle)) {
        entities.muscleGroups.push(muscle);
      }
    }

    for (const timeRef of ENTITY_PATTERNS.timeReferences) {
      if (normalizedQuery.includes(timeRef)) {
        entities.timeReferences.push(timeRef);
      }
    }

    for (const metric of ENTITY_PATTERNS.metrics) {
      if (normalizedQuery.includes(metric)) {
        entities.metrics.push(metric);
      }
    }

    for (const screen of ENTITY_PATTERNS.screens) {
      if (normalizedQuery.includes(screen)) {
        entities.screens.push(screen);
      }
    }

    // Extract numbers
    const numberMatches = normalizedQuery.match(/\b\d+\.?\d*\b/g);
    if (numberMatches) {
      entities.numbers = numberMatches.map(Number).filter((n) => !isNaN(n));
    }

    return entities;
  }

  // ============================================
  // ROUTING
  // ============================================

  /**
   * Classify and route a query to the appropriate handler.
   * Returns a unified response regardless of which subsystem handled it.
   */
  async route(query: string, additionalContext?: Partial<AIContext>): Promise<RoutedResponse> {
    const intent = this.classify(query);

    let response: AIResponse;
    let handler: string;

    switch (intent.category) {
      case 'COACH': {
        const context: AIContext = {
          personality: 'COACH' as AIPersonality,
          ...additionalContext,
        };
        response = await this.dualAI.query(query, context);
        handler = 'DualAI:COACH';
        break;
      }

      case 'PROFESSOR': {
        // Professor disabled — route to Coach instead
        const context: AIContext = {
          personality: 'COACH' as AIPersonality,
          ...additionalContext,
        };
        response = await this.dualAI.query(query, context);
        handler = 'DualAI:COACH';
        break;
      }

      case 'HEALTH': {
        response = this.generateHealthResponse(query, intent);
        handler = 'IntentRouter:HEALTH';
        break;
      }

      case 'WORKOUT': {
        response = this.generateWorkoutResponse(query, intent);
        handler = 'IntentRouter:WORKOUT';
        break;
      }

      case 'NAVIGATION': {
        response = this.generateNavigationResponse(query, intent);
        handler = 'IntentRouter:NAVIGATION';
        break;
      }

      case 'SETTINGS': {
        response = this.generateSettingsResponse(query, intent);
        handler = 'IntentRouter:SETTINGS';
        break;
      }

      default: {
        // GENERAL — fallback to COACH for friendly personality
        const context: AIContext = {
          personality: 'COACH' as AIPersonality,
          ...additionalContext,
        };
        response = await this.dualAI.query(query, context);
        handler = 'DualAI:COACH (fallback)';
        break;
      }
    }

    return { intent, response, handler };
  }

  // ============================================
  // DOMAIN-SPECIFIC RESPONSE GENERATORS
  // ============================================

  private generateHealthResponse(query: string, intent: ClassifiedIntent): AIResponse {
    const q = query.toLowerCase();
    let message: string;
    let followUp: string[] = [];

    if (q.includes('calorie') || q.includes('tdee') || q.includes('bmr')) {
      message =
        'I can calculate your daily calorie needs! Head to your Profile to enter your stats, ' +
        "and I'll compute your BMR and TDEE using the Mifflin-St Jeor equation. " +
        'Your calorie target depends on your goal — deficit for fat loss, surplus for muscle gain.';
      followUp = ["What's my TDEE?", 'How many calories to lose weight?', 'Calculate my macros'];
    } else if (q.includes('heart rate') || q.includes('bpm') || q.includes('pulse')) {
      message =
        'Your heart rate data is tracked through the Health Dashboard. ' +
        'I use Karvonen heart rate zones to calculate your optimal training zones. ' +
        'Log your resting heart rate in your profile for personalized zones.';
      followUp = ['What are my HR zones?', 'Is my heart rate normal?', 'Show heart rate trends'];
    } else if (q.includes('sleep')) {
      message =
        'Sleep is crucial for recovery! The Sleep Analysis engine tracks your sleep quality, ' +
        'duration, and consistency. For best results, aim for 7-9 hours and maintain a ' +
        'consistent sleep schedule. Your recovery score factors in sleep quality.';
      followUp = ['How was my sleep?', 'Sleep tips', 'Show sleep trend'];
    } else if (q.includes('weight') || q.includes('body fat') || q.includes('bmi')) {
      message =
        'Track your body composition in your Profile. I use the Navy body fat estimation method ' +
        'for accuracy. Log measurements regularly to see trends over time. ' +
        'Remember — the scale is just one metric; focus on how you feel and perform!';
      followUp = ['Calculate my body fat', 'Weight loss tips', 'Track my weight'];
    } else if (q.includes('nutrition') || q.includes('diet') || q.includes('macro')) {
      message =
        'Nutrition is 80% of the game! Check out Meal Prep for personalized nutrition guidance. ' +
        'I calculate macros based on your TDEE and goals: high protein for muscle building, ' +
        'balanced carbs for energy, and healthy fats for hormones.';
      followUp = ['Calculate my macros', 'Pre-workout meal?', 'Post-workout nutrition'];
    } else {
      message =
        'Your health is a priority! I monitor multiple health metrics including steps, ' +
        'heart rate, sleep quality, and recovery. Check the Health Dashboard for a ' +
        'comprehensive overview of your wellness. What specific metric interests you?';
      followUp = ['Show my health score', 'Am I overtraining?', 'Recovery tips'];
    }

    return {
      message,
      personality: 'COACH',
      confidence: intent.confidence,
      suggestions: followUp,
      processingTimeMs: 0,
    };
  }

  private generateWorkoutResponse(query: string, intent: ClassifiedIntent): AIResponse {
    const q = query.toLowerCase();
    let message: string;
    let followUp: string[] = [];

    if (q.includes('generate') || q.includes('create') || q.includes('new workout')) {
      message =
        'Let me generate a personalized workout for you! The workout engine considers your ' +
        'equipment, fitness level, muscle fatigue, and training history. ' +
        'Head to the FitQuest tab to generate your next session.';
      followUp = ['Start a workout', 'Upper body day', 'Quick 15-min workout'];
    } else if (q.includes('streak') || q.includes('xp') || q.includes('level')) {
      message =
        'Your workout streaks and XP keep you motivated! You earn 100 XP base per workout ' +
        'plus 20 XP per exercise completed, with streak bonuses for consistency. ' +
        'Keep your streak alive by working out regularly!';
      followUp = ["What's my streak?", 'How much XP do I have?', 'How to earn more XP?'];
    } else if (q.includes('history') || q.includes('log') || q.includes('record')) {
      message =
        'Your workout history shows all completed sessions with exercises, sets, and progress. ' +
        'Check the Analytics tab for trends, personal records, and progression charts.';
      followUp = ['Show my history', 'Personal records', 'Progress this month'];
    } else {
      message =
        'Ready to work out? The FitQuest engine creates personalized workouts based on your ' +
        'goals, equipment, and recovery status. What kind of workout are you looking for?';
      followUp = ['Generate a workout', 'Exercise suggestions', 'What should I train today?'];
    }

    return {
      message,
      personality: 'COACH',
      confidence: intent.confidence,
      suggestions: followUp,
      processingTimeMs: 0,
    };
  }

  private generateNavigationResponse(query: string, intent: ClassifiedIntent): AIResponse {
    const screenMap: Record<string, { screen: string; description: string }> = {
      dashboard: { screen: '/dashboard', description: 'your personalized home screen with stats and quick actions' },
      home: { screen: '/dashboard', description: 'your personalized home screen' },
      profile: { screen: '/profile', description: 'your profile settings, body stats, and preferences' },
      exercises: { screen: '/exercises', description: 'the full exercise catalogue with filters' },
      fitquest: { screen: '/fitquest', description: 'your workout generation and session hub' },
      move: { screen: '/move', description: 'jogging, walking, and outdoor activity tracker' },
      'meal prep': { screen: '/meal-prep', description: 'nutrition planning and meal ideas' },
      analytics: { screen: '/analytics', description: 'your progress charts and statistics' },
      'craft my body': { screen: '/craft-my-body', description: 'body customization and goal setting' },
    };

    let message = 'Here are the main sections of FitQuest:\n';
    let targetScreen = '';

    for (const [key, value] of Object.entries(screenMap)) {
      if (query.toLowerCase().includes(key)) {
        message = `Navigate to ${value.screen} — ${value.description}. Tap the appropriate tab or use the navigation menu.`;
        targetScreen = value.screen;
        break;
      }
    }

    if (!targetScreen) {
      message =
        'I can help you navigate! Available screens: Dashboard, FitQuest (workouts), ' +
        'Move (activity tracking), Exercises (catalogue), Profile, Meal Prep, Analytics. ' +
        'Which one would you like to visit?';
    }

    return {
      message,
      personality: 'COACH',
      confidence: intent.confidence,
      suggestions: ['Go to Dashboard', 'Open Exercises', 'Show Profile'],
      processingTimeMs: 0,
    };
  }

  private generateSettingsResponse(query: string, intent: ClassifiedIntent): AIResponse {
    const q = query.toLowerCase();
    let message: string;

    if (q.includes('theme') || q.includes('dark') || q.includes('light')) {
      message =
        'You can switch between dark and light mode in your Profile settings. The app defaults to dark mode for a premium feel.';
    } else if (q.includes('language') || q.includes('translate')) {
      message =
        'FitQuest supports 15 languages! Go to Profile → Language to change. Available: English, Afrikaans, Zulu, Xhosa, Sesotho, Spanish, French, German, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, and Swahili.';
    } else if (q.includes('security') || q.includes('biometric') || q.includes('fingerprint')) {
      message =
        'Your data is protected with biometric authentication and encrypted storage. Go to Profile → Security to manage biometric settings and passcode.';
    } else if (q.includes('subscription') || q.includes('premium') || q.includes('upgrade')) {
      message =
        'Premium features are coming soon! Stay tuned for advanced analytics, custom workout programs, and AI-powered coaching upgrades.';
    } else {
      message =
        'App settings are available in your Profile. You can configure theme, language, security, notifications, and more. What would you like to change?';
    }

    return {
      message,
      personality: 'COACH',
      confidence: intent.confidence,
      suggestions: ['Change theme', 'Change language', 'Security settings'],
      processingTimeMs: 0,
    };
  }

  // ============================================
  // UTILITIES
  // ============================================

  /** Clear conversation context */
  clearContext(): void {
    this.recentIntents = [];
  }

  /** Update router configuration */
  updateConfig(config: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get recent classification history */
  getRecentIntents(): ClassifiedIntent[] {
    return [...this.recentIntents];
  }

  /** Get classification stats */
  getStats(): Record<IntentCategory, number> {
    const stats: Record<IntentCategory, number> = {
      COACH: 0,
      PROFESSOR: 0,
      HEALTH: 0,
      WORKOUT: 0,
      NAVIGATION: 0,
      SETTINGS: 0,
      GENERAL: 0,
    };
    for (const intent of this.recentIntents) {
      stats[intent.category]++;
    }
    return stats;
  }
}

// Singleton
export const intentRouter = IntentRouter.getInstance();
