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

import { getDatabase } from '../database/schema';

// ============================================
// SCHEMA VERSION (FitMind extension)
// ============================================

const FITMIND_SCHEMA_VERSION = 1;

// ============================================
// TYPES
// ============================================

export type DocumentType = 'PDF' | 'EPUB' | 'ARTICLE' | 'NOTE';
export type DocumentStatus = 'UNREAD' | 'READING' | 'COMPLETED' | 'ARCHIVED';
export type FlashcardDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface FitMindDocument {
  id: string;
  title: string;
  author: string;
  type: DocumentType;
  status: DocumentStatus;
  category: string;
  tags: string;             // JSON array
  file_path: string | null; // Local file path
  file_size: number;        // bytes
  page_count: number;
  current_page: number;
  total_reading_time_ms: number;
  cover_image_uri: string | null;
  summary: string | null;   // AI-generated summary
  difficulty_level: number;  // 1-5
  language: string;          // ISO 639-1
  added_at: number;
  last_read_at: number | null;
  completed_at: number | null;
}

export interface ReadingSession {
  id: string;
  document_id: string;
  start_page: number;
  end_page: number;
  duration_ms: number;
  words_read: number;
  reading_speed_wpm: number;   // words per minute
  comprehension_score: number | null; // 0-100 (from quiz)
  focus_score: number;         // 0-100 (derived from session continuity)
  started_at: number;
  ended_at: number;
}

export interface Annotation {
  id: string;
  document_id: string;
  page_number: number;
  type: 'HIGHLIGHT' | 'NOTE' | 'BOOKMARK' | 'QUESTION';
  content: string;           // Highlighted text or note text
  color: string;             // Highlight color
  position_data: string;     // JSON: { startOffset, endOffset, ... }
  ai_insight: string | null; // AI-generated context/explanation
  created_at: number;
  updated_at: number;
}

export interface Flashcard {
  id: string;
  document_id: string | null;  // null = standalone card
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
  ease_factor: number;          // SM-2 algorithm
  interval_days: number;
  repetitions: number;
  next_review_at: number;
  last_reviewed_at: number | null;
  created_at: number;
}

export interface ReadingGoal {
  id: string;
  type: 'DAILY_PAGES' | 'DAILY_MINUTES' | 'WEEKLY_BOOKS' | 'MONTHLY_BOOKS';
  target: number;
  current: number;
  period_start: number;
  period_end: number;
  achieved: boolean;
}

// ============================================
// SCHEMA CREATION
// ============================================

/**
 * Create all FitMind tables. Called during app initialization.
 * Idempotent — safe to call multiple times.
 */
export async function createFitMindSchema(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    -- ============================================
    -- DOCUMENT LIBRARY
    -- ============================================
    CREATE TABLE IF NOT EXISTS fitmind_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Unknown',
      type TEXT NOT NULL CHECK(type IN ('PDF', 'EPUB', 'ARTICLE', 'NOTE')),
      status TEXT NOT NULL DEFAULT 'UNREAD' CHECK(status IN ('UNREAD', 'READING', 'COMPLETED', 'ARCHIVED')),
      category TEXT NOT NULL DEFAULT 'General',
      tags TEXT DEFAULT '[]',
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      page_count INTEGER DEFAULT 0,
      current_page INTEGER DEFAULT 0,
      total_reading_time_ms INTEGER DEFAULT 0,
      cover_image_uri TEXT,
      summary TEXT,
      difficulty_level INTEGER DEFAULT 3 CHECK(difficulty_level BETWEEN 1 AND 5),
      language TEXT DEFAULT 'en',
      added_at INTEGER NOT NULL,
      last_read_at INTEGER,
      completed_at INTEGER
    );

    -- ============================================
    -- READING SESSIONS
    -- ============================================
    CREATE TABLE IF NOT EXISTS fitmind_reading_sessions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES fitmind_documents(id) ON DELETE CASCADE,
      start_page INTEGER NOT NULL DEFAULT 0,
      end_page INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      words_read INTEGER DEFAULT 0,
      reading_speed_wpm REAL DEFAULT 0,
      comprehension_score REAL,
      focus_score REAL DEFAULT 100,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL
    );

    -- ============================================
    -- ANNOTATIONS (highlights, notes, bookmarks)
    -- ============================================
    CREATE TABLE IF NOT EXISTS fitmind_annotations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES fitmind_documents(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL CHECK(type IN ('HIGHLIGHT', 'NOTE', 'BOOKMARK', 'QUESTION')),
      content TEXT NOT NULL DEFAULT '',
      color TEXT DEFAULT '#FFD700',
      position_data TEXT DEFAULT '{}',
      ai_insight TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- ============================================
    -- FLASHCARDS (spaced repetition)
    -- ============================================
    CREATE TABLE IF NOT EXISTS fitmind_flashcards (
      id TEXT PRIMARY KEY,
      document_id TEXT REFERENCES fitmind_documents(id) ON DELETE SET NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(difficulty IN ('EASY', 'MEDIUM', 'HARD')),
      ease_factor REAL DEFAULT 2.5,
      interval_days INTEGER DEFAULT 1,
      repetitions INTEGER DEFAULT 0,
      next_review_at INTEGER NOT NULL,
      last_reviewed_at INTEGER,
      created_at INTEGER NOT NULL
    );

    -- ============================================
    -- READING GOALS
    -- ============================================
    CREATE TABLE IF NOT EXISTS fitmind_reading_goals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('DAILY_PAGES', 'DAILY_MINUTES', 'WEEKLY_BOOKS', 'MONTHLY_BOOKS')),
      target INTEGER NOT NULL DEFAULT 20,
      current INTEGER NOT NULL DEFAULT 0,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      achieved INTEGER DEFAULT 0
    );

    -- ============================================
    -- READING STREAKS
    -- ============================================
    CREATE TABLE IF NOT EXISTS fitmind_reading_streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'user_local_001',
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_read_date TEXT,
      total_books_completed INTEGER DEFAULT 0,
      total_pages_read INTEGER DEFAULT 0,
      total_reading_time_ms INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- ============================================
    -- INDEXES
    -- ============================================
    CREATE INDEX IF NOT EXISTS idx_fitmind_docs_status ON fitmind_documents(status, last_read_at);
    CREATE INDEX IF NOT EXISTS idx_fitmind_docs_category ON fitmind_documents(category);
    CREATE INDEX IF NOT EXISTS idx_fitmind_sessions_doc ON fitmind_reading_sessions(document_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_fitmind_annotations_doc ON fitmind_annotations(document_id, page_number);
    CREATE INDEX IF NOT EXISTS idx_fitmind_flashcards_review ON fitmind_flashcards(next_review_at);
    CREATE INDEX IF NOT EXISTS idx_fitmind_goals_type ON fitmind_reading_goals(type, period_start);
  `);

  console.log('[FitMind] Schema created (v' + FITMIND_SCHEMA_VERSION + ')');
}

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
  static async addDocument(doc: Omit<FitMindDocument, 'added_at' | 'last_read_at' | 'completed_at'>): Promise<string> {
    const db = await getDatabase();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO fitmind_documents 
       (id, title, author, type, status, category, tags, file_path, file_size, page_count, current_page,
        total_reading_time_ms, cover_image_uri, summary, difficulty_level, language, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doc.id, doc.title, doc.author, doc.type, doc.status || 'UNREAD',
        doc.category, doc.tags || '[]', doc.file_path, doc.file_size || 0,
        doc.page_count || 0, doc.current_page || 0, doc.total_reading_time_ms || 0,
        doc.cover_image_uri, doc.summary, doc.difficulty_level || 3,
        doc.language || 'en', now,
      ]
    );

    return doc.id;
  }

  /**
   * Get all documents, optionally filtered by status.
   */
  static async getDocuments(status?: DocumentStatus): Promise<FitMindDocument[]> {
    const db = await getDatabase();
    if (status) {
      return db.getAllAsync<FitMindDocument>(
        `SELECT * FROM fitmind_documents WHERE status = ? ORDER BY last_read_at DESC NULLS LAST, added_at DESC`,
        [status]
      );
    }
    return db.getAllAsync<FitMindDocument>(
      `SELECT * FROM fitmind_documents ORDER BY last_read_at DESC NULLS LAST, added_at DESC`
    );
  }

  /**
   * Get a single document by ID.
   */
  static async getDocument(id: string): Promise<FitMindDocument | null> {
    const db = await getDatabase();
    return db.getFirstAsync<FitMindDocument>(
      `SELECT * FROM fitmind_documents WHERE id = ?`,
      [id]
    );
  }

  /**
   * Update document reading progress.
   */
  static async updateProgress(docId: string, currentPage: number, additionalTimeMs: number): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();

    await db.runAsync(
      `UPDATE fitmind_documents 
       SET current_page = ?, 
           total_reading_time_ms = total_reading_time_ms + ?,
           last_read_at = ?,
           status = CASE 
             WHEN ? >= page_count AND page_count > 0 THEN 'COMPLETED'
             ELSE 'READING'
           END,
           completed_at = CASE 
             WHEN ? >= page_count AND page_count > 0 THEN ?
             ELSE completed_at
           END
       WHERE id = ?`,
      [currentPage, additionalTimeMs, now, currentPage, currentPage, now, docId]
    );
  }

  /**
   * Delete a document and all related data.
   */
  static async deleteDocument(id: string): Promise<void> {
    const db = await getDatabase();
    // CASCADE will handle sessions, annotations
    await db.runAsync(`DELETE FROM fitmind_documents WHERE id = ?`, [id]);
  }

  // ============================================
  // READING SESSIONS
  // ============================================

  /**
   * Record a reading session.
   */
  static async recordSession(session: Omit<ReadingSession, 'id'>): Promise<string> {
    const db = await getDatabase();
    const id = `rs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await db.runAsync(
      `INSERT INTO fitmind_reading_sessions 
       (id, document_id, start_page, end_page, duration_ms, words_read, reading_speed_wpm, 
        comprehension_score, focus_score, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, session.document_id, session.start_page, session.end_page,
        session.duration_ms, session.words_read, session.reading_speed_wpm,
        session.comprehension_score, session.focus_score,
        session.started_at, session.ended_at,
      ]
    );

    // Update document progress
    await FitMindService.updateProgress(
      session.document_id,
      session.end_page,
      session.duration_ms
    );

    return id;
  }

  /**
   * Get reading sessions for a document.
   */
  static async getSessions(docId: string, limit = 20): Promise<ReadingSession[]> {
    const db = await getDatabase();
    return db.getAllAsync<ReadingSession>(
      `SELECT * FROM fitmind_reading_sessions WHERE document_id = ? ORDER BY started_at DESC LIMIT ?`,
      [docId, limit]
    );
  }

  // ============================================
  // ANNOTATIONS
  // ============================================

  /**
   * Create an annotation (highlight, note, bookmark).
   */
  static async addAnnotation(annotation: Omit<Annotation, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const db = await getDatabase();
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO fitmind_annotations 
       (id, document_id, page_number, type, content, color, position_data, ai_insight, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, annotation.document_id, annotation.page_number,
        annotation.type, annotation.content, annotation.color || '#FFD700',
        annotation.position_data || '{}', annotation.ai_insight, now, now,
      ]
    );

    return id;
  }

  /**
   * Get annotations for a document page.
   */
  static async getAnnotations(docId: string, page?: number): Promise<Annotation[]> {
    const db = await getDatabase();
    if (page !== undefined) {
      return db.getAllAsync<Annotation>(
        `SELECT * FROM fitmind_annotations WHERE document_id = ? AND page_number = ? ORDER BY created_at`,
        [docId, page]
      );
    }
    return db.getAllAsync<Annotation>(
      `SELECT * FROM fitmind_annotations WHERE document_id = ? ORDER BY page_number, created_at`,
      [docId]
    );
  }

  /**
   * Delete an annotation.
   */
  static async deleteAnnotation(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM fitmind_annotations WHERE id = ?`, [id]);
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
    documentId?: string;
    difficulty?: FlashcardDifficulty;
  }): Promise<string> {
    const db = await getDatabase();
    const id = `fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const tomorrow = now + 86400000;

    await db.runAsync(
      `INSERT INTO fitmind_flashcards 
       (id, document_id, front, back, difficulty, ease_factor, interval_days, repetitions, next_review_at, created_at)
       VALUES (?, ?, ?, ?, ?, 2.5, 1, 0, ?, ?)`,
      [id, card.documentId || null, card.front, card.back, card.difficulty || 'MEDIUM', tomorrow, now]
    );

    return id;
  }

  /**
   * Get flashcards due for review.
   */
  static async getDueFlashcards(limit = 20): Promise<Flashcard[]> {
    const db = await getDatabase();
    const now = Date.now();
    return db.getAllAsync<Flashcard>(
      `SELECT * FROM fitmind_flashcards WHERE next_review_at <= ? ORDER BY next_review_at ASC LIMIT ?`,
      [now, limit]
    );
  }

  /**
   * Review a flashcard using SM-2 algorithm.
   * 
   * @param quality 0-5 (0=complete failure, 5=perfect recall)
   */
  static async reviewFlashcard(cardId: string, quality: number): Promise<void> {
    const db = await getDatabase();
    const card = await db.getFirstAsync<Flashcard>(
      `SELECT * FROM fitmind_flashcards WHERE id = ?`,
      [cardId]
    );

    if (!card) return;

    // SM-2 Algorithm
    let { ease_factor, interval_days, repetitions } = card;
    const now = Date.now();

    if (quality >= 3) {
      // Correct response
      if (repetitions === 0) {
        interval_days = 1;
      } else if (repetitions === 1) {
        interval_days = 6;
      } else {
        interval_days = Math.round(interval_days * ease_factor);
      }
      repetitions++;
    } else {
      // Incorrect — reset
      repetitions = 0;
      interval_days = 1;
    }

    // Update ease factor
    ease_factor = Math.max(
      1.3,
      ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    const nextReview = now + interval_days * 86400000;
    const difficulty: FlashcardDifficulty =
      quality >= 4 ? 'EASY' : quality >= 3 ? 'MEDIUM' : 'HARD';

    await db.runAsync(
      `UPDATE fitmind_flashcards 
       SET ease_factor = ?, interval_days = ?, repetitions = ?, 
           next_review_at = ?, last_reviewed_at = ?, difficulty = ?
       WHERE id = ?`,
      [ease_factor, interval_days, repetitions, nextReview, now, difficulty, cardId]
    );
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
    totalReadingTimeMs: number;
  }> {
    const db = await getDatabase();
    let row = await db.getFirstAsync<{
      current_streak: number;
      longest_streak: number;
      total_books_completed: number;
      total_pages_read: number;
      total_reading_time_ms: number;
    }>(`SELECT * FROM fitmind_reading_streaks WHERE user_id = 'user_local_001'`);

    if (!row) {
      await db.runAsync(
        `INSERT INTO fitmind_reading_streaks (user_id) VALUES ('user_local_001')`
      );
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalBooksCompleted: 0,
        totalPagesRead: 0,
        totalReadingTimeMs: 0,
      };
    }

    return {
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      totalBooksCompleted: row.total_books_completed,
      totalPagesRead: row.total_pages_read,
      totalReadingTimeMs: row.total_reading_time_ms,
    };
  }

  /**
   * Update reading streak after a session.
   */
  static async updateReadingStreak(pagesRead: number, timeMs: number): Promise<void> {
    const db = await getDatabase();
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();

    // Get current streak
    const row = await db.getFirstAsync<{
      current_streak: number;
      longest_streak: number;
      last_read_date: string | null;
    }>(`SELECT current_streak, longest_streak, last_read_date FROM fitmind_reading_streaks WHERE user_id = 'user_local_001'`);

    if (!row) {
      await db.runAsync(
        `INSERT INTO fitmind_reading_streaks (user_id, current_streak, longest_streak, last_read_date, total_pages_read, total_reading_time_ms)
         VALUES ('user_local_001', 1, 1, ?, ?, ?)`,
        [today, pagesRead, timeMs]
      );
      return;
    }

    let newStreak = row.current_streak;
    if (row.last_read_date !== today) {
      // Check if yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (row.last_read_date === yesterdayStr) {
        newStreak++;
      } else {
        newStreak = 1; // Streak broken
      }
    }

    const longestStreak = Math.max(row.longest_streak, newStreak);

    await db.runAsync(
      `UPDATE fitmind_reading_streaks 
       SET current_streak = ?, longest_streak = ?, last_read_date = ?,
           total_pages_read = total_pages_read + ?,
           total_reading_time_ms = total_reading_time_ms + ?,
           updated_at = ?
       WHERE user_id = 'user_local_001'`,
      [newStreak, longestStreak, today, pagesRead, timeMs, now]
    );
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
    const db = await getDatabase();
    const since = Date.now() - days * 86400000;

    const sessionStats = await db.getFirstAsync<{
      cnt: number;
      avg_speed: number;
      avg_focus: number;
      total_pages: number;
      total_time: number;
    }>(
      `SELECT 
         COUNT(*) as cnt,
         AVG(reading_speed_wpm) as avg_speed,
         AVG(focus_score) as avg_focus,
         SUM(end_page - start_page) as total_pages,
         SUM(duration_ms) as total_time
       FROM fitmind_reading_sessions 
       WHERE started_at > ?`,
      [since]
    );

    const completed = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM fitmind_documents WHERE status = 'COMPLETED' AND completed_at > ?`,
      [since]
    );

    const reading = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM fitmind_documents WHERE status = 'READING'`
    );

    return {
      sessionsCount: sessionStats?.cnt || 0,
      avgReadingSpeedWpm: Math.round(sessionStats?.avg_speed || 0),
      avgFocusScore: Math.round(sessionStats?.avg_focus || 0),
      totalPagesRead: sessionStats?.total_pages || 0,
      totalTimeMs: sessionStats?.total_time || 0,
      avgSessionDurationMs: sessionStats?.cnt
        ? Math.round((sessionStats.total_time || 0) / sessionStats.cnt)
        : 0,
      booksCompleted: completed?.cnt || 0,
      currentlyReading: reading?.cnt || 0,
    };
  }
}
