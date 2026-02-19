/**
 * Reader Factory
 * 
 * Creates the appropriate reader component based on document type.
 * Provides a unified interface for all document readers.
 * 
 * Usage:
 * ```tsx
 * import { createReader, getReaderForDocument } from '../fitmind/readers';
 * 
 * const ReaderComponent = getReaderForDocument(document);
 * return <ReaderComponent document={document} {...props} />;
 * ```
 */

import React from 'react';
import type { FitMindDocument } from '../schema';
import type {
  DocumentType,
  BaseReaderProps,
  ReaderComponent,
  ReaderTheme,
} from './types';

import { PDFReader } from './PDFReader';
import { EPUBReader } from './EPUBReader';
import { ArticleReader } from './ArticleReader';
import { TextReader } from './TextReader';

// ============================================
// READER REGISTRY
// ============================================

const READER_REGISTRY: Record<DocumentType, ReaderComponent> = {
  PDF: {
    type: 'PDF',
    Component: PDFReader as React.ComponentType<BaseReaderProps>,
    supportsAnnotations: true,
    supportsPagination: true,
    supportsSearch: true,
  },
  EPUB: {
    type: 'EPUB',
    Component: EPUBReader as React.ComponentType<BaseReaderProps>,
    supportsAnnotations: true,
    supportsPagination: true,
    supportsSearch: true,
  },
  ARTICLE: {
    type: 'ARTICLE',
    Component: ArticleReader as React.ComponentType<BaseReaderProps>,
    supportsAnnotations: true,
    supportsPagination: false,
    supportsSearch: false,
  },
  NOTE: {
    type: 'NOTE',
    Component: TextReader as React.ComponentType<BaseReaderProps>,
    supportsAnnotations: false,
    supportsPagination: false,
    supportsSearch: false,
  },
};

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Get the reader component for a document type
 */
export function getReaderComponent(type: DocumentType): React.ComponentType<BaseReaderProps> {
  const reader = READER_REGISTRY[type];
  if (!reader) {
    console.warn(`[ReaderFactory] Unknown document type: ${type}, falling back to TextReader`);
    return TextReader as React.ComponentType<BaseReaderProps>;
  }
  return reader.Component;
}

/**
 * Get reader info for a document type
 */
export function getReaderInfo(type: DocumentType): ReaderComponent {
  return READER_REGISTRY[type] || READER_REGISTRY.NOTE;
}

/**
 * Get the appropriate reader component for a FitMind document
 */
export function getReaderForDocument(document: FitMindDocument): React.ComponentType<BaseReaderProps> {
  const docType = document.type as DocumentType;
  return getReaderComponent(docType);
}

/**
 * Determine if a document type supports in-app reading
 */
export function canReadInApp(document: FitMindDocument): boolean {
  const docType = document.type as DocumentType;
  const hasReader = docType in READER_REGISTRY;
  
  // For PDF/EPUB, check if file exists
  if (docType === 'PDF' || docType === 'EPUB') {
    return hasReader && !!document.file_path;
  }
  
  // For articles/notes, check if content exists
  return hasReader && !!document.content;
}

/**
 * Create default reader theme from app theme
 */
export function createReaderTheme(
  appTheme: { colors: { background: string; text: string; accent: string }; isDark?: boolean },
  mode?: 'light' | 'dark' | 'sepia'
): ReaderTheme {
  const themeMode = mode || (appTheme.isDark ? 'dark' : 'light');
  
  if (themeMode === 'sepia') {
    return {
      backgroundColor: '#f4ecd8',
      textColor: '#5c4b37',
      accentColor: '#8b7355',
      highlightColor: '#f0e68c',
      linkColor: '#8b4513',
      mode: 'sepia',
    };
  }
  
  if (themeMode === 'dark') {
    return {
      backgroundColor: appTheme.colors.background,
      textColor: appTheme.colors.text,
      accentColor: appTheme.colors.accent,
      highlightColor: '#fbbf2480',
      linkColor: '#60a5fa',
      mode: 'dark',
    };
  }
  
  return {
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    accentColor: appTheme.colors.accent,
    highlightColor: '#fef08a',
    linkColor: '#2563eb',
    mode: 'light',
  };
}

/**
 * Render document with appropriate reader
 * Convenience function that creates the reader component inline
 */
export function renderDocument(
  document: FitMindDocument,
  props: Omit<BaseReaderProps, 'document'>
): React.ReactElement {
  const ReaderComponent = getReaderForDocument(document);
  return React.createElement(ReaderComponent, { ...props, document });
}

// ============================================
// TYPE GUARDS
// ============================================

export function isPDFDocument(document: FitMindDocument): boolean {
  return document.type === 'PDF';
}

export function isEPUBDocument(document: FitMindDocument): boolean {
  return document.type === 'EPUB';
}

export function isArticleDocument(document: FitMindDocument): boolean {
  return document.type === 'ARTICLE';
}

export function isNoteDocument(document: FitMindDocument): boolean {
  return document.type === 'NOTE';
}

export function isBinaryDocument(document: FitMindDocument): boolean {
  return document.type === 'PDF' || document.type === 'EPUB';
}

// ============================================
// FEATURE DETECTION
// ============================================

/**
 * Check if reader supports a feature for given document type
 */
export function readerSupports(
  documentType: DocumentType,
  feature: 'annotations' | 'pagination' | 'search'
): boolean {
  const reader = READER_REGISTRY[documentType];
  if (!reader) return false;
  
  switch (feature) {
    case 'annotations':
      return reader.supportsAnnotations;
    case 'pagination':
      return reader.supportsPagination;
    case 'search':
      return reader.supportsSearch;
    default:
      return false;
  }
}

export default {
  getReaderComponent,
  getReaderInfo,
  getReaderForDocument,
  canReadInApp,
  createReaderTheme,
  renderDocument,
  readerSupports,
};
