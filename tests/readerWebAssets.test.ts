import { describe, expect, it } from 'vitest';
import {
  buildPdfWebReaderHtml,
  buildEpubWebReaderHtml,
} from '../src/fitmind/readerWebAssets';

describe('readerWebAssets template builders', () => {
  it('injects PDF script, worker, and URI tokens', () => {
    const html = buildPdfWebReaderHtml({
      pdfUri: 'file:///tmp/demo.pdf',
      pdfScript: 'window.__pdf = true;',
      pdfWorkerScript: 'window.__pdfWorker = true;',
      pdfHtmlTemplate: 'A __PDF_SOURCE__ B __PDF_WORKER_SOURCE__ C __PDF_URI__ D',
    });

    expect(html).toContain(JSON.stringify('window.__pdf = true;'));
    expect(html).toContain(JSON.stringify('window.__pdfWorker = true;'));
    expect(html).toContain(JSON.stringify('file:///tmp/demo.pdf'));
    expect(html).not.toContain('__PDF_SOURCE__');
    expect(html).not.toContain('__PDF_WORKER_SOURCE__');
    expect(html).not.toContain('__PDF_URI__');
  });

  it('injects EPUB script and URI tokens', () => {
    const html = buildEpubWebReaderHtml({
      epubUri: 'file:///tmp/demo.epub',
      epubScript: 'window.__epub = true;',
      epubHtmlTemplate: 'X __EPUB_SOURCE__ Y __EPUB_URI__ Z',
    });

    expect(html).toContain(JSON.stringify('window.__epub = true;'));
    expect(html).toContain(JSON.stringify('file:///tmp/demo.epub'));
    expect(html).not.toContain('__EPUB_SOURCE__');
    expect(html).not.toContain('__EPUB_URI__');
  });

  it('keeps injected values JSON-escaped for script safety', () => {
    const html = buildPdfWebReaderHtml({
      pdfUri: 'file:///tmp/weird "doc".pdf',
      pdfScript: 'window.msg = "hello";\nwindow.next = true;',
      pdfWorkerScript: 'self.name = "worker";',
      pdfHtmlTemplate: '__PDF_SOURCE__|__PDF_WORKER_SOURCE__|__PDF_URI__',
    });

    expect(html).toContain('\\"hello\\"');
    expect(html).toContain('\\nwindow.next = true;');
    expect(html).toContain('weird \\"doc\\".pdf');
  });
});
