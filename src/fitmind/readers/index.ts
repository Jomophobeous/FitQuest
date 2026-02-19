/**
 * FitMind Readers Module
 * 
 * Unified document reader system for PDF, EPUB, Article, and Text documents.
 * 
 * Usage:
 * ```tsx
 * import { 
 *   getReaderForDocument, 
 *   createReaderTheme,
 *   PDFReader,
 *   EPUBReader,
 * } from '../fitmind/readers';
 * ```
 */

// Types
export type {
  DocumentType,
  BaseReaderProps,
  PDFReaderProps,
  EPUBReaderProps,
  ArticleReaderProps,
  TextReaderProps,
  DocumentLoadInfo,
  TextSelection,
  SelectionRect,
  ReaderTheme,
  ReaderNavigationState,
  PageNavigationRequest,
  ReaderAnnotation,
  ReaderEventType,
  ReaderEvent,
  ReaderState,
  ReaderComponent,
} from './types';

// Reader Components
export { PDFReader } from './PDFReader';
export { EPUBReader } from './EPUBReader';
export { ArticleReader } from './ArticleReader';
export { TextReader } from './TextReader';

// Factory Functions
export {
  getReaderComponent,
  getReaderInfo,
  getReaderForDocument,
  canReadInApp,
  createReaderTheme,
  renderDocument,
  readerSupports,
  isPDFDocument,
  isEPUBDocument,
  isArticleDocument,
  isNoteDocument,
  isBinaryDocument,
} from './ReaderFactory';

// Default export
export { default as ReaderFactory } from './ReaderFactory';
