/**
 * Document Reader Types
 * 
 * Shared types for the unified document reader system.
 */

import type { FitMindDocument, Annotation } from '../schema';

// ============================================
// DOCUMENT TYPES
// ============================================

export type DocumentType = 'PDF' | 'EPUB' | 'ARTICLE' | 'NOTE';

// ============================================
// READER PROPS
// ============================================

export interface BaseReaderProps {
  /** The document being read */
  document: FitMindDocument;
  
  /** Current page (1-indexed for PDF, percentage for EPUB) */
  currentPage: number;
  
  /** Called when page changes */
  onPageChange: (page: number) => void;
  
  /** Called when document loads successfully */
  onLoad?: (info: DocumentLoadInfo) => void;
  
  /** Called on error */
  onError?: (error: Error) => void;
  
  /** Called when user taps/selects text (for annotations) */
  onTextSelect?: (selection: TextSelection) => void;
  
  /** Optional annotations to display */
  annotations?: Annotation[];
  
  /** Theme colors */
  theme: ReaderTheme;
}

export interface PDFReaderProps extends BaseReaderProps {
  /** Enable horizontal paging mode */
  horizontal?: boolean;
  
  /** Enable double-tap zoom */
  enableZoom?: boolean;
  
  /** Single page mode vs continuous scroll */
  singlePage?: boolean;
}

export interface EPUBReaderProps extends BaseReaderProps {
  /** Font size multiplier (1.0 = default) */
  fontSize?: number;
  
  /** Line height multiplier */
  lineHeight?: number;
  
  /** Custom CSS to inject */
  customCSS?: string;
  
  /** Called when EPUB location changes (CFI) */
  onLocationChange?: (cfi: string, progress: number) => void;
  
  /** Saved CFI location to restore */
  initialCFI?: string;
}

export interface ArticleReaderProps extends BaseReaderProps {
  /** Font size in pixels */
  fontSize?: number;
  
  /** Enable sepia mode */
  sepiaMode?: boolean;
  
  /** Show reading progress bar */
  showProgressBar?: boolean;
}

export interface TextReaderProps extends BaseReaderProps {
  /** Enable edit mode */
  editable?: boolean;
  
  /** Called when text is edited */
  onTextChange?: (newContent: string) => void;
}

// ============================================
// READER OUTPUT TYPES
// ============================================

export interface DocumentLoadInfo {
  totalPages: number;
  title?: string;
  author?: string;
  wordCount?: number;
  estimatedMinutes?: number;
}

export interface TextSelection {
  text: string;
  pageNumber: number;
  startOffset?: number;
  endOffset?: number;
  rect?: SelectionRect;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// READER THEME
// ============================================

export interface ReaderTheme {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  highlightColor: string;
  linkColor: string;
  mode: 'light' | 'dark' | 'sepia';
}

// ============================================
// NAVIGATION
// ============================================

export interface ReaderNavigationState {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  progressPercent: number;
  currentCFI?: string;  // For EPUB
}

export interface PageNavigationRequest {
  direction: 'next' | 'prev' | 'goto';
  targetPage?: number;
  targetCFI?: string;
}

// ============================================
// ANNOTATIONS (Reader-specific)
// ============================================

export interface ReaderAnnotation {
  id: string;
  type: 'HIGHLIGHT' | 'NOTE' | 'BOOKMARK' | 'QUESTION';
  pageNumber: number;
  content: string;
  color: string;
  positionStart?: number;
  positionEnd?: number;
  cfiRange?: string;  // For EPUB
  createdAt: number;
}

// ============================================
// READER EVENTS
// ============================================

export type ReaderEventType = 
  | 'load'
  | 'error'
  | 'pageChange'
  | 'progressChange'
  | 'textSelect'
  | 'annotationTap'
  | 'linkTap';

export interface ReaderEvent<T = unknown> {
  type: ReaderEventType;
  payload: T;
}

// ============================================
// READER STATE
// ============================================

export interface ReaderState {
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  navigation: ReaderNavigationState;
  fontSize: number;
  theme: ReaderTheme;
}

// ============================================
// FACTORY RESULT
// ============================================

export interface ReaderComponent {
  type: DocumentType;
  Component: React.ComponentType<BaseReaderProps>;
  supportsAnnotations: boolean;
  supportsPagination: boolean;
  supportsSearch: boolean;
}
