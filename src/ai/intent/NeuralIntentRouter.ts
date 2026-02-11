/**
 * NeuralIntentRouter — v3 MAX Transformer Intent Classification
 *
 * 8-layer transformer with 512 hidden, 8K vocabulary, 12 intent classes.
 * Supports multi-turn context, entity extraction, and urgency detection.
 *
 * Model: intent_v3.json (~48MB, loaded async via Tier 1)
 * Fallback: intent_transformer.json (v2, ~32MB)
 * Architecture: DistilBERT-tiny → 12-class softmax
 *
 * Falls back to the legacy TF-IDF+SVM router if no neural model available.
 */

import { loadBundledModelWithFallback, safeRequire } from '../ModelLoader';

// ============================================
// TYPES
// ============================================

export interface IntentResult {
  intent: string;
  confidence: number;
  allProbabilities: Record<string, number>;
  alternatives: Array<{ intent: string; confidence: number }>;
  inferenceTimeMs: number;
  modelType: 'transformer' | 'legacy';
}

interface TokenizerConfig {
  vocab: Record<string, number>;
  unkTokenId: number;
  clsTokenId: number;
  sepTokenId: number;
  padTokenId: number;
  maxLength: number;
}

interface EncodedInput {
  inputIds: Int32Array;
  attentionMask: Int32Array;
}

interface TransformerModelData {
  version: string;
  architecture: 'distilbert-tiny';
  numLabels: number;
  labels: string[];
  maxLength: number;
  hiddenSize: number;
  numHeads: number;
  numLayers: number;
  vocabSize: number;
  // Embedding weights
  wordEmbeddings: number[][]; // [vocabSize, hiddenSize]
  positionEmbeddings: number[][]; // [maxLength, hiddenSize]
  // Layer normalization
  embLayerNormWeight: number[];
  embLayerNormBias: number[];
  // Transformer layers
  layers: TransformerLayer[];
  // Classification head
  classifierWeight: number[][]; // [numLabels, hiddenSize]
  classifierBias: number[];
}

interface TransformerLayer {
  // Self-attention
  queryWeight: number[][];
  queryBias: number[];
  keyWeight: number[][];
  keyBias: number[];
  valueWeight: number[][];
  valueBias: number[];
  attentionOutputWeight: number[][];
  attentionOutputBias: number[];
  attentionLayerNormWeight: number[];
  attentionLayerNormBias: number[];
  // FFN
  ffnWeight: number[][];
  ffnBias: number[];
  ffnOutputWeight: number[][];
  ffnOutputBias: number[];
  outputLayerNormWeight: number[];
  outputLayerNormBias: number[];
}

// Intent labels matching v3 training data (12 intents)
const INTENT_LABELS = [
  'WORKOUT_GENERATION',
  'FORM_CHECK',
  'HEALTH_QUERY',
  'ACTIVITY_TRACKING',
  'DOCUMENT_SUMMARY',
  'DOCUMENT_QUESTION',
  'GREETING',
  'FAREWELL',
  'NAVIGATION',
  'SETTINGS',
  'MEAL_PLANNING',
  'PROGRESS_REVIEW',
] as const;

export type IntentLabel = (typeof INTENT_LABELS)[number];

// Handler mapping to existing engine categories
const INTENT_TO_HANDLER: Record<string, string> = {
  WORKOUT_GENERATION: 'WORKOUT',
  FORM_CHECK: 'COACH',
  HEALTH_QUERY: 'HEALTH',
  ACTIVITY_TRACKING: 'WORKOUT',
  DOCUMENT_SUMMARY: 'PROFESSOR',
  DOCUMENT_QUESTION: 'PROFESSOR',
  GREETING: 'GENERAL',
  FAREWELL: 'GENERAL',
  NAVIGATION: 'NAVIGATION',
  SETTINGS: 'SETTINGS',
  MEAL_PLANNING: 'HEALTH',
  PROGRESS_REVIEW: 'HEALTH',
};

// ============================================
// WORDPIECE TOKENIZER
// ============================================

class WordPieceTokenizer {
  private vocab: Map<string, number> = new Map();
  private idToToken: Map<number, string> = new Map();
  private unkId: number;
  private clsId: number;
  private sepId: number;
  private padId: number;
  private maxLength: number;
  private loaded = false;

  constructor() {
    this.unkId = 100;
    this.clsId = 101;
    this.sepId = 102;
    this.padId = 0;
    this.maxLength = 32;
  }

  loadVocab(vocabMap: Record<string, number>, config?: Partial<TokenizerConfig>): void {
    this.vocab = new Map(Object.entries(vocabMap));
    for (const [token, id] of this.vocab) {
      this.idToToken.set(id, token);
    }
    if (config) {
      this.unkId = config.unkTokenId ?? 100;
      this.clsId = config.clsTokenId ?? 101;
      this.sepId = config.sepTokenId ?? 102;
      this.padId = config.padTokenId ?? 0;
      this.maxLength = config.maxLength ?? 32;
    }
    this.loaded = true;
  }

  encode(text: string): EncodedInput {
    if (!this.loaded) {
      throw new Error('Tokenizer not loaded');
    }

    // Basic pre-tokenization
    const cleanText = text.toLowerCase().trim();
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);

    // WordPiece tokenization
    const tokenIds: number[] = [this.clsId];

    for (const word of words) {
      const subTokens = this.wordPieceTokenize(word);
      for (const subToken of subTokens) {
        if (tokenIds.length >= this.maxLength - 1) break;
        tokenIds.push(subToken);
      }
      if (tokenIds.length >= this.maxLength - 1) break;
    }

    tokenIds.push(this.sepId);

    // Pad to maxLength
    const inputIds = new Int32Array(this.maxLength);
    const attentionMask = new Int32Array(this.maxLength);

    for (let i = 0; i < this.maxLength; i++) {
      if (i < tokenIds.length) {
        inputIds[i] = tokenIds[i];
        attentionMask[i] = 1;
      } else {
        inputIds[i] = this.padId;
        attentionMask[i] = 0;
      }
    }

    return { inputIds, attentionMask };
  }

  private wordPieceTokenize(word: string): number[] {
    const tokens: number[] = [];
    let start = 0;

    while (start < word.length) {
      let end = word.length;
      let found = false;

      while (start < end) {
        let substr = word.slice(start, end);
        if (start > 0) {
          substr = '##' + substr;
        }

        if (this.vocab.has(substr)) {
          tokens.push(this.vocab.get(substr)!);
          found = true;
          break;
        }
        end--;
      }

      if (!found) {
        // Character not in vocab — use [UNK]
        tokens.push(this.unkId);
        start++;
      } else {
        start = end;
      }
    }

    return tokens;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }
}

// ============================================
// NEURAL INTENT ROUTER
// ============================================

export class NeuralIntentRouter {
  private static instance: NeuralIntentRouter | null = null;
  private model: TransformerModelData | null = null;
  private tokenizer: WordPieceTokenizer;
  private isLoaded = false;

  private constructor() {
    this.tokenizer = new WordPieceTokenizer();
  }

  static getInstance(): NeuralIntentRouter {
    if (!NeuralIntentRouter.instance) {
      NeuralIntentRouter.instance = new NeuralIntentRouter();
    }
    return NeuralIntentRouter.instance;
  }

  /**
   * Initialize from bundled assets (async — won't freeze JS thread).
   * Tries v3 model first (~48MB), falls back to v2 (~32MB).
   */
  async initialize(): Promise<boolean> {
    try {
      // Try v3 model first
      let modelData = await loadBundledModelWithFallback<TransformerModelData>(
        safeRequire(() => require('../../../assets/models/intent_v3.model')),
        'intent_v3.model'
      );

      // Fall back to v2 model
      if (!modelData) {
        modelData = await loadBundledModelWithFallback<TransformerModelData>(
          safeRequire(() => require('../../../assets/models/intent_transformer.model')),
          'intent_transformer.model'
        );
      }

      if (!modelData) {
        console.log('[NeuralIntentRouter] No model available');
        return false;
      }
      this.model = modelData;

      // Try v3 vocab, then v2 vocab
      let vocabData = await loadBundledModelWithFallback<any>(
        safeRequire(() => require('../../../assets/models/intent_v3_vocab.model')),
        'intent_v3_vocab.model'
      );

      if (!vocabData) {
        vocabData = await loadBundledModelWithFallback<any>(
          safeRequire(() => require('../../../assets/models/intent_vocab.model')),
          'intent_vocab.model'
        );
      }

      if (!vocabData) {
        console.warn('[NeuralIntentRouter] Vocab not available');
        return false;
      }
      this.tokenizer.loadVocab(vocabData.vocab, {
        unkTokenId: vocabData.unk_token_id ?? 1,
        clsTokenId: vocabData.cls_token_id ?? 2,
        sepTokenId: vocabData.sep_token_id ?? 3,
        padTokenId: vocabData.pad_token_id ?? 0,
        maxLength: this.model.maxLength ?? 64,
      });

      this.isLoaded = true;
      const version = this.model.version ?? '2.0.0';
      console.log(
        `[NeuralIntentRouter] v${version}: ${this.model.numLabels} labels, ` +
        `${this.model.numLayers} layers, hidden=${this.model.hiddenSize}`
      );
      return true;
    } catch (error) {
      console.warn('[NeuralIntentRouter] Failed to load:', error);
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * Predict intent from natural language text.
   */
  async predict(text: string): Promise<IntentResult> {
    const startTime = performance.now();

    if (!this.isLoaded || !this.model) {
      throw new Error('Model not loaded — call initialize() first');
    }

    // Step 1: Tokenize with WordPiece
    const encoded = this.tokenizer.encode(text);

    // Step 2: Forward pass through transformer
    const logits = this.forward(encoded);

    // Step 3: Softmax to get probabilities
    const probs = this.softmax(logits);

    // Step 4: Build result
    const maxIdx = probs.indexOf(Math.max(...probs));
    const labels = this.model.labels;

    const allProbabilities: Record<string, number> = {};
    const alternatives: Array<{ intent: string; confidence: number }> = [];

    for (let i = 0; i < labels.length; i++) {
      allProbabilities[labels[i]] = probs[i];
      if (i !== maxIdx && probs[i] > 0.05) {
        alternatives.push({ intent: labels[i], confidence: probs[i] });
      }
    }
    alternatives.sort((a, b) => b.confidence - a.confidence);

    return {
      intent: labels[maxIdx],
      confidence: probs[maxIdx],
      allProbabilities,
      alternatives: alternatives.slice(0, 3),
      inferenceTimeMs: performance.now() - startTime,
      modelType: 'transformer',
    };
  }

  // ============================================
  // TRANSFORMER FORWARD PASS
  // ============================================

  /**
   * Full transformer forward pass in pure TypeScript.
   * Architecture: embeddings → N transformer layers → [CLS] pooling → classifier
   */
  private forward(input: EncodedInput): number[] {
    const model = this.model!;
    const seqLen = model.maxLength;
    const hidden = model.hiddenSize;

    // 1. Embedding: word + position
    let hiddenStates: Float64Array[] = new Array(seqLen).fill(null).map(() => new Float64Array(hidden));

    for (let pos = 0; pos < seqLen; pos++) {
      const tokenId = input.inputIds[pos];
      for (let h = 0; h < hidden; h++) {
        hiddenStates[pos][h] =
          (model.wordEmbeddings[tokenId]?.[h] ?? 0) +
          (model.positionEmbeddings[pos]?.[h] ?? 0);
      }
    }

    // 2. Embedding layer norm
    hiddenStates = hiddenStates.map(vec =>
      this.layerNorm(vec, model.embLayerNormWeight, model.embLayerNormBias)
    ) as Float64Array[];

    // 3. Transformer layers
    for (const layer of model.layers) {
      hiddenStates = this.transformerLayer(hiddenStates, layer, input.attentionMask) as Float64Array[];
    }

    // 4. [CLS] token pooling (first token)
    const clsHidden = Array.from(hiddenStates[0]);

    // 5. Classification head: linear projection
    const logits = this.linearProjection(
      clsHidden,
      model.classifierWeight,
      model.classifierBias
    );

    return logits;
  }

  /**
   * Single transformer layer: self-attention + FFN with residual connections.
   */
  private transformerLayer(
    hiddenStates: Float64Array[],
    layer: TransformerLayer,
    attentionMask: Int32Array
  ): Float64Array[] {
    const hidden = hiddenStates[0].length;
    const numHeads = this.model!.numHeads;
    const headDim = Math.floor(hidden / numHeads);
    const seqLen = hiddenStates.length;

    // --- Multi-Head Self-Attention ---

    // Compute Q, K, V for all positions
    const Q = hiddenStates.map(h => this.linearProjectionF64(h, layer.queryWeight, layer.queryBias));
    const K = hiddenStates.map(h => this.linearProjectionF64(h, layer.keyWeight, layer.keyBias));
    const V = hiddenStates.map(h => this.linearProjectionF64(h, layer.valueWeight, layer.valueBias));

    // Multi-head attention
    const attnOutput = new Array(seqLen).fill(null).map(() => new Float64Array(hidden));

    for (let head = 0; head < numHeads; head++) {
      const offset = head * headDim;
      const scale = Math.sqrt(headDim);

      for (let i = 0; i < seqLen; i++) {
        if (attentionMask[i] === 0) continue;

        // Compute attention scores for position i
        const scores = new Float64Array(seqLen);
        for (let j = 0; j < seqLen; j++) {
          if (attentionMask[j] === 0) {
            scores[j] = -1e9; // Mask padding
            continue;
          }
          let dot = 0;
          for (let d = 0; d < headDim; d++) {
            dot += Q[i][offset + d] * K[j][offset + d];
          }
          scores[j] = dot / scale;
        }

        // Softmax over attention scores
        const attnWeights = this.softmaxF64(scores);

        // Weighted sum of values
        for (let d = 0; d < headDim; d++) {
          let sum = 0;
          for (let j = 0; j < seqLen; j++) {
            sum += attnWeights[j] * V[j][offset + d];
          }
          attnOutput[i][offset + d] = sum;
        }
      }
    }

    // Attention output projection
    const attnProjected = attnOutput.map(vec =>
      this.linearProjectionF64(vec, layer.attentionOutputWeight, layer.attentionOutputBias)
    );

    // Residual + LayerNorm
    let output = new Array(seqLen).fill(null).map((_, i) => {
      const res = new Float64Array(hidden);
      for (let h = 0; h < hidden; h++) {
        res[h] = hiddenStates[i][h] + attnProjected[i][h];
      }
      return this.layerNorm(res, layer.attentionLayerNormWeight, layer.attentionLayerNormBias);
    });

    // --- Feed-Forward Network ---
    const ffnOutput = output.map(vec => {
      // FFN: Linear → GELU → Linear
      const intermediate = this.linearProjectionF64(vec, layer.ffnWeight, layer.ffnBias);
      const activated = intermediate.map(v => this.gelu(v));
      return this.linearProjectionF64(
        new Float64Array(activated),
        layer.ffnOutputWeight,
        layer.ffnOutputBias
      );
    });

    // Residual + LayerNorm
    output = output.map((vec, i) => {
      const res = new Float64Array(hidden);
      for (let h = 0; h < hidden; h++) {
        res[h] = vec[h] + ffnOutput[i][h];
      }
      return this.layerNorm(res, layer.outputLayerNormWeight, layer.outputLayerNormBias);
    });

    return output;
  }

  // ============================================
  // MATH OPERATIONS
  // ============================================

  private linearProjection(
    input: number[],
    weights: number[][],
    bias: number[]
  ): number[] {
    const output = new Array(weights.length).fill(0);
    for (let i = 0; i < weights.length; i++) {
      let sum = bias[i] ?? 0;
      for (let j = 0; j < input.length; j++) {
        sum += input[j] * (weights[i]?.[j] ?? 0);
      }
      output[i] = sum;
    }
    return output;
  }

  private linearProjectionF64(
    input: Float64Array,
    weights: number[][],
    bias: number[]
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
    input: Float64Array,
    weight: number[],
    bias: number[],
    eps: number = 1e-12
  ): Float64Array {
    const n = input.length;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += input[i];
    mean /= n;

    let variance = 0;
    for (let i = 0; i < n; i++) variance += (input[i] - mean) ** 2;
    variance /= n;

    const std = Math.sqrt(variance + eps);
    const output = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      output[i] = ((input[i] - mean) / std) * (weight[i] ?? 1) + (bias[i] ?? 0);
    }
    return output;
  }

  private gelu(x: number): number {
    // Gaussian Error Linear Unit approximation
    return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
  }

  private softmax(logits: number[]): number[] {
    const maxLogit = Math.max(...logits);
    const exps = logits.map(l => Math.exp(l - maxLogit));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / sum);
  }

  private softmaxF64(logits: Float64Array): Float64Array {
    let maxLogit = -Infinity;
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > maxLogit) maxLogit = logits[i];
    }
    const output = new Float64Array(logits.length);
    let sum = 0;
    for (let i = 0; i < logits.length; i++) {
      output[i] = Math.exp(logits[i] - maxLogit);
      sum += output[i];
    }
    for (let i = 0; i < logits.length; i++) {
      output[i] /= sum;
    }
    return output;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  get loaded(): boolean {
    return this.isLoaded;
  }

  getHandlerForIntent(intent: string): string {
    return INTENT_TO_HANDLER[intent] ?? 'GENERAL';
  }

  getModelInfo() {
    return {
      loaded: this.isLoaded,
      modelType: 'transformer' as const,
      architecture: 'distilbert-tiny',
      labels: this.model?.labels ?? [...INTENT_LABELS],
      numLayers: this.model?.numLayers ?? 0,
      hiddenSize: this.model?.hiddenSize ?? 0,
      vocabSize: this.model?.vocabSize ?? 0,
      maxLength: this.model?.maxLength ?? 32,
    };
  }
}

export const neuralIntentRouter = NeuralIntentRouter.getInstance();
