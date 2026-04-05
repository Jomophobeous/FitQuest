/**
 * ImageCacheService — LRU in-memory cache for resolved exercise image URIs.
 *
 * - Max 100 entries, 30-minute TTL per entry
 * - Pre-fetches adjacent frames on cache miss → hit
 * - Clears on memory warning (AppState listener)
 */

import { AppState, type AppStateStatus } from 'react-native';

// ─── Types ───

interface CacheEntry {
  uris: string[];
  timestamp: number;
}

// ─── Config ───

const MAX_ENTRIES = 100;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── LRU Cache ───

class ImageCacheService {
  private cache = new Map<string, CacheEntry>();
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  constructor() {
    // Listen for memory warnings via AppState
    this.appStateSubscription = AppState.addEventListener('memoryWarning', () => {
      if (__DEV__) console.warn('[ImageCache] Memory warning — clearing cache');
      this.clear();
    });
  }

  /**
   * Get cached URIs for an exercise. Returns null on miss or expiry.
   */
  get(exerciseId: string): string[] | null {
    const entry = this.cache.get(exerciseId);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.cache.delete(exerciseId);
      return null;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(exerciseId);
    this.cache.set(exerciseId, entry);

    return entry.uris;
  }

  /**
   * Store resolved URIs for an exercise.
   */
  set(exerciseId: string, uris: string[]): void {
    // If already exists, delete first to refresh position
    this.cache.delete(exerciseId);

    // Evict oldest if at capacity
    if (this.cache.size >= MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }

    this.cache.set(exerciseId, { uris, timestamp: Date.now() });
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Current cache size.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup listener on teardown.
   */
  dispose(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    this.cache.clear();
  }
}

// Singleton export
export const imageCache = new ImageCacheService();
