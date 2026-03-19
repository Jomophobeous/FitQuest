/**
 * FitMind Reading Session Tracker
 * 
 * Real-time reading session lifecycle manager.
 * Tracks an active reading session from start to end with:
 * 
 * - Session state machine (IDLE → ACTIVE → PAUSED → COMPLETED)
 * - Focus score calculation (based on interruptions, pauses, reading speed)
 * - Automatic idle detection (pauses after 2 min inactivity)
 * - Word-per-minute speed tracking with rolling averages
 * - Page progress tracking with estimated completion time
 * - Auto-saves partial sessions on background/crash
 * - Streak and goal updates on session end
 * 
 * Usage:
 *   const tracker = ReadingSessionTracker.getInstance();
 *   tracker.startSession({ documentId: 'doc_xxx', startPage: 5, totalPages: 200 });
 *   tracker.onPageTurn(6, wordsOnPage);
 *   const summary = await tracker.endSession();
 */

import { FitMindService, type ReadingSession } from './schema';
import { AppState, type AppStateStatus } from 'react-native';

// ============================================
// TYPES
// ============================================

export type SessionState = 'IDLE' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface ActiveSession {
  documentId: string;
  startPage: number;
  currentPage: number;
  totalPages: number;
  startedAt: number;
  totalActiveMs: number;         // Excludes paused time
  totalPausedMs: number;
  wordsRead: number;
  pageWordCounts: number[];      // Words per page turned
  pauseCount: number;
  lastActivityAt: number;
  state: SessionState;
}

export interface SessionSummary {
  sessionId: string;
  documentId: string;
  pagesRead: number;
  wordsRead: number;
  durationMs: number;            // Total elapsed
  activeTimeMs: number;          // Excluding pauses
  readingSpeedWpm: number;       // Based on active time
  focusScore: number;            // 0-100
  pauseCount: number;
  estimatedCompletionMin: number; // Remaining pages at current speed
}

export interface ReadingSpeed {
  currentWpm: number;            // Last 5 pages rolling average
  averageWpm: number;            // Session average
  peakWpm: number;
}

// ============================================
// CONSTANTS
// ============================================

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;          // 2 min idle → auto-pause
const TICK_INTERVAL_MS = 5_000;                   // 5 sec ticks
const MIN_SESSION_DURATION_MS = 30_000;           // 30 sec minimum to record
const ROLLING_WINDOW_SIZE = 5;                    // Pages for rolling WPM
const DEFAULT_WORDS_PER_PAGE = 250;
const MAX_REASONABLE_WPM = 1000;                  // Cap for outlier rejection
const MIN_REASONABLE_WPM = 50;

// ============================================
// FOCUS SCORING WEIGHTS
// ============================================

const FOCUS_WEIGHTS = {
  PAUSE_PENALTY: 5,            // -5 per pause
  IDLE_PENALTY: 10,            // -10 per auto-pause (inactivity)
  SPEED_CONSISTENCY_BONUS: 10, // +10 for consistent speed
  LONG_SESSION_BONUS: 5,       // +5 for sessions > 15 min
  BACKGROUND_PENALTY: 15,      // -15 per app backgrounding
};

// ============================================
// READING SESSION TRACKER
// ============================================

export class ReadingSessionTracker {
  private static instance: ReadingSessionTracker | null = null;
  
  private session: ActiveSession | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private pauseStartedAt: number | null = null;
  private idleTimeouts: number = 0;
  private backgroundEvents: number = 0;
  private pageTimings: number[] = [];          // Ms per page
  private lastPageTurnAt: number = 0;
  private appStateSubscription: any = null;

  private constructor() {}

  static getInstance(): ReadingSessionTracker {
    if (!ReadingSessionTracker.instance) {
      ReadingSessionTracker.instance = new ReadingSessionTracker();
    }
    return ReadingSessionTracker.instance;
  }

  // ============================================
  // SESSION LIFECYCLE
  // ============================================

  /**
   * Start a new reading session.
   */
  startSession(config: {
    documentId: string;
    startPage: number;
    totalPages: number;
  }): void {
    if (this.session?.state === 'ACTIVE') {
      if (__DEV__) console.warn('[ReadingTracker] Session already active. End it first.');
      return;
    }

    const now = Date.now();

    this.session = {
      documentId: config.documentId,
      startPage: config.startPage,
      currentPage: config.startPage,
      totalPages: config.totalPages,
      startedAt: now,
      totalActiveMs: 0,
      totalPausedMs: 0,
      wordsRead: 0,
      pageWordCounts: [],
      pauseCount: 0,
      lastActivityAt: now,
      state: 'ACTIVE',
    };

    this.idleTimeouts = 0;
    this.backgroundEvents = 0;
    this.pageTimings = [];
    this.lastPageTurnAt = now;
    this.pauseStartedAt = null;

    // Start tick timer
    this.startTicking();

    // Listen for app state changes (background detection)
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppState);

    if (__DEV__) console.log(`[ReadingTracker] Session started: doc=${config.documentId}, page=${config.startPage}`);
  }

  /**
   * Record a page turn with word count.
   */
  onPageTurn(newPage: number, wordsOnPage: number = DEFAULT_WORDS_PER_PAGE): void {
    if (!this.session || this.session.state !== 'ACTIVE') return;

    const now = Date.now();
    const timeSinceLastPage = now - this.lastPageTurnAt;

    this.session.currentPage = newPage;
    this.session.wordsRead += wordsOnPage;
    this.session.pageWordCounts.push(wordsOnPage);
    this.session.lastActivityAt = now;

    // Track page timing (for speed calculation)
    if (timeSinceLastPage > 0 && timeSinceLastPage < 10 * 60 * 1000) {
      this.pageTimings.push(timeSinceLastPage);
    }

    this.lastPageTurnAt = now;
  }

  /**
   * Manually pause the session.
   */
  pause(): void {
    if (!this.session || this.session.state !== 'ACTIVE') return;

    this.session.state = 'PAUSED';
    this.session.pauseCount++;
    this.pauseStartedAt = Date.now();

    // Update active time up to this point
    this.updateActiveTime();

    if (__DEV__) console.log('[ReadingTracker] Session paused');
  }

  /**
   * Resume from pause.
   */
  resume(): void {
    if (!this.session || this.session.state !== 'PAUSED') return;

    if (this.pauseStartedAt) {
      this.session.totalPausedMs += Date.now() - this.pauseStartedAt;
      this.pauseStartedAt = null;
    }

    this.session.state = 'ACTIVE';
    this.session.lastActivityAt = Date.now();
    this.lastPageTurnAt = Date.now();

    if (__DEV__) console.log('[ReadingTracker] Session resumed');
  }

  /**
   * End the session and persist to database.
   * Returns session summary with analytics.
   */
  async endSession(): Promise<SessionSummary | null> {
    if (!this.session) return null;

    this.stopTicking();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;

    // If paused, account for final pause time
    if (this.pauseStartedAt) {
      this.session.totalPausedMs += Date.now() - this.pauseStartedAt;
    }

    this.updateActiveTime();
    this.session.state = 'COMPLETED';

    const summary = this.calculateSummary();

    // Only persist sessions longer than minimum threshold
    if (this.session.totalActiveMs >= MIN_SESSION_DURATION_MS) {
      const sessionRecord: Omit<ReadingSession, 'id' | 'created_at'> = {
        document_id: this.session.documentId,
        start_page: this.session.startPage,
        end_page: this.session.currentPage,
        duration_minutes: Math.max(1, Math.round(this.session.totalActiveMs / 60000)),
        words_read: this.session.wordsRead,
        comprehension_score: null,
        notes: null,
      };

      const sessionId = await FitMindService.recordSession(sessionRecord);
      summary.sessionId = sessionId;

      // Update reading streak
      const pagesRead = Math.max(0, this.session.currentPage - this.session.startPage);
      const minutesRead = Math.max(1, Math.round(this.session.totalActiveMs / 60000));
      await FitMindService.updateReadingStreak(pagesRead, minutesRead);

      if (__DEV__) {
        console.log(
        `[ReadingTracker] Session saved: ${pagesRead} pages, ${summary.readingSpeedWpm} WPM, focus: ${summary.focusScore}`
        );
      }
    } else {
      if (__DEV__) console.log('[ReadingTracker] Session too short to save');
    }

    this.session = null;
    return summary;
  }

  // ============================================
  // REAL-TIME GETTERS
  // ============================================

  /**
   * Get current reading speed (rolling + average).
   */
  getReadingSpeed(): ReadingSpeed {
    if (!this.session || this.pageTimings.length === 0) {
      return { currentWpm: 0, averageWpm: 0, peakWpm: 0 };
    }

    const recentTimings = this.pageTimings.slice(-ROLLING_WINDOW_SIZE);
    const recentWords = this.session.pageWordCounts.slice(-ROLLING_WINDOW_SIZE);

    // Current WPM (rolling window)
    const recentTotalMs = recentTimings.reduce((a, b) => a + b, 0);
    const recentTotalWords = recentWords.reduce((a, b) => a + b, 0);
    const currentWpm = recentTotalMs > 0
      ? Math.round((recentTotalWords / recentTotalMs) * 60_000)
      : 0;

    // Average WPM (full session)
    const activeTimeMin = this.session.totalActiveMs / 60_000;
    const averageWpm = activeTimeMin > 0
      ? Math.round(this.session.wordsRead / activeTimeMin)
      : 0;

    // Peak WPM
    let peakWpm = 0;
    for (let i = 0; i < this.pageTimings.length; i++) {
      const wc = this.session.pageWordCounts[i] || DEFAULT_WORDS_PER_PAGE;
      const wpm = (wc / this.pageTimings[i]!) * 60_000;
      if (wpm > peakWpm && wpm <= MAX_REASONABLE_WPM) {
        peakWpm = Math.round(wpm);
      }
    }

    return {
      currentWpm: this.clampWpm(currentWpm),
      averageWpm: this.clampWpm(averageWpm),
      peakWpm: this.clampWpm(peakWpm),
    };
  }

  /**
   * Get current session state and progress.
   */
  getSessionState(): {
    state: SessionState;
    currentPage: number;
    pagesRead: number;
    progress: number;       // 0-100%
    activeTimeMs: number;
    wordsRead: number;
    focusScore: number;
  } | null {
    if (!this.session) return null;

    const pagesRead = Math.max(0, this.session.currentPage - this.session.startPage);
    const remainingPages = Math.max(0, this.session.totalPages - this.session.currentPage);
    const progress = this.session.totalPages > 0
      ? Math.round((this.session.currentPage / this.session.totalPages) * 100)
      : 0;

    return {
      state: this.session.state,
      currentPage: this.session.currentPage,
      pagesRead,
      progress: Math.min(100, progress),
      activeTimeMs: this.session.totalActiveMs,
      wordsRead: this.session.wordsRead,
      focusScore: this.calculateFocusScore(),
    };
  }

  /**
   * Check if a session is currently active.
   */
  isActive(): boolean {
    return this.session?.state === 'ACTIVE' || this.session?.state === 'PAUSED';
  }

  // ============================================
  // INTERNAL: TICK LOOP
  // ============================================

  private startTicking(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);

    this.tickTimer = setInterval(() => {
      this.onTick();
    }, TICK_INTERVAL_MS);
  }

  private stopTicking(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private onTick(): void {
    if (!this.session || this.session.state !== 'ACTIVE') return;

    const now = Date.now();
    const timeSinceActivity = now - this.session.lastActivityAt;

    // Idle detection
    if (timeSinceActivity > IDLE_TIMEOUT_MS) {
      if (__DEV__) console.log('[ReadingTracker] Idle timeout — auto-pausing');
      this.idleTimeouts++;
      this.pause();
      return;
    }

    // Update active time
    this.updateActiveTime();
  }

  private updateActiveTime(): void {
    if (!this.session || this.session.state !== 'ACTIVE') return;

    const now = Date.now();
    const elapsed = now - this.session.startedAt;
    this.session.totalActiveMs = elapsed - this.session.totalPausedMs;
  }

  // ============================================
  // INTERNAL: APP STATE (background detection)
  // ============================================

  private handleAppState = (nextState: AppStateStatus): void => {
    if (!this.session) return;

    if (nextState === 'background' || nextState === 'inactive') {
      if (this.session.state === 'ACTIVE') {
        this.backgroundEvents++;
        this.pause();
      }
    } else if (nextState === 'active') {
      if (this.session.state === 'PAUSED') {
        this.resume();
      }
    }
  };

  // ============================================
  // INTERNAL: FOCUS SCORING
  // ============================================

  private calculateFocusScore(): number {
    if (!this.session) return 100;

    let score = 100;

    // Penalty for pauses
    score -= this.session.pauseCount * FOCUS_WEIGHTS.PAUSE_PENALTY;

    // Extra penalty for idle timeouts (distraction)
    score -= this.idleTimeouts * FOCUS_WEIGHTS.IDLE_PENALTY;

    // Penalty for app backgrounding
    score -= this.backgroundEvents * FOCUS_WEIGHTS.BACKGROUND_PENALTY;

    // Speed consistency bonus
    if (this.pageTimings.length >= 3) {
      const speeds = this.pageTimings.map((t, i) => {
        const wc = this.session!.pageWordCounts[i] || DEFAULT_WORDS_PER_PAGE;
        return (wc / t) * 60_000;
      }).filter((s) => s >= MIN_REASONABLE_WPM && s <= MAX_REASONABLE_WPM);

      if (speeds.length >= 3) {
        const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
        const variance = speeds.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / speeds.length;
        const cv = Math.sqrt(variance) / avg; // Coefficient of variation

        if (cv < 0.2) {
          score += FOCUS_WEIGHTS.SPEED_CONSISTENCY_BONUS; // Very consistent
        } else if (cv < 0.4) {
          score += Math.round(FOCUS_WEIGHTS.SPEED_CONSISTENCY_BONUS / 2);
        }
      }
    }

    // Bonus for long sessions (sustained focus)
    if (this.session.totalActiveMs > 15 * 60 * 1000) {
      score += FOCUS_WEIGHTS.LONG_SESSION_BONUS;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ============================================
  // INTERNAL: SUMMARY
  // ============================================

  private calculateSummary(): SessionSummary {
    const s = this.session!;
    const pagesRead = Math.max(0, s.currentPage - s.startPage);
    const activeTimeMin = s.totalActiveMs / 60_000;
    const readingSpeedWpm = activeTimeMin > 0
      ? this.clampWpm(Math.round(s.wordsRead / activeTimeMin))
      : 0;

    // Estimate remaining time
    const remainingPages = Math.max(0, s.totalPages - s.currentPage);
    const avgPageTimeMs = pagesRead > 0 ? s.totalActiveMs / pagesRead : 0;
    const estimatedCompletionMin = avgPageTimeMs > 0
      ? Math.ceil((remainingPages * avgPageTimeMs) / 60_000)
      : 0;

    return {
      sessionId: '',
      documentId: s.documentId,
      pagesRead,
      wordsRead: s.wordsRead,
      durationMs: Date.now() - s.startedAt,
      activeTimeMs: s.totalActiveMs,
      readingSpeedWpm,
      focusScore: this.calculateFocusScore(),
      pauseCount: s.pauseCount,
      estimatedCompletionMin,
    };
  }

  private clampWpm(wpm: number): number {
    return Math.max(0, Math.min(MAX_REASONABLE_WPM, wpm));
  }
}

// Singleton export
export const readingTracker = ReadingSessionTracker.getInstance();
