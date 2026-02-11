/**
 * AI Module Index — FitQuest 2.0 MAX (143MB Neural Architecture)
 *
 * All models are bundled with the app binary and loaded asynchronously
 * via expo-asset + FileSystem. No network download needed.
 *
 * Tier 1 — Core (~68MB, loaded at startup):
 *   - NeuralIntentRouter:       8-layer transformer, 12 intents, entity extraction
 *   - TransformerFitCoach:      4+4-layer enc-dec, 24 exercises, progressive overload
 *   - DeepActivityClassifier:   CNN+BiLSTM+Attention, 9 activities, fall detection
 *
 * Tier 2 — Cognitive (~32MB, loaded on FitMind open):
 *   - NeuralSummarizer:         6-layer BERT encoder, extractive summarization
 *   - SemanticSearch:           6-layer MiniLM, 384-dim embeddings, HNSW index
 *   - KnowledgeGraph:           Entity & relationship extraction (no model)
 *
 * Tier 3 — Multimodal (~2MB, loaded on voice/camera):
 *   - VoiceInterface:           Command parser + coaching responses
 *   - ARFormChecker:            8-exercise form analysis + rep counting
 *
 * v1.0 Legacy (always available as fallback):
 *   - TrainedIntentRouter, TrainedFitCoach, TrainedActivityClassifier
 *
 * Infrastructure:
 *   - FederatedLearning, EncryptedCloudSync
 */

// ============================================
// MODEL LOADER (async expo-asset pipeline + tiered loading)
// ============================================

export {
  loadBundledModel,
  loadBundledModelWithFallback,
  loadCoreAI,
  loadCognitiveAI,
  loadMultimodalAI,
  getTierStatus,
} from './ModelLoader';
export type { TierStatus } from './ModelLoader';

// ============================================
// v1.0 LEGACY MODELS (bundled fallback)
// ============================================

export { TrainedIntentRouter, trainedIntentRouter } from './TrainedIntentRouter';
export type { IntentResult } from './TrainedIntentRouter';

export { TrainedFitCoach, trainedFitCoach } from './TrainedFitCoach';
export type { UserProfile, GeneratedWorkout, GeneratedExercise } from './TrainedFitCoach';

export { TrainedActivityClassifier, trainedActivityClassifier } from './TrainedActivityClassifier';
export type { ActivityPrediction, SensorReading as AISensorReading } from './TrainedActivityClassifier';

// ============================================
// v2.0 NEURAL MODELS (bundled with app)
// ============================================

export { NeuralIntentRouter, neuralIntentRouter } from './intent/NeuralIntentRouter';
export { TransformerFitCoach, transformerFitCoach } from './coach/TransformerFitCoach';
export { DeepActivityClassifier, deepActivityClassifier } from './sensors/DeepActivityClassifier';
export { NeuralSummarizer, neuralSummarizer } from './professor/NeuralSummarizer';
export { SemanticSearch, semanticSearch } from './professor/SemanticSearch';
export { KnowledgeGraph, knowledgeGraph } from './professor/KnowledgeGraph';
export { VoiceInterface, voiceInterface } from './voice/VoiceInterface';
export { ARFormChecker, arFormChecker } from './ar/ARFormChecker';

// ============================================
// INFRASTRUCTURE
// ============================================

export { FederatedLearning, federatedLearning } from './federated/FederatedLearning';
export { EncryptedCloudSync, encryptedCloudSync } from './sync/EncryptedCloudSync';

// ============================================
// INITIALIZATION — Tiered Loading Strategy
// ============================================

/**
 * Initialize AI models with tiered loading.
 *
 * Phase 1: v1.0 legacy models (instant, always succeed)
 * Phase 2: Tier 1 Core AI (Intent + Coach + Activity) — loaded in parallel
 *
 * Cognitive and Multimodal tiers are loaded on demand via:
 *   - loadCognitiveAI() — call when FitMind screen opens
 *   - loadMultimodalAI() — call when voice/camera activates
 */
export async function initializeAIModels(): Promise<{
  intentRouter: boolean;
  fitCoach: boolean;
  activityClassifier: boolean;
  v2Modules: Record<string, boolean>;
}> {
  console.log('\u{1F9E0} Loading bundled AI models (v3 MAX)...');
  const startTime = Date.now();

  // --- Phase 1: v1.0 legacy models (instant, always succeed) ---
  const { trainedIntentRouter } = await import('./TrainedIntentRouter');
  const { trainedFitCoach } = await import('./TrainedFitCoach');
  const { trainedActivityClassifier } = await import('./TrainedActivityClassifier');

  const [intentRouter, fitCoach, activityClassifier] = await Promise.all([
    trainedIntentRouter.initialize().catch(() => false),
    trainedFitCoach.initialize().catch(() => false),
    trainedActivityClassifier.initialize().catch(() => false),
  ]);

  console.log(
    `[AI] v1.0 models — Intent: ${intentRouter}, FitCoach: ${fitCoach}, Activity: ${activityClassifier}`
  );

  // --- Phase 2: Tier 1 Core AI (startup-critical modules) ---
  const { loadCoreAI: loadCore } = await import('./ModelLoader');
  const coreStatus = await loadCore();

  const v2Modules: Record<string, boolean> = { ...coreStatus.modules };

  // Tier 2+3 will be loaded on demand — mark as deferred
  v2Modules['summarizer'] = false;       // Deferred to Tier 2
  v2Modules['semanticSearch'] = false;    // Deferred to Tier 2
  v2Modules['knowledgeGraph'] = true;     // No model needed
  v2Modules['voiceInterface'] = false;    // Deferred to Tier 3
  v2Modules['arFormChecker'] = false;     // Deferred to Tier 3

  const coreCount = Object.values(coreStatus.modules).filter(Boolean).length;
  const elapsed = Date.now() - startTime;
  console.log(`\u2705 AI v3 MAX loaded in ${elapsed}ms — Core: ${coreCount}/3, Tiers 2+3: deferred`);

  return { intentRouter, fitCoach, activityClassifier, v2Modules };
}

/**
 * Get current model loading status (useful for splash screen progress).
 */
export function getModelLoadingStatus(): {
  total: number;
  loaded: number;
  percent: number;
  models: Array<{ name: string; loaded: boolean; tier: number }>;
} {
  const models = [
    // Tier 1 — Core
    { name: 'Neural Intent Router', tier: 1, get loaded() { try { return require('./intent/NeuralIntentRouter').neuralIntentRouter.loaded; } catch { return false; } } },
    { name: 'Transformer FitCoach', tier: 1, get loaded() { try { return require('./coach/TransformerFitCoach').transformerFitCoach.loaded; } catch { return false; } } },
    { name: 'Deep Activity Classifier', tier: 1, get loaded() { try { return require('./sensors/DeepActivityClassifier').deepActivityClassifier.loaded; } catch { return false; } } },
    // Tier 2 — Cognitive
    { name: 'Neural Summarizer', tier: 2, get loaded() { try { return require('./professor/NeuralSummarizer').neuralSummarizer.loaded; } catch { return false; } } },
    { name: 'Semantic Search', tier: 2, get loaded() { try { return require('./professor/SemanticSearch').semanticSearch.loaded; } catch { return false; } } },
    { name: 'Knowledge Graph', tier: 2, loaded: true },
    // Tier 3 — Multimodal
    { name: 'Voice Interface', tier: 3, get loaded() { try { return require('./voice/VoiceInterface').voiceInterface.loaded; } catch { return false; } } },
    { name: 'AR Form Checker', tier: 3, get loaded() { try { return require('./ar/ARFormChecker').arFormChecker.loaded; } catch { return false; } } },
  ];

  const loaded = models.filter(m => m.loaded).length;
  return {
    total: models.length,
    loaded,
    percent: Math.round((loaded / models.length) * 100),
    models: models.map(m => ({ name: m.name, loaded: m.loaded, tier: m.tier })),
  };
}
