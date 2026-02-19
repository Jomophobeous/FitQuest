import { describe, expect, it } from 'vitest';
import {
  resolveReaderEngine,
  calculateReaderProgressPercent,
  parseEpubWebMessage,
  normalizeReaderFileUri,
  getBinaryRendererFailureMessage,
  canUseInlinePageNavigation,
} from '../src/fitmind/readerEngine';

describe('readerEngine.resolveReaderEngine', () => {
  it('defaults to native_pdf when not provided', () => {
    expect(resolveReaderEngine(undefined, 'standalone')).toBe('native_pdf');
  });

  it('forces external only for native_pdf in Expo Go', () => {
    expect(resolveReaderEngine('native_pdf', 'expo')).toBe('external');
    expect(resolveReaderEngine('web_epub', 'expo')).toBe('web_epub');
    expect(resolveReaderEngine('web_pdfjs', 'expo')).toBe('web_pdfjs');
  });

  it('falls back to native_pdf for invalid values', () => {
    expect(resolveReaderEngine('unknown_engine', 'standalone')).toBe('native_pdf');
  });
});

describe('readerEngine.calculateReaderProgressPercent', () => {
  it('uses EPUB progress payload when available', () => {
    const value = calculateReaderProgressPercent({
      documentType: 'EPUB',
      currentPage: 1,
      totalPages: 100,
      epubProgressPercent: 37.6,
    });

    expect(value).toBe(38);
  });

  it('uses page/total for non-EPUB docs', () => {
    const value = calculateReaderProgressPercent({
      documentType: 'PDF',
      currentPage: 25,
      totalPages: 100,
    });

    expect(value).toBe(25);
  });

  it('clamps out-of-range values', () => {
    expect(calculateReaderProgressPercent({
      documentType: 'EPUB',
      currentPage: 1,
      totalPages: 100,
      epubProgressPercent: 500,
    })).toBe(100);

    expect(calculateReaderProgressPercent({
      documentType: 'EPUB',
      currentPage: 1,
      totalPages: 100,
      epubProgressPercent: -12,
    })).toBe(0);
  });
});

describe('readerEngine.parseEpubWebMessage', () => {
  it('parses loaded messages', () => {
    const message = parseEpubWebMessage(JSON.stringify({
      type: 'loaded',
      payload: { totalPages: 349 },
    }));

    expect(message.type).toBe('loaded');
    if (message.type === 'loaded') {
      expect(message.totalPages).toBe(349);
    }
  });

  it('parses relocated messages with CFI', () => {
    const message = parseEpubWebMessage(JSON.stringify({
      type: 'relocated',
      payload: {
        progress: 42.3,
        atStart: false,
        atEnd: false,
        cfi: 'epubcfi(/6/2[chap01]!/4/2/2)',
      },
    }));

    expect(message.type).toBe('relocated');
    if (message.type === 'relocated') {
      expect(message.payload.progress).toBeCloseTo(42.3, 3);
      expect(message.payload.cfi).toContain('epubcfi');
    }
  });

  it('returns unknown for malformed payload', () => {
    const message = parseEpubWebMessage('{bad json');
    expect(message.type).toBe('unknown');
  });

  it('returns error for error payloads', () => {
    const message = parseEpubWebMessage(JSON.stringify({
      type: 'error',
      payload: { message: 'render failed' },
    }));

    expect(message.type).toBe('error');
    if (message.type === 'error') {
      expect(message.message).toContain('render failed');
    }
  });
});

describe('readerEngine.normalizeReaderFileUri', () => {
  it('returns undefined for empty values', () => {
    expect(normalizeReaderFileUri(undefined)).toBeUndefined();
    expect(normalizeReaderFileUri(null)).toBeUndefined();
    expect(normalizeReaderFileUri('')).toBeUndefined();
  });

  it('adds file scheme when missing', () => {
    expect(normalizeReaderFileUri('/tmp/sample.pdf')).toBe('file:///tmp/sample.pdf');
  });

  it('preserves existing file scheme', () => {
    expect(normalizeReaderFileUri('file:///tmp/sample.epub')).toBe('file:///tmp/sample.epub');
  });
});

describe('readerEngine.getBinaryRendererFailureMessage', () => {
  it('returns document-specific message for PDF and EPUB', () => {
    expect(getBinaryRendererFailureMessage('PDF')).toContain('PDF');
    expect(getBinaryRendererFailureMessage('EPUB')).toContain('EPUB');
  });

  it('returns generic message for unknown type', () => {
    expect(getBinaryRendererFailureMessage(undefined)).toContain('offline renderer failed');
  });
});

describe('readerEngine.canUseInlinePageNavigation', () => {
  it('allows navigation for non-binary docs', () => {
    expect(canUseInlinePageNavigation({ isBinaryDoc: false, isInAppWebPdfMode: false })).toBe(true);
  });

  it('disables navigation for binary docs without inline web PDF mode', () => {
    expect(canUseInlinePageNavigation({ isBinaryDoc: true, isInAppWebPdfMode: false })).toBe(false);
  });

  it('allows navigation for binary docs in inline web PDF mode', () => {
    expect(canUseInlinePageNavigation({ isBinaryDoc: true, isInAppWebPdfMode: true })).toBe(true);
  });
});
