/**
 * EPUB Reader Component
 * 
 * WebView-based EPUB rendering using epub.js.
 * 
 * Features:
 * - Full EPUB 2/3 support
 * - Adjustable font size and line height
 * - CFI-based location persistence
 * - Theme support (light/dark/sepia)
 * - Text selection for annotations
 * - Swipe navigation
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import ThemedText from '../../components/ThemedText';
import type {
  EPUBReaderProps,
  DocumentLoadInfo,
} from './types';
import {
  normalizeReaderFileUri,
  parseEpubWebMessage,
} from '../readerEngine';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// CDN URLs for epub.js
const EPUB_CDN = 'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist';
const EPUB_SCRIPT = `${EPUB_CDN}/epub.min.js`;

// ============================================
// EPUB READER COMPONENT
// ============================================

export function EPUBReader({
  document,
  currentPage,
  onPageChange,
  onLoad,
  onError,
  onTextSelect,
  onLocationChange,
  theme,
  fontSize = 1.0,
  lineHeight = 1.5,
  customCSS,
  initialCFI,
}: EPUBReaderProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [epubBase64, setEpubBase64] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(document.total_pages || 100);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentCFI, setCurrentCFI] = useState<string | undefined>(initialCFI);
  
  const webViewRef = useRef<WebView>(null);
  const fileUri = normalizeReaderFileUri(document.file_path);

  // =====================
  // Load EPUB file
  // =====================

  useEffect(() => {
    loadEpubFile();
  }, [document.id]);

  const loadEpubFile = async () => {
    if (!fileUri) {
      onError?.(new Error('No EPUB file path'));
      setLoadFailed(true);
      return;
    }

    try {
      // Read EPUB as base64 for WebView injection
      const normalizedUri = fileUri.replace('file://', '');
      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      
      if (!fileInfo.exists) {
        throw new Error('EPUB file not found');
      }

      const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
        encoding: 'base64',
      });
      
      setEpubBase64(base64);
    } catch (error) {
      if (__DEV__) console.error('[EPUBReader] Failed to load EPUB:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
      setLoadFailed(true);
    }
  };

  // =====================
  // WebView Message Handler
  // =====================

  const handleWebMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    const parsed = parseEpubWebMessage(event.nativeEvent.data);
    
    switch (parsed.type) {
      case 'loaded':
        setIsLoading(false);
        setTotalPages(parsed.totalPages || 100);
        onLoad?.({
          totalPages: parsed.totalPages || 100,
          title: document.title,
          author: document.author,
          wordCount: document.word_count || undefined,
          estimatedMinutes: document.estimated_minutes || undefined,
        });
        
        // Restore position if we have a saved CFI
        if (initialCFI) {
          navigateToCFI(initialCFI);
        }
        break;
        
      case 'relocated':
        const { progress, atStart, atEnd, cfi } = parsed.payload;
        setProgressPercent(progress);
        setCurrentCFI(cfi);
        
        // Convert progress to "page" number (for compatibility)
        const pageNum = Math.max(1, Math.ceil((progress / 100) * totalPages));
        onPageChange(pageNum);
        
        if (cfi) {
          onLocationChange?.(cfi, progress);
        }
        break;
        
      case 'error':
        if (__DEV__) console.error('[EPUBReader] WebView error:', parsed.message);
        setLoadFailed(true);
        onError?.(new Error(parsed.message));
        break;
        
      case 'unknown':
        // Try to parse as selection event
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'textSelected' && data.text) {
            onTextSelect?.({
              text: data.text,
              pageNumber: currentPage,
              startOffset: data.startOffset,
              endOffset: data.endOffset,
            });
          }
        } catch {
          // Ignore unparseable messages
        }
        break;
    }
  }, [document, totalPages, currentPage, initialCFI, onPageChange, onLoad, onError, onTextSelect, onLocationChange]);

  // =====================
  // Navigation Methods
  // =====================

  const navigateToCFI = useCallback((cfi: string) => {
    webViewRef.current?.injectJavaScript(`
      if (window.rendition) {
        window.rendition.display('${cfi}');
      }
      true;
    `);
  }, []);

  const navigateNext = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      if (window.rendition) {
        window.rendition.next();
      }
      true;
    `);
  }, []);

  const navigatePrev = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      if (window.rendition) {
        window.rendition.prev();
      }
      true;
    `);
  }, []);

  const setFontSize = useCallback((size: number) => {
    webViewRef.current?.injectJavaScript(`
      if (window.rendition) {
        window.rendition.themes.fontSize('${size * 100}%');
      }
      true;
    `);
  }, []);

  // Apply font size when it changes
  useEffect(() => {
    if (!isLoading) {
      setFontSize(fontSize);
    }
  }, [fontSize, isLoading, setFontSize]);

  // =====================
  // Build HTML
  // =====================

  const buildHtml = useCallback(() => {
    if (!epubBase64) return '';

    const isDark = theme.mode === 'dark';
    const bgColor = isDark ? '#1a1a2e' : '#fafafa';
    const textColor = isDark ? '#e4e4e7' : '#18181b';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script src="${EPUB_SCRIPT}"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: ${bgColor};
            font-family: Georgia, serif;
          }
          #viewer {
            width: 100%;
            height: 100%;
          }
          #viewer iframe {
            width: 100% !important;
          }
          ${customCSS || ''}
        </style>
      </head>
      <body>
        <div id="viewer"></div>
        <script>
          (function() {
            try {
              // Convert base64 to ArrayBuffer
              const base64 = '${epubBase64}';
              const binaryString = atob(base64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Initialize epub.js
              const book = ePub(bytes.buffer);
              const rendition = window.rendition = book.renderTo('viewer', {
                width: '100%',
                height: '100%',
                spread: 'none',
                flow: 'paginated'
              });
              
              // Apply theme
              rendition.themes.default({
                body: {
                  'background': '${bgColor}',
                  'color': '${textColor}',
                  'font-size': '${fontSize * 100}%',
                  'line-height': '${lineHeight}'
                }
              });
              
              // Display book
              rendition.display();
              
              // Report load complete
              book.ready.then(function() {
                book.locations.generate(1024).then(function() {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'loaded',
                    totalPages: book.locations.total || 100
                  }));
                });
              });
              
              // Handle location changes
              rendition.on('relocated', function(location) {
                const progress = book.locations.percentageFromCfi(location.start.cfi) * 100;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'relocated',
                  progress: progress,
                  cfi: location.start.cfi,
                  atStart: location.atStart,
                  atEnd: location.atEnd
                }));
              });
              
              // Handle text selection
              rendition.on('selected', function(cfiRange, contents) {
                const text = rendition.getRange(cfiRange).toString();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'textSelected',
                  text: text,
                  cfi: cfiRange
                }));
              });
              
            } catch (err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'error',
                message: err.message || 'Failed to load EPUB'
              }));
            }
          })();
        </script>
      </body>
      </html>
    `;
  }, [epubBase64, theme.mode, fontSize, lineHeight, customCSS]);

  // =====================
  // Render
  // =====================

  // Loading state
  if (isLoading && !loadFailed) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.accentColor} />
        <ThemedText variant="body" color="muted" style={styles.loadingText}>
          Loading EPUB...
        </ThemedText>
      </View>
    );
  }

  // Error state
  if (loadFailed) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: theme.backgroundColor }]}>
        <ThemedText variant="h3" color="primary" style={styles.errorTitle}>
          Failed to Load EPUB
        </ThemedText>
        <ThemedText variant="body" color="muted" style={styles.errorText}>
          The EPUB file could not be loaded. It may be corrupted or in an unsupported format.
        </ThemedText>
      </View>
    );
  }

  // Waiting for EPUB data
  if (!epubBase64) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.accentColor} />
        <ThemedText variant="body" color="muted" style={styles.loadingText}>
          Preparing reader...
        </ThemedText>
      </View>
    );
  }

  const html = buildHtml();

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
        onError={(e) => {
          setLoadFailed(true);
          onError?.(new Error(e.nativeEvent.description));
        }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mixedContentMode="compatibility"
        bounces={false}
        scrollEnabled={false}  // epub.js handles scrolling
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />
      
      {/* Progress indicator */}
      <View style={[styles.progressBar, { backgroundColor: theme.backgroundColor }]}>
        <View 
          style={[
            styles.progressFill, 
            { 
              width: `${progressPercent}%`,
              backgroundColor: theme.accentColor,
            }
          ]} 
        />
      </View>
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
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressFill: {
    height: '100%',
  },
});

export default EPUBReader;
