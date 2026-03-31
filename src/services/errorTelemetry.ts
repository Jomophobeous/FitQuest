/**
 * ErrorTelemetry Service
 *
 * Centralized error capture and telemetry for FitQuest.
 * Currently stores errors locally in SQLite.
 * Ready to integrate with external services (Sentry, Bugsnag) when needed.
 */

import { Platform } from 'react-native';
import { systemGuard } from './SystemGuard';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory =
  | 'reader_boot'
  | 'reader_render'
  | 'document_open'
  | 'health_sync'
  | 'database'
  | 'encryption'
  | 'navigation'
  | 'network'
  | 'general';

export interface ErrorEvent {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  platform: string;
  resolved: boolean;
}

const MAX_STORED_ERRORS = 100;
const ERROR_STORAGE_KEY = 'error_telemetry_log';

class ErrorTelemetryService {
  private static instance: ErrorTelemetryService;
  private errors: ErrorEvent[] = [];
  private initialized = false;

  private constructor() {}

  static getInstance(): ErrorTelemetryService {
    if (!ErrorTelemetryService.instance) {
      ErrorTelemetryService.instance = new ErrorTelemetryService();
    }
    return ErrorTelemetryService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Only load stored errors if DB is available
      if (systemGuard.isReady) {
        const { getAppState } = await import('../database/service');
        const stored = await getAppState(ERROR_STORAGE_KEY);
        if (stored) {
          try {
            this.errors = JSON.parse(stored);
          } catch {
            this.errors = [];
          }
        }
      }
      this.initialized = true;
    } catch (error) {
      // Silent fail - telemetry shouldn't crash the app
      if (__DEV__) console.warn('[ErrorTelemetry] Failed to initialize:', error);
      this.initialized = true;
    }
  }

  /**
   * Capture an error with context
   */
  async captureError(
    error: Error | string,
    options: {
      category: ErrorCategory;
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
    },
  ): Promise<string> {
    const errorEvent: ErrorEvent = {
      id: `err_${Date.now()}_${Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36))
        .join('')
        .slice(0, 7)}`,
      category: options.category,
      severity: options.severity || 'medium',
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' ? error.stack : undefined,
      context: options.context,
      timestamp: Date.now(),
      platform: Platform.OS,
      resolved: false,
    };

    this.errors.unshift(errorEvent);

    // Trim to max size
    if (this.errors.length > MAX_STORED_ERRORS) {
      this.errors = this.errors.slice(0, MAX_STORED_ERRORS);
    }

    // Persist to SQLite (non-blocking)
    this.persistErrors().catch((e) => {
      if (__DEV__) console.warn('[ErrorTelem] persist failed', e);
    });

    // Log to console in development
    if (__DEV__) {
      console.error(`[ErrorTelemetry] ${options.category}:`, {
        message: errorEvent.message,
        severity: errorEvent.severity,
        context: options.context,
      });
    }

    return errorEvent.id;
  }

  /**
   * Capture reader-specific errors with enhanced context
   */
  async captureReaderError(
    error: Error | string,
    readerContext: {
      engine: string;
      documentType?: string;
      documentId?: string;
      phase: 'boot' | 'render' | 'navigate' | 'fallback';
    },
  ): Promise<string> {
    const category: ErrorCategory = readerContext.phase === 'boot' ? 'reader_boot' : 'reader_render';

    return this.captureError(error, {
      category,
      severity: readerContext.phase === 'boot' ? 'high' : 'medium',
      context: {
        engine: readerContext.engine,
        documentType: readerContext.documentType,
        documentId: readerContext.documentId,
        phase: readerContext.phase,
      },
    });
  }

  /**
   * Capture health sync errors
   */
  async captureHealthError(
    error: Error | string,
    healthContext: {
      provider: 'health_connect' | 'healthkit' | 'google_fit';
      action: 'read' | 'write' | 'sync' | 'auth';
      dataType?: string;
    },
  ): Promise<string> {
    return this.captureError(error, {
      category: 'health_sync',
      severity: healthContext.action === 'write' ? 'high' : 'medium',
      context: {
        provider: healthContext.provider,
        action: healthContext.action,
        dataType: healthContext.dataType,
      },
    });
  }

  /**
   * Mark an error as resolved
   */
  async resolveError(errorId: string): Promise<void> {
    const error = this.errors.find((e) => e.id === errorId);
    if (error) {
      error.resolved = true;
      await this.persistErrors();
    }
  }

  /**
   * Get recent errors, optionally filtered
   */
  getRecentErrors(options?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    limit?: number;
    unresolvedOnly?: boolean;
  }): ErrorEvent[] {
    let filtered = this.errors;

    if (options?.category) {
      filtered = filtered.filter((e) => e.category === options.category);
    }
    if (options?.severity) {
      filtered = filtered.filter((e) => e.severity === options.severity);
    }
    if (options?.unresolvedOnly) {
      filtered = filtered.filter((e) => !e.resolved);
    }

    return filtered.slice(0, options?.limit || 20);
  }

  /**
   * Get error summary stats
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<string, number>;
    unresolved: number;
  } {
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    const byCategory: Record<string, number> = {};
    let unresolved = 0;

    for (const error of this.errors) {
      bySeverity[error.severity]++;
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      if (!error.resolved) unresolved++;
    }

    return {
      total: this.errors.length,
      bySeverity,
      byCategory,
      unresolved,
    };
  }

  /**
   * Clear all stored errors
   */
  async clearErrors(): Promise<void> {
    this.errors = [];
    await this.persistErrors();
  }

  private async persistErrors(): Promise<void> {
    if (!systemGuard.isReady) return; // DB unavailable — skip persist, keep in-memory
    try {
      const { setAppState } = await import('../database/service');
      await setAppState(ERROR_STORAGE_KEY, JSON.stringify(this.errors));
    } catch {
      // Silent fail
    }
  }
}

// Singleton export
export const errorTelemetry = ErrorTelemetryService.getInstance();

// Convenience functions
export const captureError = errorTelemetry.captureError.bind(errorTelemetry);
export const captureReaderError = errorTelemetry.captureReaderError.bind(errorTelemetry);
export const captureHealthError = errorTelemetry.captureHealthError.bind(errorTelemetry);
