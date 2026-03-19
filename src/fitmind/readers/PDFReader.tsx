/**
 * PDF Reader Component
 * 
 * High-performance PDF rendering using react-native-pdf.
 * Falls back to WebView-based PDF.js on Expo Go or web.
 * 
 * Features:
 * - Native PDF rendering on iOS/Android
 * - Zoom and pan gestures
 * - Page navigation
 * - Text selection for annotations
 * - Graceful Expo Go fallback
 */

import React, { useCallback, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import ThemedText from '../../components/ThemedText';
import type {
  PDFReaderProps,
  DocumentLoadInfo,
  ReaderNavigationState,
} from './types';
import {
  normalizeReaderFileUri,
} from '../readerEngine';

// Inline PDF.js CDN URLs
const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
const PDFJS_SCRIPT = `${PDFJS_CDN}/pdf.min.js`;
const PDFJS_WORKER = `${PDFJS_CDN}/pdf.worker.min.js`;

// ============================================
// NATIVE PDF (lazy loaded)
// ============================================

let NativePdfComponent: React.ComponentType<any> | null = null;
let nativePdfError: Error | null = null;

// Only try to load native PDF on native platforms
if (Platform.OS !== 'web') {
  try {
    NativePdfComponent = require('react-native-pdf').default;
  } catch (e) {
    nativePdfError = e instanceof Error ? e : new Error('react-native-pdf not available');
  }
}

// ============================================
// PDF READER COMPONENT
// ============================================

export function PDFReader({
  document,
  currentPage,
  onPageChange,
  onLoad,
  onError,
  onTextSelect,
  theme,
  horizontal = false,
  enableZoom = true,
  singlePage = true,
}: PDFReaderProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(document.total_pages || 1);
  const [useWebFallback, setUseWebFallback] = useState(!NativePdfComponent);
  const webViewRef = useRef<WebView>(null);

  const fileUri = normalizeReaderFileUri(document.file_path);

  // =====================
  // Native PDF Handlers
  // =====================

  const handleNativeLoadComplete = useCallback((numPages: number) => {
    setIsLoading(false);
    setTotalPages(numPages);
    
    const loadInfo: DocumentLoadInfo = {
      totalPages: numPages,
      title: document.title,
      author: document.author,
      wordCount: document.word_count || undefined,
      estimatedMinutes: document.estimated_minutes || undefined,
    };
    
    onLoad?.(loadInfo);
  }, [document, onLoad]);

  const handleNativePageChanged = useCallback((page: number) => {
    onPageChange(page);
  }, [onPageChange]);

  const handleNativeError = useCallback((error: unknown) => {
    if (__DEV__) console.error('[PDFReader] Native error:', error);
    
    // Try web fallback on native error
    if (!useWebFallback) {
      if (__DEV__) console.log('[PDFReader] Falling back to web PDF renderer');
      setUseWebFallback(true);
      return;
    }
    
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
  }, [useWebFallback, onError]);

  // =====================
  // Web PDF Handlers
  // =====================

  const handleWebMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'loaded') {
        setIsLoading(false);
        setTotalPages(data.totalPages || 1);
        onLoad?.({
          totalPages: data.totalPages || 1,
          title: document.title,
          author: document.author,
        });
      } else if (data.type === 'pageChanged') {
        onPageChange(data.page);
      } else if (data.type === 'error') {
        onError?.(new Error(data.message || 'Web PDF error'));
      } else if (data.type === 'textSelected' && data.text) {
        onTextSelect?.({
          text: data.text,
          pageNumber: data.page || currentPage,
        });
      }
    } catch (e) {
      if (__DEV__) console.warn('[PDFReader] Failed to parse web message:', e);
    }
  }, [document, currentPage, onPageChange, onLoad, onError, onTextSelect]);

  // Navigate to page via WebView
  const navigateWebToPage = useCallback((page: number) => {
    webViewRef.current?.injectJavaScript(`
      if (window.PDFViewerApplication) {
        window.PDFViewerApplication.page = ${page};
      }
      true;
    `);
  }, []);

  // =====================
  // Render
  // =====================

  // Loading state
  if (isLoading && !useWebFallback) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.accentColor} />
        <ThemedText variant="body" color="muted" style={styles.loadingText}>
          Loading PDF...
        </ThemedText>
      </View>
    );
  }

  // Web fallback (Expo Go, web, or native failure)
  if (useWebFallback) {
    const isDark = theme.mode === 'dark';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <script src="${PDFJS_SCRIPT}"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: ${isDark ? '#1a1a2e' : '#f5f5f5'};
            font-family: system-ui;
            overflow: hidden;
          }
          #pdf-container {
            width: 100%;
            height: 100vh;
            overflow: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
          }
          canvas {
            border: 1px solid ${isDark ? '#333' : '#ddd'};
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin: 10px 0;
            background: white;
          }
          .loading {
            color: ${isDark ? '#aaa' : '#666'};
            font-size: 16px;
            padding: 40px;
          }
        </style>
      </head>
      <body>
        <div id="pdf-container">
          <div class="loading">Loading PDF...</div>
        </div>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_WORKER}';
          
          async function loadPDF() {
            try {
              const pdf = await pdfjsLib.getDocument('${fileUri}').promise;
              const container = document.getElementById('pdf-container');
              container.innerHTML = '';
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'loaded',
                totalPages: pdf.numPages
              }));
              
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const scale = 1.5;
                const viewport = page.getViewport({ scale });
                
                const canvas = document.createElement('canvas');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                container.appendChild(canvas);
                
                const context = canvas.getContext('2d');
                await page.render({ canvasContext: context, viewport }).promise;
              }
            } catch (err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: err.message || 'Failed to load PDF'
              }));
            }
          }
          
          loadPDF();
        </script>
      </body>
      </html>
    `;

    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.accentColor} />
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webView}
          onMessage={handleWebMessage}
          onError={(e) => onError?.(new Error(e.nativeEvent.description))}
          originWhitelist={['*']}
          allowFileAccess
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="compatibility"
        />
      </View>
    );
  }

  // Native PDF renderer
  if (!NativePdfComponent) {
    return (
      <View style={[styles.container, styles.fallbackContainer, { backgroundColor: theme.backgroundColor }]}>
        <ThemedText variant="h3" color="primary" style={styles.fallbackTitle}>
          PDF Viewer Unavailable
        </ThemedText>
        <ThemedText variant="body" color="muted" style={styles.fallbackText}>
          Native PDF rendering requires a development build.
          Use "Open with system reader" to view this document.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accentColor} />
        </View>
      )}
      <NativePdfComponent
        source={{ uri: fileUri, cache: true }}
        page={currentPage}
        style={styles.pdf}
        onLoadComplete={handleNativeLoadComplete}
        onPageChanged={handleNativePageChanged}
        onError={handleNativeError}
        trustAllCerts={false}
        enablePaging={singlePage}
        horizontal={horizontal}
        fitPolicy={0}
        minScale={0.5}
        maxScale={3.0}
        enableDoubleTapZoom={enableZoom}
        spacing={8}
      />
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pdf: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallbackTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  fallbackText: {
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default PDFReader;
