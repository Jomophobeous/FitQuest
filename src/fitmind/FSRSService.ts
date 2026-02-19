/**
 * FSRSService — FSRS Algorithm Wrapper for FitQuest Flashcards
 * 
 * Wraps the ts-fsrs library to provide a clean interface for flashcard
 * spaced repetition scheduling using the FSRS-5 algorithm.
 * 
 * FSRS (Free Spaced Repetition Scheduler) provides ~40% better retention
 * than the traditional SM-2 algorithm by using a more sophisticated
 * memory model based on the DSR (Difficulty, Stability, Retrievability) model.
 * 
 * Key concepts:
 * - Stability: How long (in days) until memory retention drops to 90%
 * - Difficulty: Card difficulty (1-10 scale, affects stability growth)
 * - State: New(0) → Learning(1) → Review(2) ↔ Relearning(3)
 * - Rating: Again(1), Hard(2), Good(3), Easy(4)
 */

import {
  FSRS,
  createEmptyCard,
  Rating,
  State,
  type Card as FSRSCard,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs';
import type { Flashcard, FlashcardState } from '../database/types';

// ============================================
// TYPES
// ============================================

/**
 * FSRS rating from user review.
 * Maps to ts-fsrs Rating enum.
 */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Result of scheduling a flashcard review.
 */
export interface ScheduleResult {
  /** Updated card fields */
  card: {
    due: number;           // Next review timestamp (Unix ms)
    stability: number;     // Memory stability in days
    difficulty: number;    // Card difficulty (1-10)
    state: FlashcardState; // Learning state
    scheduled_days: number;
    reps: number;
    lapses: number;
    learning_steps: number;
    last_review: number;
  };
  /** Review log for analytics */
  log: {
    rating: number;
    scheduled_days: number;
    review_time: number;
  };
}

/**
 * Preview of all possible scheduling outcomes.
 * Useful for showing user what will happen with each rating.
 */
export interface SchedulePreview {
  again: ScheduleResult;
  hard: ScheduleResult;
  good: ScheduleResult;
  easy: ScheduleResult;
}

// ============================================
// FSRS SERVICE
// ============================================

export class FSRSService {
  private static instance: FSRSService | null = null;
  private fsrs: FSRS;

  private constructor() {
    // Initialize FSRS with default parameters
    // These are the FSRS-5 defaults optimized for learning
    this.fsrs = new FSRS({
      request_retention: 0.9, // Target 90% retention
      maximum_interval: 365,  // Max interval of 1 year
      enable_fuzz: true,      // Add small randomness to prevent clustering
      enable_short_term: true, // Use (re)learning steps
    });

    console.log('[FSRSService] Initialized with FSRS-5 algorithm');
  }

  static getInstance(): FSRSService {
    if (!FSRSService.instance) {
      FSRSService.instance = new FSRSService();
    }
    return FSRSService.instance;
  }

  // ============================================
  // CARD CREATION
  // ============================================

  /**
   * Create a new flashcard with FSRS initial values.
   * Returns fields to be saved to database.
   */
  createNewCard(): Omit<ScheduleResult['card'], 'last_review'> & { last_review: null } {
    const now = Date.now();
    return {
      due: now, // Due immediately for first review
      stability: 0,
      difficulty: 5, // Neutral difficulty (FSRS 1-10 scale)
      state: 0 as FlashcardState, // State.New
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      learning_steps: 0,
      last_review: null,
    };
  }

  // ============================================
  // REVIEW SCHEDULING
  // ============================================

  /**
   * Schedule a flashcard review based on user rating.
   * 
   * @param flashcard Current flashcard from database
   * @param rating User's recall rating ('again', 'hard', 'good', 'easy')
   * @returns Updated card fields and review log
   */
  scheduleReview(flashcard: Flashcard, rating: ReviewRating): ScheduleResult {
    const now = new Date();
    const fsrsCard = this.toFSRSCard(flashcard);
    const grade = this.ratingToGrade(rating);

    const result = this.fsrs.next(fsrsCard, now, grade);
    return this.toScheduleResult(result);
  }

  /**
   * Preview all possible scheduling outcomes.
   * Useful for showing the user what will happen with each choice.
   * 
   * @param flashcard Current flashcard from database
   * @returns Preview with all four rating outcomes
   */
  previewReview(flashcard: Flashcard): SchedulePreview {
    const now = new Date();
    const fsrsCard = this.toFSRSCard(flashcard);
    const preview = this.fsrs.repeat(fsrsCard, now);

    return {
      again: this.toScheduleResult(preview[Rating.Again]),
      hard: this.toScheduleResult(preview[Rating.Hard]),
      good: this.toScheduleResult(preview[Rating.Good]),
      easy: this.toScheduleResult(preview[Rating.Easy]),
    };
  }

  /**
   * Get the current retrievability (probability of recall) for a card.
   * 
   * @param flashcard Flashcard to check
   * @returns Retrievability as percentage (0-100)
   */
  getRetrievability(flashcard: Flashcard): number {
    const fsrsCard = this.toFSRSCard(flashcard);
    const retrievability = this.fsrs.get_retrievability(fsrsCard, new Date(), false);
    return Math.round(retrievability * 100);
  }

  /**
   * Reset a card to initial state (forget).
   * Useful when user wants to start over with a difficult card.
   * 
   * @param flashcard Flashcard to reset
   * @returns Reset card fields
   */
  forgetCard(flashcard: Flashcard): ScheduleResult {
    const now = new Date();
    const fsrsCard = this.toFSRSCard(flashcard);
    const result = this.fsrs.forget(fsrsCard, now, true); // reset_count = true
    return this.toScheduleResult(result);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Convert database Flashcard to ts-fsrs Card format.
   */
  private toFSRSCard(flashcard: Flashcard): FSRSCard {
    // Guard against null/undefined/NaN due values from migration edge cases
    const dueTimestamp = flashcard.due && !isNaN(flashcard.due) ? flashcard.due : Date.now();
    return {
      due: new Date(dueTimestamp),
      stability: flashcard.stability || 0,
      difficulty: flashcard.difficulty || 5,
      elapsed_days: 0, // Deprecated in FSRS, computed internally
      scheduled_days: flashcard.scheduled_days || 0,
      reps: flashcard.reps || 0,
      lapses: flashcard.lapses || 0,
      learning_steps: flashcard.learning_steps || 0,
      state: (flashcard.state ?? 0) as State,
      last_review: flashcard.last_review ? new Date(flashcard.last_review) : undefined,
    };
  }

  /**
   * Convert ts-fsrs result to our ScheduleResult format.
   */
  private toScheduleResult(result: RecordLogItem): ScheduleResult {
    const { card, log } = result;
    return {
      card: {
        due: card.due.getTime(),
        stability: card.stability,
        difficulty: card.difficulty,
        state: card.state as FlashcardState,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        learning_steps: card.learning_steps,
        last_review: log.review.getTime(),
      },
      log: {
        rating: log.rating,
        scheduled_days: log.scheduled_days,
        review_time: log.review.getTime(),
      },
    };
  }

  /**
   * Convert string rating to ts-fsrs Grade.
   */
  private ratingToGrade(rating: ReviewRating): Grade {
    switch (rating) {
      case 'again': return Rating.Again;
      case 'hard': return Rating.Hard;
      case 'good': return Rating.Good;
      case 'easy': return Rating.Easy;
    }
  }

  /**
   * Get human-readable interval description.
   * @param days Number of days until next review
   */
  static formatInterval(days: number): string {
    if (days < 1) {
      const minutes = Math.round(days * 24 * 60);
      if (minutes < 60) {
        return `${minutes}m`;
      }
      const hours = Math.round(minutes / 60);
      return `${hours}h`;
    }
    if (days < 7) {
      return `${Math.round(days)}d`;
    }
    if (days < 30) {
      return `${Math.round(days / 7)}w`;
    }
    if (days < 365) {
      return `${Math.round(days / 30)}mo`;
    }
    return `${(days / 365).toFixed(1)}y`;
  }

  /**
   * Get state label for display.
   */
  static getStateLabel(state: FlashcardState): string {
    switch (state) {
      case 0: return 'New';
      case 1: return 'Learning';
      case 2: return 'Review';
      case 3: return 'Relearning';
    }
  }
}

// Singleton export
export const fsrsService = FSRSService.getInstance();
