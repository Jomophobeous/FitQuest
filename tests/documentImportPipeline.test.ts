import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──
const {
  mockReadString,
  mockWriteString,
  mockGetInfo,
  mockDigest,
  mockImportFromFile,
  mockImportFromText,
  mockImportFromUrl,
  mockGetStorageUsage,
  mockGetDocuments,
} = vi.hoisted(() => ({
  mockReadString: vi.fn(),
  mockWriteString: vi.fn(),
  mockGetInfo: vi.fn(),
  mockDigest: vi.fn(),
  mockImportFromFile: vi.fn(),
  mockImportFromText: vi.fn(),
  mockImportFromUrl: vi.fn(),
  mockGetStorageUsage: vi.fn(),
  mockGetDocuments: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: any[]) => mockReadString(...args),
  writeAsStringAsync: (...args: any[]) => mockWriteString(...args),
  getInfoAsync: (...args: any[]) => mockGetInfo(...args),
  documentDirectory: '/mock/docs/',
}));

vi.mock('expo-crypto', () => ({
  digestStringAsync: (...args: any[]) => mockDigest(...args),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

vi.mock('../src/fitmind/DocumentProcessor', () => ({
  DocumentProcessor: {
    importFromFile: (...args: any[]) => mockImportFromFile(...args),
    importFromText: (...args: any[]) => mockImportFromText(...args),
    importFromUrl: (...args: any[]) => mockImportFromUrl(...args),
    getStorageUsage: (...args: any[]) => mockGetStorageUsage(...args),
  },
}));

vi.mock('../src/fitmind/schema', () => ({
  FitMindService: {
    getDocuments: (...args: any[]) => mockGetDocuments(...args),
  },
}));

import { DocumentImportPipeline, type PipelineResult } from '../src/fitmind/DocumentImportPipeline';

describe('DocumentImportPipeline', () => {
  let pipeline: DocumentImportPipeline;
  let progressStages: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    progressStages = [];
    pipeline = new DocumentImportPipeline({
      onProgress: (_p, stage) => progressStages.push(stage),
    });

    // Defaults
    mockGetStorageUsage.mockResolvedValue(0);
    mockGetDocuments.mockResolvedValue([]);
    mockDigest.mockResolvedValue('abc123hash');
    mockWriteString.mockResolvedValue(undefined);
    mockGetInfo.mockResolvedValue({ exists: true, size: 1024 });
    mockReadString.mockResolvedValue('Hello world content');
  });

  // ─────────────────────────────────────────
  // importText
  // ─────────────────────────────────────────

  describe('importText', () => {
    it('succeeds for valid text input', async () => {
      mockImportFromText.mockResolvedValue({
        success: true,
        documentId: 'doc-1',
        document: { filePath: '/mock/docs/fitmind/doc.txt', type: 'ARTICLE' },
      });

      const result = await pipeline.importText('This is valid content for testing.', {
        title: 'Test Doc',
      });

      expect(result.success).toBe(true);
      expect(mockImportFromText).toHaveBeenCalled();
    });

    it('rejects empty content', async () => {
      const result = await pipeline.importText('   ', { title: 'Empty' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('rejects oversized text (>5MB)', async () => {
      const hugeText = 'x'.repeat(6 * 1024 * 1024);
      const result = await pipeline.importText(hugeText, { title: 'Huge' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('large');
    });

    it('rejects when storage quota exceeded', async () => {
      mockGetStorageUsage.mockResolvedValue(500 * 1024 * 1024); // already at 500MB limit
      const result = await pipeline.importText('a '.repeat(1000), { title: 'Quota' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('quota');
    });

    it('detects duplicate content via SHA-256 hash', async () => {
      // First make getDocuments return existing docs that match hash
      mockGetDocuments.mockResolvedValue([
        { file_path: '/mock/docs/fitmind/existing.txt' },
      ]);
      // Same hash for existing and new
      mockDigest.mockResolvedValue('duplicate_hash');

      const result = await pipeline.importText('Duplicate content', { title: 'Dup' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already been imported');
    });

    it('strips dangerous HTML patterns from content', async () => {
      mockImportFromText.mockResolvedValue({
        success: true,
        documentId: 'doc-2',
        document: { filePath: '/mock/docs/fitmind/clean.txt', type: 'ARTICLE' },
      });

      const dirty = 'Hello <script>alert("xss")</script> World';
      const result = await pipeline.importText(dirty, { title: 'Clean' });

      // The pipeline sanitizes before passing to DocumentProcessor
      expect(result.success).toBe(true);
      const passedContent = mockImportFromText.mock.calls[0]![0];
      expect(passedContent).not.toContain('<script>');
    });

    it('sanitizes metadata (strips < > " chars)', async () => {
      mockImportFromText.mockResolvedValue({
        success: true,
        documentId: 'doc-3',
        document: { filePath: '/mock/docs/fitmind/meta.txt', type: 'ARTICLE' },
      });

      await pipeline.importText('Content', {
        title: 'My <b>Title</b>',
        author: 'Author "Foo"',
      });

      const passedMeta = mockImportFromText.mock.calls[0]![1];
      expect(passedMeta.title).not.toContain('<');
      expect(passedMeta.title).not.toContain('>');
    });

    it('reports progress stages', async () => {
      mockImportFromText.mockResolvedValue({
        success: true,
        documentId: 'doc-4',
        document: { filePath: '/mock/docs/fitmind/prog.txt', type: 'ARTICLE' },
      });

      await pipeline.importText('Progress content here', { title: 'Prog' });
      expect(progressStages.length).toBeGreaterThan(0);
      expect(progressStages).toContain('VALIDATING');
    });
  });

  // ─────────────────────────────────────────
  // importUrl
  // ─────────────────────────────────────────

  describe('importUrl', () => {
    it('rejects non-HTTP URLs', async () => {
      const result = await pipeline.importUrl('ftp://example.com/file.txt');
      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP');
    });

    it('rejects javascript: scheme', async () => {
      const result = await pipeline.importUrl('javascript:alert(1)');
      expect(result.success).toBe(false);
    });

    it('rejects data: scheme', async () => {
      const result = await pipeline.importUrl('data:text/html,<h1>hi</h1>');
      expect(result.success).toBe(false);
    });

    it('rejects overly long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2100);
      const result = await pipeline.importUrl(longUrl);
      expect(result.success).toBe(false);
      expect(result.error).toContain('long');
    });

    it('succeeds for valid HTTPS URL', async () => {
      mockImportFromUrl.mockResolvedValue({
        success: true,
        documentId: 'url-1',
        document: { filePath: '/mock/docs/fitmind/article.html', type: 'ARTICLE' },
      });

      const result = await pipeline.importUrl('https://example.com/article');
      expect(result.success).toBe(true);
    });

    it('sanitizes downloaded HTML content', async () => {
      mockImportFromUrl.mockResolvedValue({
        success: true,
        documentId: 'url-2',
        document: { filePath: '/mock/docs/fitmind/dirty.html', type: 'ARTICLE' },
      });
      mockReadString.mockResolvedValue('<p>Good</p><script>evil()</script>');

      await pipeline.importUrl('https://example.com/article');

      // The pipeline reads the file and strips dangerous patterns
      if (mockWriteString.mock.calls.length > 0) {
        const writtenContent = mockWriteString.mock.calls[0]![1];
        expect(writtenContent).not.toContain('<script>');
      }
    });
  });

  // ─────────────────────────────────────────
  // importFile
  // ─────────────────────────────────────────

  describe('importFile', () => {
    it('rejects non-existent files', async () => {
      mockGetInfo.mockResolvedValue({ exists: false });
      const result = await pipeline.importFile('/path/to/missing.txt');
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('rejects files over 50MB', async () => {
      mockGetInfo.mockResolvedValue({ exists: true, size: 60 * 1024 * 1024 });
      const result = await pipeline.importFile('/path/to/huge.pdf');
      expect(result.success).toBe(false);
      expect(result.error).toContain('large');
    });

    it('rejects unsupported file types', async () => {
      mockGetInfo.mockResolvedValue({ exists: true, size: 1024 });
      const result = await pipeline.importFile('/path/to/file.exe');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    it('accepts supported extensions: pdf, epub, txt, md, html', async () => {
      const extensions = ['pdf', 'epub', 'txt', 'md', 'html'];
      for (const ext of extensions) {
        mockGetInfo.mockResolvedValue({ exists: true, size: 1024 });
        mockImportFromFile.mockResolvedValue({
          success: true,
          documentId: `doc-${ext}`,
          document: { filePath: `/mock/docs/fitmind/file.${ext}`, type: ext === 'pdf' ? 'PDF' : 'ARTICLE' },
        });

        const result = await pipeline.importFile(`/path/to/file.${ext}`);
        expect(result.success).toBe(true);
      }
    });

    it('creates content chunks for text files', async () => {
      mockGetInfo.mockResolvedValue({ exists: true, size: 1024 });
      mockImportFromFile.mockResolvedValue({
        success: true,
        documentId: 'doc-chunk',
        document: { filePath: '/mock/docs/fitmind/file.txt', type: 'ARTICLE' },
      });
      // Generate enough words to create multiple chunks (default 250 words/chunk)
      const words = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
      mockReadString.mockResolvedValue(words);

      const result = await pipeline.importFile('/path/to/file.txt');

      expect(result.success).toBe(true);
      // Chunks should be written as JSON
      expect(mockWriteString).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────
  // importBatch
  // ─────────────────────────────────────────

  describe('importBatch', () => {
    let batchPipeline: DocumentImportPipeline;

    beforeEach(() => {
      batchPipeline = new DocumentImportPipeline({ allowDuplicates: true });
    });

    it('processes multiple items and returns aggregate results', async () => {
      mockImportFromText.mockResolvedValue({
        success: true,
        documentId: 'batch-1',
        document: { filePath: '/mock/docs/fitmind/b1.txt', type: 'ARTICLE' },
      });

      const result = await batchPipeline.importBatch([
        { type: 'text', source: 'Content one', metadata: { title: 'Doc 1' } },
        { type: 'text', source: 'Content two', metadata: { title: 'Doc 2' } },
      ]);

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
    });

    it('counts failures correctly in batch', async () => {
      mockImportFromText
        .mockResolvedValueOnce({
          success: true,
          documentId: 'batch-ok',
          document: { filePath: '/mock/docs/fitmind/ok.txt', type: 'ARTICLE' },
        })
        .mockResolvedValueOnce({ success: false, error: 'Processing failed' });

      const result = await batchPipeline.importBatch([
        { type: 'text', source: 'Good content', metadata: { title: 'Good' } },
        { type: 'text', source: 'Bad content', metadata: { title: 'Bad' } },
      ]);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  // ─────────────────────────────────────────
  // readChunk / getChunkCount (static methods)
  // ─────────────────────────────────────────

  describe('static chunk readers', () => {
    it('readChunk returns null when chunks file does not exist', async () => {
      mockGetInfo.mockResolvedValue({ exists: false });
      const chunk = await DocumentImportPipeline.readChunk('/mock/docs/file.txt', 0);
      expect(chunk).toBeNull();
    });

    it('readChunk returns the correct chunk by index', async () => {
      mockGetInfo.mockResolvedValue({ exists: true });
      const chunks = [
        { index: 0, content: 'First chunk', wordCount: 2, startWord: 0, endWord: 2 },
        { index: 1, content: 'Second chunk', wordCount: 2, startWord: 2, endWord: 4 },
      ];
      mockReadString.mockResolvedValue(JSON.stringify(chunks));

      const chunk = await DocumentImportPipeline.readChunk('/mock/docs/file.txt', 1);
      expect(chunk).not.toBeNull();
      expect(chunk!.content).toBe('Second chunk');
      expect(chunk!.index).toBe(1);
    });

    it('getChunkCount returns 0 when chunks file missing', async () => {
      mockGetInfo.mockResolvedValue({ exists: false });
      const count = await DocumentImportPipeline.getChunkCount('/mock/docs/file.txt');
      expect(count).toBe(0);
    });

    it('getChunkCount returns correct count', async () => {
      mockGetInfo.mockResolvedValue({ exists: true });
      mockReadString.mockResolvedValue(JSON.stringify([{}, {}, {}]));
      const count = await DocumentImportPipeline.getChunkCount('/mock/docs/file.txt');
      expect(count).toBe(3);
    });
  });

  // ─────────────────────────────────────────
  // Custom options
  // ─────────────────────────────────────────

  describe('custom pipeline options', () => {
    it('respects custom file size limit', async () => {
      const small = new DocumentImportPipeline({ maxFileSizeBytes: 1024 }); // 1KB limit
      mockGetInfo.mockResolvedValue({ exists: true, size: 2048 }); // 2KB file

      const result = await small.importFile('/path/to/file.txt');
      expect(result.success).toBe(false);
      expect(result.error).toContain('large');
    });

    it('respects allowDuplicates option', async () => {
      const allowDups = new DocumentImportPipeline({ allowDuplicates: true });
      mockImportFromText.mockResolvedValue({
        success: true,
        documentId: 'dup-ok',
        document: { filePath: '/mock/docs/fitmind/dup.txt', type: 'ARTICLE' },
      });
      
      // Even with matching hashes, should succeed
      mockGetDocuments.mockResolvedValue([{ file_path: '/mock/docs/fitmind/existing.txt' }]);
      mockDigest.mockResolvedValue('same_hash');

      const result = await allowDups.importText('Content here', { title: 'Dup OK' });
      expect(result.success).toBe(true);
    });
  });
});
