import { describe, expect, it, vi } from 'vitest';

// ============================================
// MOCK NATIVE MODULES
// ============================================

vi.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/documents/',
  getInfoAsync: vi.fn(() => Promise.resolve({ exists: true, size: 1024 })),
  makeDirectoryAsync: vi.fn(() => Promise.resolve()),
  readAsStringAsync: vi.fn((path: string) => {
    if (path.endsWith('.html')) {
      return Promise.resolve('<html><head><title>Test Doc</title></head><body><p>Hello world this is a test document.</p></body></html>');
    }
    return Promise.resolve('Hello world this is a test document. It has multiple sentences. The quick brown fox jumped over the lazy dog.');
  }),
  copyAsync: vi.fn(() => Promise.resolve()),
  writeAsStringAsync: vi.fn(() => Promise.resolve()),
  deleteAsync: vi.fn(() => Promise.resolve()),
  downloadAsync: vi.fn(() => Promise.resolve({ status: 200 })),
  readDirectoryAsync: vi.fn(() => Promise.resolve(['doc1.txt', 'doc2.pdf'])),
}));

vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn((n: number) =>
    Promise.resolve(new Uint8Array(n).fill(99))
  ),
}));

vi.mock('../src/fitmind/schema', () => ({
  FitMindService: {
    addDocument: vi.fn(() => Promise.resolve()),
  },
}));

import { DocumentProcessor } from '../src/fitmind/DocumentProcessor';

// ============================================
// TEXT ANALYSIS (pure logic, no I/O)
// ============================================

describe('DocumentProcessor.analyzeText', () => {
  it('counts words and sentences', () => {
    const result = DocumentProcessor.analyzeText(
      'Hello world. This is a test. Three sentences here.'
    );
    expect(result.wordCount).toBe(9);
    expect(result.sentenceCount).toBe(3);
    expect(result.avgWordsPerSentence).toBe(3);
  });

  it('calculates reading time based on 250 WPM', () => {
    const words = Array(500).fill('word').join(' ') + '.';
    const result = DocumentProcessor.analyzeText(words);
    expect(result.estimatedReadingTimeMinutes).toBe(2);
  });

  it('handles empty text', () => {
    const result = DocumentProcessor.analyzeText('');
    expect(result.wordCount).toBe(0);
    expect(result.sentenceCount).toBe(1); // max(1, 0)
    expect(result.estimatedReadingTimeMinutes).toBe(0);
  });

  it('single long sentence gets higher difficulty', () => {
    const result = DocumentProcessor.analyzeText(
      'The extraordinarily sophisticated methodology demonstrated unprecedented comprehension of the fundamentally complex architectural prerequisites inherent in the multidimensional paradigm.'
    );
    expect(result.difficultyLevel).toBeGreaterThanOrEqual(3);
  });

  it('simple short sentences get lower difficulty', () => {
    const result = DocumentProcessor.analyzeText(
      'I run. You eat. We go. He sits. She reads.'
    );
    expect(result.difficultyLevel).toBeLessThanOrEqual(2);
  });

  it('extracts top keywords excluding stop words', () => {
    const text = 'fitness training workout fitness training muscle fitness exercise training fitness';
    const result = DocumentProcessor.analyzeText(text);
    expect(result.topKeywords).toContain('fitness');
    expect(result.topKeywords).toContain('training');
    // Stop words like 'the', 'is' should not appear
    expect(result.topKeywords).not.toContain('the');
  });

  it('difficulty clamped between 1 and 5', () => {
    // Very easy
    const easy = DocumentProcessor.analyzeText('Go. Run. Sit. Hi. Yes.');
    expect(easy.difficultyLevel).toBeGreaterThanOrEqual(1);
    expect(easy.difficultyLevel).toBeLessThanOrEqual(5);

    // Very complex
    const hard = DocumentProcessor.analyzeText(
      'The anthropomorphization of cybernetic biomechanical infrastructure necessitates comprehensive multidisciplinary understanding of neuroplasticity electroencephalography.'
    );
    expect(hard.difficultyLevel).toBeGreaterThanOrEqual(1);
    expect(hard.difficultyLevel).toBeLessThanOrEqual(5);
  });
});

// ============================================
// FILE TYPE DETECTION (via private method, test through import)
// ============================================

describe('DocumentProcessor file import', () => {
  it('importFromText saves and analyzes text documents', async () => {
    const result = await DocumentProcessor.importFromText(
      'This is a test document with enough words to analyze properly for the reader module.',
      { title: 'Test Document', author: 'Test Author' }
    );
    expect(result.success).toBe(true);
    expect(result.documentId).toBeDefined();
    expect(result.document).toBeDefined();
    expect(result.document!.title).toBe('Test Document');
    expect(result.document!.author).toBe('Test Author');
    expect(result.document!.type).toBe('ARTICLE');
    expect(result.document!.wordCount).toBeGreaterThan(0);
  });

  it('importFromText uses default author when not provided', async () => {
    const result = await DocumentProcessor.importFromText('Some content here.', {
      title: 'No Author Doc',
    });
    expect(result.success).toBe(true);
    expect(result.document!.author).toBe('Unknown');
  });
});

// ============================================
// HTML STRIPPING (tested indirectly via analyzeText)
// ============================================

describe('DocumentProcessor HTML handling', () => {
  it('importFromUrl strips HTML for analysis', async () => {
    const result = await DocumentProcessor.importFromUrl('https://example.com/article', {
      title: 'Web Article',
    });
    expect(result.success).toBe(true);
    expect(result.document!.type).toBe('ARTICLE');
    expect(result.document!.wordCount).toBeGreaterThan(0);
  });
});

// ============================================
// DOCUMENT READING (paginated)
// ============================================

describe('DocumentProcessor.readDocumentPage', () => {
  it('returns first page of text content', async () => {
    const page = await DocumentProcessor.readDocumentPage('/mock/test.txt', 1, 5);
    expect(page.content).toBeDefined();
    expect(page.content.split(/\s+/).length).toBeLessThanOrEqual(5);
    expect(page.hasPrev).toBe(false);
  });

  it('second page has hasPrev=true', async () => {
    const page = await DocumentProcessor.readDocumentPage('/mock/test.txt', 2, 5);
    expect(page.hasPrev).toBe(true);
  });

  it('returns empty for PDF files (binary guard)', async () => {
    const page = await DocumentProcessor.readDocumentPage('/mock/test.pdf', 1);
    expect(page.content).toBe('');
    expect(page.hasNext).toBe(false);
  });

  it('returns empty for EPUB files (binary guard)', async () => {
    const page = await DocumentProcessor.readDocumentPage('/mock/test.epub', 1);
    expect(page.content).toBe('');
  });
});

// ============================================
// STORAGE
// ============================================

describe('DocumentProcessor storage', () => {
  it('getStorageUsage returns total bytes', async () => {
    const usage = await DocumentProcessor.getStorageUsage();
    // 2 files × 1024 bytes each
    expect(usage).toBe(2048);
  });
});
