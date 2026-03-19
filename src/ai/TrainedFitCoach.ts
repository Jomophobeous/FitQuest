/**
 * TrainedFitCoach — On-device neural network for workout generation
 *
 * Loads the exported MLP model (weights as JSON) and generates
 * personalized workouts based on user profile, fatigue, and goals.
 *
 * Architecture: 37 input features → [256, 128, 64] hidden → 40 output features
 * Output encodes 8 exercise slots × 5 features each (exercise_id, sets, reps, rest, rpe)
 */

export interface UserProfile {
  experience: 'beginner' | 'intermediate' | 'advanced';
  goal: 'strength' | 'hypertrophy' | 'endurance' | 'fat_loss' | 'maintenance';
  availableTime: number; // minutes
  equipment: string[];
  fatigueMap: Record<string, number>; // 0-10
  targetGroup: string;
  injuries: string[];
}

export interface GeneratedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  restSeconds: number;
  rpeTarget: number;
  category: string;
  primaryMuscles: string[];
}

export interface GeneratedWorkout {
  exercises: GeneratedExercise[];
  totalDuration: number;
  targetGroup: string;
  isDeload: boolean;
  reasoning: string;
  inferenceTimeMs: number;
}

interface ExerciseInfo {
  name: string;
  primary: string[];
  secondary: string[];
  equipment: string[];
  difficulty: number;
  category: string;
}

interface MLPModelData {
  version: string;
  model_type: string;
  architecture: {
    hidden_layers: number[];
    activation: string;
    input_dim: number;
    output_dim: number;
  };
  weights: number[][][]; // Layer weights
  biases: number[][];    // Layer biases
  input_scaler: {
    mean: number[];
    scale: number[];
  };
  output_scaler: {
    mean: number[];
    scale: number[];
  };
  exercise_database: Record<string, ExerciseInfo>;
  exercise_list: string[];
  encoding: {
    equipment_order: string[];
    fatigue_muscles: string[];
    target_groups: string[];
    injury_types: string[];
    experience_levels: string[];
    goals: string[];
  };
}

export class TrainedFitCoach {
  private static instance: TrainedFitCoach | null = null;
  private model: MLPModelData | null = null;
  private isLoaded = false;

  private constructor() {}

  static getInstance(): TrainedFitCoach {
    if (!TrainedFitCoach.instance) {
      TrainedFitCoach.instance = new TrainedFitCoach();
    }
    return TrainedFitCoach.instance;
  }

  /**
   * Load the trained model from JSON asset.
   */
  async initialize(): Promise<boolean> {
    try {
      const modelJson = require('../../assets/models/fitcoach_model.json');
      this.model = modelJson as MLPModelData;
      this.isLoaded = true;
      if (__DEV__) console.log(`[TrainedFitCoach] Model loaded: ${this.model.architecture.hidden_layers.join('→')} architecture`);
      return true;
    } catch (error) {
      if (__DEV__) console.warn('[TrainedFitCoach] Failed to load model:', error);
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * Generate a workout from a user profile using the trained neural network.
   */
  generate(profile: UserProfile): GeneratedWorkout {
    const startTime = performance.now();

    if (!this.isLoaded || !this.model) {
      return this.fallbackGenerate(profile, startTime);
    }

    // Step 1: Encode profile to feature vector
    const input = this.encodeProfile(profile);

    // Step 2: Scale input
    const scaledInput = this.scaleInput(input);

    // Step 3: Forward pass through MLP
    const rawOutput = this.forward(scaledInput);

    // Step 4: Inverse scale output
    const output = this.inverseScaleOutput(rawOutput);

    // Step 5: Decode output to exercises
    const exercises = this.decodeOutput(output, profile);

    // Step 6: Post-process (validate, filter, adjust)
    const finalExercises = this.postProcess(exercises, profile);

    // Estimate duration
    let totalSeconds = 0;
    for (const ex of finalExercises) {
      totalSeconds += ex.sets * ex.reps * 3; // ~3s per rep
      totalSeconds += (ex.sets - 1) * ex.restSeconds;
    }
    totalSeconds += 600; // warmup + cooldown
    const duration = Math.min(Math.round(totalSeconds / 60), profile.availableTime);

    return {
      exercises: finalExercises,
      totalDuration: duration,
      targetGroup: profile.targetGroup,
      isDeload: Object.values(profile.fatigueMap).some(f => f > 8),
      reasoning: this.generateReasoning(profile, finalExercises),
      inferenceTimeMs: performance.now() - startTime,
    };
  }

  // ============================================
  // NEURAL NETWORK FORWARD PASS
  // ============================================

  /**
   * MLP forward pass: input → hidden layers → output
   */
  private forward(input: number[]): number[] {
    const model = this.model!;
    let current = input;

    for (let layer = 0; layer < model.weights.length; layer++) {
      const W = model.weights[layer]!;
      const b = model.biases[layer]!;
      const outputSize = b.length;
      const next = new Array(outputSize);

      // Matrix multiply: next = W^T · current + b
      for (let j = 0; j < outputSize; j++) {
        let sum = b[j]!;
        for (let i = 0; i < current.length; i++) {
          sum += current[i]! * W[i]![j]!;
        }
        next[j] = sum;
      }

      // Apply activation (ReLU for hidden layers, identity for output)
      if (layer < model.weights.length - 1) {
        for (let j = 0; j < outputSize; j++) {
          next[j] = Math.max(0, next[j]); // ReLU
        }
      }

      current = next;
    }

    return current;
  }

  // ============================================
  // ENCODING / DECODING
  // ============================================

  private encodeProfile(profile: UserProfile): number[] {
    const enc = this.model!.encoding;
    const vec: number[] = [];

    // Experience: one-hot [3]
    const expIdx = enc.experience_levels.indexOf(profile.experience);
    for (let i = 0; i < 3; i++) vec.push(i === expIdx ? 1 : 0);

    // Goal: one-hot [5]
    const goalIdx = enc.goals.indexOf(profile.goal);
    for (let i = 0; i < 5; i++) vec.push(i === goalIdx ? 1 : 0);

    // Time: normalized [1]
    vec.push(profile.availableTime / 120);

    // Equipment: multi-hot [8]
    for (const equip of enc.equipment_order) {
      vec.push(profile.equipment.includes(equip) ? 1 : 0);
    }

    // Fatigue: normalized [6]
    for (const muscle of enc.fatigue_muscles) {
      vec.push((profile.fatigueMap[muscle] || 0) / 10);
    }

    // Target group: one-hot [9]
    for (const group of enc.target_groups) {
      vec.push(group === profile.targetGroup ? 1 : 0);
    }

    // Injuries: multi-hot [5]
    for (const injury of enc.injury_types) {
      vec.push(profile.injuries.includes(injury) ? 1 : 0);
    }

    return vec;
  }

  private scaleInput(input: number[]): number[] {
    const { mean, scale } = this.model!.input_scaler;
    return input.map((v, i) => (v - (mean[i] ?? 0)) / (scale[i] || 1));
  }

  private inverseScaleOutput(output: number[]): number[] {
    const { mean, scale } = this.model!.output_scaler;
    return output.map((v, i) => v * (scale[i] || 1) + (mean[i] ?? 0));
  }

  private decodeOutput(output: number[], profile: UserProfile): GeneratedExercise[] {
    const model = this.model!;
    const exercises: GeneratedExercise[] = [];

    for (let i = 0; i < 8; i++) {
      const base = i * 5;
      const exIdxNorm = output[base]!;

      // Skip padding (negative or very small)
      if (exIdxNorm < 0) continue;

      // Find closest exercise
      const exIdx = Math.round(exIdxNorm * model.exercise_list.length);
      const clampedIdx = Math.max(0, Math.min(exIdx, model.exercise_list.length - 1));
      const exerciseId = model.exercise_list[clampedIdx]!;
      const exerciseInfo = model.exercise_database[exerciseId];

      if (!exerciseInfo) continue;

      // Check equipment compatibility
      const hasEquipment = exerciseInfo.equipment.some(
        (eq: string) => profile.equipment.includes(eq) || eq === 'bodyweight'
      );
      if (!hasEquipment) continue;

      exercises.push({
        exerciseId,
        exerciseName: exerciseInfo.name,
        sets: Math.max(2, Math.min(6, Math.round(output[base + 1]! * 10))),
        reps: Math.max(3, Math.min(30, Math.round(output[base + 2]! * 30))),
        restSeconds: Math.max(30, Math.min(300, Math.round(output[base + 3]! * 300))),
        rpeTarget: Math.max(5, Math.min(10, Math.round(output[base + 4]! * 10))),
        category: exerciseInfo.category,
        primaryMuscles: exerciseInfo.primary,
      });
    }

    return exercises;
  }

  // ============================================
  // POST-PROCESSING
  // ============================================

  private postProcess(exercises: GeneratedExercise[], profile: UserProfile): GeneratedExercise[] {
    // Remove duplicates
    const seen = new Set<string>();
    let filtered = exercises.filter(ex => {
      if (seen.has(ex.exerciseId)) return false;
      seen.add(ex.exerciseId);
      return true;
    });

    // Cap exercise count by time
    const maxExercises = profile.availableTime <= 30 ? 4 :
      profile.availableTime <= 45 ? 5 :
      profile.availableTime <= 60 ? 6 : 8;
    filtered = filtered.slice(0, maxExercises);

    // Ensure at least 2 exercises
    if (filtered.length < 2) {
      return this.fallbackGenerate(profile, performance.now()).exercises;
    }

    // Sort: compounds first, then isolations
    filtered.sort((a, b) => {
      if (a.category === 'compound' && b.category !== 'compound') return -1;
      if (a.category !== 'compound' && b.category === 'compound') return 1;
      return 0;
    });

    return filtered;
  }

  private generateReasoning(profile: UserProfile, exercises: GeneratedExercise[]): string {
    const reasons: string[] = [];

    const goalDescriptions: Record<string, string> = {
      strength: 'Heavy loads with longer rest periods maximize strength gains',
      hypertrophy: 'Moderate reps with controlled tempo optimize muscle growth',
      endurance: 'Higher rep ranges with shorter rest build muscular endurance',
      fat_loss: 'Circuit-style training maximizes metabolic demand',
      maintenance: 'Balanced volume maintains current fitness level',
    };
    reasons.push(goalDescriptions[profile.goal] || 'Balanced approach');

    const compoundCount = exercises.filter(e => e.category === 'compound').length;
    reasons.push(`${compoundCount} compound and ${exercises.length - compoundCount} isolation exercises selected`);

    const highFatigue = Object.entries(profile.fatigueMap)
      .filter(([, v]) => v > 6)
      .map(([k]) => k);
    if (highFatigue.length > 0) {
      reasons.push(`Adjusted volume for fatigued ${highFatigue.join(', ')}`);
    }

    return reasons.join('. ') + '.';
  }

  // ============================================
  // FALLBACK (rule-based)
  // ============================================

  private fallbackGenerate(profile: UserProfile, _startTime: number): GeneratedWorkout {
    // Minimal rule-based fallback if model fails to load
    const exercises: GeneratedExercise[] = [
      {
        exerciseId: 'pushup',
        exerciseName: 'Push-Up',
        sets: 3, reps: 12, restSeconds: 60, rpeTarget: 8,
        category: 'compound', primaryMuscles: ['chest'],
      },
      {
        exerciseId: 'squat',
        exerciseName: 'Bodyweight Squat',
        sets: 3, reps: 15, restSeconds: 60, rpeTarget: 7,
        category: 'compound', primaryMuscles: ['quadriceps', 'glutes'],
      },
      {
        exerciseId: 'plank',
        exerciseName: 'Plank',
        sets: 3, reps: 30, restSeconds: 45, rpeTarget: 7,
        category: 'isolation', primaryMuscles: ['core'],
      },
    ];

    return {
      exercises,
      totalDuration: 20,
      targetGroup: profile.targetGroup,
      isDeload: false,
      reasoning: 'Default bodyweight workout (model not loaded)',
      inferenceTimeMs: performance.now() - _startTime,
    };
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  getModelInfo() {
    return {
      loaded: this.isLoaded,
      architecture: this.model?.architecture?.hidden_layers?.join('→') ?? 'N/A',
      exerciseCount: this.model?.exercise_list?.length ?? 0,
      inputDim: this.model?.architecture?.input_dim ?? 0,
      outputDim: this.model?.architecture?.output_dim ?? 0,
    };
  }
}

export const trainedFitCoach = TrainedFitCoach.getInstance();
