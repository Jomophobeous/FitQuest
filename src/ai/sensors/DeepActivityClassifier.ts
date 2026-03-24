/**
 * DeepActivityClassifier — CNN-LSTM Activity Recognition
 *
 * Upgrades from RandomForest to CNN-LSTM architecture for IMU data.
 * CNN: extracts local temporal patterns from accelerometer + gyroscope windows
 * LSTM: captures temporal dependencies across sliding windows
 *
 * Model: activity_cnn_lstm.json (~2MB, downloadable on-demand)
 * Input: 128-sample IMU window (6 channels: ax,ay,az,gx,gy,gz) at 10Hz = 12.8s
 * Output: activity class + confidence + cadence estimate
 */

import { loadBundledModelWithFallback, safeRequire } from '../ModelLoader';

// ============================================
// TYPES
// ============================================

export type ActivityClass =
  | 'STATIONARY'
  | 'WALKING'
  | 'RUNNING'
  | 'CYCLING'
  | 'EXERCISE'
  | 'CLIMBING_STAIRS'
  | 'DESCENDING_STAIRS'
  | 'JUMPING'
  | 'UNKNOWN';

export interface ClassificationResult {
  activity: ActivityClass;
  confidence: number;
  allProbabilities: Record<ActivityClass, number>;
  cadenceRpm: number | null;
  intensityLevel: 'low' | 'moderate' | 'vigorous';
  inferenceTimeMs: number;
  modelType: 'cnn-lstm' | 'legacy';
}

interface CNNLSTMModel {
  version: string;
  architecture: 'cnn-lstm';
  windowSize: number; // 128
  channels: number; // 6
  numClasses: number; // 9
  classLabels: ActivityClass[];
  // CNN layers
  conv1Filters: number[][][]; // [numFilters, kernelSize, channels]
  conv1Bias: number[];
  conv2Filters: number[][][]; // [numFilters, kernelSize, prevFilters]
  conv2Bias: number[];
  // Batch normalization
  bn1Gamma: number[];
  bn1Beta: number[];
  bn1Mean: number[];
  bn1Var: number[];
  bn2Gamma: number[];
  bn2Beta: number[];
  bn2Mean: number[];
  bn2Var: number[];
  // LSTM
  lstmInputWeight: number[][]; // [4*hidden, input]
  lstmHiddenWeight: number[][]; // [4*hidden, hidden]
  lstmBias: number[]; // [4*hidden]
  lstmHiddenSize: number;
  // Classification head
  fcWeight: number[][];
  fcBias: number[];
  // Temperature scaling
  temperature: number;
  // Input normalization
  inputMean: number[]; // per-channel mean [6]
  inputStd: number[]; // per-channel std [6]
}

// ============================================
// CNN-LSTM ACTIVITY CLASSIFIER
// ============================================

export class DeepActivityClassifier {
  private static instance: DeepActivityClassifier | null = null;
  private model: CNNLSTMModel | null = null;
  private isLoaded = false;

  // Sliding window buffer
  private sensorBuffer: number[][] = [];
  private readonly WINDOW_SIZE = 128;
  private readonly HOP_SIZE = 32; // 75% overlap
  private sampleCount = 0;

  private constructor() {}

  static getInstance(): DeepActivityClassifier {
    if (!DeepActivityClassifier.instance) {
      DeepActivityClassifier.instance = new DeepActivityClassifier();
    }
    return DeepActivityClassifier.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Try v3 model first, then v2 fallback
      let modelData = await loadBundledModelWithFallback<CNNLSTMModel>(
        safeRequire(() => require('../../../assets/models/activity_v3.model')),
        'activity_v3.model',
      );

      if (!modelData) {
        modelData = await loadBundledModelWithFallback<CNNLSTMModel>(
          safeRequire(() => require('../../../assets/models/activity_cnn_lstm.model')),
          'activity_cnn_lstm.model',
        );
      }

      if (!modelData) {
        if (__DEV__) console.log('[DeepActivityClassifier] No model available');
        return false;
      }
      this.model = modelData;

      this.isLoaded = true;
      const version = (this.model as any).version ?? '2.0.0';
      if (__DEV__) {
        console.log(
          `[DeepActivityClassifier] v${version}: CNN-LSTM, ` +
            `window=${this.model.windowSize}, ` +
            `classes=${this.model.numClasses}, ` +
            `LSTM hidden=${this.model.lstmHiddenSize}`,
        );
      }
      return true;
    } catch (error) {
      if (__DEV__) console.warn('[DeepActivityClassifier] Failed to load:', error);
      return false;
    }
  }

  /**
   * Feed a single IMU sample [ax, ay, az, gx, gy, gz] into the buffer.
   * Returns a classification when the window is full.
   */
  addSample(sample: number[]): ClassificationResult | null {
    if (sample.length < 6) return null;

    this.sensorBuffer.push(sample.slice(0, 6));
    this.sampleCount++;

    // Classify on hop boundaries when we have enough data
    if (this.sensorBuffer.length >= this.WINDOW_SIZE && this.sampleCount % this.HOP_SIZE === 0) {
      const window = this.sensorBuffer.slice(-this.WINDOW_SIZE);
      return this.classifyWindow(window);
    }

    // Keep buffer bounded
    if (this.sensorBuffer.length > this.WINDOW_SIZE * 2) {
      this.sensorBuffer = this.sensorBuffer.slice(-this.WINDOW_SIZE);
    }

    return null;
  }

  /**
   * Classify a complete window of IMU data.
   * window: [WINDOW_SIZE][6] — ax,ay,az,gx,gy,gz
   */
  classifyWindow(window: number[][]): ClassificationResult {
    const startTime = performance.now();

    if (!this.isLoaded || !this.model) {
      return this.fallbackClassify(window, startTime);
    }

    try {
      // Step 1: Normalize input
      const normalized = this.normalizeInput(window);

      // Step 2: CNN feature extraction
      const features = this.cnnForward(normalized);

      // Step 3: LSTM sequence processing
      const lstmOut = this.lstmForward(features);

      // Step 4: Classification head
      const logits = this.matVecMul(this.model.fcWeight, lstmOut, this.model.fcBias);

      // Step 5: Temperature-scaled softmax
      const temperature = this.model.temperature || 1.0;
      const scaled = logits.map((l) => l / temperature);
      const probs = this.softmax(scaled);

      // Find best class
      let maxProb = 0;
      let bestIdx = 0;
      for (let i = 0; i < probs.length; i++) {
        if (probs[i]! > maxProb) {
          maxProb = probs[i]!;
          bestIdx = i;
        }
      }

      const labels = this.model.classLabels;
      const activity = labels[bestIdx] ?? 'UNKNOWN';

      // Build probability map
      const allProbabilities: Record<ActivityClass, number> = {} as any;
      for (let i = 0; i < labels.length; i++) {
        allProbabilities[labels[i]!] = probs[i]!;
      }

      // Estimate cadence from accelerometer
      const cadence = this.estimateCadence(window, activity);

      return {
        activity,
        confidence: maxProb,
        allProbabilities,
        cadenceRpm: cadence,
        intensityLevel: this.getIntensity(activity, maxProb, cadence),
        inferenceTimeMs: performance.now() - startTime,
        modelType: 'cnn-lstm',
      };
    } catch (error) {
      if (__DEV__) console.warn('[DeepActivityClassifier] Inference error:', error);
      return this.fallbackClassify(window, startTime);
    }
  }

  // ============================================
  // CNN FORWARD PASS
  // ============================================

  private normalizeInput(window: number[][]): number[][] {
    if (!this.model) return window;
    return window.map((sample) =>
      sample.map((val, ch) => {
        const mean = this.model!.inputMean[ch] ?? 0;
        const std = this.model!.inputStd[ch] ?? 1;
        return (val - mean) / (std || 1);
      }),
    );
  }

  /**
   * 1D CNN: two conv layers with batch norm, ReLU, max pooling.
   * Input: [windowSize, channels]
   * Output: sequence of feature vectors for LSTM
   */
  private cnnForward(input: number[][]): number[][] {
    // Conv1: [windowSize, channels] → [windowSize, numFilters1]
    let x = this.conv1d(input, this.model!.conv1Filters, this.model!.conv1Bias);
    x = this.batchNorm1d(x, this.model!.bn1Gamma, this.model!.bn1Beta, this.model!.bn1Mean, this.model!.bn1Var);
    x = x.map((row) => row.map((v) => Math.max(0, v))); // ReLU
    x = this.maxPool1d(x, 2); // → [windowSize/2, numFilters1]

    // Conv2: [windowSize/2, numFilters1] → [windowSize/2, numFilters2]
    x = this.conv1d(x, this.model!.conv2Filters, this.model!.conv2Bias);
    x = this.batchNorm1d(x, this.model!.bn2Gamma, this.model!.bn2Beta, this.model!.bn2Mean, this.model!.bn2Var);
    x = x.map((row) => row.map((v) => Math.max(0, v))); // ReLU
    x = this.maxPool1d(x, 2); // → [windowSize/4, numFilters2]

    return x;
  }

  /**
   * 1D Convolution: convolves filters across the time axis.
   * input: [seqLen, inChannels]
   * filters: [numFilters, kernelSize, inChannels]
   * bias: [numFilters]
   * output: [seqLen, numFilters] (same padding)
   */
  private conv1d(input: number[][], filters: number[][][], bias: number[]): number[][] {
    const seqLen = input.length;
    const numFilters = filters.length;
    const kernelSize = filters[0]?.length ?? 3;
    const pad = Math.floor(kernelSize / 2);

    const output: number[][] = [];

    for (let t = 0; t < seqLen; t++) {
      const row = new Array(numFilters).fill(0);
      for (let f = 0; f < numFilters; f++) {
        let sum = bias[f] ?? 0;
        for (let k = 0; k < kernelSize; k++) {
          const idx = t + k - pad;
          if (idx >= 0 && idx < seqLen) {
            const inputRow = input[idx]!;
            const filterRow = filters[f]![k];
            for (let c = 0; c < inputRow.length; c++) {
              sum += inputRow[c]! * (filterRow?.[c] ?? 0);
            }
          }
        }
        row[f] = sum;
      }
      output.push(row);
    }

    return output;
  }

  /**
   * Batch normalization: y = gamma * (x - mean) / sqrt(var + eps) + beta
   */
  private batchNorm1d(
    input: number[][],
    gamma: number[],
    beta: number[],
    mean: number[],
    variance: number[],
    eps = 1e-5,
  ): number[][] {
    return input.map((row) =>
      row.map((val, ch) => {
        const normalized = (val - (mean[ch] ?? 0)) / Math.sqrt((variance[ch] ?? 1) + eps);
        return (gamma[ch] ?? 1) * normalized + (beta[ch] ?? 0);
      }),
    );
  }

  /**
   * 1D Max Pooling: reduces sequence length by poolSize.
   */
  private maxPool1d(input: number[][], poolSize: number): number[][] {
    const output: number[][] = [];
    const channels = input[0]?.length ?? 0;

    for (let i = 0; i < input.length; i += poolSize) {
      const pooled = new Array(channels).fill(-Infinity);
      for (let j = 0; j < poolSize && i + j < input.length; j++) {
        for (let c = 0; c < channels; c++) {
          pooled[c] = Math.max(pooled[c], input[i + j]?.[c] ?? 0);
        }
      }
      output.push(pooled);
    }

    return output;
  }

  // ============================================
  // LSTM FORWARD PASS
  // ============================================

  /**
   * Single-layer LSTM processing CNN output sequence.
   * Returns the final hidden state.
   */
  private lstmForward(sequence: number[][]): number[] {
    const hiddenSize = this.model!.lstmHiddenSize;
    let h = new Float64Array(hiddenSize); // hidden state
    let c = new Float64Array(hiddenSize); // cell state

    for (const x of sequence) {
      const inputVec = new Float64Array(x);

      // gates = W_ih @ x + W_hh @ h + bias
      // gates layout: [input_gate, forget_gate, cell_gate, output_gate]
      const gates = new Float64Array(4 * hiddenSize);

      // Input contribution: W_ih @ x
      for (let i = 0; i < 4 * hiddenSize; i++) {
        let sum = this.model!.lstmBias[i] ?? 0;
        const wRow = this.model!.lstmInputWeight[i];
        for (let j = 0; j < inputVec.length; j++) {
          sum += inputVec[j]! * (wRow?.[j] ?? 0);
        }
        gates[i] = sum;
      }

      // Hidden contribution: W_hh @ h
      for (let i = 0; i < 4 * hiddenSize; i++) {
        const wRow = this.model!.lstmHiddenWeight[i];
        for (let j = 0; j < hiddenSize; j++) {
          gates[i] = (gates[i] ?? 0) + h[j]! * (wRow?.[j] ?? 0);
        }
      }

      // Apply gate activations
      const newH = new Float64Array(hiddenSize);
      const newC = new Float64Array(hiddenSize);

      for (let i = 0; i < hiddenSize; i++) {
        const inputGate = this.sigmoidF64(gates[i]!);
        const forgetGate = this.sigmoidF64(gates[hiddenSize + i]!);
        const cellGate = Math.tanh(gates[2 * hiddenSize + i]!);
        const outputGate = this.sigmoidF64(gates[3 * hiddenSize + i]!);

        newC[i] = forgetGate * c[i]! + inputGate * cellGate;
        newH[i] = outputGate * Math.tanh(newC[i]!);
      }

      h = newH;
      c = newC;
    }

    return Array.from(h);
  }

  // ============================================
  // CADENCE ESTIMATION (FFT-based)
  // ============================================

  /**
   * Estimate cadence (steps/strides per minute) using FFT on accelerometer magnitude.
   */
  private estimateCadence(window: number[][], activity: ActivityClass): number | null {
    if (activity === 'STATIONARY' || activity === 'UNKNOWN') return null;

    // Compute accelerometer magnitude
    const magnitudes = window.map((s) => Math.sqrt(s[0]! ** 2 + s[1]! ** 2 + s[2]! ** 2));

    // Remove DC component (mean)
    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const centered = magnitudes.map((m) => m - mean);

    // Simple FFT via DFT (window is small enough: 128 points)
    const n = centered.length;
    const sampleRate = 10; // 10 Hz
    const freqResolution = sampleRate / n;

    // Only compute relevant frequency bins (0.5-4 Hz for human movement)
    const minBin = Math.ceil(0.5 / freqResolution);
    const maxBin = Math.floor(4.0 / freqResolution);

    let maxPower = 0;
    let peakBin = minBin;

    for (let k = minBin; k <= maxBin; k++) {
      let real = 0,
        imag = 0;
      for (let t = 0; t < n; t++) {
        const angle = (2 * Math.PI * k * t) / n;
        real += centered[t]! * Math.cos(angle);
        imag -= centered[t]! * Math.sin(angle);
      }
      const power = real * real + imag * imag;
      if (power > maxPower) {
        maxPower = power;
        peakBin = k;
      }
    }

    // Convert peak frequency to cadence
    const peakFreq = peakBin * freqResolution;
    let cadenceRpm = peakFreq * 60;

    // Adjust for activity type
    if (activity === 'WALKING') {
      // Walking: ~90-130 steps/min
      cadenceRpm = Math.max(60, Math.min(160, cadenceRpm));
    } else if (activity === 'RUNNING') {
      // Running: ~150-200 steps/min
      cadenceRpm = Math.max(130, Math.min(220, cadenceRpm));
    } else if (activity === 'CYCLING') {
      // Cycling: ~60-120 RPM
      cadenceRpm = Math.max(40, Math.min(140, cadenceRpm));
    }

    return Math.round(cadenceRpm);
  }

  // ============================================
  // INTENSITY CLASSIFICATION
  // ============================================

  private getIntensity(
    activity: ActivityClass,
    confidence: number,
    cadence: number | null,
  ): 'low' | 'moderate' | 'vigorous' {
    if (activity === 'STATIONARY' || activity === 'UNKNOWN') return 'low';

    if (activity === 'RUNNING' || activity === 'JUMPING') return 'vigorous';

    if (activity === 'WALKING') {
      if (cadence && cadence > 120) return 'moderate';
      return 'low';
    }

    if (activity === 'CLIMBING_STAIRS') return 'moderate';

    if (activity === 'EXERCISE') {
      return confidence > 0.8 ? 'vigorous' : 'moderate';
    }

    return 'moderate';
  }

  // ============================================
  // FALLBACK CLASSIFIER
  // ============================================

  private fallbackClassify(window: number[][], startTime: number): ClassificationResult {
    // Simple threshold-based classification
    const magnitudes = window.map((s) => Math.sqrt(s[0]! ** 2 + s[1]! ** 2 + s[2]! ** 2));

    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const variance = magnitudes.reduce((a, b) => a + (b - mean) ** 2, 0) / magnitudes.length;
    const std = Math.sqrt(variance);

    let activity: ActivityClass;
    let confidence: number;

    if (std < 0.3) {
      activity = 'STATIONARY';
      confidence = 0.9;
    } else if (std < 1.5) {
      activity = 'WALKING';
      confidence = 0.7;
    } else if (std < 3.0) {
      activity = 'RUNNING';
      confidence = 0.6;
    } else {
      activity = 'EXERCISE';
      confidence = 0.5;
    }

    const allProbabilities: Record<ActivityClass, number> = {
      STATIONARY: 0,
      WALKING: 0,
      RUNNING: 0,
      CYCLING: 0,
      EXERCISE: 0,
      CLIMBING_STAIRS: 0,
      DESCENDING_STAIRS: 0,
      JUMPING: 0,
      UNKNOWN: 0,
    };
    allProbabilities[activity] = confidence;
    allProbabilities.UNKNOWN = 1 - confidence;

    return {
      activity,
      confidence,
      allProbabilities,
      cadenceRpm: this.estimateCadence(window, activity),
      intensityLevel: this.getIntensity(activity, confidence, null),
      inferenceTimeMs: performance.now() - startTime,
      modelType: 'legacy',
    };
  }

  // ============================================
  // MATH HELPERS
  // ============================================

  private matVecMul(matrix: number[][], vec: number[], bias: number[]): number[] {
    const out = new Array(matrix.length).fill(0);
    for (let i = 0; i < matrix.length; i++) {
      let sum = bias[i] ?? 0;
      for (let j = 0; j < vec.length; j++) {
        sum += (matrix[i]?.[j] ?? 0) * vec[j]!;
      }
      out[i] = sum;
    }
    return out;
  }

  private softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  }

  private sigmoidF64(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
  }

  // ============================================
  // PUBLIC API
  // ============================================

  get loaded(): boolean {
    return this.isLoaded;
  }

  resetBuffer(): void {
    this.sensorBuffer = [];
    this.sampleCount = 0;
  }

  getModelInfo() {
    return {
      loaded: this.isLoaded,
      modelType: 'cnn-lstm' as const,
      windowSize: this.model?.windowSize ?? 128,
      numClasses: this.model?.numClasses ?? 9,
      lstmHidden: this.model?.lstmHiddenSize ?? 0,
      bufferSize: this.sensorBuffer.length,
    };
  }
}

export const deepActivityClassifier = DeepActivityClassifier.getInstance();
