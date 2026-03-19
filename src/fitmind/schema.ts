/**
 * FitMind Schema — Cognitive Fitness Module
 * 
 * Tables for the "Mind" side of FitQuest 2.0:
 * - Document library (PDFs, EPUBs, articles)
 * - Reading sessions & analytics
 * - Annotations & highlights (encrypted)
 * - AI conversation history (encrypted, in EncryptedDatabase)
 * - Spaced-repetition flashcards
 * - Reading goals & streaks
 * 
 * All reading content and annotations stored as plaintext in SQLite.
 * Personal notes/highlights are encrypted via EncryptedDatabase.
 * AI conversations are encrypted via encrypted_ai_conversations table.
 */

import {
  addFitMindAnnotation,
  addFitMindDocument,
  addFitMindFlashcard,
  deleteFitMindAnnotation,
  deleteFitMindDocument,
  getFitMindAnnotations,
  getFitMindDocument,
  getFitMindDocuments,
  getFitMindDueFlashcards,
  getFitMindReadingAnalytics,
  getFitMindReadingStreak,
  getFitMindSessions,
  recordFitMindSession,
  reviewFitMindFlashcard,
  updateFitMindProgress,
  updateFitMindReadingStreak,
} from '../database/service';
import type {
  Annotation,
  DocumentStatus,
  DocumentType,
  FitMindDocument,
  Flashcard,
  ReadingGoal,
  ReadingSession,
} from '../database/types';

export type {
  Annotation,
  DocumentStatus,
  DocumentType,
  FitMindDocument,
  Flashcard,
  ReadingGoal,
  ReadingSession,
} from '../database/types';

// ============================================
// CRUD SERVICE
// ============================================

export class FitMindService {
  // ============================================
  // DOCUMENTS
  // ============================================

  /**
   * Add a document to the library.
   */
  static async addDocument(doc: Omit<FitMindDocument, 'created_at' | 'updated_at'>): Promise<string> {
    return addFitMindDocument(doc);
  }

  /**
   * Get all documents, optionally filtered by status.
   */
  static async getDocuments(status?: DocumentStatus): Promise<FitMindDocument[]> {
    return getFitMindDocuments(status);
  }

  /**
   * Get a single document by ID.
   */
  static async getDocument(id: string): Promise<FitMindDocument | null> {
    return getFitMindDocument(id);
  }

  /**
   * Update document reading progress.
   */
  static async updateProgress(docId: string, currentPage: number): Promise<void> {
    await updateFitMindProgress(docId, currentPage);
  }

  /**
   * Delete a document and all related data.
   */
  static async deleteDocument(id: string): Promise<void> {
    await deleteFitMindDocument(id);
  }

  /**
   * Index a document for semantic search and knowledge graph.
   * Call this when opening a document in the reader for the first time.
   */
  static async indexDocumentForSearch(docId: string): Promise<{
    success: boolean;
    chunksIndexed?: number;
    entitiesFound?: number;
    relationsFound?: number;
    indexTimeMs?: number;
    error?: string;
  }> {
    try {
      const doc = await getFitMindDocument(docId);
      if (!doc) {
        return { success: false, error: 'Document not found' };
      }
      
      if (!doc.content || doc.content.length < 50) {
        return { success: false, error: 'Document has no indexable content' };
      }
      
      // Import dualAI dynamically to avoid circular dependency
      const { dualAI } = await import('./DualAIEngine');
      const result = await dualAI.indexDocument(docId, doc.content, doc.title);
      
      return {
        success: true,
        ...result,
      };
    } catch (e: any) {
      if (__DEV__) console.error('[FitMindService] Index failed:', e);
      return { success: false, error: e.message || 'Indexing failed' };
    }
  }

  // ============================================
  // READING SESSIONS
  // ============================================

  /**
   * Record a reading session.
   */
  static async recordSession(session: Omit<ReadingSession, 'id' | 'created_at'>): Promise<string> {
    return recordFitMindSession(session);
  }

  /**
   * Get reading sessions for a document.
   */
  static async getSessions(docId: string, limit = 20): Promise<ReadingSession[]> {
    return getFitMindSessions(docId, limit);
  }

  // ============================================
  // ANNOTATIONS
  // ============================================

  /**
   * Create an annotation (highlight, note, bookmark).
   */
  static async addAnnotation(annotation: Omit<Annotation, 'id' | 'created_at'>): Promise<string> {
    return addFitMindAnnotation(annotation);
  }

  /**
   * Get annotations for a document page.
   */
  static async getAnnotations(docId: string, page?: number): Promise<Annotation[]> {
    return getFitMindAnnotations(docId, page);
  }

  /**
   * Delete an annotation.
   */
  static async deleteAnnotation(id: string): Promise<void> {
    await deleteFitMindAnnotation(id);
  }

  // ============================================
  // FLASHCARDS (FSRS Spaced Repetition)
  // ============================================

  /**
   * Create a flashcard with FSRS initial values.
   */
  static async addFlashcard(card: {
    front: string;
    back: string;
    documentId: string;
    difficulty?: number;
  }): Promise<string> {
    return addFitMindFlashcard(card);
  }

  /**
   * Get flashcards due for review (ordered by urgency).
   */
  static async getDueFlashcards(limit = 20): Promise<Flashcard[]> {
    return getFitMindDueFlashcards(limit);
  }

  /**
   * Review a flashcard using FSRS algorithm.
   * 
   * @param cardId Flashcard ID
   * @param rating 'again' | 'hard' | 'good' | 'easy'
   * @returns Updated card with scheduling info
   */
  static async reviewFlashcardFSRS(
    cardId: string,
    rating: 'again' | 'hard' | 'good' | 'easy'
  ): Promise<{ success: boolean; nextReviewIn?: string }> {
    const { getFitMindFlashcard, updateFitMindFlashcardFSRS } = await import('../database/service');
    const { fsrsService, FSRSService } = await import('./FSRSService');

    const card = await getFitMindFlashcard(cardId);
    if (!card) {
      return { success: false };
    }

    const result = fsrsService.scheduleReview(card, rating);
    await updateFitMindFlashcardFSRS(cardId, result.card);

    return {
      success: true,
      nextReviewIn: FSRSService.formatInterval(result.card.scheduled_days),
    };
  }

  /**
   * Preview what will happen for each rating option.
   * Useful for showing users the consequences of each choice.
   */
  static async previewFlashcardReview(cardId: string): Promise<{
    again: string;
    hard: string;
    good: string;
    easy: string;
  } | null> {
    const { getFitMindFlashcard } = await import('../database/service');
    const { fsrsService, FSRSService } = await import('./FSRSService');

    const card = await getFitMindFlashcard(cardId);
    if (!card) return null;

    const preview = fsrsService.previewReview(card);
    return {
      again: FSRSService.formatInterval(preview.again.card.scheduled_days),
      hard: FSRSService.formatInterval(preview.hard.card.scheduled_days),
      good: FSRSService.formatInterval(preview.good.card.scheduled_days),
      easy: FSRSService.formatInterval(preview.easy.card.scheduled_days),
    };
  }

  /**
   * Get the current retrievability (probability of recall) for a card.
   * @returns Percentage 0-100, or null if card not found
   */
  static async getFlashcardRetrievability(cardId: string): Promise<number | null> {
    const { getFitMindFlashcard } = await import('../database/service');
    const { fsrsService } = await import('./FSRSService');

    const card = await getFitMindFlashcard(cardId);
    if (!card) return null;

    return fsrsService.getRetrievability(card);
  }

  /**
   * Reset a card to initial state (forget and start over).
   */
  static async resetFlashcard(cardId: string): Promise<boolean> {
    const { getFitMindFlashcard, updateFitMindFlashcardFSRS } = await import('../database/service');
    const { fsrsService } = await import('./FSRSService');

    const card = await getFitMindFlashcard(cardId);
    if (!card) return false;

    const result = fsrsService.forgetCard(card);
    await updateFitMindFlashcardFSRS(cardId, result.card);
    return true;
  }

  /**
   * @deprecated Use reviewFlashcardFSRS() instead.
   * Legacy SM-2 review function for backwards compatibility.
   * 
   * @param quality 0-5 (0=complete failure, 5=perfect recall)
   */
  static async reviewFlashcard(cardId: string, quality: number): Promise<void> {
    await reviewFitMindFlashcard(cardId, quality);
  }

  // ============================================
  // READING GOALS & STREAKS
  // ============================================

  /**
   * Get or create reading streak record.
   */
  static async getReadingStreak(): Promise<{
    currentStreak: number;
    longestStreak: number;
    totalBooksCompleted: number;
    totalPagesRead: number;
    totalMinutesRead: number;
  }> {
    return getFitMindReadingStreak();
  }

  /**
   * Update reading streak after a session.
   */
  static async updateReadingStreak(pagesRead: number, minutesRead: number): Promise<void> {
    await updateFitMindReadingStreak(pagesRead, minutesRead);
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get reading analytics summary.
   */
  static async getReadingAnalytics(days = 30): Promise<{
    sessionsCount: number;
    avgReadingSpeedWpm: number;
    avgFocusScore: number;
    totalPagesRead: number;
    totalTimeMs: number;
    avgSessionDurationMs: number;
    booksCompleted: number;
    currentlyReading: number;
  }> {
    return getFitMindReadingAnalytics(days);
  }
}
