/**
 * TrainedIntentRouter — On-device inference using trained ML model
 *
 * Loads the exported LinearSVC model (TF-IDF + coefficients as JSON)
 * and performs real-time intent classification in <5ms.
 *
 * Falls back to the keyword-based IntentRouter if model isn't loaded.
 */

// Types
export type TrainedIntentType =
  | 'ACTIVITY_TRACKING'
  | 'DOCUMENT_QUESTION'
  | 'DOCUMENT_SUMMARY'
  | 'FAREWELL'
  | 'FORM_CHECK'
  | 'GREETING'
  | 'HEALTH_QUERY'
  | 'WORKOUT_GENERATION';

export type HandlerType = 'COACH' | 'PROFESSOR' | 'HEALTH' | 'SYSTEM' | 'WORKOUT';

export interface IntentResult {
  intent: TrainedIntentType;
  confidence: number;
  handler: HandlerType;
  alternatives: Array<{ intent: TrainedIntentType; confidence: number }>;
  entities: Record<string, string>;
  inferenceTimeMs: number;
}

interface ModelData {
  version: string;
  model_type: string;
  vocabulary: Record<string, number>;
  idf_weights: number[];
  feature_names: string[];
  labels: string[];
  model: {
    type: string;
    coef: number[][];
    intercept: number[];
  };
  config: {
    max_features: number;
    ngram_range: number[];
    confidence_threshold: number;
  };
}

// Entity patterns for extraction
const ENTITY_PATTERNS: Record<string, string[]> = {
  muscle: [
    'chest',
    'back',
    'legs',
    'shoulders',
    'arms',
    'core',
    'biceps',
    'triceps',
    'abs',
    'glutes',
    'quads',
    'hamstrings',
    'calves',
    'full body',
    'upper body',
    'lower body',
  ],
  exercise: [
    'squat',
    'deadlift',
    'bench press',
    'pullup',
    'pushup',
    'push-up',
    'pull-up',
    'overhead press',
    'row',
    'lunge',
    'plank',
    'dip',
    'curl',
    'crunch',
    'burpee',
    'clean',
    'snatch',
  ],
  activity: ['run', 'walk', 'jog', 'bike', 'hike', 'swim', 'workout', 'exercise', 'sprint', 'cycle'],
  body_part: ['knee', 'back', 'shoulder', 'wrist', 'elbow', 'hip', 'neck', 'ankle'],
};

const HANDLER_MAPPING: Record<TrainedIntentType, HandlerType> = {
  WORKOUT_GENERATION: 'WORKOUT',
  FORM_CHECK: 'COACH',
  HEALTH_QUERY: 'HEALTH',
  ACTIVITY_TRACKING: 'HEALTH',
  DOCUMENT_SUMMARY: 'PROFESSOR',
  DOCUMENT_QUESTION: 'PROFESSOR',
  GREETING: 'SYSTEM',
  FAREWELL: 'SYSTEM',
};

export class TrainedIntentRouter {
  private static instance: TrainedIntentRouter | null = null;
  private modelData: ModelData | null = null;
  private isLoaded = false;
  private vocabMap: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): TrainedIntentRouter {
    if (!TrainedIntentRouter.instance) {
      TrainedIntentRouter.instance = new TrainedIntentRouter();
    }
    return TrainedIntentRouter.instance;
  }

  /**
   * Load the trained model from JSON asset.
   * Call once at app startup.
   */
  async initialize(): Promise<boolean> {
    try {
      // Dynamic import of the model JSON
      const modelJson = require('../../assets/models/intent_model.json');
      this.modelData = modelJson as ModelData;

      // Build vocabulary lookup
      this.vocabMap = new Map(Object.entries(this.modelData.vocabulary));

      this.isLoaded = true;
      if (__DEV__)
        console.warn(
          `[TrainedIntentRouter] Model loaded: ${this.modelData.labels.length} classes, ${this.vocabMap.size} vocab`,
        );
      return true;
    } catch (error) {
      if (__DEV__) console.warn('[TrainedIntentRouter] Failed to load model, will use keyword fallback:', error);
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * Classify a user query using the trained model.
   * Returns intent, confidence, handler, and alternatives.
   */
  classify(query: string): IntentResult {
    const startTime = performance.now();

    if (!this.isLoaded || !this.modelData) {
      // Fallback
      return this.fallbackClassify(query, startTime);
    }

    const text = query.toLowerCase().trim();

    // Step 1: TF-IDF vectorize
    const tfidf = this.tfidfVectorize(text);

    // Step 2: Linear SVC decision function
    const scores = this.decisionFunction(tfidf);

    // Step 3: Softmax for probabilities
    const probs = this.softmax(scores);

    // Step 4: Get top predictions
    const indexed = probs.map((p, i) => ({ prob: p, idx: i }));
    indexed.sort((a, b) => b.prob - a.prob);

    const topIntent = this.modelData.labels[indexed[0]!.idx] as TrainedIntentType;
    const confidence = indexed[0]!.prob;

    const alternatives = indexed.slice(1, 3).map((s) => ({
      intent: this.modelData!.labels[s.idx]! as TrainedIntentType,
      confidence: s.prob,
    }));

    // Step 5: Extract entities
    const entities = this.extractEntities(text);

    return {
      intent: topIntent,
      confidence,
      handler: HANDLER_MAPPING[topIntent] || 'COACH',
      alternatives,
      entities,
      inferenceTimeMs: performance.now() - startTime,
    };
  }

  /**
   * TF-IDF vectorization matching scikit-learn's TfidfVectorizer.
   * Computes term frequency * inverse document frequency.
   */
  private tfidfVectorize(text: string): Float64Array {
    const model = this.modelData!;
    const maxFeatures = model.config.max_features;
    const vector = new Float64Array(maxFeatures);

    // Tokenize: split into words
    const words = text.match(/\b\w+\b/g) || [];

    // Generate unigrams and bigrams
    const tokens: string[] = [...words];
    if (model.config.ngram_range[1]! >= 2) {
      for (let i = 0; i < words.length - 1; i++) {
        tokens.push(`${words[i]} ${words[i + 1]}`);
      }
    }

    // Count term frequencies
    const termCounts = new Map<number, number>();
    for (const token of tokens) {
      const idx = this.vocabMap.get(token);
      if (idx !== undefined && idx < maxFeatures) {
        termCounts.set(idx, (termCounts.get(idx) || 0) + 1);
      }
    }

    // Compute TF-IDF with sublinear TF: tf = 1 + log(raw_tf)
    for (const [idx, count] of termCounts) {
      const tf = 1 + Math.log(count); // sublinear_tf=True
      const idf = model.idf_weights[idx] || 0;
      vector[idx] = tf * idf;
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i]! * vector[i]!;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = vector[i]! / norm;
      }
    }

    return vector;
  }

  /**
   * LinearSVC decision function: score = X · W^T + b
   */
  private decisionFunction(tfidf: Float64Array): number[] {
    const model = this.modelData!.model;
    const numClasses = model.coef.length;
    const scores: number[] = new Array(numClasses);

    for (let c = 0; c < numClasses; c++) {
      let score = model.intercept[c]!;
      const weights = model.coef[c]!;
      for (let f = 0; f < weights.length; f++) {
        score += tfidf[f]! * weights[f]!;
      }
      scores[c] = score;
    }

    return scores;
  }

  /**
   * Softmax: convert raw scores to probabilities
   */
  private softmax(scores: number[]): number[] {
    const maxScore = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - maxScore));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  }

  /**
   * Extract entities from the query text
   */
  private extractEntities(text: string): Record<string, string> {
    const entities: Record<string, string> = {};

    for (const [type, patterns] of Object.entries(ENTITY_PATTERNS)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          entities[type] = pattern;
          break; // Take first match per type
        }
      }
    }

    // Extract numbers
    const numbers = text.match(/\b\d+\b/g);
    if (numbers && numbers.length > 0) {
      entities.number = numbers[0];
    }

    return entities;
  }

  /**
   * Fallback classification using keyword matching
   */
  private fallbackClassify(query: string, startTime: number): IntentResult {
    const text = query.toLowerCase();

    // Simple keyword scoring
    const scores: Record<TrainedIntentType, number> = {
      WORKOUT_GENERATION: 0,
      FORM_CHECK: 0,
      DOCUMENT_SUMMARY: 0,
      DOCUMENT_QUESTION: 0,
      HEALTH_QUERY: 0,
      ACTIVITY_TRACKING: 0,
      GREETING: 0,
      FAREWELL: 0,
    };

    // Workout keywords
    if (/\b(create|build|make|generate|design|plan|suggest)\b/.test(text)) scores.WORKOUT_GENERATION += 3;
    if (/\b(workout|routine|program|session|exercise)\b/.test(text)) scores.WORKOUT_GENERATION += 2;

    // Form check keywords
    if (/\b(how do|form|technique|proper|correct|tips)\b/.test(text)) scores.FORM_CHECK += 3;
    if (/\b(squat|deadlift|bench|pushup|pullup)\b/.test(text)) scores.FORM_CHECK += 2;

    // Document keywords
    if (/\b(summarize|summary|tldr|key points|overview|recap)\b/.test(text)) scores.DOCUMENT_SUMMARY += 4;
    if (/\b(what does|explain|define|clarify|mean|understand)\b/.test(text)) scores.DOCUMENT_QUESTION += 3;

    // Health keywords
    if (/\b(calories|heart rate|sleep|bmi|weight|steps|recovery|health)\b/.test(text)) scores.HEALTH_QUERY += 3;

    // Activity tracking
    if (/\b(start|begin|track|log|record)\b/.test(text) && /\b(run|walk|jog|workout|exercise|tracking)\b/.test(text))
      scores.ACTIVITY_TRACKING += 3;

    // Greeting/farewell
    if (/^(hey|hello|hi|morning|evening|yo|sup|howdy|greetings)\b/.test(text)) scores.GREETING += 5;
    if (/\b(bye|goodbye|later|done|thanks.*bye|see you|signing off)\b/.test(text)) scores.FAREWELL += 5;

    // Find best
    const entries = Object.entries(scores) as [TrainedIntentType, number][];
    entries.sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;

    const intent = entries[0]![1] > 0 ? entries[0]![0] : 'GREETING';
    const confidence = entries[0]![1] / total;

    return {
      intent,
      confidence,
      handler: HANDLER_MAPPING[intent] || 'COACH',
      alternatives: entries.slice(1, 3).map(([i, s]) => ({
        intent: i,
        confidence: s / total,
      })),
      entities: this.extractEntities(text),
      inferenceTimeMs: performance.now() - startTime,
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  get loaded(): boolean {
    return this.isLoaded;
  }

  getModelInfo(): { loaded: boolean; vocabSize: number; numClasses: number; modelSize: string } {
    return {
      loaded: this.isLoaded,
      vocabSize: this.vocabMap.size,
      numClasses: this.modelData?.labels.length ?? 0,
      modelSize: '~305 KB',
    };
  }
}

// Convenience singleton
export const trainedIntentRouter = TrainedIntentRouter.getInstance();
