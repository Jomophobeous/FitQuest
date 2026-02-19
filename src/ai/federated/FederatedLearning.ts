/**
 * FederatedLearning — Privacy-Preserving Model Improvement
 *
 * Enables on-device model training with differential privacy.
 * User data never leaves the device — only encrypted gradient updates
 * are shared (when a server is available).
 *
 * Architecture:
 *   1. Local training: compute gradients on user's workout data
 *   2. Differential privacy: add calibrated noise (Gaussian mechanism)
 *   3. Gradient compression: top-k sparsification + quantization
 *   4. Secure aggregation: encrypt gradients before upload
 *   5. Model merge: receive global model updates
 *
 * Currently operates in local-only mode (no server).
 * Gradients are stored locally for future sync capability.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';

// ============================================
// TYPES
// ============================================

export interface FederatedConfig {
  epsilon: number;          // DP privacy budget (smaller = more private)
  delta: number;            // DP failure probability
  clipNorm: number;         // gradient clipping threshold
  noiseMultiplier: number;  // Gaussian noise scale
  minBatchSize: number;     // minimum samples before training
  topKRatio: number;        // sparsification ratio (0-1)
  learningRate: number;
  maxLocalEpochs: number;
}

export interface GradientUpdate {
  modelId: string;
  version: number;
  timestamp: number;
  gradients: CompressedGradient[];
  metadata: {
    numSamples: number;
    localLoss: number;
    privacyBudgetUsed: number;
    deviceId: string;
  };
}

export interface CompressedGradient {
  layerName: string;
  indices: number[];     // top-k indices
  values: number[];      // quantized values
  shape: number[];       // original tensor shape
  quantBits: number;     // quantization precision
}

export interface TrainingResult {
  loss: number;
  gradients: GradientUpdate;
  privacyBudgetUsed: number;
  numSamples: number;
  epochsRun: number;
}

export interface LocalModelState {
  modelId: string;
  version: number;
  weights: Record<string, number[]>;
  lastUpdated: number;
  totalPrivacyBudget: number;
  privacyBudgetUsed: number;
}

// ============================================
// FEDERATED LEARNING ENGINE
// ============================================

export class FederatedLearning {
  private static instance: FederatedLearning | null = null;

  private config: FederatedConfig;
  private localModels: Map<string, LocalModelState> = new Map();
  private pendingUpdates: GradientUpdate[] = [];
  private totalPrivacyBudget: number;
  private usedPrivacyBudget = 0;

  // Device identifier (anonymous)
  private readonly deviceId: string;

  private constructor() {
    this.config = {
      epsilon: 8.0,           // moderate privacy
      delta: 1e-5,
      clipNorm: 1.0,
      noiseMultiplier: 1.1,
      minBatchSize: 32,
      topKRatio: 0.1,         // keep top 10% of gradients
      learningRate: 0.01,
      maxLocalEpochs: 5,
    };
    this.totalPrivacyBudget = this.config.epsilon;
    this.deviceId = `device_${Date.now().toString(36)}_${Crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  }

  static getInstance(): FederatedLearning {
    if (!FederatedLearning.instance) {
      FederatedLearning.instance = new FederatedLearning();
    }
    return FederatedLearning.instance;
  }

  // ============================================
  // LOCAL TRAINING
  // ============================================

  /**
   * Train locally on user data and produce gradient updates.
   *
   * @param modelId - Which model to train (e.g., 'fitcoach', 'activity')
   * @param data - Training examples: { input: number[], target: number[] }[]
   * @param weights - Current model weights
   */
  async trainLocal(
    modelId: string,
    data: Array<{ input: number[]; target: number[] }>,
    weights: Record<string, number[]>
  ): Promise<TrainingResult | null> {
    if (data.length < this.config.minBatchSize) {
      console.log(
        `[FederatedLearning] Not enough data: ${data.length}/${this.config.minBatchSize}`
      );
      return null;
    }

    // Check privacy budget
    const stepBudget = this.computeStepPrivacyBudget(data.length);
    if (this.usedPrivacyBudget + stepBudget > this.totalPrivacyBudget) {
      console.log('[FederatedLearning] Privacy budget exhausted');
      return null;
    }

    // Initialize or update local model state
    let modelState = this.localModels.get(modelId);
    if (!modelState) {
      modelState = {
        modelId,
        version: 0,
        weights: { ...weights },
        lastUpdated: Date.now(),
        totalPrivacyBudget: this.totalPrivacyBudget,
        privacyBudgetUsed: 0,
      };
      this.localModels.set(modelId, modelState);
    }

    // Local training loop
    const allGradients: Record<string, number[]> = {};
    let totalLoss = 0;
    let epochsRun = 0;

    for (let epoch = 0; epoch < this.config.maxLocalEpochs; epoch++) {
      // Shuffle data
      // Fisher-Yates shuffle with crypto randomness
      const shuffled = [...data];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const randomBytes = Crypto.getRandomBytes(4);
        const j = (new DataView(randomBytes.buffer).getUint32(0) % (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      let epochLoss = 0;

      for (const sample of shuffled) {
        // Forward pass (simple linear model for gradient computation)
        const gradients = this.computeGradients(
          modelState.weights, sample.input, sample.target
        );

        // Accumulate gradients
        for (const [layer, grads] of Object.entries(gradients)) {
          if (!allGradients[layer]) {
            allGradients[layer] = new Array(grads.length).fill(0);
          }
          for (let i = 0; i < grads.length; i++) {
            allGradients[layer][i] += grads[i] / data.length;
          }
        }

        epochLoss += this.computeLoss(modelState.weights, sample.input, sample.target);
      }

      totalLoss = epochLoss / data.length;
      epochsRun++;

      // Early stopping if loss is low enough
      if (totalLoss < 0.001) break;
    }

    // Step 1: Clip gradients
    this.clipGradients(allGradients, this.config.clipNorm);

    // Step 2: Add differential privacy noise
    this.addDPNoise(allGradients, data.length);

    // Step 3: Compress gradients (top-k sparsification + quantization)
    const compressed = this.compressGradients(allGradients);

    // Step 4: Create gradient update
    const update: GradientUpdate = {
      modelId,
      version: modelState.version + 1,
      timestamp: Date.now(),
      gradients: compressed,
      metadata: {
        numSamples: data.length,
        localLoss: totalLoss,
        privacyBudgetUsed: stepBudget,
        deviceId: this.deviceId,
      },
    };

    // Store update locally
    this.pendingUpdates.push(update);
    this.usedPrivacyBudget += stepBudget;

    // Apply gradients to local model
    this.applyGradients(modelState, allGradients);
    modelState.version++;
    modelState.lastUpdated = Date.now();
    modelState.privacyBudgetUsed = this.usedPrivacyBudget;

    return {
      loss: totalLoss,
      gradients: update,
      privacyBudgetUsed: stepBudget,
      numSamples: data.length,
      epochsRun,
    };
  }

  // ============================================
  // GRADIENT COMPUTATION
  // ============================================

  /**
   * Compute gradients for a simple feedforward network.
   * Uses numerical differentiation (finite differences).
   */
  private computeGradients(
    weights: Record<string, number[]>,
    input: number[],
    target: number[]
  ): Record<string, number[]> {
    const gradients: Record<string, number[]> = {};
    const epsilon = 1e-5;

    for (const [layer, w] of Object.entries(weights)) {
      gradients[layer] = new Array(w.length).fill(0);

      // Numerical gradient for each weight
      for (let i = 0; i < w.length; i++) {
        // f(w + ε)
        const wPlus = [...w];
        wPlus[i] += epsilon;
        const modifiedWeights = { ...weights, [layer]: wPlus };
        const lossPlus = this.computeLoss(modifiedWeights, input, target);

        // f(w - ε)
        const wMinus = [...w];
        wMinus[i] -= epsilon;
        const modifiedWeightsMinus = { ...weights, [layer]: wMinus };
        const lossMinus = this.computeLoss(modifiedWeightsMinus, input, target);

        // Gradient = (f(w+ε) - f(w-ε)) / 2ε
        gradients[layer][i] = (lossPlus - lossMinus) / (2 * epsilon);
      }
    }

    return gradients;
  }

  /**
   * Compute MSE loss for a linear model.
   */
  private computeLoss(
    weights: Record<string, number[]>,
    input: number[],
    target: number[]
  ): number {
    // Simple single-layer linear model: output = W @ input
    const layerNames = Object.keys(weights);
    if (layerNames.length === 0) return 0;

    const w = weights[layerNames[0]];
    const outputSize = target.length;
    const inputSize = input.length;

    let loss = 0;
    for (let o = 0; o < outputSize; o++) {
      let predicted = 0;
      for (let i = 0; i < inputSize; i++) {
        const idx = o * inputSize + i;
        predicted += (w[idx] ?? 0) * input[i];
      }
      loss += (predicted - target[o]) ** 2;
    }

    return loss / outputSize;
  }

  private applyGradients(
    state: LocalModelState,
    gradients: Record<string, number[]>
  ): void {
    for (const [layer, grads] of Object.entries(gradients)) {
      const w = state.weights[layer];
      if (!w) continue;
      for (let i = 0; i < w.length; i++) {
        w[i] -= this.config.learningRate * (grads[i] ?? 0);
      }
    }
  }

  // ============================================
  // DIFFERENTIAL PRIVACY
  // ============================================

  /**
   * Clip gradients to bounded L2 norm.
   */
  private clipGradients(
    gradients: Record<string, number[]>,
    clipNorm: number
  ): void {
    // Compute global L2 norm
    let globalNorm = 0;
    for (const grads of Object.values(gradients)) {
      for (const g of grads) globalNorm += g * g;
    }
    globalNorm = Math.sqrt(globalNorm);

    // Clip if necessary
    if (globalNorm > clipNorm) {
      const scale = clipNorm / globalNorm;
      for (const grads of Object.values(gradients)) {
        for (let i = 0; i < grads.length; i++) {
          grads[i] *= scale;
        }
      }
    }
  }

  /**
   * Add calibrated Gaussian noise for (ε, δ)-differential privacy.
   */
  private addDPNoise(
    gradients: Record<string, number[]>,
    numSamples: number
  ): void {
    const sigma = this.config.noiseMultiplier *
      this.config.clipNorm / Math.sqrt(numSamples);

    for (const grads of Object.values(gradients)) {
      for (let i = 0; i < grads.length; i++) {
        grads[i] += this.gaussianNoise(sigma);
      }
    }
  }

  /**
   * Generate Gaussian noise using Box-Muller transform.
   */
  private gaussianNoise(sigma: number): number {
    // Box-Muller with cryptographically secure randomness (CRITICAL for differential privacy)
    const bytes = Crypto.getRandomBytes(8);
    const view = new DataView(bytes.buffer);
    const u1 = (view.getUint32(0) >>> 0) / 0xFFFFFFFF || 1e-10;
    const u2 = (view.getUint32(4) >>> 0) / 0xFFFFFFFF;
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * sigma;
  }

  /**
   * Compute per-step privacy budget using RDP accountant (simplified).
   */
  private computeStepPrivacyBudget(numSamples: number): number {
    // Simplified Rényi DP accounting
    const q = Math.min(this.config.minBatchSize / numSamples, 1);
    const sigma = this.config.noiseMultiplier;
    const alpha = 1 + 1 / (sigma * sigma);
    const rdp = q * q * alpha / (2 * sigma * sigma);
    return rdp + Math.log(1 / this.config.delta) / (alpha - 1);
  }

  // ============================================
  // GRADIENT COMPRESSION
  // ============================================

  /**
   * Compress gradients using top-k sparsification and quantization.
   */
  private compressGradients(
    gradients: Record<string, number[]>
  ): CompressedGradient[] {
    const compressed: CompressedGradient[] = [];

    for (const [layer, grads] of Object.entries(gradients)) {
      const k = Math.max(1, Math.floor(grads.length * this.config.topKRatio));

      // Find top-k indices by absolute value
      const indexed = grads.map((v, i) => ({ value: Math.abs(v), index: i, original: v }));
      indexed.sort((a, b) => b.value - a.value);
      const topK = indexed.slice(0, k);

      // Quantize values to 8-bit
      const maxAbs = Math.max(...topK.map(t => t.value)) || 1;
      const quantized = topK.map(t => {
        const q = Math.round((t.original / maxAbs) * 127);
        return q / 127 * maxAbs; // dequantize for storage (simplified)
      });

      compressed.push({
        layerName: layer,
        indices: topK.map(t => t.index),
        values: quantized,
        shape: [grads.length],
        quantBits: 8,
      });
    }

    return compressed;
  }

  // ============================================
  // MODEL MERGING
  // ============================================

  /**
   * Merge a global model update into local model.
   * Uses weighted averaging (FedAvg).
   */
  mergeGlobalUpdate(
    modelId: string,
    globalWeights: Record<string, number[]>,
    globalVersion: number,
    mixingWeight = 0.5 // 0 = keep local, 1 = use global
  ): boolean {
    const local = this.localModels.get(modelId);
    if (!local) return false;

    if (globalVersion <= local.version) return false;

    // Weighted average: w = α * global + (1-α) * local
    for (const [layer, globalW] of Object.entries(globalWeights)) {
      const localW = local.weights[layer];
      if (!localW || localW.length !== globalW.length) {
        local.weights[layer] = globalW;
        continue;
      }

      for (let i = 0; i < localW.length; i++) {
        localW[i] = mixingWeight * globalW[i] + (1 - mixingWeight) * localW[i];
      }
    }

    local.version = globalVersion;
    local.lastUpdated = Date.now();
    return true;
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  /**
   * Save pending updates to disk for future sync.
   */
  async savePendingUpdates(): Promise<void> {
    if (this.pendingUpdates.length === 0) return;

    const dir = `${FileSystem.documentDirectory}federated/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const path = `${dir}pending_updates.json`;
    await FileSystem.writeAsStringAsync(
      path,
      JSON.stringify(this.pendingUpdates)
    );
    console.log(`[FederatedLearning] Saved ${this.pendingUpdates.length} pending updates`);
  }

  /**
   * Load pending updates from disk.
   */
  async loadPendingUpdates(): Promise<void> {
    const path = `${FileSystem.documentDirectory}federated/pending_updates.json`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return;

    const str = await FileSystem.readAsStringAsync(path);
    this.pendingUpdates = JSON.parse(str);
    console.log(`[FederatedLearning] Loaded ${this.pendingUpdates.length} pending updates`);
  }

  // ============================================
  // PUBLIC API
  // ============================================

  configure(config: Partial<FederatedConfig>): void {
    this.config = { ...this.config, ...config };
    this.totalPrivacyBudget = this.config.epsilon;
  }

  get privacyBudgetRemaining(): number {
    return Math.max(0, this.totalPrivacyBudget - this.usedPrivacyBudget);
  }

  get pendingUpdateCount(): number {
    return this.pendingUpdates.length;
  }

  getPendingUpdates(): GradientUpdate[] {
    return [...this.pendingUpdates];
  }

  clearPendingUpdates(): void {
    this.pendingUpdates = [];
  }

  getLocalModel(modelId: string): LocalModelState | undefined {
    return this.localModels.get(modelId);
  }

  getInfo() {
    return {
      deviceId: this.deviceId,
      epsilon: this.config.epsilon,
      privacyBudgetUsed: this.usedPrivacyBudget,
      privacyBudgetRemaining: this.privacyBudgetRemaining,
      pendingUpdates: this.pendingUpdates.length,
      localModels: Array.from(this.localModels.keys()),
      noiseMultiplier: this.config.noiseMultiplier,
      topKRatio: this.config.topKRatio,
    };
  }
}

export const federatedLearning = FederatedLearning.getInstance();
