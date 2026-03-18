/**
 * ModelLoader — Async bundled model loader
 *
 * Active modules:
 *   - DeepActivityClassifier: CNN+BiLSTM, 9 activities (loaded on Move tab)
 *   - NeuralSummarizer:       BERT extractive summarization (loaded on FitMind open)
 *   - SemanticSearch:          MiniLM embeddings + HNSW index (loaded on FitMind open)
 *   - KnowledgeGraph:         Entity & relationship extraction (no model)
 *
 * Model files use .model extension so Metro treats them as BINARY ASSETS.
 *
 * Flow: require('./file.model') → asset ID (number)
 *       → Asset.fromModule(id) → downloadAsync() → localUri
 *       → FileSystem.readAsStringAsync() → JSON.parse()
 */

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

// In-memory cache to avoid re-loading the same model
const modelCache = new Map<string, any>();

// ============================================
// CORE LOADING PRIMITIVES
// ============================================

/**
 * Load a bundled .model asset file asynchronously.
 * @param assetModuleId - The result of require('./file.model') — a numeric asset ID
 */
export async function loadBundledModel<T = any>(assetModuleId: number): Promise<T> {
  const asset = Asset.fromModule(assetModuleId);

  // Use cache key based on asset name
  const cacheKey = asset.name ?? String(assetModuleId);
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey) as T;
  }

  await asset.downloadAsync();

  if (!asset.localUri) {
    throw new Error(`[ModelLoader] Asset has no localUri after download: ${asset.name}`);
  }

  const jsonString = await FileSystem.readAsStringAsync(asset.localUri);
  const parsed = JSON.parse(jsonString) as T;

  modelCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * Load a bundled model with fallback to document directory.
 * @param assetModuleId - The result of require('./file.model'), or null if require failed
 * @param fallbackFilename - Filename to look for in documents/models/ folder
 */
export async function loadBundledModelWithFallback<T = any>(
  assetModuleId: number | null,
  fallbackFilename: string
): Promise<T | null> {
  // Try loading from bundled asset
  if (assetModuleId !== null && typeof assetModuleId === 'number') {
    try {
      return await loadBundledModel<T>(assetModuleId);
    } catch (e) {
      console.warn(`[ModelLoader] Bundled load failed for ${fallbackFilename}:`, e);
    }
  }

  // Try loading from document directory as fallback
  try {
    const modelPath = `${FileSystem.documentDirectory}models/${fallbackFilename}`;
    const info = await FileSystem.getInfoAsync(modelPath);
    if (info.exists) {
      const str = await FileSystem.readAsStringAsync(modelPath);
      return JSON.parse(str) as T;
    }
  } catch (e) {
    console.warn(`[ModelLoader] Fallback load failed for ${fallbackFilename}:`, e);
  }

  return null;
}

/**
 * Safely call require() for a .model asset file. Returns the asset ID or null.
 * With .model files, require() returns a numeric asset ID (not parsed JSON).
 */
export function safeRequire(requireFn: () => number): number | null {
  try {
    const result = requireFn();
    if (typeof result !== 'number') {
      console.warn('[ModelLoader] require() returned non-number — file may not be registered as asset');
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

// ============================================
// TIERED LOADING — v3 MAX Architecture
// ============================================

export type TierStatus = {
  loaded: boolean;
  modules: Record<string, boolean>;
  loadTimeMs: number;
};

const tierState: Record<string, TierStatus> = {
  cognitive: { loaded: false, modules: {}, loadTimeMs: 0 },
};

/**
 * Tier 2 — Cognitive AI. Loaded when FitMind opens.
 * Neural Summarizer → Semantic Search → Knowledge Graph
 */
export async function loadCognitiveAI(): Promise<TierStatus> {
  if (tierState.cognitive?.loaded) return tierState.cognitive;
  const start = Date.now();
  const modules: Record<string, boolean> = {};

  try {
    const { neuralSummarizer } = await import('./professor/NeuralSummarizer');
    modules['summarizer'] = await neuralSummarizer.initialize();
  } catch {
    modules['summarizer'] = false;
  }

  try {
    const { semanticSearch } = await import('./professor/SemanticSearch');
    modules['semanticSearch'] = await semanticSearch.initialize();
  } catch {
    modules['semanticSearch'] = false;
  }

  modules['knowledgeGraph'] = true; // No model needed

  tierState.cognitive = { loaded: true, modules, loadTimeMs: Date.now() - start };
  console.log(`[AI] Tier 2 (Cognitive) loaded in ${tierState.cognitive.loadTimeMs}ms`, modules);
  return tierState.cognitive;
}

/**
 * Get the loading status of all tiers.
 */
export function getTierStatus(): Record<string, TierStatus> {
  return { ...tierState };
}
