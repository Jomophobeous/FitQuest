/**
 * ModelLoader — Async bundled model loader with tiered loading strategy
 *
 * FitQuest 2.0 MAX — models loaded asynchronously via expo-asset:
 *   Tier 1 (Core):       Intent + Coach + Activity — loaded at startup
 *   Tier 2 (Cognitive):  Summarizer + Search — loaded on FitMind open
 *   Tier 3 (Multimodal): Voice + AR — loaded on voice/camera activation
 *
 * Model files use .model extension so Metro treats them as BINARY ASSETS
 * (not source code). This prevents Metro from parsing 18MB+ JSON files
 * synchronously on the JS thread, which would freeze/crash the app.
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
  core: { loaded: false, modules: {}, loadTimeMs: 0 },
  cognitive: { loaded: false, modules: {}, loadTimeMs: 0 },
  multimodal: { loaded: false, modules: {}, loadTimeMs: 0 },
};

/**
 * Tier 1 — Core AI. Loaded SEQUENTIALLY at app startup to avoid OOM.
 * Intent Router → FitCoach → Activity Classifier
 * Each model is loaded, parsed, then the next begins.
 */
export async function loadCoreAI(): Promise<TierStatus> {
  if (tierState.core.loaded) return tierState.core;
  const start = Date.now();
  const modules: Record<string, boolean> = {};

  // Load sequentially to avoid parallel JSON parsing of large models
  // (18MB + 13MB + 1MB parsed in parallel would spike memory and crash)
  try {
    const { neuralIntentRouter } = await import('./intent/NeuralIntentRouter');
    modules['neuralIntent'] = await neuralIntentRouter.initialize();
    console.log(`[AI] Intent Router: ${modules['neuralIntent'] ? '✓' : '✗'}`);
  } catch (e) {
    modules['neuralIntent'] = false;
    console.warn('[AI] Intent Router failed:', e);
  }

  try {
    const { transformerFitCoach } = await import('./coach/TransformerFitCoach');
    modules['transformerCoach'] = await transformerFitCoach.initialize();
    console.log(`[AI] FitCoach: ${modules['transformerCoach'] ? '✓' : '✗'}`);
  } catch (e) {
    modules['transformerCoach'] = false;
    console.warn('[AI] FitCoach failed:', e);
  }

  try {
    const { deepActivityClassifier } = await import('./sensors/DeepActivityClassifier');
    modules['deepActivity'] = await deepActivityClassifier.initialize();
    console.log(`[AI] Activity Classifier: ${modules['deepActivity'] ? '✓' : '✗'}`);
  } catch (e) {
    modules['deepActivity'] = false;
    console.warn('[AI] Activity Classifier failed:', e);
  }

  tierState.core = { loaded: true, modules, loadTimeMs: Date.now() - start };
  console.log(`[AI] Tier 1 (Core) loaded in ${tierState.core.loadTimeMs}ms`, modules);
  return tierState.core;
}

/**
 * Tier 2 — Cognitive AI. Loaded when FitMind opens.
 * Neural Summarizer → Semantic Search → Knowledge Graph
 */
export async function loadCognitiveAI(): Promise<TierStatus> {
  if (tierState.cognitive.loaded) return tierState.cognitive;
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
 * Tier 3 — Multimodal AI (~2MB). Loaded on voice/camera activation.
 * Voice Interface + AR Form Checker
 */
export async function loadMultimodalAI(): Promise<TierStatus> {
  if (tierState.multimodal.loaded) return tierState.multimodal;
  const start = Date.now();
  const modules: Record<string, boolean> = {};

  const results = await Promise.allSettled([
    (async () => {
      const { voiceInterface } = await import('./voice/VoiceInterface');
      return ['voiceInterface', await voiceInterface.initialize()] as const;
    })(),
    (async () => {
      const { arFormChecker } = await import('./ar/ARFormChecker');
      return ['arFormChecker', await arFormChecker.initialize()] as const;
    })(),
  ]);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const [name, loaded] = result.value;
      modules[name] = loaded;
    }
  }

  tierState.multimodal = { loaded: true, modules, loadTimeMs: Date.now() - start };
  console.log(`[AI] Tier 3 (Multimodal) loaded in ${tierState.multimodal.loadTimeMs}ms`, modules);
  return tierState.multimodal;
}

/**
 * Get the loading status of all tiers.
 */
export function getTierStatus(): Record<string, TierStatus> {
  return { ...tierState };
}
