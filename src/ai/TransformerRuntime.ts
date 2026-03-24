/**
 * TransformerRuntime — Shared transformer primitives and forward-pass logic.
 *
 * Extracted from 4 duplicated implementations:
 *   - TransformerFitCoach (cross-attention decoder)
 *   - NeuralSummarizer (self-attention encoder)
 *   - SemanticSearch (self-attention encoder)
 *   - NeuralIntentRouter (self-attention with padding mask)
 *
 * All math operations are stateless pure functions.
 */

// ============================================
// TYPES
// ============================================

/**
 * Canonical transformer layer weight shape.
 * Uses short field names (attOutputWeight, etc.).
 * NeuralIntentRouter's long names can be mapped via normalizeLayerWeights().
 */
export interface TransformerLayerWeights {
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

export interface TransformerConfig {
  hiddenSize: number;
  numHeads: number;
}

export interface AttentionOptions {
  /** KV source if different from query (cross-attention). Default: self-attention */
  keyValue?: Float64Array[];
  /** Padding mask: 0 = masked, 1 = attend. Default: no masking */
  attentionMask?: Int32Array;
}

// ============================================
// PRIMITIVE OPS — stateless pure functions
// ============================================

/**
 * Matrix-vector multiply (Float64): out[i] = bias[i] + Σ_j(input[j] × weights[i][j])
 */
export function linearF64(input: Float64Array, weights: number[][], bias: number[]): Float64Array {
  const output = new Float64Array(weights.length);
  for (let i = 0; i < weights.length; i++) {
    let sum = bias[i] ?? 0;
    const w = weights[i]!;
    for (let j = 0; j < input.length; j++) {
      sum += input[j]! * (w[j] ?? 0);
    }
    output[i] = sum;
  }
  return output;
}

/**
 * Matrix-vector multiply (number[]): out[i] = bias[i] + Σ_j(input[j] × weights[i][j])
 */
export function linearNum(input: number[], weights: number[][], bias: number[]): number[] {
  const output = new Array(weights.length).fill(0);
  for (let i = 0; i < weights.length; i++) {
    let sum = bias[i] ?? 0;
    for (let j = 0; j < input.length; j++) {
      sum += input[j]! * (weights[i]?.[j] ?? 0);
    }
    output[i] = sum;
  }
  return output;
}

/**
 * Layer normalization: ((x - μ) / σ) × γ + β
 */
export function layerNorm(input: Float64Array, weight: number[], bias: number[], eps = 1e-12): Float64Array {
  const n = input.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += input[i]!;
  mean /= n;
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (input[i]! - mean) ** 2;
  variance /= n;
  const std = Math.sqrt(variance + eps);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = ((input[i]! - mean) / std) * (weight[i] ?? 1) + (bias[i] ?? 0);
  }
  return out;
}

/**
 * GELU activation: 0.5x(1 + tanh(√(2/π)(x + 0.044715x³)))
 */
export function gelu(x: number): number {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));
}

/**
 * Sigmoid with clamping to prevent overflow.
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

/**
 * Numerically-stable softmax over Float64Array.
 */
export function softmaxF64(logits: Float64Array): Float64Array {
  let max = -Infinity;
  for (const v of logits) if (v > max) max = v;
  const out = new Float64Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    out[i] = Math.exp(logits[i]! - max);
    sum += out[i]!;
  }
  for (let i = 0; i < logits.length; i++) out[i] = out[i]! / sum;
  return out;
}

/**
 * Numerically-stable softmax over number[].
 */
export function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * Cosine similarity between two Float64Array vectors.
 */
export function cosineSimilarityF64(a: Float64Array, b: Float64Array): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ============================================
// TRANSFORMER LAYER — the main shared logic
// ============================================

/**
 * Single transformer layer forward pass.
 * Supports self-attention (default), cross-attention (via options.keyValue),
 * and optional padding mask (via options.attentionMask).
 *
 * Pipeline:
 *   Q,K,V projection → multi-head attention → output proj + residual + LN
 *   → FFN (linear → GELU → linear) + residual + LN
 */
export function transformerLayer(
  input: Float64Array[],
  layer: TransformerLayerWeights,
  config: TransformerConfig,
  options?: AttentionOptions,
): Float64Array[] {
  const hidden = config.hiddenSize;
  const numHeads = config.numHeads;
  const headDim = Math.floor(hidden / numHeads);
  const seqLen = input.length;

  const kvSource = options?.keyValue ?? input;
  const kvLen = kvSource.length;
  const mask = options?.attentionMask;

  // --- Q, K, V projections ---
  const Q = input.map((h) => linearF64(h, layer.queryWeight, layer.queryBias));
  const K = kvSource.map((h) => linearF64(h, layer.keyWeight, layer.keyBias));
  const V = kvSource.map((h) => linearF64(h, layer.valueWeight, layer.valueBias));

  // --- Multi-head attention ---
  const attnOutput = new Array(seqLen).fill(null).map(() => new Float64Array(hidden));

  for (let head = 0; head < numHeads; head++) {
    const offset = head * headDim;
    const scale = Math.sqrt(headDim);

    for (let i = 0; i < seqLen; i++) {
      // Skip masked query positions
      if (mask && mask[i] === 0) continue;

      const scores = new Float64Array(kvLen);
      for (let j = 0; j < kvLen; j++) {
        if (mask && mask[j] === 0) {
          scores[j] = -1e9; // Mask padding
          continue;
        }
        let dot = 0;
        for (let d = 0; d < headDim; d++) {
          dot += Q[i]![offset + d]! * K[j]![offset + d]!;
        }
        scores[j] = dot / scale;
      }

      const weights = softmaxF64(scores);

      for (let d = 0; d < headDim; d++) {
        let sum = 0;
        for (let j = 0; j < kvLen; j++) {
          sum += weights[j]! * V[j]![offset + d]!;
        }
        attnOutput[i]![offset + d] = sum;
      }
    }
  }

  // --- Attention output projection + residual + LayerNorm ---
  const projected = attnOutput.map((v) => linearF64(v, layer.attOutputWeight, layer.attOutputBias));

  let output = projected.map((v, i) => {
    const res = new Float64Array(hidden);
    for (let h = 0; h < hidden; h++) {
      res[h] = input[i]![h]! + v[h]!;
    }
    return layerNorm(res, layer.attLayerNormWeight, layer.attLayerNormBias);
  });

  // --- FFN: linear → GELU → linear + residual + LayerNorm ---
  const ffnOut = output.map((v) => {
    const inter = linearF64(v, layer.ffnWeight, layer.ffnBias);
    const activated = new Float64Array(inter.length);
    for (let k = 0; k < inter.length; k++) activated[k] = gelu(inter[k]!);
    return linearF64(activated, layer.ffnOutputWeight, layer.ffnOutputBias);
  });

  output = output.map((v, i) => {
    const res = new Float64Array(hidden);
    for (let h = 0; h < hidden; h++) {
      res[h] = v[h]! + ffnOut[i]![h]!;
    }
    return layerNorm(res, layer.outputLayerNormWeight, layer.outputLayerNormBias);
  });

  return output;
}

// ============================================
// ADAPTER — normalize NeuralIntentRouter's field names
// ============================================

/**
 * Convert NeuralIntentRouter's long field names to canonical short names.
 * Maps: attentionOutputWeight → attOutputWeight, etc.
 */
export function normalizeLayerWeights(layer: Record<string, any>): TransformerLayerWeights {
  return {
    queryWeight: layer.queryWeight,
    queryBias: layer.queryBias,
    keyWeight: layer.keyWeight,
    keyBias: layer.keyBias,
    valueWeight: layer.valueWeight,
    valueBias: layer.valueBias,
    attOutputWeight: layer.attentionOutputWeight ?? layer.attOutputWeight,
    attOutputBias: layer.attentionOutputBias ?? layer.attOutputBias,
    attLayerNormWeight: layer.attentionLayerNormWeight ?? layer.attLayerNormWeight,
    attLayerNormBias: layer.attentionLayerNormBias ?? layer.attLayerNormBias,
    ffnWeight: layer.ffnWeight,
    ffnBias: layer.ffnBias,
    ffnOutputWeight: layer.ffnOutputWeight,
    ffnOutputBias: layer.ffnOutputBias,
    outputLayerNormWeight: layer.outputLayerNormWeight,
    outputLayerNormBias: layer.outputLayerNormBias,
  };
}
