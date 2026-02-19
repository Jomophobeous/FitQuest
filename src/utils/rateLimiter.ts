/**
 * FitQuest Rate Limiter
 *
 * In-memory sliding-window rate limiter for sensitive device-level operations.
 * Used to throttle: biometric retries, data exports, cloud wipes, AI queries.
 *
 * NOT a server-side rate limiter — this is client-side abuse prevention
 * for offline-first operations that could be exploited by automation.
 */

interface RateLimitEntry {
  timestamps: number[];
  lockedUntil: number; // 0 = not locked
}

interface RateLimitConfig {
  /** Max allowed calls within the window */
  maxAttempts: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Lockout duration in ms after exceeding limit (0 = no lockout) */
  lockoutMs: number;
}

/** Predefined rate limit profiles */
export const RATE_LIMITS = {
  /** Biometric auth: 5 attempts per 60s, 5-minute lockout */
  BIOMETRIC_AUTH: { maxAttempts: 5, windowMs: 60_000, lockoutMs: 300_000 } as RateLimitConfig,
  /** Passcode auth: 10 attempts per 5 min, 15-minute lockout */
  PASSCODE_AUTH: { maxAttempts: 10, windowMs: 300_000, lockoutMs: 900_000 } as RateLimitConfig,
  /** Data export: 3 per hour, no lockout */
  DATA_EXPORT: { maxAttempts: 3, windowMs: 3_600_000, lockoutMs: 0 } as RateLimitConfig,
  /** AI queries: 30 per 5 min */
  AI_QUERY: { maxAttempts: 30, windowMs: 300_000, lockoutMs: 60_000 } as RateLimitConfig,
  /** Cloud wipe / destructive ops: 1 per 10 min */
  DESTRUCTIVE_OP: { maxAttempts: 1, windowMs: 600_000, lockoutMs: 600_000 } as RateLimitConfig,
  /** Profile changes: 20 per minute */
  PROFILE_UPDATE: { maxAttempts: 20, windowMs: 60_000, lockoutMs: 0 } as RateLimitConfig,
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number; // 0 if allowed
}

class RateLimiterService {
  private buckets = new Map<string, RateLimitEntry>();

  /**
   * Check if an action is allowed and record the attempt.
   */
  attempt(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    let entry = this.buckets.get(key);

    if (!entry) {
      entry = { timestamps: [], lockedUntil: 0 };
      this.buckets.set(key, entry);
    }

    // Check lockout
    if (entry.lockedUntil > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: entry.lockedUntil - now,
      };
    }

    // Slide the window — remove expired timestamps
    const windowStart = now - config.windowMs;
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);

    // Check rate
    if (entry.timestamps.length >= config.maxAttempts) {
      // Trigger lockout
      if (config.lockoutMs > 0) {
        entry.lockedUntil = now + config.lockoutMs;
      }
      const oldestInWindow = entry.timestamps[0] ?? now;
      const retryAfter = config.lockoutMs > 0
        ? config.lockoutMs
        : oldestInWindow + config.windowMs - now;

      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMs: Math.max(0, retryAfter),
      };
    }

    // Allow and record
    entry.timestamps.push(now);
    return {
      allowed: true,
      remainingAttempts: config.maxAttempts - entry.timestamps.length,
      retryAfterMs: 0,
    };
  }

  /**
   * Check remaining attempts without consuming one.
   */
  peek(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = this.buckets.get(key);

    if (!entry) {
      return { allowed: true, remainingAttempts: config.maxAttempts, retryAfterMs: 0 };
    }

    if (entry.lockedUntil > now) {
      return { allowed: false, remainingAttempts: 0, retryAfterMs: entry.lockedUntil - now };
    }

    const windowStart = now - config.windowMs;
    const activeTimestamps = entry.timestamps.filter(t => t > windowStart);
    const remaining = config.maxAttempts - activeTimestamps.length;

    return {
      allowed: remaining > 0,
      remainingAttempts: Math.max(0, remaining),
      retryAfterMs: remaining > 0 ? 0 : (activeTimestamps[0] ?? now) + config.windowMs - now,
    };
  }

  /**
   * Reset a specific rate limit bucket (e.g., after successful auth).
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Clear all rate limit buckets.
   */
  clearAll(): void {
    this.buckets.clear();
  }

  /**
   * Format retry-after duration for user display.
   */
  static formatRetryAfter(ms: number): string {
    if (ms <= 0) return '';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.ceil(minutes / 60)}h`;
  }
}

/** Format retry-after duration for user display */
export const formatRetryAfter = RateLimiterService.formatRetryAfter;

/** Singleton rate limiter */
export const rateLimiter = new RateLimiterService();
