/**
 * DualAI Engine — Shared Types
 */

export type AIPersonality = 'COACH' | 'PROFESSOR';

/** Extracted memory from past conversations */
export interface ConversationMemory {
  recentTopics: string[];
  userPreferences: string[];
  mentionedExercises: string[];
  mentionedBooks: string[];
  lastInteractionDays: number;
  conversationCount: number;
  averageSessionLength: number;
}

export interface AIContext {
  personality: AIPersonality;
  userProfile?: {
    name: string;
    fitnessLevel: string;
    goals: string[];
    streakDays: number;
    longestStreak?: number;
    level?: number;
    totalXP?: number;
    weight?: number;
    height?: number;
    trainingDaysPerWeek?: number;
    sessionMinutes?: number;
    injuries?: string;
    equipment?: string;
  };
  workoutContext?: {
    currentExercise?: string;
    muscleGroup?: string;
    setsCompleted?: number;
    totalSets?: number;
    fatigueLevel?: number;
    fatigueHighMuscles?: string[];
    lastWorkoutDate?: string;
    daysSinceLastWorkout?: number;
    readinessStatus?: string;
  };
  readingContext?: {
    documentId?: string;
    documentTitle?: string;
    documentAuthor?: string;
    documentContent?: string;
    currentPage?: number;
    totalPages?: number;
    selectedText?: string;
    recentAnnotations?: string[];
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  memory?: ConversationMemory;
  totalWorkouts?: number;
  exerciseCount?: number;
  language?: string;
  languageName?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    isoCountryCode?: string;
  };
}

export interface AIResponse {
  message: string;
  suggestions?: string[];
  relatedTopics?: string[];
  confidence: number;
  processingTimeMs: number;
  personality: AIPersonality;
}

export interface ConversationEntry {
  id: string;
  query: string;
  response: string;
  personality: AIPersonality;
  created_at: number;
}

export interface ProfessorModelOptions {
  provider: 'LOCAL' | 'OPENAI';
  apiKey?: string;
  model?: string;
}
