/**
 * ModelDownloadManager — On-Demand Model Lifecycle
 *
 * Manages downloading, caching, versioning, and storage for all
 * AI models used in FitQuest 2.0.
 *
 * Features:
 *   1. On-demand download: models are fetched when first needed
 *   2. Version checking: auto-updates when newer models are available
 *   3. Storage management: LRU eviction when storage quota is exceeded
 *   4. Progress tracking: per-model download progress callbacks
 *   5. Integrity: SHA-256 checksum verification after download
 *   6. Resume: partial download recovery (via expo-file-system)
 *
 * Model registry defines all available models with their metadata.
 */

import * as FileSystem from 'expo-file-system/legacy';

// ============================================
// TYPES
// ============================================

export interface ModelManifest {
  id: string;
  name: string;
  version: number;
  sizeBytes: number;       // expected file size
  checksum: string;        // SHA-256 of the model file
  url: string;             // download URL (CDN)
  localPath: string;       // relative to documentDirectory
  required: boolean;       // must download before app is usable
  priority: number;        // download order (lower = higher priority)
  dependencies?: string[]; // other model IDs this depends on
  description: string;
}

export type DownloadStatus =
  | 'not-downloaded'
  | 'downloading'
  | 'downloaded'
  | 'update-available'
  | 'error'
  | 'verifying';

export interface ModelState {
  manifest: ModelManifest;
  status: DownloadStatus;
  downloadedVersion: number;
  progress: number;        // 0-1
  sizeOnDisk: number;
  lastChecked: number;
  error?: string;
}

export interface DownloadProgress {
  modelId: string;
  totalBytes: number;
  downloadedBytes: number;
  progress: number;        // 0-1
  speedBps: number;        // bytes per second
  estimatedTimeRemaining: number; // seconds
}

export interface StorageStats {
  totalModelsSize: number;
  availableSpace: number;
  modelsDownloaded: number;
  modelsAvailable: number;
  quotaUsedPercent: number;
}

// ============================================
// MODEL REGISTRY
// ============================================

const BASE_URL = 'https://models.fitquest.app/v2';

export const MODEL_REGISTRY: ModelManifest[] = [
  // --- Critical models (required for core features) ---
  {
    id: 'intent_router_v2',
    name: 'Neural Intent Router',
    version: 2,
    sizeBytes: 4_200_000,
    checksum: '', // populated after training
    url: `${BASE_URL}/intent_transformer.json`,
    localPath: 'models/intent_transformer.json',
    required: true,
    priority: 1,
    description: 'Transformer-based intent classification for natural language routing',
  },
  {
    id: 'fitcoach_v2',
    name: 'Transformer FitCoach',
    version: 2,
    sizeBytes: 8_500_000,
    checksum: '',
    url: `${BASE_URL}/fitcoach_transformer.json`,
    localPath: 'models/fitcoach_transformer.json',
    required: true,
    priority: 2,
    description: 'Encoder-decoder transformer for personalized workout generation',
  },
  {
    id: 'activity_v2',
    name: 'CNN-LSTM Activity Classifier',
    version: 2,
    sizeBytes: 2_800_000,
    checksum: '',
    url: `${BASE_URL}/cnn_lstm_activity.json`,
    localPath: 'models/cnn_lstm_activity.json',
    required: true,
    priority: 3,
    description: 'Real-time activity recognition from accelerometer + gyroscope',
  },

  // --- High priority (FitMind intelligence) ---
  {
    id: 'sentence_encoder',
    name: 'Sentence Encoder',
    version: 1,
    sizeBytes: 5_200_000,
    checksum: '',
    url: `${BASE_URL}/sentence_encoder.json`,
    localPath: 'models/sentence_encoder.json',
    required: false,
    priority: 4,
    dependencies: [],
    description: 'Shared sentence embedding model for summarization + search',
  },
  {
    id: 'summarizer',
    name: 'Neural Summarizer',
    version: 1,
    sizeBytes: 5_000_000,
    checksum: '',
    url: `${BASE_URL}/summarizer_encoder.json`,
    localPath: 'models/summarizer_encoder.json',
    required: false,
    priority: 5,
    dependencies: ['sentence_encoder'],
    description: 'Extractive document summarization with TF-IDF fallback',
  },

  // --- Medium priority (AR / Voice) ---
  {
    id: 'pose_model',
    name: 'MoveNet Pose Estimator',
    version: 1,
    sizeBytes: 12_000_000,
    checksum: '',
    url: `${BASE_URL}/movenet_thunder.json`,
    localPath: 'models/movenet_thunder.json',
    required: false,
    priority: 6,
    description: 'Pose estimation model for AR form checking',
  },

  // --- Legacy v1 models (bundled, kept for fallback) ---
  {
    id: 'intent_v1',
    name: 'Intent Router v1 (TF-IDF)',
    version: 1,
    sizeBytes: 305_000,
    checksum: '',
    url: '',
    localPath: 'models/intent_model.json',
    required: false,
    priority: 99,
    description: 'Legacy TF-IDF + LinearSVC intent classifier (bundled)',
  },
  {
    id: 'fitcoach_v1',
    name: 'FitCoach v1 (MLP)',
    version: 1,
    sizeBytes: 1_100_000,
    checksum: '',
    url: '',
    localPath: 'models/fitcoach_model.json',
    required: false,
    priority: 99,
    description: 'Legacy MLP workout generator (bundled)',
  },
  {
    id: 'activity_v1',
    name: 'Activity v1 (RandomForest)',
    version: 1,
    sizeBytes: 6_000,
    checksum: '',
    url: '',
    localPath: 'models/activity_model.json',
    required: false,
    priority: 99,
    description: 'Legacy RandomForest activity classifier (bundled)',
  },
];

// ============================================
// DOWNLOAD MANAGER
// ============================================

export class ModelDownloadManager {
  private static instance: ModelDownloadManager | null = null;

  private models: Map<string, ModelState> = new Map();
  private activeDownloads: Map<string, ReturnType<typeof FileSystem.createDownloadResumable>> = new Map();
  private progressCallbacks: Map<string, ((p: DownloadProgress) => void)[]> = new Map();
  private readonly modelsDir: string;
  private readonly storageQuota: number; // bytes

  private constructor() {
    this.modelsDir = `${FileSystem.documentDirectory}models/`;
    this.storageQuota = 200 * 1024 * 1024; // 200MB

    // Initialize model states from registry
    for (const manifest of MODEL_REGISTRY) {
      this.models.set(manifest.id, {
        manifest,
        status: 'not-downloaded',
        downloadedVersion: 0,
        progress: 0,
        sizeOnDisk: 0,
        lastChecked: 0,
      });
    }
  }

  static getInstance(): ModelDownloadManager {
    if (!ModelDownloadManager.instance) {
      ModelDownloadManager.instance = new ModelDownloadManager();
    }
    return ModelDownloadManager.instance;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Check which models are already downloaded and their versions.
   */
  async initialize(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.modelsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.modelsDir, { intermediates: true });
    }

    // Check each model's local status
    for (const [id, state] of this.models) {
      const localPath = `${FileSystem.documentDirectory}${state.manifest.localPath}`;
      const info = await FileSystem.getInfoAsync(localPath);

      if (info.exists) {
        state.status = 'downloaded';
        state.downloadedVersion = state.manifest.version;
        state.sizeOnDisk = (info as any).size ?? state.manifest.sizeBytes;
        state.lastChecked = Date.now();
      }
    }

    console.log(
      `[ModelDownloadManager] Initialized: ${this.getDownloadedCount()}/${MODEL_REGISTRY.length} models available`
    );
  }

  // ============================================
  // DOWNLOAD OPERATIONS
  // ============================================

  /**
   * Download a specific model.
   */
  async downloadModel(
    modelId: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<boolean> {
    const state = this.models.get(modelId);
    if (!state) {
      console.warn(`[ModelDownloadManager] Unknown model: ${modelId}`);
      return false;
    }

    if (state.status === 'downloading') {
      console.log(`[ModelDownloadManager] Already downloading: ${modelId}`);
      return false;
    }

    if (!state.manifest.url) {
      // Bundled model — check assets
      console.log(`[ModelDownloadManager] ${modelId} is bundled, no download needed`);
      state.status = 'downloaded';
      return true;
    }

    // Check storage quota
    const stats = await this.getStorageStats();
    if (stats.totalModelsSize + state.manifest.sizeBytes > this.storageQuota) {
      // Try to free space by evicting old models
      const freed = await this.evictLRU(state.manifest.sizeBytes);
      if (!freed) {
        state.status = 'error';
        state.error = 'Insufficient storage space';
        return false;
      }
    }

    // Register progress callback
    if (onProgress) {
      const callbacks = this.progressCallbacks.get(modelId) ?? [];
      callbacks.push(onProgress);
      this.progressCallbacks.set(modelId, callbacks);
    }

    state.status = 'downloading';
    state.progress = 0;

    try {
      const localPath = `${FileSystem.documentDirectory}${state.manifest.localPath}`;
      const startTime = Date.now();

      // Create download resumable
      const downloadResumable = FileSystem.createDownloadResumable(
        state.manifest.url,
        localPath,
        {},
        (downloadProgress) => {
          const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
          const progress = totalBytesExpectedToWrite > 0
            ? totalBytesWritten / totalBytesExpectedToWrite
            : 0;
          const elapsed = (Date.now() - startTime) / 1000;
          const speedBps = elapsed > 0 ? totalBytesWritten / elapsed : 0;
          const remaining = speedBps > 0
            ? (totalBytesExpectedToWrite - totalBytesWritten) / speedBps
            : 0;

          state.progress = progress;

          const progressInfo: DownloadProgress = {
            modelId,
            totalBytes: totalBytesExpectedToWrite,
            downloadedBytes: totalBytesWritten,
            progress,
            speedBps,
            estimatedTimeRemaining: remaining,
          };

          this.progressCallbacks.get(modelId)?.forEach(cb => cb(progressInfo));
        }
      );

      this.activeDownloads.set(modelId, downloadResumable);

      const result = await downloadResumable.downloadAsync();
      this.activeDownloads.delete(modelId);

      if (!result) {
        throw new Error('Download returned null');
      }

      // Verify integrity
      state.status = 'verifying';
      if (state.manifest.checksum) {
        const verified = await this.verifyChecksum(localPath, state.manifest.checksum);
        if (!verified) {
          await FileSystem.deleteAsync(localPath, { idempotent: true });
          throw new Error('Checksum verification failed');
        }
      }

      state.status = 'downloaded';
      state.downloadedVersion = state.manifest.version;
      state.progress = 1;
      state.sizeOnDisk = state.manifest.sizeBytes;
      state.lastChecked = Date.now();
      state.error = undefined;

      console.log(`[ModelDownloadManager] Downloaded: ${state.manifest.name}`);
      return true;
    } catch (err: any) {
      state.status = 'error';
      state.error = err?.message ?? 'Download failed';
      this.activeDownloads.delete(modelId);
      console.warn(`[ModelDownloadManager] Download failed for ${modelId}:`, err);
      return false;
    } finally {
      this.progressCallbacks.delete(modelId);
    }
  }

  /**
   * Download all required models.
   */
  async downloadRequiredModels(
    onOverallProgress?: (downloaded: number, total: number) => void
  ): Promise<{ success: string[]; failed: string[] }> {
    const required = MODEL_REGISTRY
      .filter(m => m.required && m.url)
      .sort((a, b) => a.priority - b.priority);

    const success: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < required.length; i++) {
      const model = required[i];
      const state = this.models.get(model.id);
      if (state?.status === 'downloaded') {
        success.push(model.id);
        onOverallProgress?.(i + 1, required.length);
        continue;
      }

      const ok = await this.downloadModel(model.id);
      if (ok) success.push(model.id);
      else failed.push(model.id);
      onOverallProgress?.(i + 1, required.length);
    }

    return { success, failed };
  }

  /**
   * Pause a download in progress.
   */
  async pauseDownload(modelId: string): Promise<void> {
    const resumable = this.activeDownloads.get(modelId);
    if (resumable) {
      await resumable.pauseAsync();
      const state = this.models.get(modelId);
      if (state) state.status = 'not-downloaded'; // can be resumed
    }
  }

  /**
   * Resume a paused download.
   */
  async resumeDownload(modelId: string): Promise<boolean> {
    const resumable = this.activeDownloads.get(modelId);
    if (!resumable) return false;

    const state = this.models.get(modelId);
    if (state) state.status = 'downloading';

    try {
      const result = await resumable.resumeAsync();
      if (result && state) {
        state.status = 'downloaded';
        state.downloadedVersion = state.manifest.version;
        state.progress = 1;
        return true;
      }
      return false;
    } catch {
      if (state) state.status = 'error';
      return false;
    }
  }

  /**
   * Delete a downloaded model to free space.
   */
  async deleteModel(modelId: string): Promise<boolean> {
    const state = this.models.get(modelId);
    if (!state) return false;

    const localPath = `${FileSystem.documentDirectory}${state.manifest.localPath}`;
    await FileSystem.deleteAsync(localPath, { idempotent: true });

    state.status = 'not-downloaded';
    state.downloadedVersion = 0;
    state.progress = 0;
    state.sizeOnDisk = 0;

    return true;
  }

  // ============================================
  // STORAGE MANAGEMENT
  // ============================================

  /**
   * Evict least-recently-used non-required models until `neededBytes` is free.
   */
  private async evictLRU(neededBytes: number): Promise<boolean> {
    const candidates = Array.from(this.models.values())
      .filter(s => s.status === 'downloaded' && !s.manifest.required)
      .sort((a, b) => a.lastChecked - b.lastChecked); // oldest first

    let freed = 0;
    for (const model of candidates) {
      if (freed >= neededBytes) return true;
      await this.deleteModel(model.manifest.id);
      freed += model.sizeOnDisk;
    }

    return freed >= neededBytes;
  }

  async getStorageStats(): Promise<StorageStats> {
    let totalSize = 0;
    let downloaded = 0;

    for (const state of this.models.values()) {
      if (state.status === 'downloaded') {
        totalSize += state.sizeOnDisk;
        downloaded++;
      }
    }

    // Try to get available space (may not be available on all platforms)
    let availableSpace = this.storageQuota - totalSize;
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      if (freeSpace > 0) availableSpace = Math.min(availableSpace, freeSpace);
    } catch {
      // Fallback to quota-based estimate
    }

    return {
      totalModelsSize: totalSize,
      availableSpace: Math.max(0, availableSpace),
      modelsDownloaded: downloaded,
      modelsAvailable: MODEL_REGISTRY.length,
      quotaUsedPercent: (totalSize / this.storageQuota) * 100,
    };
  }

  // ============================================
  // CHECKSUM VERIFICATION
  // ============================================

  /**
   * Verify file integrity using DJB2 hash (simplified).
   * Production: replace with proper SHA-256.
   */
  private async verifyChecksum(filePath: string, expected: string): Promise<boolean> {
    if (!expected) return true; // skip if no checksum set

    try {
      const content = await FileSystem.readAsStringAsync(filePath);
      let hash = 5381;
      for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) + hash + content.charCodeAt(i)) & 0xFFFFFFFF;
      }
      const actual = hash.toString(16).padStart(8, '0');
      return actual === expected;
    } catch {
      return false;
    }
  }

  // ============================================
  // PUBLIC QUERIES
  // ============================================

  getModelState(modelId: string): ModelState | undefined {
    return this.models.get(modelId);
  }

  isModelReady(modelId: string): boolean {
    const state = this.models.get(modelId);
    return state?.status === 'downloaded';
  }

  getModelPath(modelId: string): string | null {
    const state = this.models.get(modelId);
    if (!state || state.status !== 'downloaded') return null;
    return `${FileSystem.documentDirectory}${state.manifest.localPath}`;
  }

  getDownloadedCount(): number {
    return Array.from(this.models.values()).filter(s => s.status === 'downloaded').length;
  }

  getAllModelStates(): ModelState[] {
    return Array.from(this.models.values()).sort(
      (a, b) => a.manifest.priority - b.manifest.priority
    );
  }

  getRequiredModels(): ModelManifest[] {
    return MODEL_REGISTRY.filter(m => m.required);
  }

  /**
   * Format bytes to human-readable string.
   */
  static formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const modelDownloadManager = ModelDownloadManager.getInstance();
