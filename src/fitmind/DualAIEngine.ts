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
import { getDatabase } from '../database/schema';

// ============================================
// TYPES
// ============================================

export type AIPersonality = 'COACH' | 'PROFESSOR';

export interface AIContext {
  personality: AIPersonality;
  userProfile?: {
    name: string;
    fitnessLevel: string;
    goals: string[];
    streakDays: number;
  };
  workoutContext?: {
    currentExercise?: string;
    muscleGroup?: string;
    setsCompleted?: number;
    totalSets?: number;
    fatigueLevel?: number; // 0-100
    lastWorkoutDate?: string;
  };
  readingContext?: {
    documentTitle?: string;
    documentAuthor?: string;
    currentPage?: number;
    totalPages?: number;
    selectedText?: string;
    recentAnnotations?: string[];
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIResponse {
  message: string;
  suggestions?: string[];
  relatedTopics?: string[];
  confidence: number;       // 0-1
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

// ============================================
// COACH RESPONSE TEMPLATES
// ============================================

const COACH_TEMPLATES = {
  greeting: [
    "Hey {name}! Ready to crush it today? 💪",
    "Welcome back, {name}! Your {streakDays}-day streak is impressive!",
    "Let's go, {name}! Every rep counts.",
    "{name}, your body is ready for this. Let's make it happen!",
  ],
  workout_motivation: [
    "You've got {setsRemaining} sets left — you're almost there! Don't quit now.",
    "That's {setsCompleted}/{totalSets} sets done. The burn you feel is growth happening.",
    "Focus on form, not speed. Quality reps build quality muscle.",
    "Your {muscleGroup} is firing up! Keep the tension steady.",
    "Remember why you started. You're stronger than yesterday.",
  ],
  fatigue_warning: [
    "Your fatigue level is at {fatigueLevel}%. Consider lighter weights or more rest between sets.",
    "I'm seeing high fatigue signals. Listen to your body — recovery IS training.",
    "You've been pushing hard. Maybe a deload day tomorrow? Your muscles will thank you.",
  ],
  form_tips: {
    chest: [
      "Keep your shoulder blades pinched together on bench movements.",
      "Control the negative — 2 seconds down, 1 second up.",
      "Don't bounce the bar off your chest. Touch and press.",
    ],
    back: [
      "Squeeze your lats at the bottom of each pull-up.",
      "Think 'elbows to hips' on rows for max lat engagement.",
      "Don't use momentum — if you're swinging, the weight's too heavy.",
    ],
    legs: [
      "Push through your heels on squats.",
      "Keep your knees tracking over your toes — don't let them cave in.",
      "Full range of motion beats heavy partial reps every time.",
    ],
    shoulders: [
      "Don't shrug on lateral raises — keep traps out of it.",
      "Slight forward lean on overhead press protects your lower back.",
      "Control the weight at the top of the movement.",
    ],
    arms: [
      "Full extension at the bottom of curls — no half reps.",
      "Lock out your tricep extensions for maximum contraction.",
      "Keep your elbows pinned to your sides on curls.",
    ],
    core: [
      "Breathe out on the exertion — exhale as you crunch.",
      "Planks: squeeze your glutes and brace your abs like someone's about to punch you.",
      "Quality over quantity — 10 perfect reps beat 50 sloppy ones.",
    ],
  },
  rest_day: [
    "Rest day! Your muscles grow during recovery, not during the workout.",
    "Active recovery is great — light walk, stretching, or yoga.",
    "Take it easy today. Hydrate well and get 7+ hours of sleep tonight.",
  ],
  streak_celebration: [
    "🔥 {streakDays} days in a row! You're building an unstoppable habit!",
    "Streak: {streakDays} days! Most people quit by day 3. You're different.",
    "{streakDays}-day streak! Consistency > perfection, always.",
  ],
  comeback: [
    "Haven't seen you in a while! No judgment — let's ease back in with a lighter session.",
    "Welcome back! Start at 70% of your previous weights and build from there.",
    "Every comeback starts with showing up. You've already won today.",
  ],
};

// ============================================
// PROFESSOR RESPONSE TEMPLATES
// ============================================

const PROFESSOR_TEMPLATES = {
  greeting: [
    "Welcome to your reading session. What are we exploring today?",
    "Ready to dive into \"{documentTitle}\"? Let's uncover some insights.",
    "The mind is a muscle too. Let's exercise it.",
  ],
  text_analysis: [
    "Interesting passage! The author seems to be arguing that {insight}. What do you think?",
    "This connects to a broader concept: {relatedTopic}. Have you encountered this before?",
    "Notice the language here — {observation}. Authors choose words deliberately.",
  ],
  comprehension_check: [
    "Can you summarize the key point of this section in your own words?",
    "What's the strongest evidence the author presents here?",
    "How does this section connect to what you read earlier?",
    "If you had to explain this to someone in 30 seconds, what would you say?",
  ],
  socratic_prompts: [
    "Why do you think the author chose to present the argument this way?",
    "What assumptions is the author making?",
    "Can you think of a counterargument to this position?",
    "How might this idea apply to your own experience?",
    "What questions does this passage raise for you?",
  ],
  reading_encouragement: [
    "You've read {pagesRead} pages today — great focus!",
    "Your reading speed has improved {improvement}% this week. Keep it up!",
    "Reading consistently builds neural pathways — you're literally getting smarter.",
  ],
  annotation_insight: [
    "You highlighted: \"{text}\". This is a key concept worth revisiting.",
    "Great observation! You might want to create a flashcard from this highlight.",
    "This connects to your earlier note on page {page}. See a pattern forming?",
  ],
};

// ============================================
// DUAL AI ENGINE
// ============================================

export class DualAIEngine {
  private static instance: DualAIEngine | null = null;

  private constructor() {}

  static getInstance(): DualAIEngine {
    if (!DualAIEngine.instance) {
      DualAIEngine.instance = new DualAIEngine();
    }
    return DualAIEngine.instance;
  }

  // ============================================
  // MAIN QUERY INTERFACE
  // ============================================

  /**
   * Send a query to an AI personality and get a contextual response.
   */
  async query(
    input: string,
    context: AIContext
  ): Promise<AIResponse> {
    const startTime = Date.now();

    let response: AIResponse;

    if (context.personality === 'COACH') {
      response = await this.processCoachQuery(input, context);
    } else {
      response = await this.processProfessorQuery(input, context);
    }

    response.processingTimeMs = Date.now() - startTime;

    // Store conversation in encrypted database
    await encryptedDB.storeAIConversation(
      context.personality,
      input,
      response.message,
      {
        processingTimeMs: response.processingTimeMs,
      }
    );

    return response;
  }

  /**
   * Get conversation history for a personality.
   */
  async getHistory(personality: AIPersonality, limit = 20): Promise<ConversationEntry[]> {
    const raw = await encryptedDB.getAIConversations(personality, limit);
    return raw.map(entry => ({ ...entry, personality }));
  }

  /**
   * Get a contextual greeting based on time of day and user state.
   */
  async getGreeting(context: AIContext): Promise<string> {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    if (context.personality === 'COACH') {
      return this.fillTemplate(
        this.pickRandom(COACH_TEMPLATES.greeting),
        context
      );
    }

    return this.fillTemplate(
      this.pickRandom(PROFESSOR_TEMPLATES.greeting),
      context
    );
  }

  // ============================================
  // COACH LOGIC
  // ============================================

  private async processCoachQuery(input: string, context: AIContext): Promise<AIResponse> {
    const lowerInput = input.toLowerCase();
    let message: string;
    let suggestions: string[] = [];
    let confidence = 0.8;

    // Intent detection (keyword-based for on-device speed)
    if (this.matchesIntent(lowerInput, ['motivation', 'tired', 'can\'t', 'give up', 'hard'])) {
      message = this.fillTemplate(this.pickRandom(COACH_TEMPLATES.workout_motivation), context);
      suggestions = ['Take a 90-second rest', 'Reduce weight by 10%', 'You\'ve got this!'];
    } else if (this.matchesIntent(lowerInput, ['form', 'technique', 'how to', 'correct'])) {
      const muscleGroup = this.detectMuscleGroup(lowerInput);
      const tips = COACH_TEMPLATES.form_tips[muscleGroup as keyof typeof COACH_TEMPLATES.form_tips] || COACH_TEMPLATES.form_tips.core;
      message = this.pickRandom(tips);
      suggestions = ['Show me a video', 'More tips', 'Next exercise'];
      confidence = 0.7;
    } else if (this.matchesIntent(lowerInput, ['rest', 'recover', 'sore', 'pain', 'fatigue'])) {
      if (context.workoutContext?.fatigueLevel && context.workoutContext.fatigueLevel > 70) {
        message = this.fillTemplate(this.pickRandom(COACH_TEMPLATES.fatigue_warning), context);
      } else {
        message = this.fillTemplate(this.pickRandom(COACH_TEMPLATES.rest_day), context);
      }
      suggestions = ['Light stretching routine', 'When can I train again?', 'What about foam rolling?'];
    } else if (this.matchesIntent(lowerInput, ['streak', 'consistent', 'habit', 'days'])) {
      message = this.fillTemplate(this.pickRandom(COACH_TEMPLATES.streak_celebration), context);
      suggestions = ['See my progress', 'What\'s next?', 'Share my streak'];
    } else if (this.matchesIntent(lowerInput, ['hello', 'hi', 'hey', 'start', 'begin'])) {
      message = this.fillTemplate(this.pickRandom(COACH_TEMPLATES.greeting), context);
      suggestions = ['Start workout', 'Today\'s plan', 'How am I progressing?'];
    } else {
      // Generic coaching response
      message = await this.generateCoachResponse(input, context);
      confidence = 0.5;
      suggestions = ['Tell me more', 'Start a workout', 'Check my progress'];
    }

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

    if (this.matchesIntent(lowerInput, ['explain', 'what does', 'meaning', 'define', 'understand'])) {
      if (context.readingContext?.selectedText) {
        message = `Let me break down "${context.readingContext.selectedText.slice(0, 100)}...":\n\n` +
          `This passage explores a key concept. ` +
          this.pickRandom(PROFESSOR_TEMPLATES.socratic_prompts);
      } else {
        message = this.pickRandom(PROFESSOR_TEMPLATES.comprehension_check);
      }
      suggestions = ['Give me an example', 'Related concepts', 'Create a flashcard'];
    } else if (this.matchesIntent(lowerInput, ['quiz', 'test', 'check', 'understand'])) {
      message = this.pickRandom(PROFESSOR_TEMPLATES.comprehension_check);
      suggestions = ['I think...', 'Not sure, explain more', 'Skip this question'];
      confidence = 0.8;
    } else if (this.matchesIntent(lowerInput, ['why', 'how come', 'reason'])) {
      message = this.pickRandom(PROFESSOR_TEMPLATES.socratic_prompts);
      suggestions = ['I think because...', 'The author argues...', 'I\'m not sure'];
    } else if (this.matchesIntent(lowerInput, ['highlight', 'note', 'important', 'key'])) {
      message = this.fillTemplate(
        this.pickRandom(PROFESSOR_TEMPLATES.annotation_insight),
        context
      );
      suggestions = ['Create flashcard', 'See all highlights', 'Connect to previous notes'];
    } else if (this.matchesIntent(lowerInput, ['hello', 'hi', 'start', 'reading'])) {
      message = this.fillTemplate(this.pickRandom(PROFESSOR_TEMPLATES.greeting), context);
      suggestions = ['Continue reading', 'Review flashcards', 'Reading stats'];
    } else if (this.matchesIntent(lowerInput, ['summary', 'summarize', 'recap', 'overview'])) {
      message = context.readingContext?.documentTitle
        ? `Here's what we've covered in "${context.readingContext.documentTitle}" so far:\n\n` +
          `You're on page ${context.readingContext.currentPage || 0} of ${context.readingContext.totalPages || '?'}. ` +
          `Let me help you consolidate your understanding.\n\n` +
          this.pickRandom(PROFESSOR_TEMPLATES.comprehension_check)
        : 'No document is currently open. Open a book from your library to start.';
      suggestions = ['Key takeaways', 'Quiz me', 'Continue reading'];
    } else {
      // Generic professor response
      message = await this.generateProfessorResponse(input, context);
      confidence = 0.5;
      suggestions = ['Tell me more', 'Ask a question', 'Continue reading'];
    }

    return {
      message,
      suggestions,
      relatedTopics,
      confidence,
      processingTimeMs: 0,
      personality: 'PROFESSOR',
    };
  }

  // ============================================
  // RESPONSE GENERATION (template fallback)
  // ============================================

  private async generateCoachResponse(input: string, context: AIContext): Promise<string> {
    // Build contextual response from user state
    const parts: string[] = [];

    if (context.userProfile?.streakDays && context.userProfile.streakDays > 0) {
      parts.push(`You're on a ${context.userProfile.streakDays}-day streak — that's dedication!`);
    }

    if (context.workoutContext?.currentExercise) {
      parts.push(`For ${context.workoutContext.currentExercise}: focus on controlled movement and proper breathing.`);
    }

    if (parts.length === 0) {
      parts.push(
        "Every workout is a step forward. Let's make today count!",
        "What would you like to work on? I can help with form tips, motivation, or planning your next session."
      );
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
      this.pickRandom(PROFESSOR_TEMPLATES.socratic_prompts)
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
    return tips ? this.pickRandom(tips) : this.pickRandom(COACH_TEMPLATES.form_tips.core);
  }

  /**
   * Get a Socratic question for the current reading.
   */
  getSocraticQuestion(): string {
    return this.pickRandom(PROFESSOR_TEMPLATES.socratic_prompts);
  }

  /**
   * Get a comprehension check question.
   */
  getComprehensionCheck(): string {
    return this.pickRandom(PROFESSOR_TEMPLATES.comprehension_check);
  }

  // ============================================
  // HELPERS
  // ============================================

  private matchesIntent(input: string, keywords: string[]): boolean {
    return keywords.some((kw) => input.includes(kw));
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

  private fillTemplate(template: string, context: AIContext): string {
    return template
      .replace(/{name}/g, context.userProfile?.name || 'champ')
      .replace(/{streakDays}/g, String(context.userProfile?.streakDays || 0))
      .replace(/{setsCompleted}/g, String(context.workoutContext?.setsCompleted || 0))
      .replace(/{totalSets}/g, String(context.workoutContext?.totalSets || 0))
      .replace(/{setsRemaining}/g, String(
        (context.workoutContext?.totalSets || 0) - (context.workoutContext?.setsCompleted || 0)
      ))
      .replace(/{muscleGroup}/g, context.workoutContext?.muscleGroup || 'muscles')
      .replace(/{fatigueLevel}/g, String(context.workoutContext?.fatigueLevel || 0))
      .replace(/{documentTitle}/g, context.readingContext?.documentTitle || 'your book')
      .replace(/{text}/g, context.readingContext?.selectedText?.slice(0, 100) || '')
      .replace(/{pagesRead}/g, String(context.readingContext?.currentPage || 0))
      .replace(/{page}/g, String(context.readingContext?.currentPage || 0));
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

// Singleton
export const dualAI = DualAIEngine.getInstance();
