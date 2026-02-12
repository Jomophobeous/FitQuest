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
  // FLASHCARDS (SM-2 Spaced Repetition)
  // ============================================

  /**
   * Create a flashcard.
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
   * Get flashcards due for review.
   */
  static async getDueFlashcards(limit = 20): Promise<Flashcard[]> {
    return getFitMindDueFlashcards(limit);
  }

  /**
   * Review a flashcard using SM-2 algorithm.
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
