/**
 * FitMind Document Processor
 * 
 * On-device document processing pipeline:
 * - Import documents (pick from device, URLs)
 * - Extract text from supported formats
 * - Text analysis (word count, reading time, difficulty)
 * - Generate document metadata
 * - Create searchable index
 * 
 * All processing happens on-device. No external API calls.
 * Uses expo-file-system for storage, expo-document-picker for import.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { FitMindService, type DocumentType, type FitMindDocument } from './schema';

// ============================================
// TYPES
// ============================================

export interface ProcessedDocument {
  id: string;
  title: string;
  author: string;
  type: DocumentType;
  wordCount: number;
  estimatedReadingTimeMinutes: number;
  difficultyLevel: number;     // 1-5
  language: string;
  pageCount: number;
  filePath: string;
  fileSize: number;
  chapters: ChapterInfo[];
}

export interface ChapterInfo {
  index: number;
  title: string;
  startPage: number;
  wordCount: number;
}

export interface ImportResult {
  success: boolean;
  documentId?: string;
  error?: string;
  document?: ProcessedDocument;
}

export interface TextAnalysis {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  avgWordLength: number;
  difficultyLevel: number;       // 1-5 (Flesch-Kincaid simplified)
  estimatedReadingTimeMinutes: number;
  topKeywords: string[];
}

// ============================================
// CONSTANTS
// ============================================

const FITMIND_DIR = `${FileSystem.documentDirectory}fitmind/`;
const AVG_READING_SPEED_WPM = 250;
const AVG_WORDS_PER_PAGE = 250;

// ============================================
// DOCUMENT PROCESSOR
// ============================================

export class DocumentProcessor {
  /**
   * Ensure FitMind storage directory exists.
   */
  static async ensureDirectory(): Promise<void> {
    const info = await FileSystem.getInfoAsync(FITMIND_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(FITMIND_DIR, { intermediates: true });
    }
  }

  // ============================================
  // IMPORT
  // ============================================

  /**
   * Import a document from a local file URI (from document picker).
   */
  static async importFromFile(
    sourceUri: string,
    metadata?: { title?: string; author?: string; category?: string }
  ): Promise<ImportResult> {
    try {
      await DocumentProcessor.ensureDirectory();

      // Determine file type
      const type = DocumentProcessor.detectFileType(sourceUri);
      if (!type) {
        return { success: false, error: 'Unsupported file type. Supported: PDF, EPUB, TXT' };
      }

      // Generate unique ID
      const idBytes = await Crypto.getRandomBytesAsync(8);
      const id = `doc_${Array.from(idBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;

      // Copy file to FitMind directory
      const ext = sourceUri.split('.').pop()?.toLowerCase() || 'txt';
      const destPath = `${FITMIND_DIR}${id}.${ext}`;
      await FileSystem.copyAsync({ from: sourceUri, to: destPath });

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(destPath);
      const fileSize = (fileInfo as any).size || 0;

      // Extract and analyze text
      const analysis = await DocumentProcessor.analyzeFile(destPath, type);

      // Infer title from filename if not provided
      const fileName = sourceUri.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Untitled';
      const title = metadata?.title || DocumentProcessor.formatTitle(fileName);

      const processed: ProcessedDocument = {
        id,
        title,
        author: metadata?.author || 'Unknown',
        type,
        wordCount: analysis.wordCount,
        estimatedReadingTimeMinutes: analysis.estimatedReadingTimeMinutes,
        difficultyLevel: analysis.difficultyLevel,
        language: 'en',
        pageCount: Math.max(1, Math.ceil(analysis.wordCount / AVG_WORDS_PER_PAGE)),
        filePath: destPath,
        fileSize,
        chapters: [],
      };

      // Save to database
      await FitMindService.addDocument({
        id: processed.id,
        title: processed.title,
        author: processed.author,
        type: processed.type,
        status: 'UNREAD',
        category: metadata?.category || 'General',
        tags: '[]',
        file_path: processed.filePath,
        file_size: processed.fileSize,
        page_count: processed.pageCount,
        current_page: 0,
        total_reading_time_ms: 0,
        cover_image_uri: null,
        summary: null,
        difficulty_level: processed.difficultyLevel,
        language: processed.language,
      });

      return { success: true, documentId: id, document: processed };
    } catch (e: any) {
      console.error('[DocumentProcessor] Import failed:', e);
      return { success: false, error: e.message || 'Import failed' };
    }
  }

  /**
   * Import a document from plain text content (e.g., pasted article).
   */
  static async importFromText(
    content: string,
    metadata: { title: string; author?: string; category?: string }
  ): Promise<ImportResult> {
    try {
      await DocumentProcessor.ensureDirectory();

      const idBytes = await Crypto.getRandomBytesAsync(8);
      const id = `doc_${Array.from(idBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;

      const destPath = `${FITMIND_DIR}${id}.txt`;
      await FileSystem.writeAsStringAsync(destPath, content);

      const analysis = DocumentProcessor.analyzeText(content);
      const fileInfo = await FileSystem.getInfoAsync(destPath);

      const processed: ProcessedDocument = {
        id,
        title: metadata.title,
        author: metadata.author || 'Unknown',
        type: 'ARTICLE',
        wordCount: analysis.wordCount,
        estimatedReadingTimeMinutes: analysis.estimatedReadingTimeMinutes,
        difficultyLevel: analysis.difficultyLevel,
        language: 'en',
        pageCount: Math.max(1, Math.ceil(analysis.wordCount / AVG_WORDS_PER_PAGE)),
        filePath: destPath,
        fileSize: (fileInfo as any).size || content.length,
        chapters: [],
      };

      await FitMindService.addDocument({
        id: processed.id,
        title: processed.title,
        author: processed.author,
        type: processed.type,
        status: 'UNREAD',
        category: metadata.category || 'General',
        tags: '[]',
        file_path: processed.filePath,
        file_size: processed.fileSize,
        page_count: processed.pageCount,
        current_page: 0,
        total_reading_time_ms: 0,
        cover_image_uri: null,
        summary: null,
        difficulty_level: processed.difficultyLevel,
        language: processed.language,
      });

      return { success: true, documentId: id, document: processed };
    } catch (e: any) {
      return { success: false, error: e.message || 'Import failed' };
    }
  }

  /**
   * Import from a URL (download article text).
   */
  static async importFromUrl(
    url: string,
    metadata?: { title?: string; author?: string; category?: string }
  ): Promise<ImportResult> {
    try {
      await DocumentProcessor.ensureDirectory();

      const idBytes = await Crypto.getRandomBytesAsync(8);
      const id = `doc_${Array.from(idBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
      const destPath = `${FITMIND_DIR}${id}.html`;

      // Download
      const downloadResult = await FileSystem.downloadAsync(url, destPath);
      if (downloadResult.status !== 200) {
        return { success: false, error: `Download failed with status ${downloadResult.status}` };
      }

      // Read content
      const rawContent = await FileSystem.readAsStringAsync(destPath);

      // Strip HTML tags for analysis
      const textContent = DocumentProcessor.stripHtml(rawContent);
      const analysis = DocumentProcessor.analyzeText(textContent);

      const title = metadata?.title || DocumentProcessor.extractTitleFromHtml(rawContent) || url;

      await FitMindService.addDocument({
        id,
        title,
        author: metadata?.author || 'Web Article',
        type: 'ARTICLE',
        status: 'UNREAD',
        category: metadata?.category || 'Web',
        tags: JSON.stringify([url]),
        file_path: destPath,
        file_size: rawContent.length,
        page_count: Math.max(1, Math.ceil(analysis.wordCount / AVG_WORDS_PER_PAGE)),
        current_page: 0,
        total_reading_time_ms: 0,
        cover_image_uri: null,
        summary: null,
        difficulty_level: analysis.difficultyLevel,
        language: 'en',
      });

      return {
        success: true,
        documentId: id,
        document: {
          id,
          title,
          author: metadata?.author || 'Web Article',
          type: 'ARTICLE',
          wordCount: analysis.wordCount,
          estimatedReadingTimeMinutes: analysis.estimatedReadingTimeMinutes,
          difficultyLevel: analysis.difficultyLevel,
          language: 'en',
          pageCount: Math.max(1, Math.ceil(analysis.wordCount / AVG_WORDS_PER_PAGE)),
          filePath: destPath,
          fileSize: rawContent.length,
          chapters: [],
        },
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'URL import failed' };
    }
  }

  // ============================================
  // TEXT READING
  // ============================================

  /**
   * Read document content (text files) for display.
   * Returns paginated content.
   */
  static async readDocumentPage(
    filePath: string,
    page: number,
    wordsPerPage = AVG_WORDS_PER_PAGE
  ): Promise<{ content: string; hasNext: boolean; hasPrev: boolean }> {
    const content = await FileSystem.readAsStringAsync(filePath);
    const cleanContent = filePath.endsWith('.html') ? DocumentProcessor.stripHtml(content) : content;

    const words = cleanContent.split(/\s+/);
    const startIdx = (page - 1) * wordsPerPage;
    const endIdx = startIdx + wordsPerPage;
    const pageWords = words.slice(startIdx, endIdx);

    return {
      content: pageWords.join(' '),
      hasNext: endIdx < words.length,
      hasPrev: page > 1,
    };
  }

  // ============================================
  // TEXT ANALYSIS
  // ============================================

  /**
   * Analyze text content for readability metrics.
   */
  static analyzeText(text: string): TextAnalysis {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const wordCount = words.length;
    const sentenceCount = Math.max(1, sentences.length);
    const avgWordsPerSentence = wordCount / sentenceCount;
    const totalWordLength = words.reduce((sum, w) => sum + w.replace(/[^a-zA-Z]/g, '').length, 0);
    const avgWordLength = wordCount > 0 ? totalWordLength / wordCount : 0;

    // Simplified readability score (inspired by Flesch-Kincaid)
    // Higher avgWordsPerSentence + avgWordLength = higher difficulty
    const rawDifficulty = (avgWordsPerSentence / 10) + (avgWordLength / 3);
    const difficultyLevel = Math.min(5, Math.max(1, Math.round(rawDifficulty)));

    const estimatedReadingTimeMinutes = Math.ceil(wordCount / AVG_READING_SPEED_WPM);

    // Extract top keywords (simple frequency analysis)
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'shall', 'can',
      'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
      'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
      'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she',
      'they', 'we', 'you', 'i', 'me', 'my', 'your', 'his', 'her',
      'their', 'our', 'as', 'if', 'then', 'than', 'when', 'where',
    ]);

    const freq = new Map<string, number>();
    for (const word of words) {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (clean.length > 3 && !stopWords.has(clean)) {
        freq.set(clean, (freq.get(clean) || 0) + 1);
      }
    }

    const topKeywords = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return {
      wordCount,
      sentenceCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      avgWordLength: Math.round(avgWordLength * 10) / 10,
      difficultyLevel,
      estimatedReadingTimeMinutes,
      topKeywords,
    };
  }

  // ============================================
  // FILE MANAGEMENT
  // ============================================

  /**
   * Delete a document's file from storage.
   */
  static async deleteDocumentFile(filePath: string): Promise<void> {
    try {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        await FileSystem.deleteAsync(filePath);
      }
    } catch (e) {
      console.warn('[DocumentProcessor] Failed to delete file:', e);
    }
  }

  /**
   * Get total storage used by FitMind documents (bytes).
   */
  static async getStorageUsage(): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(FITMIND_DIR);
      if (!info.exists) return 0;

      const files = await FileSystem.readDirectoryAsync(FITMIND_DIR);
      let total = 0;
      for (const file of files) {
        const fileInfo = await FileSystem.getInfoAsync(`${FITMIND_DIR}${file}`);
        total += (fileInfo as any).size || 0;
      }
      return total;
    } catch {
      return 0;
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private static detectFileType(uri: string): DocumentType | null {
    const ext = uri.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'PDF';
      case 'epub': return 'EPUB';
      case 'txt':
      case 'md':
      case 'html':
      case 'htm':
        return 'ARTICLE';
      default:
        return null;
    }
  }

  private static formatTitle(filename: string): string {
    return filename
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  private static stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static extractTitleFromHtml(html: string): string | null {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : null;
  }

  private static async analyzeFile(filePath: string, type: DocumentType): Promise<TextAnalysis> {
    try {
      // For now, read as text (PDF/EPUB binary parsing would need native modules)
      if (type === 'PDF' || type === 'EPUB') {
        // Binary formats — estimate from file size
        const info = await FileSystem.getInfoAsync(filePath);
        const fileSize = (info as any).size || 0;
        // Rough estimate: 1 byte ≈ 0.2 words for PDF (lots of formatting overhead)
        const estimatedWords = Math.round(fileSize * (type === 'PDF' ? 0.15 : 0.2));
        return {
          wordCount: estimatedWords,
          sentenceCount: Math.round(estimatedWords / 15),
          avgWordsPerSentence: 15,
          avgWordLength: 5,
          difficultyLevel: 3,
          estimatedReadingTimeMinutes: Math.ceil(estimatedWords / AVG_READING_SPEED_WPM),
          topKeywords: [],
        };
      }

      // Text-based formats — full analysis
      const content = await FileSystem.readAsStringAsync(filePath);
      const cleanContent = filePath.endsWith('.html') || filePath.endsWith('.htm')
        ? DocumentProcessor.stripHtml(content)
        : content;
      return DocumentProcessor.analyzeText(cleanContent);
    } catch (e) {
      console.warn('[DocumentProcessor] Analysis failed, using defaults:', e);
      return {
        wordCount: 0,
        sentenceCount: 0,
        avgWordsPerSentence: 0,
        avgWordLength: 0,
        difficultyLevel: 3,
        estimatedReadingTimeMinutes: 0,
        topKeywords: [],
      };
    }
  }
}
