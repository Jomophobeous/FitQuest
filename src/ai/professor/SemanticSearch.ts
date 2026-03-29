/**
 * SemanticSearch — Dense Retrieval with HNSW Index
 *
 * Provides semantic similarity search over FitMind document library.
 * Encodes documents and queries into dense vectors, then performs
 * approximate nearest neighbor search using an in-memory HNSW graph.
 *
 * Architecture:
 *   1. Sentence encoder (shared with NeuralSummarizer or standalone MiniLM)
 *   2. HNSW index for fast ANN search
 *   3. Optional cross-encoder re-ranking for top-K precision
 *
 * Fallback: TF-IDF bag-of-words retrieval (no model needed).
 */

import { loadBundledModelWithFallback, safeRequire } from '../ModelLoader';
import {
  TransformerLayerWeights as TransformerLayer,
  transformerLayer as sharedTransformerLayer,
} from '../TransformerRuntime';

// ============================================
// TYPES
// ============================================

export interface SearchResult {
  documentId: string;
  chunkId: string;
  text: string;
  score: number;
  highlight?: string;
}

export interface SearchConfig {
  topK?: number; // default 5
  minScore?: number; // minimum similarity threshold (0-1)
  rerank?: boolean; // apply cross-encoder re-ranking
  documentFilter?: string[]; // restrict to document IDs
}

interface IndexedChunk {
  id: string;
  documentId: string;
  text: string;
  embedding: Float32Array;
}

interface SentenceEncoderModel {
  version: string;
  hiddenSize: number;
  numHeads: number;
  numLayers: number;
  maxLength: number;
  sentenceSize: number;
  vocabulary: Record<string, number>;
  wordEmbeddings: number[][];
  positionEmbeddings: number[][];
  layers: TransformerLayer[];
  poolingWeight: number[][];
  poolingBias: number[];
}

// TransformerLayer imported from TransformerRuntime as TransformerLayerWeights

// ============================================
// HNSW INDEX
// ============================================

interface HNSWNode {
  id: number;
  level: number;
  connections: number[][]; // connections per level
}

class HNSWIndex {
  private nodes: HNSWNode[] = [];
  private vectors: Float32Array[] = [];
  private readonly M: number; // max connections per node
  private readonly efConstruction: number;
  private readonly mL: number; // level generation factor
  private maxLevel = 0;
  private entryPoint = -1;

  constructor(M = 16, efConstruction = 200) {
    this.M = M;
    this.efConstruction = efConstruction;
    this.mL = 1 / Math.log(M);
  }

  /**
   * Add a vector to the index.
   */
  add(vector: Float32Array): number {
    const id = this.nodes.length;
    const level = this.randomLevel();

    const node: HNSWNode = {
      id,
      level,
      connections: Array.from({ length: level + 1 }, () => []),
    };

    this.vectors.push(vector);
    this.nodes.push(node);

    if (this.nodes.length === 1) {
      this.entryPoint = 0;
      this.maxLevel = level;
      return id;
    }

    // Find entry point and traverse from top
    let currentNode = this.entryPoint;

    // Traverse higher levels (greedy)
    for (let lev = this.maxLevel; lev > level; lev--) {
      currentNode = this.greedySearch(vector, currentNode, lev);
    }

    // Insert at each level
    for (let lev = Math.min(level, this.maxLevel); lev >= 0; lev--) {
      const neighbors = this.searchLevel(vector, currentNode, this.efConstruction, lev);
      const selected = this.selectNeighbors(vector, neighbors, this.M);

      node.connections[lev] = selected;

      // Bidirectional connections
      for (const neighborId of selected) {
        const neighbor = this.nodes[neighborId];
        if (neighbor && neighbor.connections[lev]) {
          neighbor.connections[lev]!.push(id);
          // Prune if too many
          if (neighbor.connections[lev]!.length > this.M * 2) {
            neighbor.connections[lev] = this.selectNeighbors(
              this.vectors[neighborId]!,
              neighbor.connections[lev]!,
              this.M,
            );
          }
        }
      }

      if (neighbors.length > 0) currentNode = neighbors[0]!;
    }

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPoint = id;
    }

    return id;
  }

  /**
   * Search for k nearest neighbors.
   */
  search(query: Float32Array, k: number, ef?: number): Array<{ id: number; distance: number }> {
    if (this.nodes.length === 0) return [];

    const effectiveEf = Math.max(ef ?? k * 2, k);
    let currentNode = this.entryPoint;

    // Greedy traverse from top
    for (let lev = this.maxLevel; lev > 0; lev--) {
      currentNode = this.greedySearch(query, currentNode, lev);
    }

    // Search level 0
    const candidates = this.searchLevel(query, currentNode, effectiveEf, 0);

    // Return top-k sorted by distance
    return candidates
      .map((id) => ({
        id,
        distance: this.cosineDistance(query, this.vectors[id]!),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k);
  }

  private greedySearch(query: Float32Array, startNode: number, level: number): number {
    let current = startNode;
    let currentDist = this.cosineDistance(query, this.vectors[current]!);

    let improved = true;
    while (improved) {
      improved = false;
      const connections = this.nodes[current]?.connections[level] ?? [];
      for (const neighborId of connections) {
        const dist = this.cosineDistance(query, this.vectors[neighborId]!);
        if (dist < currentDist) {
          current = neighborId;
          currentDist = dist;
          improved = true;
        }
      }
    }

    return current;
  }

  private searchLevel(query: Float32Array, startNode: number, ef: number, level: number): number[] {
    const visited = new Set<number>([startNode]);
    const candidates: Array<{ id: number; dist: number }> = [
      { id: startNode, dist: this.cosineDistance(query, this.vectors[startNode]!) },
    ];
    const results: Array<{ id: number; dist: number }> = [...candidates];

    while (candidates.length > 0) {
      // Get closest candidate
      candidates.sort((a, b) => a.dist - b.dist);
      const closest = candidates.shift()!;

      // Check if we're done
      const farthestResult = results[results.length - 1]!;
      if (results.length >= ef && closest.dist > farthestResult.dist) break;

      // Explore neighbors
      const connections = this.nodes[closest.id]?.connections[level] ?? [];
      for (const neighborId of connections) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const dist = this.cosineDistance(query, this.vectors[neighborId]!);
        if (results.length < ef || dist < results[results.length - 1]!.dist) {
          candidates.push({ id: neighborId, dist });
          results.push({ id: neighborId, dist });
          results.sort((a, b) => a.dist - b.dist);
          if (results.length > ef) results.pop();
        }
      }
    }

    return results.map((r) => r.id);
  }

  private selectNeighbors(query: Float32Array, candidateIds: number[], maxNeighbors: number): number[] {
    if (candidateIds.length <= maxNeighbors) return candidateIds;

    return candidateIds
      .map((id) => ({ id, dist: this.cosineDistance(query, this.vectors[id]!) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, maxNeighbors)
      .map((c) => c.id);
  }

  private randomLevel(): number {
    let level = 0;
    while (Math.random() < 1 / this.M && level < 16) level++;
    return level;
  }

  private cosineDistance(a: Float32Array, b: Float32Array): number {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? 1 - dot / denom : 1; // cosine distance
  }

  get size(): number {
    return this.nodes.length;
  }
}

// ============================================
// SEMANTIC SEARCH ENGINE
// ============================================

export class SemanticSearch {
  private static instance: SemanticSearch | null = null;
  private model: SentenceEncoderModel | null = null;
  private isLoaded = false;

  private index: HNSWIndex;
  private chunks: IndexedChunk[] = [];

  // TF-IDF fallback
  private idfMap: Map<string, number> = new Map();
  private chunkWordVectors: Map<string, Record<string, number>> = new Map();

  private constructor() {
    this.index = new HNSWIndex(16, 200);
  }

  static getInstance(): SemanticSearch {
    if (!SemanticSearch.instance) {
      SemanticSearch.instance = new SemanticSearch();
    }
    return SemanticSearch.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Try v3 model (bundled ~20MB MiniLM), then document directory fallback
      const modelData = await loadBundledModelWithFallback<SentenceEncoderModel>(
        safeRequire(() => require('../../../assets/models/search_v3.model')),
        'search_v3.model',
      );
      if (!modelData) {
        if (__DEV__) console.warn('[SemanticSearch] Encoder not found — using TF-IDF fallback');
        return false;
      }
      this.model = modelData;

      this.isLoaded = true;
      const version = (this.model as any).version ?? '3.0.0';
      if (__DEV__) {
        console.warn(
          `[SemanticSearch] v${version}: ${this.model.numLayers} layers, ` + `dim=${this.model.sentenceSize}`,
        );
      }
      return true;
    } catch (error) {
      if (__DEV__) console.warn('[SemanticSearch] Failed to load encoder:', error);
      return false;
    }
  }

  // ============================================
  // INDEXING
  // ============================================

  /**
   * Add a document to the search index (splits into chunks).
   */
  async indexDocument(documentId: string, text: string, chunkSize = 200, overlap = 50): Promise<number> {
    const textChunks = this.chunkText(text, chunkSize, overlap);
    let indexed = 0;

    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i]!;
      const chunkId = `${documentId}_chunk_${i}`;

      if (this.isLoaded && this.model) {
        // Neural embedding
        const embedding = this.encode(chunkText);
        const f32 = new Float32Array(embedding.length);
        for (let j = 0; j < embedding.length; j++) f32[j] = embedding[j]!;

        this.index.add(f32);
        this.chunks.push({ id: chunkId, documentId, text: chunkText, embedding: f32 });
      } else {
        // TF-IDF fallback
        const words = this.getWords(chunkText);
        const tf: Record<string, number> = {};
        for (const w of words) tf[w] = (tf[w] ?? 0) + 1;
        for (const w of Object.keys(tf)) tf[w] = tf[w]! / words.length;
        this.chunkWordVectors.set(chunkId, tf);

        this.chunks.push({
          id: chunkId,
          documentId,
          text: chunkText,
          embedding: new Float32Array(0),
        });
      }

      indexed++;
    }

    // Rebuild IDF if using fallback
    if (!this.isLoaded) {
      this.rebuildIDF();
    }

    return indexed;
  }

  /**
   * Remove a document from the index.
   */
  removeDocument(documentId: string): void {
    this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
    // Note: HNSW doesn't support deletion well — rebuild index
    this.rebuildIndex();
  }

  /**
   * Rebuild the HNSW index from current chunks.
   */
  private rebuildIndex(): void {
    if (!this.isLoaded) return;
    this.index = new HNSWIndex(16, 200);
    for (const chunk of this.chunks) {
      this.index.add(chunk.embedding);
    }
  }

  // ============================================
  // SEARCH
  // ============================================

  /**
   * Search for relevant document chunks.
   */
  async search(query: string, config: SearchConfig = {}): Promise<SearchResult[]> {
    const { topK = 5, minScore = 0.1, documentFilter } = config;

    if (this.chunks.length === 0) return [];

    let results: SearchResult[];

    if (this.isLoaded && this.model) {
      results = this.neuralSearch(query, topK * 3); // oversample for filtering
    } else {
      results = this.tfidfSearch(query, topK * 3);
    }

    // Filter by document
    if (documentFilter && documentFilter.length > 0) {
      results = results.filter((r) => documentFilter.includes(r.documentId));
    }

    // Filter by min score
    results = results.filter((r) => r.score >= minScore);

    // Add highlights
    results = results.map((r) => ({
      ...r,
      highlight: this.highlightMatch(r.text, query),
    }));

    return results.slice(0, topK);
  }

  private neuralSearch(query: string, topK: number): SearchResult[] {
    const queryEmb = this.encode(query);
    const f32Query = new Float32Array(queryEmb.length);
    for (let i = 0; i < queryEmb.length; i++) f32Query[i] = queryEmb[i]!;

    const hnswResults = this.index.search(f32Query, topK);

    return hnswResults.map(({ id, distance }) => {
      const chunk = this.chunks[id];
      return {
        documentId: chunk?.documentId ?? '',
        chunkId: chunk?.id ?? '',
        text: chunk?.text ?? '',
        score: 1 - distance, // cosine similarity
      };
    });
  }

  private tfidfSearch(query: string, topK: number): SearchResult[] {
    const queryWords = this.getWords(query);
    const queryTf: Record<string, number> = {};
    for (const w of queryWords) queryTf[w] = (queryTf[w] ?? 0) + 1;
    for (const w of Object.keys(queryTf)) queryTf[w] = queryTf[w]! / queryWords.length;

    // TF-IDF query vector
    const queryVec: Record<string, number> = {};
    for (const [w, tf] of Object.entries(queryTf)) {
      queryVec[w] = tf * (this.idfMap.get(w) ?? 1);
    }

    // Score each chunk
    const scored: SearchResult[] = [];
    for (const chunk of this.chunks) {
      const chunkVec = this.chunkWordVectors.get(chunk.id) ?? {};
      const chunkTfidf: Record<string, number> = {};
      for (const [w, tf] of Object.entries(chunkVec)) {
        chunkTfidf[w] = tf * (this.idfMap.get(w) ?? 1);
      }

      const score = this.cosineSimSparse(queryVec, chunkTfidf);
      if (score > 0) {
        scored.push({
          documentId: chunk.documentId,
          chunkId: chunk.id,
          text: chunk.text,
          score,
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // ============================================
  // SENTENCE ENCODING (transformer forward pass)
  // ============================================

  private encode(text: string): Float64Array {
    if (!this.model) return new Float64Array(128);

    const tokens = this.tokenize(text);
    const hidden = this.model.hiddenSize;

    // Embeddings
    let states: Float64Array[] = tokens.map((tid, pos) => {
      const emb = new Float64Array(hidden);
      const wEmb = this.model!.wordEmbeddings[tid] ?? [];
      const pEmb = this.model!.positionEmbeddings[pos] ?? [];
      for (let h = 0; h < hidden; h++) {
        emb[h] = (wEmb[h] ?? 0) + (pEmb[h] ?? 0);
      }
      return emb;
    });

    // Transformer
    for (const layer of this.model.layers) {
      states = this.transformerLayer(states, layer);
    }

    // Mean pool
    const pooled = new Float64Array(hidden);
    for (const s of states) {
      for (let i = 0; i < hidden; i++) pooled[i] = (pooled[i] ?? 0) + s[i]!;
    }
    for (let i = 0; i < hidden; i++) pooled[i] = pooled[i]! / states.length;
    // Project
    const sentSize = this.model.sentenceSize;
    const out = new Float64Array(sentSize);
    for (let i = 0; i < sentSize; i++) {
      let sum = this.model.poolingBias[i] ?? 0;
      const w = this.model.poolingWeight[i];
      for (let j = 0; j < hidden; j++) sum += pooled[j]! * (w?.[j] ?? 0);
      out[i] = sum;
    }

    // L2 normalize
    let norm = 0;
    for (const v of out) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < sentSize; i++) out[i] = out[i]! / norm;

    return out;
  }

  private transformerLayer(input: Float64Array[], layer: TransformerLayer): Float64Array[] {
    return sharedTransformerLayer(input, layer, {
      hiddenSize: this.model!.hiddenSize,
      numHeads: this.model!.numHeads,
    });
  }

  // ============================================
  // TEXT UTILITIES
  // ============================================

  private tokenize(text: string): number[] {
    if (!this.model) return [];
    return text
      .toLowerCase()
      .split(/\s+/)
      .slice(0, this.model.maxLength)
      .map((w) => this.model!.vocabulary[w] ?? 0);
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim().length > 0) chunks.push(chunk);
      if (i + chunkSize >= words.length) break;
    }
    return chunks;
  }

  private getWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  private rebuildIDF(): void {
    const df: Map<string, number> = new Map();
    const n = this.chunks.length;
    for (const chunk of this.chunks) {
      const vec = this.chunkWordVectors.get(chunk.id);
      if (vec) {
        for (const w of Object.keys(vec)) {
          df.set(w, (df.get(w) ?? 0) + 1);
        }
      }
    }
    this.idfMap.clear();
    for (const [word, count] of df) {
      this.idfMap.set(word, Math.log(n / count));
    }
  }

  private highlightMatch(text: string, query: string): string {
    const queryWords = new Set(this.getWords(query));
    return text
      .split(/\s+/)
      .map((word) => {
        const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        return queryWords.has(clean) ? `**${word}**` : word;
      })
      .join(' ');
  }

  private cosineSimSparse(a: Record<string, number>, b: Record<string, number>): number {
    let dot = 0,
      normA = 0,
      normB = 0;
    for (const [w, v] of Object.entries(a)) {
      dot += v * (b[w] ?? 0);
      normA += v * v;
    }
    for (const v of Object.values(b)) normB += v * v;
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  // ============================================
  // MATH
  // ============================================

  // Math helpers delegated to TransformerRuntime

  // ============================================
  // PUBLIC API
  // ============================================

  get loaded(): boolean {
    return this.isLoaded;
  }
  get indexSize(): number {
    return this.chunks.length;
  }

  getModelInfo() {
    return {
      loaded: this.isLoaded,
      modelType: this.isLoaded ? ('neural' as const) : ('tfidf' as const),
      indexSize: this.chunks.length,
      hnswNodes: this.index.size,
      embeddingDim: this.model?.sentenceSize ?? 0,
    };
  }
}

export const semanticSearch = SemanticSearch.getInstance();
