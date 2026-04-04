/**
 * FitQuest Dual AI Engine
 *
 * Two AI personalities running entirely on-device:
 *
 * 1. **FitCoach** (COACH) — Workout advisor, motivation, form tips
 *    - Context: User profile, workout history, fatigue state, goals
 *    - Tone: Encouraging, direct, action-oriented
 *
 * 2. **Professor** (PROFESSOR) — Reading companion, Socratic dialogue
 *    - Context: Current document, annotations, reading analytics
 *    - Tone: Curious, analytical, thought-provoking
 *
 * Architecture: Template-based response engine with context injection.
 * All conversations encrypted via EncryptedDatabaseService.
 *
 * Future: Plug in on-device LLM (ONNX/TFLite) or optional cloud API.
 */

import { encryptedDB } from '../security/EncryptedDatabase';
import { neuralSummarizer } from '../ai/professor/NeuralSummarizer';
import { semanticSearch } from '../ai/professor/SemanticSearch';
import { knowledgeGraph, Entity } from '../ai/professor/KnowledgeGraph';
import {
  type AIPersonality,
  type ConversationMemory,
  type AIContext,
  type AIResponse,
  type ConversationEntry,
  type ProfessorModelOptions,
  COACH_TEMPLATES,
  PROFESSOR_TEMPLATES,
  COACH_INTENT_DEFS,
} from './ai';

// Re-export types for consumers
export type { AIPersonality, ConversationMemory, AIContext, AIResponse, ConversationEntry, ProfessorModelOptions };

// ============================================
// DUAL AI ENGINE
// ============================================

export class DualAIEngine {
  private static instance: DualAIEngine | null = null;

  // Track recently used templates to avoid repetition
  private recentTemplates: Map<string, string[]> = new Map();
  private static MAX_RECENT_TEMPLATES = 5;

  private constructor() {}

  static getInstance(): DualAIEngine {
    if (!DualAIEngine.instance) {
      DualAIEngine.instance = new DualAIEngine();
    }
    return DualAIEngine.instance;
  }

  /**
   * Pick a random template while avoiding recent repeats.
   * Tracks last N used templates per category.
   */
  private pickRandomAvoidingRepeats<T extends string>(arr: T[], category: string): T {
    const recent = this.recentTemplates.get(category) || [];

    // Filter out recently used templates
    const available = arr.filter((t) => !recent.includes(t));

    // If all templates were recently used, just pick randomly
    const pool = available.length > 0 ? available : arr;
    const picked = pool[Math.floor(Math.random() * pool.length)]!; // non-security

    // Track this selection
    recent.push(picked);
    if (recent.length > DualAIEngine.MAX_RECENT_TEMPLATES) {
      recent.shift(); // Remove oldest
    }
    this.recentTemplates.set(category, recent);

    return picked;
  }

  // ============================================
  // MAIN QUERY INTERFACE
  // ============================================

  /**
   * Send a query to an AI personality and get a contextual response.
   * Automatically loads conversation memory if not provided.
   */
  async query(input: string, context: AIContext, options?: { skipStorage?: boolean }): Promise<AIResponse> {
    const startTime = Date.now();

    // Skip memory loading if already pre-cached by caller
    let enrichedContext = context;
    if (!context.memory) {
      try {
        const memory = await this.loadConversationMemory(context.personality, 10);
        enrichedContext = { ...context, memory };
      } catch (e: any) {
        if (__DEV__) console.warn('[DualAI] Failed to load memory:', e);
      }
    }

    let response: AIResponse;

    if (enrichedContext.personality === 'COACH') {
      response = await this.processCoachQuery(input, enrichedContext);
    } else {
      response = await this.processProfessorQuery(input, enrichedContext);
    }

    response.processingTimeMs = Date.now() - startTime;

    // Fire-and-forget storage — don't block the response
    if (!options?.skipStorage) {
      encryptedDB
        .storeAIConversation(context.personality, input, response.message, {
          processingTimeMs: response.processingTimeMs,
        })
        .catch((e) => {
          if (__DEV__) console.warn('[DualAI] conversation storage failed', e);
        });
    }

    return response;
  }

  /**
   * Query professor using either on-device templates (LOCAL) or OpenAI (OPENAI).
   */
  async queryProfessorWithModel(
    input: string,
    context: Omit<AIContext, 'personality'> & { personality?: 'PROFESSOR' },
    options: ProfessorModelOptions,
  ): Promise<AIResponse> {
    const professorContext: AIContext = {
      ...context,
      personality: 'PROFESSOR',
    };

    if (options.provider === 'OPENAI') {
      try {
        return await this.queryProfessorViaOpenAI(input, professorContext, options);
      } catch (error: any) {
        if (__DEV__) {
          console.warn('[DualAI] OpenAI Professor failed, falling back to local', {
            message: error?.message,
            model: options.model || 'gpt-4.1-mini',
          });
        }
        const fallback = await this.query(input, professorContext);
        return {
          ...fallback,
          message: `Cloud model unavailable. Switched to local Professor for this response.\n\n${fallback.message}`,
        };
      }
    }

    return this.query(input, professorContext);
  }

  /**
   * Get conversation history for a personality.
   */
  async getHistory(personality: AIPersonality, limit = 20): Promise<ConversationEntry[]> {
    const raw = await encryptedDB.getAIConversations(personality, limit);
    return raw.map((entry) => ({ ...entry, personality }));
  }

  /**
   * Load and extract conversation memory for context-aware responses.
   * Analyzes past conversations to extract topics, preferences, and patterns.
   */
  async loadConversationMemory(personality: AIPersonality, limit = 15): Promise<ConversationMemory> {
    const history = await this.getHistory(personality, limit);

    const recentTopics: Set<string> = new Set();
    const userPreferences: Set<string> = new Set();
    const mentionedExercises: Set<string> = new Set();
    const mentionedBooks: Set<string> = new Set();

    // Exercise keywords to detect
    const exerciseKeywords = [
      'push-up',
      'pushup',
      'pull-up',
      'pullup',
      'squat',
      'lunge',
      'plank',
      'burpee',
      'deadlift',
      'bench press',
      'row',
      'curl',
      'press',
      'crunch',
      'sit-up',
      'dip',
      'jump',
      'run',
      'jog',
      'sprint',
      'stretch',
      'yoga',
    ];

    // Preference patterns to detect
    const preferencePatterns = [
      { pattern: /prefer\s+(morning|evening|night|afternoon)/i, extract: 'prefers $1 workouts' },
      { pattern: /struggle\s+with\s+(\w+)/i, extract: 'struggles with $1' },
      { pattern: /love\s+(\w+\s*\w*)/i, extract: 'enjoys $1' },
      { pattern: /hate\s+(\w+\s*\w*)/i, extract: 'dislikes $1' },
      { pattern: /goal\s+(?:is|to)\s+(.+?)(?:\.|$)/i, extract: 'goal: $1' },
      { pattern: /injury\s+(?:in|to|on)\s+(\w+)/i, extract: 'injury: $1' },
    ];

    for (const entry of history) {
      const combined = `${entry.query} ${entry.response}`.toLowerCase();

      // Extract exercises
      for (const exercise of exerciseKeywords) {
        if (combined.includes(exercise)) {
          mentionedExercises.add(exercise);
        }
      }

      // Extract preferences
      for (const { pattern, extract } of preferencePatterns) {
        const match = entry.query.match(pattern);
        if (match) {
          userPreferences.add(extract.replace('$1', match[1]!));
        }
      }

      // Extract topics from queries (simple noun extraction)
      const topics = entry.query.match(/\b(?:about|help with|improve|train|learn|understand)\s+(\w+(?:\s+\w+)?)/gi);
      if (topics) {
        for (const topic of topics) {
          recentTopics.add(topic.replace(/^(about|help with|improve|train|learn|understand)\s+/i, ''));
        }
      }

      // Extract book/document mentions (Professor)
      const bookMatch = entry.query.match(
        /(?:reading|book|chapter|document|article)\s+(?:about|on|called)?\s*"?([^"]+)"?/i,
      );
      if (bookMatch) {
        mentionedBooks.add(bookMatch[1]!.trim());
      }
    }

    // Calculate last interaction days
    const lastInteractionDays =
      history.length > 0 ? Math.floor((Date.now() - history[0]!.created_at) / (1000 * 60 * 60 * 24)) : -1;

    // Estimate average session length by counting distinct session "bursts"
    // (conversations within 30 minutes of each other count as one session)
    let sessionCount = history.length > 0 ? 1 : 0;
    for (let i = 1; i < history.length; i++) {
      const gap = history[i - 1]!.created_at - history[i]!.created_at;
      if (gap > 30 * 60 * 1000) {
        // 30-minute gap = new session
        sessionCount++;
      }
    }

    return {
      recentTopics: Array.from(recentTopics).slice(0, 5),
      userPreferences: Array.from(userPreferences).slice(0, 5),
      mentionedExercises: Array.from(mentionedExercises).slice(0, 10),
      mentionedBooks: Array.from(mentionedBooks).slice(0, 5),
      lastInteractionDays,
      conversationCount: history.length,
      averageSessionLength: sessionCount > 0 ? Math.round(history.length / sessionCount) : 0,
    };
  }

  /**
   * Build a brief context summary from memory for injection into responses.
   */
  buildMemoryContextSummary(memory: ConversationMemory): string {
    const parts: string[] = [];

    if (memory.lastInteractionDays === 0) {
      parts.push('Continuing from earlier today.');
    } else if (memory.lastInteractionDays === 1) {
      parts.push('Welcome back! Last chat was yesterday.');
    } else if (memory.lastInteractionDays > 1 && memory.lastInteractionDays <= 7) {
      parts.push(`Good to see you again! It's been ${memory.lastInteractionDays} days.`);
    } else if (memory.lastInteractionDays > 7) {
      parts.push(`Welcome back! Last time we talked was ${memory.lastInteractionDays} days ago.`);
    }

    if (memory.recentTopics.length > 0) {
      parts.push(`We've discussed: ${memory.recentTopics.slice(0, 3).join(', ')}.`);
    }

    if (memory.userPreferences.length > 0) {
      parts.push(`I remember you ${memory.userPreferences[0]}.`);
    }

    return parts.join(' ');
  }

  /**
   * Get a contextual greeting based on time of day, user state, and conversation memory.
   */
  async getGreeting(context: AIContext): Promise<string> {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    // Load memory for personalized greeting
    let memory = context.memory;
    if (!memory) {
      try {
        memory = await this.loadConversationMemory(context.personality, 10);
      } catch {
        // Continue without memory
      }
    }

    let baseGreeting: string;
    if (context.personality === 'COACH') {
      // Use time-of-day specific greeting with 40% probability
      const useTimeGreeting = Math.random() < 0.4; // non-security
      if (useTimeGreeting) {
        const timeCategory = `coach_greeting_${timeOfDay}`;
        const timeTemplates =
          timeOfDay === 'morning'
            ? COACH_TEMPLATES.greeting_morning
            : timeOfDay === 'afternoon'
              ? COACH_TEMPLATES.greeting_afternoon
              : COACH_TEMPLATES.greeting_evening;
        baseGreeting = this.fillTemplate(this.pickRandomAvoidingRepeats(timeTemplates, timeCategory), context);
      } else {
        baseGreeting = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.greeting, 'coach_greeting'),
          context,
        );
      }

      // Add streak milestone celebration if applicable
      const streakDays = context.userProfile?.streakDays || 0;
      const milestoneKey = [90, 60, 30, 14, 7].find((m) => streakDays >= m)?.toString();
      if (
        milestoneKey &&
        COACH_TEMPLATES.streak_milestones[milestoneKey as keyof typeof COACH_TEMPLATES.streak_milestones]
      ) {
        const milestoneMsg = this.pickRandomAvoidingRepeats(
          COACH_TEMPLATES.streak_milestones[milestoneKey as keyof typeof COACH_TEMPLATES.streak_milestones],
          `coach_streak_${milestoneKey}`,
        );
        baseGreeting = `${milestoneMsg}\n\n${baseGreeting}`;
      }
    } else {
      // Professor: use time-of-day greeting with 40% probability
      const useTimeGreeting = Math.random() < 0.4; // non-security
      if (useTimeGreeting) {
        const timeCategory = `prof_greeting_${timeOfDay}`;
        const timeTemplates =
          timeOfDay === 'morning'
            ? PROFESSOR_TEMPLATES.greeting_morning
            : timeOfDay === 'afternoon'
              ? PROFESSOR_TEMPLATES.greeting_afternoon
              : PROFESSOR_TEMPLATES.greeting_evening;
        baseGreeting = this.fillTemplate(this.pickRandomAvoidingRepeats(timeTemplates, timeCategory), context);
      } else {
        baseGreeting = this.fillTemplate(
          this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.greeting, 'prof_greeting'),
          context,
        );
      }
    }

    // Add memory context if available
    if (memory && memory.conversationCount > 0) {
      const memoryContext = this.buildMemoryContextSummary(memory);
      if (memoryContext) {
        return `${baseGreeting}\n\n${memoryContext}`;
      }
    }

    return baseGreeting;
  }

  /**
   * Generate a post-workout greeting when the user opens the coach after completing a workout.
   * Uses the stored workout summary to create a contextual, celebratory greeting.
   */
  getPostWorkoutGreeting(workoutData: {
    completedCount: number;
    totalCount: number;
    durationSeconds: number;
    streakDays: number;
    xpEarned: number;
    exerciseNames: string[];
    completedAt: number;
  }): string {
    const isPerfect = workoutData.completedCount === workoutData.totalCount;
    const durationMin = Math.round(workoutData.durationSeconds / 60);

    let greeting: string;
    if (isPerfect) {
      greeting = this.pickRandomAvoidingRepeats(COACH_TEMPLATES.post_workout_perfect, 'coach_post_perfect');
    } else {
      greeting = this.pickRandomAvoidingRepeats(COACH_TEMPLATES.post_workout_greeting, 'coach_post_greeting');
    }

    // Fill placeholders
    greeting = greeting
      .replace(/{exerciseCount}/g, String(workoutData.completedCount))
      .replace(/{completedCount}/g, String(workoutData.completedCount))
      .replace(/{totalCount}/g, String(workoutData.totalCount))
      .replace(/{duration}/g, String(durationMin))
      .replace(/{xpEarned}/g, String(workoutData.xpEarned))
      .replace(/{streakDays}/g, String(workoutData.streakDays));

    // Add recovery suggestion
    const recovery = this.pickRandomAvoidingRepeats(COACH_TEMPLATES.post_workout_recovery, 'coach_post_recovery');
    return `${greeting}\n\n${recovery}`;
  }

  // ============================================
  // COACH LOGIC
  // ============================================

  private async processCoachQuery(input: string, context: AIContext): Promise<AIResponse> {
    const lowerInput = input.toLowerCase();
    let message: string;
    let suggestions: string[] = [];
    let confidence = 0.8;
    const memory = context.memory;

    // Scored intent matching — best match wins (not first match)
    let intentScores = this.scoreAllIntents(lowerInput);

    // Follow-up detection: if user says "tell me more" / "what about" / "yes",
    // continue the previous conversation's topic
    if (intentScores.length === 0 && context.conversationHistory?.length) {
      const isFollowUp =
        /^(what about|tell me more|more on|more about|and |so |also |but |how about|yes|yeah|sure|go on|continue|okay |ok )/i.test(
          input.trim(),
        );
      if (isFollowUp) {
        const lastAssistant = [...context.conversationHistory].reverse().find((m) => m.role === 'assistant');
        if (lastAssistant) {
          const prevScores = this.scoreAllIntents(lastAssistant.content.toLowerCase().slice(0, 300));
          if (prevScores.length > 0) {
            intentScores = [{ id: prevScores[0]!.id, score: 2 }];
          }
        }
      }
    }

    const topIntent = intentScores.length > 0 ? intentScores[0] : null;

    switch (topIntent?.id) {
      case 'motivation': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.workout_motivation, 'coach_motivation'),
          context,
        );
        if (memory && memory.conversationCount > 3) {
          message += `\n\nYou've pushed through ${memory.conversationCount} sessions with me. That mental strength matters!`;
        }
        if (memory && memory.mentionedExercises.length > 0) {
          message += ` Remember how you crushed those ${memory.mentionedExercises[0]}s last time?`;
        }
        // Adaptive: temper motivation if fatigue is high or readiness is low
        const fatiguedMuscles = context.workoutContext?.fatigueHighMuscles;
        if (fatiguedMuscles && fatiguedMuscles.length >= 3) {
          message += `\n\n⚡ That said, ${fatiguedMuscles.length} muscle groups are fatigued right now. Channel that energy into a lighter mobility or technique session — smart training is still training!`;
        }
        break;
      }

      case 'form': {
        const muscleGroup = this.detectMuscleGroup(lowerInput);
        const tips =
          COACH_TEMPLATES.form_tips[muscleGroup as keyof typeof COACH_TEMPLATES.form_tips] ||
          COACH_TEMPLATES.form_tips.core;
        message = this.pickRandomAvoidingRepeats(tips, `coach_form_${muscleGroup}`);
        if (memory && memory.recentTopics.some((t) => t.includes('form') || t.includes('technique'))) {
          message = `As we discussed before: ${message}`;
        }
        confidence = 0.7;
        break;
      }

      case 'rest': {
        if (context.workoutContext?.fatigueLevel && context.workoutContext.fatigueLevel > 70) {
          message = this.fillTemplate(
            this.pickRandomAvoidingRepeats(COACH_TEMPLATES.fatigue_warning, 'coach_fatigue'),
            context,
          );
          // Append muscle-specific guidance when available
          const fatiguedMuscles = context.workoutContext.fatigueHighMuscles;
          if (fatiguedMuscles && fatiguedMuscles.length > 0) {
            message += `\n\n🎯 Specifically, your **${fatiguedMuscles.join(', ')}** ${fatiguedMuscles.length === 1 ? 'is' : 'are'} running hot. Avoid loading ${fatiguedMuscles.length === 1 ? 'that area' : 'those areas'} today.`;
          }
        } else {
          message = this.fillTemplate(this.pickRandomAvoidingRepeats(COACH_TEMPLATES.rest_day, 'coach_rest'), context);
        }
        // Append readiness context when available
        if (context.workoutContext?.readinessStatus) {
          message += `\n\n📊 Your current readiness: ${context.workoutContext.readinessStatus}`;
        }
        if (memory && memory.userPreferences.some((p) => p.includes('injury'))) {
          const injuryPref = memory.userPreferences.find((p) => p.includes('injury'));
          message += `\n\n💡 Reminder: You mentioned ${injuryPref}. Take extra care with that area.`;
        }
        break;
      }

      case 'streak': {
        const streakDays = context.userProfile?.streakDays || 0;
        const milestoneKey = [90, 60, 30, 14, 7].find((m) => streakDays >= m)?.toString();
        if (
          milestoneKey &&
          COACH_TEMPLATES.streak_milestones[milestoneKey as keyof typeof COACH_TEMPLATES.streak_milestones]
        ) {
          message = this.fillTemplate(
            this.pickRandomAvoidingRepeats(
              COACH_TEMPLATES.streak_milestones[milestoneKey as keyof typeof COACH_TEMPLATES.streak_milestones],
              'coach_milestone',
            ),
            context,
          );
        } else {
          message = this.fillTemplate(
            this.pickRandomAvoidingRepeats(COACH_TEMPLATES.streak_celebration, 'coach_streak'),
            context,
          );
        }
        break;
      }

      case 'greeting': {
        if (memory && memory.lastInteractionDays >= 14) {
          const comebackTemplate = this.pickRandomAvoidingRepeats(COACH_TEMPLATES.comeback_long, 'coach_comeback');
          message = this.fillTemplate(comebackTemplate, context).replace(/{days}/g, String(memory.lastInteractionDays));
        } else if (memory && memory.lastInteractionDays >= 7) {
          message = this.fillTemplate(
            this.pickRandomAvoidingRepeats(COACH_TEMPLATES.comeback_medium, 'coach_comeback'),
            context,
          );
        } else if (memory && memory.lastInteractionDays >= 3) {
          message = this.fillTemplate(
            this.pickRandomAvoidingRepeats(COACH_TEMPLATES.comeback_short, 'coach_comeback'),
            context,
          );
        } else {
          const hour = new Date().getHours();
          const useTimeGreeting = Math.random() < 0.4; // non-security
          if (useTimeGreeting) {
            const timeTemplates =
              hour < 12
                ? COACH_TEMPLATES.greeting_morning
                : hour < 17
                  ? COACH_TEMPLATES.greeting_afternoon
                  : COACH_TEMPLATES.greeting_evening;
            message = this.fillTemplate(this.pickRandomAvoidingRepeats(timeTemplates, 'coach_greeting_time'), context);
          } else {
            message = this.fillTemplate(
              this.pickRandomAvoidingRepeats(COACH_TEMPLATES.greeting, 'coach_greeting'),
              context,
            );
          }
        }
        break;
      }

      case 'nutrition': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.nutrition, 'coach_nutrition'),
          context,
        );
        break;
      }

      case 'meal_prep': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.meal_prep, 'coach_meal_prep'),
          context,
        );
        break;
      }

      case 'macros': {
        message = this.fillTemplate(this.pickRandomAvoidingRepeats(COACH_TEMPLATES.macros, 'coach_macros'), context);
        break;
      }

      case 'progress': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.progress_tips, 'coach_progress'),
          context,
        );
        if (memory && memory.conversationCount > 5) {
          message += `\n\nAcross our ${memory.conversationCount} conversations, I can see your commitment. That consistency is your biggest advantage!`;
        }
        break;
      }

      case 'stretching': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.stretching, 'coach_stretch'),
          context,
        );
        break;
      }

      case 'sleep': {
        message = this.fillTemplate(this.pickRandomAvoidingRepeats(COACH_TEMPLATES.sleep, 'coach_sleep'), context);
        break;
      }

      case 'frequency': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.frequency, 'coach_frequency'),
          context,
        );
        break;
      }

      case 'exercise_rec': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.exercise_recommendations, 'coach_exercise_rec'),
          context,
        );
        break;
      }

      case 'body_transform': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.body_transformation, 'coach_body'),
          context,
        );
        break;
      }

      case 'warmup': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.warmup_cooldown, 'coach_warmup'),
          context,
        );
        break;
      }

      case 'injury': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.injury_prevention, 'coach_injury'),
          context,
        );
        if (memory && memory.userPreferences.some((p) => p.includes('injury'))) {
          const injuryPref = memory.userPreferences.find((p) => p.includes('injury'));
          message += `\n\n💡 Reminder: You mentioned ${injuryPref}. Take extra care with that area.`;
        }
        break;
      }

      case 'supplements': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.supplements, 'coach_supplements'),
          context,
        );
        break;
      }

      case 'mental': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.mental_health, 'coach_mental'),
          context,
        );
        break;
      }

      case 'hydration': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.hydration, 'coach_hydration'),
          context,
        );
        break;
      }

      case 'weight': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.weight_management, 'coach_weight'),
          context,
        );
        break;
      }

      // Phase 4: New intent handlers
      case 'skill_progressions': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.skill_progressions, 'coach_skills'),
          context,
        );
        break;
      }

      case 'outdoor': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.outdoor_training, 'coach_outdoor'),
          context,
        );
        break;
      }

      case 'plateau': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.plateau_busting, 'coach_plateau'),
          context,
        );
        if (memory && memory.conversationCount > 5) {
          message += `\n\nYou've been training consistently — ${memory.conversationCount} conversations prove it. Plateaus are temporary. Your discipline isn't.`;
        }
        break;
      }

      case 'pr': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.personal_records, 'coach_pr'),
          context,
        );
        break;
      }

      case 'partner': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.training_partner, 'coach_partner'),
          context,
        );
        break;
      }

      case 'seasonal': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.seasonal, 'coach_seasonal'),
          context,
        );
        break;
      }

      case 'energy': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.energy_tips, 'coach_energy'),
          context,
        );
        break;
      }

      case 'breathing': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.breathing, 'coach_breathing'),
          context,
        );
        break;
      }

      case 'time_mgmt': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.time_management, 'coach_time'),
          context,
        );
        break;
      }

      case 'mindfulness': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.mindfulness_training, 'coach_mindfulness'),
          context,
        );
        break;
      }

      case 'recovery_protocol': {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.recovery_protocols, 'coach_recovery_protocol'),
          context,
        );
        break;
      }

      case 'thanks': {
        message = this.pickRandomAvoidingRepeats((COACH_TEMPLATES as any).thanks, 'coach_thanks');
        break;
      }

      default: {
        message = await this.generateCoachResponse(input, context);
        confidence = 0.5;
        break;
      }
    }

    // Intent blending: when secondary intent is close to primary, add a bridge
    if (intentScores.length > 1 && topIntent && topIntent.id !== 'thanks' && topIntent.id !== 'greeting') {
      const secondary = intentScores[1]!;
      if (secondary.score >= topIntent.score * 0.6 && secondary.id !== topIntent.id) {
        const blend = this.getIntentBlend(secondary.id, context);
        if (blend) message += `\n\n${blend}`;
      }
    }

    // Use smart suggestions instead of hardcoded ones
    suggestions = this.getSmartSuggestions(context, input);

    return {
      message,
      suggestions,
      confidence,
      processingTimeMs: 0,
      personality: 'COACH',
    };
  }

  // ============================================
  // PROFESSOR LOGIC
  // ============================================

  private async processProfessorQuery(input: string, context: AIContext): Promise<AIResponse> {
    const lowerInput = input.toLowerCase();
    let message: string;
    let suggestions: string[] = [];
    let relatedTopics: string[] = [];
    let confidence = 0.7;

    try {
      if (this.matchesIntent(lowerInput, ['explain', 'what does', 'meaning', 'define', 'understand'])) {
        const reading = context.readingContext;
        // Use SemanticSearch to find relevant passages
        if (reading?.selectedText) {
          // Search for context around the selected text
          const searchResults = await semanticSearch.search(reading.selectedText, {
            topK: 3,
            minScore: 0.3,
            documentFilter: reading.documentId ? [reading.documentId] : undefined,
          });

          if (searchResults.length > 0) {
            const relevantPassage = searchResults[0]!;
            message =
              `Let me break down "${reading.selectedText.slice(0, 80)}...":\n\n` +
              `📌 **Related context from the document:**\n"${relevantPassage.text.slice(0, 200)}..."\n\n` +
              this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
            confidence = Math.min(0.9, relevantPassage.score + 0.3);
          } else {
            message =
              `Let me break down "${reading.selectedText.slice(0, 100)}...":\n\n` +
              `This passage explores a key concept. ` +
              this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
          }
        } else if (reading?.documentContent) {
          // Search for user's query in document
          const searchResults = await semanticSearch.search(input, {
            topK: 2,
            minScore: 0.25,
            documentFilter: reading.documentId ? [reading.documentId] : undefined,
          });

          if (searchResults.length > 0) {
            message = `📖 **Found relevant passages:**\n\n`;
            for (const result of searchResults) {
              message += `> "${result.text.slice(0, 150)}..."\n\n`;
            }
            message += this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
            confidence = 0.8;
          } else {
            message = this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.comprehension_check, 'prof_comprehension');
          }
        } else {
          message = this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.comprehension_check, 'prof_comprehension');
        }
      } else if (this.matchesIntent(lowerInput, ['quiz', 'test', 'check', 'understand'])) {
        message = this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.comprehension_check, 'prof_comprehension');
        confidence = 0.8;
      } else if (this.matchesIntent(lowerInput, ['why', 'how come', 'reason'])) {
        // Semantic search to find reasoning/explanatory passages
        const reading = context.readingContext;
        if (reading?.documentContent || reading?.documentId) {
          const reasonQuery = input.replace(/^(why|how come|what's the reason)/i, '').trim() || input;
          const searchResults = await semanticSearch.search(reasonQuery + ' because reason explains', {
            topK: 2,
            minScore: 0.2,
            documentFilter: reading.documentId ? [reading.documentId] : undefined,
          });

          if (searchResults.length > 0) {
            message = `🤔 **Looking for reasoning in the text...**\n\n`;
            message += `> "${searchResults[0]!.text.slice(0, 200)}..."\n\n`;
            message += this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
            confidence = 0.75;
          } else {
            // Use devil's advocate or Feynman technique for deeper thinking
            const useTechnique = Math.random() < 0.3; // non-security
            if (useTechnique) {
              message = this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.devils_advocate, 'prof_devils');
            } else {
              message = this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
            }
          }
        } else {
          message = this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
        }
      } else if (this.matchesIntent(lowerInput, ['highlight', 'note', 'important', 'key'])) {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.annotation_insight, 'prof_annotation'),
          context,
        );
        // Offer flashcard creation
        if (Math.random() < 0.4) {
          // non-security
          message += `\n\n${this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.flashcard_encouragement, 'prof_flashcard')}`;
        }
      } else if (this.matchesIntent(lowerInput, ['hello', 'hi', 'start', 'reading'])) {
        // Time-of-day aware greeting
        const hour = new Date().getHours();
        const useTimeGreeting = Math.random() < 0.4; // non-security
        if (useTimeGreeting) {
          const timeTemplates =
            hour < 12
              ? PROFESSOR_TEMPLATES.greeting_morning
              : hour < 17
                ? PROFESSOR_TEMPLATES.greeting_afternoon
                : PROFESSOR_TEMPLATES.greeting_evening;
          message = this.fillTemplate(this.pickRandomAvoidingRepeats(timeTemplates, 'prof_greeting_time'), context);
        } else {
          message = this.fillTemplate(
            this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.greeting, 'prof_greeting'),
            context,
          );
        }
      } else if (this.matchesIntent(lowerInput, ['summary', 'summarize', 'recap', 'overview'])) {
        // Neural-powered summarization
        const reading = context.readingContext;
        if (!reading?.documentTitle) {
          message = 'No document is currently open. Open a book from your library to start.';
        } else if (reading.documentContent && reading.documentContent.length > 50) {
          // Use NeuralSummarizer for extractive summary
          const summaryResult = await neuralSummarizer.summarize(reading.documentContent, {
            maxSentences: 5,
            compressionRatio: 0.25,
            preserveOrder: true,
          });
          const pageInfo = `You're on page ${reading.currentPage || 0} of ${reading.totalPages || '?'}.`;
          message =
            `📖 **Summary of "${reading.documentTitle}"**\n\n${summaryResult.summary}\n\n${pageInfo}\n\n` +
            `_(${summaryResult.modelType === 'neural' ? 'AI-powered' : 'Extractive'} summary, ${Math.round(summaryResult.compressionRatio * 100)}% compression)_`;
          confidence = summaryResult.modelType === 'neural' ? 0.85 : 0.7;
        } else {
          // Fallback when no content available
          message =
            `Here's what we've covered in "${reading.documentTitle}" so far:\n\n` +
            `You're on page ${reading.currentPage || 0} of ${reading.totalPages || '?'}. ` +
            `Let me help you consolidate your understanding.\n\n` +
            this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.comprehension_check, 'prof_comprehension');
        }
      } else {
        // Generic professor response
        message = await this.generateProfessorResponse(input, context);
        confidence = 0.5;
      }
    } catch (intentError) {
      // Guard against neural model crashes (encoding failures, HNSW errors, etc.)
      if (__DEV__) console.warn('[DualAI] Professor intent processing failed, using fallback:', intentError);
      message = this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.comprehension_check, 'prof_comprehension');
      confidence = 0.4;
    }

    // Knowledge Graph: Extract related topics from user query
    try {
      const queryResult = knowledgeGraph.queryRelated(input, 1, 5);
      if (queryResult.entities.length > 0) {
        relatedTopics = queryResult.entities.slice(0, 4).map((e) => e.name);
      }
    } catch {
      // KnowledgeGraph not indexed yet - continue without related topics
    }

    // Memory-aware enhancements for Professor
    const memory = context.memory;
    if (memory) {
      // Reference previously discussed books
      if (memory.mentionedBooks.length > 0 && context.readingContext?.documentTitle) {
        const currentBook = context.readingContext.documentTitle.toLowerCase();
        const previousBooks = memory.mentionedBooks.filter((b) => !currentBook.includes(b.toLowerCase()));
        if (previousBooks.length > 0 && Math.random() < 0.3) {
          // non-security
          message += `\n\n💡 This reminds me of themes from "${previousBooks[0]}" that you read earlier.`;
        }
      }
    }

    // Use smart suggestions instead of hardcoded ones
    suggestions = this.getSmartSuggestions(context, input);

    return {
      message,
      suggestions,
      relatedTopics,
      confidence,
      processingTimeMs: 0,
      personality: 'PROFESSOR',
    };
  }

  private async queryProfessorViaOpenAI(
    input: string,
    context: AIContext,
    options: ProfessorModelOptions,
  ): Promise<AIResponse> {
    const apiKey = (options.apiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('OpenAI API key is required for Professor cloud mode.');
    }

    const model = (options.model || 'gpt-4.1-mini').trim();
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // abort-timeout

    const reading = context.readingContext;
    const systemPrompt = [
      'You are FitQuest Professor, a concise reading tutor.',
      'Prioritize document analysis, comprehension, and critical thinking.',
      'Keep responses practical, clear, and no more than 180 words unless asked.',
      `Document: ${reading?.documentTitle || 'Unknown'}`,
      `Author: ${reading?.documentAuthor || 'Unknown'}`,
      `Page: ${reading?.currentPage || 0} / ${reading?.totalPages || '?'}`,
      reading?.selectedText ? `Selected text: ${reading.selectedText.slice(0, 600)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input },
          ],
          temperature: 0.4,
          max_tokens: 500,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
      console.warn('[DualAI] OpenAI Professor cloud request failed:', message);
      throw new Error(message);
    }

    const outputText =
      payload?.choices?.[0]?.message?.content?.trim() ||
      'I analyzed this section. Ask me for a focused summary, key claims, or a quiz.';

    const processingTimeMs = Date.now() - startTime;

    await encryptedDB.storeAIConversation('PROFESSOR', input, outputText, {
      modelVersion: `openai:${model}`,
      tokensUsed: payload?.usage?.total_tokens ?? 0,
      processingTimeMs,
    });

    return {
      message: outputText,
      suggestions: ['Summarize this page', 'Quiz me on key ideas', 'Show counterarguments'],
      confidence: 0.85,
      processingTimeMs,
      personality: 'PROFESSOR',
    };
  }

  // ============================================
  // RESPONSE GENERATION (template fallback)
  // ============================================

  private async generateCoachResponse(input: string, context: AIContext): Promise<string> {
    const parts: string[] = [];
    const memory = context.memory;
    const lowerInput = input.toLowerCase();

    // ---- Step 1: Extract keywords and find the closest relevant topic ----
    const topicMap: Record<string, { bucket: string[]; category: string }> = {
      'workout|train|exercise|lift|gym|session': {
        bucket: (COACH_TEMPLATES as any).workout_motivation,
        category: 'coach_motivation',
      },
      'eat|food|meal|diet|hungry': { bucket: (COACH_TEMPLATES as any).nutrition, category: 'coach_nutrition' },
      'sore|pain|ache|recovery|rest': { bucket: (COACH_TEMPLATES as any).rest_day, category: 'coach_rest' },
      'tired|exhausted|fatigued|worn out': {
        bucket: (COACH_TEMPLATES as any).fatigue_warning,
        category: 'coach_fatigue',
      },
      'muscle|strong|strength|gains': {
        bucket: (COACH_TEMPLATES as any).progressive_overload,
        category: 'coach_overload',
      },
      'lose|fat|lean|cut|slim|tone': { bucket: (COACH_TEMPLATES as any).weight_management, category: 'coach_weight' },
      'run|cardio|jog|sprint|endurance': {
        bucket: (COACH_TEMPLATES as any).sport_specific.runner,
        category: 'coach_sport',
      },
      'plan|schedule|routine|program': { bucket: (COACH_TEMPLATES as any).frequency, category: 'coach_frequency' },
    };

    let matchedTemplate: string | null = null;
    for (const [pattern, config] of Object.entries(topicMap)) {
      const keywords = pattern.split('|');
      if (keywords.some((kw) => lowerInput.includes(kw))) {
        matchedTemplate = this.pickRandomAvoidingRepeats(config.bucket, config.category);
        break;
      }
    }

    if (matchedTemplate) {
      // Found a soft topic match — use it with context enrichment
      parts.push(this.fillTemplate(matchedTemplate, context));
    } else {
      // ---- Step 2: No topic match — build a contextual response ----
      const openers = [
        'I hear you, {name}!',
        'Great question, {name}!',
        'Let me help with that.',
        "That's worth exploring — here's my take.",
        "Good thinking! Here's what I'd suggest.",
        'Interesting topic! Let me share my thoughts.',
        'I appreciate you asking, {name}!',
      ];
      parts.push(this.fillTemplate(openers[Math.floor(Math.random() * openers.length)]!, context)); // non-security

      // Add contextual insight based on user state
      if (context.workoutContext?.currentExercise) {
        const exercise = context.workoutContext.currentExercise;
        const muscleGroup = this.detectMuscleGroup(exercise.toLowerCase());
        const formTips =
          COACH_TEMPLATES.form_tips[muscleGroup as keyof typeof COACH_TEMPLATES.form_tips] ||
          COACH_TEMPLATES.form_tips.core;
        parts.push(this.fillTemplate(this.pickRandomAvoidingRepeats(formTips, `coach_form_${muscleGroup}`), context));
      } else if (context.workoutContext?.fatigueLevel && context.workoutContext.fatigueLevel > 50) {
        parts.push(
          this.fillTemplate(
            this.pickRandomAvoidingRepeats(COACH_TEMPLATES.fatigue_warning, 'coach_fatigue_fallback'),
            context,
          ),
        );
      } else if (context.userProfile?.streakDays && context.userProfile.streakDays > 0) {
        parts.push(
          `Your ${context.userProfile.streakDays}-day streak shows real commitment. That consistency is what separates results from wishes.`,
        );
      }
    }

    // ---- Step 3: Memory-based personalization ----
    if (memory) {
      if (memory.recentTopics.length > 0 && !matchedTemplate) {
        const topics = memory.recentTopics.slice(0, 2).join(' and ');
        parts.push(
          `We've been covering ${topics} — want me to go deeper on any of those, or is there something new on your mind?`,
        );
      }
      if (memory.mentionedExercises.length > 0 && Math.random() > 0.7) {
        // non-security
        parts.push(
          `By the way, since you've been working on ${memory.mentionedExercises[0]} — keep at it, consistency is key!`,
        );
      }
    }

    // ---- Step 4: Offer guidance if response is too short ----
    if (parts.length <= 1 && !matchedTemplate) {
      const guides = [
        "I can help with **workouts**, **nutrition**, **recovery**, **form tips**, or **motivation**. What's on your mind?",
        "Here's what I'm great at: exercise advice, eating for your goals, recovery strategies, or mental game coaching. Pick your topic!",
        "Whether it's training, nutrition, sleep, or mindset — I've got you covered. What would help you most right now?",
        'Not sure what to ask? Try: "How should I eat today?", "Am I overtraining?", or "Help me break my plateau."',
        'I can talk exercises, macros, stretching, supplements, sleep, motivation — you name it. What interests you?',
      ];
      parts.push(guides[Math.floor(Math.random() * guides.length)]!); // non-security
    }

    return parts.join('\n\n');
  }

  private async generateProfessorResponse(input: string, context: AIContext): Promise<string> {
    const parts: string[] = [];

    if (context.readingContext?.documentTitle) {
      parts.push(`Great question about "${context.readingContext.documentTitle}".`);
    }

    parts.push(
      "That's a thoughtful inquiry. Let me offer a perspective:",
      this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic'),
    );

    return parts.join('\n\n');
  }

  // ============================================
  // QUICK ACTIONS (no query needed)
  // ============================================

  /**
   * Get a quick form tip for the current exercise.
   */
  getFormTip(muscleGroup: string): string {
    const group = muscleGroup.toLowerCase();
    const tips = COACH_TEMPLATES.form_tips[group as keyof typeof COACH_TEMPLATES.form_tips];
    return tips
      ? this.pickRandomAvoidingRepeats(tips, `coach_form_${group}`)
      : this.pickRandomAvoidingRepeats(COACH_TEMPLATES.form_tips.core, 'coach_form_core');
  }

  /**
   * Get a Socratic question for the current reading.
   */
  getSocraticQuestion(): string {
    return this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
  }

  /**
   * Get a comprehension check question.
   */
  getComprehensionCheck(): string {
    return this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.comprehension_check, 'prof_comprehension');
  }

  // ============================================
  // SMART SUGGESTIONS (Phase 5)
  // ============================================

  /**
   * Generate intelligent, context-aware quick reply suggestions.
   * Replaces static suggestions with dynamic ones based on user state.
   */
  getSmartSuggestions(context: AIContext, _recentQuery?: string): string[] {
    const suggestions: Array<{ text: string; priority: number; category: string }> = [];
    const now = new Date();
    const currentHour = now.getHours();

    if (context.personality === 'COACH') {
      // ========== WORKOUT STATE ==========
      const workout = context.workoutContext;

      if (workout?.fatigueLevel !== undefined && workout.fatigueLevel > 70) {
        suggestions.push({ text: 'Show recovery exercises', priority: 95, category: 'fatigue' });
        suggestions.push({ text: 'Take a longer rest', priority: 85, category: 'fatigue' });
        if (workout.fatigueHighMuscles && workout.fatigueHighMuscles.length > 0) {
          suggestions.push({ text: `Rest ${workout.fatigueHighMuscles[0]} today`, priority: 90, category: 'fatigue' });
        }
      }

      if (workout?.fatigueLevel !== undefined && workout.fatigueLevel > 50 && workout.fatigueLevel <= 70) {
        suggestions.push({ text: 'Lower intensity option', priority: 75, category: 'fatigue' });
      }

      if (workout?.currentExercise) {
        suggestions.push({ text: `Form tips for ${workout.currentExercise}`, priority: 80, category: 'form' });
        suggestions.push({ text: 'Alternative exercise', priority: 60, category: 'form' });
      }

      if (workout?.setsCompleted !== undefined && workout?.totalSets !== undefined && workout.totalSets > 0) {
        const progress = workout.setsCompleted / workout.totalSets;
        if (progress >= 0.8 && progress < 1) {
          suggestions.push({ text: 'Final push! 💪', priority: 90, category: 'motivation' });
        }
        if (progress === 1) {
          suggestions.push({ text: 'Finish workout', priority: 100, category: 'complete' });
          suggestions.push({ text: 'Add bonus set?', priority: 70, category: 'complete' });
        }
      }

      // ========== STREAK AWARENESS ==========
      const streakDays = context.userProfile?.streakDays || 0;

      if (streakDays === 6) {
        suggestions.push({ text: 'Week streak tomorrow! 🔥', priority: 92, category: 'streak' });
      } else if (streakDays === 13) {
        suggestions.push({ text: '2-week streak tomorrow!', priority: 92, category: 'streak' });
      } else if (streakDays === 29) {
        suggestions.push({ text: 'Month streak tomorrow! 🏆', priority: 95, category: 'streak' });
      }

      if (streakDays >= 7 && streakDays % 7 === 0) {
        suggestions.push({ text: 'Share my streak', priority: 65, category: 'social' });
      }

      // ========== TIME-BASED ==========
      if (currentHour >= 5 && currentHour < 9) {
        suggestions.push({ text: 'Morning workout plan', priority: 70, category: 'time' });
      } else if (currentHour >= 17 && currentHour < 21) {
        suggestions.push({ text: 'Evening wind-down session', priority: 65, category: 'time' });
      }

      // ========== RECOVERY/REST ==========
      const lastWorkoutDate = workout?.lastWorkoutDate;
      if (lastWorkoutDate) {
        const daysSinceLast = Math.floor((now.getTime() - new Date(lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLast === 0) {
          suggestions.push({ text: 'Recovery tips for tomorrow', priority: 60, category: 'recovery' });
        } else if (daysSinceLast >= 3) {
          suggestions.push({ text: 'Ease back in today', priority: 85, category: 'comeback' });
        }
      }

      // ========== PROGRESS TRACKING ==========
      if (!workout?.currentExercise) {
        // Not in active workout
        suggestions.push({ text: "Start today's workout", priority: 80, category: 'action' });
        suggestions.push({ text: 'Check my progress', priority: 50, category: 'stats' });
        suggestions.push({ text: "Today's plan", priority: 55, category: 'plan' });
      }

      // ========== MEMORY-BASED ==========
      const memory = context.memory;
      if (memory && memory.mentionedExercises.length > 0) {
        const favoriteExercise = memory.mentionedExercises[0];
        suggestions.push({ text: `${favoriteExercise} tips`, priority: 45, category: 'memory' });
      }

      // ========== PHASE 4: EXPANDED SUGGESTIONS ==========
      // Skill progression nudge for intermediate+ users
      const experience = context.userProfile?.fitnessLevel;
      if (experience === 'intermediate' || experience === 'advanced') {
        suggestions.push({ text: 'Skill progression roadmap', priority: 40, category: 'skills' });
      }

      // Breathing / mindfulness for active workouts
      if (workout?.currentExercise) {
        suggestions.push({ text: 'Breathing technique', priority: 35, category: 'breathing' });
      }

      // Seasonal awareness
      const month = now.getMonth();
      if (month >= 5 && month <= 7) {
        // June-August
        suggestions.push({ text: 'Summer training tips', priority: 30, category: 'seasonal' });
      } else if (month >= 11 || month <= 1) {
        // Dec-Feb
        suggestions.push({ text: 'Winter training tips', priority: 30, category: 'seasonal' });
      }

      // Time-pressed suggestions for busy hours
      if (currentHour >= 12 && currentHour <= 13) {
        suggestions.push({ text: 'Quick lunch workout', priority: 55, category: 'time_mgmt' });
      }

      // Recovery protocol when fatigued but not critically
      if (workout?.fatigueLevel !== undefined && workout.fatigueLevel > 40 && workout.fatigueLevel <= 70) {
        suggestions.push({ text: 'Recovery protocol', priority: 50, category: 'recovery_protocol' });
      }

      // Outdoor training during nice hours
      if (currentHour >= 6 && currentHour <= 10) {
        suggestions.push({ text: 'Take it outside! 🌳', priority: 25, category: 'outdoor' });
      }
    } else {
      // ========== PROFESSOR PERSONALITY ==========
      const reading = context.readingContext;

      if (reading?.currentPage !== undefined && reading?.totalPages !== undefined) {
        const readingProgress = reading.currentPage / reading.totalPages;

        if (readingProgress >= 0.8) {
          suggestions.push({ text: 'Almost done! Summarize', priority: 95, category: 'complete' });
          suggestions.push({ text: 'Create final flashcards', priority: 85, category: 'retention' });
        } else if (readingProgress >= 0.5) {
          suggestions.push({ text: 'Midway check-in', priority: 70, category: 'progress' });
          suggestions.push({ text: 'Key insights so far', priority: 75, category: 'synthesis' });
        } else if (readingProgress < 0.2) {
          suggestions.push({ text: "What's this book about?", priority: 60, category: 'overview' });
        }
      }

      if (reading?.selectedText) {
        suggestions.push({ text: 'Explain this passage', priority: 90, category: 'selection' });
        suggestions.push({ text: 'Create flashcard', priority: 85, category: 'retention' });
        suggestions.push({ text: 'Why is this important?', priority: 80, category: 'analysis' });
      }

      if (reading?.recentAnnotations && reading.recentAnnotations.length > 2) {
        suggestions.push({ text: 'Connect my highlights', priority: 75, category: 'synthesis' });
      }

      // ========== READING TIME ==========
      if (currentHour >= 21 || currentHour < 6) {
        suggestions.push({ text: 'Quick review before bed', priority: 65, category: 'time' });
      } else if (currentHour >= 6 && currentHour < 9) {
        suggestions.push({ text: 'Morning reading plan', priority: 60, category: 'time' });
      }

      // ========== MEMORY-BASED ==========
      const memory = context.memory;
      if (memory && memory.mentionedBooks.length > 1 && reading?.documentTitle) {
        const otherBooks = memory.mentionedBooks.filter(
          (b) => !reading.documentTitle?.toLowerCase().includes(b.toLowerCase()),
        );
        if (otherBooks.length > 0) {
          suggestions.push({ text: `Compare to "${otherBooks[0]}"`, priority: 55, category: 'connection' });
        }
      }

      // ========== LEARNING MODES ==========
      if (!reading?.documentTitle) {
        // Not actively reading
        suggestions.push({ text: 'Review flashcards', priority: 75, category: 'retention' });
        suggestions.push({ text: 'Continue reading', priority: 80, category: 'action' });
        suggestions.push({ text: 'Reading stats', priority: 45, category: 'stats' });
      } else {
        suggestions.push({ text: 'Quiz me on this', priority: 70, category: 'retention' });
        suggestions.push({ text: 'Socratic question', priority: 65, category: 'deep' });
      }

      // ========== FLASHCARD STATE ==========
      // Could be enhanced with actual due flashcard count from FSRSService
      suggestions.push({ text: 'Due flashcards', priority: 50, category: 'retention' });

      // ========== PHASE 4: EXPANDED PROFESSOR SUGGESTIONS ==========
      if (reading?.documentTitle) {
        suggestions.push({ text: 'Note-taking strategy', priority: 40, category: 'note_taking' });
        suggestions.push({ text: 'Critical analysis', priority: 35, category: 'critical' });
      }

      if (reading?.currentPage !== undefined && reading?.totalPages !== undefined) {
        const progress = reading.currentPage / reading.totalPages;
        if (progress > 0.3) {
          suggestions.push({ text: 'Speed reading tips', priority: 30, category: 'speed' });
        }
      }

      // Study scheduling during morning hours
      if (currentHour >= 6 && currentHour < 10) {
        suggestions.push({ text: 'Plan study session', priority: 45, category: 'scheduling' });
      }
    }

    // ========== DEDUPLICATE AND SORT ==========
    // Remove duplicates by text
    const seen = new Set<string>();
    const uniqueSuggestions = suggestions.filter((s) => {
      if (seen.has(s.text)) return false;
      seen.add(s.text);
      return true;
    });

    // Sort by priority (highest first) and take top 3
    uniqueSuggestions.sort((a, b) => b.priority - a.priority);

    // Ensure category diversity - don't show 3 from same category
    const final: string[] = [];
    const usedCategories = new Set<string>();

    for (const suggestion of uniqueSuggestions) {
      if (final.length >= 3) break;

      // Allow max 2 from same category
      const categoryCount = [...usedCategories].filter((c) => c === suggestion.category).length;
      if (categoryCount >= 2) continue;

      final.push(suggestion.text);
      usedCategories.add(suggestion.category);
    }

    // Fallback if not enough suggestions
    if (final.length < 3) {
      const fallbacks =
        context.personality === 'COACH'
          ? ['Start workout', "Today's plan", 'How am I progressing?']
          : ['Continue reading', 'Review flashcards', 'Ask a question'];

      for (const fb of fallbacks) {
        if (final.length >= 3) break;
        if (!final.includes(fb)) final.push(fb);
      }
    }

    return final;
  }

  // ============================================
  // HELPERS
  // ============================================

  private matchesIntent(input: string, keywords: string[]): boolean {
    return keywords.some((kw) => input.includes(kw));
  }

  /**
   * Score how well input matches a set of keywords.
   * Multi-word phrases score 3, exact word matches score 2, substrings score 1.
   */
  private scoreIntent(input: string, keywords: string[]): number {
    let score = 0;
    const words = input.split(/\s+/);
    for (const kw of keywords) {
      if (kw.includes(' ')) {
        if (input.includes(kw)) score += 3;
      } else {
        if (words.includes(kw)) score += 2;
        else if (input.includes(kw)) score += 1;
      }
    }
    return score;
  }

  /**
   * Score ALL coach intents and return sorted by confidence (highest first).
   * This replaces first-match-wins with best-match-wins.
   */
  private scoreAllIntents(input: string): Array<{ id: string; score: number }> {
    return COACH_INTENT_DEFS.map((def) => ({
      id: def.id,
      score: this.scoreIntent(input, def.keywords) * (def.weight || 1),
    }))
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get a brief connecting sentence for a secondary intent to blend into the response.
   * When two intents are close in score, this adds natural topic bridging.
   */
  private getIntentBlend(intentId: string, _context: AIContext): string | null {
    const blends: Record<string, string[]> = {
      motivation: [
        "Also — you've got this. Every session proves you're stronger than you think.",
        'By the way, your consistency is paying off. Keep that momentum going!',
      ],
      rest: [
        'And remember, recovery is where growth actually happens.',
        "Side note — if you're feeling drained, a lighter session can work wonders.",
      ],
      nutrition: [
        "On the nutrition side, make sure you're fueling properly today.",
        "Don't forget — your body needs the right fuel to match your effort.",
      ],
      stretching: [
        'Also consider some stretching — it pairs well with what we just covered.',
        'A few minutes of mobility work would complement this perfectly.',
      ],
      sleep: [
        'Good sleep tonight will amplify everything we talked about.',
        'And prioritize rest — recovery happens while you sleep.',
      ],
      mental: [
        'Remember, the mental game is just as important as the physical one.',
        'Your mindset is your strongest muscle — keep training it too.',
      ],
      hydration: [
        "Also, keep sipping water — it's one of the easiest performance boosters.",
        'Stay hydrated! It matters more than most people realize.',
      ],
      injury: [
        'And always listen to your body — prevention beats rehabilitation every time.',
        'If anything feels off, modify or skip. Protecting your body is always the smart call.',
      ],
      macros: [
        'By the way, tracking your macros can really accelerate your results.',
        'Getting your protein and calories right is a force multiplier for training.',
      ],
      meal_prep: [
        'And meal prepping takes the guesswork out of nutrition — game changer!',
        'Having meals ready to go removes the biggest barrier to eating well.',
      ],
      frequency: [
        'Also, make sure your training frequency matches your recovery capacity.',
        "Finding the right workout frequency is key — more isn't always better.",
      ],
      exercise_rec: [
        'Check the Exercise Library for movements that match your goals.',
        'The right exercise selection makes all the difference. Quality over quantity!',
      ],
      body_transform: [
        'For a full body plan, try Craft My Body in your Profile tab.',
        "Body transformation combines training, nutrition, and patience. You've got this!",
      ],
      warmup: [
        "Don't skip the warm-up — 5 minutes can prevent a 5-week setback.",
        'A good warm-up primes your nervous system and boosts your performance.',
      ],
      supplements: [
        "If you're considering supplements, creatine and vitamin D have the strongest evidence.",
        'Remember, supplements are the last 5%. Get the basics dialled in first.',
      ],
      weight: [
        'Weight management is a marathon, not a sprint. Small consistent steps win.',
        'Focus on the trend, not daily fluctuations. Your body is doing more than the scale shows.',
      ],
      progress: [
        'Track your progress — what gets measured gets improved.',
        "Remember, progress isn't always linear. Trust the process!",
      ],
      streak: [
        'Your consistency is building something amazing. The streak tells the story!',
        'Every day you show up adds to the compound effect. Keep it rolling!',
      ],
      form: [
        'And remember, perfect form beats heavy weight every time.',
        "Good technique is the foundation of everything. It's worth getting right.",
      ],
      // Phase 4 blends
      skill_progressions: [
        'Remember, mastering progressions is a journey. Each step builds on the last.',
        'Focus on nailing your current level — the next progression will come naturally.',
      ],
      outdoor: [
        'Fresh air and natural light make workouts feel easier. Try training outside!',
        "The outdoors is nature's gym — free, open, and always available.",
      ],
      plateau: [
        'Plateaus are temporary — they mean your body adapted. Time to evolve!',
        'Stuck? Change ONE variable: tempo, volume, exercise selection, or rest periods.',
      ],
      pr: [
        "Every PR starts with showing up. You're building the foundation right now.",
        'Trust your training — PRs are the result of consistent daily effort.',
      ],
      energy: [
        'Energy follows action. Start moving and your body will wake up!',
        'Hydration, sleep, and nutrition are your natural energy boosters.',
      ],
      breathing: [
        "Don't forget to breathe! Proper breathing is the most underrated performance tool.",
        'Controlled breathing keeps your heart rate down and your focus up.',
      ],
      seasonal: [
        'Adapt your training to the season. Smart athletes work WITH nature, not against it.',
        'Every season offers unique training opportunities. Embrace the variety!',
      ],
      time_mgmt: [
        'Short workouts done consistently beat long workouts done occasionally.',
        "Even 15 focused minutes count. Don't let 'no time' be an excuse!",
      ],
      mindfulness: [
        'Stay present during each rep. Mind-muscle connection = better results.',
        'A focused workout beats a distracted one, every single time.',
      ],
      recovery_protocol: [
        "Recovery isn't passive — active recovery techniques accelerate your progress.",
        'Your body grows during recovery. Treat rest as seriously as training.',
      ],
    };

    const options = blends[intentId];
    if (!options || options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)] ?? null; // non-security
  }

  private detectMuscleGroup(input: string): string {
    const groups: Record<string, string[]> = {
      chest: ['chest', 'bench', 'pec', 'push-up', 'pushup', 'fly'],
      back: ['back', 'lat', 'row', 'pull-up', 'pullup', 'deadlift'],
      legs: ['leg', 'squat', 'lunge', 'quad', 'hamstring', 'calf', 'glute'],
      shoulders: ['shoulder', 'delt', 'press', 'lateral', 'rear delt'],
      arms: ['arm', 'bicep', 'tricep', 'curl', 'extension'],
      core: ['core', 'ab', 'plank', 'crunch', 'oblique'],
    };

    for (const [group, keywords] of Object.entries(groups)) {
      if (keywords.some((kw) => input.includes(kw))) return group;
    }

    return 'core'; // default
  }

  // ============================================
  // DOCUMENT INDEXING FOR NEURAL MODELS
  // ============================================

  /**
   * Index a document for semantic search and knowledge graph.
   * Call this when a document is opened or imported.
   */
  async indexDocument(
    documentId: string,
    content: string,
    _title?: string,
  ): Promise<{
    chunksIndexed: number;
    entitiesFound: number;
    relationsFound: number;
    indexTimeMs: number;
  }> {
    const startTime = Date.now();

    // Index for semantic search (chunkSize=150, overlap=30)
    const chunksIndexed = await semanticSearch.indexDocument(documentId, content, 150, 30);

    // Build knowledge graph
    const graphResult = knowledgeGraph.processDocument(documentId, content);

    return {
      chunksIndexed,
      entitiesFound: graphResult.entitiesFound,
      relationsFound: graphResult.relationsFound,
      indexTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a document has chunks indexed for semantic search.
   * Note: This is a heuristic check - returns true if the document may be indexed.
   */
  async isDocumentIndexed(documentId: string): Promise<boolean> {
    // Search for any chunk from this document with a trivial query
    const testResult = await semanticSearch.search('the', {
      topK: 1,
      minScore: 0,
      documentFilter: [documentId],
    });
    return testResult.length > 0;
  }

  /**
   * Get knowledge graph entities for a topic.
   */
  getRelatedEntities(query: string, limit = 10): Entity[] {
    const result = knowledgeGraph.queryRelated(query, 2, limit);
    return result.entities;
  }

  private fillTemplate(template: string, context: AIContext): string {
    return (
      template
        .replace(/{name}/g, context.userProfile?.name || 'champ')
        .replace(/{streakDays}/g, String(context.userProfile?.streakDays || 0))
        .replace(/{goal}/g, context.userProfile?.goals?.join(', ') || 'fitness')
        .replace(/{totalWorkouts}/g, String((context as any).totalWorkouts || 0))
        .replace(/{exerciseCount}/g, String((context as any).exerciseCount || 200))
        .replace(/{setsCompleted}/g, String(context.workoutContext?.setsCompleted || 0))
        .replace(/{totalSets}/g, String(context.workoutContext?.totalSets || 0))
        .replace(
          /{setsRemaining}/g,
          String((context.workoutContext?.totalSets || 0) - (context.workoutContext?.setsCompleted || 0)),
        )
        .replace(/{muscleGroup}/g, context.workoutContext?.muscleGroup || 'muscles')
        .replace(/{muscle}/g, context.workoutContext?.muscleGroup || 'that area')
        .replace(/{fatigueLevel}/g, String(context.workoutContext?.fatigueLevel || 0))
        .replace(/{fatigueMuscles}/g, context.workoutContext?.fatigueHighMuscles?.join(', ') || 'none')
        .replace(/{readiness}/g, context.workoutContext?.readinessStatus || 'unknown')
        .replace(/{daysSinceWorkout}/g, String(context.workoutContext?.daysSinceLastWorkout ?? 0))
        .replace(/{documentTitle}/g, context.readingContext?.documentTitle || 'your book')
        .replace(/{text}/g, context.readingContext?.selectedText?.slice(0, 100) || 'this passage')
        .replace(/{pagesRead}/g, String(context.readingContext?.currentPage || 0))
        .replace(/{page}/g, String(context.readingContext?.currentPage || 0))
        .replace(/{level}/g, String(context.userProfile?.level || 1))
        .replace(/{totalXP}/g, String(context.userProfile?.totalXP || 0))
        .replace(/{longestStreak}/g, String(context.userProfile?.longestStreak || 0))
        .replace(/{experience}/g, context.userProfile?.fitnessLevel || 'beginner')
        .replace(/{trainingDays}/g, String(context.userProfile?.trainingDaysPerWeek || 3))
        .replace(/{sessionTime}/g, String(context.userProfile?.sessionMinutes || 30))
        .replace(/{weight}/g, context.userProfile?.weight ? `${context.userProfile.weight} kg` : 'unknown')
        .replace(/{height}/g, context.userProfile?.height ? `${context.userProfile.height} cm` : 'unknown')
        .replace(/{injuries}/g, context.userProfile?.injuries || 'none')
        .replace(/{equipment}/g, context.userProfile?.equipment || 'bodyweight')
        // Placeholders with no direct context — remove gracefully
        .replace(/{days}/g, '0')
        .replace(/{improvement}/g, '')
        .replace(/{insight}/g, 'an important concept')
        .replace(/{relatedTopic}/g, 'a related idea')
        .replace(/{observation}/g, 'a deliberate word choice')
    );
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!; // non-security
  }
}

// Singleton
export const dualAI = DualAIEngine.getInstance();
