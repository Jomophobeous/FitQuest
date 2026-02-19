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
import { neuralSummarizer, SummaryResult } from '../ai/professor/NeuralSummarizer';
import { semanticSearch, SearchResult } from '../ai/professor/SemanticSearch';
import { knowledgeGraph, Entity } from '../ai/professor/KnowledgeGraph';

// ============================================
// TYPES
// ============================================

export type AIPersonality = 'COACH' | 'PROFESSOR';

/** Extracted memory from past conversations */
export interface ConversationMemory {
  recentTopics: string[];              // Last discussed topics/exercises
  userPreferences: string[];           // "prefers morning workouts", "struggles with push-ups"
  mentionedExercises: string[];        // Exercises discussed in past sessions
  mentionedBooks: string[];            // Books/documents discussed
  lastInteractionDays: number;         // Days since last conversation
  conversationCount: number;           // Total conversations with this personality
  averageSessionLength: number;        // Average messages per session
}

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
    documentId?: string;
    documentTitle?: string;
    documentAuthor?: string;
    documentContent?: string; // Full or partial document text for neural processing
    currentPage?: number;
    totalPages?: number;
    selectedText?: string;
    recentAnnotations?: string[];
  };
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  memory?: ConversationMemory; // NEW: extracted memory from past conversations
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

export interface ProfessorModelOptions {
  provider: 'LOCAL' | 'OPENAI';
  apiKey?: string;
  model?: string;
}

// ============================================
// COACH RESPONSE TEMPLATES (Expanded)
// ============================================

const COACH_TEMPLATES = {
  greeting: [
    "Hey {name}! Ready to crush it today? 💪",
    "Welcome back, {name}! Your {streakDays}-day streak is impressive!",
    "Let's go, {name}! Every rep counts.",
    "{name}, your body is ready for this. Let's make it happen!",
    "What's up, {name}! Time to turn potential into progress.",
    "Hey champion! Another day, another opportunity to grow.",
    "{name}, you showed up. That's already 90% of the battle.",
  ],
  greeting_morning: [
    "Early bird gets the gains! Let's start the day strong, {name}. 🌅",
    "Morning workout = energized all day. Smart choice, {name}!",
    "Rise and grind, {name}! Your body will thank you later.",
    "Nothing beats a morning session. Let's wake up those muscles!",
  ],
  greeting_afternoon: [
    "Afternoon session! Perfect way to break up the day, {name}.",
    "Midday power-up! Let's get the blood flowing, {name}.",
    "Great timing — afternoon workouts boost focus for the rest of the day.",
  ],
  greeting_evening: [
    "Evening grind time, {name}! Let's burn off the day's stress. 🌙",
    "End the day strong! Nothing beats that post-workout relaxation.",
    "Night owl gains incoming! Let's make this session count, {name}.",
    "The gym is quieter now — perfect focus time. Let's do this!",
  ],
  workout_motivation: [
    "You've got {setsRemaining} sets left — you're almost there! Don't quit now.",
    "That's {setsCompleted}/{totalSets} sets done. The burn you feel is growth happening.",
    "Focus on form, not speed. Quality reps build quality muscle.",
    "Your {muscleGroup} is firing up! Keep the tension steady.",
    "Remember why you started. You're stronger than yesterday.",
    "This is where champions are made — when it gets hard.",
    "Your future self is watching. Make them proud.",
    "The last rep is where the magic happens. Push through!",
    "Discipline beats motivation every single time. You're proving that right now.",
    "The weight doesn't know how tired you are. Neither should you.",
    "Embrace the struggle — it's the path to progress.",
    "You're not just building muscle, you're building character.",
    "Pain is temporary. Quitting lasts forever.",
    "One more rep. You can do anything for one rep.",
    "This discomfort? It's your body adapting. Keep going.",
  ],
  fatigue_warning: [
    "Your fatigue level is at {fatigueLevel}%. Consider lighter weights or more rest between sets.",
    "I'm seeing high fatigue signals. Listen to your body — recovery IS training.",
    "You've been pushing hard. Maybe a deload day tomorrow? Your muscles will thank you.",
    "High fatigue detected. Option: reduce volume by 30% and focus on technique.",
    "Your CNS is asking for a break. Respect the signals or risk injury.",
  ],
  form_tips: {
    chest: [
      "Keep your shoulder blades pinched together on bench movements.",
      "Control the negative — 2 seconds down, 1 second up.",
      "Don't bounce the bar off your chest. Touch and press.",
      "Slight arch in your lower back, feet planted firm.",
      "Activate your lats before you press — creates a stable base.",
    ],
    back: [
      "Squeeze your lats at the bottom of each pull-up.",
      "Think 'elbows to hips' on rows for max lat engagement.",
      "Don't use momentum — if you're swinging, the weight's too heavy.",
      "Initiate the pull with your back, not your biceps.",
      "Full stretch at the bottom, full squeeze at the top.",
    ],
    legs: [
      "Push through your heels on squats.",
      "Keep your knees tracking over your toes — don't let them cave in.",
      "Full range of motion beats heavy partial reps every time.",
      "Brace your core like you're about to get punched.",
      "On deadlifts: the bar stays close to your body the entire lift.",
    ],
    shoulders: [
      "Don't shrug on lateral raises — keep traps out of it.",
      "Slight forward lean on overhead press protects your lower back.",
      "Control the weight at the top of the movement.",
      "Rotate pinkies up slightly at the top of lateral raises.",
      "Keep tension throughout — no momentum swings.",
    ],
    arms: [
      "Full extension at the bottom of curls — no half reps.",
      "Lock out your tricep extensions for maximum contraction.",
      "Keep your elbows pinned to your sides on curls.",
      "On skull crushers: only your forearms should move.",
      "Squeeze and hold at peak contraction for 1 second.",
    ],
    core: [
      "Breathe out on the exertion — exhale as you crunch.",
      "Planks: squeeze your glutes and brace your abs like someone's about to punch you.",
      "Quality over quantity — 10 perfect reps beat 50 sloppy ones.",
      "Hollow body: Press your lower back into the floor.",
      "Anti-rotation exercises build real functional core strength.",
    ],
  },
  rest_day: [
    "Rest day! Your muscles grow during recovery, not during the workout.",
    "Active recovery is great — light walk, stretching, or yoga.",
    "Take it easy today. Hydrate well and get 7+ hours of sleep tonight.",
    "Recovery day = growth day. Trust the process.",
    "Your nervous system needs this break. You'll come back stronger.",
  ],
  streak_celebration: [
    "🔥 {streakDays} days in a row! You're building an unstoppable habit!",
    "Streak: {streakDays} days! Most people quit by day 3. You're different.",
    "{streakDays}-day streak! Consistency > perfection, always.",
  ],
  streak_milestones: {
    '7': [
      "🎯 ONE WEEK! 7 days straight! You've proven this is more than a phase.",
      "7-day streak! Studies show habits start forming around now. You're on track!",
      "A full week of showing up! That's elite-level commitment.",
    ],
    '14': [
      "🔥 TWO WEEKS! 14 days! The hardest part is behind you.",
      "14-day streak! Your body is adapting — you'll start noticing changes soon.",
      "Half a month consistent! This is becoming part of who you are.",
    ],
    '30': [
      "🏆 ONE MONTH! 30 days! You've built a real habit now.",
      "30-day streak! This is no longer willpower — it's identity. You're an athlete.",
      "A full month! 93% of people never make it this far. You're exceptional.",
    ],
    '60': [
      "⭐ TWO MONTHS! 60 days of pure dedication! You inspire me.",
      "60-day streak! Your fitness DNA has been rewritten. This is you now.",
      "Two months strong! The compound effect is kicking in big time.",
    ],
    '90': [
      "👑 90 DAYS! THREE MONTHS! You're in the top 1% of consistency.",
      "90-day streak! You've proven that discipline > motivation. Legendary.",
      "A quarter-year of daily dedication! You're not just fit, you're BUILT different.",
    ],
  },
  comeback: [
    "Haven't seen you in a while! No judgment — let's ease back in with a lighter session.",
    "Welcome back! Start at 70% of your previous weights and build from there.",
    "Every comeback starts with showing up. You've already won today.",
  ],
  comeback_short: [ // 3-7 days
    "3 days off? Perfect recovery window! Let's ease back in at 90%.",
    "Short break, no problem! Your muscles are rested and ready.",
    "A few days off won't hurt your gains. Let's pick up where we left off.",
  ],
  comeback_medium: [ // 1-2 weeks
    "A week off? Your body got some deep recovery. Start at 75% and build up quickly.",
    "Two weeks away is nothing in the long run. Focus on form today, intensity tomorrow.",
    "Missed a few sessions? Life happens. What matters is you're here NOW.",
  ],
  comeback_long: [ // 2+ weeks
    "It's been a while! No shame — every champion has had to restart. Let's go 60% today.",
    "Long break? Perfect time for a fresh start. New phase, new goals, same warrior spirit.",
    "Welcome back after {days} days! We'll rebuild smarter this time. Trust the process.",
  ],
  progressive_overload: [
    "📈 You lifted more than last time! That's progressive overload in action!",
    "New personal best on that set! Your strength is visibly increasing!",
    "More reps than last session! Your body is adapting beautifully.",
    "Weight increase successful! This is exactly how you build strength.",
    "Progress detected! Small improvements compound into massive gains.",
  ],
  sport_specific: {
    runner: [
      "Strength training makes runners faster and more injury-resistant. Smart combo!",
      "Strong legs = faster splits. Every squat pays dividends on race day.",
      "Core work today = better running economy tomorrow.",
    ],
    lifter: [
      "Compound movements are king. Squat, deadlift, press — the holy trinity.",
      "Time under tension is your friend. Control every rep.",
      "Hypertrophy comes from volume. Let's accumulate quality reps.",
    ],
    yogi: [
      "Strength supports flexibility. You'll hold those poses longer and deeper.",
      "Balance work today complements your yoga practice perfectly.",
      "Core strength = better inversions. Every plank helps your headstand.",
    ],
    body_control: [
      "Bodyweight mastery! Each rep brings you closer to that muscle-up.",
      "Progressions are your path. Master each level before advancing.",
      "Your strength-to-weight ratio is improving with every session.",
    ],
    general: [
      "Building a well-rounded athlete! Strength, endurance, mobility — you're covering it all.",
      "Functional fitness is the goal. Move well, move often.",
      "Every workout is an investment in your future self.",
    ],
  },
  injury_aware: [
    "Take it easy on that {muscle}. Modified movements are smart, not weak.",
    "Working around your injury? That's a sign of maturity, not defeat.",
    "Let's protect that area today. Alternative exercises will keep you progressing.",
    "Pain is a signal, not a challenge. We'll adapt the workout accordingly.",
    "Recovery from injury is still progress. Be patient with yourself.",
  ],
};

// ============================================
// PROFESSOR RESPONSE TEMPLATES (Expanded)
// ============================================

const PROFESSOR_TEMPLATES = {
  greeting: [
    "Welcome to your reading session. What are we exploring today?",
    "Ready to dive into \"{documentTitle}\"? Let's uncover some insights.",
    "The mind is a muscle too. Let's exercise it.",
    "Hello, scholar! Ready to expand your understanding?",
    "Another day of growth! What would you like to explore?",
    "The journey of a thousand pages begins with a single chapter. Let's begin.",
  ],
  greeting_morning: [
    "Morning reading! Research shows comprehension peaks in the morning. Perfect timing.",
    "Early reader! Your brain is fresh and ready to absorb new ideas.",
    "Sunrise study session. Let's make the most of this focused time.",
  ],
  greeting_afternoon: [
    "Afternoon learning! Great time to process and connect ideas.",
    "Post-lunch reading. A bit of mental exercise to stay sharp!",
    "Midday knowledge session. Let's keep that momentum going.",
  ],
  greeting_evening: [
    "Evening reading — perfect for reflection and deeper thinking.",
    "Night owl scholar! Some say the best insights come in quiet evening hours.",
    "End your day with wisdom. Let's explore something meaningful.",
  ],
  text_analysis: [
    "Interesting passage! The author seems to be arguing that {insight}. What do you think?",
    "This connects to a broader concept: {relatedTopic}. Have you encountered this before?",
    "Notice the language here — {observation}. Authors choose words deliberately.",
    "The structure of this argument is intentional. Can you identify the logical flow?",
    "This passage uses rhetoric effectively. What persuasion techniques do you notice?",
  ],
  comprehension_check: [
    "Can you summarize the key point of this section in your own words?",
    "What's the strongest evidence the author presents here?",
    "How does this section connect to what you read earlier?",
    "If you had to explain this to someone in 30 seconds, what would you say?",
    "What's the main takeaway you'll remember from this section?",
    "Can you identify three key concepts from this passage?",
    "How would you explain this to a friend who hasn't read it?",
    "What surprised you most about this section?",
  ],
  socratic_prompts: [
    "Why do you think the author chose to present the argument this way?",
    "What assumptions is the author making?",
    "Can you think of a counterargument to this position?",
    "How might this idea apply to your own experience?",
    "What questions does this passage raise for you?",
    "If the author were wrong, what would that imply?",
    "What would a critic of this view say?",
    "Does this argument depend on specific conditions? Which ones?",
    "How might this idea look different in another context or culture?",
    "What's the strongest version of the opposing view?",
  ],
  devils_advocate: [
    "Let me challenge this: what if the opposite were true?",
    "Playing devil's advocate here — isn't this assumption questionable?",
    "An interesting counterpoint: have you considered that...",
    "Some would argue the exact opposite. How would you respond?",
    "What would a skeptic say about this claim?",
  ],
  feynman_technique: [
    "Try explaining this as if you were teaching a child. What simplifications would you make?",
    "Can you explain this without using any jargon? Simple words only.",
    "If you had to draw this concept, what would the diagram look like?",
    "Imagine explaining this to your grandmother. What analogy would work?",
    "Break this down into three simple steps anyone could follow.",
  ],
  reading_encouragement: [
    "You've read {pagesRead} pages today — great focus!",
    "Your reading speed has improved {improvement}% this week. Keep it up!",
    "Reading consistently builds neural pathways — you're literally getting smarter.",
    "Every page is a step toward mastery. Keep going!",
    "Deep reading like this is rare in the age of scrolling. You're doing something valuable.",
    "Concentrated reading = concentrated learning. Well done!",
  ],
  annotation_insight: [
    "You highlighted: \"{text}\". This is a key concept worth revisiting.",
    "Great observation! You might want to create a flashcard from this highlight.",
    "This connects to your earlier note on page {page}. See a pattern forming?",
    "Interesting highlight! This relates to concepts you've encountered before.",
    "Marking this passage shows good instincts. It's a pivotal point.",
  ],
  flashcard_encouragement: [
    "💡 This concept would make a great flashcard! Shall I create one?",
    "Studies show the testing effect improves retention by 40%. Let's make a flashcard.",
    "Revisiting this later will cement it. Flashcard time?",
    "Your future self will thank you for memorizing this. Add to flashcards?",
    "Spaced repetition is the secret sauce of learning. Let's capture this idea.",
  ],
  reading_streak: {
    '7': [
      "📚 7 days of reading! You're building a powerful habit.",
      "One week of daily reading! Your mind is expanding.",
      "7-day streak! Consistent readers retain 60% more. You're on that path!",
    ],
    '14': [
      "📖 Two weeks of reading! This is becoming second nature.",
      "14 days of feeding your mind. The compound effect kicks in soon!",
      "Half a month of reading! Your future self is grateful.",
    ],
    '30': [
      "🏆 30-day reading streak! You're a certified knowledge enthusiast!",
      "A full month of daily reading! Most people never achieve this.",
      "30 days! Reading is now part of your identity. Beautiful.",
    ],
  },
  document_type: {
    book: [
      "Books demand patience but reward deeply. Let's take our time.",
      "A proper book! This will unfold beautifully over multiple sessions.",
      "Long-form reading builds sustained attention. Let's dive in.",
    ],
    article: [
      "Articles are concentrated knowledge. Let's extract the key insights.",
      "This article format means dense information. Read carefully!",
      "Short-form reading can still be deep. Let's analyze.",
    ],
    research: [
      "Academic reading requires extra attention. Focus on methodology and conclusions.",
      "Research papers need critical reading. Check the evidence carefully.",
      "Scientific literature! Let's evaluate the claims systematically.",
    ],
    technical: [
      "Technical material — best absorbed slowly with examples.",
      "For technical content, try implementing as you read. It sticks better.",
      "Dense technical material. Pause after each section to internalize.",
    ],
  },
  reading_level: {
    beginner: [
      "Don't worry if terms are unfamiliar — we'll break them down together.",
      "New to this topic? Perfect! Curiosity is all you need.",
      "Every expert was once a beginner. Let's build your foundation.",
    ],
    intermediate: [
      "You've got solid foundations. Let's build on them.",
      "This should challenge you just enough. Perfect difficulty!",
      "Connect this to what you already know. See the patterns?",
    ],
    advanced: [
      "Expert-level material! Push your boundaries.",
      "You're ready for nuanced analysis. Let's go deep.",
      "High-level thinking required. I know you're capable.",
    ],
  },
  synthesis: [
    "Try connecting this to something else you've read. What patterns emerge?",
    "How does this relate to your other readings this week?",
    "Can you synthesize this with your prior knowledge?",
    "What other authors would agree or disagree with this?",
    "This idea has connections. Can you trace them?",
  ],
  metacognition: [
    "Rate your understanding from 1-10. What would bring it to a 10?",
    "What part confused you? Let's address that.",
    "Which concept here needs more review later?",
    "If you had to teach this tomorrow, what would you need to clarify first?",
    "What's still unclear? Let's work through it together.",
  ],
};

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
    const available = arr.filter(t => !recent.includes(t));
    
    // If all templates were recently used, just pick randomly
    const pool = available.length > 0 ? available : arr;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    
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
  async query(
    input: string,
    context: AIContext
  ): Promise<AIResponse> {
    const startTime = Date.now();

    // Auto-load conversation memory if not provided
    let enrichedContext = context;
    if (!context.memory) {
      try {
        const memory = await this.loadConversationMemory(context.personality, 10);
        enrichedContext = { ...context, memory };
      } catch (e) {
        console.warn('[DualAI] Failed to load memory:', e);
      }
    }

    let response: AIResponse;

    if (enrichedContext.personality === 'COACH') {
      response = await this.processCoachQuery(input, enrichedContext);
    } else {
      response = await this.processProfessorQuery(input, enrichedContext);
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
   * Query professor using either on-device templates (LOCAL) or OpenAI (OPENAI).
   */
  async queryProfessorWithModel(
    input: string,
    context: Omit<AIContext, 'personality'> & { personality?: 'PROFESSOR' },
    options: ProfessorModelOptions
  ): Promise<AIResponse> {
    const professorContext: AIContext = {
      ...context,
      personality: 'PROFESSOR',
    };

    if (options.provider === 'OPENAI') {
      try {
        return await this.queryProfessorViaOpenAI(input, professorContext, options);
      } catch (error: any) {
        console.warn('[DualAI] OpenAI Professor failed, falling back to local', {
          message: error?.message,
          model: options.model || 'gpt-4.1-mini',
        });
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
    return raw.map(entry => ({ ...entry, personality }));
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
      'push-up', 'pushup', 'pull-up', 'pullup', 'squat', 'lunge', 'plank',
      'burpee', 'deadlift', 'bench press', 'row', 'curl', 'press', 'crunch',
      'sit-up', 'dip', 'jump', 'run', 'jog', 'sprint', 'stretch', 'yoga'
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
          userPreferences.add(extract.replace('$1', match[1]));
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
      const bookMatch = entry.query.match(/(?:reading|book|chapter|document|article)\s+(?:about|on|called)?\s*"?([^"]+)"?/i);
      if (bookMatch) {
        mentionedBooks.add(bookMatch[1].trim());
      }
    }
    
    // Calculate last interaction days
    const lastInteractionDays = history.length > 0
      ? Math.floor((Date.now() - history[0].created_at) / (1000 * 60 * 60 * 24))
      : -1;
    
    // Estimate average session length by counting distinct session "bursts"
    // (conversations within 30 minutes of each other count as one session)
    let sessionCount = history.length > 0 ? 1 : 0;
    for (let i = 1; i < history.length; i++) {
      const gap = history[i - 1].created_at - history[i].created_at;
      if (gap > 30 * 60 * 1000) { // 30-minute gap = new session
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
      const useTimeGreeting = Math.random() < 0.4;
      if (useTimeGreeting) {
        const timeCategory = `coach_greeting_${timeOfDay}`;
        const timeTemplates = timeOfDay === 'morning' ? COACH_TEMPLATES.greeting_morning
          : timeOfDay === 'afternoon' ? COACH_TEMPLATES.greeting_afternoon
          : COACH_TEMPLATES.greeting_evening;
        baseGreeting = this.fillTemplate(this.pickRandomAvoidingRepeats(timeTemplates, timeCategory), context);
      } else {
        baseGreeting = this.fillTemplate(this.pickRandomAvoidingRepeats(COACH_TEMPLATES.greeting, 'coach_greeting'), context);
      }
      
      // Add streak milestone celebration if applicable
      const streakDays = context.userProfile?.streakDays || 0;
      const milestoneKey = [90, 60, 30, 14, 7].find(m => streakDays >= m)?.toString();
      if (milestoneKey && COACH_TEMPLATES.streak_milestones[milestoneKey as keyof typeof COACH_TEMPLATES.streak_milestones]) {
        const milestoneMsg = this.pickRandomAvoidingRepeats(
          COACH_TEMPLATES.streak_milestones[milestoneKey as keyof typeof COACH_TEMPLATES.streak_milestones],
          `coach_streak_${milestoneKey}`
        );
        baseGreeting = `${milestoneMsg}\n\n${baseGreeting}`;
      }
    } else {
      // Professor: use time-of-day greeting with 40% probability
      const useTimeGreeting = Math.random() < 0.4;
      if (useTimeGreeting) {
        const timeCategory = `prof_greeting_${timeOfDay}`;
        const timeTemplates = timeOfDay === 'morning' ? PROFESSOR_TEMPLATES.greeting_morning
          : timeOfDay === 'afternoon' ? PROFESSOR_TEMPLATES.greeting_afternoon
          : PROFESSOR_TEMPLATES.greeting_evening;
        baseGreeting = this.fillTemplate(this.pickRandomAvoidingRepeats(timeTemplates, timeCategory), context);
      } else {
        baseGreeting = this.fillTemplate(this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.greeting, 'prof_greeting'), context);
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

  // ============================================
  // COACH LOGIC
  // ============================================

  private async processCoachQuery(input: string, context: AIContext): Promise<AIResponse> {
    const lowerInput = input.toLowerCase();
    let message: string;
    let suggestions: string[] = [];
    let confidence = 0.8;
    const memory = context.memory;

    // Intent detection (keyword-based for on-device speed)
    if (this.matchesIntent(lowerInput, ['motivation', 'tired', 'can\'t', 'give up', 'hard'])) {
      message = this.fillTemplate(
        this.pickRandomAvoidingRepeats(COACH_TEMPLATES.workout_motivation, 'coach_motivation'),
        context
      );
      
      // Add memory-aware encouragement
      if (memory && memory.conversationCount > 3) {
        message += `\n\nYou've pushed through ${memory.conversationCount} sessions with me. That mental strength matters!`;
      }
      if (memory && memory.mentionedExercises.length > 0) {
        const favoriteExercise = memory.mentionedExercises[0];
        message += ` Remember how you crushed those ${favoriteExercise}s last time?`;
      }
    } else if (this.matchesIntent(lowerInput, ['form', 'technique', 'how to', 'correct'])) {
      const muscleGroup = this.detectMuscleGroup(lowerInput);
      const tips = COACH_TEMPLATES.form_tips[muscleGroup as keyof typeof COACH_TEMPLATES.form_tips] || COACH_TEMPLATES.form_tips.core;
      message = this.pickRandomAvoidingRepeats(tips, `coach_form_${muscleGroup}`);
      
      // Reference past form discussions
      if (memory && memory.recentTopics.some(t => t.includes('form') || t.includes('technique'))) {
        message = `As we discussed before: ${message}`;
      }
      
      confidence = 0.7;
    } else if (this.matchesIntent(lowerInput, ['rest', 'recover', 'sore', 'pain', 'fatigue'])) {
      if (context.workoutContext?.fatigueLevel && context.workoutContext.fatigueLevel > 70) {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.fatigue_warning, 'coach_fatigue'),
          context
        );
      } else {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.rest_day, 'coach_rest'),
          context
        );
      }
      
      // Memory-aware recovery advice
      if (memory && memory.userPreferences.some(p => p.includes('injury'))) {
        const injuryPref = memory.userPreferences.find(p => p.includes('injury'));
        message += `\n\n💡 Reminder: You mentioned ${injuryPref}. Take extra care with that area.`;
      }
    } else if (this.matchesIntent(lowerInput, ['streak', 'consistent', 'habit', 'days'])) {
      // Check for streak milestones
      const streakDays = context.userProfile?.streakDays || 0;
      const milestoneKey = [90, 60, 30, 14, 7].find(m => streakDays >= m)?.toString();
      if (milestoneKey && COACH_TEMPLATES.streak_milestones[milestoneKey as keyof typeof COACH_TEMPLATES.streak_milestones]) {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(
            COACH_TEMPLATES.streak_milestones[milestoneKey as keyof typeof COACH_TEMPLATES.streak_milestones],
            'coach_milestone'
          ),
          context
        );
      } else {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.streak_celebration, 'coach_streak'),
          context
        );
      }
    } else if (this.matchesIntent(lowerInput, ['hello', 'hi', 'hey', 'start', 'begin'])) {
      // Use comeback templates based on gap length
      if (memory && memory.lastInteractionDays >= 14) {
        const comebackTemplate = this.pickRandomAvoidingRepeats(COACH_TEMPLATES.comeback_long, 'coach_comeback');
        message = this.fillTemplate(comebackTemplate, context)
          .replace(/{days}/g, String(memory.lastInteractionDays));
      } else if (memory && memory.lastInteractionDays >= 7) {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.comeback_medium, 'coach_comeback'),
          context
        );
      } else if (memory && memory.lastInteractionDays >= 3) {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(COACH_TEMPLATES.comeback_short, 'coach_comeback'),
          context
        );
      } else {
        // Regular greeting with time-of-day awareness
        const hour = new Date().getHours();
        const useTimeGreeting = Math.random() < 0.4;
        if (useTimeGreeting) {
          const timeTemplates = hour < 12 ? COACH_TEMPLATES.greeting_morning
            : hour < 17 ? COACH_TEMPLATES.greeting_afternoon
            : COACH_TEMPLATES.greeting_evening;
          message = this.fillTemplate(
            this.pickRandomAvoidingRepeats(timeTemplates, 'coach_greeting_time'),
            context
          );
        } else {
          message = this.fillTemplate(
            this.pickRandomAvoidingRepeats(COACH_TEMPLATES.greeting, 'coach_greeting'),
            context
          );
        }
      }
    } else {
      // Generic coaching response with memory context
      message = await this.generateCoachResponse(input, context);
      confidence = 0.5;
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
          const relevantPassage = searchResults[0];
          message = `Let me break down "${reading.selectedText.slice(0, 80)}...":\n\n` +
            `📌 **Related context from the document:**\n"${relevantPassage.text.slice(0, 200)}..."\n\n` +
            this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
          confidence = Math.min(0.9, relevantPassage.score + 0.3);
        } else {
          message = `Let me break down "${reading.selectedText.slice(0, 100)}...":\n\n` +
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
          message += `> "${searchResults[0].text.slice(0, 200)}..."\n\n`;
          message += this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic');
          confidence = 0.75;
        } else {
          // Use devil's advocate or Feynman technique for deeper thinking
          const useTechnique = Math.random() < 0.3;
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
        context
      );
      // Offer flashcard creation
      if (Math.random() < 0.4) {
        message += `\n\n${this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.flashcard_encouragement, 'prof_flashcard')}`;
      }
    } else if (this.matchesIntent(lowerInput, ['hello', 'hi', 'start', 'reading'])) {
      // Time-of-day aware greeting
      const hour = new Date().getHours();
      const useTimeGreeting = Math.random() < 0.4;
      if (useTimeGreeting) {
        const timeTemplates = hour < 12 ? PROFESSOR_TEMPLATES.greeting_morning
          : hour < 17 ? PROFESSOR_TEMPLATES.greeting_afternoon
          : PROFESSOR_TEMPLATES.greeting_evening;
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(timeTemplates, 'prof_greeting_time'),
          context
        );
      } else {
        message = this.fillTemplate(
          this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.greeting, 'prof_greeting'),
          context
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
        message = `📖 **Summary of "${reading.documentTitle}"**\n\n${summaryResult.summary}\n\n${pageInfo}\n\n` +
          `_(${summaryResult.modelType === 'neural' ? 'AI-powered' : 'Extractive'} summary, ${Math.round(summaryResult.compressionRatio * 100)}% compression)_`;
        confidence = summaryResult.modelType === 'neural' ? 0.85 : 0.7;
      } else {
        // Fallback when no content available
        message = `Here's what we've covered in "${reading.documentTitle}" so far:\n\n` +
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
      console.warn('[DualAI] Professor intent processing failed, using fallback:', intentError);
      message = this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.comprehension_check, 'prof_comprehension');
      confidence = 0.4;
    }

    // Knowledge Graph: Extract related topics from user query
    try {
      const queryResult = knowledgeGraph.queryRelated(input, 1, 5);
      if (queryResult.entities.length > 0) {
        relatedTopics = queryResult.entities
          .slice(0, 4)
          .map(e => e.name);
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
        const previousBooks = memory.mentionedBooks.filter(
          b => !currentBook.includes(b.toLowerCase())
        );
        if (previousBooks.length > 0 && Math.random() < 0.3) {
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
    options: ProfessorModelOptions
  ): Promise<AIResponse> {
    const apiKey = (options.apiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('OpenAI API key is required for Professor cloud mode.');
    }

    const model = (options.model || 'gpt-4.1-mini').trim();
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const reading = context.readingContext;
    const systemPrompt = [
      'You are FitQuest Professor, a concise reading tutor.',
      'Prioritize document analysis, comprehension, and critical thinking.',
      'Keep responses practical, clear, and no more than 180 words unless asked.',
      `Document: ${reading?.documentTitle || 'Unknown'}`,
      `Author: ${reading?.documentAuthor || 'Unknown'}`,
      `Page: ${reading?.currentPage || 0} / ${reading?.totalPages || '?'}`,
      reading?.selectedText ? `Selected text: ${reading.selectedText.slice(0, 600)}` : '',
    ].filter(Boolean).join('\n');

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: systemPrompt }],
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: input }],
            },
          ],
          temperature: 0.4,
          max_output_tokens: 500,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI request failed (${response.status})`;
      throw new Error(message);
    }

    const outputText =
      payload?.output_text ||
      payload?.output?.flatMap((item: any) => item?.content || []).map((part: any) => part?.text || '').join('\n').trim() ||
      payload?.choices?.[0]?.message?.content?.trim() ||
      'I analyzed this section. Ask me for a focused summary, key claims, or a quiz.';

    const processingTimeMs = Date.now() - startTime;

    await encryptedDB.storeAIConversation(
      'PROFESSOR',
      input,
      outputText,
      {
        modelVersion: `openai:${model}`,
        tokensUsed: payload?.usage?.total_tokens ?? 0,
        processingTimeMs,
      }
    );

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
      this.pickRandomAvoidingRepeats(PROFESSOR_TEMPLATES.socratic_prompts, 'prof_socratic')
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
  getSmartSuggestions(context: AIContext, recentQuery?: string): string[] {
    const suggestions: Array<{ text: string; priority: number; category: string }> = [];
    const now = new Date();
    const currentHour = now.getHours();

    if (context.personality === 'COACH') {
      // ========== WORKOUT STATE ==========
      const workout = context.workoutContext;
      
      if (workout?.fatigueLevel !== undefined && workout.fatigueLevel > 70) {
        suggestions.push({ text: 'Show recovery exercises', priority: 95, category: 'fatigue' });
        suggestions.push({ text: 'Take a longer rest', priority: 85, category: 'fatigue' });
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
        suggestions.push({ text: 'Start today\'s workout', priority: 80, category: 'action' });
        suggestions.push({ text: 'Check my progress', priority: 50, category: 'stats' });
        suggestions.push({ text: 'Today\'s plan', priority: 55, category: 'plan' });
      }
      
      // ========== MEMORY-BASED ==========
      const memory = context.memory;
      if (memory && memory.mentionedExercises.length > 0) {
        const favoriteExercise = memory.mentionedExercises[0];
        suggestions.push({ text: `${favoriteExercise} tips`, priority: 45, category: 'memory' });
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
          suggestions.push({ text: 'What\'s this book about?', priority: 60, category: 'overview' });
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
          b => !reading.documentTitle?.toLowerCase().includes(b.toLowerCase())
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
    }

    // ========== DEDUPLICATE AND SORT ==========
    // Remove duplicates by text
    const seen = new Set<string>();
    const uniqueSuggestions = suggestions.filter(s => {
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
      const categoryCount = [...usedCategories].filter(c => c === suggestion.category).length;
      if (categoryCount >= 2) continue;
      
      final.push(suggestion.text);
      usedCategories.add(suggestion.category);
    }
    
    // Fallback if not enough suggestions
    if (final.length < 3) {
      const fallbacks = context.personality === 'COACH'
        ? ['Start workout', 'Today\'s plan', 'How am I progressing?']
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
  async indexDocument(documentId: string, content: string, _title?: string): Promise<{
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
      documentFilter: [documentId] 
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
    return template
      .replace(/{name}/g, context.userProfile?.name || 'champ')
      .replace(/{streakDays}/g, String(context.userProfile?.streakDays || 0))
      .replace(/{setsCompleted}/g, String(context.workoutContext?.setsCompleted || 0))
      .replace(/{totalSets}/g, String(context.workoutContext?.totalSets || 0))
      .replace(/{setsRemaining}/g, String(
        (context.workoutContext?.totalSets || 0) - (context.workoutContext?.setsCompleted || 0)
      ))
      .replace(/{muscleGroup}/g, context.workoutContext?.muscleGroup || 'muscles')
      .replace(/{muscle}/g, context.workoutContext?.muscleGroup || 'that area')
      .replace(/{fatigueLevel}/g, String(context.workoutContext?.fatigueLevel || 0))
      .replace(/{documentTitle}/g, context.readingContext?.documentTitle || 'your book')
      .replace(/{text}/g, context.readingContext?.selectedText?.slice(0, 100) || 'this passage')
      .replace(/{pagesRead}/g, String(context.readingContext?.currentPage || 0))
      .replace(/{page}/g, String(context.readingContext?.currentPage || 0))
      // Placeholders with no direct context — remove gracefully
      .replace(/{days}/g, '0')
      .replace(/{improvement}/g, '')
      .replace(/{insight}/g, 'an important concept')
      .replace(/{relatedTopic}/g, 'a related idea')
      .replace(/{observation}/g, 'a deliberate word choice');
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

// Singleton
export const dualAI = DualAIEngine.getInstance();
