/**
 * Native PDF Viewer (iOS/Android)
 * Uses react-native-pdf for native PDF rendering.
 * Gracefully handles missing native module (Expo Go).
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';

interface PdfViewerSource {
  uri: string;
  cache?: boolean;
}

export interface PdfViewerProps {
  source: PdfViewerSource;
  style?: ViewStyle;
  page?: number;
  trustAllCerts?: boolean;
  onLoadComplete?: (totalPages: number) => void;
  onPageChanged?: (page: number) => void;
  onError?: (error: unknown) => void;
}

// Lazy-load react-native-pdf to avoid crash in Expo Go
let PdfComponent: React.ComponentType<any> | null = null;
let pdfLoadError: Error | null = null;

try {
  // Wrapped in try-catch because require will throw if native module unavailable
  PdfComponent = require('react-native-pdf').default;
} catch (e) {
  pdfLoadError = e instanceof Error ? e : new Error('react-native-pdf not available');
}

export function PdfViewer(props: PdfViewerProps): React.ReactElement {
  const [nativeError, setNativeError] = useState<string | null>(null);

  useEffect(() => {
    if (pdfLoadError) {
      setNativeError(pdfLoadError.message);
      props.onError?.(pdfLoadError);
    }
  }, []);

  // Native module not available - show fallback
  if (!PdfComponent || pdfLoadError) {
    return (
      <View style={[styles.fallbackContainer, props.style]}>
        <Text style={styles.fallbackTitle}>PDF Viewer Unavailable</Text>
        <Text style={styles.fallbackMessage}>
          Native PDF rendering requires a development build.
          {'\n\n'}Use "Open with System Reader" to view this document.
        </Text>
        {nativeError && <Text style={styles.errorDetail}>{nativeError}</Text>}
      </View>
    );
  }

  return (
    <PdfComponent
      source={props.source}
      style={props.style}
      page={props.page}
      trustAllCerts={props.trustAllCerts}
      onLoadComplete={props.onLoadComplete}
      onPageChanged={props.onPageChanged}
      onError={props.onError}
    />
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1a1f2e',
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  fallbackMessage: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorDetail: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 16,
    fontFamily: 'monospace',
  },
});

export default PdfViewer;
