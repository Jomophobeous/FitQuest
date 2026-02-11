/**
 * TransformerFitCoach — Sequence-to-Sequence Workout Generator
 *
 * Upgrades from MLP to encoder-decoder transformer architecture.
 * Encoder: processes user profile into context embedding
 * Decoder: auto-regressively generates workout exercise sequence
 *
 * Model: fitcoach_transformer.json (~8MB, downloadable on-demand)
 * Architecture: 2-layer encoder + 2-layer decoder, hidden=256
 * Input: encoded user profile (experience, goal, fatigue, equipment)
 * Output: sequence of (exerciseId, sets, reps, rest, rpe) tuples
 */

import { loadBundledModelWithFallback, safeRequire } from '../ModelLoader';

// ============================================
// TYPES
// ============================================

export interface UserProfile {
  experience: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  goal: 'strength' | 'hypertrophy' | 'endurance' | 'fat_loss' | 'calisthenics';
  availableTimeMinutes: number;
  equipment: string[];
  fatigueMap: Record<string, number>; // muscle → 0-1 fatigue
  targetGroups: string[];
  injuries: string[];
  recentExerciseIds?: number[]; // for variety
}

export interface WorkoutExercise {
  exerciseId: number;
  exerciseName: string;
  sets: number;
  reps: number;
  restSeconds: number;
  rpe: number;
  targetMuscle: string;
  isCompound: boolean;
}

export interface GeneratedWorkout {
  exercises: WorkoutExercise[];
  totalDuration: number;
  estimatedCalories: number;
  difficulty: string;
  reasoning: string;
  isDeload: boolean;
  inferenceTimeMs: number;
  modelType: 'transformer' | 'legacy';
}

interface TransformerCoachModel {
  version: string;
  architecture: 'encoder-decoder';
  hiddenSize: number;
  numHeads: number;
  encoderLayers: number;
  decoderLayers: number;
  maxExercises: number;
  exerciseVocabSize: number;
  // Profile encoder
  profileProjectionWeight: number[][];
  profileProjectionBias: number[];
  // Encoder layers
  encoder: TransformerBlock[];
  // Decoder layers
  decoder: TransformerBlock[];
  // Exercise embedding
  exerciseEmbeddings: number[][]; // [vocabSize, hiddenSize]
  positionEmbeddings: number[][]; // [maxExercises, hiddenSize]
  // Output heads
  exerciseHead: { weight: number[][]; bias: number[] };
  setsHead: { weight: number[][]; bias: number[] };
  repsHead: { weight: number[][]; bias: number[] };
  restHead: { weight: number[][]; bias: number[] };
  rpeHead: { weight: number[][]; bias: number[] };
  doneHead: { weight: number[][]; bias: number[] };
  // Exercise database for decoding
  exerciseDatabase: ExerciseEntry[];
  // Scalers
  inputScaler: { mean: number[]; scale: number[] };
}

interface TransformerBlock {
  queryWeight: number[][];
  queryBias: number[];
  keyWeight: number[][];
  keyBias: number[];
  valueWeight: number[][];
  valueBias: number[];
  attOutputWeight: number[][];
  attOutputBias: number[];
  attLayerNormWeight: number[];
  attLayerNormBias: number[];
  ffnWeight: number[][];
  ffnBias: number[];
  ffnOutputWeight: number[][];
  ffnOutputBias: number[];
  outputLayerNormWeight: number[];
  outputLayerNormBias: number[];
}

interface ExerciseEntry {
  id: number;
  name: string;
  category: string;
  targetMuscle: string;
  isCompound: boolean;
  equipment: string[];
  difficulty: string;
  defaultSets: number;
  defaultReps: number;
  defaultRest: number;
  defaultRpe: number;
}

// ============================================
// PROFILE ENCODING
// ============================================

const EXPERIENCE_MAP: Record<string, number[]> = {
  beginner: [1, 0, 0, 0],
  intermediate: [0, 1, 0, 0],
  advanced: [0, 0, 1, 0],
  elite: [0, 0, 0, 1],
};

const GOAL_MAP: Record<string, number[]> = {
  strength: [1, 0, 0, 0, 0],
  hypertrophy: [0, 1, 0, 0, 0],
  endurance: [0, 0, 1, 0, 0],
  fat_loss: [0, 0, 0, 1, 0],
  calisthenics: [0, 0, 0, 0, 1],
};

const EQUIPMENT_LIST = [
  'barbell', 'dumbbell', 'kettlebell', 'pullup_bar',
  'bench', 'cables', 'bands', 'bodyweight',
];

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'core',
];

const INJURY_AREAS = [
  'shoulder', 'knee', 'lower_back', 'wrist', 'ankle',
];

// ============================================
// TRANSFORMER FITCOACH
// ============================================

export class TransformerFitCoach {
  private static instance: TransformerFitCoach | null = null;
  private model: TransformerCoachModel | null = null;
  private isLoaded = false;

  private constructor() {}

  static getInstance(): TransformerFitCoach {
    if (!TransformerFitCoach.instance) {
      TransformerFitCoach.instance = new TransformerFitCoach();
    }
    return TransformerFitCoach.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Try v3 model first, then v2 fallback
      let modelData = await loadBundledModelWithFallback<TransformerCoachModel>(
        safeRequire(() => require('../../../assets/models/fitcoach_v3.model')),
        'fitcoach_v3.model'
      );

      if (!modelData) {
        modelData = await loadBundledModelWithFallback<TransformerCoachModel>(
          safeRequire(() => require('../../../assets/models/fitcoach_transformer.model')),
          'fitcoach_transformer.model'
        );
      }

      if (!modelData) {
        console.log('[TransformerFitCoach] No model available');
        return false;
      }
      this.model = modelData;

      this.isLoaded = true;
      const version = (this.model as any).version ?? '2.0.0';
      console.log(
        `[TransformerFitCoach] v${version}: ${this.model.encoderLayers} enc + ` +
        `${this.model.decoderLayers} dec layers, ` +
        `hidden=${this.model.hiddenSize}, ` +
        `exercises=${this.model.exerciseVocabSize}`
      );
      return true;
    } catch (error) {
      console.warn('[TransformerFitCoach] Failed to load:', error);
      return false;
    }
  }

  /**
   * Generate a complete workout from user profile using auto-regressive decoding.
   */
  async generateWorkout(profile: UserProfile): Promise<GeneratedWorkout> {
    const startTime = performance.now();

    if (!this.isLoaded || !this.model) {
      return this.fallbackGenerate(profile, startTime);
    }

    try {
      // Step 1: Encode user profile
      const profileVector = this.encodeProfile(profile);
      const scaledProfile = this.scaleInput(profileVector);

      // Step 2: Project profile into hidden space
      const profileEmbedding = this.matVecMul(
        this.model.profileProjectionWeight,
        scaledProfile,
        this.model.profileProjectionBias
      );

      // Step 3: Run encoder
      let encoderOutput: Float64Array[] = [new Float64Array(profileEmbedding)];
      for (const layer of this.model.encoder) {
        encoderOutput = this.transformerBlock(
          encoderOutput, encoderOutput, layer, null
        ) as Float64Array[];
      }

      // Step 4: Auto-regressive decoding
      const maxExercises = this.getMaxExercises(profile.availableTimeMinutes);
      const exercises: WorkoutExercise[] = [];
      const generatedIds: number[] = [];

      for (let pos = 0; pos < maxExercises; pos++) {
        // Build decoder input from previously generated exercises
        const decoderInput = this.buildDecoderInput(generatedIds, pos);

        // Run decoder with cross-attention to encoder output
        let decoderOutput = decoderInput;
        for (const layer of this.model.decoder) {
          decoderOutput = this.transformerBlock(
            decoderOutput, encoderOutput, layer, null
          );
        }

        // Get output from last position
        const lastHidden = Array.from(decoderOutput[decoderOutput.length - 1]);

        // Predict exercise + parameters
        const exerciseLogits = this.matVecMulNum(
          this.model.exerciseHead.weight, lastHidden, this.model.exerciseHead.bias
        );
        const setsOut = this.matVecMulNum(
          this.model.setsHead.weight, lastHidden, this.model.setsHead.bias
        );
        const repsOut = this.matVecMulNum(
          this.model.repsHead.weight, lastHidden, this.model.repsHead.bias
        );
        const restOut = this.matVecMulNum(
          this.model.restHead.weight, lastHidden, this.model.restHead.bias
        );
        const rpeOut = this.matVecMulNum(
          this.model.rpeHead.weight, lastHidden, this.model.rpeHead.bias
        );
        const doneLogits = this.matVecMulNum(
          this.model.doneHead.weight, lastHidden, this.model.doneHead.bias
        );

        // Check if done
        const doneProbability = this.sigmoid(doneLogits[0]);
        if (doneProbability > 0.5 && exercises.length >= 2) break;

        // Select exercise (avoid duplicates)
        const exerciseId = this.selectExercise(
          exerciseLogits, generatedIds, profile
        );

        if (exerciseId < 0) break;

        const exerciseInfo = this.model.exerciseDatabase.find(e => e.id === exerciseId);
        if (!exerciseInfo) continue;

        // Decode parameters
        const sets = Math.max(1, Math.min(6, Math.round(this.sigmoid(setsOut[0]) * 5 + 1)));
        const reps = Math.max(1, Math.min(30, Math.round(this.sigmoid(repsOut[0]) * 29 + 1)));
        const restSeconds = Math.max(30, Math.min(300, Math.round(this.sigmoid(restOut[0]) * 270 + 30)));
        const rpe = Math.max(5, Math.min(10, Math.round(this.sigmoid(rpeOut[0]) * 5 + 5)));

        exercises.push({
          exerciseId,
          exerciseName: exerciseInfo.name,
          sets,
          reps,
          restSeconds,
          rpe,
          targetMuscle: exerciseInfo.targetMuscle,
          isCompound: exerciseInfo.isCompound,
        });

        generatedIds.push(exerciseId);
      }

      // Post-process
      const workout = this.postProcess(exercises, profile);

      return {
        ...workout,
        inferenceTimeMs: performance.now() - startTime,
        modelType: 'transformer',
      };
    } catch (error) {
      console.warn('[TransformerFitCoach] Inference error, using fallback:', error);
      return this.fallbackGenerate(profile, startTime);
    }
  }

  // ============================================
  // ENCODING
  // ============================================

  private encodeProfile(profile: UserProfile): number[] {
    const features: number[] = [];

    // Experience (4)
    features.push(...(EXPERIENCE_MAP[profile.experience] ?? [0, 1, 0, 0]));

    // Goal (5)
    features.push(...(GOAL_MAP[profile.goal] ?? [0, 1, 0, 0, 0]));

    // Time (1, normalized)
    features.push(profile.availableTimeMinutes / 90);

    // Equipment (8)
    for (const eq of EQUIPMENT_LIST) {
      features.push(profile.equipment.includes(eq) ? 1 : 0);
    }

    // Fatigue (9)
    for (const mg of MUSCLE_GROUPS) {
      features.push(profile.fatigueMap[mg] ?? 0);
    }

    // Target groups (9)
    for (const mg of MUSCLE_GROUPS) {
      features.push(profile.targetGroups.includes(mg) ? 1 : 0);
    }

    // Injuries (5)
    for (const inj of INJURY_AREAS) {
      features.push(profile.injuries.includes(inj) ? 1 : 0);
    }

    return features; // 41 features
  }

  private scaleInput(features: number[]): number[] {
    if (!this.model?.inputScaler) return features;
    return features.map((f, i) => {
      const mean = this.model!.inputScaler.mean[i] ?? 0;
      const scale = this.model!.inputScaler.scale[i] ?? 1;
      return (f - mean) / (scale || 1);
    });
  }

  private buildDecoderInput(
    previousIds: number[],
    currentPos: number
  ): Float64Array[] {
    const hidden = this.model!.hiddenSize;
    const inputs: Float64Array[] = [];

    // Start-of-sequence embedding
    if (previousIds.length === 0) {
      const startEmb = new Float64Array(hidden);
      // Use position 0 embedding
      const posEmb = this.model!.positionEmbeddings[0] ?? [];
      for (let h = 0; h < hidden; h++) {
        startEmb[h] = posEmb[h] ?? 0;
      }
      inputs.push(startEmb);
    } else {
      // Embed each previous exercise
      for (let i = 0; i < previousIds.length; i++) {
        const emb = new Float64Array(hidden);
        const exEmb = this.model!.exerciseEmbeddings[previousIds[i]] ?? [];
        const posEmb = this.model!.positionEmbeddings[i] ?? [];
        for (let h = 0; h < hidden; h++) {
          emb[h] = (exEmb[h] ?? 0) + (posEmb[h] ?? 0);
        }
        inputs.push(emb);
      }
    }

    return inputs;
  }

  // ============================================
  // TRANSFORMER OPERATIONS
  // ============================================

  private transformerBlock(
    query: Float64Array[],
    keyValue: Float64Array[],
    layer: TransformerBlock,
    _mask: Float64Array | null
  ): Float64Array[] {
    const hidden = query[0].length;
    const numHeads = this.model!.numHeads;
    const headDim = Math.floor(hidden / numHeads);
    const seqLen = query.length;
    const kvLen = keyValue.length;

    // Compute Q, K, V
    const Q = query.map(h => this.linearF64(h, layer.queryWeight, layer.queryBias));
    const K = keyValue.map(h => this.linearF64(h, layer.keyWeight, layer.keyBias));
    const V = keyValue.map(h => this.linearF64(h, layer.valueWeight, layer.valueBias));

    // Multi-head attention
    const attnOutput = new Array(seqLen).fill(null).map(() => new Float64Array(hidden));

    for (let head = 0; head < numHeads; head++) {
      const offset = head * headDim;
      const scale = Math.sqrt(headDim);

      for (let i = 0; i < seqLen; i++) {
        const scores = new Float64Array(kvLen);
        for (let j = 0; j < kvLen; j++) {
          let dot = 0;
          for (let d = 0; d < headDim; d++) {
            dot += Q[i][offset + d] * K[j][offset + d];
          }
          scores[j] = dot / scale;
        }

        const weights = this.softmaxF64(scores);

        for (let d = 0; d < headDim; d++) {
          let sum = 0;
          for (let j = 0; j < kvLen; j++) {
            sum += weights[j] * V[j][offset + d];
          }
          attnOutput[i][offset + d] = sum;
        }
      }
    }

    // Attention output projection + residual + layer norm
    const projected = attnOutput.map(v =>
      this.linearF64(v, layer.attOutputWeight, layer.attOutputBias)
    );

    let output = projected.map((v, i) => {
      const res = new Float64Array(hidden);
      for (let h = 0; h < hidden; h++) {
        res[h] = query[i][h] + v[h];
      }
      return this.layerNorm(res, layer.attLayerNormWeight, layer.attLayerNormBias);
    });

    // FFN + residual + layer norm
    const ffnOut = output.map(v => {
      const inter = this.linearF64(v, layer.ffnWeight, layer.ffnBias);
      const activated = inter.map(x => this.gelu(x));
      return this.linearF64(
        new Float64Array(activated),
        layer.ffnOutputWeight, layer.ffnOutputBias
      );
    });

    output = output.map((v, i) => {
      const res = new Float64Array(hidden);
      for (let h = 0; h < hidden; h++) {
        res[h] = v[h] + ffnOut[i][h];
      }
      return this.layerNorm(res, layer.outputLayerNormWeight, layer.outputLayerNormBias);
    });

    return output;
  }

  // ============================================
  // EXERCISE SELECTION
  // ============================================

  private selectExercise(
    logits: number[],
    alreadySelected: number[],
    profile: UserProfile
  ): number {
    // Apply temperature scaling
    const temperature = 0.7;
    const scaled = logits.map(l => l / temperature);

    // Mask already selected
    for (const id of alreadySelected) {
      if (id < scaled.length) scaled[id] = -1e9;
    }

    // Filter by equipment availability
    if (this.model?.exerciseDatabase) {
      for (const entry of this.model.exerciseDatabase) {
        if (entry.id < scaled.length) {
          const hasEquipment = entry.equipment.length === 0 ||
            entry.equipment.some(eq => profile.equipment.includes(eq));
          if (!hasEquipment) {
            scaled[entry.id] = -1e9;
          }

          // Penalize high-fatigue muscles
          const fatigue = profile.fatigueMap[entry.targetMuscle] ?? 0;
          if (fatigue > 0.8) {
            scaled[entry.id] -= 5;
          }
        }
      }
    }

    // Softmax and sample (or greedy)
    const probs = this.softmax(scaled);
    return probs.indexOf(Math.max(...probs));
  }

  private getMaxExercises(timeMinutes: number): number {
    if (timeMinutes <= 20) return 3;
    if (timeMinutes <= 30) return 4;
    if (timeMinutes <= 45) return 5;
    if (timeMinutes <= 60) return 6;
    return 8;
  }

  // ============================================
  // POST-PROCESSING
  // ============================================

  private postProcess(
    exercises: WorkoutExercise[],
    profile: UserProfile
  ): Omit<GeneratedWorkout, 'inferenceTimeMs' | 'modelType'> {
    // Sort: compounds first
    exercises.sort((a, b) => {
      if (a.isCompound && !b.isCompound) return -1;
      if (!a.isCompound && b.isCompound) return 1;
      return 0;
    });

    // Calculate total duration
    let totalMinutes = 0;
    for (const ex of exercises) {
      const exerciseTime = ex.sets * (0.5 + ex.reps * 0.05) + // work time
        (ex.sets - 1) * (ex.restSeconds / 60); // rest time
      totalMinutes += exerciseTime;
    }

    // Estimate calories (rough MET-based)
    const met = profile.goal === 'strength' ? 6 :
                profile.goal === 'hypertrophy' ? 5 :
                profile.goal === 'endurance' ? 4 :
                profile.goal === 'fat_loss' ? 7 : 5;
    const estimatedCalories = Math.round(met * 70 * (totalMinutes / 60));

    // Check for deload
    const avgFatigue = Object.values(profile.fatigueMap).reduce((a, b) => a + b, 0) /
      Math.max(1, Object.keys(profile.fatigueMap).length);
    const isDeload = avgFatigue > 0.7;

    return {
      exercises,
      totalDuration: Math.round(totalMinutes),
      estimatedCalories,
      difficulty: profile.experience,
      reasoning: `Generated ${exercises.length} exercises for ` +
        `${profile.goal} (${profile.availableTimeMinutes}min, ${profile.experience})` +
        (isDeload ? ' — DELOAD week detected' : ''),
      isDeload,
    };
  }

  // ============================================
  // FALLBACK (rule-based)
  // ============================================

  private fallbackGenerate(
    profile: UserProfile,
    startTime: number
  ): GeneratedWorkout {
    const exercises: WorkoutExercise[] = [];
    const maxEx = this.getMaxExercises(profile.availableTimeMinutes);

    // Basic exercise library
    const library: WorkoutExercise[] = [
      { exerciseId: 0, exerciseName: 'Push-ups', sets: 3, reps: 12, restSeconds: 60, rpe: 7, targetMuscle: 'chest', isCompound: true },
      { exerciseId: 1, exerciseName: 'Squats', sets: 3, reps: 15, restSeconds: 60, rpe: 7, targetMuscle: 'quads', isCompound: true },
      { exerciseId: 2, exerciseName: 'Plank', sets: 3, reps: 30, restSeconds: 45, rpe: 6, targetMuscle: 'core', isCompound: false },
      { exerciseId: 3, exerciseName: 'Lunges', sets: 3, reps: 10, restSeconds: 60, rpe: 7, targetMuscle: 'quads', isCompound: true },
      { exerciseId: 4, exerciseName: 'Rows', sets: 3, reps: 10, restSeconds: 60, rpe: 7, targetMuscle: 'back', isCompound: true },
      { exerciseId: 5, exerciseName: 'Shoulder Press', sets: 3, reps: 10, restSeconds: 60, rpe: 7, targetMuscle: 'shoulders', isCompound: true },
      { exerciseId: 6, exerciseName: 'Bicep Curls', sets: 3, reps: 12, restSeconds: 45, rpe: 6, targetMuscle: 'biceps', isCompound: false },
      { exerciseId: 7, exerciseName: 'Tricep Dips', sets: 3, reps: 10, restSeconds: 45, rpe: 7, targetMuscle: 'triceps', isCompound: false },
    ];

    // Select exercises targeting requested muscles
    const available = library.filter(ex =>
      profile.targetGroups.length === 0 ||
      profile.targetGroups.includes(ex.targetMuscle)
    );

    for (let i = 0; i < Math.min(maxEx, available.length); i++) {
      exercises.push({ ...available[i] });
    }

    return {
      ...this.postProcess(exercises, profile),
      inferenceTimeMs: performance.now() - startTime,
      modelType: 'legacy',
    };
  }

  // ============================================
  // MATH HELPERS
  // ============================================

  private matVecMul(
    matrix: number[][], vec: number[], bias: number[]
  ): number[] {
    const out = new Array(matrix.length).fill(0);
    for (let i = 0; i < matrix.length; i++) {
      let sum = bias[i] ?? 0;
      for (let j = 0; j < vec.length; j++) {
        sum += (matrix[i]?.[j] ?? 0) * vec[j];
      }
      out[i] = sum;
    }
    return out;
  }

  private matVecMulNum(
    matrix: number[][], vec: number[], bias: number[]
  ): number[] {
    return this.matVecMul(matrix, vec, bias);
  }

  private linearF64(
    input: Float64Array, weights: number[][], bias: number[]
  ): Float64Array {
    const output = new Float64Array(weights.length);
    for (let i = 0; i < weights.length; i++) {
      let sum = bias[i] ?? 0;
      const w = weights[i];
      for (let j = 0; j < input.length; j++) {
        sum += input[j] * (w?.[j] ?? 0);
      }
      output[i] = sum;
    }
    return output;
  }

  private layerNorm(
    input: Float64Array, weight: number[], bias: number[], eps = 1e-12
  ): Float64Array {
    const n = input.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += input[i];
    mean /= n;
    let variance = 0;
    for (let i = 0; i < n; i++) variance += (input[i] - mean) ** 2;
    variance /= n;
    const std = Math.sqrt(variance + eps);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = ((input[i] - mean) / std) * (weight[i] ?? 1) + (bias[i] ?? 0);
    }
    return out;
  }

  private gelu(x: number): number {
    return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
  }

  private softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exps = logits.map(l => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
  }

  private softmaxF64(logits: Float64Array): Float64Array {
    let max = -Infinity;
    for (const v of logits) if (v > max) max = v;
    const out = new Float64Array(logits.length);
    let sum = 0;
    for (let i = 0; i < logits.length; i++) {
      out[i] = Math.exp(logits[i] - max);
      sum += out[i];
    }
    for (let i = 0; i < logits.length; i++) out[i] /= sum;
    return out;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  get loaded(): boolean { return this.isLoaded; }

  getModelInfo() {
    return {
      loaded: this.isLoaded,
      modelType: 'transformer' as const,
      architecture: this.model?.architecture ?? 'encoder-decoder',
      encoderLayers: this.model?.encoderLayers ?? 0,
      decoderLayers: this.model?.decoderLayers ?? 0,
      hiddenSize: this.model?.hiddenSize ?? 0,
      exerciseVocab: this.model?.exerciseVocabSize ?? 0,
    };
  }
}

export const transformerFitCoach = TransformerFitCoach.getInstance();
