/**
 * NeuralSummarizer — Extractive Document Summarization
 *
 * Produces summaries by scoring and selecting the most important sentences
 * from a document. Uses a transformer encoder to generate sentence embeddings,
 * then ranks by importance (centrality + position + coverage).
 *
 * On-device: Pure TypeScript forward pass through sentence encoder.
 * Fallback: TF-IDF based extractive summarization (no model needed).
 *
 * Model: summarizer_encoder.json (~5MB, downloadable on-demand)
 */

import { loadBundledModelWithFallback, safeRequire } from '../ModelLoader';

// ============================================
// TYPES
// ============================================

export interface SummaryResult {
  summary: string;
  sentences: ScoredSentence[];
  compressionRatio: number;
  modelType: 'neural' | 'tfidf';
  inferenceTimeMs: number;
}

export interface ScoredSentence {
  text: string;
  score: number;
  position: number;
  isSelected: boolean;
}

export interface SummarizationConfig {
  maxSentences?: number;         // max sentences in summary
  compressionRatio?: number;     // target length ratio (0-1), default 0.3
  minSentenceLength?: number;    // minimum words per sentence
  preserveOrder?: boolean;       // keep original order in summary
  focusQuery?: string;           // optional query-focused summarization
}

interface SentenceEncoderModel {
  version: string;
  vocabSize: number;
  hiddenSize: number;
  numHeads: number;
  numLayers: number;
  maxLength: number;
  vocabulary: Record<string, number>;
  // Embeddings
  wordEmbeddings: number[][];
  positionEmbeddings: number[][];
  // Transformer layers
  layers: TransformerLayer[];
  // Sentence pooling projection
  poolingWeight: number[][];
  poolingBias: number[];
  sentenceSize: number; // output embedding dimension
}

interface TransformerLayer {
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

// ============================================
// NEURAL SUMMARIZER
// ============================================

export class NeuralSummarizer {
  private static instance: NeuralSummarizer | null = null;
  private model: SentenceEncoderModel | null = null;
  private isLoaded = false;

  // TF-IDF state for fallback
  private idfCache: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): NeuralSummarizer {
    if (!NeuralSummarizer.instance) {
      NeuralSummarizer.instance = new NeuralSummarizer();
    }
    return NeuralSummarizer.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Try v3 model first (bundled ~12MB), then document directory fallback
      const modelData = await loadBundledModelWithFallback<SentenceEncoderModel>(
        safeRequire(() => require('../../../assets/models/summarizer_v3.model')),
        'summarizer_v3.model'
      );
      if (!modelData) {
        console.log('[NeuralSummarizer] Model not found — using TF-IDF fallback');
        return false;
      }
      this.model = modelData;

      this.isLoaded = true;
      const version = (this.model as any).version ?? '3.0.0';
      console.log(
        `[NeuralSummarizer] v${version}: ${this.model.numLayers} layers, ` +
        `hidden=${this.model.hiddenSize}, ` +
        `sentence_dim=${this.model.sentenceSize}`
      );
      return true;
    } catch (error) {
      console.warn('[NeuralSummarizer] Failed to load:', error);
      return false;
    }
  }

  /**
   * Summarize a document (extractive).
   */
  async summarize(
    text: string,
    config: SummarizationConfig = {}
  ): Promise<SummaryResult> {
    const startTime = performance.now();

    const {
      maxSentences = 5,
      compressionRatio = 0.3,
      minSentenceLength = 5,
      preserveOrder = true,
      focusQuery,
    } = config;

    // Split into sentences
    const sentences = this.splitSentences(text)
      .filter(s => this.wordCount(s) >= minSentenceLength);

    if (sentences.length === 0) {
      return {
        summary: '',
        sentences: [],
        compressionRatio: 0,
        modelType: this.isLoaded ? 'neural' : 'tfidf',
        inferenceTimeMs: performance.now() - startTime,
      };
    }

    // Target number of sentences
    const targetCount = Math.min(
      maxSentences,
      Math.max(1, Math.round(sentences.length * compressionRatio))
    );

    let scoredSentences: ScoredSentence[];

    if (this.isLoaded && this.model) {
      scoredSentences = this.neuralScore(sentences, focusQuery);
    } else {
      scoredSentences = this.tfidfScore(sentences, focusQuery);
    }

    // Select top sentences
    const ranked = [...scoredSentences].sort((a, b) => b.score - a.score);
    const selectedIndices = new Set(
      ranked.slice(0, targetCount).map(s => s.position)
    );

    for (const s of scoredSentences) {
      s.isSelected = selectedIndices.has(s.position);
    }

    // Build summary
    let selectedSentences: ScoredSentence[];
    if (preserveOrder) {
      selectedSentences = scoredSentences.filter(s => s.isSelected);
    } else {
      selectedSentences = ranked.slice(0, targetCount);
    }

    const summary = selectedSentences.map(s => s.text).join(' ');

    return {
      summary,
      sentences: scoredSentences,
      compressionRatio: summary.length / Math.max(1, text.length),
      modelType: this.isLoaded ? 'neural' : 'tfidf',
      inferenceTimeMs: performance.now() - startTime,
    };
  }

  // ============================================
  // NEURAL SCORING (transformer-based)
  // ============================================

  private neuralScore(
    sentences: string[],
    focusQuery?: string
  ): ScoredSentence[] {
    // Encode all sentences
    const embeddings = sentences.map(s => this.encodeSentence(s));

    // Compute document centroid
    const dim = embeddings[0].length;
    const centroid = new Float64Array(dim);
    for (const emb of embeddings) {
      for (let i = 0; i < dim; i++) centroid[i] += emb[i];
    }
    for (let i = 0; i < dim; i++) centroid[i] /= embeddings.length;

    // Optional: encode query
    let queryEmb: Float64Array | null = null;
    if (focusQuery) {
      queryEmb = this.encodeSentence(focusQuery);
    }

    // Score each sentence
    return sentences.map((text, position) => {
      const emb = embeddings[position];

      // Centrality score (cosine sim to centroid)
      const centrality = this.cosineSimilarity(emb, centroid);

      // Position score (earlier sentences weighted higher)
      const positionScore = 1 / (1 + position * 0.1);

      // Length penalty (prefer medium-length sentences)
      const words = this.wordCount(text);
      const lengthScore = Math.min(1, words / 20) * Math.min(1, 50 / Math.max(1, words));

      // Query relevance (if query provided)
      let queryScore = 0;
      if (queryEmb) {
        queryScore = this.cosineSimilarity(emb, queryEmb);
      }

      // Combine scores
      const score = queryEmb
        ? 0.3 * centrality + 0.1 * positionScore + 0.1 * lengthScore + 0.5 * queryScore
        : 0.5 * centrality + 0.3 * positionScore + 0.2 * lengthScore;

      return { text, score, position, isSelected: false };
    });
  }

  /**
   * Encode a sentence through the transformer encoder.
   * Returns a fixed-size sentence embedding.
   */
  private encodeSentence(text: string): Float64Array {
    const tokens = this.tokenize(text);
    const hiddenSize = this.model!.hiddenSize;

    // Word + position embeddings
    let hidden: Float64Array[] = tokens.map((tokenId, pos) => {
      const emb = new Float64Array(hiddenSize);
      const wordEmb = this.model!.wordEmbeddings[tokenId] ?? [];
      const posEmb = this.model!.positionEmbeddings[pos] ?? [];
      for (let h = 0; h < hiddenSize; h++) {
        emb[h] = (wordEmb[h] ?? 0) + (posEmb[h] ?? 0);
      }
      return emb;
    });

    // Run through transformer layers
    for (const layer of this.model!.layers) {
      hidden = this.transformerLayer(hidden, layer);
    }

    // Mean pooling
    const pooled = new Float64Array(hiddenSize);
    for (const h of hidden) {
      for (let i = 0; i < hiddenSize; i++) pooled[i] += h[i];
    }
    for (let i = 0; i < hiddenSize; i++) pooled[i] /= hidden.length;

    // Project to sentence space
    const sentSize = this.model!.sentenceSize;
    const sentence = new Float64Array(sentSize);
    for (let i = 0; i < sentSize; i++) {
      let sum = this.model!.poolingBias[i] ?? 0;
      const w = this.model!.poolingWeight[i];
      for (let j = 0; j < hiddenSize; j++) {
        sum += pooled[j] * (w?.[j] ?? 0);
      }
      sentence[i] = sum;
    }

    // L2 normalize
    let norm = 0;
    for (const v of sentence) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < sentSize; i++) sentence[i] /= norm;

    return sentence;
  }

  private transformerLayer(
    input: Float64Array[],
    layer: TransformerLayer
  ): Float64Array[] {
    const hidden = input[0].length;
    const numHeads = this.model!.numHeads;
    const headDim = Math.floor(hidden / numHeads);
    const seqLen = input.length;

    // Q, K, V
    const Q = input.map(h => this.linearF64(h, layer.queryWeight, layer.queryBias));
    const K = input.map(h => this.linearF64(h, layer.keyWeight, layer.keyBias));
    const V = input.map(h => this.linearF64(h, layer.valueWeight, layer.valueBias));

    // Multi-head self-attention
    const attnOut = new Array(seqLen).fill(null).map(() => new Float64Array(hidden));
    for (let head = 0; head < numHeads; head++) {
      const offset = head * headDim;
      const scale = Math.sqrt(headDim);

      for (let i = 0; i < seqLen; i++) {
        const scores = new Float64Array(seqLen);
        for (let j = 0; j < seqLen; j++) {
          let dot = 0;
          for (let d = 0; d < headDim; d++) {
            dot += Q[i][offset + d] * K[j][offset + d];
          }
          scores[j] = dot / scale;
        }

        const weights = this.softmaxF64(scores);
        for (let d = 0; d < headDim; d++) {
          let sum = 0;
          for (let j = 0; j < seqLen; j++) {
            sum += weights[j] * V[j][offset + d];
          }
          attnOut[i][offset + d] = sum;
        }
      }
    }

    // Project + residual + layer norm
    let output = attnOut.map((v, i) => {
      const proj = this.linearF64(v, layer.attOutputWeight, layer.attOutputBias);
      const res = new Float64Array(hidden);
      for (let h = 0; h < hidden; h++) res[h] = input[i][h] + proj[h];
      return this.layerNorm(res, layer.attLayerNormWeight, layer.attLayerNormBias);
    });

    // FFN + residual + layer norm
    output = output.map((v, i) => {
      const inter = this.linearF64(v, layer.ffnWeight, layer.ffnBias);
      const activated = new Float64Array(inter.length);
      for (let k = 0; k < inter.length; k++) activated[k] = this.gelu(inter[k]);
      const out = this.linearF64(activated, layer.ffnOutputWeight, layer.ffnOutputBias);
      const res = new Float64Array(hidden);
      for (let h = 0; h < hidden; h++) res[h] = v[h] + out[h];
      return this.layerNorm(res, layer.outputLayerNormWeight, layer.outputLayerNormBias);
    });

    return output;
  }

  // ============================================
  // TF-IDF FALLBACK
  // ============================================

  private tfidfScore(
    sentences: string[],
    focusQuery?: string
  ): ScoredSentence[] {
    // Build vocabulary and compute TF-IDF
    const allWords = new Set<string>();
    const sentenceWords = sentences.map(s => {
      const words = this.getWords(s);
      words.forEach(w => allWords.add(w));
      return words;
    });

    // Compute IDF
    const df: Record<string, number> = {};
    for (const words of sentenceWords) {
      const unique = new Set(words);
      for (const w of unique) {
        df[w] = (df[w] ?? 0) + 1;
      }
    }

    const n = sentences.length;
    const idf: Record<string, number> = {};
    for (const [word, count] of Object.entries(df)) {
      idf[word] = Math.log(n / count);
    }

    // TF-IDF vectors
    const tfidfVectors = sentenceWords.map(words => {
      const tf: Record<string, number> = {};
      for (const w of words) {
        tf[w] = (tf[w] ?? 0) + 1;
      }
      const vec: Record<string, number> = {};
      for (const [w, count] of Object.entries(tf)) {
        vec[w] = (count / words.length) * (idf[w] ?? 0);
      }
      return vec;
    });

    // Compute centroid
    const centroid: Record<string, number> = {};
    for (const vec of tfidfVectors) {
      for (const [w, v] of Object.entries(vec)) {
        centroid[w] = (centroid[w] ?? 0) + v;
      }
    }
    for (const w of Object.keys(centroid)) {
      centroid[w] /= n;
    }

    // Query vector (if provided)
    let queryVec: Record<string, number> | null = null;
    if (focusQuery) {
      const qWords = this.getWords(focusQuery);
      queryVec = {};
      const qtf: Record<string, number> = {};
      for (const w of qWords) qtf[w] = (qtf[w] ?? 0) + 1;
      for (const [w, count] of Object.entries(qtf)) {
        queryVec[w] = (count / qWords.length) * (idf[w] ?? 1);
      }
    }

    // Score
    return sentences.map((text, position) => {
      const vec = tfidfVectors[position];
      const centrality = this.cosineSimSparse(vec, centroid);
      const positionScore = 1 / (1 + position * 0.1);
      const words = this.wordCount(text);
      const lengthScore = Math.min(1, words / 20) * Math.min(1, 50 / Math.max(1, words));

      let queryScore = 0;
      if (queryVec) {
        queryScore = this.cosineSimSparse(vec, queryVec);
      }

      const score = queryVec
        ? 0.3 * centrality + 0.1 * positionScore + 0.1 * lengthScore + 0.5 * queryScore
        : 0.5 * centrality + 0.3 * positionScore + 0.2 * lengthScore;

      return { text, score, position, isSelected: false };
    });
  }

  // ============================================
  // TEXT PROCESSING
  // ============================================

  private splitSentences(text: string): string[] {
    // Split on sentence-ending punctuation
    return text
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private getWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1);
  }

  private wordCount(text: string): number {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  private tokenize(text: string): number[] {
    if (!this.model) return [];
    const words = text.toLowerCase().split(/\s+/).slice(0, this.model.maxLength);
    return words.map(w => this.model!.vocabulary[w] ?? 0); // 0 = UNK
  }

  // ============================================
  // SIMILARITY
  // ============================================

  private cosineSimilarity(a: Float64Array, b: Float64Array): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  private cosineSimSparse(
    a: Record<string, number>,
    b: Record<string, number>
  ): number {
    let dot = 0, normA = 0, normB = 0;
    for (const [w, v] of Object.entries(a)) {
      dot += v * (b[w] ?? 0);
      normA += v * v;
    }
    for (const v of Object.values(b)) normB += v * v;
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  // ============================================
  // MATH HELPERS
  // ============================================

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
      modelType: this.isLoaded ? 'neural' as const : 'tfidf' as const,
      numLayers: this.model?.numLayers ?? 0,
      hiddenSize: this.model?.hiddenSize ?? 0,
      sentenceSize: this.model?.sentenceSize ?? 0,
      vocabSize: this.model?.vocabSize ?? 0,
    };
  }
}

export const neuralSummarizer = NeuralSummarizer.getInstance();
