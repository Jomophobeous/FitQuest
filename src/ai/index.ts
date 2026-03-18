/**
 * AI Module Index — FitQuest 2.0
 *
 * Active modules:
 *   - TrainedIntentRouter:      SVC classifier, 8 intents (v1.0, always loaded)
 *   - DeepActivityClassifier:   CNN+BiLSTM, 9 activities (v2.0, loaded on Move tab)
 *   - NeuralSummarizer:         BERT extractive summarization (loaded on FitMind open)
 *   - SemanticSearch:           MiniLM embeddings + HNSW index (loaded on FitMind open)
 *   - KnowledgeGraph:           Entity & relationship extraction (no model)
 *
 * Removed modules (dead code cleanup):
 *   - NeuralIntentRouter (48MB transformer — too heavy for 4GB devices)
 *   - TransformerFitCoach (unused — workouts use workoutGenerator.ts)
 *   - VoiceInterface, ARFormChecker (no UI integration)
 *   - FederatedLearning, EncryptedCloudSync (infrastructure not needed)
 *   - ModelDownloadManager (never integrated)
 */

// ============================================
// MODEL LOADER (async expo-asset pipeline)
// ============================================

export {
  loadBundledModel,
  loadBundledModelWithFallback,
  loadCognitiveAI,
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
// v2.0 NEURAL MODELS (active modules only)
// ============================================

export { DeepActivityClassifier, deepActivityClassifier } from './sensors/DeepActivityClassifier';
export { NeuralSummarizer, neuralSummarizer } from './professor/NeuralSummarizer';
export { SemanticSearch, semanticSearch } from './professor/SemanticSearch';
export { KnowledgeGraph, knowledgeGraph } from './professor/KnowledgeGraph';
